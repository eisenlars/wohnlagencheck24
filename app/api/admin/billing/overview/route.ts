import { NextResponse } from "next/server";

import { buildPartnerLocaleBillingFeatureRows, isLocaleFeatureCode } from "@/lib/locale-billing-features";
import { loadPortalLocaleRegistry } from "@/lib/portal-locale-registry";
import { requireAdmin } from "@/lib/security/admin-auth";
import { checkAdminApiRateLimit } from "@/lib/security/rate-limit";
import { createAdminClient } from "@/utils/supabase/admin";

type PartnerRow = {
  id?: string | null;
  company_name?: string | null;
  is_active?: boolean | null;
  is_system_default?: boolean | null;
};

type PartnerBillingSettingRow = {
  partner_id?: string | null;
  portal_base_price_eur?: number | null;
  portal_ortslage_price_eur?: number | null;
  portal_export_ortslage_price_eur?: number | null;
};

type BillingFeatureCatalogRow = {
  code?: string | null;
  label?: string | null;
  note?: string | null;
  billing_unit?: string | null;
  default_enabled?: boolean | null;
  default_monthly_price_eur?: number | null;
  sort_order?: number | null;
  is_active?: boolean | null;
};

type PartnerFeatureOverrideRow = {
  partner_id?: string | null;
  feature_code?: string | null;
  is_enabled?: boolean | null;
  monthly_price_eur?: number | null;
};

type AreaRow = {
  id?: string | null;
  name?: string | null;
  slug?: string | null;
  parent_slug?: string | null;
  bundesland_slug?: string | null;
};

type PartnerAreaMapRow = {
  auth_user_id?: string | null;
  area_id?: string | null;
  is_active?: boolean | null;
  areas?: AreaRow[] | AreaRow | null;
};

type ChildAreaRow = {
  parent_slug?: string | null;
};

function isMissingTable(error: unknown, table: string): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return msg.includes(`public.${table}`) && msg.includes("does not exist");
}

function asText(value: unknown): string {
  return String(value ?? "").trim();
}

function asFiniteNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function isDistrictArea(areaId: string): boolean {
  return areaId.split("-").length <= 3;
}

function normalizeAreaRelation(value: unknown): AreaRow | null {
  const source = Array.isArray(value)
    ? value.find((item) => item && typeof item === "object")
    : value;
  if (!source || typeof source !== "object") return null;
  const area = source as Record<string, unknown>;
  return {
    id: asText(area.id),
    name: asText(area.name),
    slug: asText(area.slug),
    parent_slug: asText(area.parent_slug),
    bundesland_slug: asText(area.bundesland_slug),
  };
}

function monthRangeUtc(date?: string | null) {
  const source = date ? new Date(date) : new Date();
  const y = source.getUTCFullYear();
  const m = source.getUTCMonth();
  const start = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m + 1, 1, 0, 0, 0, 0));
  return { start: start.toISOString(), end: end.toISOString() };
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
    const range = monthRangeUtc(month);
    const admin = createAdminClient();

    const [partnersRes, defaultsRes, settingsRes, catalogRes, overridesRes, locales, areaMapRes] = await Promise.all([
      admin
        .from("partners")
        .select("id, company_name, is_active, is_system_default")
        .order("company_name", { ascending: true }),
      admin
        .from("billing_global_defaults")
        .select("id, portal_base_price_eur, portal_ortslage_price_eur, portal_export_ortslage_price_eur")
        .eq("id", 1)
        .maybeSingle(),
      admin
        .from("partner_billing_settings")
        .select("partner_id, portal_base_price_eur, portal_ortslage_price_eur, portal_export_ortslage_price_eur"),
      admin
        .from("billing_feature_catalog")
        .select("code, label, note, billing_unit, default_enabled, default_monthly_price_eur, sort_order, is_active")
        .order("sort_order", { ascending: true })
        .order("code", { ascending: true }),
      admin
        .from("partner_feature_overrides")
        .select("partner_id, feature_code, is_enabled, monthly_price_eur"),
      loadPortalLocaleRegistry(),
      admin
        .from("partner_area_map")
        .select("auth_user_id, area_id, is_active, areas(id, name, slug, parent_slug, bundesland_slug)")
        .eq("is_active", true)
        .order("area_id", { ascending: true }),
    ]);

    if (partnersRes.error) throw partnersRes.error;
    if (defaultsRes.error) throw defaultsRes.error;
    if (settingsRes.error) throw settingsRes.error;
    if (catalogRes.error) throw catalogRes.error;
    if (overridesRes.error) throw overridesRes.error;
    if (areaMapRes.error) throw areaMapRes.error;

    const defaults = defaultsRes.data ?? {
      portal_base_price_eur: 50,
      portal_ortslage_price_eur: 1,
      portal_export_ortslage_price_eur: 1,
    };
    const partners = ((partnersRes.data ?? []) as PartnerRow[])
      .filter((partner) => partner.is_system_default !== true)
      .map((partner) => ({
        id: asText(partner.id),
        company_name: asText(partner.company_name) || asText(partner.id),
        is_active: partner.is_active !== false,
      }))
      .filter((partner) => partner.id.length > 0);
    const partnerIds = partners.map((partner) => partner.id);

    const settingsByPartner = new Map(
      ((settingsRes.data ?? []) as PartnerBillingSettingRow[])
        .map((row) => [asText(row.partner_id), row] as const)
        .filter(([partnerId]) => partnerId.length > 0),
    );
    const overridesByPartner = new Map<string, PartnerFeatureOverrideRow[]>();
    for (const row of (overridesRes.data ?? []) as PartnerFeatureOverrideRow[]) {
      const partnerId = asText(row.partner_id);
      if (!partnerId) continue;
      const items = overridesByPartner.get(partnerId) ?? [];
      items.push(row);
      overridesByPartner.set(partnerId, items);
    }

    const activeMappings = (areaMapRes.data ?? []) as PartnerAreaMapRow[];
    const districtRows = activeMappings
      .map((entry) => ({
        partner_id: asText(entry.auth_user_id),
        area_id: asText(entry.area_id),
        area: normalizeAreaRelation(entry.areas),
      }))
      .filter((entry) => entry.partner_id.length > 0 && entry.area_id.length > 0 && isDistrictArea(entry.area_id));
    const districtSlugs = Array.from(new Set(
      districtRows
        .map((entry) => asText(entry.area?.slug))
        .filter((slug) => slug.length > 0),
    ));

    const ortslageCountByDistrict = new Map<string, number>();
    if (districtSlugs.length > 0) {
      const { data: childAreas, error: childAreasError } = await admin
        .from("areas")
        .select("parent_slug")
        .in("parent_slug", districtSlugs);
      if (childAreasError) throw childAreasError;
      for (const row of (childAreas ?? []) as ChildAreaRow[]) {
        const parentSlug = asText(row.parent_slug);
        if (!parentSlug) continue;
        ortslageCountByDistrict.set(parentSlug, (ortslageCountByDistrict.get(parentSlug) ?? 0) + 1);
      }
    }

    const catalogRows = (catalogRes.data ?? []) as BillingFeatureCatalogRow[];
    const nonLocaleFeatures = catalogRows.filter((feature) => !isLocaleFeatureCode(asText(feature.code), locales));
    const partnerSummaries = partners.map((partner) => {
      const partnerSettings = settingsByPartner.get(partner.id);
      const effectiveBasePrice = Number((partnerSettings?.portal_base_price_eur ?? defaults.portal_base_price_eur ?? 50).toFixed(2));
      const effectiveOrtslagePrice = Number((partnerSettings?.portal_ortslage_price_eur ?? defaults.portal_ortslage_price_eur ?? 1).toFixed(2));
      const effectiveExportPrice = Number((partnerSettings?.portal_export_ortslage_price_eur ?? defaults.portal_export_ortslage_price_eur ?? 1).toFixed(2));

      const partnerDistrictRows = districtRows.filter((row) => row.partner_id === partner.id);
      const portalAboTotal = Number(partnerDistrictRows.reduce((sum, row) => {
        const districtSlug = asText(row.area?.slug);
        const ortslagenCount = ortslageCountByDistrict.get(districtSlug) ?? 0;
        const exportCount = ortslagenCount;
        return sum + effectiveBasePrice + (ortslagenCount * effectiveOrtslagePrice) + (exportCount * effectiveExportPrice);
      }, 0).toFixed(2));

      const partnerOverrides = overridesByPartner.get(partner.id) ?? [];
      const localeRows = buildPartnerLocaleBillingFeatureRows({
        locales,
        catalogFeatures: catalogRows,
        partnerOverrides,
      });
      const localeTotal = Number(localeRows
        .filter((row) => row.enabled)
        .reduce((sum, row) => sum + Number(row.monthly_price_eur ?? 0), 0)
        .toFixed(2));

      const overrideByCode = new Map(
        partnerOverrides
          .map((row) => [asText(row.feature_code).toLowerCase(), row] as const)
          .filter(([code]) => code.length > 0),
      );
      const featureTotal = Number(nonLocaleFeatures.reduce((sum, feature) => {
        const code = asText(feature.code).toLowerCase();
        const override = overrideByCode.get(code);
        const enabled = override?.is_enabled ?? feature.default_enabled ?? false;
        if (!enabled) return sum;
        const monthlyPrice = override?.monthly_price_eur ?? feature.default_monthly_price_eur ?? 0;
        return sum + asFiniteNumber(monthlyPrice);
      }, 0).toFixed(2));

      return {
        partner_id: partner.id,
        company_name: partner.company_name,
        is_active: partner.is_active,
        portal_abo_eur: portalAboTotal,
        locales_eur: localeTotal,
        features_eur: featureTotal,
        recurring_total_eur: Number((portalAboTotal + localeTotal + featureTotal).toFixed(2)),
      };
    });

    const recurringTotals = partnerSummaries.reduce((acc, row) => {
      acc.portal_abo_eur += row.portal_abo_eur;
      acc.locales_eur += row.locales_eur;
      acc.features_eur += row.features_eur;
      acc.recurring_total_eur += row.recurring_total_eur;
      return acc;
    }, {
      portal_abo_eur: 0,
      locales_eur: 0,
      features_eur: 0,
      recurring_total_eur: 0,
    });

    const { data: usageRows, error: usageError } = await admin
      .from("llm_usage_events")
      .select("partner_id, network_partner_id, estimated_cost_eur, estimated_credit_delta, total_tokens")
      .gte("created_at", range.start)
      .lt("created_at", range.end);
    if (usageError && !isMissingTable(usageError, "llm_usage_events")) throw usageError;

    const usagePartnerMap = new Map<string, {
      ai_self_eur: number;
      ai_network_eur: number;
      ai_self_credits: number;
      ai_network_credits: number;
      ai_self_tokens: number;
      ai_network_tokens: number;
    }>();
    for (const partnerId of partnerIds) {
      usagePartnerMap.set(partnerId, {
        ai_self_eur: 0,
        ai_network_eur: 0,
        ai_self_credits: 0,
        ai_network_credits: 0,
        ai_self_tokens: 0,
        ai_network_tokens: 0,
      });
    }

    for (const row of ((usageRows ?? []) as Array<Record<string, unknown>>)) {
      const partnerId = asText(row.partner_id);
      if (!partnerId || !usagePartnerMap.has(partnerId)) continue;
      const usage = usagePartnerMap.get(partnerId);
      if (!usage) continue;
      const cost = asFiniteNumber(row.estimated_cost_eur);
      const credits = asFiniteNumber(row.estimated_credit_delta);
      const tokens = asFiniteNumber(row.total_tokens);
      if (asText(row.network_partner_id)) {
        usage.ai_network_eur += cost;
        usage.ai_network_credits += credits;
        usage.ai_network_tokens += tokens;
      } else {
        usage.ai_self_eur += cost;
        usage.ai_self_credits += credits;
        usage.ai_self_tokens += tokens;
      }
    }

    const byPartner = partnerSummaries.map((row) => {
      const usage = usagePartnerMap.get(row.partner_id) ?? {
        ai_self_eur: 0,
        ai_network_eur: 0,
        ai_self_credits: 0,
        ai_network_credits: 0,
        ai_self_tokens: 0,
        ai_network_tokens: 0,
      };
      const aiTotalEur = usage.ai_self_eur + usage.ai_network_eur;
      return {
        ...row,
        ai_self_eur: Number(usage.ai_self_eur.toFixed(6)),
        ai_network_eur: Number(usage.ai_network_eur.toFixed(6)),
        ai_total_eur: Number(aiTotalEur.toFixed(6)),
        ai_self_credits: Number(usage.ai_self_credits.toFixed(4)),
        ai_network_credits: Number(usage.ai_network_credits.toFixed(4)),
        ai_total_credits: Number((usage.ai_self_credits + usage.ai_network_credits).toFixed(4)),
        ai_self_tokens: usage.ai_self_tokens,
        ai_network_tokens: usage.ai_network_tokens,
        ai_total_tokens: usage.ai_self_tokens + usage.ai_network_tokens,
        grand_total_eur: Number((row.recurring_total_eur + aiTotalEur).toFixed(6)),
      };
    });

    const aiTotals = byPartner.reduce((acc, row) => {
      acc.portal_partner_eur += row.ai_self_eur;
      acc.network_partner_eur += row.ai_network_eur;
      acc.portal_partner_credits += row.ai_self_credits;
      acc.network_partner_credits += row.ai_network_credits;
      acc.portal_partner_tokens += row.ai_self_tokens;
      acc.network_partner_tokens += row.ai_network_tokens;
      return acc;
    }, {
      portal_partner_eur: 0,
      network_partner_eur: 0,
      portal_partner_credits: 0,
      network_partner_credits: 0,
      portal_partner_tokens: 0,
      network_partner_tokens: 0,
    });

    return NextResponse.json({
      ok: true,
      month_start: range.start,
      month_end: range.end,
      totals: {
        portal_abo_eur: Number(recurringTotals.portal_abo_eur.toFixed(2)),
        locales_eur: Number(recurringTotals.locales_eur.toFixed(2)),
        features_eur: Number(recurringTotals.features_eur.toFixed(2)),
        recurring_total_eur: Number(recurringTotals.recurring_total_eur.toFixed(2)),
        ai_portal_partner_eur: Number(aiTotals.portal_partner_eur.toFixed(6)),
        ai_network_partner_eur: Number(aiTotals.network_partner_eur.toFixed(6)),
        ai_total_eur: Number((aiTotals.portal_partner_eur + aiTotals.network_partner_eur).toFixed(6)),
        ai_portal_partner_credits: Number(aiTotals.portal_partner_credits.toFixed(4)),
        ai_network_partner_credits: Number(aiTotals.network_partner_credits.toFixed(4)),
        ai_total_credits: Number((aiTotals.portal_partner_credits + aiTotals.network_partner_credits).toFixed(4)),
        ai_portal_partner_tokens: aiTotals.portal_partner_tokens,
        ai_network_partner_tokens: aiTotals.network_partner_tokens,
        ai_total_tokens: aiTotals.portal_partner_tokens + aiTotals.network_partner_tokens,
        grand_total_eur: Number((recurringTotals.recurring_total_eur + aiTotals.portal_partner_eur + aiTotals.network_partner_eur).toFixed(6)),
      },
      by_partner: byPartner.sort((a, b) => b.grand_total_eur - a.grand_total_eur),
    });
  } catch (error) {
    if (
      isMissingTable(error, "billing_global_defaults")
      || isMissingTable(error, "partner_billing_settings")
      || isMissingTable(error, "billing_feature_catalog")
      || isMissingTable(error, "partner_feature_overrides")
    ) {
      return NextResponse.json({ error: "Billing-Tabellen fehlen. Bitte `docs/sql/partner_billing_management.sql` ausführen." }, { status: 409 });
    }
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
