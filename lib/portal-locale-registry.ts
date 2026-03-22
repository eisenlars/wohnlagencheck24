export const PORTAL_DEFAULT_LOCALE = "de";

export type PortalTextDirection = "ltr" | "rtl";

import { DEFAULT_PORTAL_LOCALES, type PortalLocaleConfigRecord } from "@/lib/portal-cms";
import { createAdminClient } from "@/utils/supabase/admin";

export type { PortalLocaleConfigRecord } from "@/lib/portal-cms";

export function normalizePortalLocaleCode(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export function isValidPortalLocaleCode(value: unknown): boolean {
  const normalized = normalizePortalLocaleCode(value);
  return /^[a-z]{2,3}(?:-[a-z0-9]{2,8}){0,2}$/.test(normalized);
}

export function buildPortalLocaleBillingFeatureCode(locale: string): string {
  const normalized = normalizePortalLocaleCode(locale);
  if (!normalized || normalized === PORTAL_DEFAULT_LOCALE) return "international";
  return `international_${normalized}`;
}

export function normalizePortalTextDirection(value: unknown): PortalTextDirection {
  return String(value ?? "").trim().toLowerCase() === "rtl" ? "rtl" : "ltr";
}

export function normalizePortalFallbackLocale(value: unknown): string {
  const normalized = normalizePortalLocaleCode(value);
  return normalized || PORTAL_DEFAULT_LOCALE;
}

export function normalizePortalIntlLocale(value: unknown, fallback: string): string {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

export function normalizePortalCurrencyCode(value: unknown): string {
  const normalized = String(value ?? "").trim().toUpperCase();
  return normalized || "EUR";
}

function isMissingPortalLocaleConfigTable(error: unknown): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return msg.includes("public.portal_locale_config") && msg.includes("does not exist");
}

function normalizePortalLocaleRecord(row: PortalLocaleConfigRecord): PortalLocaleConfigRecord {
  const locale = normalizePortalLocaleCode(row.locale);
  const bcp47Tag = normalizePortalIntlLocale(row.bcp47_tag, locale);
  return {
    ...row,
    locale,
    status: row.status === "internal" || row.status === "live" ? row.status : "planned",
    partner_bookable: row.partner_bookable === true,
    is_active: row.is_active === true,
    label_native: row.label_native ? String(row.label_native) : locale,
    label_de: row.label_de ? String(row.label_de) : locale,
    bcp47_tag: bcp47Tag,
    fallback_locale: normalizePortalFallbackLocale(row.fallback_locale),
    text_direction: normalizePortalTextDirection(row.text_direction),
    number_locale: normalizePortalIntlLocale(row.number_locale, bcp47Tag),
    date_locale: normalizePortalIntlLocale(row.date_locale, bcp47Tag),
    currency_code: normalizePortalCurrencyCode(row.currency_code),
    billing_feature_code: String(
      row.billing_feature_code
      ?? buildPortalLocaleBillingFeatureCode(locale),
    ).trim() || buildPortalLocaleBillingFeatureCode(locale),
  };
}

export async function loadPortalLocaleRegistry(): Promise<PortalLocaleConfigRecord[]> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("portal_locale_config")
      .select("locale, status, partner_bookable, is_active, label_native, label_de, bcp47_tag, fallback_locale, text_direction, number_locale, date_locale, currency_code, billing_feature_code, updated_at")
      .order("locale", { ascending: true });

    if (error) throw error;

    const rows = Array.isArray(data) && data.length > 0
      ? (data as PortalLocaleConfigRecord[])
      : DEFAULT_PORTAL_LOCALES;

    return rows.map(normalizePortalLocaleRecord);
  } catch (error) {
    if (isMissingPortalLocaleConfigTable(error)) {
      return DEFAULT_PORTAL_LOCALES.map(normalizePortalLocaleRecord);
    }
    throw error;
  }
}

export function getPublicLivePortalLocaleCodes(locales: PortalLocaleConfigRecord[]): string[] {
  const normalized = locales
    .filter((row) => row.is_active === true && row.status === "live")
    .map((row) => normalizePortalLocaleCode(row.locale))
    .filter(Boolean);
  return Array.from(new Set(normalized));
}

export function getPartnerBookablePortalLocaleConfigs(locales: PortalLocaleConfigRecord[]): PortalLocaleConfigRecord[] {
  return locales.filter((row) => (
    normalizePortalLocaleCode(row.locale) !== PORTAL_DEFAULT_LOCALE
    && row.is_active === true
    && row.partner_bookable === true
  ));
}
