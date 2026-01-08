import { asString } from "@/utils/records";

type RegionLevel = "kreis" | "ort" | "bundesland" | "deutschland";
type MetaRecord = Record<string, unknown>;

function capitalizeWord(word: string): string {
  if (!word) return "";
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function applyUmlauts(input: string): string {
  return input
    .replace(/Ue/g, "Ü")
    .replace(/Oe/g, "Ö")
    .replace(/Ae/g, "Ä")
    .replace(/ue/g, "ü")
    .replace(/oe/g, "ö")
    .replace(/ae/g, "ä")
    .replace(/ss/g, "ß");
}

function normalizeSlug(input: string): string {
  return input.replace(/^ortslage_/, "").replace(/[_-]+/g, " ").trim();
}

function toTitleCase(input: string): string {
  return input
    .split(/\s+/)
    .map((part) => capitalizeWord(part))
    .join(" ");
}

export function formatRegionFallback(input: string): string {
  const normalized = normalizeSlug(String(input));
  return applyUmlauts(toTitleCase(normalized));
}

export function getRegionDisplayName(args: {
  meta: MetaRecord;
  level: RegionLevel;
  fallbackSlug?: string;
}): string {
  const { meta, level, fallbackSlug } = args;

  const amtlicher = asString(meta["amtlicher_name"]);
  if (amtlicher && amtlicher.trim()) return amtlicher.trim();

  if (level === "kreis") {
    const kreisName = asString(meta["kreis_name"]);
    if (kreisName && kreisName.trim()) return formatRegionFallback(kreisName);
  }

  if (level === "ort") {
    const ortslageName = asString(meta["ortslage_name"]);
    if (ortslageName && ortslageName.trim()) return formatRegionFallback(ortslageName);
  }

  const fallback = asString(meta["name"]) ?? fallbackSlug ?? "";
  return fallback ? formatRegionFallback(fallback) : "Deutschland";
}
