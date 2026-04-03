import { NextResponse } from "next/server";

import {
  DEFAULT_PORTAL_LOCALES,
  type PortalLocaleConfigRecord,
} from "@/lib/portal-cms";
import {
  normalizePortalCurrencyCode,
  normalizePortalFallbackLocale,
  normalizePortalIntlLocale,
  normalizePortalLocaleCode,
  normalizePortalTextDirection,
} from "@/lib/portal-locale-registry";
import { requireAdmin } from "@/lib/security/admin-auth";
import { checkAdminApiRateLimit } from "@/lib/security/rate-limit";
import { createAdminClient } from "@/utils/supabase/admin";

function isMissingTable(error: unknown, table: string): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return (
    (msg.includes(`public.${table}`) && msg.includes("does not exist"))
    || (msg.includes(table) && msg.includes("column") && msg.includes("does not exist"))
  );
}

async function loadPortalLocales(admin: ReturnType<typeof createAdminClient>) {
  const { data, error } = await admin
    .from("portal_locale_config")
    .select("locale, status, partner_bookable, is_active, label_native, label_de, bcp47_tag, fallback_locale, text_direction, number_locale, date_locale, currency_code, billing_feature_code, updated_at")
    .order("locale", { ascending: true });

  if (error) throw error;

  const locales = Array.isArray(data) && data.length > 0
    ? (data as PortalLocaleConfigRecord[]).map((row) => ({
        ...row,
        locale: normalizePortalLocaleCode(row.locale),
        label_native: row.label_native ? String(row.label_native) : null,
        label_de: row.label_de ? String(row.label_de) : null,
        bcp47_tag: normalizePortalIntlLocale(row.bcp47_tag, row.locale),
        fallback_locale: normalizePortalFallbackLocale(row.fallback_locale),
        text_direction: normalizePortalTextDirection(row.text_direction),
        number_locale: row.number_locale ? String(row.number_locale) : null,
        date_locale: row.date_locale ? String(row.date_locale) : null,
        currency_code: normalizePortalCurrencyCode(row.currency_code),
        billing_feature_code: row.billing_feature_code ? String(row.billing_feature_code) : null,
      }))
    : DEFAULT_PORTAL_LOCALES;

  return { locales };
}

export async function GET(req: Request) {
  try {
    const adminUser = await requireAdmin(["admin_super", "admin_ops"]);
    const limit = await checkAdminApiRateLimit(req, adminUser.userId);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
      );
    }

    const admin = createAdminClient();
    const payload = await loadPortalLocales(admin);
    return NextResponse.json({ ok: true, ...payload });
  } catch (error) {
    if (isMissingTable(error, "portal_locale_config")) {
      return NextResponse.json({ error: "Locale-Tabelle fehlt. Bitte `docs/sql/portal_cms.sql` ausführen." }, { status: 409 });
    }
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
