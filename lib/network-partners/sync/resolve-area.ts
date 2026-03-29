import { createAdminClient } from "@/utils/supabase/admin";
import type { PlacementCode } from "@/lib/network-partners/types";

export type NetworkPartnerPreviewBookingScope = {
  booking_id: string;
  portal_partner_id: string;
  area_id: string;
  placement_code: PlacementCode;
  area_name: string | null;
  area_slug: string | null;
  parent_slug: string | null;
  bundesland_slug: string | null;
};

export type NetworkPartnerAreaResolutionStatus = "exact_match" | "kreis_match" | "unresolved_area" | "not_booked";

export type NetworkPartnerAreaResolution = {
  status: NetworkPartnerAreaResolutionStatus;
  area_id: string | null;
  booking_id: string | null;
  matched_area_name: string | null;
  matched_area_slug: string | null;
  reason: string | null;
};

type AreaCandidate = {
  id: string;
  name: string | null;
  slug: string | null;
  parent_slug: string | null;
  bundesland_slug: string | null;
};

type ResolveAreaInput = {
  placementCode: PlacementCode;
  bookingScopes: NetworkPartnerPreviewBookingScope[];
  city?: string | null;
  district?: string | null;
  location?: string | null;
  regionTargets?: Array<{ city?: string | null; district?: string | null; label?: string | null }>;
};

const areaCandidateCache = new Map<string, AreaCandidate[]>();

function asText(value: unknown): string | null {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeSlug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => asText(value))
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

function extractCandidateNames(input: ResolveAreaInput): string[] {
  const targetLabels = (input.regionTargets ?? []).flatMap((target) => [
    asText(target.label),
    asText(target.city),
    asText(target.district),
    (() => {
      const city = asText(target.city);
      const district = asText(target.district);
      return city && district ? `${city} ${district}` : null;
    })(),
  ]);

  return uniqueStrings([
    input.city,
    input.district,
    input.location,
    (() => {
      const city = asText(input.city);
      const district = asText(input.district);
      return city && district ? `${city} ${district}` : null;
    })(),
    ...targetLabels,
  ]);
}

function extractCandidateSlugs(input: ResolveAreaInput): string[] {
  return uniqueStrings(extractCandidateNames(input)).map((value) => normalizeSlug(value)).filter(Boolean);
}

async function loadAreaCandidatesBySignals(input: ResolveAreaInput): Promise<AreaCandidate[]> {
  const candidateNames = extractCandidateNames(input);
  const candidateSlugs = extractCandidateSlugs(input);
  const cacheKey = JSON.stringify({ candidateNames, candidateSlugs });
  const cached = areaCandidateCache.get(cacheKey);
  if (cached) return cached;

  const admin = createAdminClient();
  const rows = new Map<string, AreaCandidate>();

  if (candidateSlugs.length > 0) {
    const { data, error } = await admin
      .from("areas")
      .select("id, name, slug, parent_slug, bundesland_slug")
      .in("slug", candidateSlugs);
    if (error) throw new Error(error.message ?? "AREA_LOOKUP_FAILED");

    for (const row of Array.isArray(data) ? data : []) {
      const candidate = row as Record<string, unknown>;
      const id = asText(candidate.id);
      if (!id) continue;
      rows.set(id, {
        id,
        name: asText(candidate.name),
        slug: asText(candidate.slug),
        parent_slug: asText(candidate.parent_slug),
        bundesland_slug: asText(candidate.bundesland_slug),
      });
    }
  }

  if (candidateNames.length > 0) {
    const { data, error } = await admin
      .from("areas")
      .select("id, name, slug, parent_slug, bundesland_slug")
      .in("name", candidateNames);
    if (error) throw new Error(error.message ?? "AREA_LOOKUP_FAILED");

    for (const row of Array.isArray(data) ? data : []) {
      const candidate = row as Record<string, unknown>;
      const id = asText(candidate.id);
      if (!id) continue;
      rows.set(id, {
        id,
        name: asText(candidate.name),
        slug: asText(candidate.slug),
        parent_slug: asText(candidate.parent_slug),
        bundesland_slug: asText(candidate.bundesland_slug),
      });
    }
  }

  const resolved = Array.from(rows.values());
  areaCandidateCache.set(cacheKey, resolved);
  return resolved;
}

export async function resolveAreaForNetworkPartnerPreview(
  input: ResolveAreaInput,
): Promise<NetworkPartnerAreaResolution> {
  const bookingScopes = input.bookingScopes.filter((scope) => scope.placement_code === input.placementCode);
  if (bookingScopes.length === 0) {
    return {
      status: "not_booked",
      area_id: null,
      booking_id: null,
      matched_area_name: null,
      matched_area_slug: null,
      reason: "no_matching_booking_scope",
    };
  }

  const candidateAreas = await loadAreaCandidatesBySignals(input);
  if (candidateAreas.length === 0) {
    return {
      status: "unresolved_area",
      area_id: null,
      booking_id: null,
      matched_area_name: null,
      matched_area_slug: null,
      reason: "no_area_candidates",
    };
  }

  for (const area of candidateAreas) {
    const exactBooking = bookingScopes.find((scope) => scope.area_id === area.id);
    if (exactBooking) {
      return {
        status: "exact_match",
        area_id: area.id,
        booking_id: exactBooking.booking_id,
        matched_area_name: area.name,
        matched_area_slug: area.slug,
        reason: null,
      };
    }
  }

  for (const area of candidateAreas) {
    const kreisBooking = bookingScopes.find((scope) => scope.area_slug && area.parent_slug && scope.area_slug === area.parent_slug);
    if (kreisBooking) {
      return {
        status: "kreis_match",
        area_id: kreisBooking.area_id,
        booking_id: kreisBooking.booking_id,
        matched_area_name: kreisBooking.area_name,
        matched_area_slug: kreisBooking.area_slug,
        reason: "matched_via_parent_slug",
      };
    }
  }

  return {
    status: "not_booked",
    area_id: null,
    booking_id: null,
    matched_area_name: null,
    matched_area_slug: null,
    reason: "area_found_but_not_booked",
  };
}
