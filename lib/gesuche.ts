import { createClient } from "@/utils/supabase/server";

export type RequestMode = "kauf" | "miete";

export type RegionalRequest = {
  id: string;
  partnerId: string;
  provider: string;
  externalId: string;
  title: string;
  requestType: RequestMode;
  objectType: string | null;
  minRooms: number | null;
  maxPrice: number | null;
  regionTargets: Array<{ city: string; district: string | null; label: string }>;
  updatedAt: string | null;
};

type GetRegionalRequestsArgs = {
  bundeslandSlug: string;
  kreisSlug: string;
  ortSlug: string;
  mode: RequestMode;
  limit?: number;
};

type GetKreisRequestsArgs = {
  bundeslandSlug: string;
  kreisSlug: string;
  mode: RequestMode;
  limit?: number;
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

async function resolveKreisAndPartnerScope(
  bundeslandSlug: string,
  kreisSlug: string,
): Promise<{
  kreisAreaId: string | null;
  kreisName: string | null;
  partnerIds: string[];
  areaIds: string[];
}> {
  const supabase = createClient();
  const { data: areaRows, error: areasError } = await supabase
    .from("areas")
    .select("id, name, slug, parent_slug")
    .eq("bundesland_slug", bundeslandSlug)
    .or(`slug.eq.${kreisSlug},parent_slug.eq.${kreisSlug}`);

  if (areasError) {
    return { kreisAreaId: null, kreisName: null, partnerIds: [], areaIds: [] };
  }

  const rows = (areaRows ?? []) as Array<Record<string, unknown>>;
  const kreisRow = rows.find((row) => String(row.slug ?? "") === kreisSlug) ?? null;
  const areaIds = rows.map((row) => String(row.id ?? "")).filter(Boolean);

  if (areaIds.length === 0) {
    return { kreisAreaId: null, kreisName: null, partnerIds: [], areaIds: [] };
  }

  const { data: partnerRows, error: partnerError } = await supabase
    .from("partner_area_map")
    .select("auth_user_id")
    .in("area_id", areaIds)
    .eq("is_active", true);

  if (partnerError) {
    return { kreisAreaId: String(kreisRow?.id ?? "") || null, kreisName: String(kreisRow?.name ?? "") || null, partnerIds: [], areaIds };
  }

  const partnerIds = (partnerRows ?? [])
    .map((row) => String((row as { auth_user_id?: unknown }).auth_user_id ?? ""))
    .filter(Boolean);

  return {
    kreisAreaId: String(kreisRow?.id ?? "") || null,
    kreisName: String(kreisRow?.name ?? "") || null,
    partnerIds,
    areaIds,
  };
}

async function fetchRequestsByPartners(
  partnerIds: string[],
  limit: number,
): Promise<Array<Record<string, unknown>>> {
  if (partnerIds.length === 0) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("partner_requests")
    .select("id, partner_id, provider, external_id, title, normalized_payload, updated_at")
    .in("partner_id", partnerIds)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as Array<Record<string, unknown>>;
}

function mapRowsToRegionalRequests(
  rows: Array<Record<string, unknown>>,
  mode: RequestMode,
): RegionalRequest[] {
  const out: RegionalRequest[] = [];
  for (const record of rows) {
    const payload = (record.normalized_payload ?? {}) as Record<string, unknown>;
    const requestType = String(payload.request_type ?? "").toLowerCase() === "miete" ? "miete" : "kauf";
    if (requestType !== mode) continue;
    const targets = parseRegionTargets(payload);
    out.push({
      id: String(record.id ?? ""),
      partnerId: String(record.partner_id ?? ""),
      provider: String(record.provider ?? ""),
      externalId: String(record.external_id ?? ""),
      title: String(record.title ?? payload.title ?? ""),
      requestType,
      objectType: payload.object_type ? String(payload.object_type) : null,
      minRooms: toFiniteNumber(payload.min_rooms),
      maxPrice: toFiniteNumber(payload.max_price),
      regionTargets: targets,
      updatedAt: record.updated_at ? String(record.updated_at) : null,
    });
  }
  return out;
}

export async function getRegionalRequestsForKreis(
  args: GetKreisRequestsArgs,
): Promise<RegionalRequest[]> {
  const scope = await resolveKreisAndPartnerScope(args.bundeslandSlug, args.kreisSlug);
  if (scope.partnerIds.length === 0) return [];
  const rows = await fetchRequestsByPartners(scope.partnerIds, Math.max(1, Math.min(args.limit ?? 40, 200)));
  return mapRowsToRegionalRequests(rows, args.mode);
}

export async function getRegionalRequestsForOrtslage(
  args: GetRegionalRequestsArgs,
): Promise<RegionalRequest[]> {
  const supabase = createClient();

  const { data: ortArea, error: ortError } = await supabase
    .from("areas")
    .select("id, name")
    .eq("slug", args.ortSlug)
    .eq("parent_slug", args.kreisSlug)
    .eq("bundesland_slug", args.bundeslandSlug)
    .limit(1)
    .maybeSingle();

  if (ortError || !ortArea) return [];

  const scope = await resolveKreisAndPartnerScope(args.bundeslandSlug, args.kreisSlug);
  if (scope.partnerIds.length === 0) return [];
  const rows = await fetchRequestsByPartners(scope.partnerIds, Math.max(1, Math.min(args.limit ?? 24, 120)));

  const cityName = String((scope.kreisName ?? "")).trim() || "Leipzig";
  const districtName = String((ortArea.name ?? "")).trim();
  const directTargetKey = `${normalizeKeyPart(cityName)}::${normalizeKeyPart(districtName)}`;

  const out: RegionalRequest[] = [];
  for (const record of rows) {
    const payload = (record.normalized_payload ?? {}) as Record<string, unknown>;
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

    out.push({
      id: String(record.id ?? ""),
      partnerId: String(record.partner_id ?? ""),
      provider: String(record.provider ?? ""),
      externalId: String(record.external_id ?? ""),
      title: String(record.title ?? payload.title ?? ""),
      requestType,
      objectType: payload.object_type ? String(payload.object_type) : null,
      minRooms: toFiniteNumber(payload.min_rooms),
      maxPrice: toFiniteNumber(payload.max_price),
      regionTargets: targets,
      updatedAt: record.updated_at ? String(record.updated_at) : null,
    });
  }

  return out;
}
