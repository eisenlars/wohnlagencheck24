// features/immobilienmarkt/types/route.ts

export const REPORT_SECTIONS = [
  "immobilienpreise",
  "mietpreise",
  "mietrendite",
  "wohnmarktsituation",
  "grundstueckspreise",
  "wohnlagencheck",
  "wirtschaft",
] as const;

export type ReportSection = (typeof REPORT_SECTIONS)[number] | "uebersicht";

export type RouteLevel = "deutschland" | "bundesland" | "kreis" | "ort";

export type RouteModel = {
  level: RouteLevel;
  section: ReportSection;
  regionSlugs: string[]; // ohne Section-Slug
  fullSlugs: string[];   // inkl. Section-Slug (falls vorhanden)
};

/**
 * Level-Regeln (Contract für Composer/Registry)
 * - Deutschland/Bundesland/Kreis: dürfen Übersicht + alle Themen-Seiten haben
 * - Ort: KEINE Übersicht (Ort startet direkt mit einem Thema-Tab)
 */
export const ALLOWED_SECTIONS_BY_LEVEL: Record<RouteLevel, ReadonlyArray<ReportSection>> = {
  deutschland: ["uebersicht", ...REPORT_SECTIONS],
  bundesland: ["uebersicht", ...REPORT_SECTIONS],
  kreis: ["uebersicht", ...REPORT_SECTIONS],
  ort: [...REPORT_SECTIONS],
} as const;

export function isSectionAllowed(level: RouteLevel, section: ReportSection): boolean {
  return ALLOWED_SECTIONS_BY_LEVEL[level].includes(section);
}
