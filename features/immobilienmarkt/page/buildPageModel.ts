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
  getKaufpreisfaktorMapSvg,
} from "@/lib/data";
import { asArray, asRecord, asString } from "@/utils/records";

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
    orte?: Array<{ slug: string; name: string; plz?: string }>;
  };

  // zentral (nicht in ctx)
  assets?: {
    heroImageSrc?: string;
    immobilienpreisMapSvg?: string | null;
    mietpreisMapSvg?: string | null;
    kreisuebersichtMapSvg?: string | null;
    kaufpreisfaktorMapSvg?: string | null;
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

  const report = getReportBySlugs(route.regionSlugs);
  if (!report) {
    console.log("REPORT: null (not found)");
    return null;
  }

  console.log("REPORT META (raw)", report.meta);
  const meta = asRecord(asArray(report.meta)[0] ?? report.meta) ?? {};
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

  const tabsForLevel = IMMOBILIENMARKT_THEME.tabsByLevel[route.level] ?? [];
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
  let assets: PageModel["assets"] | undefined;

  // Bundesland: "orte" = Kreise (für Navigation unten)
  if (route.level === "bundesland" && bundeslandSlug) {
    orte = getKreiseForBundesland(bundeslandSlug).map((k) => ({
      slug: k.slug,
      name: k.name,
    }));

    const heroImageSrc = `/images/immobilienmarkt/${bundeslandSlug}/immobilienmarktbericht-${bundeslandSlug}.jpg`;
    const kreisuebersichtMapSvg = getKreisUebersichtMapSvg(bundeslandSlug);

    assets = { heroImageSrc, kreisuebersichtMapSvg };
  }

  // Ort + Kreis: (Ort nutzt dieselben Kreis-Assets)
  if ((route.level === "kreis" || route.level === "ort") && bundeslandSlug && kreisSlug) {
    orte = getOrteForKreis(bundeslandSlug, kreisSlug);

    const heroImageSrc = `/images/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/immobilienmarktbericht-${kreisSlug}.jpg`;
    const immobilienpreisMapSvg = getImmobilienpreisMapSvg(bundeslandSlug, kreisSlug);
    const mietpreisMapSvg = getMietpreisMapSvg(bundeslandSlug, kreisSlug);
    const kaufpreisfaktorMapSvg = getKaufpreisfaktorMapSvg(bundeslandSlug, kreisSlug);

    assets = { heroImageSrc, immobilienpreisMapSvg, mietpreisMapSvg, kaufpreisfaktorMapSvg };
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
    imageSrc: "/images/immobilienmarkt/berater.png",
    regionLabel: "Allgemeine Anfrage",
    subjectDefault: "Kontaktanfrage (Portal)",
  };

  let kontakt: PageModel["kontakt"] | undefined;

  if (route.level === "kreis" || route.level === "ort") {
    const kreisName =
      String(
        asString(meta["amtlicher_name"]) ??
          asString(meta["name"]) ??
          kreisSlug ??
          "",
      ).trim() ||
      String(kreisSlug ?? "Landkreis");

    const text = asRecord(data["text"]) ?? {};
    const berater = asRecord(text["berater"]) ?? {};

    const beraterName = asString(berater["berater_name"]) ?? "Lars Hofmann";
    const beraterTelefon = asString(berater["berater_telefon"]) ?? "+49 351/287051-0";
    const beraterEmail = asString(berater["berater_email"]) ?? "kontakt@wohnlagencheck24.de";

    const beraterTaetigkeit = `Standort- / Immobilienberatung – ${kreisName}`;

    const beraterImageSrc =
      bundeslandSlug && kreisSlug
        ? `/images/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/immobilienberatung-${kreisSlug}.png`
        : "/images/immobilienmarkt/berater.png";

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

    ctx: { bundeslandSlug, kreisSlug, ortSlug, orte },
    assets,

    kontakt,
  };
}
