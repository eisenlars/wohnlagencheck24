import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/security/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";
import { checkAdminApiRateLimit, extractClientIpFromHeaders } from "@/lib/security/rate-limit";
import { writeSecurityAuditLog } from "@/lib/security/audit-log";
import { fetchProviderPricingFromWeb } from "@/lib/llm/pricing-fallback";
import { validateOutboundUrl } from "@/lib/security/outbound-url";
import { isMissingTable, loadUsdToEurRate } from "@/lib/llm/provider-catalog";

type Body = {
  apply?: boolean;
  provider?: string;
};

type ProviderRow = {
  id: string;
  provider: string;
  model: string;
  input_cost_usd_per_1k?: number | null;
  output_cost_usd_per_1k?: number | null;
};

function monthStartIsoUtc(): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  return d.toISOString().slice(0, 10);
}

export async function POST(req: Request) {
  try {
    const adminUser = await requireAdmin(["admin_super", "admin_ops"]);
    const limit = await checkAdminApiRateLimit(req, adminUser.userId);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } });
    }
    const body = (await req.json().catch(() => ({}))) as Body;
    const apply = body.apply !== false;
    const filterProvider = String(body.provider ?? "").trim().toLowerCase();

    const admin = createAdminClient();
    const query = admin
      .from("llm_provider_models")
      .select(`
        id,
        model,
        input_cost_usd_per_1k,
        output_cost_usd_per_1k,
        account:llm_provider_accounts!inner(provider)
      `)
      .eq("is_active", true)
      .order("model", { ascending: true });
    const { data: providers, error: providersError } = await query;
    if (providersError) {
      if (isMissingTable(providersError, "llm_provider_models") || isMissingTable(providersError, "llm_provider_accounts")) {
        return NextResponse.json({ error: "LLM-Katalogtabellen fehlen. Bitte Migration ausführen." }, { status: 409 });
      }
      return NextResponse.json({ error: providersError.message }, { status: 500 });
    }

    const rows = ((providers ?? []) as Array<{
      id?: string | null;
      model?: string | null;
      input_cost_usd_per_1k?: number | null;
      output_cost_usd_per_1k?: number | null;
      account?: Array<{ provider?: string | null }> | null;
    }>)
      .map((row): ProviderRow => ({
        id: String(row.id ?? "").trim(),
        model: String(row.model ?? "").trim(),
        input_cost_usd_per_1k: typeof row.input_cost_usd_per_1k === "number" ? row.input_cost_usd_per_1k : null,
        output_cost_usd_per_1k: typeof row.output_cost_usd_per_1k === "number" ? row.output_cost_usd_per_1k : null,
        provider: String(row.account?.[0]?.provider ?? "").trim().toLowerCase(),
      }))
      .filter((row) => !filterProvider || row.provider === filterProvider);
    const monthStart = monthStartIsoUtc();
    const usdToEurRate = await loadUsdToEurRate(admin, monthStart).catch(() => null);
    if (!(usdToEurRate && usdToEurRate > 0)) {
      return NextResponse.json(
        { error: `FX-Rate fehlt: USD->EUR für Monat ${monthStart}. Bitte in llm_fx_monthly_rates pflegen.` },
        { status: 409 },
      );
    }

    const processRow = async (row: ProviderRow): Promise<Record<string, unknown>> => {
      const fetched = await fetchProviderPricingFromWeb(row.provider, row.model, null);
      const baseResult: Record<string, unknown> = {
        provider_id: row.id,
        provider: row.provider,
        model: row.model,
        source_url: fetched.sourceUrl,
        parse_confidence: fetched.parseConfidence,
        parse_message: fetched.parseMessage,
        applied: false,
      };

      const sourceUrl = String(fetched.sourceUrl ?? "").trim();
      if (sourceUrl) {
        const sourceValidation = await validateOutboundUrl(sourceUrl);
        if (!sourceValidation.ok) {
          return {
            ...baseResult,
            status: "blocked",
            parse_message: `Quelle blockiert (${sourceValidation.reason})`,
            applied: false,
          };
        }
      }

      const isUsable = fetched.ok && fetched.inputCostEurPer1k > 0 && fetched.outputCostEurPer1k > 0;
      if (!isUsable) {
        return {
          ...baseResult,
          status: "failed",
          applied: false,
        };
      } else {
        const inputCostUsd = fetched.inputCostEurPer1k;
        const outputCostUsd = fetched.outputCostEurPer1k;
        const inputCostEur = Number((inputCostUsd * usdToEurRate).toFixed(6));
        const outputCostEur = Number((outputCostUsd * usdToEurRate).toFixed(6));
        const confidenceThreshold = 0.65;
        const canApply = apply && fetched.parseConfidence >= confidenceThreshold;
        let didApply = false;
        if (canApply) {
          const { error: patchError } = await admin
            .from("llm_provider_models")
            .update({
              input_cost_usd_per_1k: inputCostUsd,
              output_cost_usd_per_1k: outputCostUsd,
            })
            .eq("id", row.id);
          if (!patchError) {
            didApply = true;
          }
        }

        const { error: obsError } = await admin.from("llm_provider_price_observations").insert({
          provider: row.provider,
          model: row.model,
          source_kind: "provider_web",
          source_url: fetched.sourceUrl,
          input_cost_eur_per_1k: inputCostEur,
          output_cost_eur_per_1k: outputCostEur,
          parse_confidence: fetched.parseConfidence,
          parse_status: didApply ? "applied" : "proposed",
          parse_message: `${fetched.parseMessage} (USD->EUR ${usdToEurRate})`,
          raw_excerpt: fetched.rawExcerpt,
          is_applied: didApply,
          applied_at: didApply ? new Date().toISOString() : null,
        });
        if (obsError && !isMissingTable(obsError, "llm_provider_price_observations")) {
          return {
            ...baseResult,
            status: "warning",
            applied: didApply,
            parse_message: `Preis gefunden, Observation konnte nicht gespeichert werden (${obsError.message}).`,
          };
        }
        return {
          ...baseResult,
          status: didApply ? "applied" : "proposed",
          applied: didApply,
          input_cost_eur_per_1k: inputCostEur,
          output_cost_eur_per_1k: outputCostEur,
          fx_rate_usd_to_eur: usdToEurRate,
        };
      }
    };

    const results: Array<Record<string, unknown>> = [];
    const batchSize = 4;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map((row) => processRow(row)));
      results.push(...batchResults);
    }
    const appliedCount = results.filter((r) => r.applied === true).length;
    const observedCount = results.filter((r) => {
      const status = String(r.status ?? "");
      return status === "applied" || status === "proposed" || status === "warning";
    }).length;
    const failedCount = results.filter((r) => {
      const status = String(r.status ?? "");
      return status === "failed" || status === "blocked";
    }).length;

    await writeSecurityAuditLog({
      actorUserId: adminUser.userId,
      actorRole: adminUser.role,
      eventType: "update",
      entityType: "other",
      entityId: "llm_pricing_sync",
      payload: {
        apply,
        provider: filterProvider || null,
        total: rows.length,
        observed: observedCount,
        applied: appliedCount,
        failed: failedCount,
        fx_month_start: monthStart,
        fx_rate_usd_to_eur: usdToEurRate,
      },
      ip: extractClientIpFromHeaders(req.headers),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({
      ok: true,
      summary: {
        total: rows.length,
        observed: observedCount,
        applied: appliedCount,
        failed: failedCount,
        fx_month_start: monthStart,
        fx_rate_usd_to_eur: usdToEurRate,
      },
      results,
      note: "Preisquelle: Provider-Webseite. Wenn keine Preise übernommen wurden, bitte manuell pflegen.",
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
