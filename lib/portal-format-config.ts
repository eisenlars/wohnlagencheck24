import {
  PORTAL_DEFAULT_LOCALE,
  loadPortalLocaleRegistry,
  normalizePortalCurrencyCode,
  normalizePortalIntlLocale,
  normalizePortalLocaleCode,
} from "@/lib/portal-locale-registry";

export type PortalFormatProfile = {
  locale: string;
  intlLocale: string;
  dateLocale: string;
  currencyCode: string;
};

export async function loadPortalFormatProfile(locale: string): Promise<PortalFormatProfile> {
  const normalizedLocale = normalizePortalLocaleCode(locale) || PORTAL_DEFAULT_LOCALE;
  const registry = await loadPortalLocaleRegistry();
  const match = registry.find((item) => normalizePortalLocaleCode(item.locale) === normalizedLocale)
    ?? registry.find((item) => normalizePortalLocaleCode(item.locale) === PORTAL_DEFAULT_LOCALE)
    ?? null;

  const intlLocale = normalizePortalIntlLocale(
    match?.number_locale ?? match?.bcp47_tag,
    normalizedLocale,
  );
  const dateLocale = normalizePortalIntlLocale(
    match?.date_locale ?? match?.bcp47_tag,
    intlLocale,
  );

  return {
    locale: normalizedLocale,
    intlLocale,
    dateLocale,
    currencyCode: normalizePortalCurrencyCode(match?.currency_code),
  };
}
