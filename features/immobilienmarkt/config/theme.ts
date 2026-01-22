// features/immobilienmarkt/config/theme.ts

import type { RouteLevel, ReportSection } from "../types/route";

// nur noch aus EINER Quelle importieren (nicht mischen)
import type { TocItem, Tab } from "./TabsAndSections";
import { BUNDESLAND_TABS, KREIS_TABS, TABS } from "./TabsAndSections";

export type ThemeTab = {
  id: ReportSection;
  label: string;
  iconSrc: string;
  toc: TocItem[];
};

export type ThemeConfig = {
  tabsByLevel: Record<RouteLevel, ThemeTab[]>;
  defaultTabByLevel: Record<RouteLevel, ReportSection>;
};

// Helper: KreisTabs -> ThemeTab[]
const mapKreisTabs = (tabs: Tab[]): ThemeTab[] =>
  tabs.map((t) => ({ id: t.id, label: t.label, iconSrc: t.iconSrc, toc: t.toc }));

const ALL_TABS: ThemeTab[] = mapKreisTabs(TABS);
const BUNDESLAND_THEME_TABS: ThemeTab[] = mapKreisTabs(BUNDESLAND_TABS);
const KREIS_THEME_TABS: ThemeTab[] = mapKreisTabs(KREIS_TABS);

// Ort-Tabs: identisch zur Kreisebene, aber Übersicht soll NUR als Button dienen.
// -> Also NICHT rausfiltern. (Aktive Section bleibt über normalizeActiveTab() geregelt.)
const ORT_TABS: ThemeTab[] = ALL_TABS;

export const IMMOBILIENMARKT_THEME: ThemeConfig = {
  tabsByLevel: {
    deutschland: ALL_TABS,
    bundesland: BUNDESLAND_THEME_TABS,
    kreis: KREIS_THEME_TABS,
    ort: KREIS_THEME_TABS,
  },
  defaultTabByLevel: {
    deutschland: "uebersicht",
    bundesland: "uebersicht",
    kreis: "uebersicht",
    ort: "immobilienpreise",
  },
};
