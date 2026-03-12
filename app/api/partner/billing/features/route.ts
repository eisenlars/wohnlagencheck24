import { NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { checkRateLimitPersistent, extractClientIpFromHeaders } from "@/lib/security/rate-limit";

function isMissingTable(error: unknown, table: string): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return msg.includes(`public.${table}`) && msg.includes("does not exist");
}

function asText(value: unknown): string | null {
  const v = String(value ?? "").trim();
  return v.length > 0 ? v : null;
}

function asFiniteNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

async function requirePartnerUser(req: Request): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) throw new Error("UNAUTHORIZED");

  const ip = extractClientIpFromHeaders(req.headers);
  const limit = await checkRateLimitPersistent(
    `partner_billing_features:${user.id}:${ip}`,
    { windowMs: 60 * 1000, max: 60 },
  );
  if (!limit.allowed) throw new Error(`RATE_LIMIT:${limit.retryAfterSec}`);
  return user.id;
}

export async function GET(req: Request) {
  try {
    const userId = await requirePartnerUser(req);
    const admin = createAdminClient();

    const [catalogRes, overridesRes] = await Promise.all([
      admin
        .from("billing_feature_catalog")
        .select("code, label, note, billing_unit, default_enabled, default_monthly_price_eur, sort_order, is_active")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("code", { ascending: true }),
      admin
        .from("partner_feature_overrides")
        .select("feature_code, is_enabled, monthly_price_eur")
        .eq("partner_id", userId),
    ]);

    if (catalogRes.error) throw catalogRes.error;
    if (overridesRes.error) throw overridesRes.error;

    const overridesByCode = new Map(
      (overridesRes.data ?? []).map((row) => [String(row.feature_code ?? ""), row] as const),
    );

    const rows = (catalogRes.data ?? []).map((feature) => {
      const code = String(feature.code ?? "");
      const override = overridesByCode.get(code);
      const enabled = override?.is_enabled ?? feature.default_enabled ?? false;
      const monthlyPrice = override?.monthly_price_eur ?? feature.default_monthly_price_eur ?? 0;
      return {
        key: code,
        label: String(feature.label ?? code),
        enabled: Boolean(enabled),
        monthly_price_eur: Number(asFiniteNumber(monthlyPrice).toFixed(2)),
        billing_unit: asText(feature.billing_unit) ?? "pro Monat",
        note: asText(feature.note) ?? "",
      };
    });

    return NextResponse.json({ ok: true, rows });
  } catch (error) {
    if (isMissingTable(error, "billing_feature_catalog") || isMissingTable(error, "partner_feature_overrides")) {
      return NextResponse.json({
        ok: true,
        rows: [],
        warning: "Billing-Feature-Tabellen fehlen. Bitte `docs/sql/partner_billing_management.sql` ausführen.",
      });
    }
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message.startsWith("RATE_LIMIT:")) {
        const sec = Number(error.message.split(":")[1] ?? "60");
        return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(sec) } });
      }
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
