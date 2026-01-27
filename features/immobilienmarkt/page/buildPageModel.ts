// features/immobilienmarkt/page/buildPageModel.ts

import type { RouteModel, ReportSection, RouteLevel } from "../types/route";
import { isSectionAllowed } from "../types/route";
import { IMMOBILIENMARKT_THEME } from "../config/theme";

import type { Report } from "@/lib/data";
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
} from "@/lib/data";
import { asArray, asRecord, asString } from "@/utils/records";
import { getRegionDisplayName } from "@/utils/regionName";

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
};

function basePathFromRegionSlugs(regionSlugs: string[]): string {
  return "/immobilienmarkt" + (regionSlugs.length ? "/" + regionSlugs.join("/") : "");
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

export function buildPageModel(route: RouteModel): PageModel | null {
  console.log("\n=== buildPageModel ===");
  console.log("ROUTE", {
    level: route.level,
    section: route.section,
    regionSlugs: route.regionSlugs,
    fullSlugs: route.fullSlugs,
  });

  let report = getReportBySlugs(route.regionSlugs);
  if (!report) {
    console.log("REPORT: null (not found)");
    return null;
  }

  // Sicherstellen, dass text auch unter data.text vorhanden ist (einheitliche Quelle für Builder)
  const rawData = asRecord(report.data) ?? {};
  const rawDataText = asRecord(rawData["text"]);
  const rawTopText = asRecord(report["text"]);
  if (rawTopText && !rawDataText) {
    report = {
      ...report,
      data: {
        ...rawData,
        text: rawTopText,
      },
    };
  }

  // Ortsebene: fehlende Berater-/Maklerdaten aus Kreisreport ergänzen
  if (route.level === "ort") {
    const kreisReport =
      route.regionSlugs.length >= 2
        ? getReportBySlugs(route.regionSlugs.slice(0, 2))
        : null;
    const ortText = asRecord(report["text"]) ?? {};
    const ortHasBerater = Boolean(asRecord(ortText["berater"])?.["berater_name"]);
    const ortHasMakler = Boolean(asRecord(ortText["makler"])?.["makler_name"]);

    if (kreisReport && (!ortHasBerater || !ortHasMakler)) {
      const kreisData = asRecord(kreisReport.data) ?? {};
      const kreisText = asRecord(kreisReport["text"]) ?? asRecord(kreisData["text"]) ?? {};
      const mergedText = {
        ...kreisText,
        ...ortText,
        berater: ortHasBerater ? ortText["berater"] : kreisText["berater"],
        makler: ortHasMakler ? ortText["makler"] : kreisText["makler"],
      };

      report = {
        ...report,
        text: mergedText,
        data: {
          ...(asRecord(report.data) ?? {}),
          text: mergedText,
        },
      };
    }
  }

  console.log("REPORT META (raw)", report.meta);
  const meta = asRecord(asArray(report.meta)[0] ?? report.meta) ?? {};
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

  const basePath = basePathFromRegionSlugs(route.regionSlugs);

  // Parent-Pfad nur für Ort-Ebene (Bundesland/Kreis)
  const parentBasePath =
    route.level === "ort" && route.regionSlugs.length >= 2
      ? basePathFromRegionSlugs(route.regionSlugs.slice(0, 2))
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
    const kreise = getKreiseForBundesland(bundeslandSlug);
    orte = kreise.map((k) => ({
      slug: k.slug,
      name: k.name,
    }));

    const maklerSeen = new Set<string>();
    const maklerEntries = kreise
      .map((kreis) => {
        const kreisReport = getReportBySlugs([bundeslandSlug, kreis.slug]);
        if (!kreisReport) return null;

        const kreisData = asRecord(kreisReport.data) ?? {};
        const text = asRecord(kreisReport["text"]) ?? asRecord(kreisData["text"]) ?? {};
        const maklerRecord = asRecord(text["makler"]) ?? {};
        const maklerName = asString(maklerRecord["makler_name"]) ?? "";
        if (!maklerName) return null;
        if (maklerSeen.has(maklerName)) return null;
        maklerSeen.add(maklerName);

        return {
          slug: kreis.slug,
          name: maklerName,
          imageSrc: `/images/immobilienmarkt/${bundeslandSlug}/${kreis.slug}/makler-${kreis.slug}-logo.jpg`,
          kontaktHref: `/immobilienmarkt/${bundeslandSlug}/${kreis.slug}/immobilienmakler`,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

    const beraterSeen = new Set<string>();
    const beraterEntries = kreise
      .map((kreis) => {
        const kreisReport = getReportBySlugs([bundeslandSlug, kreis.slug]);
        if (!kreisReport) return null;

        const kreisData = asRecord(kreisReport.data) ?? {};
        const text = asRecord(kreisReport["text"]) ?? asRecord(kreisData["text"]) ?? {};
        const beraterRecord = asRecord(text["berater"]) ?? {};
        const beraterName = asString(beraterRecord["berater_name"]) ?? "";
        if (!beraterName) return null;
        if (beraterSeen.has(beraterName)) return null;
        beraterSeen.add(beraterName);

        return {
          slug: kreis.slug,
          name: beraterName,
          imageSrc: `/images/immobilienmarkt/${bundeslandSlug}/${kreis.slug}/immobilienberatung-${kreis.slug}.png`,
          kontaktHref: `/immobilienmarkt/${bundeslandSlug}/${kreis.slug}/immobilienberatung`,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

    berater = beraterEntries.length > 0 ? beraterEntries : undefined;
    makler = maklerEntries.length > 0 ? maklerEntries : undefined;

    const heroImageSrc = `/images/immobilienmarkt/${bundeslandSlug}/immobilienmarktbericht-${bundeslandSlug}.jpg`;
    const kreisuebersichtMapSvg = getKreisUebersichtMapSvg(bundeslandSlug);

    assets = { heroImageSrc, kreisuebersichtMapSvg };
  }

  // Ort + Kreis: (Ort nutzt dieselben Kreis-Assets)
  if ((route.level === "kreis" || route.level === "ort") && bundeslandSlug && kreisSlug) {
    orte = getOrteForKreis(bundeslandSlug, kreisSlug);

    const heroImageSrc = `/images/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/immobilienmarktbericht-${kreisSlug}.jpg`;
    const immobilienpreisMapSvg = getImmobilienpreisMapSvg(bundeslandSlug, kreisSlug);
    const immobilienpreisLegendHtml = getLegendHtml("immobilienpreis");
    const mietpreisMapSvg = getMietpreisMapSvg(bundeslandSlug, kreisSlug);
    const mietpreisLegendHtml = getLegendHtml("mietpreis");
    const grundstueckspreisMapSvg = getGrundstueckspreisMapSvg(bundeslandSlug, kreisSlug);
    const grundstueckspreisLegendHtml = getLegendHtml("grundstueckspreis");
    const kaufpreisfaktorMapSvg = getKaufpreisfaktorMapSvg(bundeslandSlug, kreisSlug);
    const kaufpreisfaktorLegendHtml = getLegendHtml("kaufpreisfaktor");
    const wohnungssaldoMapSvg = getWohnungssaldoMapSvg(bundeslandSlug, kreisSlug);
    const wohnungssaldoLegendHtml = getLegendHtml("wohnungssaldo");
    const kaufkraftindexMapSvg = getKaufkraftindexMapSvg(bundeslandSlug, kreisSlug);
    const kaufkraftindexLegendHtml = getLegendHtml("kaufkraftindex");
    const {
      src: flaechennutzungGewerbeImageSrc,
      usesKreisFallback: flaechennutzungGewerbeUsesKreisFallback,
    } = getFlaechennutzungGewerbeImageSrc(
      bundeslandSlug,
      kreisSlug,
      route.level === "ort" ? ortSlug : undefined,
    );
    const {
      src: flaechennutzungWohnbauImageSrc,
      usesKreisFallback: flaechennutzungWohnbauUsesKreisFallback,
    } = getFlaechennutzungWohnbauImageSrc(
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
      wohnlagenThemes.map((theme) => [theme, getWohnlagencheckMapSvg(bundeslandSlug, kreisSlug, theme)]),
    );
    const wohnlagencheckLegendHtml = Object.fromEntries(
      wohnlagenThemes.map((theme) => [theme, getLegendHtml(theme)]),
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
      asString(berater["berater_telefon"]) ??
      "+49 351/287051-0";
    const beraterEmail =
      asString(berater["berater_email"]) ??
      "kontakt@wohnlagencheck24.de";

    const beraterTaetigkeit = `Standort- / Immobilienberatung – ${kreisName}`;

    const beraterImageSrc =
      bundeslandSlug && kreisSlug
        ? `/images/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/immobilienberatung-${kreisSlug}.png`
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
  };
}
