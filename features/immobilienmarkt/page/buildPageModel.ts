// features/immobilienmarkt/page/buildPageModel.ts

import type { RouteModel, ReportSection, RouteLevel } from "../types/route";
import { isSectionAllowed } from "../types/route";
import { IMMOBILIENMARKT_THEME } from "../config/theme";

import type { Report, SupabaseClientLike } from "@/lib/data";
import {
  getReportBySlugs,
  getOrteForKreis,
  getKreiseForBundesland,
  getKreisUebersichtMapSvg,
  getImmobilienpreisMapSvg,
  getMietpreisMapSvg,
  getGrundstueckspreisMapSvg,
  getKaufpreisfaktorMapSvg,
  getWohnungssaldoMapSvg,
  getKaufkraftindexMapSvg,
  getWohnlagencheckMapSvg,
  getFlaechennutzungGewerbeImageSrc,
  getFlaechennutzungWohnbauImageSrc,
  getLegendHtml,
  getApprovedAdminAreaTexts,
  getLiveAdminAreaTextTranslations,
  getPartnerAreaGeneratedTexts,
  getPartnerAreaRuntimeState,
  getApprovedReportTexts,
} from "@/lib/data";
import { buildWebAssetUrl } from "@/utils/assets";
import { asArray, asRecord, asString } from "@/utils/records";
import { getRegionDisplayName } from "@/utils/regionName";
import { createAdminClient } from "@/utils/supabase/admin";
import { applyDataDrivenTexts } from "@/lib/text-core";
import {
  getActiveKreisSlugsForBundesland,
  getActiveOrtSlugsForKreis,
  isBundeslandVisible,
  isKreisVisible,
  isOrtslageVisible,
} from "@/lib/area-visibility";
import { loadPublicVisibleAreaIds, loadPublicVisiblePartnerContextForArea } from "@/lib/public-partner-mappings";
import { resolveMandatoryMediaSrc } from "@/lib/mandatory-media";
import {
  applySystempartnerDefaultProfileToReportText,
  downloadSystempartnerDefaultProfile,
} from "@/lib/systempartner-default-profile";

export type PageModel = {
  route: RouteModel;
  report: Report;
  basePath: string;

  // NEU: für Ort-Ebene, damit "Übersicht" auf Kreis-Ebene verlinken kann
  parentBasePath?: string;

  // NEU: Kontakt-VM (Portal vs. Berater)
  kontakt?: {
    scope: "portal" | "berater";
    title: string;
    name: string;
    email: string;
    phone?: string;
    imageSrc?: string;
    regionLabel?: string;
    subjectDefault?: string;
  };

  tabs: Array<{ id: string; label: string; iconSrc?: string }>;
  activeTabId: ReportSection;
  tocItems: Array<{ id: string; label: string }>;

  ctx: {
    bundeslandSlug?: string;
    kreisSlug?: string;
    ortSlug?: string;

    // nur Kreisebene
    orte?: Array<{ slug: string; name: string }>;
    // nur Bundesland (Beraterliste)
    berater?: Array<{ slug: string; name: string; imageSrc: string; kontaktHref: string }>;
    // nur Bundesland (Maklerempfehlung)
    makler?: Array<{ slug: string; name: string; imageSrc: string; kontaktHref: string }>;
  };

  // zentral (nicht in ctx)
  assets?: {
    heroImageSrc?: string;
    immobilienpreisMapSvg?: string | null;
    immobilienpreisLegendHtml?: string | null;
    mietpreisMapSvg?: string | null;
    mietpreisLegendHtml?: string | null;
    grundstueckspreisMapSvg?: string | null;
    kreisuebersichtMapSvg?: string | null;
    kaufpreisfaktorMapSvg?: string | null;
    kaufpreisfaktorLegendHtml?: string | null;
    kaufkraftindexMapSvg?: string | null;
    kaufkraftindexLegendHtml?: string | null;
    grundstueckspreisLegendHtml?: string | null;
    flaechennutzungGewerbeImageSrc?: string | null;
    flaechennutzungGewerbeUsesKreisFallback?: boolean;
    flaechennutzungWohnbauImageSrc?: string | null;
    flaechennutzungWohnbauUsesKreisFallback?: boolean;
    wohnungssaldoMapSvg?: string | null;
    wohnungssaldoLegendHtml?: string | null;
    wohnlagencheckMapSvgs?: Partial<Record<string, string | null>>;
    wohnlagencheckLegendHtml?: Partial<Record<string, string | null>>;
  };

  flags?: {
    isSystemDefaultPartner?: boolean;
  };
};

export type BuildPageModelOptions = {
  audience?: "public" | "preview";
  pathPrefix?: string;
  locale?: string;
};

function basePathFromRegionSlugs(regionSlugs: string[], pathPrefix = "/immobilienmarkt"): string {
  return pathPrefix + (regionSlugs.length ? "/" + regionSlugs.join("/") : "");
}

function normalizeActiveTab(args: {
  level: RouteLevel;
  requested: ReportSection;
  tabsForLevel: Array<{ id: ReportSection }>;
  defaultTab: ReportSection;
}): ReportSection {
  const { level, requested, tabsForLevel, defaultTab } = args;

  // 1) Level-Regel: nicht erlaubte Sections -> Default
  const allowed = isSectionAllowed(level, requested) ? requested : defaultTab;

  // 2) Ort-Regel: keine Übersicht -> Default
  const ortFixed = level === "ort" && allowed === "uebersicht" ? defaultTab : allowed;

  // 3) Theme-Regel: Tab muss existieren -> Default oder erster Tab
  const exists = tabsForLevel.some((t) => t.id === ortFixed);
  if (exists) return ortFixed;

  const defaultExists = tabsForLevel.some((t) => t.id === defaultTab);
  if (defaultExists) return defaultTab;

  // final fallback: erster Tab oder "uebersicht"
  return (tabsForLevel[0]?.id ?? "uebersicht") as ReportSection;
}

type TextTree = Record<string, Record<string, string>>;

function toTextTree(value: unknown): TextTree {
  const rec = asRecord(value);
  if (!rec) return {};
  const out: TextTree = {};
  for (const [groupKey, groupValue] of Object.entries(rec)) {
    const group = asRecord(groupValue);
    if (!group) continue;
    out[groupKey] = {};
    for (const [textKey, textValue] of Object.entries(group)) {
      out[groupKey][textKey] = String(textValue ?? "");
    }
  }
  return out;
}

function getTextTree(report: Report): TextTree {
  const data = asRecord(report.data) ?? {};
  const top = toTextTree(report["text"]);
  if (Object.keys(top).length > 0) return top;
  return toTextTree(data["text"]);
}

function inferGroupBySectionKey(sectionKey: string): string {
  if (sectionKey.startsWith("berater_")) return "berater";
  if (sectionKey.startsWith("makler_")) return "makler";
  if (sectionKey === "media_berater_avatar") return "berater";
  if (sectionKey.startsWith("media_makler_")) return "makler";
  if (sectionKey.startsWith("immobilienmarkt_")) return "immobilienmarkt_ueberblick";
  return "immobilienmarkt_ueberblick";
}

function findTextBySectionKey(textTree: TextTree, sectionKey: string): string {
  for (const group of Object.values(textTree)) {
    if (Object.prototype.hasOwnProperty.call(group, sectionKey)) {
      return String(group[sectionKey] ?? "");
    }
  }
  return "";
}

function applyOverridesToTextTree(
  baseTree: TextTree,
  overrides: Array<{ section_key: string; optimized_content: string | null }>,
): TextTree {
  const next: TextTree = {};
  for (const [groupKey, group] of Object.entries(baseTree)) {
    next[groupKey] = { ...group };
  }

  for (const entry of overrides) {
    const key = String(entry.section_key ?? "").trim();
    const content = String(entry.optimized_content ?? "");
    if (!key || !content) continue;

    let applied = false;
    for (const groupKey of Object.keys(next)) {
      if (Object.prototype.hasOwnProperty.call(next[groupKey], key)) {
        next[groupKey][key] = content;
        applied = true;
        break;
      }
    }
    if (!applied) {
      const groupKey = inferGroupBySectionKey(key);
      next[groupKey] = {
        ...(next[groupKey] ?? {}),
        [key]: content,
      };
    }
  }

  return next;
}

function withTextTree(report: Report, textTree: TextTree): Report {
  return {
    ...report,
    text: textTree,
    data: {
      ...(asRecord(report.data) ?? {}),
      text: textTree,
    },
  };
}

function withPartnerRuntimeState(
  report: Report,
  runtimeState: {
    data_json: Record<string, unknown>;
    textgen_inputs_json: Record<string, unknown>;
    helpers_json: Record<string, unknown>;
  },
  scope: "kreis" | "ortslage",
): Report {
  const currentData = asRecord(report.data) ?? {};
  const nextData = {
    ...currentData,
    ...runtimeState.data_json,
    textgen_inputs: {
      ...(asRecord(currentData.textgen_inputs) ?? {}),
      [scope]: runtimeState.textgen_inputs_json,
    },
    text: getTextTree(report),
  };
  return {
    ...report,
    data: nextData,
    helpers: {
      ...(asRecord(report.helpers) ?? {}),
      ...runtimeState.helpers_json,
    },
  };
}

function setTextIfMissing(textTree: TextTree, sectionKey: string, value: string): boolean {
  const normalized = String(value ?? "").trim();
  if (!normalized) return false;
  const current = findTextBySectionKey(textTree, sectionKey).trim();
  if (current) return false;
  const groupKey = inferGroupBySectionKey(sectionKey);
  textTree[groupKey] = {
    ...(textTree[groupKey] ?? {}),
    [sectionKey]: normalized,
  };
  return true;
}

const ORTSLAGE_BERATER_FALLBACK_KEYS = [
  "berater_name",
  "berater_email",
  "berater_telefon_fest",
  "berater_telefon_mobil",
  "berater_telefon",
  "berater_adresse_strasse",
  "berater_adresse_hnr",
  "berater_adresse_plz",
  "berater_adresse_ort",
  "berater_beschreibung",
  "berater_ausbildung",
  "media_berater_avatar",
] as const;

const ORTSLAGE_MAKLER_FALLBACK_KEYS = [
  "makler_name",
  "makler_email",
  "makler_telefon_fest",
  "makler_telefon_mobil",
  "makler_adresse_strasse",
  "makler_adresse_hnr",
  "makler_adresse_plz",
  "makler_adresse_ort",
  "makler_empfehlung",
  "makler_beschreibung",
  "makler_benefits",
  "makler_provision",
  "media_makler_logo",
  "media_makler_bild_01",
  "media_makler_bild_02",
] as const;

function withMetaValue(report: Report, key: string, value: unknown): Report {
  const meta = asRecord(report.meta) ?? {};
  return {
    ...report,
    meta: {
      ...meta,
      [key]: value,
    },
  };
}

async function loadActiveKreisSlugsForBundeslandLive(bundeslandSlug: string): Promise<Set<string>> {
  const fallback = await getActiveKreisSlugsForBundesland(bundeslandSlug);
  try {
    const admin = createAdminClient() as unknown as {
      from: (table: string) => {
        select: (columns: string) => {
          eq: (column: string, value: unknown) => Promise<{
            data?: Array<Record<string, unknown>> | null;
            error?: { message?: string } | null;
          }>;
        } | Promise<{
          data?: Array<Record<string, unknown>> | null;
          error?: { message?: string } | null;
        }>;
      };
    };

    const areaIds = await loadPublicVisibleAreaIds(admin);
    if (areaIds.length === 0) return fallback;

    const areaIdSet = new Set(areaIds);
    const { data: areaRows, error: areaError } = await admin
      .from("areas")
      .select("id, slug, parent_slug, bundesland_slug") as {
      data?: Array<{
        id?: string | null;
        slug?: string | null;
        parent_slug?: string | null;
        bundesland_slug?: string | null;
      }> | null;
      error?: { message?: string } | null;
    };
    if (areaError || !areaRows?.length) return fallback;

    const out = new Set<string>();
    for (const row of areaRows) {
      const id = String(row.id ?? "").trim();
      if (!id || !areaIdSet.has(id)) continue;
      const bl = String(row.bundesland_slug ?? "").trim();
      if (bl !== bundeslandSlug) continue;
      const slug = String(row.slug ?? "").trim();
      const parent = String(row.parent_slug ?? "").trim();
      if (!slug) continue;

      if (parent === bl) {
        out.add(slug);
      } else if (parent) {
        out.add(parent);
      }
    }

    return out.size > 0 ? out : fallback;
  } catch {
    return fallback;
  }
}

export async function buildPageModel(route: RouteModel, options?: BuildPageModelOptions): Promise<PageModel | null> {
  console.log("\n=== buildPageModel ===");
  console.log("ROUTE", {
    level: route.level,
    section: route.section,
    regionSlugs: route.regionSlugs,
    fullSlugs: route.fullSlugs,
    audience: options?.audience ?? "public",
  });

  let report = await getReportBySlugs(route.regionSlugs);
  if (!report) {
    console.log("REPORT: null (not found)");
    return null;
  }

  const audience = options?.audience ?? "public";
  const pathPrefix = options?.pathPrefix ?? "/immobilienmarkt";
  const locale = String(options?.locale ?? "de").trim().toLowerCase() || "de";
  const [routeBundeslandSlug, routeKreisSlug, routeOrtSlug] = route.regionSlugs;
  if (audience === "public" && route.level === "bundesland" && routeBundeslandSlug) {
    if (!(await isBundeslandVisible(routeBundeslandSlug))) return null;
  }
  if (audience === "public" && route.level === "kreis" && routeBundeslandSlug && routeKreisSlug) {
    if (!(await isKreisVisible(routeBundeslandSlug, routeKreisSlug))) return null;
  }
  if (audience === "public" && route.level === "ort" && routeBundeslandSlug && routeKreisSlug && routeOrtSlug) {
    if (!(await isOrtslageVisible(routeBundeslandSlug, routeKreisSlug, routeOrtSlug))) return null;
  }

  // Sicherstellen, dass text auch unter data.text vorhanden ist (einheitliche Quelle für Builder)
  const rawData = asRecord(report.data) ?? {};
  const rawDataText = asRecord(rawData["text"]);
  const rawTopText = asRecord(report["text"]);
  const mergedInitialText = rawTopText || rawDataText
    ? {
        ...(rawTopText ?? {}),
        ...(rawDataText ?? {}),
      }
    : null;
  if (mergedInitialText) {
    report = {
      ...report,
      text: mergedInitialText,
      data: {
        ...rawData,
        text: mergedInitialText,
      },
    };
  }

  const meta = asRecord(asArray(report.meta)[0] ?? report.meta) ?? {};
  const areaId =
    (asString(meta["ortslage_schluessel"]) ??
      asString(meta["kreis_schluessel"]) ??
      "") || "";
  const areaScope = areaId
    ? (route.level === "ort" ? "ortslage" : "kreis")
    : null;
  const supabase = areaId ? (createAdminClient() as unknown as SupabaseClientLike) : null;
  const scopedPartnerContext = areaId && supabase
    ? await loadPublicVisiblePartnerContextForArea(supabase, areaId)
    : { partnerId: null, isSystemDefault: false };
  const scopedPartnerId = scopedPartnerContext.partnerId;
  const isSystemDefaultPartner = scopedPartnerContext.isSystemDefault;

  if ((route.level === "kreis" || route.level === "ort") && isSystemDefaultPartner && supabase) {
    const profile = await downloadSystempartnerDefaultProfile(createAdminClient());
    const nextText = applySystempartnerDefaultProfileToReportText(report["text"], profile);
    report = withTextTree(report, toTextTree(nextText));
  }
  report = withMetaValue(report, "active_partner_is_system_default", isSystemDefaultPartner);

  if (areaId && areaScope && supabase && scopedPartnerId) {
    const runtimeState = await getPartnerAreaRuntimeState(supabase, scopedPartnerId, areaId, areaScope);
    if (runtimeState) {
      report = withPartnerRuntimeState(report, runtimeState, areaScope);
    }
  }

  if (areaId) {
    let ortslageNameMap: Record<string, string> | undefined = undefined;
    if (route.level === "kreis" && route.regionSlugs.length >= 2) {
      const [bundeslandSlug, kreisSlug] = route.regionSlugs;
      const orte = await getOrteForKreis(bundeslandSlug, kreisSlug);
      ortslageNameMap = Object.fromEntries(orte.map((o) => [o.slug, o.name]));
    }
    report = applyDataDrivenTexts(report, areaId, ortslageNameMap);

    if (supabase && scopedPartnerId && areaScope) {
      const generatedTexts = await getPartnerAreaGeneratedTexts(supabase, scopedPartnerId, areaId, areaScope);
      if (generatedTexts.length > 0) {
        report = withTextTree(
          report,
          applyOverridesToTextTree(getTextTree(report), generatedTexts),
        );
      }
    }
  }

  // DB-Overrides: approved report_texts überschreiben JSON-Texte (if present)
  if (areaId && supabase) {
    const overrides = scopedPartnerId
      ? await getApprovedReportTexts(supabase, areaId, scopedPartnerId)
      : [];
    if (overrides.length > 0) {
      const mergedText = applyOverridesToTextTree(
        getTextTree(report),
        overrides.map((entry) => ({
          section_key: entry.section_key,
          optimized_content: entry.optimized_content,
        })),
      );
      report = withTextTree(report, mergedText);
    }
  }

  // Ortsebene: Berater-/Maklerdaten key-basiert aus Kreisreport ergänzen
  if (route.level === "ort") {
    let kreisReport =
      route.regionSlugs.length >= 2
        ? await getReportBySlugs(route.regionSlugs.slice(0, 2))
        : null;

    if (kreisReport) {
      const supabase = createAdminClient() as unknown as SupabaseClientLike;
      const kreisMeta = asRecord(asArray(kreisReport.meta)[0] ?? kreisReport.meta) ?? {};
      const kreisAreaId = asString(kreisMeta["kreis_schluessel"]) ?? "";
      if (kreisAreaId) {
        const kreisPartnerContext = await loadPublicVisiblePartnerContextForArea(supabase, kreisAreaId);
        if (kreisPartnerContext.isSystemDefault) {
          const profile = await downloadSystempartnerDefaultProfile(createAdminClient());
          const nextText = applySystempartnerDefaultProfileToReportText(kreisReport["text"], profile);
          kreisReport = withTextTree(kreisReport, toTextTree(nextText));
        }
        const overrides = kreisPartnerContext.partnerId
          ? await getApprovedReportTexts(supabase, kreisAreaId, kreisPartnerContext.partnerId)
          : [];
        if (overrides.length > 0) {
          const mergedKreisText = applyOverridesToTextTree(
            getTextTree(kreisReport),
            overrides.map((entry) => ({
              section_key: entry.section_key,
              optimized_content: entry.optimized_content,
            })),
          );
          kreisReport = withTextTree(kreisReport, mergedKreisText);
        }
      }

      const ortText = asRecord(report["text"]) ?? {};
      const kreisData = asRecord(kreisReport.data) ?? {};
      const kreisText = asRecord(kreisReport["text"]) ?? asRecord(kreisData["text"]) ?? {};
      const mergedText = {
        ...kreisText,
        ...ortText,
        berater: {
          ...(asRecord(kreisText["berater"]) ?? {}),
          ...(asRecord(ortText["berater"]) ?? {}),
        },
        makler: {
          ...(asRecord(kreisText["makler"]) ?? {}),
          ...(asRecord(ortText["makler"]) ?? {}),
        },
      };
      const mergedTree = toTextTree(mergedText);
      const kreisTree = toTextTree(kreisText);
      for (const key of ORTSLAGE_BERATER_FALLBACK_KEYS) {
        setTextIfMissing(mergedTree, key, findTextBySectionKey(kreisTree, key));
      }
      for (const key of ORTSLAGE_MAKLER_FALLBACK_KEYS) {
        setTextIfMissing(mergedTree, key, findTextBySectionKey(kreisTree, key));
      }
      report = withTextTree(report, mergedTree);
    }
  }

  console.log("REPORT META (raw)", report.meta);
  const regionaleZuordnung = asString(meta["regionale_zuordnung"]) ?? "";
  console.log("REPORT META PICK", {
    zuordnung: meta["regionale_zuordnung"],
    amtlicher_name: meta["amtlicher_name"],
    kreis_name: meta["kreis_name"],
    kreis_schluessel: meta["kreis_schluessel"],
    bundesland_name: meta["bundesland_name"],
    aktualisierung: meta["aktualisierung"],
  });

  // optional: ein paar top-level data keys, damit man sofort sieht, ob "kreis-artig"
  const data = asRecord(report.data) ?? {};
  console.log("REPORT DATA KEYS", Object.keys(data).slice(0, 40));

  const basePath = basePathFromRegionSlugs(route.regionSlugs, pathPrefix);

  // Parent-Pfad nur für Ort-Ebene (Bundesland/Kreis)
  const parentBasePath =
    route.level === "ort" && route.regionSlugs.length >= 2
      ? basePathFromRegionSlugs(route.regionSlugs.slice(0, 2), pathPrefix)
      : undefined;

  const tabsByLevel = IMMOBILIENMARKT_THEME.tabsByLevel[route.level] ?? [];
  const tabsForLevel =
    route.level === "ort" && regionaleZuordnung === "stadtteil"
      ? tabsByLevel.filter((tab) => tab.id !== "grundstueckspreise")
      : tabsByLevel;
  const defaultTab = IMMOBILIENMARKT_THEME.defaultTabByLevel[route.level];

  const activeTabId = normalizeActiveTab({
    level: route.level,
    requested: route.section,
    tabsForLevel,
    defaultTab,
  });

  const activeTab = tabsForLevel.find((t) => t.id === activeTabId) ?? tabsForLevel[0] ?? null;
  const tocItems = activeTab?.toc ?? [];

  // Kontext-Slugs
  const [bundeslandSlug, kreisSlug, ortSlug] = route.regionSlugs;

  // Kontext-Daten
  let orte: PageModel["ctx"]["orte"] | undefined;
  let berater: PageModel["ctx"]["berater"] | undefined;
  let makler: PageModel["ctx"]["makler"] | undefined;
  let assets: PageModel["assets"] | undefined;

  // Bundesland: "orte" = Kreise (für Navigation unten)
  if (route.level === "bundesland" && bundeslandSlug) {
    const admin = createAdminClient() as unknown as SupabaseClientLike;
    const kreise = await getKreiseForBundesland(bundeslandSlug);
    const activeKreisSlugs = await loadActiveKreisSlugsForBundeslandLive(bundeslandSlug);
    const visibleKreise = kreise.filter((k) => activeKreisSlugs.has(k.slug));
    orte = kreise.map((k) => ({
      slug: k.slug,
      name: k.name,
    }));
    orte = visibleKreise.map((k) => ({
      slug: k.slug,
      name: k.name,
    }));

    const adminOverrides = await getApprovedAdminAreaTexts(admin, "bundesland", bundeslandSlug);
    if (adminOverrides.length > 0) {
      const mergedBundeslandText = applyOverridesToTextTree(getTextTree(report), adminOverrides);
      report = withTextTree(report, mergedBundeslandText);
    }

    if (locale !== "de") {
      const translatedOverrides = await getLiveAdminAreaTextTranslations(
        admin,
        "bundesland",
        bundeslandSlug,
        locale,
      );
      if (translatedOverrides.length > 0) {
        const translatedBundeslandText = applyOverridesToTextTree(getTextTree(report), translatedOverrides);
        report = withTextTree(report, translatedBundeslandText);
      }
    }

    const kreisTextRows = (
      await Promise.all(
        visibleKreise.map(async (kreis) => {
          const kreisReport = await getReportBySlugs([bundeslandSlug, kreis.slug]);
          if (!kreisReport) return null;

          const kreisMeta = asRecord(asArray(kreisReport.meta)[0] ?? kreisReport.meta) ?? {};
          const kreisAreaId = asString(kreisMeta["kreis_schluessel"]) ?? "";
          let textTree = getTextTree(kreisReport);
          if (kreisAreaId) {
            const overrides = await getApprovedReportTexts(admin, kreisAreaId);
            if (overrides.length > 0) {
              textTree = applyOverridesToTextTree(
                textTree,
                overrides.map((entry) => ({
                  section_key: entry.section_key,
                  optimized_content: entry.optimized_content,
                })),
              );
            }
          }

          return { kreis, textTree };
        }),
      )
    ).filter((entry): entry is { kreis: { slug: string; name: string }; textTree: TextTree } => Boolean(entry));

    const fallbackKeys = [
      "immobilienmarkt_allgemein",
      "immobilienmarkt_standort_teaser",
      "immobilienmarkt_individuell_01",
      "immobilienmarkt_zitat",
      "immobilienmarkt_individuell_02",
      "immobilienmarkt_beschreibung_01",
      "immobilienmarkt_beschreibung_02",
      "immobilienmarkt_besonderheiten",
      "immobilienmarkt_maklerempfehlung",
      "berater_name",
    ];
    const bundeslandTextTree = getTextTree(report);
    let bundeslandChanged = false;
    for (const key of fallbackKeys) {
      const sourceText =
        kreisTextRows
          .map((row) => findTextBySectionKey(row.textTree, key))
          .find((value) => String(value ?? "").trim().length > 0) ?? "";
      bundeslandChanged = setTextIfMissing(bundeslandTextTree, key, sourceText) || bundeslandChanged;
    }
    if (bundeslandChanged) {
      report = withTextTree(report, bundeslandTextTree);
    }

    const maklerSeen = new Set<string>();
    const maklerEntries = kreisTextRows
      .map((row) => {
        const maklerName = findTextBySectionKey(row.textTree, "makler_name");
        if (!maklerName) return null;
        if (maklerSeen.has(maklerName)) return null;
        maklerSeen.add(maklerName);

        return {
          slug: row.kreis.slug,
          name: maklerName,
          imageSrc: resolveMandatoryMediaSrc(
            "media_makler_logo",
            findTextBySectionKey(row.textTree, "media_makler_logo"),
          ),
          kontaktHref: `${pathPrefix}/${bundeslandSlug}/${row.kreis.slug}/immobilienmakler`,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

    const beraterSeen = new Set<string>();
    const beraterEntries = kreisTextRows
      .map((row) => {
        const beraterName = findTextBySectionKey(row.textTree, "berater_name");
        if (!beraterName) return null;
        if (beraterSeen.has(beraterName)) return null;
        beraterSeen.add(beraterName);

        return {
          slug: row.kreis.slug,
          name: beraterName,
          imageSrc: resolveMandatoryMediaSrc(
            "media_berater_avatar",
            findTextBySectionKey(row.textTree, "media_berater_avatar"),
          ),
          kontaktHref: `${pathPrefix}/${bundeslandSlug}/${row.kreis.slug}/immobilienberatung`,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

    berater = beraterEntries.length > 0 ? beraterEntries : undefined;
    makler = maklerEntries.length > 0 ? maklerEntries : undefined;

    const heroImageSrc = buildWebAssetUrl(
      `/images/immobilienmarkt/${bundeslandSlug}/immobilienmarktbericht-${bundeslandSlug}.webp`,
    );
    const kreisuebersichtMapSvg = await getKreisUebersichtMapSvg(
      bundeslandSlug,
      activeKreisSlugs,
      pathPrefix,
    );

    assets = { heroImageSrc, kreisuebersichtMapSvg };
  }

  // Ort + Kreis: (Ort nutzt dieselben Kreis-Assets)
  if ((route.level === "kreis" || route.level === "ort") && bundeslandSlug && kreisSlug) {
    const allOrte = await getOrteForKreis(bundeslandSlug, kreisSlug);
    const activeOrtSlugs = await getActiveOrtSlugsForKreis(bundeslandSlug, kreisSlug);
    orte = activeOrtSlugs.size > 0
      ? allOrte.filter((ort) => activeOrtSlugs.has(ort.slug))
      : allOrte;

    const heroImageSrc = buildWebAssetUrl(
      `/images/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/immobilienmarktbericht-${kreisSlug}.webp`,
    );
    const immobilienpreisMapSvg = await getImmobilienpreisMapSvg(bundeslandSlug, kreisSlug, pathPrefix);
    const immobilienpreisLegendHtml = await getLegendHtml("immobilienpreis");
    const mietpreisMapSvg = await getMietpreisMapSvg(bundeslandSlug, kreisSlug, pathPrefix);
    const mietpreisLegendHtml = await getLegendHtml("mietpreis");
    const grundstueckspreisMapSvg = await getGrundstueckspreisMapSvg(
      bundeslandSlug,
      kreisSlug,
      pathPrefix,
    );
    const grundstueckspreisLegendHtml = await getLegendHtml("grundstueckspreis");
    const kaufpreisfaktorMapSvg = await getKaufpreisfaktorMapSvg(bundeslandSlug, kreisSlug, pathPrefix);
    const kaufpreisfaktorLegendHtml = await getLegendHtml("kaufpreisfaktor");
    const wohnungssaldoMapSvg = await getWohnungssaldoMapSvg(bundeslandSlug, kreisSlug, pathPrefix);
    const wohnungssaldoLegendHtml = await getLegendHtml("wohnungssaldo");
    const kaufkraftindexMapSvg = await getKaufkraftindexMapSvg(bundeslandSlug, kreisSlug, pathPrefix);
    const kaufkraftindexLegendHtml = await getLegendHtml("kaufkraftindex");
    const {
      src: flaechennutzungGewerbeImageSrc,
      usesKreisFallback: flaechennutzungGewerbeUsesKreisFallback,
    } = await getFlaechennutzungGewerbeImageSrc(
      bundeslandSlug,
      kreisSlug,
      route.level === "ort" ? ortSlug : undefined,
    );
    const {
      src: flaechennutzungWohnbauImageSrc,
      usesKreisFallback: flaechennutzungWohnbauUsesKreisFallback,
    } = await getFlaechennutzungWohnbauImageSrc(
      bundeslandSlug,
      kreisSlug,
      route.level === "ort" ? ortSlug : undefined,
    );

    const wohnlagenThemes = [
      "mobilitaet",
      "bildung",
      "gesundheit",
      "naherholung",
      "nahversorgung",
      "kultur_freizeit",
    ];
    const wohnlagencheckMapSvgs = Object.fromEntries(
      await Promise.all(
        wohnlagenThemes.map(async (theme) => [
          theme,
          await getWohnlagencheckMapSvg(bundeslandSlug, kreisSlug, theme, pathPrefix),
        ]),
      ),
    );
    const wohnlagencheckLegendHtml = Object.fromEntries(
      await Promise.all(
        wohnlagenThemes.map(async (theme) => [theme, await getLegendHtml(theme)]),
      ),
    );

    assets = {
      heroImageSrc,
      immobilienpreisMapSvg,
      immobilienpreisLegendHtml,
      mietpreisMapSvg,
      mietpreisLegendHtml,
      grundstueckspreisMapSvg,
      grundstueckspreisLegendHtml,
      kaufpreisfaktorMapSvg,
      kaufpreisfaktorLegendHtml,
      kaufkraftindexMapSvg,
      kaufkraftindexLegendHtml,
      flaechennutzungGewerbeImageSrc,
      flaechennutzungGewerbeUsesKreisFallback,
      flaechennutzungWohnbauImageSrc,
      flaechennutzungWohnbauUsesKreisFallback,
      wohnungssaldoMapSvg,
      wohnungssaldoLegendHtml,
      wohnlagencheckMapSvgs,
      wohnlagencheckLegendHtml,
    };
  }

  // -------------------------
  // Kontakt (Portal vs Berater)
  // -------------------------
  const portalKontakt: NonNullable<PageModel["kontakt"]> = {
    scope: "portal",
    title: "Kontakt Wohnlagencheck24",
    name: "Wohnlagencheck24 Team",
    email: "kontakt@wohnlagencheck24.de",
    phone: "+49 351/287051-0",
    regionLabel: "Allgemeine Anfrage",
    subjectDefault: "Kontaktanfrage (Portal)",
  };

  let kontakt: PageModel["kontakt"] | undefined;

  if (route.level === "kreis" || route.level === "ort") {
    const kreisName = getRegionDisplayName({
      meta,
      level: route.level === "ort" ? "ort" : "kreis",
      fallbackSlug: kreisSlug ?? "landkreis",
    });

    const text = asRecord(report?.["text"]) ?? asRecord(data["text"]) ?? {};
    const berater = asRecord(text["berater"]) ?? {};

    const beraterName = asString(berater["berater_name"]) ?? "Lars Hofmann";
    const beraterTelefon =
      asString(berater["berater_telefon_mobil"]) ??
      asString(berater["berater_telefon_fest"]) ??
      asString(berater["berater_telefon"]) ??
      "+49 351/287051-0";
    const beraterEmail =
      asString(berater["berater_email"]) ??
      "kontakt@wohnlagencheck24.de";

    const beraterTaetigkeit = `Standort- / Immobilienberatung – ${kreisName}`;

    const beraterImageSrc =
      bundeslandSlug && kreisSlug
        ? resolveMandatoryMediaSrc("media_berater_avatar", asString(berater["media_berater_avatar"]))
        : undefined;

    kontakt = {
      scope: "berater",
      title: "Beraterkontakt",
      name: String(beraterName),
      email: String(beraterEmail),
      phone: String(beraterTelefon),
      imageSrc: beraterImageSrc,
      regionLabel: beraterTaetigkeit,
      subjectDefault: `Kontaktanfrage – ${kreisName}`,
    };
  } else {
    // Deutschland / Bundesland
    kontakt = portalKontakt;
  }

  return {
    route,
    report,
    basePath,
    parentBasePath,

    tabs: tabsForLevel.map((t) => ({ id: t.id, label: t.label, iconSrc: t.iconSrc })),
    activeTabId,
    tocItems,

    ctx: { bundeslandSlug, kreisSlug, ortSlug, orte, berater, makler },
    assets,

    kontakt,
    flags: {
      isSystemDefaultPartner,
    },
  };
}
