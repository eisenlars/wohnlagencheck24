export const PORTAL_DEFAULT_LOCALE = "de";

export type PortalTextDirection = "ltr" | "rtl";

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
