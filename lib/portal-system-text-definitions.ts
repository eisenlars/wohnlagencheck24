export type PortalSystemTextMap = {
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
  offers_unavailable_title: string;
  offers_unavailable_body: string;
  requests_unavailable_title: string;
  requests_unavailable_body: string;
  view_german_offers: string;
  view_german_requests: string;
  interested_in_property: string;
  partner_expose_provided: string;
  to_partner_expose: string;
  no_expose_link_available: string;
  back_to_overview: string;
  image_gallery: string;
  no_images_available: string;
  property_description: string;
  location_label: string;
  highlights_label: string;
  floor_plan: string;
  floor_plan_pending: string;
  location_map: string;
  location_map_pending: string;
  features_label: string;
  features_details_pending: string;
  energy_label: string;
  energy_class: string;
  energy_demand: string;
  primary_energy_source: string;
  contact_request: string;
  contact_request_hint: string;
  request_now: string;
};

export type PortalSystemTextKey = keyof PortalSystemTextMap;

export type PortalSystemTextDefinition = {
  key: PortalSystemTextKey;
  label: string;
  group: string;
};

export const PORTAL_SYSTEM_TEXT_DEFAULTS: Record<string, PortalSystemTextMap> = {
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
    offers_unavailable_title: "Angebote noch nicht in dieser Sprache verfügbar",
    offers_unavailable_body: "Für diese Angebote liegen aktuell noch keine freigegebenen Übersetzungen in der gewählten Sprache vor.",
    requests_unavailable_title: "Gesuche noch nicht in dieser Sprache verfügbar",
    requests_unavailable_body: "Für diese Gesuche liegen aktuell noch keine freigegebenen Übersetzungen in der gewählten Sprache vor.",
    view_german_offers: "Deutsche Angebotsliste ansehen",
    view_german_requests: "Deutsche Gesuche ansehen",
    interested_in_property: "Interesse an diesem Objekt?",
    partner_expose_provided: "Das Exposé wird exklusiv vom Partner bereitgestellt.",
    to_partner_expose: "Zum Partner-Exposé",
    no_expose_link_available: "Kein Exposé-Link verfügbar.",
    back_to_overview: "Zurück zur Übersicht",
    image_gallery: "Bildergalerie",
    no_images_available: "Keine Bilder verfügbar.",
    property_description: "Objektbeschreibung",
    location_label: "Lage",
    highlights_label: "Highlights",
    floor_plan: "Grundriss",
    floor_plan_pending: "Grundriss folgt",
    location_map: "Lagekarte",
    location_map_pending: "Lagekarte folgt",
    features_label: "Ausstattung",
    features_details_pending: "Ausstattungsdetails werden ergänzt.",
    energy_label: "Energie",
    energy_class: "Energieklasse",
    energy_demand: "Endenergiebedarf",
    primary_energy_source: "Wesentlicher Energieträger",
    contact_request: "Kontakt & Anfrage",
    contact_request_hint: "Für eine Besichtigung oder weitere Informationen kontaktieren Sie bitte den Anbieter.",
    request_now: "Jetzt Anfrage stellen",
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
    offers_unavailable_title: "Offers not yet available in this language",
    offers_unavailable_body: "There are currently no approved translations for these offers in the selected language.",
    requests_unavailable_title: "Requests not yet available in this language",
    requests_unavailable_body: "There are currently no approved translations for these requests in the selected language.",
    view_german_offers: "View German offers",
    view_german_requests: "View German requests",
    interested_in_property: "Interested in this property?",
    partner_expose_provided: "The listing brochure is provided exclusively by the partner.",
    to_partner_expose: "Go to partner listing",
    no_expose_link_available: "No listing link available.",
    back_to_overview: "Back to overview",
    image_gallery: "Image gallery",
    no_images_available: "No images available.",
    property_description: "Property description",
    location_label: "Location",
    highlights_label: "Highlights",
    floor_plan: "Floor plan",
    floor_plan_pending: "Floor plan coming soon",
    location_map: "Location map",
    location_map_pending: "Location map coming soon",
    features_label: "Features",
    features_details_pending: "Feature details will be added soon.",
    energy_label: "Energy",
    energy_class: "Energy class",
    energy_demand: "Energy demand",
    primary_energy_source: "Primary energy source",
    contact_request: "Contact & inquiry",
    contact_request_hint: "Please contact the provider for a viewing or further information.",
    request_now: "Send inquiry now",
  },
};

function buildPortalSystemTextLabel(key: PortalSystemTextKey): string {
  return key
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function resolvePortalSystemTextGroup(key: PortalSystemTextKey): string {
  if (key.startsWith("area_profile_") || key === "view_german_version") return "Gebiets-Fallback";
  if (
    key.includes("offers")
    || key.includes("offer")
    || key === "purchase_price"
    || key === "warm_rent"
    || key === "living_area"
    || key === "rooms"
    || key === "to_expose"
    || key === "filter_object_type"
    || key === "house"
    || key === "apartment"
    || key === "top_property"
    || key === "page_navigation"
    || key === "previous_page"
    || key === "next_page"
    || key === "object_generic"
    || key === "interested_in_property"
    || key === "partner_expose_provided"
    || key === "to_partner_expose"
    || key === "no_expose_link_available"
    || key === "back_to_overview"
    || key === "image_gallery"
    || key === "no_images_available"
    || key === "property_description"
    || key === "location_label"
    || key === "highlights_label"
    || key === "floor_plan"
    || key === "floor_plan_pending"
    || key === "location_map"
    || key === "location_map_pending"
    || key === "features_label"
    || key === "features_details_pending"
    || key === "energy_label"
    || key === "energy_class"
    || key === "energy_demand"
    || key === "primary_energy_source"
    || key === "contact_request"
    || key === "contact_request_hint"
    || key === "request_now"
  ) {
    return "Angebote";
  }
  if (key.includes("requests") || key.includes("request") || key === "rooms_min") return "Gesuche";
  if (key === "skip_to_content" || key === "navigation" || key === "open_navigation" || key === "close" || key === "contact" || key === "all_rights_reserved" || key === "imprint" || key === "privacy" || key === "preview") {
    return "Navigation & Footer";
  }
  return "Portalweit";
}

export const PORTAL_SYSTEM_TEXT_DEFINITIONS: PortalSystemTextDefinition[] = (
  Object.keys(PORTAL_SYSTEM_TEXT_DEFAULTS.de) as PortalSystemTextKey[]
).map((key) => ({
  key,
  label: buildPortalSystemTextLabel(key),
  group: resolvePortalSystemTextGroup(key),
}));

export function getPortalSystemTextDefaultMap(locale: string | null | undefined): PortalSystemTextMap {
  const normalized = String(locale ?? "").trim().toLowerCase();
  return PORTAL_SYSTEM_TEXT_DEFAULTS[normalized] ?? PORTAL_SYSTEM_TEXT_DEFAULTS.de;
}

export function getPortalSystemTextDefaultValue(locale: string | null | undefined, key: PortalSystemTextKey): string {
  return getPortalSystemTextDefaultMap(locale)[key] ?? PORTAL_SYSTEM_TEXT_DEFAULTS.de[key];
}
