import { REPORT_SECTIONS, type RouteModel, type ReportSection } from "../types/route";

export function resolveRoute(slugs: string[]): RouteModel {
  const fullSlugs = slugs ?? [];

  let section: ReportSection = "uebersicht";
  let regionSlugs = fullSlugs;

  if (fullSlugs.length > 0) {
    const last = fullSlugs[fullSlugs.length - 1];
    if (REPORT_SECTIONS.includes(last as any)) {
      section = last as ReportSection;
      regionSlugs = fullSlugs.slice(0, -1);
    }
  }

  const level =
    regionSlugs.length === 0 ? "deutschland" :
    regionSlugs.length === 1 ? "bundesland" :
    regionSlugs.length === 2 ? "kreis" :
    "ort";

  return { level, section, regionSlugs, fullSlugs };
}
