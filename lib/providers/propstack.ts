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
  title?: string;
  position?: number;
  is_floorplan?: boolean | null;
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
  rs_type?: string | null;
  title?: string | { label?: unknown; value?: unknown } | null;
  description_note?: string | null;
  location_note?: string | null;
  furnishing_note?: string | null;
  street?: string | null;
  house_number?: string | null;
  zip_code?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  lat?: number | null;
  lng?: number | null;
  hide_address?: boolean | null;
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
  floor?: number | string | { label?: unknown; value?: unknown } | null;
  condition?: string | { label?: unknown; value?: unknown } | null;
  number_of_bed_rooms?: number | string | { label?: unknown; value?: unknown } | null;
  number_of_bath_rooms?: number | string | { label?: unknown; value?: unknown } | null;
  parking_space_type?: string | { label?: unknown; value?: unknown } | null;
  parking_space_types?: string[] | { label?: unknown; value?: unknown } | null;
  balcony?: boolean | { label?: unknown; value?: unknown } | null;
  terrace?: boolean | { label?: unknown; value?: unknown } | null;
  garden?: boolean | { label?: unknown; value?: unknown } | null;
  custom_fields?: Record<string, unknown> | null;
  updated_at?: string | null;
  images?: PropstackImage[] | null;
  documents?: PropstackDocument[] | null;
  status?: string | { id?: number | string | null; name?: unknown; title?: unknown } | null;
  sub_status?: string | null;
  archived?: boolean | null;
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
  title?: string | null;
  name?: string | null;
  query_title?: string | null;
  status?: string | null;
  active?: boolean | null;
  request_type?: string | null;
  marketing_type?: string | null;
  category?: string | null;
  rs_types?: string[] | null;
  min_rooms?: number | null;
  number_of_rooms?: number | null;
  number_of_rooms_from?: number | null;
  max_price?: number | null;
  price_to?: number | null;
  city?: string | null;
  cities?: string[] | null;
  region?: string | null;
  regions?: string[] | null;
  updated_at?: string | null;
  client_id?: number | string | null;
};

type PropstackResourceSettings = {
  references_statuses?: string[];
  references_sub_statuses?: string[];
  references_custom_field_key?: string;
};

type RegionTarget = {
  city: string;
  district: string | null;
  label: string;
  key: string;
};

const PROVIDER_FETCH_TIMEOUT_MS = 12000;

type PropstackFetchBatchResult<T> = {
  items: T[];
  requestsMade: number;
  pagesFetched: number;
};

function toSettings(settings: Record<string, unknown> | null): PropstackResourceSettings {
  const resourceFilters = (settings?.resource_filters ?? {}) as Record<string, unknown>;
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

  return {
    references_statuses: toStringArray(statusesRaw) ?? ["archived", "verkauft", "vermietet", "sold", "rented"],
    references_sub_statuses: toStringArray(subStatusesRaw) ?? ["sold", "rented"],
    references_custom_field_key: String(referencesCfg.custom_field_key ?? "referenz_webseite").trim(),
  };
}

function normalizeOfferType(marketingType?: string | null): "kauf" | "miete" {
  if (!marketingType) return "kauf";
  const value = marketingType.toUpperCase();
  if (value === "RENT" || value === "LET" || value === "MIETE") return "miete";
  return "kauf";
}

function normalizeObjectType(rsType?: string | null): "haus" | "wohnung" {
  if (!rsType) return "wohnung";
  const value = rsType.toUpperCase();
  if (value.includes("HOUSE") || value.includes("HAUS")) return "haus";
  return "wohnung";
}

function buildAddress(unit: PropstackUnit): string | null {
  if (unit.hide_address) return null;
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
  const exposeeId = unit.exposee_id ?? "";
  const id = unit.id ?? "";
  return template.replace("{exposee_id}", String(exposeeId)).replace("{id}", String(id));
}

function normalizeImages(images?: PropstackImage[] | null): string[] {
  if (!Array.isArray(images)) return [];
  return images
    .map((img) => img.url)
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
    .map((img) => {
      const url = typeof img?.url === "string" ? img.url.trim() : "";
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
    availability: null,
    parking: normalizePropstackTitle(unit.parking_space_type)
      ?? (Array.isArray(unit.parking_space_types) ? unit.parking_space_types.filter((entry) => typeof entry === "string").join(", ") || null : normalizePropstackTitle(unit.parking_space_types)),
    balcony: asBoolean(unit.balcony),
    terrace: asBoolean(unit.terrace),
    garden: asBoolean(unit.garden),
    elevator: null,
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
    status: null,
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
  const statusName = normalizePropstackStatusName(unit.status);
  const statusId = normalizePropstackStatusId(unit.status);
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

function firstString(values: Array<unknown>): string | null {
  for (const value of values) {
    const asString = String(value ?? "").trim();
    if (asString.length > 0) return asString;
  }
  return null;
}

function normalizePropstackTitle(value: unknown): string | null {
  if (typeof value === "string") {
    const title = value.trim();
    return title.length > 0 ? title : null;
  }
  if (value && typeof value === "object") {
    const titleObject = value as Record<string, unknown>;
    return firstString([titleObject.value, titleObject.label]);
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

function toRegionTarget(cityRaw: string, districtRaw?: string | null): RegionTarget | null {
  const city = cityRaw.trim();
  const district = String(districtRaw ?? "").trim() || null;
  if (!city) return null;
  const label = district ? `${city} ${district}` : city;
  const key = `${city.toLowerCase()}::${(district ?? "").toLowerCase()}`;
  return { city, district, label, key };
}

function parseRegionTargetsFromHint(hint: unknown, fallbackCity?: string | null): RegionTarget[] {
  const raw = String(hint ?? "").trim();
  const out: RegionTarget[] = [];
  const seen = new Set<string>();

  const add = (target: RegionTarget | null) => {
    if (!target) return;
    if (seen.has(target.key)) return;
    seen.add(target.key);
    out.push(target);
  };

  if (raw) {
    const normalized = raw
      .replace(/\boder\b/gi, ",")
      .replace(/\bund\b/gi, ",")
      .replace(/\//g, ",")
      .replace(/\s{2,}/g, " ");
    const parts = normalized
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    for (const part of parts) {
      const tokens = part.split(/\s+/).filter(Boolean);
      if (tokens.length >= 2) {
        add(toRegionTarget(tokens[0], tokens.slice(1).join(" ")));
      } else {
        const fallback = String(fallbackCity ?? "").trim();
        if (fallback && fallback.toLowerCase() !== part.toLowerCase()) add(toRegionTarget(fallback, part));
        else add(toRegionTarget(part, null));
      }
    }
  }

  const fallback = String(fallbackCity ?? "").trim();
  if (out.length === 0 && fallback) add(toRegionTarget(fallback, null));
  return out;
}

function normalizeUnitOffer(
  partnerId: string,
  integration: PartnerIntegration,
  unit: PropstackUnit,
): MappedOffer {
  const gallery = normalizeImages(unit.images);
  const galleryAssets = normalizeImageAssets(unit.images);
  const documents = normalizeDocuments(unit.documents);
  const address = buildAddress(unit);
  const title = normalizePropstackTitle(unit.title);
  const primaryImage = galleryAssets.find((asset) => asset.kind === "image")?.url ?? gallery[0] ?? null;
  const energy = buildEnergySnapshot(unit);
  const details = buildDetailsSnapshot(unit);

  return {
    partner_id: partnerId,
    source: "propstack",
    external_id: String(unit.id),
    offer_type: normalizeOfferType(unit.marketing_type),
    object_type: normalizeObjectType(unit.rs_type),
    title,
    price: normalizePropstackNumber(unit.purchase_price),
    rent: normalizePropstackNumber(unit.rent_net),
    area_sqm: normalizePropstackNumber(unit.living_space),
    rooms: normalizePropstackNumber(unit.number_of_rooms),
    address,
    image_url: primaryImage,
    detail_url: buildDetailUrl(integration.detail_url_template, unit),
    is_top: false,
    updated_at: unit.updated_at ?? null,
    raw: {
      exposee_id: unit.exposee_id ?? null,
      description: unit.description_note ?? null,
      location: unit.location_note ?? null,
      features_note: unit.furnishing_note ?? null,
      street: unit.street ?? null,
      house_number: unit.house_number ?? null,
      zip_code: unit.zip_code ?? null,
      city: unit.city ?? null,
      hide_address: unit.hide_address ?? null,
      details,
      energy,
      gallery,
      gallery_urls: gallery,
      gallery_assets: galleryAssets,
      documents,
      lat: unit.lat ?? null,
      lng: unit.lng ?? null,
      custom_fields: unit.custom_fields ?? null,
      region: unit.region ?? null,
      country: unit.country ?? null,
      status: unit.status ?? null,
      sub_status: unit.sub_status ?? null,
    },
    source_payload: unit as unknown as Record<string, unknown>,
  };
}

function mapUnitReference(
  partnerId: string,
  integration: PartnerIntegration,
  unit: PropstackUnit,
): RawReference {
  const gallery = normalizeImages(unit.images);
  const sourceTitle = normalizePropstackTitle(unit.title);
  const city = String(unit.city ?? "").trim();
  const district = String(unit.region ?? "").trim() || null;
  const saleType = normalizeOfferType(unit.marketing_type) === "miete" ? "vermietet" : "verkauft";
  const locationLabel = district ? `${city} ${district}` : city || "der Region";
  const referenceTitle = `Erfolgreich ${saleType} in ${locationLabel}`;
  const normalizedPayload: Record<string, unknown> = {
    title: referenceTitle,
    source_title: sourceTitle,
    transaction_result: saleType,
    city: city || null,
    district,
    location_scope: district ? "stadtteil" : "stadt",
    location: locationLabel,
    offer_type: normalizeOfferType(unit.marketing_type),
    object_type: normalizeObjectType(unit.rs_type),
    area_sqm: normalizePropstackNumber(unit.living_space),
    rooms: normalizePropstackNumber(unit.number_of_rooms),
    reference_text_seed: `Das Objekt wurde erfolgreich ${saleType}.`,
    description: `Das Objekt wurde erfolgreich ${saleType}.`,
    image_url: gallery[0] ?? null,
    status: unit.status ?? null,
    sub_status: unit.sub_status ?? null,
    exposee_id: unit.exposee_id ?? null,
  };
  return makeRawRowBase(
    partnerId,
    "propstack",
    `reference:${String(unit.id)}`,
    referenceTitle,
    unit.updated_at ?? null,
    normalizedPayload,
    unit as unknown as Record<string, unknown>,
  );
}

function mapSearchProfileRequest(
  partnerId: string,
  profile: PropstackSearchProfile,
): RawRequest {
  const city = firstString([profile.city, profile.cities?.[0]]);
  const region = firstString([profile.region, profile.regions?.[0]]);
  const regionHint = [
    ...(Array.isArray(profile.cities) ? profile.cities : []),
    ...(Array.isArray(profile.regions) ? profile.regions : []),
    profile.region ?? "",
  ]
    .map((v) => String(v ?? "").trim())
    .filter(Boolean)
    .join(", ");
  const targets = parseRegionTargetsFromHint(regionHint || region, city);
  const objectType = firstString([
    profile.category,
    Array.isArray(profile.rs_types) ? profile.rs_types[0] : null,
  ]);
  const minRooms = asNumber(profile.min_rooms) ?? asNumber(profile.number_of_rooms) ?? asNumber(profile.number_of_rooms_from);
  const maxPrice = asNumber(profile.max_price) ?? asNumber(profile.price_to);
  const title = firstString([profile.title, profile.query_title, profile.name]) ?? `Gesuch ${String(profile.id ?? "")}`.trim();
  const normalizedPayload: Record<string, unknown> = {
    title,
    request_type: requestTypeFromProfile(profile),
    object_type: objectType ? objectType.toLowerCase() : null,
    min_rooms: minRooms,
    max_price: maxPrice,
    city,
    region,
    region_targets: targets.map((target) => ({
      city: target.city,
      district: target.district,
      label: target.label,
    })),
    region_target_keys: targets.map((target) => target.key),
    client_id: profile.client_id ?? null,
    status: profile.status ?? null,
    active: profile.active ?? null,
  };
  return makeRawRowBase(
    partnerId,
    "propstack",
    `request:${String(profile.id ?? "")}`,
    title,
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
  },
): Promise<PropstackFetchBatchResult<PropstackUnit>> {
  const base = integration.base_url?.trim() || "https://api.propstack.de/v1";
  const units: PropstackUnit[] = [];
  const perPage = Math.max(1, Math.min(100, options?.perPage ?? 25));
  const maxPages = Math.max(1, Math.min(100, options?.maxPages ?? 25));
  let page = 1;
  let requestsMade = 0;
  let pagesFetched = 0;

  while (page <= maxPages) {
    const url = new URL(`${base.replace(/\/+$/, "")}/units`);
    url.searchParams.set("with_meta", "1");
    url.searchParams.set("expand", "1");
    url.searchParams.set("page", String(page));
    url.searchParams.set("per", String(perPage));

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

    units.push(...(batch as PropstackUnit[]));
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
  const notes: string[] = [];
  const partialSyncMode = true;
  let providerRequestCount = 0;
  let providerPagesFetched = 0;
  const providerBreakdown: Record<string, { requests: number; pages_fetched: number }> = {};

  const unitsResult = await fetchPropstackUnitsDetailed(integration, apiKey, { maxPages: 1, perPage: 10 });
  providerRequestCount += unitsResult.requestsMade;
  providerPagesFetched += unitsResult.pagesFetched;
  providerBreakdown.units = {
    requests: unitsResult.requestsMade,
    pages_fetched: unitsResult.pagesFetched,
  };
  const units = unitsResult.items;
  const offers = units.map((unit) => normalizeUnitOffer(integration.partner_id, integration, unit));
  const listings = offers.map((offer) =>
    makeRawRowBase(
      offer.partner_id,
      "propstack",
      offer.external_id,
      offer.title,
      offer.updated_at,
      offer.raw,
      offer.source_payload,
    ),
  );

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
  const referenceCandidates = units.filter((unit) => {
    if (includeAsReference(unit, cfg)) return true;
    const statusName = normalizePropstackStatusName(unit.status);
    return Boolean(statusName && knownReferenceStatusNames.has(statusName));
  });
  const references = referenceCandidates.map((unit) =>
    mapUnitReference(integration.partner_id, integration, unit),
  );
  const unitStatusCounts = new Map<string, number>();
  const archivedCounts = new Map<string, number>([
    ["true", 0],
    ["false", 0],
    ["null", 0],
  ]);
  for (const unit of units) {
    const statusName = normalizePropstackStatusName(unit.status) ?? "unbekannt";
    unitStatusCounts.set(statusName, (unitStatusCounts.get(statusName) ?? 0) + 1);
    const archivedKey = unit.archived === true ? "true" : unit.archived === false ? "false" : "null";
    archivedCounts.set(archivedKey, (archivedCounts.get(archivedKey) ?? 0) + 1);
  }
  notes.push(
    `reference diagnostics: units=${units.length} · matched=${referenceCandidates.length} · status=${formatCountEntries(Array.from(unitStatusCounts.entries()).sort((left, right) => right[1] - left[1]))} · archived=${formatCountEntries(Array.from(archivedCounts.entries()))}`,
  );
  if (knownReferenceStatusNames.size > 0) {
    notes.push(`reference diagnostics: recognized completion statuses=${Array.from(knownReferenceStatusNames).sort().join(", ")}`);
  }
  notes.push("guarded test sync: propstack units limited to first page for write-path validation");
  const referencesFetched = true;
  let requestsFetched = false;
  let requests: RawRequest[] = [];
  const referencesSource: "live" | "unavailable" = "live";
  let requestsSource: "live" | "unavailable" = "unavailable";

  try {
    const profilesResult = await fetchPropstackSearchProfilesDetailed(integration, apiKey, { maxPages: 1, perPage: 50 });
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
    notes.push("guarded test sync: propstack saved_queries limited to first page");
  } catch (error) {
    requestsSource = "unavailable";
    notes.push(`propstack saved_queries live fetch failed: ${error instanceof Error ? error.message : "unknown"}`);
  }

  const finalReferences = references;
  const finalRequests = requests;
  if (!finalReferences.length) {
    notes.push("propstack guarded sync found no reference units on the fetched page");
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
