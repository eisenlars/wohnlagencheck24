import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/security/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";
import { checkAdminApiRateLimit } from "@/lib/security/rate-limit";

type UsageRow = {
  created_at?: string | null;
  partner_id?: string | null;
  network_partner_id?: string | null;
  route_name?: string | null;
  provider?: string | null;
  model?: string | null;
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  total_tokens?: number | null;
  estimated_cost_eur?: number | null;
  estimated_credit_delta?: number | null;
  billing_scope?: string | null;
  billing_mode?: string | null;
  feature?: string | null;
  status?: string | null;
};

type NetworkPartnerMetaRow = {
  id?: string | null;
  portal_partner_id?: string | null;
  company_name?: string | null;
};

function isMissingTable(error: unknown, table: string): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return msg.includes(`public.${table}`) && msg.includes("does not exist");
}

function asFiniteNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function asText(value: unknown, fallback = "unknown"): string {
  const raw = String(value ?? "").trim();
  return raw.length > 0 ? raw : fallback;
}

function monthRangeUtc(date?: string | null) {
  const source = date ? new Date(date) : new Date();
  const y = source.getUTCFullYear();
  const m = source.getUTCMonth();
  const start = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m + 1, 1, 0, 0, 0, 0));
  return { start: start.toISOString(), end: end.toISOString() };
}

type AggregateRow = {
  events: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_eur: number;
  estimated_credits: number;
};

function createAggregate(): AggregateRow {
  return {
    events: 0,
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
    cost_eur: 0,
    estimated_credits: 0,
  };
}

function applyUsage(target: AggregateRow, row: UsageRow) {
  target.events += 1;
  target.prompt_tokens += asFiniteNumber(row.prompt_tokens);
  target.completion_tokens += asFiniteNumber(row.completion_tokens);
  target.total_tokens += asFiniteNumber(row.total_tokens);
  target.cost_eur += asFiniteNumber(row.estimated_cost_eur);
  target.estimated_credits += asFiniteNumber(row.estimated_credit_delta);
}

function finalizeAggregate<T extends AggregateRow>(row: T): T {
  return {
    ...row,
    cost_eur: Number(row.cost_eur.toFixed(6)),
    estimated_credits: Number(row.estimated_credits.toFixed(4)),
  };
}

export async function GET(req: Request) {
  try {
    const adminUser = await requireAdmin(["admin_super", "admin_ops"]);
    const limit = await checkAdminApiRateLimit(req, adminUser.userId);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } });
    }

    const url = new URL(req.url);
    const month = url.searchParams.get("month");
    const partnerId = String(url.searchParams.get("partner_id") ?? "").trim();
    const billingScope = String(url.searchParams.get("billing_scope") ?? "").trim().toLowerCase();
    const range = monthRangeUtc(month);
    const admin = createAdminClient();

    const baseQuery = admin
      .from("llm_usage_events")
      .select(
        "created_at, partner_id, network_partner_id, route_name, provider, model, prompt_tokens, completion_tokens, total_tokens, estimated_cost_eur, estimated_credit_delta, billing_scope, billing_mode, feature, status",
      )
      .gte("created_at", range.start)
      .lt("created_at", range.end);
    const query = billingScope ? baseQuery.eq("billing_scope", billingScope) : baseQuery;
    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) {
      if (isMissingTable(error, "llm_usage_events")) {
        return NextResponse.json({
          ok: true,
          month_start: range.start,
          month_end: range.end,
          totals: createAggregate(),
          by_partner: [],
          by_feature: [],
          by_model: [],
          by_scope: [],
          recent_events: [],
          warning: "Tabelle `llm_usage_events` fehlt.",
        });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rawRows = (data ?? []) as UsageRow[];
    const networkPartnerIds = Array.from(
      new Set(
        rawRows
          .map((row) => String(row.network_partner_id ?? "").trim())
          .filter((value) => value.length > 0),
      ),
    );

    const networkPartnerMap = new Map<string, { portal_partner_id: string; company_name: string }>();
    if (networkPartnerIds.length > 0) {
      const { data: networkPartnerRows, error: networkPartnerError } = await admin
        .from("network_partners")
        .select("id, portal_partner_id, company_name")
        .in("id", networkPartnerIds);
      if (networkPartnerError) {
        if (!isMissingTable(networkPartnerError, "network_partners")) {
          return NextResponse.json({ error: networkPartnerError.message }, { status: 500 });
        }
      } else {
        for (const row of (networkPartnerRows ?? []) as NetworkPartnerMetaRow[]) {
          const id = String(row.id ?? "").trim();
          if (!id) continue;
          networkPartnerMap.set(id, {
            portal_partner_id: String(row.portal_partner_id ?? "").trim(),
            company_name: String(row.company_name ?? "").trim() || id,
          });
        }
      }
    }

    const filteredRows = partnerId
      ? rawRows.filter((row) => {
          const ownerId = String(row.partner_id ?? "").trim();
          const networkPartnerId = String(row.network_partner_id ?? "").trim();
          const networkMeta = networkPartnerId ? networkPartnerMap.get(networkPartnerId) : null;
          return ownerId === partnerId || String(networkMeta?.portal_partner_id ?? "").trim() === partnerId;
        })
      : rawRows;

    const totals = createAggregate();
    const byPartner = new Map<string, AggregateRow & { partner_id: string; billing_scope: string }>();
    const byFeature = new Map<string, AggregateRow & { feature: string }>();
    const byModel = new Map<string, AggregateRow & { provider: string; model: string }>();
    const byScope = new Map<string, AggregateRow & { billing_scope: string }>();
    const selfByFeature = new Map<string, AggregateRow & { feature: string }>();
    const selfByModel = new Map<string, AggregateRow & { provider: string; model: string }>();
    const byPortalPartner = new Map<string, {
      partner_id: string;
      self_events: number;
      self_total_tokens: number;
      self_cost_eur: number;
      self_estimated_credits: number;
      network_events: number;
      network_total_tokens: number;
      network_cost_eur: number;
      network_estimated_credits: number;
      total_events: number;
      total_total_tokens: number;
      total_cost_eur: number;
      total_estimated_credits: number;
    }>();
    const byNetworkPartner = new Map<string, {
      portal_partner_id: string;
      network_partner_id: string;
      network_partner_name: string;
      events: number;
      total_tokens: number;
      cost_eur: number;
      estimated_credits: number;
    }>();
    const byNetworkPartnerFeature = new Map<string, {
      network_partner_id: string;
      network_partner_name: string;
      feature: string;
      events: number;
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
      cost_eur: number;
      estimated_credits: number;
    }>();
    const byNetworkPartnerModel = new Map<string, {
      network_partner_id: string;
      network_partner_name: string;
      provider: string;
      model: string;
      events: number;
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
      cost_eur: number;
      estimated_credits: number;
    }>();
    const partnerSelfTotals = createAggregate();
    const networkTotals = createAggregate();

    for (const row of filteredRows) {
      applyUsage(totals, row);

      const scope = asText(row.billing_scope, "legacy");
      const pid = asText(row.partner_id);
      const feature = asText(row.feature, "unknown");
      const provider = asText(row.provider);
      const model = asText(row.model);
      const networkPartnerId = String(row.network_partner_id ?? "").trim();
      const networkMeta = networkPartnerId ? networkPartnerMap.get(networkPartnerId) : null;
      const portalPartnerId = String(networkMeta?.portal_partner_id ?? pid).trim() || pid;
      const isNetworkUsage = networkPartnerId.length > 0;

      const partnerKey = `${pid}::${scope}`;
      const partnerAgg = byPartner.get(partnerKey) ?? { partner_id: pid, billing_scope: scope, ...createAggregate() };
      applyUsage(partnerAgg, row);
      byPartner.set(partnerKey, partnerAgg);

      const featureAgg = byFeature.get(feature) ?? { feature, ...createAggregate() };
      applyUsage(featureAgg, row);
      byFeature.set(feature, featureAgg);

      const modelKey = `${provider}::${model}`;
      const modelAgg = byModel.get(modelKey) ?? { provider, model, ...createAggregate() };
      applyUsage(modelAgg, row);
      byModel.set(modelKey, modelAgg);

      const scopeAgg = byScope.get(scope) ?? { billing_scope: scope, ...createAggregate() };
      applyUsage(scopeAgg, row);
      byScope.set(scope, scopeAgg);

      const portalAgg = byPortalPartner.get(portalPartnerId) ?? {
        partner_id: portalPartnerId,
        self_events: 0,
        self_total_tokens: 0,
        self_cost_eur: 0,
        self_estimated_credits: 0,
        network_events: 0,
        network_total_tokens: 0,
        network_cost_eur: 0,
        network_estimated_credits: 0,
        total_events: 0,
        total_total_tokens: 0,
        total_cost_eur: 0,
        total_estimated_credits: 0,
      };
      const totalTokens = asFiniteNumber(row.total_tokens);
      const costEur = asFiniteNumber(row.estimated_cost_eur);
      const estimatedCredits = asFiniteNumber(row.estimated_credit_delta);
      if (isNetworkUsage) {
        portalAgg.network_events += 1;
        portalAgg.network_total_tokens += totalTokens;
        portalAgg.network_cost_eur += costEur;
        portalAgg.network_estimated_credits += estimatedCredits;
      } else {
        portalAgg.self_events += 1;
        portalAgg.self_total_tokens += totalTokens;
        portalAgg.self_cost_eur += costEur;
        portalAgg.self_estimated_credits += estimatedCredits;
      }
      portalAgg.total_events += 1;
      portalAgg.total_total_tokens += totalTokens;
      portalAgg.total_cost_eur += costEur;
      portalAgg.total_estimated_credits += estimatedCredits;
      byPortalPartner.set(portalPartnerId, portalAgg);

      if (isNetworkUsage) {
        const networkAgg = byNetworkPartner.get(networkPartnerId) ?? {
          portal_partner_id: portalPartnerId,
          network_partner_id: networkPartnerId,
          network_partner_name: String(networkMeta?.company_name ?? networkPartnerId).trim() || networkPartnerId,
          events: 0,
          total_tokens: 0,
          cost_eur: 0,
          estimated_credits: 0,
        };
        networkAgg.events += 1;
        networkAgg.total_tokens += totalTokens;
        networkAgg.cost_eur += costEur;
        networkAgg.estimated_credits += estimatedCredits;
        byNetworkPartner.set(networkPartnerId, networkAgg);

        const networkFeatureKey = `${networkPartnerId}::${feature}`;
        const networkFeatureAgg = byNetworkPartnerFeature.get(networkFeatureKey) ?? {
          network_partner_id: networkPartnerId,
          network_partner_name: String(networkMeta?.company_name ?? networkPartnerId).trim() || networkPartnerId,
          feature,
          ...createAggregate(),
        };
        applyUsage(networkFeatureAgg, row);
        byNetworkPartnerFeature.set(networkFeatureKey, networkFeatureAgg);

        const networkModelKey = `${networkPartnerId}::${provider}::${model}`;
        const networkModelAgg = byNetworkPartnerModel.get(networkModelKey) ?? {
          network_partner_id: networkPartnerId,
          network_partner_name: String(networkMeta?.company_name ?? networkPartnerId).trim() || networkPartnerId,
          provider,
          model,
          ...createAggregate(),
        };
        applyUsage(networkModelAgg, row);
        byNetworkPartnerModel.set(networkModelKey, networkModelAgg);
      }

      if (partnerId) {
        if (isNetworkUsage && portalPartnerId === partnerId) {
          applyUsage(networkTotals, row);
        } else if (pid === partnerId) {
          applyUsage(partnerSelfTotals, row);
          const selfFeatureAgg = selfByFeature.get(feature) ?? { feature, ...createAggregate() };
          applyUsage(selfFeatureAgg, row);
          selfByFeature.set(feature, selfFeatureAgg);

          const selfModelKey = `${provider}::${model}`;
          const selfModelAgg = selfByModel.get(selfModelKey) ?? { provider, model, ...createAggregate() };
          applyUsage(selfModelAgg, row);
          selfByModel.set(selfModelKey, selfModelAgg);
        }
      }
    }

    const recentEvents = filteredRows.slice(0, 50).map((row) => {
      const networkPartnerId = String(row.network_partner_id ?? "").trim();
      const networkMeta = networkPartnerId ? networkPartnerMap.get(networkPartnerId) : null;
      return ({
      created_at: row.created_at ?? null,
      partner_id: asText(row.partner_id),
      network_partner_id: networkPartnerId || null,
      network_partner_name: networkMeta?.company_name ?? null,
      route_name: asText(row.route_name),
      feature: asText(row.feature, "unknown"),
      billing_scope: asText(row.billing_scope, "legacy"),
      billing_mode: asText(row.billing_mode, "unknown"),
      provider: asText(row.provider),
      model: asText(row.model),
      total_tokens: asFiniteNumber(row.total_tokens),
      estimated_cost_eur: Number(asFiniteNumber(row.estimated_cost_eur).toFixed(6)),
      estimated_credits: Number(asFiniteNumber(row.estimated_credit_delta).toFixed(4)),
      status: asText(row.status, "unknown"),
      });
    });

    return NextResponse.json({
      ok: true,
      month_start: range.start,
      month_end: range.end,
      partner_id: partnerId || null,
      billing_scope: billingScope || null,
      totals: finalizeAggregate(totals),
      by_partner: Array.from(byPartner.values()).map(finalizeAggregate).sort((a, b) => b.total_tokens - a.total_tokens),
      by_portal_partner: Array.from(byPortalPartner.values())
        .map((row) => ({
          ...row,
          self_cost_eur: Number(row.self_cost_eur.toFixed(6)),
          self_estimated_credits: Number(row.self_estimated_credits.toFixed(4)),
          network_cost_eur: Number(row.network_cost_eur.toFixed(6)),
          network_estimated_credits: Number(row.network_estimated_credits.toFixed(4)),
          total_cost_eur: Number(row.total_cost_eur.toFixed(6)),
          total_estimated_credits: Number(row.total_estimated_credits.toFixed(4)),
        }))
        .sort((a, b) => b.total_total_tokens - a.total_total_tokens),
      by_network_partner: Array.from(byNetworkPartner.values())
        .map((row) => ({
          ...row,
          cost_eur: Number(row.cost_eur.toFixed(6)),
          estimated_credits: Number(row.estimated_credits.toFixed(4)),
        }))
        .sort((a, b) => b.total_tokens - a.total_tokens),
      self_by_feature: Array.from(selfByFeature.values()).map(finalizeAggregate).sort((a, b) => b.total_tokens - a.total_tokens),
      self_by_model: Array.from(selfByModel.values()).map(finalizeAggregate).sort((a, b) => b.total_tokens - a.total_tokens),
      by_network_partner_feature: Array.from(byNetworkPartnerFeature.values()).map(finalizeAggregate).sort((a, b) => b.total_tokens - a.total_tokens),
      by_network_partner_model: Array.from(byNetworkPartnerModel.values()).map(finalizeAggregate).sort((a, b) => b.total_tokens - a.total_tokens),
      by_feature: Array.from(byFeature.values()).map(finalizeAggregate).sort((a, b) => b.total_tokens - a.total_tokens),
      by_model: Array.from(byModel.values()).map(finalizeAggregate).sort((a, b) => b.total_tokens - a.total_tokens),
      by_scope: Array.from(byScope.values()).map(finalizeAggregate).sort((a, b) => b.total_tokens - a.total_tokens),
      partner_self_totals: finalizeAggregate(partnerSelfTotals),
      network_totals: finalizeAggregate(networkTotals),
      recent_events: recentEvents,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
