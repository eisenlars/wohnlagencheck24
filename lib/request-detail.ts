import { createClient } from "@/utils/supabase/server";
import { normalizePublicLocale } from "@/lib/public-locale-routing";
import { matchRequestImage } from "@/lib/request-image-matching";
import type { RegionalRequest, RequestMode } from "@/lib/gesuche";

export type RequestDetail = RegionalRequest & {
  seoTitle: string | null;
  seoDescription: string | null;
  seoH1: string | null;
};

type KreisArgs = {
  bundeslandSlug: string;
  kreisSlug: string;
  requestId: string;
  locale?: string;
  mode: RequestMode;
};

type OrtArgs = {
  bundeslandSlug: string;
  kreisSlug: string;
  ortSlug: string;
  requestId: string;
  locale?: string;
  mode: RequestMode;
};

function normalizeText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeKeyPart(value: string): string {
  return normalizeText(value).replace(/\s+/g, "_");
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function parseRegionTargets(payload: Record<string, unknown>): Array<{ city: string; district: string | null; label: string }> {
  const raw = payload.region_targets;
  if (!Array.isArray(raw)) return [];
  const out: Array<{ city: string; district: string | null; label: string }> = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const obj = entry as Record<string, unknown>;
    const city = String(obj.city ?? "").trim();
    const districtRaw = String(obj.district ?? "").trim();
    const district = districtRaw.length > 0 ? districtRaw : null;
    const label = String(obj.label ?? "").trim() || [city, district].filter(Boolean).join(" ");
    if (!city && !label) continue;
    out.push({ city, district, label });
  }
  return out;
}

function parseRegionTargetKeys(payload: Record<string, unknown>): string[] {
  const raw = payload.region_target_keys;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((v) => String(v ?? "").trim().toLowerCase())
    .filter(Boolean);
}

async function resolveKreisAreaScope(
  bundeslandSlug: string,
  kreisSlug: string,
): Promise<{ kreisAreaId: string | null; kreisName: string | null; areaIds: string[] }> {
  const supabase = createClient();
  const { data: areaRows, error } = await supabase
    .from("areas")
    .select("id, name, slug, parent_slug")
    .eq("bundesland_slug", bundeslandSlug)
    .or(`slug.eq.${kreisSlug},parent_slug.eq.${kreisSlug}`);

  if (error) {
    return { kreisAreaId: null, kreisName: null, areaIds: [] };
  }

  const rows = (areaRows ?? []) as Array<Record<string, unknown>>;
  const kreisRow = rows.find((row) => String(row.slug ?? "") === kreisSlug) ?? null;
  return {
    kreisAreaId: String(kreisRow?.id ?? "") || null,
    kreisName: String(kreisRow?.name ?? "") || null,
    areaIds: rows.map((row) => String(row.id ?? "")).filter(Boolean),
  };
}

async function fetchProjectedRequestRows(
  areaIds: string[],
  locale: string,
  requestId: string,
): Promise<Array<Record<string, unknown>>> {
  if (areaIds.length === 0) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("public_request_entries")
    .select("request_id, partner_id, provider, external_id, title, seo_title, seo_description, seo_h1, short_description, long_description, location_text, request_type, object_type, object_subtype, min_rooms, max_rooms, min_area_sqm, max_area_sqm, min_living_area_sqm, max_living_area_sqm, min_price, max_price, radius_km, region_targets, region_target_keys, source_updated_at")
    .in("visible_area_id", areaIds)
    .eq("locale", locale)
    .eq("is_live", true)
    .eq("request_id", requestId)
    .order("source_updated_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as Array<Record<string, unknown>>;
}

function buildRequestDetail(record: Record<string, unknown>, requestId: string, requestType: RequestMode): RequestDetail {
  const payload = record as Record<string, unknown>;
  const regionTargets = parseRegionTargets(payload);
  const title = String(record.title ?? "");
  const description = String(record.long_description ?? record.short_description ?? "").trim() || null;
  const locationText = String(record.location_text ?? "").trim() || null;
  const objectType = payload.object_type ? String(payload.object_type) : null;
  const objectSubtype = payload.object_subtype ? String(payload.object_subtype) : null;
  const minRooms = toFiniteNumber(payload.min_rooms);
  const maxRooms = toFiniteNumber(payload.max_rooms);
  const minAreaSqm = toFiniteNumber(payload.min_area_sqm) ?? toFiniteNumber(payload.min_living_area_sqm);
  const maxAreaSqm = toFiniteNumber(payload.max_area_sqm) ?? toFiniteNumber(payload.max_living_area_sqm);
  const minPrice = toFiniteNumber(payload.min_price);
  const maxPrice = toFiniteNumber(payload.max_price);
  const radiusKm = toFiniteNumber(payload.radius_km);
  const imageMatch = matchRequestImage({
    requestType,
    objectType,
    objectSubtype,
    minRooms,
    maxRooms,
    minAreaSqm,
    maxAreaSqm,
    minPrice,
    maxPrice,
    radiusKm,
    regionLabels: regionTargets.map((target) => target.label),
    textContexts: [title, description ?? "", locationText ?? ""],
  });

  return {
    id: requestId,
    partnerId: String(record.partner_id ?? ""),
    provider: String(record.provider ?? ""),
    externalId: String(record.external_id ?? ""),
    title,
    description,
    locationText,
    requestType,
    objectType,
    objectSubtype,
    minRooms,
    maxRooms,
    minAreaSqm,
    maxAreaSqm,
    minPrice,
    maxPrice,
    radiusKm,
    regionTargets,
    updatedAt: record.source_updated_at ? String(record.source_updated_at) : null,
    imageUrl: imageMatch.primary?.imageUrl ?? null,
    imageAlt: imageMatch.primary?.alt ?? null,
    imageTitle: imageMatch.primary?.title ?? null,
    audiencePersona: imageMatch.profile.persona,
    audienceEnvironment: imageMatch.profile.environment,
    audienceSignals: imageMatch.profile.signals,
    seoTitle: typeof record.seo_title === "string" ? record.seo_title : null,
    seoDescription: typeof record.seo_description === "string" ? record.seo_description : null,
    seoH1: typeof record.seo_h1 === "string" ? record.seo_h1 : null,
  };
}

function findMatchingModeRow(
  rows: Array<Record<string, unknown>>,
  mode: RequestMode,
): Record<string, unknown> | null {
  return rows.find((row) => (String(row.request_type ?? "").toLowerCase() === "miete" ? "miete" : "kauf") === mode) ?? null;
}

export async function getRegionalRequestByIdForKreis(args: KreisArgs): Promise<RequestDetail | null> {
  const normalizedLocale = normalizePublicLocale(args.locale);
  const scope = await resolveKreisAreaScope(args.bundeslandSlug, args.kreisSlug);
  if (scope.areaIds.length === 0) return null;

  let rows = await fetchProjectedRequestRows(scope.areaIds, normalizedLocale, args.requestId);
  let matchingRow = findMatchingModeRow(rows, args.mode);
  if (!matchingRow && normalizedLocale !== "de") {
    rows = await fetchProjectedRequestRows(scope.areaIds, "de", args.requestId);
    matchingRow = findMatchingModeRow(rows, args.mode);
  }
  if (!matchingRow) return null;
  const requestType = String(matchingRow.request_type ?? "").toLowerCase() === "miete" ? "miete" : "kauf";
  return buildRequestDetail(matchingRow, args.requestId, requestType);
}

export async function getRegionalRequestByIdForOrtslage(args: OrtArgs): Promise<RequestDetail | null> {
  const supabase = createClient();
  const normalizedLocale = normalizePublicLocale(args.locale);
  const { data: ortArea, error } = await supabase
    .from("areas")
    .select("id, name")
    .eq("slug", args.ortSlug)
    .eq("parent_slug", args.kreisSlug)
    .eq("bundesland_slug", args.bundeslandSlug)
    .limit(1)
    .maybeSingle();
  if (error || !ortArea) return null;

  const scope = await resolveKreisAreaScope(args.bundeslandSlug, args.kreisSlug);
  if (scope.areaIds.length === 0) return null;

  const cityName = String(scope.kreisName ?? "").trim();
  const districtName = String(ortArea.name ?? "").trim();
  const directTargetKey = `${normalizeKeyPart(cityName)}::${normalizeKeyPart(districtName)}`;

  const pickOrtRow = (rows: Array<Record<string, unknown>>) =>
    rows.find((row) => {
      const requestType = String(row.request_type ?? "").toLowerCase() === "miete" ? "miete" : "kauf";
      if (requestType !== args.mode) return false;
      const payload = row as Record<string, unknown>;
      const keys = parseRegionTargetKeys(payload);
      const targets = parseRegionTargets(payload);
      const matchesByKey = keys.includes(directTargetKey);
      const matchesByTarget = targets.some((target) => {
        const c = normalizeKeyPart(target.city || cityName);
        const d = normalizeKeyPart(target.district || "");
        return `${c}::${d}` === directTargetKey;
      });
      return matchesByKey || matchesByTarget;
    }) ?? null;

  let rows = await fetchProjectedRequestRows(scope.areaIds, normalizedLocale, args.requestId);
  let matchingRow = pickOrtRow(rows);
  if (!matchingRow && normalizedLocale !== "de") {
    rows = await fetchProjectedRequestRows(scope.areaIds, "de", args.requestId);
    matchingRow = pickOrtRow(rows);
  }
  if (!matchingRow) return null;
  const requestType = String(matchingRow.request_type ?? "").toLowerCase() === "miete" ? "miete" : "kauf";
  return buildRequestDetail(matchingRow, args.requestId, requestType);
}
