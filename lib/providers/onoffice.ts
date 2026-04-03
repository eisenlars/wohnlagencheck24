import { createHmac } from "node:crypto";

import type {
  CrmSyncResource,
  OfferDetailsSnapshot,
  OfferEnergySnapshot,
  MappedOffer,
  PartnerIntegration,
  RawListing,
  RawReference,
  RawRequest,
  ResourceSyncData,
} from "@/lib/providers/types";

type OnOfficeRecord = {
  id?: number | string;
  type?: string;
  elements?: Record<string, unknown>;
};

type OnOfficeResponse = {
  response?: {
    results?: Array<{
      status?: {
        errorcode?: number;
        message?: string;
      };
      data?: {
        records?: OnOfficeRecord[];
      };
    }>;
  };
};

const ACTION_READ = "urn:onoffice-de-ns:smart:2.5:smartml:action:read";
const ACTION_GET = "urn:onoffice-de-ns:smart:2.5:smartml:action:get";
const RESOURCE_ESTATE = "estate";
const RESOURCE_SEARCH_CRITERIA = "searchcriteria";
const RESOURCE_FIELDS = "fields";
const HMAC_VERSION = 2;
const PROVIDER_FETCH_TIMEOUT_MS = 12000;

export type OnOfficeFieldOption = {
  value: string;
  label: string;
};

export type OnOfficeEstateStatusFieldConfig = {
  field_key: string | null;
  field_label: string | null;
  options: OnOfficeFieldOption[];
  has_reference_status_candidates: boolean;
};

type OnOfficeResourceSettings = {
  listing_status_field_key: string;
  listing_active_status_values: string[];
  listing_exclude_sold: boolean;
};

type RegionTarget = {
  city: string;
  district: string | null;
  label: string;
  key: string;
};

function buildOnOfficeHmacV2(
  args: { timestamp: string; token: string; resourceType: string; actionId: string },
  secret: string,
): string {
  const payload = `${args.timestamp}${args.token}${args.resourceType}${args.actionId}`;
  return createHmac("sha256", secret).update(payload).digest("base64");
}

function buildOnOfficeReadRequest(
  token: string,
  secret: string,
  resourceType: string,
  parameters: Record<string, unknown>,
) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const hmac = buildOnOfficeHmacV2(
    { timestamp, token, resourceType, actionId: ACTION_READ },
    secret,
  );
  return {
    token,
    request: {
      actions: [
        {
          actionid: ACTION_READ,
          resourceid: "",
          resourcetype: resourceType,
          timestamp,
          hmac,
          hmac_version: HMAC_VERSION,
          parameters,
        },
      ],
    },
  };
}

function buildOnOfficeGetRequest(
  token: string,
  secret: string,
  resourceType: string,
  parameters: Record<string, unknown>,
) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const hmac = buildOnOfficeHmacV2(
    { timestamp, token, resourceType, actionId: ACTION_GET },
    secret,
  );
  return {
    token,
    request: {
      actions: [
        {
          actionid: ACTION_GET,
          resourceid: "",
          resourcetype: resourceType,
          timestamp,
          hmac,
          hmac_version: HMAC_VERSION,
          parameters,
        },
      ],
    },
  };
}

function toSettings(settings: Record<string, unknown> | null): OnOfficeResourceSettings {
  const resourceFilters = (settings?.resource_filters ?? {}) as Record<string, unknown>;
  const listingsCfg = (resourceFilters.listings ?? {}) as Record<string, unknown>;
  const referencesCfg = (resourceFilters.references ?? {}) as Record<string, unknown>;
  const listingStatusFieldKey =
    String(listingsCfg.status_field_key ?? referencesCfg.status_field_key ?? "status2").trim() || "status2";
  const listingActiveStatusValues = Array.isArray(listingsCfg.active_status_values)
    ? listingsCfg.active_status_values
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)
    : [];
  const listingExcludeSold = listingsCfg.exclude_sold === true;
  return {
    listing_status_field_key: listingStatusFieldKey,
    listing_active_status_values: Array.from(new Set(listingActiveStatusValues)),
    listing_exclude_sold: listingExcludeSold,
  };
}

function normalizeOfferType(value?: string | null): "kauf" | "miete" {
  const v = String(value ?? "").toLowerCase();
  if (v === "miete" || v === "rent") return "miete";
  return "kauf";
}

function normalizeObjectType(value?: string | null): "wohnung" | "haus" {
  const v = String(value ?? "").toLowerCase();
  if (v.includes("haus")) return "haus";
  return "wohnung";
}

function buildAddress(elements: Record<string, unknown>): string | null {
  const parts = [
    String(elements["strasse"] ?? "").trim(),
    String(elements["hausnummer"] ?? "").trim(),
    String(elements["plz"] ?? "").trim(),
    String(elements["ort"] ?? "").trim(),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : null;
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
      if (tokens.length >= 2) add(toRegionTarget(tokens[0], tokens.slice(1).join(" ")));
      else {
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

function buildDetailUrl(template: string | null, elements: Record<string, unknown>): string | null {
  if (!template) return null;
  const exposeeId = elements["objektnr_extern"] ?? "";
  const id = elements["Id"] ?? elements["id"] ?? "";
  return template.replace("{exposee_id}", String(exposeeId)).replace("{id}", String(id));
}

function extractImages(elements: Record<string, unknown>): string[] {
  const rawImg = elements["img"];
  if (!rawImg) return [];
  if (Array.isArray(rawImg)) {
    return rawImg
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const url = (item as Record<string, unknown>).url;
        return typeof url === "string" ? url : null;
      })
      .filter((url): url is string => typeof url === "string" && url.length > 0);
  }
  if (typeof rawImg === "object") {
    const url = (rawImg as Record<string, unknown>).url;
    return typeof url === "string" ? [url] : [];
  }
  return [];
}

function toIsoNow(): string {
  return new Date().toISOString();
}

function normalizeEnergyValueKind(certificateType: string | null | undefined): "bedarf" | "verbrauch" | null {
  const normalized = String(certificateType ?? "").trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.includes("bedarf")) return "bedarf";
  if (normalized.includes("verbrauch")) return "verbrauch";
  return null;
}

function buildEnergySnapshot(elements: Record<string, unknown>): OfferEnergySnapshot {
  const certificateType = String(elements["energiepass_art"] ?? "").trim() || null;
  const value = toNumber(elements["energieverbrauchkennwert"]);
  const constructionYear = toNumber(elements["baujahr"]);
  return {
    certificate_type: certificateType,
    value,
    value_kind: normalizeEnergyValueKind(certificateType),
    construction_year: constructionYear,
    heating_energy_source: null,
    efficiency_class: null,
    certificate_availability: null,
    certificate_start_date: null,
    certificate_end_date: null,
    warm_water_included: null,
    demand: value,
    year: constructionYear,
  };
}

function buildDetailsSnapshot(elements: Record<string, unknown>): OfferDetailsSnapshot {
  return {
    living_area_sqm: toNumber(elements["wohnflaeche"]),
    usable_area_sqm: null,
    plot_area_sqm: null,
    rooms: toNumber(elements["anzahl_zimmer"]),
    bedrooms: null,
    bathrooms: null,
    floor: null,
    construction_year: toNumber(elements["baujahr"]),
    condition: null,
    availability: null,
    parking: null,
    balcony: null,
    terrace: null,
    garden: null,
    elevator: null,
    address_hidden: null,
  };
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
      throw new Error(`onOffice request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function getOnOfficeApiBaseUrl(integration: PartnerIntegration): string {
  return integration.base_url?.trim() || "https://api.onoffice.de/api/stable/api.php";
}

function normalizeFieldOptionValue(input: unknown): string | null {
  if (input === null || input === undefined) return null;
  const value = String(input).trim();
  return value.length > 0 ? value : null;
}

function normalizeFieldOptionLabel(input: unknown, fallback: string): string {
  const value = String(input ?? "").trim();
  return value.length > 0 ? value : fallback;
}

function extractPermittedValues(raw: unknown): OnOfficeFieldOption[] {
  if (!raw) return [];

  const pushOption = (
    acc: OnOfficeFieldOption[],
    seen: Set<string>,
    valueRaw: unknown,
    labelRaw: unknown,
  ) => {
    const value = normalizeFieldOptionValue(valueRaw);
    if (!value || seen.has(value)) return;
    seen.add(value);
    acc.push({
      value,
      label: normalizeFieldOptionLabel(labelRaw, value),
    });
  };

  const out: OnOfficeFieldOption[] = [];
  const seen = new Set<string>();

  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (entry && typeof entry === "object") {
        const rec = entry as Record<string, unknown>;
        pushOption(out, seen, rec.value ?? rec.id ?? rec.key, rec.label ?? rec.name ?? rec.text ?? rec.value);
      } else {
        pushOption(out, seen, entry, entry);
      }
    }
    return out;
  }

  if (typeof raw === "object") {
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (value && typeof value === "object") {
        const rec = value as Record<string, unknown>;
        pushOption(out, seen, rec.value ?? rec.id ?? key, rec.label ?? rec.name ?? rec.text ?? key);
      } else {
        pushOption(out, seen, key, value);
      }
    }
  }

  return out;
}

function makeRawRowBase(
  partnerId: string,
  provider: "onoffice",
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

function mapEstateToOffer(
  partnerId: string,
  integration: PartnerIntegration,
  record: OnOfficeRecord,
): MappedOffer {
  const elements = (record.elements ?? {}) as Record<string, unknown>;
  const gallery = extractImages(elements);
  const address = buildAddress(elements);
  const rent = toNumber(elements["warmmiete"]) ?? toNumber(elements["kaltmiete"]);
  const details = buildDetailsSnapshot(elements);
  const energy = buildEnergySnapshot(elements);
  const sourceUpdatedAt = String(elements["geaendert_am"] ?? "").trim() || null;

  return {
    partner_id: partnerId,
    source: "onoffice",
    external_id: String(elements["Id"] ?? record.id ?? ""),
    offer_type: normalizeOfferType(String(elements["vermarktungsart"] ?? "")),
    object_type: normalizeObjectType(String(elements["objektart"] ?? "")),
    title: String(elements["objekttitel"] ?? ""),
    price: toNumber(elements["kaufpreis"]),
    rent,
    area_sqm: toNumber(elements["wohnflaeche"]),
    rooms: toNumber(elements["anzahl_zimmer"]),
    address,
    image_url: gallery[0] ?? null,
    detail_url: buildDetailUrl(integration.detail_url_template, elements),
    is_top: false,
    updated_at: sourceUpdatedAt,
    raw: {
      exposee_id: elements["objektnr_extern"] ?? null,
      description: elements["freitext_lage"] ?? null,
      features_note: elements["freitext_ausstattung"] ?? null,
      details,
      energy,
      gallery,
      lat: elements["breitengrad"] ?? null,
      lng: elements["laengengrad"] ?? null,
      geaendert_am: elements["geaendert_am"] ?? null,
      status: elements["status"] ?? null,
      status2: elements["status2"] ?? null,
      verkauft: elements["verkauft"] ?? null,
      reserviert: elements["reserviert"] ?? null,
      veroeffentlichen: elements["veroeffentlichen"] ?? null,
      objektstatus: elements["objektstatus"] ?? null,
    },
    source_payload: record as unknown as Record<string, unknown>,
  };
}

function mapEstateToReference(
  partnerId: string,
  integration: PartnerIntegration,
  record: OnOfficeRecord,
): RawReference {
  const elements = (record.elements ?? {}) as Record<string, unknown>;
  const gallery = extractImages(elements);
  const city = String(elements["ort"] ?? "").trim();
  const saleType = normalizeOfferType(String(elements["vermarktungsart"] ?? "")) === "miete" ? "vermietet" : "verkauft";
  const locationLabel = city || "der Region";
  const referenceTitle = `Erfolgreich ${saleType} in ${locationLabel}`;
  const sourceUpdatedAt = String(elements["geaendert_am"] ?? "").trim() || null;
  const normalizedPayload: Record<string, unknown> = {
    title: referenceTitle,
    source_title: String(elements["objekttitel"] ?? "") || null,
    transaction_result: saleType,
    city: city || null,
    district: null,
    location_scope: "stadt",
    location: locationLabel,
    offer_type: normalizeOfferType(String(elements["vermarktungsart"] ?? "")),
    object_type: normalizeObjectType(String(elements["objektart"] ?? "")),
    area_sqm: toNumber(elements["wohnflaeche"]),
    rooms: toNumber(elements["anzahl_zimmer"]),
    reference_text_seed: `Das Objekt wurde erfolgreich ${saleType}.`,
    description: `Das Objekt wurde erfolgreich ${saleType}.`,
    image_url: gallery[0] ?? null,
    geaendert_am: elements["geaendert_am"] ?? null,
    status: elements["status"] ?? null,
    status2: elements["status2"] ?? null,
    verkauft: elements["verkauft"] ?? null,
    reserviert: elements["reserviert"] ?? null,
    veroeffentlichen: elements["veroeffentlichen"] ?? null,
    objektstatus: elements["objektstatus"] ?? null,
  };
  return makeRawRowBase(
    partnerId,
    "onoffice",
    `reference:${String(elements["Id"] ?? record.id ?? "")}`,
    referenceTitle,
    sourceUpdatedAt,
    normalizedPayload,
    record as unknown as Record<string, unknown>,
  );
}

function mapSearchCriteriaToRequest(partnerId: string, record: OnOfficeRecord): RawRequest {
  const elements = (record.elements ?? {}) as Record<string, unknown>;
  const requestType = String(elements["vermarktungsart"] ?? elements["request_type"] ?? "").toLowerCase();
  const targets = parseRegionTargetsFromHint(elements["regionaler_zusatz"], elements["ort"] as string | null | undefined);
  const normalizedPayload: Record<string, unknown> = {
    title: String(elements["bezeichnung"] ?? elements["titel"] ?? "") || null,
    request_type: requestType.includes("miete") ? "miete" : "kauf",
    object_type: String(elements["objektart"] ?? "").toLowerCase() || null,
    min_rooms: toNumber(elements["anzahl_zimmer_ab"]),
    max_price: toNumber(elements["range_kaufpreis_bis"] ?? elements["range_miete_bis"]),
    region: String(elements["regionaler_zusatz"] ?? "") || null,
    region_targets: targets.map((target) => ({
      city: target.city,
      district: target.district,
      label: target.label,
    })),
    region_target_keys: targets.map((target) => target.key),
    parentaddress: elements["parentaddress"] ?? null,
    active: elements["active"] ?? null,
  };
  return makeRawRowBase(
    partnerId,
    "onoffice",
    `request:${String(record.id ?? elements["id"] ?? "")}`,
    normalizedPayload.title as string | null,
    null,
    normalizedPayload,
    record as unknown as Record<string, unknown>,
  );
}

async function fetchOnOfficeResource(
  integration: PartnerIntegration,
  token: string,
  secret: string,
  resourceId: string,
  fields: string[],
  filter: Record<string, unknown>,
): Promise<OnOfficeRecord[]> {
  const base = getOnOfficeApiBaseUrl(integration);
  const allRecords: OnOfficeRecord[] = [];
  const listlimit = 50;
  let listoffset = 0;

  while (true) {
    const body = buildOnOfficeReadRequest(token, secret, resourceId, {
      data: fields,
      listlimit,
      listoffset,
      filter,
    });

    const res = await fetchWithTimeout(base, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`onOffice ${resourceId} fetch failed (${res.status}): ${text}`);
    }

    const json = (await res.json()) as OnOfficeResponse;
    const actionStatus = json?.response?.results?.[0]?.status;
    const actionErrorCode = Number(actionStatus?.errorcode ?? 0);
    if (actionErrorCode !== 0) {
      throw new Error(
        `onOffice ${resourceId} action failed (${actionErrorCode}): ${String(actionStatus?.message ?? "Unbekannter Fehler")}`,
      );
    }
    const records = json?.response?.results?.[0]?.data?.records ?? [];
    if (!Array.isArray(records) || records.length === 0) break;
    allRecords.push(...records);
    if (records.length < listlimit) break;
    listoffset += listlimit;
  }

  return allRecords;
}

export async function fetchOnOfficeEstateStatusOptions(
  integration: PartnerIntegration,
  token: string,
  secret: string,
): Promise<OnOfficeFieldOption[]> {
  const config = await fetchOnOfficeEstateStatusFieldConfig(integration, token, secret);
  return config.options;
}

function hasReferenceStatusCandidates(options: OnOfficeFieldOption[]): boolean {
  return options.some((option) =>
    /(verkauf|verkauft|vermiet|sold|rented|rent)/i.test(`${option.value} ${option.label}`),
  );
}

export async function fetchOnOfficeEstateStatusFieldConfig(
  integration: PartnerIntegration,
  token: string,
  secret: string,
): Promise<OnOfficeEstateStatusFieldConfig> {
  const base = getOnOfficeApiBaseUrl(integration);
  const body = buildOnOfficeGetRequest(token, secret, RESOURCE_FIELDS, {
    modules: ["estate"],
    labels: true,
  });

  const res = await fetchWithTimeout(base, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`onOffice fields fetch failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as OnOfficeResponse;
  const records = json?.response?.results?.[0]?.data?.records ?? [];
  if (!Array.isArray(records) || records.length === 0) {
    return {
      field_key: null,
      field_label: null,
      options: [],
      has_reference_status_candidates: false,
    };
  }

  const moduleRecord = records.find((record) => String(record.id ?? "").trim().toLowerCase() === "estate") ?? records[0];
  const moduleElements = (moduleRecord?.elements ?? {}) as Record<string, unknown>;
  const candidates: Array<{ fieldKey: string; fieldLabel: string | null; options: OnOfficeFieldOption[]; priority: number }> = [];

  for (const [fieldKey, value] of Object.entries(moduleElements)) {
    if (!value || typeof value !== "object") continue;
    const field = value as Record<string, unknown>;
    const fieldType = String(field.type ?? "").trim().toLowerCase();
    if (fieldType !== "singleselect") continue;

    const fieldLabel = String(field.label ?? "").trim() || null;
    const options = extractPermittedValues(
      field.permittedvalues
      ?? field.permitted_values
      ?? field.options
      ?? field.values,
    );
    if (options.length === 0) continue;

    const normalizedKey = fieldKey.trim().toLowerCase();
    const normalizedLabel = String(fieldLabel ?? "").trim().toLowerCase();
    const priority =
      normalizedKey === "objektstatus" ? 100
        : normalizedKey === "status2" ? 90
          : normalizedKey === "status" ? 80
            : normalizedLabel === "status" ? 70
              : normalizedKey.includes("status") || normalizedLabel.includes("status") ? 60
                : 0;
    if (priority === 0) continue;

    candidates.push({ fieldKey, fieldLabel, options, priority });
  }

  const selected = candidates.sort((left, right) => right.priority - left.priority)[0];
  if (!selected) {
    return {
      field_key: null,
      field_label: null,
      options: [],
      has_reference_status_candidates: false,
    };
  }

  return {
    field_key: selected.fieldKey,
    field_label: selected.fieldLabel,
    options: selected.options,
    has_reference_status_candidates: hasReferenceStatusCandidates(selected.options),
  };
}

export async function fetchOnOfficeEstates(
  integration: PartnerIntegration,
  token: string,
  secret: string,
  settings: OnOfficeResourceSettings,
): Promise<OnOfficeRecord[]> {
  const fields = [
    "Id",
    "geaendert_am",
    "objekttitel",
    "objektnr_extern",
    "vermarktungsart",
    "objektart",
    "status",
    "status2",
    "verkauft",
    "reserviert",
    "veroeffentlichen",
    "kaufpreis",
    "kaltmiete",
    "warmmiete",
    "wohnflaeche",
    "anzahl_zimmer",
    "plz",
    "ort",
    "strasse",
    "hausnummer",
    "baujahr",
  ];
  const records = await fetchOnOfficeResource(integration, token, secret, RESOURCE_ESTATE, fields, {
    status: [{ op: "=", val: 1 }],
    ...(settings.listing_exclude_sold ? { verkauft: [{ op: "=", val: 0 }] } : {}),
  });
  const allowedStatusValues = new Set(settings.listing_active_status_values);
  if (!settings.listing_status_field_key || allowedStatusValues.size === 0) return records;
  return records.filter((record) => {
    const elements = (record.elements ?? {}) as Record<string, unknown>;
    const fieldValue = String(elements[settings.listing_status_field_key] ?? "").trim();
    return fieldValue.length > 0 && allowedStatusValues.has(fieldValue);
  });
}

function summarizeEstateFieldValues(
  records: OnOfficeRecord[],
  fieldKey: string,
  limit = 10,
): string {
  const values = Array.from(
    new Set(
      records
        .map((record) => String(((record.elements ?? {}) as Record<string, unknown>)[fieldKey] ?? "").trim())
        .filter(Boolean),
    ),
  );
  if (values.length === 0) return "keine";
  return values.slice(0, limit).join(", ");
}

export async function fetchOnOfficeReferences(
  integration: PartnerIntegration,
  token: string,
  secret: string,
): Promise<OnOfficeRecord[]> {
  const fields = [
    "Id",
    "geaendert_am",
    "objekttitel",
    "objektnr_extern",
    "vermarktungsart",
    "objektart",
    "status",
    "status2",
    "verkauft",
    "reserviert",
    "veroeffentlichen",
    "objektstatus",
    "kaufpreis",
    "kaltmiete",
    "warmmiete",
    "wohnflaeche",
    "anzahl_zimmer",
    "plz",
    "ort",
    "strasse",
    "hausnummer",
    "img",
  ];
  return fetchOnOfficeResource(integration, token, secret, RESOURCE_ESTATE, fields, {
    verkauft: [{ op: "=", val: 1 }],
  });
}

export async function fetchOnOfficeSearchCriteria(
  integration: PartnerIntegration,
  token: string,
  secret: string,
): Promise<OnOfficeRecord[]> {
  const fields = [
    "id",
    "bezeichnung",
    "titel",
    "active",
    "parentaddress",
    "objektart",
    "vermarktungsart",
    "request_type",
    "anzahl_zimmer_ab",
    "range_kaufpreis_bis",
    "range_miete_bis",
    "regionaler_zusatz",
  ];
  return fetchOnOfficeResource(integration, token, secret, RESOURCE_SEARCH_CRITERIA, fields, {
    active: [{ op: "=", val: 1 }],
  });
}

export async function syncOnOfficeResources(
  integration: PartnerIntegration,
  token: string,
  secret: string,
  options?: { resource?: CrmSyncResource },
): Promise<ResourceSyncData & { offers: MappedOffer[] }> {
  const resource = options?.resource ?? "all";
  const cfg = toSettings(integration.settings);
  const notes: string[] = [];
  const shouldFetchOffers = resource === "all" || resource === "offers";
  const shouldFetchReferences = resource === "all" || resource === "references";
  const shouldFetchRequests = resource === "all" || resource === "requests";

  let offers: MappedOffer[] = [];
  let listings: RawListing[] = [];
  let references: RawReference[] = [];
  let requests: RawRequest[] = [];
  let referencesFetched = !shouldFetchReferences;
  let requestsFetched = !shouldFetchRequests;

  if (shouldFetchOffers) {
    const estates = await fetchOnOfficeEstates(integration, token, secret, cfg);
    notes.push(`onOffice estate diagnostic: ${estates.length} Datensätze ungefiltert geladen.`);
    notes.push(`onOffice estate status-Werte: ${summarizeEstateFieldValues(estates, "status")}`);
    notes.push(`onOffice estate ${cfg.listing_status_field_key}-Werte: ${summarizeEstateFieldValues(estates, cfg.listing_status_field_key)}`);
    notes.push(`onOffice estate verkauft-Werte: ${summarizeEstateFieldValues(estates, "verkauft")}`);
    notes.push(`onOffice estate reserviert-Werte: ${summarizeEstateFieldValues(estates, "reserviert")}`);
    notes.push(`onOffice estate veroeffentlichen-Werte: ${summarizeEstateFieldValues(estates, "veroeffentlichen")}`);
    offers = estates.map((record) => mapEstateToOffer(integration.partner_id, integration, record));
    listings = offers.map((offer) =>
      makeRawRowBase(
        offer.partner_id,
        "onoffice",
        offer.external_id,
        offer.title,
        offer.updated_at,
        offer.raw,
        offer.source_payload,
      ),
    );
  }

  if (shouldFetchReferences) {
    const referenceRecords = await fetchOnOfficeReferences(integration, token, secret);
    references = referenceRecords.map((record) => mapEstateToReference(integration.partner_id, integration, record));
    referencesFetched = true;
  }

  if (shouldFetchRequests) {
    const criteria = await fetchOnOfficeSearchCriteria(integration, token, secret);
    requests = criteria.map((record) => mapSearchCriteriaToRequest(integration.partner_id, record));
    requestsFetched = true;
  }

  return {
    offers,
    listings,
    references,
    requests,
    referencesFetched,
    requestsFetched,
    notes,
  };
}

export function mapOnOfficeEstate(
  partnerId: string,
  integration: PartnerIntegration,
  record: OnOfficeRecord,
): MappedOffer {
  return mapEstateToOffer(partnerId, integration, record);
}
