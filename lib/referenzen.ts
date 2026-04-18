import { createClient } from "@/utils/supabase/server";
import type { RequestMode } from "@/lib/gesuche";
import { normalizePublicLocale } from "@/lib/public-locale-routing";

export type RegionalReference = {
  id: string;
  partnerId: string;
  provider: string;
  externalId: string;
  title: string;
  description: string;
  imageUrl: string | null;
  city: string | null;
  district: string | null;
  locationText: string | null;
  transactionResult: string | null;
  objectType: string | null;
  areaSqm: number | null;
  rooms: number | null;
  updatedAt: string | null;
  statusBadge: string | null;
  offerType: "kauf" | "miete" | null;
  challengeText: string | null;
  challengeCategories: string[];
  lat: number | null;
  lng: number | null;
};

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);
}

function toApproximateCoordinate(value: number | null): number | null {
  if (value === null) return null;
  return Math.round(value * 100) / 100;
}

function parseReferenceCoordinates(
  normalizedPayload: Record<string, unknown> | null,
  sourcePayload: Record<string, unknown> | null,
): { lat: number | null; lng: number | null } {
  const normalizedLat = asNumber(normalizedPayload?.lat);
  const normalizedLng = asNumber(normalizedPayload?.lng);
  if (normalizedLat !== null && normalizedLng !== null) {
    return {
      lat: toApproximateCoordinate(normalizedLat),
      lng: toApproximateCoordinate(normalizedLng),
    };
  }

  const sourceLat = asNumber(sourcePayload?.lat) ?? asNumber(sourcePayload?.breitengrad);
  const sourceLng = asNumber(sourcePayload?.lng) ?? asNumber(sourcePayload?.laengengrad);
  return {
    lat: toApproximateCoordinate(sourceLat),
    lng: toApproximateCoordinate(sourceLng),
  };
}

function formatTransactionBadge(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === "reserviert") return "Reserviert";
  if (normalized === "verkauft") return "Verkauft";
  if (normalized === "vermietet") return "Vermietet";
  return null;
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function matchesReferenceFilters(
  normalizedPayload: Record<string, unknown> | null,
  objectType: string | null | undefined,
  mode: RequestMode | null | undefined,
): boolean {
  const normalizedObjectType = asText(normalizedPayload?.object_type).toLowerCase();
  if (objectType && normalizedObjectType && normalizedObjectType !== objectType.trim().toLowerCase()) {
    return false;
  }

  const offerType = asText(normalizedPayload?.offer_type).toLowerCase();
  if (mode === "miete") return offerType === "miete";
  if (mode === "kauf") return !offerType || offerType === "kauf";
  return true;
}

async function loadReferenceRowsForArea(args: {
  bundeslandSlug: string;
  kreisSlug: string;
  ortSlug?: string;
  locale?: string;
}): Promise<Array<Record<string, unknown>>> {
  const supabase = createClient();
  const normalizedLocale = normalizePublicLocale(args.locale);

  const areaQuery = supabase
    .from("areas")
    .select("id");

  const areaRes = args.ortSlug
    ? await areaQuery
        .eq("bundesland_slug", args.bundeslandSlug)
        .eq("parent_slug", args.kreisSlug)
        .eq("slug", args.ortSlug)
    : await areaQuery
        .eq("bundesland_slug", args.bundeslandSlug)
        .or(`slug.eq.${args.kreisSlug},parent_slug.eq.${args.kreisSlug}`);
  if (areaRes.error) return [];

  const areaIds = (areaRes.data ?? [])
    .map((row) => String((row as { id?: unknown }).id ?? ""))
    .filter(Boolean);
  if (areaIds.length === 0) return [];

  const { data: refRows, error: refError } = await supabase
    .from("public_reference_entries")
    .select("reference_id, partner_id, provider, external_id, title, description, image_url, city, district, location_text, source_updated_at")
    .in("visible_area_id", areaIds)
    .eq("locale", normalizedLocale)
    .order("source_updated_at", { ascending: false })
    .limit(80);
  if (refError) return [];
  return (refRows ?? []) as Array<Record<string, unknown>>;
}

async function hydrateRegionalReferences(
  baseRows: Array<Record<string, unknown>>,
  options?: {
    objectType?: string | null;
    mode?: RequestMode | null;
    limit?: number;
    randomize?: boolean;
    requireCoordinates?: boolean;
  },
): Promise<RegionalReference[]> {
  const limit = Math.max(1, Math.min(options?.limit ?? 6, 24));
  const requireCoordinates = options?.requireCoordinates === true;

  const supabase = createClient();
  const referenceIds = Array.from(
    new Set(
      baseRows
        .map((row) => String(row.reference_id ?? row.id ?? ""))
        .filter(Boolean),
    ),
  );

  const normalizedByReferenceId = new Map<
    string,
    { normalizedPayload: Record<string, unknown> | null; sourcePayload: Record<string, unknown> | null }
  >();
  if (referenceIds.length > 0) {
    const { data: normalizedRows, error: normalizedError } = await supabase
      .from("partner_references")
      .select("id, normalized_payload, source_payload")
      .in("id", referenceIds);
    if (!normalizedError) {
      for (const row of (normalizedRows ?? []) as Array<Record<string, unknown>>) {
        normalizedByReferenceId.set(String(row.id ?? ""), {
          normalizedPayload: (row.normalized_payload as Record<string, unknown> | null) ?? null,
          sourcePayload: (row.source_payload as Record<string, unknown> | null) ?? null,
        });
      }
    }
  }

  const seen = new Set<string>();
  const mapped: RegionalReference[] = [];
  for (const row of baseRows) {
    const referenceId = String(row.reference_id ?? row.id ?? "");
    if (!referenceId || seen.has(referenceId)) continue;

    const referencePayload = normalizedByReferenceId.get(referenceId) ?? {
      normalizedPayload: null,
      sourcePayload: null,
    };
    const normalizedPayload = referencePayload.normalizedPayload;
    if (!matchesReferenceFilters(normalizedPayload, options?.objectType, options?.mode)) continue;

    const coordinates = parseReferenceCoordinates(normalizedPayload, referencePayload.sourcePayload);
    if (requireCoordinates && (coordinates.lat === null || coordinates.lng === null)) continue;

    seen.add(referenceId);
    const transactionResult = asText(normalizedPayload?.transaction_result);
    const objectType = asText(normalizedPayload?.object_type);
    const areaSqm = asNumber(normalizedPayload?.area_sqm);
    const rooms = asNumber(normalizedPayload?.rooms);
    const offerTypeRaw = asText(normalizedPayload?.offer_type).toLowerCase();
    const challengeText = asText(normalizedPayload?.challenge_note_source) || null;
    const locationText =
      asText(row.location_text) ||
      asText(normalizedPayload?.location) ||
      [asText(row.city), asText(row.district)].filter(Boolean).join(" ") ||
      null;

    mapped.push({
      id: referenceId,
      partnerId: String(row.partner_id ?? ""),
      provider: String(row.provider ?? ""),
      externalId: String(row.external_id ?? ""),
      title: asText(row.title) || "Erfolgreich vermittelt",
      description: asText(row.description),
      imageUrl: asText(row.image_url) || null,
      city: asText(row.city) || null,
      district: asText(row.district) || null,
      locationText,
      transactionResult: transactionResult || null,
      objectType: objectType || null,
      areaSqm,
      rooms,
      updatedAt: asText(row.source_updated_at) || null,
      statusBadge: formatTransactionBadge(transactionResult),
      offerType: offerTypeRaw === "miete" ? "miete" : offerTypeRaw === "kauf" ? "kauf" : null,
      challengeText,
      challengeCategories: asStringArray(normalizedPayload?.challenge_categories),
      lat: coordinates.lat,
      lng: coordinates.lng,
    });
  }

  const output = options?.randomize ? shuffle(mapped) : mapped;
  return output.slice(0, limit);
}

export async function getRandomReferencesForKreis(args: {
  bundeslandSlug: string;
  kreisSlug: string;
  limit?: number;
  locale?: string;
}): Promise<RegionalReference[]> {
  const baseRows = await loadReferenceRowsForArea(args);
  return hydrateRegionalReferences(baseRows, {
    limit: args.limit,
    randomize: true,
  });
}

export async function getExperienceReferencesForRequest(args: {
  bundeslandSlug: string;
  kreisSlug: string;
  ortSlug?: string;
  objectType?: string | null;
  mode?: RequestMode | null;
  limit?: number;
  locale?: string;
}): Promise<RegionalReference[]> {
  const baseRows = await loadReferenceRowsForArea(args);
  return hydrateRegionalReferences(baseRows, {
    objectType: args.objectType,
    mode: args.mode,
    limit: args.limit ?? 12,
    requireCoordinates: true,
    randomize: false,
  });
}
