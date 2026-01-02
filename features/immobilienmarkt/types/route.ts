export const REPORT_SECTIONS = [
  "immobilienpreise",
  "mietpreise",
  "mietrendite",
  "wohnmarktsituation",
  "grundstueckspreise",
  "wohnlagencheck",
  "wirtschaft",
] as const;

export type ReportSection =
  | (typeof REPORT_SECTIONS)[number]
  | "uebersicht";

export type RouteLevel = "deutschland" | "bundesland" | "kreis" | "ort";

export type RouteModel = {
  level: RouteLevel;
  section: ReportSection;
  regionSlugs: string[];     // ohne Section-Slug
  fullSlugs: string[];       // inkl. Section-Slug (falls vorhanden)
};
