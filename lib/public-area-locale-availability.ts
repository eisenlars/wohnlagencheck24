import { getReportBySlugs } from "@/lib/data";
import { normalizePublicLocale } from "@/lib/public-locale-routing";
import { loadSinglePublicVisiblePartnerIdForArea } from "@/lib/public-partner-mappings";
import { loadPartnerLocaleAvailabilitySnapshot } from "@/lib/partner-locale-availability";
import { createAdminClient } from "@/utils/supabase/admin";
import { asArray, asRecord, asString } from "@/utils/records";

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

async function isLocaleFeatureEnabled(partnerId: string, locale: string): Promise<boolean> {
  const snapshot = await loadPartnerLocaleAvailabilitySnapshot(partnerId);
  return snapshot.available_locales.includes(normalizePublicLocale(locale));
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
