// features/immobilienmarkt/routes/resolveRoute.ts
import { REPORT_SECTIONS, type RouteModel, type ReportSection } from "../types/route";

const SECTION_SLUGS: ReadonlyArray<ReportSection> = ["uebersicht", ...REPORT_SECTIONS];

export function resolveRoute(slugs: string[]): RouteModel {
  const fullSlugs = slugs ?? [];

  let section: ReportSection = "uebersicht";
  let regionSlugs = fullSlugs;

  const last = fullSlugs.length > 0 ? fullSlugs[fullSlugs.length - 1] : undefined;
  const isSection =
    typeof last === "string" && (SECTION_SLUGS as ReadonlyArray<string>).includes(last);

  // Logging: besser nicht das ganze Array dumpen
  console.log("[resolveRoute]", { fullSlugs, last, isSection, sectionSlugsCount: SECTION_SLUGS.length });

  if (isSection) {
    section = last as ReportSection;
    regionSlugs = fullSlugs.slice(0, -1);
  }

  const level =
    regionSlugs.length === 0 ? "deutschland" :
    regionSlugs.length === 1 ? "bundesland" :
    regionSlugs.length === 2 ? "kreis" :
    "ort";

  console.log("[resolveRoute.result]", { level, section, regionSlugs, fullSlugs });

  return { level, section, regionSlugs, fullSlugs };
}
