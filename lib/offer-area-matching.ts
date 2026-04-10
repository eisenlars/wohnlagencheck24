export type OfferAreaCandidate = {
  id: string;
  name?: string | null;
  slug?: string | null;
  parentSlug?: string | null;
  parentName?: string | null;
  bundeslandSlug?: string | null;
};

export type OfferGeoSignals = {
  zipCode: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
};

export type OfferAreaMatch = {
  areaId: string;
  score: number;
  confidence: "high" | "medium" | "low";
  source:
    | "postal_lookup"
    | "lat_lng_ready"
    | "zip_city"
    | "city_region"
    | "city_only"
    | "region_only"
    | "slug_only";
};

function asText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeText(value: string | null | undefined): string {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeSlugToken(value: string | null | undefined): string {
  return normalizeText(value).replace(/\s+/g, "-");
}

function isTruthyNumberPair(lat: number | null, lng: number | null): boolean {
  return lat !== null && lng !== null;
}

function scoreToConfidence(score: number): "high" | "medium" | "low" {
  if (score >= 90) return "high";
  if (score >= 60) return "medium";
  return "low";
}

export function extractOfferGeoSignals(
  raw: Record<string, unknown> | null | undefined,
): OfferGeoSignals {
  const data = (raw ?? {}) as Record<string, unknown>;
  return {
    zipCode: asText(data.zip_code),
    city: asText(data.city),
    region: asText(data.region),
    country: asText(data.country),
    lat: asNumber(data.lat),
    lng: asNumber(data.lng),
  };
}

export function rankOfferAreaMatches(
  signals: OfferGeoSignals,
  candidates: OfferAreaCandidate[],
  postalMatchedAreaIds?: Iterable<string>,
): OfferAreaMatch[] {
  const city = normalizeText(signals.city);
  const region = normalizeText(signals.region);
  const zipCode = normalizeText(signals.zipCode);
  const postalAreaIds = new Set(
    Array.from(postalMatchedAreaIds ?? [])
      .map((value) => asText(value))
      .filter((value): value is string => Boolean(value)),
  );

  const ranked = candidates
    .map((candidate) => {
      const areaId = String(candidate.id ?? "").trim();
      if (!areaId) return null;

      const areaName = normalizeText(candidate.name);
      const areaSlug = normalizeSlugToken(candidate.slug);
      const parentName = normalizeText(candidate.parentName);
      const parentSlug = normalizeSlugToken(candidate.parentSlug);

      let score = 0;
      let source: OfferAreaMatch["source"] | null = null;

      if (postalAreaIds.has(areaId)) {
        score = Math.max(score, areaId.split("-").length > 3 ? 99 : 97);
        source = "postal_lookup";
      }

      if (isTruthyNumberPair(signals.lat, signals.lng)) {
        score = 15;
        source = "lat_lng_ready";
      }

      if (zipCode && city && areaName && (city === areaName || city === parentName)) {
        score = Math.max(score, 95);
        source = "zip_city";
      }

      if (city && region) {
        const regionMatchesArea = region === areaName || region === areaSlug;
        const cityMatchesArea = city === areaName || city === areaSlug;
        const cityMatchesParent = city === parentName || city === parentSlug;

        if (regionMatchesArea && cityMatchesParent) {
          score = Math.max(score, 92);
          source = "city_region";
        } else if (cityMatchesArea && regionMatchesArea) {
          score = Math.max(score, 88);
          source = "city_region";
        }
      }

      if (city && (city === areaName || city === areaSlug || city === parentName || city === parentSlug)) {
        score = Math.max(score, 68);
        source = source ?? "city_only";
      }

      if (region && (region === areaName || region === areaSlug)) {
        score = Math.max(score, 62);
        source = source ?? "region_only";
      }

      if (areaSlug && (areaSlug === normalizeSlugToken(signals.city) || areaSlug === normalizeSlugToken(signals.region))) {
        score = Math.max(score, 55);
        source = source ?? "slug_only";
      }

      if (!source || score <= 0) return null;

      return {
        areaId,
        score,
        confidence: scoreToConfidence(score),
        source,
      } satisfies OfferAreaMatch;
    })
    .filter((entry): entry is OfferAreaMatch => Boolean(entry))
    .sort((a, b) => b.score - a.score || a.areaId.localeCompare(b.areaId));

  return ranked;
}

export function filterOfferAreaMatches(
  matches: OfferAreaMatch[],
  minScore = 60,
): OfferAreaMatch[] {
  return matches.filter((match) => match.score >= minScore);
}

export function getPrimaryOfferAreaMatch(
  signals: OfferGeoSignals,
  candidates: OfferAreaCandidate[],
): OfferAreaMatch | null {
  return rankOfferAreaMatches(signals, candidates)[0] ?? null;
}
