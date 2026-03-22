import {
  PORTAL_DEFAULT_LOCALE,
  buildPortalLocaleBillingFeatureCode,
  getPartnerBookablePortalLocaleConfigs,
  getPublicLivePortalLocaleCodes,
  loadPortalLocaleRegistry,
  normalizePortalLocaleCode,
  type PortalLocaleConfigRecord,
} from "@/lib/portal-locale-registry";
import { createAdminClient } from "@/utils/supabase/admin";

type BillingFeatureCatalogRow = {
  code?: string | null;
  default_enabled?: boolean | null;
};

type PartnerFeatureOverrideRow = {
  feature_code?: string | null;
  is_enabled?: boolean | null;
};

export type PartnerLocaleAvailabilityItem = {
  locale: string;
  label_native: string | null;
  label_de: string | null;
  bcp47_tag: string | null;
  billing_feature_code: string | null;
  partner_bookable: boolean;
  is_active: boolean;
  status: string;
  public_live: boolean;
  partner_enabled: boolean;
  available: boolean;
};

export type PartnerLocaleAvailabilitySnapshot = {
  locales: PartnerLocaleAvailabilityItem[];
  available_locales: string[];
  partner_enabled_locales: string[];
  global_partner_locales: string[];
  global_public_locales: string[];
};

function isMissingBillingTable(error: unknown, table: string): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return msg.includes(`public.${table}`) && msg.includes("does not exist");
}

function normalizeFeatureCode(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function resolveFeatureCodeCandidates(localeConfig: PortalLocaleConfigRecord): string[] {
  const locale = normalizePortalLocaleCode(localeConfig.locale);
  const baseCode = normalizeFeatureCode(
    localeConfig.billing_feature_code
    ?? buildPortalLocaleBillingFeatureCode(locale),
  );
  const codes = new Set<string>();
  if (baseCode) {
    codes.add(baseCode);
    if (baseCode.includes("_")) codes.add(baseCode.replace(/_/g, "-"));
    if (baseCode.includes("-")) codes.add(baseCode.replace(/-/g, "_"));
  }
  if (locale === "en") {
    codes.add("international");
  }
  return Array.from(codes);
}

async function loadFeatureEnablementMaps(partnerId: string) {
  const admin = createAdminClient();
  const [catalogRes, overridesRes] = await Promise.all([
    admin
      .from("billing_feature_catalog")
      .select("code, default_enabled")
      .eq("is_active", true),
    admin
      .from("partner_feature_overrides")
      .select("feature_code, is_enabled")
      .eq("partner_id", partnerId),
  ]);

  const error = catalogRes.error ?? overridesRes.error;
  if (error) {
    if (
      isMissingBillingTable(error, "billing_feature_catalog")
      || isMissingBillingTable(error, "partner_feature_overrides")
    ) {
      return {
        catalogByCode: new Map<string, BillingFeatureCatalogRow>(),
        overrideByCode: new Map<string, PartnerFeatureOverrideRow>(),
      };
    }
    throw new Error(String(error.message ?? "partner locale feature lookup failed"));
  }

  return {
    catalogByCode: new Map(
      ((catalogRes.data ?? []) as BillingFeatureCatalogRow[])
        .map((row) => [normalizeFeatureCode(row.code), row] as const)
        .filter(([code]) => code.length > 0),
    ),
    overrideByCode: new Map(
      ((overridesRes.data ?? []) as PartnerFeatureOverrideRow[])
        .map((row) => [normalizeFeatureCode(row.feature_code), row] as const)
        .filter(([code]) => code.length > 0),
    ),
  };
}

export async function loadPartnerLocaleAvailabilitySnapshot(
  partnerId: string,
): Promise<PartnerLocaleAvailabilitySnapshot> {
  const localeRegistry = await loadPortalLocaleRegistry();
  const partnerBookableLocales = getPartnerBookablePortalLocaleConfigs(localeRegistry);
  const publicLiveLocaleSet = new Set(getPublicLivePortalLocaleCodes(localeRegistry));
  const { catalogByCode, overrideByCode } = await loadFeatureEnablementMaps(partnerId);

  const locales = partnerBookableLocales.map<PartnerLocaleAvailabilityItem>((localeConfig) => {
    const locale = normalizePortalLocaleCode(localeConfig.locale);
    const partnerEnabled = resolveFeatureCodeCandidates(localeConfig).some((code) => {
      const catalog = catalogByCode.get(code);
      if (!catalog) return false;
      const override = overrideByCode.get(code);
      return override?.is_enabled ?? catalog.default_enabled ?? false;
    });

    return {
      locale,
      label_native: localeConfig.label_native ? String(localeConfig.label_native) : null,
      label_de: localeConfig.label_de ? String(localeConfig.label_de) : null,
      bcp47_tag: localeConfig.bcp47_tag ? String(localeConfig.bcp47_tag) : null,
      billing_feature_code: localeConfig.billing_feature_code ? String(localeConfig.billing_feature_code) : null,
      partner_bookable: localeConfig.partner_bookable === true,
      is_active: localeConfig.is_active === true,
      status: String(localeConfig.status ?? "planned"),
      public_live: publicLiveLocaleSet.has(locale),
      partner_enabled: partnerEnabled,
      available: partnerEnabled,
    };
  });

  return {
    locales,
    available_locales: locales.filter((row) => row.available).map((row) => row.locale),
    partner_enabled_locales: locales.filter((row) => row.partner_enabled).map((row) => row.locale),
    global_partner_locales: locales.map((row) => row.locale),
    global_public_locales: locales.filter((row) => row.public_live).map((row) => row.locale),
  };
}

export async function isPartnerLocaleAvailable(partnerId: string, locale: string): Promise<boolean> {
  const normalizedLocale = normalizePortalLocaleCode(locale);
  if (!normalizedLocale || normalizedLocale === PORTAL_DEFAULT_LOCALE) return true;
  const snapshot = await loadPartnerLocaleAvailabilitySnapshot(partnerId);
  return snapshot.available_locales.includes(normalizedLocale);
}
