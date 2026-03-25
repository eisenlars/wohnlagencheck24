// lib/data.ts

import { buildWebAssetUrl } from "@/utils/assets";
import { loadAdminAreaTextI18nEntries, loadAdminAreaTextRows } from "@/lib/admin-area-texts";
import {
  REPORTS_TAG,
  reportScopeTagsForRouteSlugs,
} from "@/lib/cache-tags";

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

export type ReportsIndex = {
  bundeslaender: Array<{
    slug: string;
    name: string;
    kreise: Array<{
      slug: string;
      name: string;
      orte: Array<{ slug: string; name: string }>;
    }>;
  }>;
};

export type ReportTextOverride = {
  section_key: string;
  optimized_content: string | null;
  status?: string | null;
};

const SUPABASE_PUBLIC_BASE_URL = process.env.SUPABASE_PUBLIC_BASE_URL ?? "";
const SUPABASE_BUCKET = "immobilienmarkt";
const SUPABASE_ROOT = SUPABASE_PUBLIC_BASE_URL
  ? `${SUPABASE_PUBLIC_BASE_URL.replace(/\/+$/, "")}/${SUPABASE_BUCKET}`
  : "";

const DEFAULT_REVALIDATE_SECONDS = 60 * 60 * 24; // 24h

function joinPath(...parts: string[]): string {
  return parts
    .map((part) => part.replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/");
}

function buildSupabaseUrl(...parts: string[]): string | null {
  if (!SUPABASE_ROOT) {
    console.warn("SUPABASE_PUBLIC_BASE_URL ist nicht gesetzt.");
    return null;
  }
  const rel = joinPath(...parts);
  return `${SUPABASE_ROOT}/${rel}`;
}

async function fetchJson<T>(url: string | null, warnLabel: string, tags: string[] = [REPORTS_TAG]): Promise<T | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, {
      next: { revalidate: DEFAULT_REVALIDATE_SECONDS, tags },
    });
    if (!res.ok) {
      console.warn(`${warnLabel} nicht gefunden:`, url, res.status);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.error(`Fehler beim Laden von ${warnLabel}:`, err);
    return null;
  }
}

type SupabaseQuery = {
  select: (columns: string) => SupabaseQuery;
  eq: (column: string, value: unknown) => SupabaseQuery;
  then: <TResult1 = { data?: unknown; error?: { message: string } | null }, TResult2 = never>(
    onfulfilled?: ((value: TResult1) => TResult2 | PromiseLike<TResult2>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) => Promise<TResult1 | TResult2>;
};

export type SupabaseClientLike = {
  from: (table: string) => SupabaseQuery;
};

export async function getApprovedReportTexts(
  supabaseClient: SupabaseClientLike,
  areaId: string,
  partnerId?: string,
): Promise<ReportTextOverride[]> {
  try {
    let query = supabaseClient
      .from("report_texts")
      .select("section_key, optimized_content, status")
      .eq("area_id", areaId)
      .eq("status", "approved");
    if (partnerId) {
      query = query.eq("partner_id", partnerId);
    }
    const res = await query;
    const { data, error } = res as { data?: unknown; error?: { message: string } | null };

    if (error) {
      console.warn("report_texts fetch failed:", error.message);
      return [];
    }
    return (data ?? []) as ReportTextOverride[];
  } catch (err) {
    console.warn("report_texts fetch error:", err);
    return [];
  }
}

export async function getApprovedMarketingTexts(
  supabaseClient: SupabaseClientLike,
  areaId: string,
  partnerId?: string,
): Promise<ReportTextOverride[]> {
  try {
    let query = supabaseClient
      .from("partner_marketing_texts")
      .select("section_key, optimized_content, status")
      .eq("area_id", areaId)
      .eq("status", "approved");
    if (partnerId) {
      query = query.eq("partner_id", partnerId);
    }
    const res = await query;
    const { data, error } = res as { data?: unknown; error?: { message: string } | null };

    if (error) {
      console.warn("partner_marketing_texts fetch failed:", error.message);
      return [];
    }
    return (data ?? []) as ReportTextOverride[];
  } catch (err) {
    console.warn("partner_marketing_texts fetch error:", err);
    return [];
  }
}

export async function getApprovedAdminAreaTexts(
  supabaseClient: SupabaseClientLike,
  scopeKind: "bundesland",
  scopeKey: string,
): Promise<ReportTextOverride[]> {
  try {
    const rows = await loadAdminAreaTextRows({
      supabaseClient,
      scopeKind,
      scopeKey,
      approvedOnly: true,
    });
    return rows.map((row) => ({
      section_key: row.section_key,
      optimized_content: row.optimized_content ?? null,
      status: row.status,
    }));
  } catch (err) {
    console.warn("admin_area_texts fetch error:", err);
    return [];
  }
}

export async function getLiveAdminAreaTextTranslations(
  supabaseClient: SupabaseClientLike,
  scopeKind: "bundesland",
  scopeKey: string,
  locale: string,
): Promise<ReportTextOverride[]> {
  try {
    const rows = await loadAdminAreaTextI18nEntries({
      supabaseClient,
      scopeKind,
      scopeKey,
      locale,
      statuses: ["live"],
    });
    return rows.map((row) => ({
      section_key: row.section_key,
      optimized_content: row.value_text ?? null,
      status: row.status,
    }));
  } catch (err) {
    console.warn("admin_area_text_i18n_entries fetch error:", err);
    return [];
  }
}

async function fetchText(
  url: string | null,
  warnLabel: string,
  tags: string[] = [REPORTS_TAG],
): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, {
      next: { revalidate: DEFAULT_REVALIDATE_SECONDS, tags },
    });
    if (!res.ok) {
      console.warn(`${warnLabel} nicht gefunden:`, url, res.status);
      return null;
    }
    return await res.text();
  } catch (err) {
    console.error(`Fehler beim Laden von ${warnLabel}:`, err);
    return null;
  }
}

function withAssetVersion(url: string): string {
  const assetVersion =
    process.env.ASSET_VERSION?.trim() ||
    process.env.NEXT_PUBLIC_ASSET_VERSION?.trim() ||
    "";
  if (!assetVersion) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}v=${encodeURIComponent(assetVersion)}`;
}

async function fetchTextNoStore(url: string | null, warnLabel: string): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, {
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn(`${warnLabel} nicht gefunden:`, url, res.status);
      return null;
    }
    return await res.text();
  } catch (err) {
    console.error(`Fehler beim Laden von ${warnLabel}:`, err);
    return null;
  }
}

async function assetExists(url: string | null, tags: string[] = [REPORTS_TAG]): Promise<boolean> {
  if (!url) return false;
  try {
    const res = await fetch(url, {
      method: "HEAD",
      next: { revalidate: DEFAULT_REVALIDATE_SECONDS, tags },
    });
    return res.ok;
  } catch (err) {
    console.warn("Asset-Check fehlgeschlagen:", url, err);
    return false;
  }
}

export async function getReportsIndex(): Promise<ReportsIndex | null> {
  const url = buildSupabaseUrl("reports", "index.json");
  return fetchJson<ReportsIndex>(url, "Reports-Index", [REPORTS_TAG, ...reportScopeTagsForRouteSlugs([])]);
}

export async function getDeutschlandReport(): Promise<Report | null> {
  const url = buildSupabaseUrl("reports", "deutschland.json");
  return fetchJson<Report>(url, "Deutschland-Report", [REPORTS_TAG, ...reportScopeTagsForRouteSlugs([])]);
}

/**
 * Alle Bundesländer aus reports/index.json
 */
export async function getBundeslaender(
  indexArg?: ReportsIndex | null,
): Promise<{ slug: string; name: string }[]> {
  const index = indexArg ?? (await getReportsIndex());
  if (!index) return [];

  const result = index.bundeslaender.map((bl) => ({
    slug: bl.slug,
    name: bl.name,
  }));

  result.sort((a, b) => a.name.localeCompare(b.name, "de"));
  return result;
}

/**
 * Alle Kreise eines Bundeslands aus reports/index.json
 */
export async function getKreiseForBundesland(
  bundeslandSlug: string,
  indexArg?: ReportsIndex | null,
): Promise<{ slug: string; name: string }[]> {
  const index = indexArg ?? (await getReportsIndex());
  if (!index) return [];

  const bl = index.bundeslaender.find((b) => b.slug === bundeslandSlug);
  if (!bl) return [];

  const result = bl.kreise.map((k) => ({ slug: k.slug, name: k.name }));
  result.sort((a, b) => a.name.localeCompare(b.name, "de"));
  return result;
}

/**
 * Ortslagen eines Kreises aus reports/index.json
 */
export async function getOrteForKreis(
  bundeslandSlug: string,
  kreisSlug: string,
  indexArg?: ReportsIndex | null,
): Promise<{ slug: string; name: string }[]> {
  const index = indexArg ?? (await getReportsIndex());
  if (!index) return [];

  const bl = index.bundeslaender.find((b) => b.slug === bundeslandSlug);
  const kreis = bl?.kreise.find((k) => k.slug === kreisSlug);
  if (!kreis) return [];

  const result = kreis.orte.map((o) => ({ slug: o.slug, name: o.name }));
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
export async function getReportBySlugs(slugs: string[]): Promise<Report | null> {
  if (slugs.length === 0) {
    return getDeutschlandReport();
  }

  const [bundeslandSlug, kreisSlug, ortSlug] = slugs;
  let url: string | null = null;

  if (slugs.length === 1) {
    url = buildSupabaseUrl("reports", "deutschland", `${bundeslandSlug}.json`);
  } else if (slugs.length === 2) {
    url = buildSupabaseUrl(
      "reports",
      "deutschland",
      bundeslandSlug,
      `${kreisSlug}.json`,
    );
  } else {
    url = buildSupabaseUrl(
      "reports",
      "deutschland",
      bundeslandSlug,
      kreisSlug,
      `${ortSlug}.json`,
    );
  }

  return fetchJson<Report>(url, "Report", [REPORTS_TAG, ...reportScopeTagsForRouteSlugs(slugs)]);
}

async function readInteractiveSvg(relPath: string, warnLabel: string): Promise<string | null> {
  const rawUrl = buildSupabaseUrl(relPath);
  const url = rawUrl ? withAssetVersion(rawUrl) : null;
  return fetchTextNoStore(url, warnLabel);
}

function filterBundeslandKreisMapSvg(svg: string, bundeslandSlug: string, allowedKreisSlugs: Set<string>): string {
  if (allowedKreisSlugs.size === 0) return svg;

  const hrefPattern =
    /(?:xlink:href|href)="\/immobilienmarkt\/([^/]+)\/([^/"?#]+)\/?"/g;
  const anchorPattern =
    /<a\b[^>]*(?:xlink:href|href)="\/immobilienmarkt\/([^/]+)\/([^/"?#]+)\/?"[^>]*>[\s\S]*?<\/a>/g;
  const svgKreisSlugs = new Set<string>();
  const anchorMatchedKreisSlugs = new Set<string>();

  let hrefMatch: RegExpExecArray | null;
  while ((hrefMatch = hrefPattern.exec(svg)) !== null) {
    const bl = String(hrefMatch[1] ?? "").trim().toLowerCase();
    const kreis = String(hrefMatch[2] ?? "").trim().toLowerCase();
    if (bl === bundeslandSlug.toLowerCase() && kreis) {
      svgKreisSlugs.add(kreis);
    }
  }

  const filtered = svg.replace(anchorPattern, (full, blRaw, kreisRaw) => {
    const bl = String(blRaw ?? "").trim().toLowerCase();
    const kreis = String(kreisRaw ?? "").trim().toLowerCase();
    if (bl === bundeslandSlug.toLowerCase() && kreis) anchorMatchedKreisSlugs.add(kreis);
    if (bl !== bundeslandSlug.toLowerCase()) return "";
    if (!allowedKreisSlugs.has(kreis)) return "";
    return full;
  });

  // Safety fallback: if anchor-block parsing is incomplete, return unfiltered SVG.
  // This avoids dropping active areas due to regex limitations on specific SVG variants.
  if (anchorMatchedKreisSlugs.size > 0 && anchorMatchedKreisSlugs.size < svgKreisSlugs.size) {
    return svg;
  }

  return filtered;
}

// SVG Maps für Bundesland aus visuals/map_interactive holen
export async function getKreisUebersichtMapSvg(
  bundeslandSlug: string,
  allowedKreisSlugs?: Set<string>,
): Promise<string | null> {
  const relPath = joinPath(
    "visuals",
    "map_interactive",
    "deutschland",
    bundeslandSlug,
    `kreisuebersicht_${bundeslandSlug}.svg`,
  );

  const svg = await readInteractiveSvg(relPath, "Kreisübersicht-SVG");
  if (!svg) return null;
  if (!allowedKreisSlugs) return svg;
  return filterBundeslandKreisMapSvg(svg, bundeslandSlug, allowedKreisSlugs);
}

// SVG Maps für Kreis aus visuals/map_interactive holen
export async function getImmobilienpreisMapSvg(
  bundeslandSlug: string,
  kreisSlug: string,
): Promise<string | null> {
  const relPath = joinPath(
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

export async function getMietpreisMapSvg(
  bundeslandSlug: string,
  kreisSlug: string,
): Promise<string | null> {
  const relPath = joinPath(
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

export async function getWohnlagencheckMapSvg(
  bundeslandSlug: string,
  kreisSlug: string,
  theme: string,
): Promise<string | null> {
  const relPath = joinPath(
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

export async function getGrundstueckspreisMapSvg(
  bundeslandSlug: string,
  kreisSlug: string,
): Promise<string | null> {
  const relPath = joinPath(
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

export async function getKaufpreisfaktorMapSvg(
  bundeslandSlug: string,
  kreisSlug: string,
): Promise<string | null> {
  const relPath = joinPath(
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

export async function getWohnungssaldoMapSvg(
  bundeslandSlug: string,
  kreisSlug: string,
): Promise<string | null> {
  const relPath = joinPath(
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

export async function getKaufkraftindexMapSvg(
  bundeslandSlug: string,
  kreisSlug: string,
): Promise<string | null> {
  const relPath = joinPath(
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

export async function getFlaechennutzungGewerbeImageSrc(
  bundeslandSlug: string,
  kreisSlug: string,
  ortSlug?: string,
): Promise<{ src: string | null; usesKreisFallback: boolean }> {
  const baseParts = [
    "visuals",
    "map_landuse",
    "deutschland",
    bundeslandSlug,
    kreisSlug,
    "flaechennutzung",
  ];

  if (ortSlug) {
    const ortRelPath = joinPath(
      ...baseParts,
      `flaechennutzung_${kreisSlug}_${ortSlug}_industrie_gewerbe.webp`,
    );
    const ortUrl = buildWebAssetUrl(ortRelPath);
    if (await assetExists(ortUrl)) {
      return { src: ortUrl, usesKreisFallback: false };
    }
  }

  const kreisRelPath = joinPath(
    ...baseParts,
    `flaechennutzung_${kreisSlug}_industrie_gewerbe.webp`,
  );
  const kreisUrl = buildWebAssetUrl(kreisRelPath);
  if (await assetExists(kreisUrl)) {
    return { src: kreisUrl, usesKreisFallback: Boolean(ortSlug) };
  }

  console.warn("Gewerbe-Flächennutzungskarte nicht gefunden:", kreisRelPath);
  return { src: null, usesKreisFallback: false };
}

export async function getFlaechennutzungWohnbauImageSrc(
  bundeslandSlug: string,
  kreisSlug: string,
  ortSlug?: string,
): Promise<{ src: string | null; usesKreisFallback: boolean }> {
  const baseParts = [
    "visuals",
    "map_landuse",
    "deutschland",
    bundeslandSlug,
    kreisSlug,
    "flaechennutzung",
  ];

  if (ortSlug) {
    const ortRelPath = joinPath(
      ...baseParts,
      `flaechennutzung_${kreisSlug}_${ortSlug}_wohnbau.webp`,
    );
    const ortUrl = buildWebAssetUrl(ortRelPath);
    if (await assetExists(ortUrl)) {
      return { src: ortUrl, usesKreisFallback: false };
    }
  }

  const kreisRelPath = joinPath(
    ...baseParts,
    `flaechennutzung_${kreisSlug}_wohnbau.webp`,
  );
  const kreisUrl = buildWebAssetUrl(kreisRelPath);
  if (await assetExists(kreisUrl)) {
    return { src: kreisUrl, usesKreisFallback: Boolean(ortSlug) };
  }

  console.warn("Wohnbau-Flächennutzungskarte nicht gefunden:", kreisRelPath);
  return { src: null, usesKreisFallback: false };
}

export async function getLegendHtml(theme: string): Promise<string | null> {
  const filename = `legend_${theme}.html`;
  const relPath = joinPath("visuals", "legend", filename);
  const url = buildSupabaseUrl(relPath);
  return fetchText(url, "Legend-HTML", [REPORTS_TAG]);
}
