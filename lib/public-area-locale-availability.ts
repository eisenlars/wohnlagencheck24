import { getReportBySlugs } from "@/lib/data";
import { normalizePublicLocale } from "@/lib/public-locale-routing";
import { loadSinglePublicVisiblePartnerIdForArea } from "@/lib/public-partner-mappings";
import { createAdminClient } from "@/utils/supabase/admin";
import { asArray, asRecord, asString } from "@/utils/records";

type BillingFeatureCatalogRow = {
  code?: string | null;
  default_enabled?: boolean | null;
};

type PartnerFeatureOverrideRow = {
  feature_code?: string | null;
  is_enabled?: boolean | null;
};

export type PublicAreaLocaleAvailabilityReason =
  | "feature_disabled"
  | "missing_translations"
  | "rendering_pending"
  | "no_public_partner";

export type PublicAreaLocaleAvailability = {
  locale: string;
  available: boolean;
  shouldIndex: boolean;
  areaId: string | null;
  areaName: string;
  partnerId: string | null;
  featureEnabled: boolean;
  translatedSectionCount: number;
  reason: PublicAreaLocaleAvailabilityReason;
};

function normalizeFeatureCode(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function resolveFeatureCodesForLocale(locale: string): string[] {
  const normalizedLocale = normalizePublicLocale(locale);
  const codes = [`international_${normalizedLocale}`, `international-${normalizedLocale}`];
  if (normalizedLocale === "en") {
    codes.push("international");
  }
  return Array.from(new Set(codes));
}

async function isLocaleFeatureEnabled(partnerId: string, locale: string): Promise<boolean> {
  const admin = createAdminClient();
  const candidateCodes = resolveFeatureCodesForLocale(locale);

  const [catalogRes, overridesRes] = await Promise.all([
    admin
      .from("billing_feature_catalog")
      .select("code, default_enabled")
      .eq("is_active", true)
      .ilike("code", "international%"),
    admin
      .from("partner_feature_overrides")
      .select("feature_code, is_enabled")
      .eq("partner_id", partnerId)
      .ilike("feature_code", "international%"),
  ]);

  if (catalogRes.error) throw new Error(String(catalogRes.error.message ?? "billing_feature_catalog lookup failed"));
  if (overridesRes.error) throw new Error(String(overridesRes.error.message ?? "partner_feature_overrides lookup failed"));

  const overrideByCode = new Map(
    ((overridesRes.data ?? []) as PartnerFeatureOverrideRow[])
      .map((row) => [normalizeFeatureCode(row.feature_code), row] as const)
      .filter(([code]) => code.length > 0),
  );

  return ((catalogRes.data ?? []) as BillingFeatureCatalogRow[]).some((row) => {
    const code = normalizeFeatureCode(row.code);
    if (!candidateCodes.includes(code)) return false;
    const override = overrideByCode.get(code);
    return override?.is_enabled ?? row.default_enabled ?? false;
  });
}

async function loadTranslatedSectionCount(partnerId: string, areaId: string, locale: string): Promise<number> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("partner_texts_i18n")
    .select("section_key, translated_content, status")
    .eq("partner_id", partnerId)
    .eq("area_id", areaId)
    .eq("target_locale", normalizePublicLocale(locale));

  if (error) {
    const msg = String(error.message ?? "").toLowerCase();
    if (msg.includes("partner_texts_i18n") && msg.includes("does not exist")) return 0;
    throw new Error(String(error.message ?? "partner_texts_i18n lookup failed"));
  }

  return (data ?? []).filter((row) => {
    const status = String(row.status ?? "").trim().toLowerCase();
    const translated = String(row.translated_content ?? "").trim();
    return status === "approved" && translated.length > 0;
  }).length;
}

export async function getPublicAreaLocaleAvailability(
  regionSlugs: string[],
  locale: string,
): Promise<PublicAreaLocaleAvailability | null> {
  const normalizedLocale = normalizePublicLocale(locale);
  if (normalizedLocale === "de") return null;

  const report = await getReportBySlugs(regionSlugs);
  if (!report) return null;

  const meta = asRecord(asArray(report.meta)[0] ?? report.meta) ?? {};
  const areaId = (
    asString(meta["ortslage_schluessel"])
    ?? asString(meta["kreis_schluessel"])
    ?? ""
  ).trim();
  const areaName = (
    asString(meta["ortslage_name"])
    ?? asString(meta["kreis_name"])
    ?? asString(meta["amtlicher_name"])
    ?? regionSlugs[regionSlugs.length - 1]
    ?? "dieses Gebiet"
  ).trim() || "dieses Gebiet";

  if (!areaId) {
    return {
      locale: normalizedLocale,
      available: false,
      shouldIndex: false,
      areaId: null,
      areaName,
      partnerId: null,
      featureEnabled: false,
      translatedSectionCount: 0,
      reason: "missing_translations",
    };
  }

  const admin = createAdminClient();
  const partnerId = await loadSinglePublicVisiblePartnerIdForArea(admin, areaId);
  if (!partnerId) {
    return {
      locale: normalizedLocale,
      available: false,
      shouldIndex: false,
      areaId,
      areaName,
      partnerId: null,
      featureEnabled: false,
      translatedSectionCount: 0,
      reason: "no_public_partner",
    };
  }

  const featureEnabled = await isLocaleFeatureEnabled(partnerId, normalizedLocale);
  const translatedSectionCount = featureEnabled
    ? await loadTranslatedSectionCount(partnerId, areaId, normalizedLocale)
    : 0;

  const reason: PublicAreaLocaleAvailabilityReason = !featureEnabled
    ? "feature_disabled"
    : translatedSectionCount === 0
      ? "missing_translations"
      : "rendering_pending";

  return {
    locale: normalizedLocale,
    available: false,
    shouldIndex: false,
    areaId,
    areaName,
    partnerId,
    featureEnabled,
    translatedSectionCount,
    reason,
  };
}
