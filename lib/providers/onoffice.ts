import { createHmac } from "node:crypto";

import type {
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
      data?: {
        records?: OnOfficeRecord[];
      };
    }>;
  };
};

const ACTION_READ = "urn:onoffice-de-ns:smart:2.5:smartml:action:read";
const RESOURCE_ESTATE = "estate";
const RESOURCE_SEARCH_CRITERIA = "searchcriteria";
const HMAC_VERSION = 2;
const PROVIDER_FETCH_TIMEOUT_MS = 12000;

type OnOfficeResourceSettings = {
  sold_status_id: number;
  rented_status_id: number;
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

function toSettings(settings: Record<string, unknown> | null): OnOfficeResourceSettings {
  const resourceFilters = (settings?.resource_filters ?? {}) as Record<string, unknown>;
  const referencesCfg = (resourceFilters.references ?? {}) as Record<string, unknown>;
  const soldRaw = Number(referencesCfg.sold_status_id ?? 5);
  const rentedRaw = Number(referencesCfg.rented_status_id ?? 6);
  return {
    sold_status_id: Number.isFinite(soldRaw) ? soldRaw : 5,
    rented_status_id: Number.isFinite(rentedRaw) ? rentedRaw : 6,
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
    updated_at: null,
    raw: {
      exposee_id: elements["objektnr_extern"] ?? null,
      description: elements["freitext_lage"] ?? null,
      features_note: elements["freitext_ausstattung"] ?? null,
      details,
      energy,
      gallery,
      lat: elements["breitengrad"] ?? null,
      lng: elements["laengengrad"] ?? null,
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
    objektstatus: elements["objektstatus"] ?? null,
  };
  return makeRawRowBase(
    partnerId,
    "onoffice",
    `reference:${String(elements["Id"] ?? record.id ?? "")}`,
    referenceTitle,
    null,
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

function buildDummyReferences(partnerId: string, provider: "onoffice"): RawReference[] {
  const now = toIsoNow();
  const rows = [
    {
      external_id: "reference_dummy:onoffice:001",
      title: "Erfolgreich verkauft in Leipzig Connewitz",
      transaction_result: "verkauft",
      city: "Leipzig",
      district: "Connewitz",
      object_type: "wohnung",
      offer_type: "kauf",
      rooms: 3,
      area_sqm: 82,
      image_url: "https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=80",
      reference_text_seed: "Charmante Eigentumswohnung mit sehr schneller Vermarktungsdauer.",
    },
    {
      external_id: "reference_dummy:onoffice:002",
      title: "Erfolgreich vermietet in Dresden Neustadt",
      transaction_result: "vermietet",
      city: "Dresden",
      district: "Neustadt",
      object_type: "wohnung",
      offer_type: "miete",
      rooms: 2,
      area_sqm: 58,
      image_url: "https://images.unsplash.com/photo-1460317442991-0ec209397118?auto=format&fit=crop&w=1200&q=80",
      reference_text_seed: "Modernisierte Wohnung mit hoher Nachfrage und kurzer Leerstandszeit.",
    },
    {
      external_id: "reference_dummy:onoffice:003",
      title: "Erfolgreich verkauft in Hamburg Eimsbuettel",
      transaction_result: "verkauft",
      city: "Hamburg",
      district: "Eimsbuettel",
      object_type: "haus",
      offer_type: "kauf",
      rooms: 5,
      area_sqm: 154,
      image_url: "https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?auto=format&fit=crop&w=1200&q=80",
      reference_text_seed: "Familienhaus mit sehr guter Resonanz im Bieterverfahren.",
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

function buildDummyRequests(partnerId: string, provider: "onoffice"): RawRequest[] {
  const now = toIsoNow();
  const rows = [
    {
      external_id: "request_dummy:onoffice:001",
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
      external_id: "request_dummy:onoffice:002",
      title: "Kapitalanleger sucht ETW in Leipzig Suedvorstadt oder Plagwitz",
      request_type: "kauf",
      object_type: "wohnung",
      min_rooms: 2,
      max_price: 340000,
      targets: [
        { city: "Leipzig", district: "Suedvorstadt" },
        { city: "Leipzig", district: "Plagwitz" },
      ],
    },
    {
      external_id: "request_dummy:onoffice:003",
      title: "Paar sucht Reihenhaus in Hamburg Rahlstedt oder Volksdorf",
      request_type: "kauf",
      object_type: "haus",
      min_rooms: 4,
      max_price: 760000,
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

async function fetchOnOfficeResource(
  integration: PartnerIntegration,
  token: string,
  secret: string,
  resourceId: string,
  fields: string[],
  filter: Record<string, unknown>,
): Promise<OnOfficeRecord[]> {
  const base = integration.base_url?.trim() || "https://api.onoffice.de/api/stable/api.php";
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
    const records = json?.response?.results?.[0]?.data?.records ?? [];
    if (!Array.isArray(records) || records.length === 0) break;
    allRecords.push(...records);
    if (records.length < listlimit) break;
    listoffset += listlimit;
  }

  return allRecords;
}

export async function fetchOnOfficeEstates(
  integration: PartnerIntegration,
  token: string,
  secret: string,
): Promise<OnOfficeRecord[]> {
  const fields = [
    "Id",
    "objekttitel",
    "objektnr_extern",
    "vermarktungsart",
    "objektart",
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
    "baujahr",
    "energiepass_art",
    "energieverbrauchkennwert",
    "freitext_lage",
    "freitext_ausstattung",
    "img",
  ];
  return fetchOnOfficeResource(integration, token, secret, RESOURCE_ESTATE, fields, {
    status: [{ op: "=", val: 1 }],
  });
}

export async function fetchOnOfficeReferences(
  integration: PartnerIntegration,
  token: string,
  secret: string,
  settings: OnOfficeResourceSettings,
): Promise<OnOfficeRecord[]> {
  const fields = [
    "Id",
    "objekttitel",
    "objektnr_extern",
    "vermarktungsart",
    "objektart",
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
    objektstatus: [
      { op: "=", val: settings.sold_status_id },
      { op: "=", val: settings.rented_status_id },
    ],
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
): Promise<ResourceSyncData & { offers: MappedOffer[] }> {
  const cfg = toSettings(integration.settings);
  const notes: string[] = [];

  const estates = await fetchOnOfficeEstates(integration, token, secret);
  const offers = estates.map((record) => mapEstateToOffer(integration.partner_id, integration, record));
  const listings = offers.map((offer) =>
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

  let references: RawReference[] = [];
  let requests: RawRequest[] = [];
  let referencesFetched = false;
  let requestsFetched = false;

  try {
    const referenceRecords = await fetchOnOfficeReferences(integration, token, secret, cfg);
    references = referenceRecords.map((record) => mapEstateToReference(integration.partner_id, integration, record));
    referencesFetched = true;
  } catch (error) {
    notes.push(`onoffice references live fetch failed: ${error instanceof Error ? error.message : "unknown"}`);
  }

  try {
    const criteria = await fetchOnOfficeSearchCriteria(integration, token, secret);
    requests = criteria.map((record) => mapSearchCriteriaToRequest(integration.partner_id, record));
    requestsFetched = true;
  } catch (error) {
    notes.push(`onoffice searchcriteria live fetch failed: ${error instanceof Error ? error.message : "unknown"}`);
  }

  if (!references.length) {
    references = buildDummyReferences(integration.partner_id, "onoffice");
    referencesFetched = false;
    notes.push("onoffice references fallback: realistic dummy seed");
  }
  if (!requests.length) {
    requests = buildDummyRequests(integration.partner_id, "onoffice");
    requestsFetched = false;
    notes.push("onoffice requests fallback: realistic dummy seed");
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
