import {
  PORTAL_DEFAULT_LOCALE,
  buildPortalLocaleBillingFeatureCode,
  normalizePortalLocaleCode,
  type PortalLocaleConfigRecord,
} from "@/lib/portal-locale-registry";

export type BillingCatalogFeatureLike = {
  code?: string | null;
  label?: string | null;
  note?: string | null;
  billing_unit?: string | null;
  default_enabled?: boolean | null;
  default_monthly_price_eur?: number | null;
  sort_order?: number | null;
  is_active?: boolean | null;
};

export type PartnerFeatureOverrideLike = {
  feature_code?: string | null;
  is_enabled?: boolean | null;
  monthly_price_eur?: number | null;
  updated_at?: string | null;
};

export type LocaleBillingFeatureRow = {
  locale: string;
  label_native: string | null;
  label_de: string | null;
  bcp47_tag: string | null;
  feature_code: string;
  matched_feature_code: string | null;
  partner_bookable: boolean;
  is_active: boolean;
  status: string;
  feature_exists: boolean;
  feature_is_active: boolean;
  default_enabled: boolean;
  default_monthly_price_eur: number;
  billing_unit: string;
  note: string | null;
  sort_order: number;
};

export type PartnerLocaleBillingFeatureRow = LocaleBillingFeatureRow & {
  enabled: boolean;
  monthly_price_eur: number;
  override_enabled: boolean | null;
  override_monthly_price_eur: number | null;
};

function normalizeFeatureCode(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export function resolveLocaleFeatureCodeCandidates(localeConfig: PortalLocaleConfigRecord): string[] {
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

export function isLocaleFeatureCode(
  code: string,
  locales: PortalLocaleConfigRecord[],
): boolean {
  const normalized = normalizeFeatureCode(code);
  if (!normalized) return false;
  return locales.some((locale) => resolveLocaleFeatureCodeCandidates(locale).includes(normalized));
}

function resolveDisplayLabel(localeConfig: PortalLocaleConfigRecord): string {
  const label = String(localeConfig.label_de ?? localeConfig.label_native ?? localeConfig.locale ?? "").trim();
  return label || normalizePortalLocaleCode(localeConfig.locale);
}

function resolvePreferredFeatureCode(localeConfig: PortalLocaleConfigRecord): string {
  const locale = normalizePortalLocaleCode(localeConfig.locale);
  return normalizeFeatureCode(
    localeConfig.billing_feature_code
    ?? buildPortalLocaleBillingFeatureCode(locale),
  );
}

function resolveMatchedCatalogFeature(
  localeConfig: PortalLocaleConfigRecord,
  catalogByCode: Map<string, BillingCatalogFeatureLike>,
): { code: string; feature: BillingCatalogFeatureLike } | null {
  for (const code of resolveLocaleFeatureCodeCandidates(localeConfig)) {
    const feature = catalogByCode.get(code);
    if (feature) return { code, feature };
  }
  return null;
}

export function buildLocaleBillingFeatureRows(args: {
  locales: PortalLocaleConfigRecord[];
  catalogFeatures: BillingCatalogFeatureLike[];
}): LocaleBillingFeatureRow[] {
  const catalogByCode = new Map(
    args.catalogFeatures
      .map((row) => [normalizeFeatureCode(row.code), row] as const)
      .filter(([code]) => code.length > 0),
  );

  return args.locales
    .filter((locale) => normalizePortalLocaleCode(locale.locale) !== PORTAL_DEFAULT_LOCALE)
    .map<LocaleBillingFeatureRow>((localeConfig, index) => {
      const preferredCode = resolvePreferredFeatureCode(localeConfig);
      const matched = resolveMatchedCatalogFeature(localeConfig, catalogByCode);
      const feature = matched?.feature ?? null;
      return {
        locale: normalizePortalLocaleCode(localeConfig.locale),
        label_native: localeConfig.label_native ? String(localeConfig.label_native) : null,
        label_de: localeConfig.label_de ? String(localeConfig.label_de) : null,
        bcp47_tag: localeConfig.bcp47_tag ? String(localeConfig.bcp47_tag) : null,
        feature_code: preferredCode,
        matched_feature_code: matched?.code ?? null,
        partner_bookable: localeConfig.partner_bookable === true,
        is_active: localeConfig.is_active === true,
        status: String(localeConfig.status ?? "planned"),
        feature_exists: Boolean(feature),
        feature_is_active: feature?.is_active !== false && Boolean(feature),
        default_enabled: feature?.default_enabled === true,
        default_monthly_price_eur: Number(feature?.default_monthly_price_eur ?? 0),
        billing_unit: String(feature?.billing_unit ?? "pro Monat").trim() || "pro Monat",
        note: feature?.note ? String(feature.note) : null,
        sort_order: Math.max(1, Math.floor(Number(feature?.sort_order ?? 100 + index))),
      };
    })
    .sort((a, b) => {
      const left = String(a.label_de ?? a.label_native ?? a.locale).trim();
      const right = String(b.label_de ?? b.label_native ?? b.locale).trim();
      return left.localeCompare(right, "de");
    });
}

export function buildPartnerLocaleBillingFeatureRows(args: {
  locales: PortalLocaleConfigRecord[];
  catalogFeatures: BillingCatalogFeatureLike[];
  partnerOverrides: PartnerFeatureOverrideLike[];
}): PartnerLocaleBillingFeatureRow[] {
  const baseRows = buildLocaleBillingFeatureRows({
    locales: args.locales,
    catalogFeatures: args.catalogFeatures,
  });
  const overrideByCode = new Map(
    args.partnerOverrides
      .map((row) => [normalizeFeatureCode(row.feature_code), row] as const)
      .filter(([code]) => code.length > 0),
  );

  return baseRows.map((row) => {
    const override = overrideByCode.get(normalizeFeatureCode(row.feature_code))
      ?? (row.matched_feature_code ? overrideByCode.get(normalizeFeatureCode(row.matched_feature_code)) : undefined);
    const enabled = override?.is_enabled ?? row.default_enabled;
    const monthlyPrice = override?.monthly_price_eur ?? row.default_monthly_price_eur;
    return {
      ...row,
      enabled: Boolean(enabled),
      monthly_price_eur: Number(monthlyPrice ?? 0),
      override_enabled: typeof override?.is_enabled === "boolean" ? override.is_enabled : null,
      override_monthly_price_eur: override?.monthly_price_eur ?? null,
    };
  });
}

export function buildLocaleFeatureCatalogPatch(args: {
  locales: PortalLocaleConfigRecord[];
  rows: Array<{
    locale?: unknown;
    feature_is_active?: unknown;
    default_enabled?: unknown;
    default_monthly_price_eur?: unknown;
    billing_unit?: unknown;
    note?: unknown;
  }>;
}): Array<Record<string, unknown>> {
  const localeMap = new Map(
    args.locales.map((locale) => [normalizePortalLocaleCode(locale.locale), locale] as const),
  );

  return args.rows.flatMap((row, index) => {
    const locale = normalizePortalLocaleCode(row.locale);
    const localeConfig = localeMap.get(locale);
    if (!localeConfig || locale === PORTAL_DEFAULT_LOCALE) return [];
    const labelBase = resolveDisplayLabel(localeConfig);
    const defaultPrice = Number(row.default_monthly_price_eur ?? 0);
    return [{
      code: resolvePreferredFeatureCode(localeConfig),
      label: `Internationalisierung: ${labelBase}`,
      note: row.note ? String(row.note).trim() : `Freischaltung fuer ${labelBase}`,
      billing_unit: String(row.billing_unit ?? "pro Monat").trim() || "pro Monat",
      default_enabled: row.default_enabled === true,
      default_monthly_price_eur: Number.isFinite(defaultPrice) ? Number(defaultPrice.toFixed(2)) : 0,
      sort_order: 300 + index,
      is_active: row.feature_is_active !== false,
      updated_at: new Date().toISOString(),
    }];
  });
}

