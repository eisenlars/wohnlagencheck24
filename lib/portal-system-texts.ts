import { normalizePublicLocale } from "@/lib/public-locale-routing";

type PortalSystemTextMap = {
  skip_to_content: string;
  preview: string;
  navigation: string;
  open_navigation: string;
  close: string;
  contact: string;
  all_rights_reserved: string;
  imprint: string;
  privacy: string;
  price_check: string;
  market_profiles: string;
  concept: string;
  more_content: string;
  area_profile_unavailable_title: string;
  area_profile_unavailable_body: string;
  area_profile_unavailable_feature_disabled: string;
  area_profile_unavailable_missing_translations: string;
  area_profile_unavailable_rendering_pending: string;
  area_profile_unavailable_no_public_partner: string;
  view_german_version: string;
};

const PORTAL_SYSTEM_TEXTS: Record<string, PortalSystemTextMap> = {
  de: {
    skip_to_content: "Zum Inhalt springen",
    preview: "Preview",
    navigation: "Navigation",
    open_navigation: "Navigation öffnen",
    close: "Schließen",
    contact: "Kontakt",
    all_rights_reserved: "Alle Rechte vorbehalten.",
    imprint: "Impressum",
    privacy: "Datenschutz",
    price_check: "Preischeck",
    market_profiles: "Immobilienmarkt & Standortprofile",
    concept: "Konzept",
    more_content: "Weitere Inhalte",
    area_profile_unavailable_title: "Standortprofil noch nicht in dieser Sprache verfügbar",
    area_profile_unavailable_body: "Diese Sprachversion ist noch nicht vollständig für die öffentliche Ausspielung freigegeben.",
    area_profile_unavailable_feature_disabled: "Für dieses Gebiet ist derzeit keine aktive Sprachfreigabe für diese Locale gebucht oder freigeschaltet.",
    area_profile_unavailable_missing_translations: "Für dieses Gebiet liegen in dieser Sprache aktuell noch keine freigegebenen Partnertexte vor.",
    area_profile_unavailable_rendering_pending: "Übersetzungen liegen bereits vor, die öffentliche mehrsprachige Gebietsausspielung wird dafür aber noch schrittweise aktiviert.",
    area_profile_unavailable_no_public_partner: "Für dieses Gebiet ist aktuell kein öffentlich sichtbarer Partner mit Sprachausspielung zugeordnet.",
    view_german_version: "Zur deutschen Version",
  },
  en: {
    skip_to_content: "Skip to content",
    preview: "Preview",
    navigation: "Navigation",
    open_navigation: "Open navigation",
    close: "Close",
    contact: "Contact",
    all_rights_reserved: "All rights reserved.",
    imprint: "Legal notice",
    privacy: "Privacy",
    price_check: "Price check",
    market_profiles: "Market & location profiles",
    concept: "Concept",
    more_content: "More content",
    area_profile_unavailable_title: "Area profile not yet available in this language",
    area_profile_unavailable_body: "This locale is not yet fully approved for public delivery of this area profile.",
    area_profile_unavailable_feature_disabled: "No active locale release or subscription is currently enabled for this area in the selected language.",
    area_profile_unavailable_missing_translations: "There are currently no approved partner translations available for this area in the selected language.",
    area_profile_unavailable_rendering_pending: "Translations already exist, but public multilingual delivery for area profiles is still being enabled step by step.",
    area_profile_unavailable_no_public_partner: "There is currently no publicly visible partner assigned to this area for multilingual delivery.",
    view_german_version: "View German version",
  },
};

export function getPortalSystemTexts(locale: string | null | undefined): PortalSystemTextMap {
  const normalized = normalizePublicLocale(locale);
  return PORTAL_SYSTEM_TEXTS[normalized] ?? PORTAL_SYSTEM_TEXTS.de;
}
