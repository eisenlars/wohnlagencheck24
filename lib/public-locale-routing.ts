export const DEFAULT_PUBLIC_LOCALE = "de";

export const PUBLIC_SYSTEM_LOCALES = new Set<string>(["de", "en"]);

export function normalizePublicLocale(value: unknown): string {
  const locale = String(value ?? "").trim().toLowerCase();
  return PUBLIC_SYSTEM_LOCALES.has(locale) ? locale : DEFAULT_PUBLIC_LOCALE;
}

export function stripLeadingLocale(pathname: string): { locale: string | null; pathname: string } {
  const clean = String(pathname ?? "").trim() || "/";
  const segments = clean.split("/").filter(Boolean);
  const first = segments[0] ?? "";
  if (!PUBLIC_SYSTEM_LOCALES.has(first)) {
    return { locale: null, pathname: clean };
  }
  const rest = segments.slice(1);
  return {
    locale: first,
    pathname: rest.length > 0 ? `/${rest.join("/")}` : "/",
  };
}

export function buildLocalizedHref(locale: string | null | undefined, path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const normalizedLocale = locale ? normalizePublicLocale(locale) : null;
  if (!normalizedLocale) return cleanPath;
  if (cleanPath === "/") return `/${normalizedLocale}`;
  return `/${normalizedLocale}${cleanPath}`;
}
