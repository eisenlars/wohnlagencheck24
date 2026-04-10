import { getOrteForKreis, getReportBySlugs, readReportPostalCodes } from "@/lib/data";

export type ReportPostalLookupTarget = {
  bundeslandSlug: string;
  kreisSlug: string;
};

export type ReportPostalLookupEntry = {
  areaId: string;
  areaName: string | null;
  areaSlug: string | null;
  parentAreaId: string | null;
  parentSlug: string | null;
  bundeslandSlug: string | null;
  scope: "kreis" | "ortslage";
};

const districtPostalLookupCache = new Map<string, Promise<Map<string, ReportPostalLookupEntry[]>>>();

function asText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizePostalCode(value: unknown): string | null {
  const normalized = asText(value)?.replace(/\s+/g, "") ?? null;
  return normalized && normalized.length > 0 ? normalized : null;
}

function appendPostalEntry(
  target: Map<string, ReportPostalLookupEntry[]>,
  postalCode: string,
  entry: ReportPostalLookupEntry,
): void {
  const bucket = target.get(postalCode) ?? [];
  const dedupeKey = `${entry.areaId}::${entry.parentAreaId ?? ""}::${entry.scope}`;
  if (!bucket.some((candidate) => `${candidate.areaId}::${candidate.parentAreaId ?? ""}::${candidate.scope}` === dedupeKey)) {
    bucket.push(entry);
    target.set(postalCode, bucket);
  }
}

function mergePostalLookups(
  maps: Array<Map<string, ReportPostalLookupEntry[]>>,
): Map<string, ReportPostalLookupEntry[]> {
  const merged = new Map<string, ReportPostalLookupEntry[]>();
  for (const map of maps) {
    for (const [postalCode, entries] of map.entries()) {
      for (const entry of entries) {
        appendPostalEntry(merged, postalCode, entry);
      }
    }
  }
  return merged;
}

function uniqueTargets(targets: ReportPostalLookupTarget[]): ReportPostalLookupTarget[] {
  type PostalTargetEntry = readonly [
    `${string}/${string}`,
    { readonly bundeslandSlug: string; readonly kreisSlug: string },
  ];

  const entries = targets
    .map((target) => {
      const bundeslandSlug = asText(target.bundeslandSlug);
      const kreisSlug = asText(target.kreisSlug);
      if (!bundeslandSlug || !kreisSlug) return null;
      return [`${bundeslandSlug}/${kreisSlug}`, { bundeslandSlug, kreisSlug }] as const;
    })
    .filter((entry): entry is PostalTargetEntry => entry !== null);

  return Array.from(
    new Map(entries).values(),
  );
}

async function loadPostalLookupForDistrict(
  target: ReportPostalLookupTarget,
): Promise<Map<string, ReportPostalLookupEntry[]>> {
  const lookup = new Map<string, ReportPostalLookupEntry[]>();
  const districtReport = await getReportBySlugs([target.bundeslandSlug, target.kreisSlug]);
  const districtMeta = (districtReport?.meta ?? {}) as Record<string, unknown>;
  const districtAreaId = asText(districtMeta.kreis_schluessel);
  const districtAreaName =
    asText(districtMeta.amtlicher_name)
    ?? asText(districtMeta.name)
    ?? asText(districtMeta.kreis_name)
    ?? null;

  if (districtAreaId) {
    for (const postalCode of readReportPostalCodes(districtMeta)) {
      appendPostalEntry(lookup, postalCode, {
        areaId: districtAreaId,
        areaName: districtAreaName,
        areaSlug: target.kreisSlug,
        parentAreaId: null,
        parentSlug: null,
        bundeslandSlug: target.bundeslandSlug,
        scope: "kreis",
      });
    }
  }

  const localities = await getOrteForKreis(target.bundeslandSlug, target.kreisSlug);
  const localityReports = await Promise.all(
    localities.map(async (locality) => ({
      ortSlug: locality.slug,
      report: await getReportBySlugs([target.bundeslandSlug, target.kreisSlug, locality.slug]),
    })),
  );

  for (const localityEntry of localityReports) {
    const localityMeta = (localityEntry.report?.meta ?? {}) as Record<string, unknown>;
    const localityAreaId = asText(localityMeta.ortslage_schluessel);
    if (!localityAreaId) continue;

    const localityAreaName =
      asText(localityMeta.amtlicher_name)
      ?? asText(localityMeta.name)
      ?? asText(localityMeta.ortslage_name)
      ?? null;

    for (const postalCode of readReportPostalCodes(localityMeta)) {
      appendPostalEntry(lookup, postalCode, {
        areaId: localityAreaId,
        areaName: localityAreaName,
        areaSlug: localityEntry.ortSlug,
        parentAreaId: asText(localityMeta.kreis_schluessel) ?? districtAreaId,
        parentSlug: target.kreisSlug,
        bundeslandSlug: target.bundeslandSlug,
        scope: "ortslage",
      });
    }
  }

  return lookup;
}

export async function loadReportPostalLookupForDistricts(
  targets: ReportPostalLookupTarget[],
): Promise<Map<string, ReportPostalLookupEntry[]>> {
  const normalizedTargets = uniqueTargets(targets);
  if (normalizedTargets.length === 0) return new Map();

  const cacheKey = normalizedTargets
    .map((target) => `${target.bundeslandSlug}/${target.kreisSlug}`)
    .sort()
    .join("|");
  const cached = districtPostalLookupCache.get(cacheKey);
  if (cached) return cached;

  const promise = Promise.all(normalizedTargets.map((target) => loadPostalLookupForDistrict(target)))
    .then((maps) => mergePostalLookups(maps))
    .catch((error) => {
      districtPostalLookupCache.delete(cacheKey);
      throw error;
    });

  districtPostalLookupCache.set(cacheKey, promise);
  return promise;
}
