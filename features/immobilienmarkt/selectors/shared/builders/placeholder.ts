import type { Report } from "@/lib/data";
import type { RouteLevel } from "@/features/immobilienmarkt/types/route";
import type { PlaceholderVM } from "@/features/immobilienmarkt/selectors/shared/types/placeholder";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" ? (value as UnknownRecord) : null;
}

function pickMeta(report: Report): UnknownRecord {
  const meta = report.meta as unknown;
  const m0 = Array.isArray(meta) ? meta[0] : meta;
  return asRecord(m0) ?? {};
}

function safeTrim(v: unknown): string {
  if (v == null) return "";
  try {
    return String(v).trim();
  } catch {
    return "";
  }
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

  const regionName =
    safeTrim(meta["amtlicher_name"]) ||
    safeTrim(meta["name"]) ||
    (level === "ort" ? safeTrim(ortSlug) : level === "kreis" ? safeTrim(kreisSlug) : safeTrim(bundeslandSlug)) ||
    "Deutschland";

  const regionSlugs = [bundeslandSlug, kreisSlug, ortSlug].filter(Boolean) as string[];

  return {
    regionName,
    basePath: basePathFromSlugs(regionSlugs),
    heroSubtitle: "regionaler Standortberater",
  };
}
