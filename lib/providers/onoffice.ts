import { createHmac } from "node:crypto";

import type {
  CrmSyncResource,
  CrmSyncTrigger,
  OfferDetailsSnapshot,
  OfferEnergySnapshot,
  MappedOffer,
  PartnerIntegration,
  RawListing,
  RawReference,
  RawRequest,
  ResourceSyncData,
} from "@/lib/providers/types";
import { cleanRequestRegionTargetLabel, isRadiusContextSegment } from "@/lib/request-region-targets";

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
const RESOURCE_SEARCH_CRITERIAS = "searchcriterias";
const RESOURCE_SEARCH_CRITERIA_FIELDS = "searchCriteriaFields";
const RESOURCE_FIELDS = "fields";
const HMAC_VERSION = 2;
const PROVIDER_FETCH_TIMEOUT_MS = 12000;

export type OnOfficeFieldOption = {
  value: string;
  label: string;
};

type OnOfficeEstateFieldDefinition = {
  key: string;
  label: string | null;
  type: string | null;
  permittedValues: OnOfficeFieldOption[];
};

type OnOfficeEstateFieldCatalog = {
  fields: OnOfficeEstateFieldDefinition[];
};

type OnOfficeSearchCriteriaRecord = Record<string, unknown> & {
  id?: number | string;
  _meta?: Record<string, unknown>;
};

type OnOfficeSearchCriteriaFieldDefinition = {
  key: string;
  label: string | null;
  type: string | null;
  rangeField: boolean;
  permittedValues: OnOfficeFieldOption[];
  category: string | null;
};

type OnOfficeSearchCriteriaFieldCatalog = {
  fields: OnOfficeSearchCriteriaFieldDefinition[];
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
  listing_reserved_target: "offers" | "references";
  listing_automation_mode: "full_sync" | "delta_polling";
  listing_delta_overlap_minutes: number;
  reference_automation_mode: "full_sync" | "delta_polling";
  reference_delta_overlap_minutes: number;
};

type OnOfficeResourceFetchResult = {
  records: OnOfficeRecord[];
  requestCount: number;
  pagesFetched: number;
};

type OnOfficeDeltaWindow = {
  sinceIso: string;
  sinceFilterValue: string;
  overlapMinutes: number;
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
  const listingReservedTarget =
    String(listingsCfg.reserved_target ?? "").trim().toLowerCase() === "references"
      ? "references"
      : "offers";
  const listingAutomationMode =
    String(listingsCfg.automation_mode ?? "").trim().toLowerCase() === "delta_polling"
      ? "delta_polling"
      : "full_sync";
  const listingDeltaOverlapMinutes = Math.max(
    1,
    Number.isFinite(Number(listingsCfg.delta_overlap_minutes))
      ? Math.floor(Number(listingsCfg.delta_overlap_minutes))
      : 2,
  );
  const referenceAutomationMode =
    String(referencesCfg.automation_mode ?? "").trim().toLowerCase() === "delta_polling"
      ? "delta_polling"
      : "full_sync";
  const referenceDeltaOverlapMinutes = Math.max(
    1,
    Number.isFinite(Number(referencesCfg.delta_overlap_minutes))
      ? Math.floor(Number(referencesCfg.delta_overlap_minutes))
      : 2,
  );
  return {
    listing_status_field_key: listingStatusFieldKey,
    listing_active_status_values: Array.from(new Set(listingActiveStatusValues)),
    listing_exclude_sold: listingExcludeSold,
    listing_reserved_target: listingReservedTarget,
    listing_automation_mode: listingAutomationMode,
    listing_delta_overlap_minutes: listingDeltaOverlapMinutes,
    reference_automation_mode: referenceAutomationMode,
    reference_delta_overlap_minutes: referenceDeltaOverlapMinutes,
  };
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function readOnOfficeResourceRuntime(
  settings: Record<string, unknown> | null,
  resource: "offers" | "references",
): Record<string, unknown> {
  const root = asObject(settings);
  const runtimes = asObject(root.sync_resources);
  return asObject(runtimes[resource]);
}

function formatOnOfficeDateTime(input: Date): string {
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return formatter.format(input).replace("T", " ");
}

function resolveOnOfficeDeltaWindow(
  integration: PartnerIntegration,
  resource: "offers" | "references",
  automationMode: "full_sync" | "delta_polling",
  overlapMinutes: number,
  triggeredBy: CrmSyncTrigger,
): OnOfficeDeltaWindow | null {
  if (triggeredBy !== "auto_scheduler" || automationMode !== "delta_polling") return null;
  const runtime = readOnOfficeResourceRuntime(integration.settings, resource);
  const lastSuccessAt = String(runtime.onoffice_delta_last_success_at ?? "").trim();
  if (!lastSuccessAt) return null;
  const parsed = Date.parse(lastSuccessAt);
  if (!Number.isFinite(parsed)) return null;
  const sinceDate = new Date(parsed - overlapMinutes * 60_000);
  return {
    sinceIso: sinceDate.toISOString(),
    sinceFilterValue: formatOnOfficeDateTime(sinceDate),
    overlapMinutes,
  };
}

function formatOnOfficeDeltaNote(
  scope: "estate" | "reference",
  deltaWindow: OnOfficeDeltaWindow | null,
  automationMode: "full_sync" | "delta_polling",
  triggeredBy: CrmSyncTrigger,
): string {
  if (deltaWindow) {
    return `onOffice ${scope} delta: geaendert_am > ${deltaWindow.sinceFilterValue} (Overlap ${deltaWindow.overlapMinutes} Min.)`;
  }
  if (triggeredBy === "auto_scheduler" && automationMode === "delta_polling") {
    return `onOffice ${scope} delta: kein letzter Erfolgstimestamp vorhanden, initialer Vollabruf für diesen Lauf`;
  }
  return `onOffice ${scope} delta: Delta-Polling für diesen Lauf nicht aktiv`;
}

function readOnOfficeStatusValue(
  elements: Record<string, unknown>,
  fieldKey: string,
): string {
  return String(elements[fieldKey] ?? elements["status2"] ?? "").trim();
}

function isReservedOnOfficeStatus(value: string): boolean {
  return value.trim().toLowerCase() === "reserviert";
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

function normalizeLocationText(value: unknown): string | null {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > 0 ? text : null;
}

function splitOnOfficeCityDistrict(value: unknown): { city: string | null; district: string | null } {
  const raw = normalizeLocationText(value);
  if (!raw) return { city: null, district: null };
  const parts = raw.split(/\s*\/\s*/).map((entry) => entry.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return {
      city: parts[0] || null,
      district: parts.slice(1).join(" / ") || null,
    };
  }
  return { city: raw, district: null };
}

function normalizeOnOfficeAreaHint(value: unknown): string | null {
  const text = normalizeLocationText(value);
  if (!text) return null;
  if (text.length > 80) return null;
  if (/[.!?;:]/.test(text)) return null;
  if (/\bbitte beachten\b/i.test(text)) return null;
  return text;
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
      if (isRadiusContextSegment(part)) continue;
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
  const certificateType = String(elements["energieausweistyp"] ?? elements["energiepass_art"] ?? "").trim() || null;
  const consumptionValue = toNumber(elements["energieverbrauchskennwert"] ?? elements["energieverbrauchkennwert"]);
  const demandValue = toNumber(elements["endenergiebedarf"]);
  const valueKind = normalizeEnergyValueKind(certificateType);
  const value = valueKind === "bedarf"
    ? (demandValue ?? consumptionValue)
    : valueKind === "verbrauch"
      ? (consumptionValue ?? demandValue)
      : (demandValue ?? consumptionValue);
  const constructionYear = toNumber(elements["energieausweisBaujahr"]) ?? toNumber(elements["baujahr"]);
  const certificateAvailability =
    certificateType === "ohne Energieausweis"
      ? "ohne energieausweis"
      : certificateType === "es besteht keine Pflicht!"
        ? "keine pflicht"
        : certificateType
          ? "vorhanden"
          : null;
  return {
    certificate_type: certificateType,
    value,
    value_kind: valueKind,
    construction_year: constructionYear,
    heating_energy_source: String(elements["energietraeger"] ?? "").trim() || null,
    efficiency_class: String(elements["energyClass"] ?? "").trim() || null,
    certificate_availability: certificateAvailability,
    certificate_start_date: String(elements["energiepassAusstelldatum"] ?? "").trim() || null,
    certificate_end_date: String(elements["energieausweis_gueltig_bis"] ?? "").trim() || null,
    warm_water_included: normalizeOnOfficeBoolean(elements["warmwasserEnthalten"]),
    demand: demandValue,
    year: constructionYear,
  };
}

function buildDetailsSnapshot(elements: Record<string, unknown>): OfferDetailsSnapshot {
  return {
    living_area_sqm: toNumber(elements["wohnflaeche"]),
    usable_area_sqm: toNumber(elements["nutzflaeche"]),
    plot_area_sqm: null,
    rooms: toNumber(elements["anzahl_zimmer"]),
    bedrooms: toNumber(elements["anzahl_schlafzimmer"]),
    bathrooms: toNumber(elements["anzahl_badezimmer"]),
    floor: null,
    construction_year: toNumber(elements["baujahr"]),
    condition: String(elements["zustand"] ?? "").trim() || null,
    availability: null,
    parking: null,
    balcony: normalizeOnOfficeBoolean(elements["balkon"]),
    terrace: normalizeOnOfficeBoolean(elements["terrasse"]),
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

function extractOnOfficeModuleElements(records: OnOfficeRecord[], moduleId: string): Record<string, unknown> {
  const moduleRecord = records.find((record) => String(record.id ?? "").trim().toLowerCase() === moduleId) ?? records[0];
  return (moduleRecord?.elements ?? {}) as Record<string, unknown>;
}

function parseOnOfficeEstateFieldCatalog(moduleElements: Record<string, unknown>): OnOfficeEstateFieldCatalog {
  const fields: OnOfficeEstateFieldDefinition[] = [];

  for (const [fieldKey, value] of Object.entries(moduleElements)) {
    if (!value || typeof value !== "object") continue;
    const field = value as Record<string, unknown>;
    fields.push({
      key: fieldKey,
      label: String(field.label ?? "").trim() || null,
      type: String(field.type ?? "").trim().toLowerCase() || null,
      permittedValues: extractPermittedValues(
        field.permittedvalues
        ?? field.permitted_values
        ?? field.options
        ?? field.values,
      ),
    });
  }

  return { fields };
}

function parseOnOfficeSearchCriteriaFieldCatalog(records: OnOfficeRecord[]): OnOfficeSearchCriteriaFieldCatalog {
  const fields: OnOfficeSearchCriteriaFieldDefinition[] = [];

  for (const record of records) {
    const elements = asObject(record.elements);
    const category = String(elements.name ?? "").trim() || null;
    const categoryFields = Array.isArray(elements.fields) ? elements.fields : [];
    for (const entry of categoryFields) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
      const field = entry as Record<string, unknown>;
      const key = String(field.id ?? "").trim();
      if (!key) continue;
      fields.push({
        key,
        label: String(field.name ?? "").trim() || null,
        type: String(field.type ?? "").trim().toLowerCase() || null,
        rangeField: String(field.rangefield ?? "").trim().toLowerCase() === "true",
        permittedValues: extractPermittedValues(field.values ?? field.permittedvalues),
        category,
      });
    }
  }

  return { fields };
}

function resolveOnOfficeEstateReadFields(
  catalog: OnOfficeEstateFieldCatalog,
  desiredFields: string[],
): string[] {
  const available = new Set(catalog.fields.map((field) => field.key.trim()).filter(Boolean));
  return desiredFields.filter((field) => available.has(field));
}

function mergeOnOfficeEstateReadFields(
  fixedFields: string[],
  optionalFields: string[],
  catalog: OnOfficeEstateFieldCatalog,
): string[] {
  const out = new Set<string>(fixedFields);
  for (const field of resolveOnOfficeEstateReadFields(catalog, optionalFields)) {
    out.add(field);
  }
  return Array.from(out);
}

function normalizeOnOfficeFlag(value: unknown): "1" | "0" | null {
  if (typeof value === "number") {
    if (value === 1) return "1";
    if (value === 0) return "0";
  }
  if (typeof value === "string") {
    const normalized = value.trim();
    if (normalized === "1") return "1";
    if (normalized === "0") return "0";
  }
  return null;
}

function normalizeOnOfficeBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "1" || normalized === "j" || normalized === "ja" || normalized === "true") return true;
    if (normalized === "0" || normalized === "n" || normalized === "nein" || normalized === "false") return false;
  }
  return null;
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
  const zipCode = String(elements["plz"] ?? "").trim() || null;
  const parsedLocation = splitOnOfficeCityDistrict(elements["ort"]);
  const city = parsedLocation.city;
  const district = parsedLocation.district;
  const region = normalizeOnOfficeAreaHint(elements["lage"]);
  const locationLabel =
    district
      ? `${city ?? ""} ${district}`.trim() || district
      : city && region && !region.toLowerCase().includes(city.toLowerCase())
        ? `${city} ${region}`
        : city ?? region ?? null;
  const rent = toNumber(elements["warmmiete"]) ?? toNumber(elements["kaltmiete"]);
  const details = buildDetailsSnapshot(elements);
  const energy = buildEnergySnapshot(elements);
  const sourceUpdatedAt = String(elements["geaendert_am"] ?? "").trim() || null;
  const detailsExtra = {
    separate_wc_count: toNumber(elements["anzahl_sep_wc"]),
    balcony_count: toNumber(elements["anzahl_balkone"]),
    terrace_count: toNumber(elements["anzahl_terrassen"]),
  };
  const pricing = {
    currency: elements["waehrung"] ?? null,
    purchase_price: toNumber(elements["kaufpreis"]),
    cold_rent: toNumber(elements["kaltmiete"]),
    warm_rent: toNumber(elements["warmmiete"]),
    additional_costs: toNumber(elements["nebenkosten"]),
    heating_costs: toNumber(elements["heizkosten"]),
    heating_costs_in_additional_costs: elements["heizkosten_in_nebenkosten"] ?? null,
    deposit: elements["kaution"] ?? null,
    vat_on_commission: elements["zzgl_mehrwertsteuer"] ?? null,
    external_commission: elements["aussen_courtage"] ?? null,
    internal_commission: elements["innen_courtage"] ?? null,
  };
  const equipment = {
    internet_access_type: elements["internetAccessType"] ?? null,
    fuel_type: elements["befeuerung"] ?? null,
    heating_type: elements["heizungsart"] ?? null,
    floors_total: toNumber(elements["etagen_zahl"]),
    elevator: elements["fahrstuhl"] ?? null,
    cable_sat_tv: normalizeOnOfficeBoolean(elements["kabel_sat_tv"]),
    parking: elements["multiParkingLot"] ?? null,
    balcony: normalizeOnOfficeBoolean(elements["balkon"]),
    terrace: normalizeOnOfficeBoolean(elements["terrasse"]),
  };
  const marketing = {
    publish: normalizeOnOfficeBoolean(elements["veroeffentlichen"]),
    property_of_the_week: normalizeOnOfficeBoolean(elements["objekt_der_woche"]),
    free_commission: normalizeOnOfficeBoolean(elements["courtage_frei"]),
    property_of_the_day: normalizeOnOfficeBoolean(elements["objekt_des_tages"]),
  };
  const energyMeta = {
    certificate_year: elements["energiepassJahrgang"] ?? null,
    issue_date: elements["energiepassAusstelldatum"] ?? null,
    valid_until: elements["energieausweis_gueltig_bis"] ?? null,
  };

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
      source_title: String(elements["objekttitel"] ?? "") || null,
      zip_code: zipCode,
      city,
      district,
      region,
      country: null,
      description: elements["objektbeschreibung"] ?? elements["freitext_lage"] ?? null,
      long_description: elements["objektbeschreibung"] ?? null,
      location: locationLabel,
      location_scope: district ? "stadtteil" : city ? "stadt" : "region",
      features_note: elements["ausstatt_beschr"] ?? elements["freitext_ausstattung"] ?? null,
      misc_note: elements["sonstige_angaben"] ?? null,
      details,
      details_extra: detailsExtra,
      energy,
      energy_meta: energyMeta,
      pricing,
      equipment,
      marketing,
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
      vermietet: elements["vermietet"] ?? null,
    },
    source_payload: record as unknown as Record<string, unknown>,
  };
}

function mapEstateToReference(
  partnerId: string,
  integration: PartnerIntegration,
  record: OnOfficeRecord,
  settings: OnOfficeResourceSettings,
): RawReference {
  const elements = (record.elements ?? {}) as Record<string, unknown>;
  const gallery = extractImages(elements);
  const city = String(elements["ort"] ?? "").trim();
  const statusValue = readOnOfficeStatusValue(elements, settings.listing_status_field_key);
  const saleType =
    isReservedOnOfficeStatus(statusValue)
      ? "reserviert"
      : normalizeOfferType(String(elements["vermarktungsart"] ?? "")) === "miete"
        ? "vermietet"
        : "verkauft";
  const locationLabel = city || "der Region";
  const referenceTitle =
    saleType === "reserviert"
      ? `Reserviert in ${locationLabel}`
      : `Erfolgreich ${saleType} in ${locationLabel}`;
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
    reference_text_seed:
      saleType === "reserviert"
        ? "Das Objekt ist aktuell reserviert."
        : `Das Objekt wurde erfolgreich ${saleType}.`,
    description:
      saleType === "reserviert"
        ? "Das Objekt ist aktuell reserviert."
        : `Das Objekt wurde erfolgreich ${saleType}.`,
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

function readSearchCriteriaMeta(record: OnOfficeSearchCriteriaRecord): Record<string, unknown> {
  const elements = asObject(record.elements);
  const meta = asObject(elements._meta);
  if (Object.keys(meta).length > 0) return meta;
  return asObject(record._meta);
}

function readSearchCriteriaElements(record: OnOfficeSearchCriteriaRecord): Record<string, unknown> {
  return asObject(record.elements);
}

function readSearchCriteriaFieldValue(
  record: OnOfficeSearchCriteriaRecord,
  key: string,
): unknown {
  const elements = readSearchCriteriaElements(record);
  if (elements[key] !== undefined) return elements[key];
  return record[key];
}

function readSearchCriteriaSingleValue(
  record: OnOfficeSearchCriteriaRecord,
  key: string,
): string | null {
  const raw = readSearchCriteriaFieldValue(record, key);
  if (Array.isArray(raw)) {
    const first = raw.map((value) => String(value ?? "").trim()).find(Boolean);
    return first ?? null;
  }
  const value = String(raw ?? "").trim();
  return value || null;
}

function readSearchCriteriaStringArray(
  record: OnOfficeSearchCriteriaRecord,
  key: string,
): string[] {
  const raw = readSearchCriteriaFieldValue(record, key);
  if (Array.isArray(raw)) {
    return raw.map((value) => String(value ?? "").trim()).filter(Boolean);
  }
  const single = String(raw ?? "").trim();
  return single ? [single] : [];
}

function readSearchCriteriaRangeValue(
  record: OnOfficeSearchCriteriaRecord,
  key: string,
): unknown {
  const elements = readSearchCriteriaElements(record);
  const directElement = elements[key];
  if (directElement !== undefined) return directElement;

  const umkreisRecord = asObject(elements["Umkreis"]);
  if (umkreisRecord[key] !== undefined) return umkreisRecord[key];

  const direct = record[key];
  if (direct !== undefined) return direct;

  const rangeRecord = asObject(record.range);
  if (rangeRecord[key] !== undefined) return rangeRecord[key];

  const rangeUpperRecord = asObject(record.Range);
  if (rangeUpperRecord[key] !== undefined) return rangeUpperRecord[key];

  return undefined;
}

function readSearchCriteriaRangeBounds(
  record: OnOfficeSearchCriteriaRecord,
  key: string,
): { min: number | null; max: number | null } {
  const rangeValue = readSearchCriteriaRangeValue(record, `range_${key}`);
  if (Array.isArray(rangeValue)) {
    return {
      min: toNumber(rangeValue[0]),
      max: toNumber(rangeValue[1]),
    };
  }

  return {
    min: toNumber(record[`${key}__von`] ?? record[`${key}_von`] ?? record[`${key}_ab`]),
    max: toNumber(record[`${key}__bis`] ?? record[`${key}_bis`]),
  };
}

function summarizeSearchCriteriaObservedValues(
  records: OnOfficeSearchCriteriaRecord[],
  getter: (record: OnOfficeSearchCriteriaRecord) => unknown,
  limit = 10,
): string {
  const values = Array.from(
    new Set(
      records
        .flatMap((record) => {
          const raw = getter(record);
          if (Array.isArray(raw)) {
            const compact = raw.map((value) => String(value ?? "").trim()).filter(Boolean);
            return compact.length > 0 ? [compact.join("..")] : [];
          }
          const value = String(raw ?? "").trim();
          return value ? [value] : [];
        }),
    ),
  );
  if (values.length === 0) return "keine";
  return values.slice(0, limit).join(", ");
}

function summarizeSearchCriteriaDistribution(
  records: OnOfficeSearchCriteriaRecord[],
  getter: (record: OnOfficeSearchCriteriaRecord) => unknown,
  limit = 10,
): string {
  const counts = new Map<string, number>();
  let emptyCount = 0;

  for (const record of records) {
    const raw = getter(record);
    const value = Array.isArray(raw)
      ? raw.map((entry) => String(entry ?? "").trim()).filter(Boolean).join("..")
      : String(raw ?? "").trim();
    if (!value) {
      emptyCount += 1;
      continue;
    }
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  const parts = Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([value, count]) => `${value}=${count}`);

  if (emptyCount > 0) parts.push(`leer=${emptyCount}`);
  return parts.length > 0 ? parts.join(", ") : "keine";
}

function mapSearchCriteriaToRequest(partnerId: string, record: OnOfficeSearchCriteriaRecord): RawRequest {
  const meta = readSearchCriteriaMeta(record);
  const requestMarketingType = readSearchCriteriaSingleValue(record, "vermarktungsart");
  const requestObjectType = readSearchCriteriaSingleValue(record, "objektart");
  const requestObjectSubtypes = readSearchCriteriaStringArray(record, "objekttyp");
  const requestObjectSubtype = requestObjectSubtypes[0] ?? null;
  const requestTypeRaw = String(requestMarketingType ?? readSearchCriteriaSingleValue(record, "request_type") ?? "").toLowerCase();
  const requestType = requestTypeRaw.includes("miete") ? "miete" : "kauf";
  const roomRange = readSearchCriteriaRangeBounds(record, "anzahl_zimmer");
  const purchasePriceRange = readSearchCriteriaRangeBounds(record, "kaufpreis");
  const rentRange = readSearchCriteriaRangeBounds(record, "kaltmiete");
  const livingAreaRange = readSearchCriteriaRangeBounds(record, "wohnflaeche");
  const usableAreaRange = readSearchCriteriaRangeBounds(record, "nutzflaeche");
  const plotAreaRange = readSearchCriteriaRangeBounds(record, "grundstuecksflaeche");
  const totalAreaRange = readSearchCriteriaRangeBounds(record, "gesamtflaeche");
  const rentableAreaRange = readSearchCriteriaRangeBounds(record, "vermietbare_flaeche");
  const commercialAreaRange = readSearchCriteriaRangeBounds(record, "gewerbeflaeche");
  const unitsRange = readSearchCriteriaRangeBounds(record, "anzahl_wohneinheiten");
  const centerOrt = String(readSearchCriteriaRangeValue(record, "range_ort") ?? readSearchCriteriaRangeValue(record, "ort") ?? "").trim() || null;
  const centerPlz = String(readSearchCriteriaRangeValue(record, "range_plz") ?? readSearchCriteriaRangeValue(record, "plz") ?? "").trim() || null;
  const centerLand = String(readSearchCriteriaRangeValue(record, "range_land") ?? readSearchCriteriaRangeValue(record, "land") ?? "").trim() || null;
  const centerLat = toNumber(readSearchCriteriaRangeValue(record, "range_breitengrad"));
  const centerLng = toNumber(readSearchCriteriaRangeValue(record, "range_laengengrad"));
  const radiusKm = toNumber(readSearchCriteriaRangeValue(record, "range"));
  const regionalSupplement = String(readSearchCriteriaFieldValue(record, "regionaler_zusatz") ?? "").trim() || null;
  const regionHint =
    [
      regionalSupplement,
      centerOrt ? `Umkreis ${radiusKm ?? 0} km um ${centerOrt}` : "",
      centerPlz,
    ].filter(Boolean).join(", ")
    || String(meta.publicnote ?? "").trim();
  const fallbackCity = centerOrt;
  const targetCandidates = [
    toRegionTarget(centerOrt ?? "", centerPlz),
    ...parseRegionTargetsFromHint(regionalSupplement, fallbackCity),
    ...parseRegionTargetsFromHint(meta.publicnote, fallbackCity),
  ];
  const seenTargetKeys = new Set<string>();
  const targets = targetCandidates
    .filter((target): target is RegionTarget => Boolean(target))
    .map((target) => ({
      ...target,
      label: cleanRequestRegionTargetLabel(target.label, target.city) || target.city,
    }))
    .filter((target) => {
      if (!target.city || !target.label || seenTargetKeys.has(target.key)) return false;
      seenTargetKeys.add(target.key);
      return true;
    });
  const description =
    String(
      readSearchCriteriaFieldValue(record, "beschreibung")
      ?? readSearchCriteriaFieldValue(record, "comment")
      ?? "",
    ).trim()
    || null;
  const title =
    String(meta.publicnote ?? "").trim()
    || `${requestType === "miete" ? "Miet" : "Kauf"}gesuch`;
  const sourceUpdatedAt =
    String(meta.editdate ?? meta.creationdate ?? "").trim()
    || null;
  const normalizedPayload: Record<string, unknown> = {
    title,
    description,
    request_type: requestType,
    object_type: requestObjectType ? normalizeObjectType(requestObjectType) : null,
    object_subtype: requestObjectSubtype ? requestObjectSubtype.toLowerCase() : null,
    object_subtypes: requestObjectSubtypes.map((value) => value.toLowerCase()),
    object_type_detail: requestObjectSubtype ? requestObjectSubtype.toLowerCase() : null,
    marketing_type: requestMarketingType ?? requestType,
    min_rooms: roomRange.min,
    max_rooms: roomRange.max,
    min_price: requestType === "miete" ? rentRange.min : purchasePriceRange.min,
    min_purchase_price: purchasePriceRange.min,
    max_purchase_price: purchasePriceRange.max,
    min_rent: rentRange.min,
    max_rent: rentRange.max,
    max_price: requestType === "miete" ? rentRange.max : purchasePriceRange.max,
    min_living_area_sqm: livingAreaRange.min,
    max_living_area_sqm: livingAreaRange.max,
    min_area_sqm: livingAreaRange.min,
    max_area_sqm: livingAreaRange.max,
    min_usable_area_sqm: usableAreaRange.min,
    max_usable_area_sqm: usableAreaRange.max,
    min_plot_area_sqm: plotAreaRange.min,
    max_plot_area_sqm: plotAreaRange.max,
    min_total_area_sqm: totalAreaRange.min,
    max_total_area_sqm: totalAreaRange.max,
    min_rentable_area_sqm: rentableAreaRange.min,
    max_rentable_area_sqm: rentableAreaRange.max,
    min_commercial_area_sqm: commercialAreaRange.min,
    max_commercial_area_sqm: commercialAreaRange.max,
    min_units: unitsRange.min,
    max_units: unitsRange.max,
    region: regionHint || null,
    region_targets: targets.map((target) => ({
      city: target.city,
      district: target.district,
      label: target.label,
    })),
    region_target_keys: targets.map((target) => target.key),
    search_criteria_keys: Array.isArray(meta.kocriterias) ? meta.kocriterias : [],
    range_center: {
      land: centerLand,
      plz: centerPlz,
      ort: centerOrt,
      strasse: String(readSearchCriteriaRangeValue(record, "range_strasse") ?? readSearchCriteriaRangeValue(record, "strasse") ?? "").trim() || null,
      hausnummer: String(readSearchCriteriaRangeValue(record, "range_hausnummer") ?? readSearchCriteriaRangeValue(record, "hausnummer") ?? "").trim() || null,
    },
    radius_km: radiusKm,
    lat: centerLat,
    lng: centerLng,
    parentaddress: readSearchCriteriaFieldValue(record, "parentaddress") ?? meta.internaladdressid ?? null,
    characteristic: meta.characteristic ?? null,
    publicnote: meta.publicnote ?? null,
    title_source: meta.publicnote ? "publicnote" : "fallback",
    description_source: description ? (readSearchCriteriaFieldValue(record, "beschreibung") != null ? "beschreibung" : "comment") : null,
    status: meta.status ?? readSearchCriteriaSingleValue(record, "status"),
    active: meta.status === "1",
  };
  return makeRawRowBase(
    partnerId,
    "onoffice",
    `request:${String(record.id ?? meta.id ?? "")}`,
    title,
    sourceUpdatedAt,
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
  options?: {
    listlimit?: number;
  },
): Promise<OnOfficeResourceFetchResult> {
  const base = getOnOfficeApiBaseUrl(integration);
  const allRecords: OnOfficeRecord[] = [];
  const listlimit = Math.min(500, Math.max(1, Math.floor(options?.listlimit ?? 500)));
  let listoffset = 0;
  let requestCount = 0;
  let pagesFetched = 0;

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
    requestCount += 1;

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
    pagesFetched += 1;
    allRecords.push(...records);
    if (records.length < listlimit) break;
    listoffset += listlimit;
  }

  return {
    records: allRecords,
    requestCount,
    pagesFetched,
  };
}

async function fetchOnOfficeGetRecords<T extends Record<string, unknown>>(
  integration: PartnerIntegration,
  token: string,
  secret: string,
  resourceType: string,
  buildParameters: (listoffset: number, listlimit: number) => Record<string, unknown>,
  options?: {
    listlimit?: number;
  },
): Promise<{ records: T[]; requestCount: number; pagesFetched: number }> {
  const base = getOnOfficeApiBaseUrl(integration);
  const allRecords: T[] = [];
  const listlimit = Math.min(500, Math.max(1, Math.floor(options?.listlimit ?? 500)));
  let listoffset = 0;
  let requestCount = 0;
  let pagesFetched = 0;

  while (true) {
    const body = buildOnOfficeGetRequest(token, secret, resourceType, buildParameters(listoffset, listlimit));
    const res = await fetchWithTimeout(base, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    requestCount += 1;

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`onOffice ${resourceType} fetch failed (${res.status}): ${text}`);
    }

    const json = (await res.json()) as OnOfficeResponse;
    const actionStatus = json?.response?.results?.[0]?.status;
    const actionErrorCode = Number(actionStatus?.errorcode ?? 0);
    if (actionErrorCode !== 0) {
      throw new Error(
        `onOffice ${resourceType} action failed (${actionErrorCode}): ${String(actionStatus?.message ?? "Unbekannter Fehler")}`,
      );
    }
    const records = (json?.response?.results?.[0]?.data?.records ?? []) as T[];
    if (!Array.isArray(records) || records.length === 0) break;
    pagesFetched += 1;
    allRecords.push(...records);
    if (records.length < listlimit) break;
    listoffset += listlimit;
  }

  return {
    records: allRecords,
    requestCount,
    pagesFetched,
  };
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
  const catalog = await fetchOnOfficeEstateFieldCatalog(integration, token, secret);
  const candidates: Array<{ fieldKey: string; fieldLabel: string | null; options: OnOfficeFieldOption[]; priority: number }> = [];

  for (const field of catalog.fields) {
    if (field.type !== "singleselect") continue;

    const normalizedKey = field.key.trim().toLowerCase();
    const normalizedLabel = String(field.label ?? "").trim().toLowerCase();
    const priority =
      normalizedKey === "objektstatus" ? 100
        : normalizedKey === "status2" ? 90
          : normalizedKey === "status" ? 80
            : normalizedLabel === "status" ? 70
              : normalizedKey.includes("status") || normalizedLabel.includes("status") ? 60
                : 0;
    if (priority === 0 || field.permittedValues.length === 0) continue;

    candidates.push({
      fieldKey: field.key,
      fieldLabel: field.label,
      options: field.permittedValues,
      priority,
    });
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

async function fetchOnOfficeEstateFieldCatalog(
  integration: PartnerIntegration,
  token: string,
  secret: string,
): Promise<OnOfficeEstateFieldCatalog> {
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
    return { fields: [] };
  }

  return parseOnOfficeEstateFieldCatalog(extractOnOfficeModuleElements(records, RESOURCE_ESTATE));
}

async function fetchOnOfficeSearchCriteriaFieldCatalog(
  integration: PartnerIntegration,
  token: string,
  secret: string,
): Promise<OnOfficeSearchCriteriaFieldCatalog> {
  const base = getOnOfficeApiBaseUrl(integration);
  const body = buildOnOfficeGetRequest(token, secret, RESOURCE_SEARCH_CRITERIA_FIELDS, {
    language: "DEU",
    additionalTranslations: true,
  });

  const res = await fetchWithTimeout(base, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`onOffice searchCriteriaFields fetch failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as OnOfficeResponse;
  const actionStatus = json?.response?.results?.[0]?.status;
  const actionErrorCode = Number(actionStatus?.errorcode ?? 0);
  if (actionErrorCode !== 0) {
    throw new Error(
      `onOffice searchCriteriaFields action failed (${actionErrorCode}): ${String(actionStatus?.message ?? "Unbekannter Fehler")}`,
    );
  }
  const records = (json?.response?.results?.[0]?.data?.records ?? []) as OnOfficeRecord[];
  if (!Array.isArray(records) || records.length === 0) {
    return { fields: [] };
  }
  return parseOnOfficeSearchCriteriaFieldCatalog(records);
}

export async function fetchOnOfficeEstates(
  integration: PartnerIntegration,
  token: string,
  secret: string,
  settings: OnOfficeResourceSettings,
  options?: {
    triggeredBy?: CrmSyncTrigger;
  },
): Promise<OnOfficeResourceFetchResult & { deltaWindow: OnOfficeDeltaWindow | null }> {
  const catalog = await fetchOnOfficeEstateFieldCatalog(integration, token, secret);
  const fields = mergeOnOfficeEstateReadFields([
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
    "waehrung",
    "aussen_courtage",
    "innen_courtage",
    "heizkosten_in_nebenkosten",
    "nebenkosten",
    "kaution",
    "zzgl_mehrwertsteuer",
    "heizkosten",
    "wohnflaeche",
    "anzahl_zimmer",
    "plz",
    "ort",
    "strasse",
    "hausnummer",
    "baujahr",
    "vermietet",
  ], [
    "objektbeschreibung",
    "ausstatt_beschr",
    "lage",
    "sonstige_angaben",
    "energieausweistyp",
    "endenergiebedarf",
    "energieverbrauchskennwert",
    "energieausweis_gueltig_bis",
    "energieausweisBaujahr",
    "energietraeger",
    "energyClass",
    "warmwasserEnthalten",
    "energiepassJahrgang",
    "energiepassAusstelldatum",
    "nutzflaeche",
    "anzahl_schlafzimmer",
    "anzahl_badezimmer",
    "anzahl_sep_wc",
    "anzahl_balkone",
    "anzahl_terrassen",
    "zustand",
    "internetAccessType",
    "befeuerung",
    "heizungsart",
    "etagen_zahl",
    "fahrstuhl",
    "kabel_sat_tv",
    "multiParkingLot",
    "balkon",
    "terrasse",
    "objekt_der_woche",
    "courtage_frei",
    "objekt_des_tages",
  ], catalog);
  const deltaWindow = resolveOnOfficeDeltaWindow(
    integration,
    "offers",
    settings.listing_automation_mode,
    settings.listing_delta_overlap_minutes,
    options?.triggeredBy ?? "admin_manual",
  );
  const filter: Record<string, unknown> = {
    status: [{ op: "=", val: 1 }],
  };
  if (deltaWindow) {
    filter.geaendert_am = [{ op: ">", val: deltaWindow.sinceFilterValue }];
  }
  const response = await fetchOnOfficeResource(integration, token, secret, RESOURCE_ESTATE, fields, filter);
  const allowedStatusValues = new Set(settings.listing_active_status_values);
  const records = response.records.filter((record) => {
    const elements = (record.elements ?? {}) as Record<string, unknown>;
    const soldFlag = normalizeOnOfficeFlag(elements["verkauft"]);
    const fieldValue = readOnOfficeStatusValue(elements, settings.listing_status_field_key);
    if (isReservedOnOfficeStatus(fieldValue)) {
      return settings.listing_reserved_target === "offers";
    }

    if (settings.listing_status_field_key && allowedStatusValues.size > 0) {
      return fieldValue.length > 0 && allowedStatusValues.has(fieldValue) && soldFlag !== "1";
    }

    if (settings.listing_exclude_sold) {
      return soldFlag !== "1";
    }

    return soldFlag !== "1";
  });
  return {
    ...response,
    records,
    deltaWindow,
  };
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

function summarizeEstateFieldDistribution(
  records: OnOfficeRecord[],
  fieldKey: string,
  limit = 10,
): string {
  const counts = new Map<string, number>();
  let emptyCount = 0;

  for (const record of records) {
    const value = String(((record.elements ?? {}) as Record<string, unknown>)[fieldKey] ?? "").trim();
    if (!value) {
      emptyCount += 1;
      continue;
    }
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  const parts = Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([value, count]) => `${value}=${count}`);

  if (emptyCount > 0) parts.push(`leer=${emptyCount}`);
  return parts.length > 0 ? parts.join(", ") : "keine";
}

export async function fetchOnOfficeReferences(
  integration: PartnerIntegration,
  token: string,
  secret: string,
  settings: OnOfficeResourceSettings,
  options?: {
    triggeredBy?: CrmSyncTrigger;
  },
): Promise<OnOfficeResourceFetchResult & { deltaWindow: OnOfficeDeltaWindow | null }> {
  const catalog = await fetchOnOfficeEstateFieldCatalog(integration, token, secret);
  const fields = mergeOnOfficeEstateReadFields([
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
  ], [
    "img",
  ], catalog);
  const deltaWindow = resolveOnOfficeDeltaWindow(
    integration,
    "references",
    settings.reference_automation_mode,
    settings.reference_delta_overlap_minutes,
    options?.triggeredBy ?? "admin_manual",
  );
  const filter: Record<string, unknown> = {
    status: [{ op: "=", val: 1 }],
  };
  if (deltaWindow) {
    filter.geaendert_am = [{ op: ">", val: deltaWindow.sinceFilterValue }];
  }
  const response = await fetchOnOfficeResource(integration, token, secret, RESOURCE_ESTATE, fields, filter);
  const allowedStatusValues = new Set(settings.listing_active_status_values);
  const records = response.records.filter((record) => {
    const elements = (record.elements ?? {}) as Record<string, unknown>;
    const soldFlag = normalizeOnOfficeFlag(elements["verkauft"]);
    const fieldValue = readOnOfficeStatusValue(elements, settings.listing_status_field_key);

    if (isReservedOnOfficeStatus(fieldValue)) {
      return settings.listing_reserved_target === "references";
    }

    if (fieldValue.length > 0 && allowedStatusValues.has(fieldValue)) {
      return false;
    }

    return soldFlag === "1";
  });
  return {
    ...response,
    records,
    deltaWindow,
  };
}

export async function fetchOnOfficeSearchCriteria(
  integration: PartnerIntegration,
  token: string,
  secret: string,
): Promise<{
  records: OnOfficeSearchCriteriaRecord[];
  requestCount: number;
  pagesFetched: number;
  fieldCatalog: OnOfficeSearchCriteriaFieldCatalog;
}> {
  const fieldCatalog = await fetchOnOfficeSearchCriteriaFieldCatalog(integration, token, secret);
  const response = await fetchOnOfficeGetRecords<OnOfficeSearchCriteriaRecord>(
    integration,
    token,
    secret,
    RESOURCE_SEARCH_CRITERIAS,
    (listoffset, listlimit) => ({
      mode: "filter",
      filter: {
        status: [{ op: "=", val: "1" }],
      },
      sortby: "internaladdressid",
      sortorder: "ASC",
      listlimit,
      listoffset,
    }),
  );
  return {
    records: response.records,
    requestCount: response.requestCount,
    pagesFetched: response.pagesFetched,
    fieldCatalog,
  };
}

export async function syncOnOfficeResources(
  integration: PartnerIntegration,
  token: string,
  secret: string,
  options?: { resource?: CrmSyncResource; mode?: "guarded" | "full"; triggeredBy?: CrmSyncTrigger },
): Promise<ResourceSyncData & { offers: MappedOffer[] }> {
  const resource = options?.resource ?? "all";
  const triggeredBy = options?.triggeredBy ?? "admin_manual";
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
  let providerRequestCount = 0;
  let providerPagesFetched = 0;

  if (shouldFetchOffers) {
    const estateResult = await fetchOnOfficeEstates(integration, token, secret, cfg, { triggeredBy });
    const estates = estateResult.records;
    providerRequestCount += estateResult.requestCount;
    providerPagesFetched += estateResult.pagesFetched;
    notes.push(`onOffice estate diagnostic: ${estates.length} Datensätze nach Angebotsfilter geladen.`);
    notes.push(formatOnOfficeDeltaNote("estate", estateResult.deltaWindow, cfg.listing_automation_mode, triggeredBy));
    notes.push(`onOffice estate paging: requests=${estateResult.requestCount}, pages=${estateResult.pagesFetched}`);
    notes.push(`onOffice estate status-Werte: ${summarizeEstateFieldValues(estates, "status")}`);
    notes.push(`onOffice estate status-Verteilung: ${summarizeEstateFieldDistribution(estates, "status")}`);
    notes.push(`onOffice estate ${cfg.listing_status_field_key}-Werte: ${summarizeEstateFieldValues(estates, cfg.listing_status_field_key)}`);
    notes.push(`onOffice estate ${cfg.listing_status_field_key}-Verteilung: ${summarizeEstateFieldDistribution(estates, cfg.listing_status_field_key)}`);
    notes.push(`onOffice estate verkauft-Werte: ${summarizeEstateFieldValues(estates, "verkauft")}`);
    notes.push(`onOffice estate verkauft-Verteilung: ${summarizeEstateFieldDistribution(estates, "verkauft")}`);
    notes.push(`onOffice estate reserviert-Werte: ${summarizeEstateFieldValues(estates, "reserviert")}`);
    notes.push(`onOffice estate reserviert-Verteilung: ${summarizeEstateFieldDistribution(estates, "reserviert")}`);
    notes.push(`onOffice estate veroeffentlichen-Werte: ${summarizeEstateFieldValues(estates, "veroeffentlichen")}`);
    notes.push(`onOffice estate veroeffentlichen-Verteilung: ${summarizeEstateFieldDistribution(estates, "veroeffentlichen")}`);
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
    const referenceResult = await fetchOnOfficeReferences(integration, token, secret, cfg, { triggeredBy });
    const referenceRecords = referenceResult.records;
    providerRequestCount += referenceResult.requestCount;
    providerPagesFetched += referenceResult.pagesFetched;
    notes.push(`onOffice reference diagnostic: ${referenceRecords.length} Datensätze nach Referenzfilter geladen.`);
    notes.push(formatOnOfficeDeltaNote("reference", referenceResult.deltaWindow, cfg.reference_automation_mode, triggeredBy));
    notes.push(`onOffice reference paging: requests=${referenceResult.requestCount}, pages=${referenceResult.pagesFetched}`);
    notes.push(`onOffice reference status-Werte: ${summarizeEstateFieldValues(referenceRecords, "status")}`);
    notes.push(`onOffice reference status-Verteilung: ${summarizeEstateFieldDistribution(referenceRecords, "status")}`);
    notes.push(`onOffice reference status2-Werte: ${summarizeEstateFieldValues(referenceRecords, "status2")}`);
    notes.push(`onOffice reference status2-Verteilung: ${summarizeEstateFieldDistribution(referenceRecords, "status2")}`);
    notes.push(`onOffice reference verkauft-Werte: ${summarizeEstateFieldValues(referenceRecords, "verkauft")}`);
    notes.push(`onOffice reference verkauft-Verteilung: ${summarizeEstateFieldDistribution(referenceRecords, "verkauft")}`);
    notes.push(`onOffice reference reserviert-Werte: ${summarizeEstateFieldValues(referenceRecords, "reserviert")}`);
    notes.push(`onOffice reference reserviert-Verteilung: ${summarizeEstateFieldDistribution(referenceRecords, "reserviert")}`);
    notes.push(`onOffice reference vermarktungsart-Werte: ${summarizeEstateFieldValues(referenceRecords, "vermarktungsart")}`);
    notes.push(`onOffice reference vermarktungsart-Verteilung: ${summarizeEstateFieldDistribution(referenceRecords, "vermarktungsart")}`);
    notes.push(`onOffice reference vermietet-Werte: ${summarizeEstateFieldValues(referenceRecords, "vermietet")}`);
    notes.push(`onOffice reference vermietet-Verteilung: ${summarizeEstateFieldDistribution(referenceRecords, "vermietet")}`);
    notes.push(`onOffice reference veroeffentlichen-Werte: ${summarizeEstateFieldValues(referenceRecords, "veroeffentlichen")}`);
    notes.push(`onOffice reference veroeffentlichen-Verteilung: ${summarizeEstateFieldDistribution(referenceRecords, "veroeffentlichen")}`);
    references = referenceRecords.map((record) => mapEstateToReference(integration.partner_id, integration, record, cfg));
    referencesFetched = true;
  }

  if (shouldFetchRequests) {
    const criteriaResult = await fetchOnOfficeSearchCriteria(integration, token, secret);
    const criteria = criteriaResult.records;
    providerRequestCount += criteriaResult.requestCount;
    providerPagesFetched += criteriaResult.pagesFetched;
    notes.push(`onOffice request diagnostic: ${criteria.length} Datensaetze nach Gesuchsfilter geladen.`);
    notes.push(`onOffice request paging: requests=${criteriaResult.requestCount}, pages=${criteriaResult.pagesFetched}`);
    notes.push(`onOffice request field catalog: ${criteriaResult.fieldCatalog.fields.length} Felder ueber searchCriteriaFields erkannt.`);
    notes.push(`onOffice request status-Werte: ${summarizeSearchCriteriaObservedValues(criteria, (record) => readSearchCriteriaMeta(record).status)}`);
    notes.push(`onOffice request status-Verteilung: ${summarizeSearchCriteriaDistribution(criteria, (record) => readSearchCriteriaMeta(record).status)}`);
    notes.push(`onOffice request vermarktungsart-Werte: ${summarizeSearchCriteriaObservedValues(criteria, (record) => readSearchCriteriaFieldValue(record, "vermarktungsart") ?? readSearchCriteriaFieldValue(record, "request_type"))}`);
    notes.push(`onOffice request vermarktungsart-Verteilung: ${summarizeSearchCriteriaDistribution(criteria, (record) => readSearchCriteriaFieldValue(record, "vermarktungsart") ?? readSearchCriteriaFieldValue(record, "request_type"))}`);
    notes.push(`onOffice request objektart-Werte: ${summarizeSearchCriteriaObservedValues(criteria, (record) => readSearchCriteriaFieldValue(record, "objektart"))}`);
    notes.push(`onOffice request objektart-Verteilung: ${summarizeSearchCriteriaDistribution(criteria, (record) => readSearchCriteriaFieldValue(record, "objektart"))}`);
    notes.push(`onOffice request region-Hinweise: ${summarizeSearchCriteriaObservedValues(criteria, (record) => readSearchCriteriaFieldValue(record, "regionaler_zusatz") ?? readSearchCriteriaRangeValue(record, "range_ort") ?? readSearchCriteriaMeta(record).publicnote)}`);
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
    diagnostics: {
      provider_request_count: providerRequestCount,
      provider_pages_fetched: providerPagesFetched,
      resource,
      mode: options?.mode,
    },
  };
}

export function mapOnOfficeEstate(
  partnerId: string,
  integration: PartnerIntegration,
  record: OnOfficeRecord,
): MappedOffer {
  return mapEstateToOffer(partnerId, integration, record);
}
