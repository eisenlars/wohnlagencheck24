import type { Report } from "@/lib/data";
import type { RouteLevel } from "@/features/immobilienmarkt/types/route";
import type { PlaceholderVM } from "@/features/immobilienmarkt/selectors/shared/types/placeholder";
import { getRegionDisplayName } from "@/utils/regionName";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" ? (value as UnknownRecord) : null;
}

function pickMeta(report: Report): UnknownRecord {
  const meta = report.meta as unknown;
  const m0 = Array.isArray(meta) ? meta[0] : meta;
  return asRecord(m0) ?? {};
}

function basePathFromSlugs(slugs: string[]): string {
  return "/immobilienmarkt" + (slugs.length ? "/" + slugs.join("/") : "");
}

export function buildPlaceholderVM(args: {
  report: Report;
  level: RouteLevel;
  bundeslandSlug?: string;
  kreisSlug?: string;
  ortSlug?: string;
}): PlaceholderVM {
  const { report, level, bundeslandSlug, kreisSlug, ortSlug } = args;

  const meta = pickMeta(report);

  const regionName = getRegionDisplayName({
    meta,
    level,
    fallbackSlug: level === "ort" ? ortSlug : level === "kreis" ? kreisSlug : bundeslandSlug,
  });

  const regionSlugs = [bundeslandSlug, kreisSlug, ortSlug].filter(Boolean) as string[];

  return {
    regionName,
    basePath: basePathFromSlugs(regionSlugs),
    heroSubtitle: "regionaler Standortberater",
  };
}
