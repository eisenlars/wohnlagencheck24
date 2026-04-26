import fs from "node:fs/promises";
import path from "node:path";

export type LageclusterQuality = "LOW" | "MIDDLE" | "GOOD" | "VERY_GOOD" | "EXCELLENT";
export type LageclusterMarketType = "apartment_sell" | "apartment_rent" | "house_sell" | "house_rent";

export type LageclusterRelation = {
  min: number;
  avg: number;
  max: number;
};

export type LageclusterGeometryItem = {
  q: LageclusterQuality;
  bbox: [number, number, number, number];
  poly: number[][][][];
};

export type LageclusterRuntimeOrtslage = {
  regionalschluessel: string;
  regionale_zuordnung: string;
  items: LageclusterGeometryItem[];
  relations: Partial<Record<LageclusterMarketType, Partial<Record<LageclusterQuality, LageclusterRelation>>>>;
};

export type LageclusterRuntime = {
  kreis_slug: string;
  regionalschluessel: string;
  county_relations: Partial<Record<LageclusterMarketType, Partial<Record<LageclusterQuality, LageclusterRelation>>>>;
  ortslagen: Record<string, LageclusterRuntimeOrtslage>;
};

export type ResolvedLageclusterRuntime = {
  kreisSlug: string;
  ortSlug: string;
  ortschluessel: string;
  items: LageclusterGeometryItem[];
  relations: Partial<Record<LageclusterMarketType, Partial<Record<LageclusterQuality, LageclusterRelation>>>>;
  countyRelations: Partial<Record<LageclusterMarketType, Partial<Record<LageclusterQuality, LageclusterRelation>>>>;
};

const RUNTIME_ROOT = path.join(process.cwd(), "data/json/lagecluster/deutschland");

function toObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseRelationMap(
  value: unknown,
): Partial<Record<LageclusterQuality, LageclusterRelation>> {
  const source = toObject(value);
  if (!source) return {};

  const result: Partial<Record<LageclusterQuality, LageclusterRelation>> = {};
  for (const quality of ["LOW", "MIDDLE", "GOOD", "VERY_GOOD", "EXCELLENT"] as const) {
    const entry = toObject(source[quality]);
    if (!entry) continue;
    const min = asNumber(entry.min);
    const avg = asNumber(entry.avg);
    const max = asNumber(entry.max);
    if (min === null || avg === null || max === null) continue;
    result[quality] = { min, avg, max };
  }
  return result;
}

function parseMarketRelations(
  value: unknown,
): Partial<Record<LageclusterMarketType, Partial<Record<LageclusterQuality, LageclusterRelation>>>> {
  const source = toObject(value);
  if (!source) return {};

  const result: Partial<Record<LageclusterMarketType, Partial<Record<LageclusterQuality, LageclusterRelation>>>> = {};
  for (const marketType of ["apartment_sell", "apartment_rent", "house_sell", "house_rent"] as const) {
    const relations = parseRelationMap(source[marketType]);
    if (Object.keys(relations).length > 0) {
      result[marketType] = relations;
    }
  }
  return result;
}

function parseGeometryItem(value: unknown): LageclusterGeometryItem | null {
  const source = toObject(value);
  if (!source) return null;
  const quality = asText(source.q);
  const bbox = Array.isArray(source.bbox) ? source.bbox : null;
  const poly = Array.isArray(source.poly) ? source.poly : null;
  if (
    (quality !== "LOW" && quality !== "MIDDLE" && quality !== "GOOD" && quality !== "VERY_GOOD" && quality !== "EXCELLENT")
    || !bbox
    || bbox.length !== 4
    || bbox.some((entry) => typeof entry !== "number")
    || !poly
  ) {
    return null;
  }
  return {
    q: quality,
    bbox: [bbox[0] as number, bbox[1] as number, bbox[2] as number, bbox[3] as number],
    poly: poly as number[][][][],
  };
}

function parseRuntime(value: unknown): LageclusterRuntime | null {
  const source = toObject(value);
  if (!source) return null;
  const kreisSlug = asText(source.kreis_slug);
  const regionalschluessel = asText(source.regionalschluessel);
  const ortslagenSource = toObject(source.ortslagen);
  if (!kreisSlug || !regionalschluessel || !ortslagenSource) return null;

  const ortslagen: Record<string, LageclusterRuntimeOrtslage> = {};
  for (const [ortSlug, ortValue] of Object.entries(ortslagenSource)) {
    const ortRecord = toObject(ortValue);
    if (!ortRecord) continue;
    const ortschluessel = asText(ortRecord.regionalschluessel);
    const zuordnung = asText(ortRecord.regionale_zuordnung);
    const items = Array.isArray(ortRecord.items)
      ? ortRecord.items.map(parseGeometryItem).filter((item): item is LageclusterGeometryItem => item !== null)
      : [];
    if (!ortschluessel || !zuordnung || items.length === 0) continue;

    ortslagen[ortSlug] = {
      regionalschluessel: ortschluessel,
      regionale_zuordnung: zuordnung,
      items,
      relations: parseMarketRelations(ortRecord.relations),
    };
  }

  return {
    kreis_slug: kreisSlug,
    regionalschluessel,
    county_relations: parseMarketRelations(source.county_relations),
    ortslagen,
  };
}

export async function loadLageclusterRuntimeForKreis(
  bundeslandSlug: string,
  kreisSlug: string,
): Promise<LageclusterRuntime | null> {
  const runtimePath = path.join(
    RUNTIME_ROOT,
    bundeslandSlug,
    kreisSlug,
    `${kreisSlug}_lagecluster_runtime.json`,
  );

  try {
    const content = await fs.readFile(runtimePath, "utf8");
    return parseRuntime(JSON.parse(content));
  } catch {
    return null;
  }
}

export async function loadResolvedLageclusterRuntime(
  bundeslandSlug: string,
  kreisSlug: string,
  ortSlug: string,
): Promise<ResolvedLageclusterRuntime | null> {
  const runtime = await loadLageclusterRuntimeForKreis(bundeslandSlug, kreisSlug);
  const ortslage = runtime?.ortslagen[ortSlug];
  if (!runtime || !ortslage) return null;
  return {
    kreisSlug: runtime.kreis_slug,
    ortSlug,
    ortschluessel: ortslage.regionalschluessel,
    items: ortslage.items,
    relations: ortslage.relations,
    countyRelations: runtime.county_relations,
  };
}
