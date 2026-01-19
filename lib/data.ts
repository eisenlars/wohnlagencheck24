// lib/data.ts

import fs from "node:fs";
import path from "node:path";

import { getRegionDisplayName } from "@/utils/regionName";

export type ReportType = "deutschland" | "bundesland" | "kreis" | "ortslage";

export interface ReportMeta {
  type?: ReportType;
  slug?: string;
  name?: string;
  plz?: string;
  regionalschluessel?: string;
  aktualisierung?: string;
  regionale_zuordnung?: string;
  amtlicher_name?: string;
  bundesland_name?: string;
  bundesland_schluessel?: string;
  kreis_name?: string;
  kreis_schluessel?: string;
  ortslage_name?: string;
  ortslage_schluessel?: string;
  [key: string]: unknown;
}

export interface Report<TData = unknown> {
  meta: ReportMeta;
  data: TData;
  [key: string]: unknown;
}

// Erwartete Struktur:
// data/json/reports/deutschland.json
// data/json/reports/deutschland/sachsen.json
// data/json/reports/deutschland/sachsen/leipzig.json
// data/json/reports/deutschland/sachsen/leipzig/connewitz.json

const REPORTS_ROOT = path.join(process.cwd(), "data", "json", "reports");
const DEUTSCHLAND_DIR = path.join(REPORTS_ROOT, "deutschland");

function readJsonFile<T = unknown>(filePath: string): T {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw) as T;
}

export function getDeutschlandReport(): Report | null {
  const filePath = path.join(REPORTS_ROOT, "deutschland.json");
  if (!fs.existsSync(filePath)) return null;
  return readJsonFile<Report>(filePath);
}

/**
 * Alle Bundesländer:
 * data/json/reports/deutschland/<bundesland>.json
 */
export function getBundeslaender(): { slug: string; name: string }[] {
  if (!fs.existsSync(DEUTSCHLAND_DIR)) {
    console.warn("DEUTSCHLAND_DIR existiert nicht:", DEUTSCHLAND_DIR);
    return [];
  }

  const entries = fs.readdirSync(DEUTSCHLAND_DIR, { withFileTypes: true });
  const result: { slug: string; name: string }[] = [];

  for (const entry of entries) {
    // Wir erwarten hier die Dateien: sachsen.json, bayern.json, ...
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;

    const blSlug = entry.name.replace(/\.json$/, "");
    const blJsonPath = path.join(DEUTSCHLAND_DIR, entry.name);
    const report = readJsonFile<Report>(blJsonPath);

    result.push({
      slug: blSlug,
      name: getRegionDisplayName({
        meta: report.meta as Record<string, unknown>,
        level: "bundesland",
        fallbackSlug: blSlug,
      }),
    });
  }

  result.sort((a, b) => a.name.localeCompare(b.name, "de"));
  return result;
}

/**
 * Alle Kreise eines Bundeslands:
 * data/json/reports/deutschland/<bundesland>/<kreis>.json
 */
export function getKreiseForBundesland(
  bundeslandSlug: string,
): { slug: string; name: string }[] {
  const blDir = path.join(DEUTSCHLAND_DIR, bundeslandSlug);
  if (!fs.existsSync(blDir)) {
    console.warn("Bundesland-Verzeichnis existiert nicht:", blDir);
    return [];
  }

  const entries = fs.readdirSync(blDir, { withFileTypes: true });
  const result: { slug: string; name: string }[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;

    const kreisSlug = entry.name.replace(/\.json$/, "");
    // Kreis-Report selbst, keine Ortsebene
    const kreisJsonPath = path.join(blDir, entry.name);
    const report = readJsonFile<Report>(kreisJsonPath);

    result.push({
      slug: kreisSlug,
      name: getRegionDisplayName({
        meta: report.meta as Record<string, unknown>,
        level: "kreis",
        fallbackSlug: kreisSlug,
      }),
    });
  }

  // Kreis-Sammelreport (z. B. sachsen.json) aussortieren,
  // falls du deinen Bundesland-Report dort liegen hast
  result.splice(
    result.findIndex((k) => k.slug === bundeslandSlug),
    result.findIndex((k) => k.slug === bundeslandSlug) >= 0 ? 1 : 0,
  );

  result.sort((a, b) => a.name.localeCompare(b.name, "de"));
  return result;
}

/**
 * Ortslagen eines Kreises:
 * data/json/reports/deutschland/<bundesland>/<kreis>/<ort>.json
 * (alle JSON-Dateien in diesem Unterordner)
 */
export function getOrteForKreis(
  bundeslandSlug: string,
  kreisSlug: string,
): { slug: string; name: string }[] {
  const kreisDir = path.join(DEUTSCHLAND_DIR, bundeslandSlug, kreisSlug);
  if (!fs.existsSync(kreisDir)) {
    console.warn("Kreis-Verzeichnis existiert nicht:", kreisDir);
    return [];
  }

  const entries = fs.readdirSync(kreisDir, { withFileTypes: true });
  const result: { slug: string; name: string }[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;

    const ortSlug = entry.name.replace(/\.json$/, "");
    const ortJsonPath = path.join(kreisDir, entry.name);
    const report = readJsonFile<Report>(ortJsonPath);

    result.push({
      slug: ortSlug,
      name: getRegionDisplayName({
        meta: report.meta as Record<string, unknown>,
        level: "ort",
        fallbackSlug: ortSlug,
      }),
    });
  }

  result.sort((a, b) => a.name.localeCompare(b.name, "de"));
  return result;
}

/**
 * Generischer Loader:
 * /immobilienmarkt
 * /immobilienmarkt/[bundesland]
 * /immobilienmarkt/[bundesland]/[kreis]
 * /immobilienmarkt/[bundesland]/[kreis]/[ort]
 */
export function getReportBySlugs(slugs: string[]): Report | null {
  if (slugs.length === 0) {
    return getDeutschlandReport();
  }

  const [bundeslandSlug, kreisSlug, ortSlug] = slugs;

  let filePath: string;

  if (slugs.length === 1) {
    // Bundesland-Report: data/json/reports/deutschland/<bundesland>.json
    filePath = path.join(DEUTSCHLAND_DIR, `${bundeslandSlug}.json`);
  } else if (slugs.length === 2) {
    // Kreis-Report: data/json/reports/deutschland/<bundesland>/<kreis>.json
    filePath = path.join(
      DEUTSCHLAND_DIR,
      bundeslandSlug,
      `${kreisSlug}.json`,
    );
  } else {
    // Orts-Report: data/json/reports/deutschland/<bundesland>/<kreis>/<ort>.json
    filePath = path.join(
      DEUTSCHLAND_DIR,
      bundeslandSlug,
      kreisSlug,
      `${ortSlug}.json`,
    );
  }

  if (!fs.existsSync(filePath)) {
    console.warn("Report nicht gefunden für Slugs:", slugs, " -> ", filePath);
    return null;
  }

  return readJsonFile<Report>(filePath);
}


// SVG Maps für Bundesland aus data/visuals/map_interactive holen

function readInteractiveSvg(relPath: string, warnLabel: string): string | null {
  const publicPath = path.join(process.cwd(), "public", relPath);
  const dataPath = path.join(process.cwd(), "data", relPath);

  const resolved = fs.existsSync(publicPath) ? publicPath : fs.existsSync(dataPath) ? dataPath : null;
  if (!resolved) {
    console.warn(`${warnLabel} nicht gefunden:`, relPath);
    return null;
  }

  try {
    return fs.readFileSync(resolved, "utf8");
  } catch (err) {
    console.error(`Fehler beim Lesen der ${warnLabel}:`, err);
    return null;
  }
}

export function getKreisUebersichtMapSvg(
  bundeslandSlug: string,
): string | null {
  const relPath = path.join(
    "visuals",
    "map_interactive",
    "deutschland",
    bundeslandSlug,
    `kreisuebersicht_${bundeslandSlug}.svg`,
  );

  return readInteractiveSvg(relPath, "Kreisübersicht-SVG");
}




// SVG Maps für Kreis aus data/visuals/map_interactive holen

export function getImmobilienpreisMapSvg(
  bundeslandSlug: string,
  kreisSlug: string,
): string | null {
  const relPath = path.join(
    "visuals",
    "map_interactive",
    "deutschland",
    bundeslandSlug,
    kreisSlug,
    "immobilienpreis",
    `immobilienpreis_${kreisSlug}.svg`,
  );

  return readInteractiveSvg(relPath, "Immobilienpreis-SVG");
}


// SVG Maps aus data/visuals/map_interactive holen

export function getMietpreisMapSvg(
  bundeslandSlug: string,
  kreisSlug: string,
): string | null {
  const relPath = path.join(
    "visuals",
    "map_interactive",
    "deutschland",
    bundeslandSlug,
    kreisSlug,
    "mietpreis",
    `mietpreis_${kreisSlug}.svg`,
  );

  return readInteractiveSvg(relPath, "Mietpreis-SVG");
}

export function getWohnlagencheckMapSvg(
  bundeslandSlug: string,
  kreisSlug: string,
  theme: string,
): string | null {
  const relPath = path.join(
    "visuals",
    "map_interactive",
    "deutschland",
    bundeslandSlug,
    kreisSlug,
    theme,
    `${theme}_${kreisSlug}.svg`,
  );

  return readInteractiveSvg(relPath, "Wohnlagencheck-SVG");
}

export function getGrundstueckspreisMapSvg(
  bundeslandSlug: string,
  kreisSlug: string,
): string | null {
  const relPath = path.join(
    "visuals",
    "map_interactive",
    "deutschland",
    bundeslandSlug,
    kreisSlug,
    "grundstueckspreis",
    `grundstueckspreis_${kreisSlug}.svg`,
  );

  return readInteractiveSvg(relPath, "Grundstueckspreis-SVG");
}

export function getKaufpreisfaktorMapSvg(
  bundeslandSlug: string,
  kreisSlug: string,
): string | null {
  const relPath = path.join(
    "visuals",
    "map_interactive",
    "deutschland",
    bundeslandSlug,
    kreisSlug,
    "kaufpreisfaktor",
    `kaufpreisfaktor_${kreisSlug}.svg`,
  );

  return readInteractiveSvg(relPath, "Kaufpreisfaktor-SVG");
}

export function getWohnungssaldoMapSvg(
  bundeslandSlug: string,
  kreisSlug: string,
): string | null {
  const relPath = path.join(
    "visuals",
    "map_interactive",
    "deutschland",
    bundeslandSlug,
    kreisSlug,
    "wohnungssaldo",
    `wohnungssaldo_${kreisSlug}.svg`,
  );

  return readInteractiveSvg(relPath, "Wohnungssaldo-SVG");
}

export function getKaufkraftindexMapSvg(
  bundeslandSlug: string,
  kreisSlug: string,
): string | null {
  const relPath = path.join(
    "visuals",
    "map_interactive",
    "deutschland",
    bundeslandSlug,
    kreisSlug,
    "kaufkraftindex",
    `kaufkraftindex_${kreisSlug}.svg`,
  );

  return readInteractiveSvg(relPath, "Kaufkraftindex-SVG");
}

export function getFlaechennutzungGewerbeImageSrc(
  bundeslandSlug: string,
  kreisSlug: string,
): string | null {
  const relPath = path.join(
    "visuals",
    "map_landuse",
    "deutschland",
    bundeslandSlug,
    kreisSlug,
    "flaechennutzung",
    `flaechennutzung_${kreisSlug}_industrie_gewerbe.webp`,
  );

  const publicPath = path.join(process.cwd(), "public", relPath);
  const dataPath = path.join(process.cwd(), "data", relPath);

  if (fs.existsSync(publicPath) || fs.existsSync(dataPath)) {
    return `/${relPath.replace(/\\/g, "/")}`;
  }

  console.warn("Gewerbe-Flächennutzungskarte nicht gefunden:", relPath);
  return null;
}

export function getFlaechennutzungWohnbauImageSrc(
  bundeslandSlug: string,
  kreisSlug: string,
  ortSlug?: string,
): string | null {
  const baseParts = ["visuals", "map_landuse", "deutschland", bundeslandSlug, kreisSlug, "flaechennutzung"];
  const filename = ortSlug
    ? `flaechennutzung_${kreisSlug}_${ortSlug}_wohnbau.webp`
    : `flaechennutzung_${kreisSlug}_wohnbau.webp`;
  const relPath = path.join(...baseParts, filename);

  const publicPath = path.join(process.cwd(), "public", relPath);
  const dataPath = path.join(process.cwd(), "data", relPath);

  if (fs.existsSync(publicPath) || fs.existsSync(dataPath)) {
    return `/${relPath.replace(/\\/g, "/")}`;
  }

  if (ortSlug) {
    return getFlaechennutzungWohnbauImageSrc(bundeslandSlug, kreisSlug);
  }

  console.warn("Wohnbau-Flächennutzungskarte nicht gefunden:", relPath);
  return null;
}

export function getLegendHtml(theme: string): string | null {
  const filename = `legend_${theme}.html`;
  const publicPath = path.join(process.cwd(), "public", "visuals", "legend", filename);
  const dataPath = path.join(process.cwd(), "data", "visuals", "legend", filename);
  const htmlPath = fs.existsSync(publicPath) ? publicPath : dataPath;

  if (!fs.existsSync(htmlPath)) {
    console.warn("Legend-HTML nicht gefunden:", htmlPath);
    return null;
  }

  try {
    return fs.readFileSync(htmlPath, "utf8");
  } catch (err) {
    console.error("Fehler beim Lesen der Legend-HTML:", err);
    return null;
  }
}
