export const DEFAULT_PUBLIC_LOCALE = "de";

const PUBLIC_LOCALE_SEGMENT_PATTERN = /^[a-z]{2,3}(?:-[a-z0-9]{2,8}){0,2}$/i;

export function parsePublicLocale(value: unknown): string | null {
  const locale = String(value ?? "").trim().toLowerCase();
  if (!locale) return null;
  return PUBLIC_LOCALE_SEGMENT_PATTERN.test(locale) ? locale : null;
}

export function normalizePublicLocale(value: unknown): string {
  return parsePublicLocale(value) ?? DEFAULT_PUBLIC_LOCALE;
}

export function stripLeadingLocale(pathname: string): { locale: string | null; pathname: string } {
  const clean = String(pathname ?? "").trim() || "/";
  const segments = clean.split("/").filter(Boolean);
  const locale = parsePublicLocale(segments[0] ?? "");
  if (!locale) {
    return { locale: null, pathname: clean };
  }
  const rest = segments.slice(1);
  return {
    locale,
    pathname: rest.length > 0 ? `/${rest.join("/")}` : "/",
  };
}

export function buildLocalizedHref(locale: string | null | undefined, path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const normalizedLocale = parsePublicLocale(locale);
  if (!normalizedLocale) return cleanPath;
  if (cleanPath === "/") return `/${normalizedLocale}`;
  return `/${normalizedLocale}${cleanPath}`;
}
