import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/security/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";
import { checkAdminApiRateLimit } from "@/lib/security/rate-limit";

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

async function loadPartnerBilling(admin: ReturnType<typeof createAdminClient>, partnerId: string) {
  const [globalRes, portalRes, catalogRes, overridesRes] = await Promise.all([
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
  ]);

  if (globalRes.error) throw globalRes.error;
  if (portalRes.error) throw portalRes.error;
  if (catalogRes.error) throw catalogRes.error;
  if (overridesRes.error) throw overridesRes.error;

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

  const features = (catalogRes.data ?? []).map((feature) => {
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

  return {
    portal: {
      defaults,
      overrides: portalOverrides,
      effective: {
        portal_base_price_eur: Number((portalOverrides.portal_base_price_eur ?? defaults.portal_base_price_eur ?? 50)),
        portal_ortslage_price_eur: Number((portalOverrides.portal_ortslage_price_eur ?? defaults.portal_ortslage_price_eur ?? 1)),
        portal_export_ortslage_price_eur: Number((portalOverrides.portal_export_ortslage_price_eur ?? defaults.portal_export_ortslage_price_eur ?? 1)),
      },
    },
    features,
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
