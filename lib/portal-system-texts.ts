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
  buy_offers: string;
  rent_offers: string;
  buy_requests: string;
  rent_requests: string;
  purchase_price: string;
  warm_rent: string;
  per_month: string;
  living_area: string;
  rooms: string;
  to_expose: string;
  previous_top_offer: string;
  next_top_offer: string;
  filter_object_type: string;
  all: string;
  house: string;
  apartment: string;
  no_image_available: string;
  no_image: string;
  top_property: string;
  no_matching_offers_available: string;
  page_navigation: string;
  previous_page: string;
  next_page: string;
  no_matching_requests_available: string;
  region_not_specified: string;
  rent_request: string;
  purchase_request: string;
  rooms_min: string;
  object_generic: string;
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
    buy_offers: "Kaufangebote",
    rent_offers: "Mietangebote",
    buy_requests: "Kaufgesuche",
    rent_requests: "Mietgesuche",
    purchase_price: "Kaufpreis",
    warm_rent: "Warmmiete",
    per_month: "/Monat",
    living_area: "Wohnfläche",
    rooms: "Zimmer",
    to_expose: "Zum Exposé",
    previous_top_offer: "Vorheriges Topobjekt",
    next_top_offer: "Nächstes Topobjekt",
    filter_object_type: "Objektart filtern",
    all: "Alle",
    house: "Haus",
    apartment: "Wohnung",
    no_image_available: "Kein Bild verfügbar",
    no_image: "Kein Bild",
    top_property: "Topobjekt",
    no_matching_offers_available: "Aktuell sind keine passenden Angebote verfügbar.",
    page_navigation: "Seiten-Navigation",
    previous_page: "Vorherige Seite",
    next_page: "Nächste Seite",
    no_matching_requests_available: "Aktuell sind keine passenden Gesuche für diese Ortslage verfügbar.",
    region_not_specified: "Region nicht hinterlegt",
    rent_request: "Mietgesuch",
    purchase_request: "Kaufgesuch",
    rooms_min: "Zimmer min.",
    object_generic: "Objekt",
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
    buy_offers: "Buy offers",
    rent_offers: "Rental offers",
    buy_requests: "Buy requests",
    rent_requests: "Rental requests",
    purchase_price: "Purchase price",
    warm_rent: "Warm rent",
    per_month: "/month",
    living_area: "Living area",
    rooms: "Rooms",
    to_expose: "View listing",
    previous_top_offer: "Previous featured property",
    next_top_offer: "Next featured property",
    filter_object_type: "Filter by property type",
    all: "All",
    house: "House",
    apartment: "Apartment",
    no_image_available: "No image available",
    no_image: "No image",
    top_property: "Featured property",
    no_matching_offers_available: "There are currently no matching offers available.",
    page_navigation: "Page navigation",
    previous_page: "Previous page",
    next_page: "Next page",
    no_matching_requests_available: "There are currently no matching requests available for this area.",
    region_not_specified: "Region not specified",
    rent_request: "Rental request",
    purchase_request: "Buy request",
    rooms_min: "Rooms min.",
    object_generic: "Property",
  },
};

export function getPortalSystemTexts(locale: string | null | undefined): PortalSystemTextMap {
  const normalized = normalizePublicLocale(locale);
  return PORTAL_SYSTEM_TEXTS[normalized] ?? PORTAL_SYSTEM_TEXTS.de;
}
