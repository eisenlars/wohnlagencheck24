import { createClient } from "@/utils/supabase/server";
import { normalizePublicLocale } from "@/lib/public-locale-routing";

export type RequestMode = "kauf" | "miete";

export type RegionalRequest = {
  id: string;
  partnerId: string;
  provider: string;
  externalId: string;
  title: string;
  description: string | null;
  locationText: string | null;
  requestType: RequestMode;
  objectType: string | null;
  minRooms: number | null;
  maxPrice: number | null;
  regionTargets: Array<{ city: string; district: string | null; label: string }>;
  updatedAt: string | null;
};

export type RegionalRequestResult = {
  requests: RegionalRequest[];
  sourceCount: number;
};

type GetRegionalRequestsArgs = {
  bundeslandSlug: string;
  kreisSlug: string;
  ortSlug: string;
  mode: RequestMode;
  limit?: number;
  locale?: string;
};

type GetKreisRequestsArgs = {
  bundeslandSlug: string;
  kreisSlug: string;
  mode: RequestMode;
  limit?: number;
  locale?: string;
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
): Promise<{
  kreisAreaId: string | null;
  kreisName: string | null;
  areaIds: string[];
}> {
  const supabase = createClient();
  const { data: areaRows, error: areasError } = await supabase
    .from("areas")
    .select("id, name, slug, parent_slug")
    .eq("bundesland_slug", bundeslandSlug)
    .or(`slug.eq.${kreisSlug},parent_slug.eq.${kreisSlug}`);

  if (areasError) {
    return { kreisAreaId: null, kreisName: null, areaIds: [] };
  }

  const rows = (areaRows ?? []) as Array<Record<string, unknown>>;
  const kreisRow = rows.find((row) => String(row.slug ?? "") === kreisSlug) ?? null;
  const areaIds = rows.map((row) => String(row.id ?? "")).filter(Boolean);

  if (areaIds.length === 0) {
    return { kreisAreaId: null, kreisName: null, areaIds: [] };
  }

  return {
    kreisAreaId: String(kreisRow?.id ?? "") || null,
    kreisName: String(kreisRow?.name ?? "") || null,
    areaIds,
  };
}

async function fetchProjectedRequests(
  areaIds: string[],
  locale: string,
  limit: number,
): Promise<Array<Record<string, unknown>>> {
  if (areaIds.length === 0) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("public_request_entries")
    .select("request_id, partner_id, provider, external_id, title, short_description, long_description, location_text, request_type, object_type, min_rooms, max_price, region_targets, region_target_keys, source_updated_at")
    .in("visible_area_id", areaIds)
    .eq("locale", locale)
    .order("source_updated_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as Array<Record<string, unknown>>;
}

function mapRowsToRegionalRequests(
  rows: Array<Record<string, unknown>>,
  mode: RequestMode,
): RegionalRequest[] {
  const out: RegionalRequest[] = [];
  const seen = new Set<string>();
  for (const record of rows) {
    const requestId = String(record.request_id ?? record.id ?? "");
    if (!requestId || seen.has(requestId)) continue;
    const requestType = String(record.request_type ?? "").toLowerCase() === "miete" ? "miete" : "kauf";
    if (requestType !== mode) continue;
    const payload = record as Record<string, unknown>;
    const targets = parseRegionTargets(payload);
    seen.add(requestId);
    out.push({
      id: requestId,
      partnerId: String(record.partner_id ?? ""),
      provider: String(record.provider ?? ""),
      externalId: String(record.external_id ?? ""),
      title: String(record.title ?? ""),
      description: String(record.short_description ?? record.long_description ?? "").trim() || null,
      locationText: String(record.location_text ?? "").trim() || null,
      requestType,
      objectType: payload.object_type ? String(payload.object_type) : null,
      minRooms: toFiniteNumber(payload.min_rooms),
      maxPrice: toFiniteNumber(payload.max_price),
      regionTargets: targets,
      updatedAt: record.source_updated_at ? String(record.source_updated_at) : null,
    });
  }
  return out;
}

export async function getRegionalRequestsForKreis(
  args: GetKreisRequestsArgs,
): Promise<RegionalRequestResult> {
  const normalizedLocale = normalizePublicLocale(args.locale);
  const scope = await resolveKreisAreaScope(args.bundeslandSlug, args.kreisSlug);
  if (scope.areaIds.length === 0) return { requests: [], sourceCount: 0 };
  const rows = await fetchProjectedRequests(
    scope.areaIds,
    normalizedLocale,
    Math.max(1, Math.min(args.limit ?? 80, 240)),
  );
  const sourceRows = normalizedLocale === "de"
    ? rows
    : await fetchProjectedRequests(scope.areaIds, "de", Math.max(1, Math.min(args.limit ?? 80, 240)));
  const sourceRequests = mapRowsToRegionalRequests(sourceRows, args.mode);
  return {
    requests: mapRowsToRegionalRequests(rows, args.mode),
    sourceCount: sourceRequests.length,
  };
}

export async function getRegionalRequestsForOrtslage(
  args: GetRegionalRequestsArgs,
): Promise<RegionalRequestResult> {
  const supabase = createClient();

  const { data: ortArea, error: ortError } = await supabase
    .from("areas")
    .select("id, name")
    .eq("slug", args.ortSlug)
    .eq("parent_slug", args.kreisSlug)
    .eq("bundesland_slug", args.bundeslandSlug)
    .limit(1)
    .maybeSingle();

  if (ortError || !ortArea) return { requests: [], sourceCount: 0 };

  const normalizedLocale = normalizePublicLocale(args.locale);
  const scope = await resolveKreisAreaScope(args.bundeslandSlug, args.kreisSlug);
  if (scope.areaIds.length === 0) return { requests: [], sourceCount: 0 };
  const rows = await fetchProjectedRequests(
    scope.areaIds,
    normalizedLocale,
    Math.max(1, Math.min(args.limit ?? 60, 240)),
  );
  const sourceRows = normalizedLocale === "de"
    ? rows
    : await fetchProjectedRequests(scope.areaIds, "de", Math.max(1, Math.min(args.limit ?? 60, 240)));

  const cityName = String((scope.kreisName ?? "")).trim() || "Leipzig";
  const districtName = String((ortArea.name ?? "")).trim();
  const directTargetKey = `${normalizeKeyPart(cityName)}::${normalizeKeyPart(districtName)}`;

  const out: RegionalRequest[] = [];
  const seen = new Set<string>();
  let sourceCount = 0;
  const countSeen = new Set<string>();
  for (const record of sourceRows) {
    const payload = record as Record<string, unknown>;
    const requestId = String(record.request_id ?? record.id ?? "");
    if (!requestId || countSeen.has(requestId)) continue;
    const requestType = String(payload.request_type ?? "").toLowerCase() === "miete" ? "miete" : "kauf";
    if (requestType !== args.mode) continue;

    const keys = parseRegionTargetKeys(payload);
    const targets = parseRegionTargets(payload);

    const matchesByKey = keys.includes(directTargetKey);
    const matchesByTarget = targets.some((target) => {
      const c = normalizeKeyPart(target.city || cityName);
      const d = normalizeKeyPart(target.district || "");
      return `${c}::${d}` === directTargetKey;
    });

    if (!matchesByKey && !matchesByTarget) continue;
    countSeen.add(requestId);
    sourceCount += 1;
  }

  for (const record of rows) {
    const payload = record as Record<string, unknown>;
    const requestId = String(record.request_id ?? record.id ?? "");
    if (!requestId || seen.has(requestId)) continue;
    const requestType = String(payload.request_type ?? "").toLowerCase() === "miete" ? "miete" : "kauf";
    if (requestType !== args.mode) continue;

    const keys = parseRegionTargetKeys(payload);
    const targets = parseRegionTargets(payload);

    const matchesByKey = keys.includes(directTargetKey);
    const matchesByTarget = targets.some((target) => {
      const c = normalizeKeyPart(target.city || cityName);
      const d = normalizeKeyPart(target.district || "");
      return `${c}::${d}` === directTargetKey;
    });

    if (!matchesByKey && !matchesByTarget) continue;
    seen.add(requestId);

    out.push({
      id: requestId,
      partnerId: String(record.partner_id ?? ""),
      provider: String(record.provider ?? ""),
      externalId: String(record.external_id ?? ""),
      title: String(record.title ?? ""),
      requestType,
      objectType: payload.object_type ? String(payload.object_type) : null,
      minRooms: toFiniteNumber(payload.min_rooms),
      maxPrice: toFiniteNumber(payload.max_price),
      regionTargets: targets,
      updatedAt: record.source_updated_at ? String(record.source_updated_at) : null,
    });
  }

  return { requests: out, sourceCount };
}
