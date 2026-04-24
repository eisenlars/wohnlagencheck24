import { getOrteForKreis, getReportBySlugs, readReportPostalCodes } from "@/lib/data";
import type { RequestDetail } from "@/lib/request-detail";
import { buildRequestMarketRangeContext, type RequestMarketRangeContext } from "@/lib/request-market-range";

type RegionTarget = {
  city: string;
  district: string | null;
  label: string;
};

type ResolverArgs = {
  request: Pick<RequestDetail, "regionTargets" | "regionTargetKeys">;
  bundeslandSlug: string;
  kreisSlug: string;
  ortSlug?: string;
};

type LocalityCandidate = {
  slug: string;
  label: string;
  context: RequestMarketRangeContext | null;
  normalizedNames: Set<string>;
  postalCodes: Set<string>;
};

export type ResolvedRequestMarketRange = {
  context: RequestMarketRangeContext;
  regionLabel: string;
  scope: "ortslage" | "kreis";
  source: "ort_route" | "region_target_key" | "postal_code" | "district_name" | "target_label" | "kreis_fallback";
};

function asText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

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

function isPostalCode(value: string | null | undefined): value is string {
  return typeof value === "string" && /^\d{5}$/.test(value.trim());
}

function readAreaDisplayName(meta: Record<string, unknown>, fallback: string): string {
  return (
    asText(meta.amtlicher_name)
    ?? asText(meta.name)
    ?? asText(meta.ortslage_name)
    ?? asText(meta.kreis_name)
    ?? fallback
  );
}

function buildNameVariants(target: RegionTarget): string[] {
  const rawDistrict = asText(target.district);
  const rawLabel = asText(target.label);
  const rawCity = asText(target.city);
  const withoutCityPrefix =
    rawLabel && rawCity && rawLabel.toLowerCase().startsWith(rawCity.toLowerCase())
      ? rawLabel.slice(rawCity.length).trim()
      : rawLabel;

  return [rawDistrict, rawLabel, withoutCityPrefix]
    .filter((value): value is string => Boolean(value))
    .map((value) => normalizeText(value))
    .filter(Boolean);
}

async function loadLocalityCandidates(
  bundeslandSlug: string,
  kreisSlug: string,
): Promise<LocalityCandidate[]> {
  const localities = await getOrteForKreis(bundeslandSlug, kreisSlug);
  const reports = await Promise.all(
    localities.map(async (locality) => ({
      slug: locality.slug,
      report: await getReportBySlugs([bundeslandSlug, kreisSlug, locality.slug]),
    })),
  );

  return reports
    .map((entry) => {
      const meta = ((entry.report?.meta ?? {}) as Record<string, unknown>);
      const label = readAreaDisplayName(meta, entry.slug);
      const normalizedNames = new Set(
        [entry.slug, label, asText(meta.ortslage_name), asText(meta.name), asText(meta.amtlicher_name)]
          .filter((value): value is string => Boolean(value))
          .map((value) => normalizeText(value))
          .filter(Boolean),
      );
      const postalCodes = new Set(readReportPostalCodes(meta));
      return {
        slug: entry.slug,
        label,
        context: buildRequestMarketRangeContext(entry.report),
        normalizedNames,
        postalCodes,
      } satisfies LocalityCandidate;
    })
    .filter((candidate) => candidate.context !== null);
}

function matchByTargetKey(
  candidates: LocalityCandidate[],
  targetKeys: string[],
): LocalityCandidate | null {
  if (targetKeys.length === 0) return null;
  const normalizedKeys = targetKeys.map((key) => key.trim().toLowerCase()).filter(Boolean);
  for (const candidate of candidates) {
    for (const name of candidate.normalizedNames) {
      const suffix = `::${normalizeKeyPart(name)}`;
      if (normalizedKeys.some((key) => key.endsWith(suffix))) {
        return candidate;
      }
    }
  }
  return null;
}

function matchByPostalCode(
  candidates: LocalityCandidate[],
  targets: RegionTarget[],
): LocalityCandidate | null {
  const postalTargets = targets
    .map((target) => asText(target.district))
    .filter((value): value is string => isPostalCode(value));
  if (postalTargets.length === 0) return null;
  for (const postalCode of postalTargets) {
    const match = candidates.find((candidate) => candidate.postalCodes.has(postalCode));
    if (match) return match;
  }
  return null;
}

function matchByNames(
  candidates: LocalityCandidate[],
  targets: RegionTarget[],
): LocalityCandidate | null {
  for (const target of targets) {
    const variants = buildNameVariants(target);
    for (const variant of variants) {
      const direct = candidates.find((candidate) => candidate.normalizedNames.has(variant));
      if (direct) return direct;
      const inclusive = candidates.find((candidate) =>
        Array.from(candidate.normalizedNames).some((name) => variant.includes(name) || name.includes(variant)),
      );
      if (inclusive) return inclusive;
    }
  }
  return null;
}

export async function resolveRequestMarketRangeForRoute(
  args: ResolverArgs,
): Promise<ResolvedRequestMarketRange | null> {
  if (args.ortSlug) {
    const ortReport = await getReportBySlugs([args.bundeslandSlug, args.kreisSlug, args.ortSlug]);
    const ortContext = buildRequestMarketRangeContext(ortReport);
    if (ortContext) {
      const ortMeta = ((ortReport?.meta ?? {}) as Record<string, unknown>);
      return {
        context: ortContext,
        regionLabel: readAreaDisplayName(ortMeta, args.ortSlug),
        scope: "ortslage",
        source: "ort_route",
      };
    }
  }

  const candidates = await loadLocalityCandidates(args.bundeslandSlug, args.kreisSlug);
  const targetKeyMatch = matchByTargetKey(candidates, args.request.regionTargetKeys);
  if (targetKeyMatch?.context) {
    return {
      context: targetKeyMatch.context,
      regionLabel: targetKeyMatch.label,
      scope: "ortslage",
      source: "region_target_key",
    };
  }

  const postalCodeMatch = matchByPostalCode(candidates, args.request.regionTargets);
  if (postalCodeMatch?.context) {
    return {
      context: postalCodeMatch.context,
      regionLabel: postalCodeMatch.label,
      scope: "ortslage",
      source: "postal_code",
    };
  }

  const nameMatch = matchByNames(candidates, args.request.regionTargets);
  if (nameMatch?.context) {
    return {
      context: nameMatch.context,
      regionLabel: nameMatch.label,
      scope: "ortslage",
      source: asText(args.request.regionTargets[0]?.district) ? "district_name" : "target_label",
    };
  }

  const kreisReport = await getReportBySlugs([args.bundeslandSlug, args.kreisSlug]);
  const kreisContext = buildRequestMarketRangeContext(kreisReport);
  if (!kreisContext) return null;
  const kreisMeta = ((kreisReport?.meta ?? {}) as Record<string, unknown>);
  return {
    context: kreisContext,
    regionLabel: readAreaDisplayName(kreisMeta, args.kreisSlug),
    scope: "kreis",
    source: "kreis_fallback",
  };
}
