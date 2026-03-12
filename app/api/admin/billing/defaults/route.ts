import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/security/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";
import { checkAdminApiRateLimit } from "@/lib/security/rate-limit";

type FeatureInput = {
  code?: string;
  label?: string;
  note?: string | null;
  billing_unit?: string | null;
  default_enabled?: boolean;
  default_monthly_price_eur?: number | null;
  sort_order?: number | null;
  is_active?: boolean;
};

type Body = {
  defaults?: {
    portal_base_price_eur?: number | null;
    portal_ortslage_price_eur?: number | null;
    portal_export_ortslage_price_eur?: number | null;
  };
  features?: FeatureInput[];
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

async function loadDefaultsAndFeatures(admin: ReturnType<typeof createAdminClient>) {
  const [defaultsRes, featuresRes] = await Promise.all([
    admin
      .from("billing_global_defaults")
      .select("id, portal_base_price_eur, portal_ortslage_price_eur, portal_export_ortslage_price_eur, updated_at")
      .eq("id", 1)
      .maybeSingle(),
    admin
      .from("billing_feature_catalog")
      .select("code, label, note, billing_unit, default_enabled, default_monthly_price_eur, sort_order, is_active, updated_at")
      .order("sort_order", { ascending: true })
      .order("code", { ascending: true }),
  ]);

  if (defaultsRes.error) throw defaultsRes.error;
  if (featuresRes.error) throw featuresRes.error;

  return {
    defaults: defaultsRes.data ?? {
      id: 1,
      portal_base_price_eur: 50,
      portal_ortslage_price_eur: 1,
      portal_export_ortslage_price_eur: 1,
      updated_at: null,
    },
    features: featuresRes.data ?? [],
  };
}

export async function GET(req: Request) {
  try {
    const adminUser = await requireAdmin(["admin_super", "admin_ops"]);
    const limit = await checkAdminApiRateLimit(req, adminUser.userId);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } });
    }

    const admin = createAdminClient();
    const payload = await loadDefaultsAndFeatures(admin);
    return NextResponse.json({ ok: true, ...payload });
  } catch (error) {
    if (isMissingTable(error, "billing_global_defaults") || isMissingTable(error, "billing_feature_catalog")) {
      return NextResponse.json({ error: "Billing-Tabellen fehlen. Bitte `docs/sql/partner_billing_management.sql` ausführen." }, { status: 409 });
    }
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const adminUser = await requireAdmin(["admin_super", "admin_ops"]);
    const limit = await checkAdminApiRateLimit(req, adminUser.userId);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } });
    }

    const body = (await req.json()) as Body;
    const admin = createAdminClient();

    if (body.defaults) {
      const base = asFiniteNumber(body.defaults.portal_base_price_eur);
      const ort = asFiniteNumber(body.defaults.portal_ortslage_price_eur);
      const exp = asFiniteNumber(body.defaults.portal_export_ortslage_price_eur);
      if (base !== null && base < 0) return NextResponse.json({ error: "portal_base_price_eur muss >= 0 sein." }, { status: 400 });
      if (ort !== null && ort < 0) return NextResponse.json({ error: "portal_ortslage_price_eur muss >= 0 sein." }, { status: 400 });
      if (exp !== null && exp < 0) return NextResponse.json({ error: "portal_export_ortslage_price_eur muss >= 0 sein." }, { status: 400 });

      const patch: Record<string, unknown> = { id: 1, updated_at: new Date().toISOString() };
      if (base !== null) patch.portal_base_price_eur = Number(base.toFixed(2));
      if (ort !== null) patch.portal_ortslage_price_eur = Number(ort.toFixed(2));
      if (exp !== null) patch.portal_export_ortslage_price_eur = Number(exp.toFixed(2));
      const { error } = await admin.from("billing_global_defaults").upsert(patch, { onConflict: "id" });
      if (error) throw error;
    }

    if (Array.isArray(body.features) && body.features.length > 0) {
      const rows: Array<Record<string, unknown>> = [];
      for (const feature of body.features) {
        const code = asText(feature.code)?.toLowerCase();
        const label = asText(feature.label);
        const price = asFiniteNumber(feature.default_monthly_price_eur);
        if (!code || !label) return NextResponse.json({ error: "Feature benötigt code und label." }, { status: 400 });
        if (price !== null && price < 0) return NextResponse.json({ error: `Feature ${code}: Preis muss >= 0 sein.` }, { status: 400 });
        rows.push({
          code,
          label,
          note: asText(feature.note),
          billing_unit: asText(feature.billing_unit) ?? "pro Monat",
          default_enabled: feature.default_enabled === true,
          default_monthly_price_eur: Number((price ?? 0).toFixed(2)),
          sort_order: Math.max(1, Math.floor(asFiniteNumber(feature.sort_order) ?? 100)),
          is_active: feature.is_active !== false,
          updated_at: new Date().toISOString(),
        });
      }
      const { error } = await admin.from("billing_feature_catalog").upsert(rows, { onConflict: "code" });
      if (error) throw error;
    }

    const payload = await loadDefaultsAndFeatures(admin);
    return NextResponse.json({ ok: true, ...payload });
  } catch (error) {
    if (isMissingTable(error, "billing_global_defaults") || isMissingTable(error, "billing_feature_catalog")) {
      return NextResponse.json({ error: "Billing-Tabellen fehlen. Bitte `docs/sql/partner_billing_management.sql` ausführen." }, { status: 409 });
    }
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
