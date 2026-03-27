import type {
  OfferDetailsSnapshot,
  OfferDocumentAsset,
  MappedOffer,
  OfferEnergySnapshot,
  OfferMediaAsset,
  PartnerIntegration,
  RawListing,
  RawReference,
  RawRequest,
  ResourceSyncData,
} from "@/lib/providers/types";

type PropstackImage = {
  id?: number;
  url?: string;
  original?: string;
  big?: string;
  medium?: string;
  thumb?: string;
  big_url?: string;
  medium_url?: string;
  thumb_url?: string;
  small_thumb_url?: string;
  square_url?: string;
  title?: string;
  position?: number;
  is_floorplan?: boolean | null;
  is_private?: boolean | null;
  is_not_for_exposee?: boolean | null;
};

type PropstackDocument = {
  url?: string;
  title?: string;
  name?: string;
  position?: number;
  is_floorplan?: boolean | null;
  is_exposee?: boolean | null;
  on_landing_page?: boolean | null;
};

type PropstackUnit = {
  id: number | string;
  exposee_id?: string | null;
  marketing_type?: string | null;
  commercialization_type?: string | { label?: unknown; value?: unknown } | null;
  object_type?: string | null;
  rs_type?: string | null;
  rs_category?: string | null;
  unit_id?: string | null;
  name?: string | null;
  title?: string | { label?: unknown; value?: unknown } | null;
  description_note?: string | { label?: unknown; value?: unknown } | null;
  long_description_note?: string | { label?: unknown; value?: unknown } | null;
  location_note?: string | { label?: unknown; value?: unknown } | null;
  furnishing_note?: string | { label?: unknown; value?: unknown } | null;
  street?: string | null;
  house_number?: string | null;
  zip_code?: string | null;
  city?: string | null;
  address?: string | null;
  short_address?: string | null;
  district?: string | { label?: unknown; value?: unknown } | null;
  location_name?: string | null;
  sublocality_level_1?: string | null;
  region?: string | null;
  country?: string | null;
  lat?: number | null;
  lng?: number | null;
  hide_address?: boolean | null;
  price?: number | string | { label?: unknown; value?: unknown } | null;
  base_rent?: number | string | { label?: unknown; value?: unknown } | null;
  purchase_price?: number | string | { label?: unknown; value?: unknown } | null;
  rent_net?: number | string | { label?: unknown; value?: unknown } | null;
  living_space?: number | string | { label?: unknown; value?: unknown } | null;
  number_of_rooms?: number | string | { label?: unknown; value?: unknown } | null;
  energy_certificate_type?: string | null;
  energy_consumption_value?: number | string | { label?: unknown; value?: unknown } | null;
  building_energy_rating_type?: string | { label?: unknown; value?: unknown } | null;
  energy_efficiency_value?: number | string | { label?: unknown; value?: unknown } | null;
  energy_efficiency_class?: string | { label?: unknown; value?: unknown } | null;
  energy_certificate_availability?: string | { label?: unknown; value?: unknown } | null;
  energy_certificate_start_date?: string | { label?: unknown; value?: unknown } | null;
  energy_certificate_end_date?: string | { label?: unknown; value?: unknown } | null;
  energy_consumption_contains_warm_water?: boolean | { label?: unknown; value?: unknown } | null;
  heating_type?: string | { label?: unknown; value?: unknown } | null;
  construction_year?: number | string | { label?: unknown; value?: unknown } | null;
  usable_floor_space?: number | string | { label?: unknown; value?: unknown } | null;
  plot_area?: number | string | { label?: unknown; value?: unknown } | null;
  property_space_value?: number | string | { label?: unknown; value?: unknown } | null;
  floor?: number | string | { label?: unknown; value?: unknown } | null;
  condition?: string | { label?: unknown; value?: unknown } | null;
  free_from?: string | { label?: unknown; value?: unknown } | null;
  number_of_bed_rooms?: number | string | { label?: unknown; value?: unknown } | null;
  number_of_bath_rooms?: number | string | { label?: unknown; value?: unknown } | null;
  parking_space_type?: string | { label?: unknown; value?: unknown } | null;
  parking_space_types?: string[] | { label?: unknown; value?: unknown } | null;
  balcony?: boolean | { label?: unknown; value?: unknown } | null;
  terrace?: boolean | { label?: unknown; value?: unknown } | null;
  garden?: boolean | { label?: unknown; value?: unknown } | null;
  lift?: boolean | { label?: unknown; value?: unknown } | null;
  custom_fields?: Record<string, unknown> | null;
  updated_at?: string | null;
  images?: PropstackImage[] | null;
  documents?: PropstackDocument[] | null;
  status?: string | { id?: number | string | null; name?: unknown; title?: unknown } | null;
  property_status?: string | { id?: number | string | null; name?: unknown; title?: unknown } | null;
  sub_status?: string | null;
  archived?: boolean | null;
  recommended_use_types?: unknown[] | null;
  public_expose_url?: string | null;
};

type PropstackPropertyStatus = {
  id?: number | string | null;
  name?: string | null;
  title?: string | null;
  color?: string | null;
  nonpublic?: boolean | null;
};

type PropstackSearchProfile = {
  id?: number | string;
  created_at?: string | null;
  broker_id?: number | string | null;
  title?: string | null;
  name?: string | null;
  query_title?: string | null;
  status?: string | null;
  active?: boolean | null;
  request_type?: string | null;
  marketing_type?: string | null;
  lat?: number | string | null;
  lng?: number | string | null;
  radius?: number | string | null;
  category?: string | null;
  rs_types?: string[] | null;
  rs_categories?: string[] | null;
  property_status_ids?: Array<number | string> | null;
  location_ids?: Array<number | string> | null;
  group_ids?: Array<number | string> | null;
  note?: string | null;
  min_rooms?: number | null;
  number_of_rooms?: number | null;
  number_of_rooms_from?: number | null;
  number_of_rooms_to?: number | null;
  max_price?: number | null;
  price?: number | null;
  price_to?: number | null;
  base_rent?: number | null;
  base_rent_to?: number | null;
  total_rent?: number | null;
  total_rent_to?: number | null;
  living_space?: number | null;
  living_space_to?: number | null;
  plot_area?: number | null;
  plot_area_to?: number | null;
  number_of_bedrooms?: number | string | null;
  number_of_bedrooms_to?: number | string | null;
  number_of_bed_rooms?: number | string | null;
  number_of_bed_rooms_to?: number | string | null;
  floor?: number | string | null;
  floor_to?: number | string | null;
  construction_year?: number | string | null;
  construction_year_to?: number | string | null;
  condition?: string | null;
  lift?: string | boolean | null;
  balcony?: string | boolean | null;
  garden?: string | boolean | null;
  built_in_kitchen?: string | boolean | null;
  cellar?: string | boolean | null;
  rented?: string | boolean | null;
  recommended_use_types?: string[] | null;
  site_development_type?: string | null;
  building_permission?: string | boolean | null;
  preliminary_enquiry?: string | boolean | null;
  short_term_constructible?: string | boolean | null;
  city?: string | null;
  cities?: string[] | null;
  region?: string | null;
  regions?: string[] | null;
  updated_at?: string | null;
  client_id?: number | string | null;
};

type PropstackResourceSettings = {
  listings_status_ids?: string[];
  references_statuses?: string[];
  references_sub_statuses?: string[];
  references_custom_field_key?: string;
  references_archived: -1 | 0 | 1;
  references_status_ids?: string[];
  references_endpoint_path: string;
};

type RegionTarget = {
  city: string;
  district: string | null;
  label: string;
  key: string;
};

type PropstackClassification = {
  usageType: "wohnen" | "grundstueck" | "gewerbe" | "anlage" | "spezial";
  objectType: string;
  legacyObjectType: "haus" | "wohnung";
};

const PROVIDER_FETCH_TIMEOUT_MS = 12000;

type PropstackFetchBatchResult<T> = {
  items: T[];
  requestsMade: number;
  pagesFetched: number;
};

type PropstackGuardedResourceLimits = {
  targetObjects: number;
  maxPages: number;
  perPage: number;
};

type PropstackGuardedLimits = {
  units: PropstackGuardedResourceLimits;
  references: PropstackGuardedResourceLimits;
  savedQueries: PropstackGuardedResourceLimits;
};

function readNestedObject(record: Record<string, unknown> | null | undefined, key: string): Record<string, unknown> {
  const value = record?.[key];
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function readBoundedInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === "number"
    ? value
    : typeof value === "string" && value.trim().length > 0
      ? Number(value)
      : NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function buildTargetObjectLimit(
  config: Record<string, unknown>,
  fallbackTargetObjects: number,
  pageSize: number,
  maxPages: number,
): PropstackGuardedResourceLimits {
  const legacyMaxPages = readBoundedInteger(config.max_pages, Math.max(1, Math.ceil(fallbackTargetObjects / pageSize)), 1, maxPages);
  const legacyPerPage = readBoundedInteger(config.per_page, fallbackTargetObjects, 1, 100);
  const targetObjects = readBoundedInteger(
    config.target_objects,
    legacyMaxPages * legacyPerPage,
    1,
    pageSize * maxPages,
  );
  const perPage = Math.max(1, Math.min(pageSize, targetObjects));
  return {
    targetObjects,
    maxPages: Math.max(1, Math.ceil(targetObjects / perPage)),
    perPage,
  };
}

function getPropstackGuardedLimits(settings: Record<string, unknown> | null): PropstackGuardedLimits {
  const guarded = readNestedObject(settings, "guarded");
  const units = readNestedObject(guarded, "units");
  const references = readNestedObject(guarded, "references");
  const savedQueries = readNestedObject(guarded, "saved_queries");
  const unitLimits = buildTargetObjectLimit(units, 10, 20, 20);
  const referenceLimits = buildTargetObjectLimit(references, unitLimits.targetObjects, 20, 20);
  const savedQueryLimits = buildTargetObjectLimit(savedQueries, 50, 50, 10);

  return {
    units: unitLimits,
    references: referenceLimits,
    savedQueries: savedQueryLimits,
  };
}

function toSettings(settings: Record<string, unknown> | null): PropstackResourceSettings {
  const resourceEndpoints = (settings?.resource_endpoints ?? {}) as Record<string, unknown>;
  const resourceFilters = (settings?.resource_filters ?? {}) as Record<string, unknown>;
  const listingsCfg = (resourceFilters.listings ?? {}) as Record<string, unknown>;
  const referencesCfg = (resourceFilters.references ?? {}) as Record<string, unknown>;

  const statusesRaw = referencesCfg.statuses;
  const subStatusesRaw = referencesCfg.sub_statuses;

  const toStringArray = (value: unknown): string[] | undefined => {
    if (!Array.isArray(value)) return undefined;
    const out = value
      .map((v) => String(v ?? "").trim().toLowerCase())
      .filter(Boolean);
    return out.length ? out : undefined;
  };

  const toIdArray = (value: unknown): string[] | undefined => {
    const values = Array.isArray(value) ? value : value == null ? [] : [value];
    const out = values
      .map((v) => String(v ?? "").trim())
      .filter(Boolean);
    return out.length ? out : undefined;
  };

  const archivedRaw = Number(referencesCfg.archived ?? 1);
  const referencesPath = String(resourceEndpoints.references_path ?? "/units").trim() || "/units";

  return {
    listings_status_ids: toIdArray(listingsCfg.status_ids ?? listingsCfg.status_id),
    references_statuses: toStringArray(statusesRaw) ?? ["archived", "verkauft", "vermietet", "sold", "rented"],
    references_sub_statuses: toStringArray(subStatusesRaw) ?? ["sold", "rented"],
    references_custom_field_key: String(referencesCfg.custom_field_key ?? "referenz_webseite").trim(),
    references_archived: archivedRaw === -1 ? -1 : archivedRaw === 0 ? 0 : 1,
    references_status_ids: toIdArray(referencesCfg.status_ids ?? referencesCfg.status_id),
    references_endpoint_path: referencesPath.startsWith("/") ? referencesPath : `/${referencesPath}`,
  };
}

function normalizeOfferType(marketingType?: string | null): "kauf" | "miete" {
  if (!marketingType) return "kauf";
  const value = marketingType.toUpperCase();
  if (value === "RENT" || value === "LET" || value === "MIETE") return "miete";
  return "kauf";
}

function classifyPropstackUnit(
  unit: Pick<PropstackUnit, "object_type" | "rs_type" | "rs_category" | "recommended_use_types">,
): PropstackClassification {
  const combined = [
    unit.object_type,
    unit.rs_type,
    unit.rs_category,
    ...(Array.isArray(unit.recommended_use_types) ? unit.recommended_use_types.map((value) => String(value ?? "")) : []),
  ]
    .map((value) => String(value ?? "").trim().toUpperCase())
    .filter(Boolean)
    .join(" ");

  if (!combined) {
    return {
      usageType: "wohnen",
      objectType: "wohnung",
      legacyObjectType: "wohnung",
    };
  }
  if (
    combined.includes("TRADE_SITE")
    || combined.includes("PLOT")
    || combined.includes("LAND")
    || combined.includes("GRUNDST")
    || combined.includes("SITE")
  ) {
    return {
      usageType: "grundstueck",
      objectType: "grundstueck",
      legacyObjectType: "wohnung",
    };
  }
  if (
    combined.includes("INVEST")
    || combined.includes("ANLAGE")
    || combined.includes("MULTI_FAMILY")
    || combined.includes("MEHRFAMIL")
    || combined.includes("APARTMENT_BUILDING")
    || combined.includes("RESIDENTIAL_AND_COMMERCIAL")
    || combined.includes("ZINSHAUS")
  ) {
    return {
      usageType: "anlage",
      objectType: "anlage",
      legacyObjectType: "wohnung",
    };
  }
  if (
    combined.includes("COMMERCIAL")
    || combined.includes("GEWERBE")
    || combined.includes("OFFICE")
    || combined.includes("BUERO")
    || combined.includes("BÜRO")
    || combined.includes("PRAXIS")
    || combined.includes("STORE")
    || combined.includes("SHOP")
    || combined.includes("RETAIL")
    || combined.includes("INDUSTR")
    || combined.includes("HALLE")
    || combined.includes("GASTRO")
    || combined.includes("HOTEL")
    || combined.includes("LOGIST")
  ) {
    return {
      usageType: "gewerbe",
      objectType: "gewerbe",
      legacyObjectType: "wohnung",
    };
  }
  if (
    combined.includes("HOUSE")
    || combined.includes("HAUS")
    || combined.includes("VILLA")
    || combined.includes("BUNGALOW")
  ) {
    return {
      usageType: "wohnen",
      objectType: "haus",
      legacyObjectType: "haus",
    };
  }
  if (
    combined.includes("APART")
    || combined.includes("FLAT")
    || combined.includes("WOHNUNG")
    || combined.includes("CONDO")
    || combined.includes("LIVING")
  ) {
    return {
      usageType: "wohnen",
      objectType: "wohnung",
      legacyObjectType: "wohnung",
    };
  }
  return {
    usageType: "spezial",
    objectType: "spezial",
    legacyObjectType: "wohnung",
  };
}

function normalizeObjectType(unit: Pick<PropstackUnit, "object_type" | "rs_type" | "rs_category" | "recommended_use_types">): string {
  return classifyPropstackUnit(unit).objectType;
}

function normalizePropstackOfferType(
  unit: Pick<PropstackUnit, "marketing_type" | "commercialization_type">,
): "kauf" | "miete" {
  return normalizeOfferType(
    firstString([
      unit.marketing_type,
      normalizePropstackText(unit.commercialization_type),
    ]),
  );
}

function buildDistrict(unit: Pick<PropstackUnit, "district" | "location_name" | "sublocality_level_1">): string | null {
  return firstString([
    normalizePropstackText(unit.district),
    unit.location_name,
    unit.sublocality_level_1,
  ]);
}

function getEffectivePropstackStatus(
  unit: Pick<PropstackUnit, "property_status" | "status">,
): PropstackUnit["status"] | PropstackUnit["property_status"] {
  return unit.property_status ?? unit.status ?? null;
}

function normalizePropstackArea(unit: PropstackUnit): number | null {
  const classification = classifyPropstackUnit(unit);
  if (classification.usageType === "grundstueck") {
    return normalizePropstackNumber(unit.plot_area)
      ?? normalizePropstackNumber(unit.property_space_value)
      ?? normalizePropstackNumber(unit.living_space)
      ?? normalizePropstackNumber(unit.usable_floor_space);
  }
  return normalizePropstackNumber(unit.living_space)
    ?? normalizePropstackNumber(unit.property_space_value)
    ?? normalizePropstackNumber(unit.usable_floor_space)
    ?? normalizePropstackNumber(unit.plot_area);
}

function buildAddress(unit: PropstackUnit): string | null {
  if (unit.hide_address) return null;
  const fullAddress = firstString([unit.address, unit.short_address]);
  if (fullAddress) return fullAddress;
  const parts = [
    unit.street?.trim(),
    unit.house_number?.trim(),
    unit.zip_code?.trim(),
    unit.city?.trim(),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}

function buildDetailUrl(template: string | null, unit: Pick<PropstackUnit, "id" | "exposee_id">): string | null {
  if (!template) return null;
  const needsExposeeId = template.includes("{exposee_id}");
  const needsId = template.includes("{id}");
  const exposeeId = unit.exposee_id ?? "";
  const id = unit.id ?? "";
  if (needsExposeeId && !String(exposeeId).trim()) return null;
  if (needsId && !String(id).trim()) return null;
  return template.replace("{exposee_id}", String(exposeeId)).replace("{id}", String(id));
}

function resolvePropstackImageUrl(image: PropstackImage | null | undefined): string | null {
  return firstString([
    image?.url,
    image?.original,
    image?.medium,
    image?.medium_url,
    image?.big,
    image?.big_url,
    image?.thumb,
    image?.thumb_url,
    image?.small_thumb_url,
    image?.square_url,
  ]);
}

function normalizeImages(images?: PropstackImage[] | null): string[] {
  if (!Array.isArray(images)) return [];
  return images
    .filter((img) => img?.is_private !== true && img?.is_not_for_exposee !== true)
    .map((img) => resolvePropstackImageUrl(img))
    .filter((url): url is string => typeof url === "string" && url.length > 0);
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.value === "boolean") return record.value;
  }
  return null;
}

function inferPropstackMediaKind(
  title: string | null,
  url: string | null,
  isFloorplan?: boolean | null,
): "image" | "floorplan" | "location_map" | "document" {
  if (isFloorplan === true) return "floorplan";
  const normalizedTitle = String(title ?? "").trim().toLowerCase();
  const normalizedUrl = String(url ?? "").trim().toLowerCase();
  const normalized = `${normalizedTitle} ${normalizedUrl}`.trim();
  if (!normalized) return "image";
  if (
    normalized.includes("grundriss")
    || normalized.includes("floorplan")
    || normalized.includes("floor plan")
    || normalized.includes("planzeichnung")
  ) {
    return "floorplan";
  }
  if (
    normalized.includes("lageplan")
    || normalized.includes("lage")
    || normalized.includes("standort")
    || normalized.includes("mikrolage")
    || normalized.includes("makrolage")
    || normalized === "lage"
  ) {
    return "location_map";
  }
  if (
    normalized.includes("wohnflächenberechnung")
    || normalized.includes("wohnflaechenberechnung")
    || normalized.includes("flächenberechnung")
    || normalized.includes("flaechenberechnung")
    || normalized.includes("berechnung")
    || normalized.includes("beratung")
  ) {
    return "document";
  }
  return "image";
}

function normalizeImageAssets(images?: PropstackImage[] | null): OfferMediaAsset[] {
  if (!Array.isArray(images)) return [];
  return images
    .filter((img) => img?.is_private !== true && img?.is_not_for_exposee !== true)
    .map((img) => {
      const url = resolvePropstackImageUrl(img) ?? "";
      if (!url) return null;
      const title = typeof img?.title === "string" ? img.title.trim() || null : null;
      return {
        url,
        title,
        position: typeof img?.position === "number" && Number.isFinite(img.position) ? img.position : null,
        kind: inferPropstackMediaKind(title, url, img?.is_floorplan ?? null),
      } satisfies OfferMediaAsset;
    })
    .filter((asset): asset is OfferMediaAsset => Boolean(asset))
    .sort((left, right) => {
      if (left.position == null && right.position == null) return left.url.localeCompare(right.url);
      if (left.position == null) return 1;
      if (right.position == null) return -1;
      return left.position - right.position;
    });
}

function normalizeDocumentKind(document: PropstackDocument): OfferDocumentAsset["kind"] {
  if (document.is_floorplan === true) return "floorplan";
  const url = String(document.url ?? "").trim().toLowerCase();
  const title = String(document.title ?? document.name ?? "").trim().toLowerCase();
  const combined = `${title} ${url}`.trim();
  if (combined.includes(".mp4") || combined.includes("video")) return "video";
  return "document";
}

function normalizeDocuments(documents?: PropstackDocument[] | null): OfferDocumentAsset[] {
  if (!Array.isArray(documents)) return [];
  return documents
    .map((document) => {
      const url = typeof document?.url === "string" ? document.url.trim() : "";
      if (!url) return null;
      return {
        url,
        title: typeof document?.title === "string" ? document.title.trim() || null : null,
        name: typeof document?.name === "string" ? document.name.trim() || null : null,
        position: typeof document?.position === "number" && Number.isFinite(document.position) ? document.position : null,
        kind: normalizeDocumentKind(document),
        is_exposee: document?.is_exposee ?? null,
        on_landing_page: document?.on_landing_page ?? null,
      } satisfies OfferDocumentAsset;
    })
    .filter((entry): entry is OfferDocumentAsset => Boolean(entry))
    .sort((left, right) => {
      if (left.position == null && right.position == null) return left.url.localeCompare(right.url);
      if (left.position == null) return 1;
      if (right.position == null) return -1;
      return left.position - right.position;
    });
}

function normalizeEnergyValueKind(certificateType: string | null | undefined): "bedarf" | "verbrauch" | null {
  const normalized = String(certificateType ?? "").trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.includes("bedarf")) return "bedarf";
  if (normalized.includes("verbrauch")) return "verbrauch";
  return null;
}

function buildEnergySnapshot(unit: PropstackUnit): OfferEnergySnapshot {
  const certificateType = normalizePropstackTitle(unit.building_energy_rating_type)
    ?? unit.energy_certificate_type
    ?? null;
  const value = normalizePropstackNumber(unit.energy_efficiency_value)
    ?? normalizePropstackNumber(unit.energy_consumption_value);
  const constructionYear = normalizePropstackNumber(unit.construction_year);
  return {
    certificate_type: certificateType,
    value,
    value_kind: normalizeEnergyValueKind(certificateType),
    construction_year: constructionYear,
    heating_energy_source: normalizePropstackTitle(unit.heating_type),
    efficiency_class: normalizePropstackTitle(unit.energy_efficiency_class),
    certificate_availability: normalizePropstackTitle(unit.energy_certificate_availability),
    certificate_start_date: normalizePropstackTitle(unit.energy_certificate_start_date),
    certificate_end_date: normalizePropstackTitle(unit.energy_certificate_end_date),
    warm_water_included: asBoolean(unit.energy_consumption_contains_warm_water),
    demand: value,
    year: constructionYear,
  };
}

function buildDetailsSnapshot(unit: PropstackUnit): OfferDetailsSnapshot {
  return {
    living_area_sqm: normalizePropstackNumber(unit.living_space),
    usable_area_sqm: normalizePropstackNumber(unit.usable_floor_space),
    plot_area_sqm: normalizePropstackNumber(unit.plot_area),
    rooms: normalizePropstackNumber(unit.number_of_rooms),
    bedrooms: normalizePropstackNumber(unit.number_of_bed_rooms),
    bathrooms: normalizePropstackNumber(unit.number_of_bath_rooms),
    floor: normalizePropstackNumber(unit.floor),
    construction_year: normalizePropstackNumber(unit.construction_year),
    condition: normalizePropstackTitle(unit.condition),
    availability: normalizePropstackText(unit.free_from),
    parking: normalizePropstackTitle(unit.parking_space_type)
      ?? (Array.isArray(unit.parking_space_types) ? unit.parking_space_types.filter((entry) => typeof entry === "string").join(", ") || null : normalizePropstackTitle(unit.parking_space_types)),
    balcony: asBoolean(unit.balcony),
    terrace: asBoolean(unit.terrace),
    garden: asBoolean(unit.garden),
    elevator: asBoolean(unit.lift),
    address_hidden: unit.hide_address ?? null,
  };
}

function toIsoNow(): string {
  return new Date().toISOString();
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = PROVIDER_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Propstack request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function makeRawRowBase(
  partnerId: string,
  provider: "propstack",
  externalId: string,
  title: string | null,
  status: string | null,
  sourceUpdatedAt: string | null,
  normalizedPayload: Record<string, unknown>,
  sourcePayload: Record<string, unknown>,
): RawListing {
  const now = toIsoNow();
  return {
    partner_id: partnerId,
    provider,
    external_id: externalId,
    title,
    status,
    source_updated_at: sourceUpdatedAt,
    normalized_payload: normalizedPayload,
    source_payload: sourcePayload,
    is_active: true,
    sync_status: "ok",
    last_seen_at: now,
    updated_at: now,
  };
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return {};
  return value as Record<string, unknown>;
}

function includeAsReference(unit: PropstackUnit, cfg: PropstackResourceSettings): boolean {
  const status = getEffectivePropstackStatus(unit);
  const statusName = normalizePropstackStatusName(status);
  const statusId = normalizePropstackStatusId(status);
  const subStatus = String(unit.sub_status ?? "").toLowerCase();
  const archived = unit.archived === true;
  const statuses = new Set(cfg.references_statuses ?? []);
  const subStatuses = new Set(cfg.references_sub_statuses ?? []);
  const customKey = cfg.references_custom_field_key ?? "";
  const customFields = asObject(unit.custom_fields);
  const customFlag = customKey ? Boolean(customFields[customKey]) : false;
  const archivedMatch = archived && statuses.has("archived");
  const statusMatch = Boolean(statusName && statuses.has(statusName))
    || Boolean(statusId && statuses.has(statusId));
  const subStatusMatch = Boolean(subStatus && subStatuses.has(subStatus));
  return archivedMatch || statusMatch || (!statusMatch && subStatusMatch) || customFlag;
}

function requestTypeFromProfile(profile: PropstackSearchProfile): "kauf" | "miete" {
  const v = String(profile.request_type ?? profile.marketing_type ?? "").toLowerCase();
  if (v === "rent" || v === "miete") return "miete";
  return "kauf";
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => String(entry ?? "").trim())
    .filter(Boolean);
}

function normalizeSearchProfileBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return null;
  if (["true", "1", "yes", "ja"].includes(text)) return true;
  if (["false", "0", "no", "nein"].includes(text)) return false;
  return null;
}

function normalizeSearchProfileIdArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => String(entry ?? "").trim())
    .filter(Boolean);
}

function normalizeSearchProfileRoomsMin(profile: PropstackSearchProfile): number | null {
  return asNumber(profile.min_rooms)
    ?? asNumber(profile.number_of_rooms)
    ?? asNumber(profile.number_of_rooms_from);
}

function normalizeSearchProfileRoomsMax(profile: PropstackSearchProfile): number | null {
  return asNumber(profile.number_of_rooms_to);
}

function normalizeSearchProfileBudgetMax(profile: PropstackSearchProfile): number | null {
  if (requestTypeFromProfile(profile) === "miete") {
    return asNumber(profile.base_rent_to)
      ?? asNumber(profile.total_rent_to)
      ?? asNumber(profile.base_rent)
      ?? asNumber(profile.total_rent);
  }
  return asNumber(profile.max_price)
    ?? asNumber(profile.price_to)
    ?? asNumber(profile.price);
}

function normalizeSearchProfileBudgetMin(profile: PropstackSearchProfile): number | null {
  if (requestTypeFromProfile(profile) === "miete") {
    return asNumber(profile.base_rent)
      ?? asNumber(profile.total_rent);
  }
  return asNumber(profile.price);
}

function classifyPropstackSearchProfile(profile: Pick<PropstackSearchProfile, "rs_types" | "rs_categories" | "recommended_use_types" | "category">): PropstackClassification {
  const combined = [
    profile.category,
    ...normalizeStringArray(profile.rs_types),
    ...normalizeStringArray(profile.rs_categories),
    ...normalizeStringArray(profile.recommended_use_types),
  ]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .map((value) => value.toUpperCase())
    .join(" ");

  return classifyPropstackUnit({
    object_type: null,
    rs_type: combined,
    rs_category: combined,
    recommended_use_types: null,
  });
}

function buildSearchProfileRegionTargets(profile: PropstackSearchProfile): Array<RegionTarget & { kind: "city" | "region" }> {
  const seen = new Set<string>();
  const out: Array<RegionTarget & { kind: "city" | "region" }> = [];
  const add = (target: RegionTarget | null, kind: "city" | "region") => {
    if (!target) return;
    const key = `${kind}:${target.key}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ ...target, kind });
  };

  const cities = normalizeStringArray(profile.cities);
  const regions = normalizeStringArray(profile.regions);

  for (const city of cities) add(toRegionTarget(city, null), "city");
  if (cities.length === 0) {
    for (const region of regions) add(toRegionTarget(region, null), "region");
  }

  return out;
}

function buildSearchProfileTitle(
  profile: PropstackSearchProfile,
  requestType: "kauf" | "miete",
  classification: PropstackClassification,
  targets: Array<RegionTarget & { kind: "city" | "region" }>,
): string {
  const explicitTitle = firstString([profile.title, profile.query_title, profile.name]);
  if (explicitTitle) return explicitTitle;

  const typeLabel = requestType === "miete" ? "Mietgesuch" : "Kaufgesuch";
  const objectLabel = classification.objectType ? ` ${classification.objectType}` : "";
  const targetLabel = targets.length > 0
    ? ` in ${targets.slice(0, 3).map((target) => target.label).join(", ")}`
    : "";
  return `${typeLabel}${objectLabel}${targetLabel}`.trim();
}

function firstString(values: Array<unknown>): string | null {
  for (const value of values) {
    const asString = String(value ?? "").trim();
    if (asString.length > 0) return asString;
  }
  return null;
}

function normalizePropstackTitle(value: unknown): string | null {
  return normalizePropstackText(value);
}

function normalizePropstackText(value: unknown): string | null {
  if (typeof value === "string") {
    const text = value.trim();
    return text.length > 0 ? text : null;
  }
  if (value && typeof value === "object") {
    const textObject = value as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(textObject, "value")) {
      return firstString([textObject.value]);
    }
    return firstString([textObject.title, textObject.name]);
  }
  return null;
}

function normalizePropstackStatusName(value: unknown): string | null {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized.length > 0 ? normalized : null;
  }
  if (value && typeof value === "object") {
    const statusObject = value as Record<string, unknown>;
    const normalized = firstString([statusObject.name, statusObject.title])?.toLowerCase() ?? null;
    return normalized && normalized.length > 0 ? normalized : null;
  }
  return null;
}

function normalizePropstackStatusId(value: unknown): string | null {
  if (value && typeof value === "object") {
    const statusObject = value as Record<string, unknown>;
    const normalized = firstString([statusObject.id]);
    return normalized && normalized.length > 0 ? normalized : null;
  }
  return null;
}

function formatCountEntries(entries: Array<[string, number]>): string {
  if (!entries.length) return "keine";
  return entries.map(([key, count]) => `${key}:${count}`).join(", ");
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizePropstackNumber(value: unknown): number | null {
  const direct = asNumber(value);
  if (direct !== null) return direct;
  if (value && typeof value === "object") {
    const numberObject = value as Record<string, unknown>;
    return asNumber(numberObject.value) ?? asNumber(numberObject.label);
  }
  return null;
}

function buildNormalizedListingPayload(
  integration: PartnerIntegration,
  unit: PropstackUnit,
): Record<string, unknown> {
  const classification = classifyPropstackUnit(unit);
  const title = normalizePropstackTitle(unit.title);
  const name = normalizePropstackText(unit.name);
  const displayTitle = firstString([title, name]);
  const gallery = normalizeImages(unit.images);
  const galleryAssets = normalizeImageAssets(unit.images);
  const documents = normalizeDocuments(unit.documents);
  const energy = buildEnergySnapshot(unit);
  const details = buildDetailsSnapshot(unit);
  const address = buildAddress(unit);
  const district = buildDistrict(unit);
  const status = getEffectivePropstackStatus(unit);
  const imageUrl = galleryAssets.find((asset) => asset.kind === "image")?.url ?? gallery[0] ?? null;

  return {
    title,
    source_title: displayTitle,
    name,
    external_id: String(unit.id),
    unit_id: unit.unit_id ?? null,
    exposee_id: unit.exposee_id ?? null,
    offer_type: normalizePropstackOfferType(unit),
    usage_type: classification.usageType,
    object_type: classification.objectType,
    legacy_object_type: classification.legacyObjectType,
    marketing_type: unit.marketing_type ?? null,
    commercialization_type: normalizePropstackText(unit.commercialization_type),
    source_object_type: unit.object_type ?? null,
    rs_type: unit.rs_type ?? null,
    source_rs_type: unit.rs_type ?? null,
    rs_category: unit.rs_category ?? null,
    source_rs_category: unit.rs_category ?? null,
    recommended_use_types: Array.isArray(unit.recommended_use_types)
      ? unit.recommended_use_types.map((value) => String(value ?? "").trim()).filter(Boolean)
      : null,
    price: normalizePropstackNumber(unit.price) ?? normalizePropstackNumber(unit.purchase_price),
    rent: normalizePropstackNumber(unit.base_rent) ?? normalizePropstackNumber(unit.rent_net),
    area_sqm: normalizePropstackArea(unit),
    rooms: normalizePropstackNumber(unit.number_of_rooms),
    address,
    short_address: unit.hide_address ? null : firstString([unit.short_address, unit.address]),
    street: unit.street ?? null,
    house_number: unit.house_number ?? null,
    zip_code: unit.zip_code ?? null,
    city: unit.city ?? null,
    district,
    region: unit.region ?? null,
    country: unit.country ?? null,
    hide_address: unit.hide_address ?? null,
    image_url: imageUrl,
    public_expose_url: unit.public_expose_url ?? null,
    detail_url: buildDetailUrl(integration.detail_url_template, unit),
    description: normalizePropstackText(unit.description_note),
    long_description: normalizePropstackText(unit.long_description_note),
    location: normalizePropstackText(unit.location_note),
    features_note: normalizePropstackText(unit.furnishing_note),
    details,
    energy,
    gallery,
    gallery_urls: gallery,
    gallery_assets: galleryAssets,
    documents,
    lat: unit.lat ?? null,
    lng: unit.lng ?? null,
    custom_fields: unit.custom_fields ?? null,
    status: normalizePropstackStatusName(status),
    status_id: normalizePropstackStatusId(status),
    status_raw: status ?? null,
    sub_status: unit.sub_status ?? null,
    archived: unit.archived ?? null,
    property_space_value: normalizePropstackNumber(unit.property_space_value),
    plot_area: normalizePropstackNumber(unit.plot_area),
    living_space: normalizePropstackNumber(unit.living_space),
  };
}

function toRegionTarget(cityRaw: string, districtRaw?: string | null): RegionTarget | null {
  const city = cityRaw.trim();
  const district = String(districtRaw ?? "").trim() || null;
  if (!city) return null;
  const label = district ? `${city} ${district}` : city;
  const key = `${city.toLowerCase()}::${(district ?? "").toLowerCase()}`;
  return { city, district, label, key };
}

function normalizeUnitOffer(
  partnerId: string,
  integration: PartnerIntegration,
  unit: PropstackUnit,
): MappedOffer {
  const raw = buildNormalizedListingPayload(integration, unit);

  return {
    partner_id: partnerId,
    source: "propstack",
    external_id: String(unit.id),
    offer_type: normalizePropstackOfferType(unit),
    object_type: String(raw.legacy_object_type ?? raw.object_type ?? "wohnung"),
    title: typeof raw.source_title === "string" ? raw.source_title : null,
    price: typeof raw.price === "number" ? raw.price : null,
    rent: typeof raw.rent === "number" ? raw.rent : null,
    area_sqm: typeof raw.area_sqm === "number" ? raw.area_sqm : null,
    rooms: typeof raw.rooms === "number" ? raw.rooms : null,
    address: typeof raw.address === "string" ? raw.address : null,
    image_url: typeof raw.image_url === "string" ? raw.image_url : null,
    detail_url: typeof raw.detail_url === "string" ? raw.detail_url : null,
    is_top: false,
    updated_at: unit.updated_at ?? null,
    raw,
    source_payload: unit as unknown as Record<string, unknown>,
  };
}

function mapUnitListing(
  partnerId: string,
  integration: PartnerIntegration,
  unit: PropstackUnit,
): RawListing {
  const normalizedPayload = buildNormalizedListingPayload(integration, unit);
  const listingTitle = firstString([
    normalizedPayload.source_title,
    normalizedPayload.title,
    normalizedPayload.name,
  ]);
  const listingStatus = typeof normalizedPayload.status === "string" ? normalizedPayload.status : null;
  return makeRawRowBase(
    partnerId,
    "propstack",
    String(unit.id),
    listingTitle,
    listingStatus,
    unit.updated_at ?? null,
    normalizedPayload,
    unit as unknown as Record<string, unknown>,
  );
}

function mapUnitReference(
  partnerId: string,
  integration: PartnerIntegration,
  unit: PropstackUnit,
): RawReference {
  const gallery = normalizeImages(unit.images);
  const sourceTitle = firstString([normalizePropstackTitle(unit.title), normalizePropstackText(unit.name)]);
  const sourceDescription =
    normalizePropstackText(unit.long_description_note) ?? normalizePropstackText(unit.description_note);
  const city = String(unit.city ?? "").trim();
  const district = buildDistrict(unit);
  const locationLabel = district ? `${city} ${district}` : city || "der Region";
  const status = getEffectivePropstackStatus(unit);
  const normalizedPayload: Record<string, unknown> = {
    title: sourceTitle,
    source_title: sourceTitle,
    transaction_result: null,
    city: city || null,
    district,
    region: unit.region ?? null,
    location_scope: district ? "stadtteil" : "stadt",
    location: locationLabel,
    offer_type: normalizePropstackOfferType(unit),
    object_type: normalizeObjectType(unit),
    area_sqm: normalizePropstackArea(unit),
    rooms: normalizePropstackNumber(unit.number_of_rooms),
    reference_text_seed: sourceDescription,
    description: sourceDescription,
    image_url: gallery[0] ?? null,
    status: normalizePropstackStatusName(status),
    status_id: normalizePropstackStatusId(status),
    status_raw: status ?? null,
    sub_status: unit.sub_status ?? null,
    exposee_id: unit.exposee_id ?? null,
  };
  return makeRawRowBase(
    partnerId,
    "propstack",
    `reference:${String(unit.id)}`,
    sourceTitle,
    normalizePropstackStatusName(status),
    unit.updated_at ?? null,
    normalizedPayload,
    unit as unknown as Record<string, unknown>,
  );
}

function mapSearchProfileRequest(
  partnerId: string,
  profile: PropstackSearchProfile,
): RawRequest {
  const cities = normalizeStringArray(profile.cities);
  const regions = normalizeStringArray(profile.regions);
  const rsTypes = normalizeStringArray(profile.rs_types);
  const rsCategories = normalizeStringArray(profile.rs_categories);
  const recommendedUseTypes = normalizeStringArray(profile.recommended_use_types);
  const targets = buildSearchProfileRegionTargets(profile);
  const classification = classifyPropstackSearchProfile(profile);
  const requestType = requestTypeFromProfile(profile);
  const minRooms = normalizeSearchProfileRoomsMin(profile);
  const maxRooms = normalizeSearchProfileRoomsMax(profile);
  const minBudget = normalizeSearchProfileBudgetMin(profile);
  const maxBudget = normalizeSearchProfileBudgetMax(profile);
  const minLivingArea = asNumber(profile.living_space);
  const maxLivingArea = asNumber(profile.living_space_to);
  const minPlotArea = asNumber(profile.plot_area);
  const maxPlotArea = asNumber(profile.plot_area_to);
  const minBedrooms = asNumber(profile.number_of_bedrooms) ?? asNumber(profile.number_of_bed_rooms);
  const maxBedrooms = asNumber(profile.number_of_bedrooms_to) ?? asNumber(profile.number_of_bed_rooms_to);
  const city = firstString([profile.city, cities[0]]);
  const region = firstString([profile.region, regions[0]]);
  const title = buildSearchProfileTitle(profile, requestType, classification, targets);
  const normalizedPayload: Record<string, unknown> = {
    title,
    request_type: requestType,
    usage_type: classification.usageType,
    object_type: classification.objectType,
    legacy_object_type: classification.legacyObjectType,
    object_type_detail: firstString([rsCategories[0], rsTypes[0], profile.category])?.toLowerCase() ?? null,
    min_rooms: minRooms,
    max_rooms: maxRooms,
    min_price: minBudget,
    max_price: maxBudget,
    min_living_area_sqm: minLivingArea,
    max_living_area_sqm: maxLivingArea,
    min_plot_area_sqm: minPlotArea,
    max_plot_area_sqm: maxPlotArea,
    min_bedrooms: minBedrooms,
    max_bedrooms: maxBedrooms,
    city,
    region,
    region_targets: targets.map((target) => ({
      city: target.city,
      district: target.district,
      label: target.label,
      kind: target.kind,
    })),
    region_target_keys: targets.map((target) => target.key),
    search_locations: [
      ...cities.map((entry) => ({ kind: "city", label: entry })),
      ...regions.map((entry) => ({ kind: "region", label: entry })),
    ],
    cities,
    regions,
    client_id: profile.client_id ?? null,
    status: profile.status ?? null,
    active: profile.active ?? null,
    note: profile.note ?? null,
    lat: asNumber(profile.lat),
    lng: asNumber(profile.lng),
    radius_m: asNumber(profile.radius),
    rs_types: rsTypes,
    rs_categories: rsCategories,
    recommended_use_types: recommendedUseTypes,
    property_status_ids: normalizeSearchProfileIdArray(profile.property_status_ids),
    location_ids: normalizeSearchProfileIdArray(profile.location_ids),
    group_ids: normalizeSearchProfileIdArray(profile.group_ids),
    floor_from: asNumber(profile.floor),
    floor_to: asNumber(profile.floor_to),
    construction_year_from: asNumber(profile.construction_year),
    construction_year_to: asNumber(profile.construction_year_to),
    condition: profile.condition ?? null,
    lift: normalizeSearchProfileBoolean(profile.lift),
    balcony: normalizeSearchProfileBoolean(profile.balcony),
    garden: normalizeSearchProfileBoolean(profile.garden),
    built_in_kitchen: normalizeSearchProfileBoolean(profile.built_in_kitchen),
    cellar: normalizeSearchProfileBoolean(profile.cellar),
    rented: normalizeSearchProfileBoolean(profile.rented),
    short_term_constructible: normalizeSearchProfileBoolean(profile.short_term_constructible),
    building_permission: normalizeSearchProfileBoolean(profile.building_permission),
    preliminary_enquiry: normalizeSearchProfileBoolean(profile.preliminary_enquiry),
    site_development_type: profile.site_development_type ?? null,
  };
  return makeRawRowBase(
    partnerId,
    "propstack",
    `request:${String(profile.id ?? "")}`,
    title,
    String(profile.status ?? "").trim() || null,
    profile.updated_at ?? null,
    normalizedPayload,
    profile as unknown as Record<string, unknown>,
  );
}

function buildDummyReferences(partnerId: string, provider: "propstack"): RawReference[] {
  const now = toIsoNow();
  const rows = [
    {
      external_id: "reference_dummy:propstack:001",
      title: "Erfolgreich verkauft in Leipzig Connewitz",
      transaction_result: "verkauft",
      city: "Leipzig",
      district: "Connewitz",
      object_type: "wohnung",
      offer_type: "kauf",
      rooms: 3,
      area_sqm: 86,
      image_url: "https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=80",
      reference_text_seed: "Helle Eigentumswohnung mit Balkon in gefragter Stadtteillage.",
    },
    {
      external_id: "reference_dummy:propstack:002",
      title: "Erfolgreich vermietet in Dresden Neustadt",
      transaction_result: "vermietet",
      city: "Dresden",
      district: "Neustadt",
      object_type: "wohnung",
      offer_type: "miete",
      rooms: 2,
      area_sqm: 64,
      image_url: "https://images.unsplash.com/photo-1460317442991-0ec209397118?auto=format&fit=crop&w=1200&q=80",
      reference_text_seed: "Modernisierte Altbauwohnung mit schneller Vermittlung.",
    },
    {
      external_id: "reference_dummy:propstack:003",
      title: "Erfolgreich verkauft in Hamburg Eimsbuettel",
      transaction_result: "verkauft",
      city: "Hamburg",
      district: "Eimsbuettel",
      object_type: "haus",
      offer_type: "kauf",
      rooms: 5,
      area_sqm: 148,
      image_url: "https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?auto=format&fit=crop&w=1200&q=80",
      reference_text_seed: "Familienhaus in gefragter Wohnlage mit hohem Besichtigungsinteresse.",
    },
  ];

  return rows.map((row) =>
    makeRawRowBase(
      partnerId,
      provider,
      row.external_id,
      row.title,
      row.transaction_result,
      now,
      {
        title: row.title,
        transaction_result: row.transaction_result,
        city: row.city,
        district: row.district,
        location_scope: "stadtteil",
        location: `${row.city} ${row.district}`,
        object_type: row.object_type,
        offer_type: row.offer_type,
        rooms: row.rooms,
        area_sqm: row.area_sqm,
        image_url: row.image_url,
        reference_text_seed: row.reference_text_seed,
        description: row.reference_text_seed,
        source_mode: "dummy_seed",
      },
      {
        provider,
        source_mode: "dummy_seed",
      },
    ),
  );
}

function buildDummyRequests(partnerId: string, provider: "propstack"): RawRequest[] {
  const now = toIsoNow();
  const rows = [
    {
      external_id: "request_dummy:propstack:001",
      title: "Familie sucht 3-Zimmer-Wohnung in Dresden Pieschen, Neustadt oder Trachau",
      request_type: "miete",
      object_type: "wohnung",
      min_rooms: 3,
      max_price: 1450,
      targets: [
        { city: "Dresden", district: "Pieschen" },
        { city: "Dresden", district: "Neustadt" },
        { city: "Dresden", district: "Trachau" },
      ],
    },
    {
      external_id: "request_dummy:propstack:002",
      title: "Kapitalanleger sucht ETW in Leipzig Suedvorstadt oder Plagwitz",
      request_type: "kauf",
      object_type: "wohnung",
      min_rooms: 2,
      max_price: 360000,
      targets: [
        { city: "Leipzig", district: "Suedvorstadt" },
        { city: "Leipzig", district: "Plagwitz" },
      ],
    },
    {
      external_id: "request_dummy:propstack:003",
      title: "Paar sucht Reihenhaus in Hamburg Rahlstedt oder Volksdorf",
      request_type: "kauf",
      object_type: "haus",
      min_rooms: 4,
      max_price: 780000,
      targets: [
        { city: "Hamburg", district: "Rahlstedt" },
        { city: "Hamburg", district: "Volksdorf" },
      ],
    },
  ];

  return rows.map((row) => {
    const regionTargets = row.targets
      .map((target) => toRegionTarget(target.city, target.district))
      .filter((target): target is RegionTarget => Boolean(target));
    return makeRawRowBase(
      partnerId,
      provider,
      row.external_id,
      row.title,
      null,
      now,
      {
        title: row.title,
        request_type: row.request_type,
        object_type: row.object_type,
        min_rooms: row.min_rooms,
        max_price: row.max_price,
        region_targets: regionTargets.map((target) => ({
          city: target.city,
          district: target.district,
          label: target.label,
        })),
        region_target_keys: regionTargets.map((target) => target.key),
        source_mode: "dummy_seed",
      },
      {
        provider,
        source_mode: "dummy_seed",
      },
    );
  });
}

export async function fetchPropstackUnits(
  integration: PartnerIntegration,
  apiKey: string,
  options?: {
    maxPages?: number;
    perPage?: number;
    targetItemCount?: number;
  },
): Promise<PropstackUnit[]> {
  const result = await fetchPropstackUnitsDetailed(integration, apiKey, options);
  return result.items;
}

async function fetchPropstackUnitsDetailed(
  integration: PartnerIntegration,
  apiKey: string,
  options?: {
    maxPages?: number;
    perPage?: number;
    targetItemCount?: number;
    endpointPath?: string;
    archived?: -1 | 0 | 1 | null;
    statusId?: string | null;
  },
): Promise<PropstackFetchBatchResult<PropstackUnit>> {
  const base = integration.base_url?.trim() || "https://api.propstack.de/v1";
  const units: PropstackUnit[] = [];
  const requestedPerPage = Math.max(1, Math.min(100, options?.perPage ?? 25));
  const requestedMaxPages = Math.max(1, Math.min(100, options?.maxPages ?? 25));
  const requestedTargetItemCount = readBoundedInteger(
    options?.targetItemCount,
    requestedPerPage * requestedMaxPages,
    1,
    5000,
  );
  const perPage = Math.max(1, Math.min(20, requestedPerPage, requestedTargetItemCount));
  const targetItemCount = requestedTargetItemCount;
  const endpointPath = String(options?.endpointPath ?? "/units").trim() || "/units";
  let page = 1;
  let requestsMade = 0;
  let pagesFetched = 0;

  while (units.length < targetItemCount) {
    const url = new URL(`${base.replace(/\/+$/, "")}${endpointPath.startsWith("/") ? endpointPath : `/${endpointPath}`}`);
    url.searchParams.set("with_meta", "1");
    url.searchParams.set("expand", "1");
    url.searchParams.set("page", String(page));
    url.searchParams.set("per_page", String(perPage));
    if (options?.archived !== null && options?.archived !== undefined) {
      url.searchParams.set("archived", String(options.archived));
    }
    if (options?.statusId) {
      url.searchParams.set("status", options.statusId);
    }

    const res = await fetchWithTimeout(url.toString(), {
      headers: {
        "X-API-KEY": apiKey,
      },
    });
    requestsMade += 1;

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Propstack units fetch failed (${res.status}): ${body}`);
    }

    const json = await res.json();
    const batch = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : [];

    if (!Array.isArray(batch) || batch.length === 0) break;

    const remaining = targetItemCount - units.length;
    units.push(...(batch as PropstackUnit[]).slice(0, remaining));
    pagesFetched += 1;

    if (batch.length < perPage) break;
    page += 1;
  }

  return {
    items: units,
    requestsMade,
    pagesFetched,
  };
}

async function fetchPropstackReferenceUnitsDetailed(
  integration: PartnerIntegration,
  apiKey: string,
  cfg: PropstackResourceSettings,
  limits: PropstackGuardedResourceLimits,
): Promise<PropstackFetchBatchResult<PropstackUnit>> {
  const statusIds = cfg.references_status_ids?.length ? cfg.references_status_ids : [null];
  const deduped = new Map<string, PropstackUnit>();
  let requestsMade = 0;
  let pagesFetched = 0;

  for (const statusId of statusIds) {
    const remainingTarget = limits.targetObjects - deduped.size;
    if (remainingTarget <= 0) break;
    const result = await fetchPropstackUnitsDetailed(integration, apiKey, {
      maxPages: Math.max(1, Math.ceil(remainingTarget / Math.max(1, Math.min(20, limits.perPage)))),
      perPage: Math.min(limits.perPage, remainingTarget),
      targetItemCount: remainingTarget,
      endpointPath: cfg.references_endpoint_path,
      archived: cfg.references_archived,
      statusId,
    });
    requestsMade += result.requestsMade;
    pagesFetched += result.pagesFetched;
    for (const unit of result.items) {
      const key = String(unit.id ?? "").trim();
      if (!key) continue;
      if (!deduped.has(key)) deduped.set(key, unit);
    }
  }

  return {
    items: Array.from(deduped.values()),
    requestsMade,
    pagesFetched,
  };
}

async function fetchPropstackListingUnitsDetailed(
  integration: PartnerIntegration,
  apiKey: string,
  cfg: PropstackResourceSettings,
  limits: PropstackGuardedResourceLimits,
): Promise<PropstackFetchBatchResult<PropstackUnit>> {
  const statusIds = cfg.listings_status_ids?.length ? cfg.listings_status_ids : [null];
  const deduped = new Map<string, PropstackUnit>();
  let requestsMade = 0;
  let pagesFetched = 0;

  for (const statusId of statusIds) {
    const remainingTarget = limits.targetObjects - deduped.size;
    if (remainingTarget <= 0) break;
    const result = await fetchPropstackUnitsDetailed(integration, apiKey, {
      maxPages: Math.max(1, Math.ceil(remainingTarget / Math.max(1, Math.min(20, limits.perPage)))),
      perPage: Math.min(limits.perPage, remainingTarget),
      targetItemCount: remainingTarget,
      archived: 0,
      statusId,
    });
    requestsMade += result.requestsMade;
    pagesFetched += result.pagesFetched;
    for (const unit of result.items) {
      const key = String(unit.id ?? "").trim();
      if (!key) continue;
      if (!deduped.has(key)) deduped.set(key, unit);
    }
  }

  return {
    items: Array.from(deduped.values()),
    requestsMade,
    pagesFetched,
  };
}

export async function fetchPropstackSearchProfiles(
  integration: PartnerIntegration,
  apiKey: string,
  options?: {
    maxPages?: number;
    perPage?: number;
  },
): Promise<PropstackSearchProfile[]> {
  const result = await fetchPropstackSearchProfilesDetailed(integration, apiKey, options);
  return result.items;
}

async function fetchPropstackSearchProfilesDetailed(
  integration: PartnerIntegration,
  apiKey: string,
  options?: {
    maxPages?: number;
    perPage?: number;
  },
): Promise<PropstackFetchBatchResult<PropstackSearchProfile>> {
  const base = integration.base_url?.trim() || "https://api.propstack.de/v1";
  const out: PropstackSearchProfile[] = [];
  const perPage = Math.max(1, Math.min(100, options?.perPage ?? 50));
  const maxPages = Math.max(1, Math.min(20, options?.maxPages ?? 20));
  let page = 1;
  let requestsMade = 0;
  let pagesFetched = 0;

  while (page <= maxPages) {
    const url = new URL(`${base.replace(/\/+$/, "")}/saved_queries`);
    url.searchParams.set("page", String(page));
    url.searchParams.set("per", String(perPage));

    const res = await fetchWithTimeout(url.toString(), {
      headers: {
        "X-API-KEY": apiKey,
      },
    });
    requestsMade += 1;

    if (res.status === 404 || res.status === 405) {
      return {
        items: [],
        requestsMade,
        pagesFetched,
      };
    }
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Propstack saved_queries fetch failed (${res.status}): ${body}`);
    }

    const json = await res.json();
    const batch = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : [];
    if (!Array.isArray(batch) || batch.length === 0) break;
    out.push(...(batch as PropstackSearchProfile[]));
    pagesFetched += 1;
    if (batch.length < perPage) break;
    page += 1;
  }

  return {
    items: out,
    requestsMade,
    pagesFetched,
  };
}

async function fetchPropstackPropertyStatusesDetailed(
  integration: PartnerIntegration,
  apiKey: string,
): Promise<PropstackFetchBatchResult<PropstackPropertyStatus>> {
  const base = integration.base_url?.trim() || "https://api.propstack.de/v1";
  const url = new URL(`${base.replace(/\/+$/, "")}/property_statuses`);
  const res = await fetchWithTimeout(url.toString(), {
    headers: {
      "X-API-KEY": apiKey,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Propstack property_statuses fetch failed (${res.status}): ${body}`);
  }

  const json = await res.json();
  const items = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : [];
  return {
    items: Array.isArray(items) ? (items as PropstackPropertyStatus[]) : [],
    requestsMade: 1,
    pagesFetched: Array.isArray(items) && items.length > 0 ? 1 : 0,
  };
}

export async function syncPropstackResources(
  integration: PartnerIntegration,
  apiKey: string,
): Promise<ResourceSyncData & { offers: MappedOffer[] }> {
  const cfg = toSettings(integration.settings);
  const guardedLimits = getPropstackGuardedLimits(integration.settings);
  const notes: string[] = [];
  const partialSyncMode = true;
  let providerRequestCount = 0;
  let providerPagesFetched = 0;
  const providerBreakdown: Record<string, { requests: number; pages_fetched: number }> = {};

  const unitsResult = cfg.listings_status_ids?.length
    ? await fetchPropstackListingUnitsDetailed(integration, apiKey, cfg, guardedLimits.units)
    : await fetchPropstackUnitsDetailed(integration, apiKey, {
        maxPages: guardedLimits.units.maxPages,
        perPage: guardedLimits.units.perPage,
        archived: 0,
      });
  providerRequestCount += unitsResult.requestsMade;
  providerPagesFetched += unitsResult.pagesFetched;
  providerBreakdown.units = {
    requests: unitsResult.requestsMade,
    pages_fetched: unitsResult.pagesFetched,
  };
  const units = unitsResult.items;
  const offers = units.map((unit) => normalizeUnitOffer(integration.partner_id, integration, unit));
  const listings = units.map((unit) => mapUnitListing(integration.partner_id, integration, unit));

  let propertyStatuses: PropstackPropertyStatus[] = [];
  try {
    const statusesResult = await fetchPropstackPropertyStatusesDetailed(integration, apiKey);
    providerRequestCount += statusesResult.requestsMade;
    providerPagesFetched += statusesResult.pagesFetched;
    providerBreakdown.property_statuses = {
      requests: statusesResult.requestsMade,
      pages_fetched: statusesResult.pagesFetched,
    };
    propertyStatuses = statusesResult.items;
    notes.push(`propstack property_statuses loaded: ${propertyStatuses.length}`);
  } catch (error) {
    notes.push(`propstack property_statuses fetch failed: ${error instanceof Error ? error.message : "unknown"}`);
  }

  const knownReferenceStatusNames: Set<string> = new Set(
    propertyStatuses
      .map((status) => normalizePropstackStatusName(status))
      .filter((statusName) => statusName === "verkauft" || statusName === "vermietet" || statusName === "sold" || statusName === "rented"),
  );

  let referenceUnits: PropstackUnit[] = [];
  try {
    const referenceUnitsResult = await fetchPropstackReferenceUnitsDetailed(
      integration,
      apiKey,
      cfg,
      guardedLimits.references,
    );
    providerRequestCount += referenceUnitsResult.requestsMade;
    providerPagesFetched += referenceUnitsResult.pagesFetched;
    providerBreakdown.reference_units = {
      requests: referenceUnitsResult.requestsMade,
      pages_fetched: referenceUnitsResult.pagesFetched,
    };
    referenceUnits = referenceUnitsResult.items;
    notes.push(
      `guarded sync: propstack references target_objects=${guardedLimits.references.targetObjects} via ${cfg.references_endpoint_path} with archived=${cfg.references_archived}${cfg.references_status_ids?.length ? `, status_ids=${cfg.references_status_ids.join(",")}` : ""}`,
    );
  } catch (error) {
    notes.push(`propstack reference fetch failed: ${error instanceof Error ? error.message : "unknown"}`);
  }

  const fallbackReferenceCandidates = units.filter((unit) => {
    if (includeAsReference(unit, cfg)) return true;
    const statusName = normalizePropstackStatusName(getEffectivePropstackStatus(unit));
    return Boolean(statusName && knownReferenceStatusNames.has(statusName));
  });
  const effectiveReferenceUnits = referenceUnits.length > 0 ? referenceUnits : fallbackReferenceCandidates;
  const references = effectiveReferenceUnits.map((unit) =>
    mapUnitReference(integration.partner_id, integration, unit),
  );
  const unitStatusCounts = new Map<string, number>();
  const archivedCounts = new Map<string, number>([
    ["true", 0],
    ["false", 0],
    ["null", 0],
  ]);
  for (const unit of units) {
    const statusName = normalizePropstackStatusName(getEffectivePropstackStatus(unit)) ?? "unbekannt";
    unitStatusCounts.set(statusName, (unitStatusCounts.get(statusName) ?? 0) + 1);
    const archivedKey = unit.archived === true ? "true" : unit.archived === false ? "false" : "null";
    archivedCounts.set(archivedKey, (archivedCounts.get(archivedKey) ?? 0) + 1);
  }
  notes.push(
    `reference diagnostics: units=${units.length} · matched=${effectiveReferenceUnits.length} · status=${formatCountEntries(Array.from(unitStatusCounts.entries()).sort((left, right) => right[1] - left[1]))} · archived=${formatCountEntries(Array.from(archivedCounts.entries()))}`,
  );
  if (knownReferenceStatusNames.size > 0) {
    notes.push(`reference diagnostics: recognized completion statuses=${Array.from(knownReferenceStatusNames).sort().join(", ")}`);
  }
  notes.push(
    `guarded sync: propstack units target_objects=${guardedLimits.units.targetObjects}${cfg.listings_status_ids?.length ? `, status_ids=${cfg.listings_status_ids.join(",")}` : ", archived=0"}`,
  );
  const referencesFetched = true;
  let requestsFetched = false;
  let requests: RawRequest[] = [];
  const referencesSource: "live" | "unavailable" = "live";
  let requestsSource: "live" | "unavailable" = "unavailable";

  try {
    const profilesResult = await fetchPropstackSearchProfilesDetailed(integration, apiKey, {
      maxPages: guardedLimits.savedQueries.maxPages,
      perPage: guardedLimits.savedQueries.perPage,
    });
    providerRequestCount += profilesResult.requestsMade;
    providerPagesFetched += profilesResult.pagesFetched;
    providerBreakdown.saved_queries = {
      requests: profilesResult.requestsMade,
      pages_fetched: profilesResult.pagesFetched,
    };
    requests = profilesResult.items
      .filter((p) => p.active !== false)
      .map((p) => mapSearchProfileRequest(integration.partner_id, p));
    requestsFetched = true;
    requestsSource = "live";
    notes.push(
      `guarded sync: propstack saved_queries target_objects=${guardedLimits.savedQueries.targetObjects}`,
    );
  } catch (error) {
    requestsSource = "unavailable";
    notes.push(`propstack saved_queries live fetch failed: ${error instanceof Error ? error.message : "unknown"}`);
  }

  const finalReferences = references;
  const finalRequests = requests;
  if (!finalReferences.length) {
    notes.push("propstack guarded sync found no reference units via dedicated fetch or fallback heuristics");
  }
  if (!finalRequests.length) {
    if (requestsSource === "unavailable") {
      requestsFetched = false;
      notes.push("guarded test sync: propstack saved_queries unavailable, no dummy fallback written");
    } else {
      requestsFetched = true;
      notes.push("guarded test sync: no saved_queries found on the fetched page");
    }
  }

  return {
    offers,
    listings,
    references: finalReferences,
    requests: finalRequests,
    referencesFetched,
    requestsFetched,
    notes,
    diagnostics: {
      provider_request_count: providerRequestCount,
      provider_pages_fetched: providerPagesFetched,
      provider_breakdown: providerBreakdown,
      guarded_limits: {
        units: {
          target_objects: guardedLimits.units.targetObjects,
          max_pages: guardedLimits.units.maxPages,
          per_page: guardedLimits.units.perPage,
        },
        references: {
          target_objects: guardedLimits.references.targetObjects,
          max_pages: guardedLimits.references.maxPages,
          per_page: guardedLimits.references.perPage,
        },
        saved_queries: {
          target_objects: guardedLimits.savedQueries.targetObjects,
          max_pages: guardedLimits.savedQueries.maxPages,
          per_page: guardedLimits.savedQueries.perPage,
        },
      },
      partial_sync_mode: partialSyncMode,
      stale_deactivation_allowed: false,
      references_source: referencesSource,
      requests_source: requestsSource,
    },
  };
}

export function mapPropstackUnit(
  partnerId: string,
  integration: PartnerIntegration,
  unit: PropstackUnit,
): MappedOffer {
  return normalizeUnitOffer(partnerId, integration, unit);
}
