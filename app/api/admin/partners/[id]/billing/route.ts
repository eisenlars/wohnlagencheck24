import { NextResponse } from "next/server";

import { buildPartnerLocaleBillingFeatureRows, isLocaleFeatureCode } from "@/lib/locale-billing-features";
import { loadPortalLocaleRegistry, normalizePortalLocaleCode } from "@/lib/portal-locale-registry";
import { requireAdmin } from "@/lib/security/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";
import { checkAdminApiRateLimit } from "@/lib/security/rate-limit";

type AreaRow = {
  id?: string | null;
  name?: string | null;
  slug?: string | null;
  parent_slug?: string | null;
  bundesland_slug?: string | null;
};

type PartnerAreaMapRow = {
  area_id?: string | null;
  is_active?: boolean | null;
  areas?: AreaRow[] | AreaRow | null;
};

type PortalAboRow = {
  key: string;
  kreis_name: string;
  kreis_id: string;
  base_price_eur: number;
  ortslage_price_eur: number;
  ortslagen_count: number;
  ortslagen_total_price_eur: number;
  export_ortslagen_count: number;
  export_ortslagen_total_price_eur: number;
  total_price_eur: number;
};

type FeatureOverrideInput = {
  code?: string;
  is_enabled?: boolean | null;
  monthly_price_eur?: number | null;
};

type Body = {
  portal_overrides?: {
    portal_base_price_eur?: number | null;
    portal_ortslage_price_eur?: number | null;
    portal_export_ortslage_price_eur?: number | null;
  };
  feature_overrides?: FeatureOverrideInput[];
  locale_feature_overrides?: Array<{
    locale?: unknown;
    is_enabled?: boolean | null;
    monthly_price_eur?: number | null;
  }>;
};

function isMissingTable(error: unknown, table: string): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return msg.includes(`public.${table}`) && msg.includes("does not exist");
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asText(value: unknown): string | null {
  const v = String(value ?? "").trim();
  return v.length > 0 ? v : null;
}

function isDistrictArea(areaId: string): boolean {
  return areaId.split("-").length <= 3;
}

function normalizeAreaRelation(
  value: unknown,
): AreaRow | null {
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

async function loadPartnerBilling(admin: ReturnType<typeof createAdminClient>, partnerId: string) {
  const [globalRes, portalRes, catalogRes, overridesRes, locales, partnerAreaMapRes] = await Promise.all([
    admin
      .from("billing_global_defaults")
      .select("id, portal_base_price_eur, portal_ortslage_price_eur, portal_export_ortslage_price_eur, updated_at")
      .eq("id", 1)
      .maybeSingle(),
    admin
      .from("partner_billing_settings")
      .select("partner_id, portal_base_price_eur, portal_ortslage_price_eur, portal_export_ortslage_price_eur, updated_at")
      .eq("partner_id", partnerId)
      .maybeSingle(),
    admin
      .from("billing_feature_catalog")
      .select("code, label, note, billing_unit, default_enabled, default_monthly_price_eur, sort_order, is_active")
      .order("sort_order", { ascending: true })
      .order("code", { ascending: true }),
    admin
      .from("partner_feature_overrides")
      .select("partner_id, feature_code, is_enabled, monthly_price_eur, updated_at")
      .eq("partner_id", partnerId),
    loadPortalLocaleRegistry(),
    admin
      .from("partner_area_map")
      .select("area_id, is_active, areas(id, name, slug, parent_slug, bundesland_slug)")
      .eq("auth_user_id", partnerId)
      .eq("is_active", true)
      .order("area_id", { ascending: true }),
  ]);

  if (globalRes.error) throw globalRes.error;
  if (portalRes.error) throw portalRes.error;
  if (catalogRes.error) throw catalogRes.error;
  if (overridesRes.error) throw overridesRes.error;
  if (partnerAreaMapRes.error) throw partnerAreaMapRes.error;

  const defaults = globalRes.data ?? {
    id: 1,
    portal_base_price_eur: 50,
    portal_ortslage_price_eur: 1,
    portal_export_ortslage_price_eur: 1,
    updated_at: null,
  };
  const portalOverrides = portalRes.data ?? {
    partner_id: partnerId,
    portal_base_price_eur: null,
    portal_ortslage_price_eur: null,
    portal_export_ortslage_price_eur: null,
    updated_at: null,
  };

  const overridesByCode = new Map(
    (overridesRes.data ?? []).map((row) => [String(row.feature_code), row] as const),
  );

  const features = (catalogRes.data ?? [])
    .filter((feature) => !isLocaleFeatureCode(String(feature.code ?? ""), locales))
    .map((feature) => {
    const code = String(feature.code ?? "");
    const override = overridesByCode.get(code);
    const enabled = override?.is_enabled ?? feature.default_enabled ?? false;
    const monthlyPrice = override?.monthly_price_eur ?? feature.default_monthly_price_eur ?? 0;
    return {
      code,
      label: String(feature.label ?? code),
      note: asText(feature.note),
      billing_unit: asText(feature.billing_unit) ?? "pro Monat",
      is_active: feature.is_active !== false,
      default_enabled: feature.default_enabled === true,
      default_monthly_price_eur: Number(asFiniteNumber(feature.default_monthly_price_eur) ?? 0),
      override_enabled: override?.is_enabled ?? null,
      override_monthly_price_eur: override?.monthly_price_eur ?? null,
      enabled: Boolean(enabled),
      monthly_price_eur: Number(asFiniteNumber(monthlyPrice) ?? 0),
      sort_order: Math.max(1, Math.floor(asFiniteNumber(feature.sort_order) ?? 100)),
    };
  });

  const effectiveBasePrice = Number((portalOverrides.portal_base_price_eur ?? defaults.portal_base_price_eur ?? 50));
  const effectiveOrtslagePrice = Number((portalOverrides.portal_ortslage_price_eur ?? defaults.portal_ortslage_price_eur ?? 1));
  const effectiveExportPrice = Number((portalOverrides.portal_export_ortslage_price_eur ?? defaults.portal_export_ortslage_price_eur ?? 1));

  const activeMappings = (partnerAreaMapRes.data ?? []) as PartnerAreaMapRow[];
  const districtRows = activeMappings
    .map((entry) => ({
      area_id: String(entry.area_id ?? "").trim(),
      area: normalizeAreaRelation(entry.areas),
    }))
    .filter((entry) => entry.area_id.length > 0 && isDistrictArea(entry.area_id));
  const districtSlugs = districtRows
    .map((entry) => String(entry.area?.slug ?? "").trim())
    .filter((slug) => slug.length > 0);
  const ortslageCountByDistrict = new Map<string, number>();
  if (districtSlugs.length > 0) {
    const { data: childAreas, error: childAreasError } = await admin
      .from("areas")
      .select("id, parent_slug")
      .in("parent_slug", districtSlugs);
    if (childAreasError) throw childAreasError;
    for (const row of (childAreas ?? []) as Array<{ parent_slug?: string | null }>) {
      const parentSlug = String(row.parent_slug ?? "").trim();
      if (!parentSlug) continue;
      ortslageCountByDistrict.set(parentSlug, (ortslageCountByDistrict.get(parentSlug) ?? 0) + 1);
    }
  }

  const portalRows: PortalAboRow[] = districtRows.map((entry) => {
    const districtSlug = String(entry.area?.slug ?? "").trim();
    const districtName = String(entry.area?.name ?? entry.area_id).trim() || entry.area_id;
    const ortslagenCount = ortslageCountByDistrict.get(districtSlug) ?? 0;
    const exportCount = ortslagenCount;
    const ortslagenTotal = Number((ortslagenCount * effectiveOrtslagePrice).toFixed(2));
    const exportTotal = Number((exportCount * effectiveExportPrice).toFixed(2));
    const total = Number((effectiveBasePrice + ortslagenTotal + exportTotal).toFixed(2));
    return {
      key: entry.area_id,
      kreis_name: districtName,
      kreis_id: entry.area_id,
      base_price_eur: effectiveBasePrice,
      ortslage_price_eur: effectiveOrtslagePrice,
      ortslagen_count: ortslagenCount,
      ortslagen_total_price_eur: ortslagenTotal,
      export_ortslagen_count: exportCount,
      export_ortslagen_total_price_eur: exportTotal,
      total_price_eur: total,
    };
  }).sort((a, b) => a.kreis_name.localeCompare(b.kreis_name, "de"));

  const portalSummary = {
    kreise_count: portalRows.length,
    base_total_price_eur: Number((portalRows.reduce((sum, row) => sum + row.base_price_eur, 0)).toFixed(2)),
    ortslagen_count: portalRows.reduce((sum, row) => sum + row.ortslagen_count, 0),
    ortslagen_total_price_eur: Number((portalRows.reduce((sum, row) => sum + row.ortslagen_total_price_eur, 0)).toFixed(2)),
    export_ortslagen_count: portalRows.reduce((sum, row) => sum + row.export_ortslagen_count, 0),
    export_ortslagen_total_price_eur: Number((portalRows.reduce((sum, row) => sum + row.export_ortslagen_total_price_eur, 0)).toFixed(2)),
    total_price_eur: Number((portalRows.reduce((sum, row) => sum + row.total_price_eur, 0)).toFixed(2)),
  };

  const localeFeatures = buildPartnerLocaleBillingFeatureRows({
    locales,
    catalogFeatures: catalogRes.data ?? [],
    partnerOverrides: overridesRes.data ?? [],
  });
  const enabledLocaleRows = localeFeatures.filter((row) => row.enabled);
  const localeSummary = {
    booked_count: enabledLocaleRows.length,
    total_price_eur: Number((enabledLocaleRows.reduce((sum, row) => sum + Number(row.monthly_price_eur ?? 0), 0)).toFixed(2)),
    booked_locales: enabledLocaleRows.map((row) => ({
      locale: row.locale,
      label: row.label_de || row.label_native || row.locale,
      monthly_price_eur: Number(Number(row.monthly_price_eur ?? 0).toFixed(2)),
    })),
  };
  const enabledFeatureRows = features.filter((row) => row.enabled);
  const featureSummary = {
    booked_count: enabledFeatureRows.length,
    total_price_eur: Number((enabledFeatureRows.reduce((sum, row) => sum + Number(row.monthly_price_eur ?? 0), 0)).toFixed(2)),
    booked_features: enabledFeatureRows.map((row) => ({
      code: row.code,
      label: row.label,
      monthly_price_eur: Number(Number(row.monthly_price_eur ?? 0).toFixed(2)),
    })),
  };

  return {
    portal: {
      defaults,
      overrides: portalOverrides,
      effective: {
        portal_base_price_eur: Number((portalOverrides.portal_base_price_eur ?? defaults.portal_base_price_eur ?? 50)),
        portal_ortslage_price_eur: Number((portalOverrides.portal_ortslage_price_eur ?? defaults.portal_ortslage_price_eur ?? 1)),
        portal_export_ortslage_price_eur: Number((portalOverrides.portal_export_ortslage_price_eur ?? defaults.portal_export_ortslage_price_eur ?? 1)),
      },
      rows: portalRows,
      summary: portalSummary,
    },
    features,
    feature_summary: featureSummary,
    locale_features: localeFeatures,
    locale_summary: localeSummary,
  };
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const adminUser = await requireAdmin(["admin_super", "admin_ops"]);
    const limit = await checkAdminApiRateLimit(req, adminUser.userId);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } });
    }

    const params = await ctx.params;
    const partnerId = String(params.id ?? "").trim();
    if (!partnerId) return NextResponse.json({ error: "Missing partner id" }, { status: 400 });

    const admin = createAdminClient();
    const payload = await loadPartnerBilling(admin, partnerId);
    return NextResponse.json({ ok: true, ...payload });
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

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const adminUser = await requireAdmin(["admin_super", "admin_ops"]);
    const limit = await checkAdminApiRateLimit(req, adminUser.userId);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } });
    }

    const params = await ctx.params;
    const partnerId = String(params.id ?? "").trim();
    if (!partnerId) return NextResponse.json({ error: "Missing partner id" }, { status: 400 });
    const body = (await req.json()) as Body;

    const admin = createAdminClient();

    if (body.portal_overrides) {
      const base = asFiniteNumber(body.portal_overrides.portal_base_price_eur);
      const ort = asFiniteNumber(body.portal_overrides.portal_ortslage_price_eur);
      const exp = asFiniteNumber(body.portal_overrides.portal_export_ortslage_price_eur);
      if (base !== null && base < 0) return NextResponse.json({ error: "portal_base_price_eur muss >= 0 sein." }, { status: 400 });
      if (ort !== null && ort < 0) return NextResponse.json({ error: "portal_ortslage_price_eur muss >= 0 sein." }, { status: 400 });
      if (exp !== null && exp < 0) return NextResponse.json({ error: "portal_export_ortslage_price_eur muss >= 0 sein." }, { status: 400 });

      const { error } = await admin.from("partner_billing_settings").upsert({
        partner_id: partnerId,
        portal_base_price_eur: base === null ? null : Number(base.toFixed(2)),
        portal_ortslage_price_eur: ort === null ? null : Number(ort.toFixed(2)),
        portal_export_ortslage_price_eur: exp === null ? null : Number(exp.toFixed(2)),
        updated_at: new Date().toISOString(),
      }, { onConflict: "partner_id" });
      if (error) throw error;
    }

    if (Array.isArray(body.feature_overrides) && body.feature_overrides.length > 0) {
      const { data: knownFeatures, error: knownFeaturesError } = await admin
        .from("billing_feature_catalog")
        .select("code");
      if (knownFeaturesError) throw knownFeaturesError;
      const known = new Set((knownFeatures ?? []).map((row) => String(row.code ?? "")));

      const rows: Array<Record<string, unknown>> = [];
      for (const raw of body.feature_overrides) {
        const code = asText(raw.code)?.toLowerCase();
        if (!code || !known.has(code)) return NextResponse.json({ error: `Unbekanntes Feature: ${code ?? "leer"}` }, { status: 400 });
        const price = asFiniteNumber(raw.monthly_price_eur);
        if (price !== null && price < 0) return NextResponse.json({ error: `Feature ${code}: Preis muss >= 0 sein.` }, { status: 400 });
        rows.push({
          partner_id: partnerId,
          feature_code: code,
          is_enabled: typeof raw.is_enabled === "boolean" ? raw.is_enabled : null,
          monthly_price_eur: price === null ? null : Number(price.toFixed(2)),
          updated_at: new Date().toISOString(),
        });
      }
      const { error } = await admin.from("partner_feature_overrides").upsert(rows, { onConflict: "partner_id,feature_code" });
      if (error) throw error;
    }

    if (Array.isArray(body.locale_feature_overrides) && body.locale_feature_overrides.length > 0) {
      const locales = await loadPortalLocaleRegistry();
      const localeMap = new Map(
        locales.map((locale) => [normalizePortalLocaleCode(locale.locale), locale] as const),
      );
      const rows: Array<Record<string, unknown>> = [];
      for (const raw of body.locale_feature_overrides) {
        const locale = normalizePortalLocaleCode(raw.locale);
        const localeConfig = localeMap.get(locale);
        if (!localeConfig) {
          return NextResponse.json({ error: `Unbekannte Locale: ${locale || "leer"}` }, { status: 400 });
        }
        const code = String(localeConfig.billing_feature_code ?? "").trim().toLowerCase();
        if (!code) {
          return NextResponse.json({ error: `Locale ${locale} hat keinen Billing-Feature-Code.` }, { status: 400 });
        }
        const price = asFiniteNumber(raw.monthly_price_eur);
        if (price !== null && price < 0) return NextResponse.json({ error: `Locale ${locale}: Preis muss >= 0 sein.` }, { status: 400 });
        rows.push({
          partner_id: partnerId,
          feature_code: code,
          is_enabled: typeof raw.is_enabled === "boolean" ? raw.is_enabled : null,
          monthly_price_eur: price === null ? null : Number(price.toFixed(2)),
          updated_at: new Date().toISOString(),
        });
      }
      const { error } = await admin.from("partner_feature_overrides").upsert(rows, { onConflict: "partner_id,feature_code" });
      if (error) throw error;
    }

    const payload = await loadPartnerBilling(admin, partnerId);
    return NextResponse.json({ ok: true, ...payload });
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
