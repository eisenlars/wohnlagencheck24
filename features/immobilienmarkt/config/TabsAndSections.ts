// features/immobilienmarkt/config/TabsAndSections.ts

import type { ReportSection } from "../types/route";

export type TocItem = { id: string; label: string };

export type Tab = {
  id: ReportSection;
  label: string;
  iconSrc: string;
  toc: TocItem[];
};

export const TABS: Tab[] = [
  {
    id: "uebersicht",
    label: "Übersicht",
    iconSrc: "/icons/ws24_marktbericht_ueberblick.svg",
    toc: [
      { id: "einleitung", label: "Einleitung" },
      { id: "standort", label: "Standortüberblick" },
      { id: "marktueberblick", label: "Marktüberblick" },
      { id: "preise-vergleich", label: "Überregionale Preise" },
      { id: "preise-entwicklung", label: "Preisentwicklung" },
      { id: "ortslagen-tabelle", label: "Ortslagenpreise" },
      { id: "preisspannen", label: "Teuer vs. günstig" },
      { id: "wohnlagen", label: "Wohnlagenübersicht" },
    ],
  },
  {
    id: "immobilienpreise",
    label: "Immobilienpreise",
    iconSrc: "/icons/ws24_marktbericht_immobilienpreise.svg",
    toc: [
      { id: "einleitung", label: "Einleitung" },
      { id: "hauspreise", label: "Hauspreise" },
      { id: "hauspreise-lage", label: "Hauspreise nach Lage" },
      { id: "haus-kaufpreisentwicklung", label: "Preisentwicklung Haus" },
      { id: "haustypen-kaufpreise", label: "Haustypen" },
      { id: "wohnungspreise", label: "Wohnungspreise" },
      { id: "wohnungpreise-lage", label: "Wohnungspreise nach Lage" },
      { id: "wohnung-kaufpreisentwicklung", label: "Preisentwicklung Wohnung" },
      { id: "wohnungpreise-zimmer-flaechen", label: "Zimmer/Flächen" },
      { id: "faq-immobilienpreise", label: "FAQ" },
      { id: "wohnlagen", label: "Wohnlagen" },
    ],
  },
  {
    id: "mietpreise",
    label: "Mietpreise",
    iconSrc: "/icons/ws24_marktbericht_mietpreise.svg",
    toc: [
      { id: "einleitung", label: "Einleitung" },
      { id: "leitkennzahl", label: "Leitkennzahl" },
      { id: "mietpreise-ueberregional", label: "Überregionaler Vergleich" },
      { id: "wohnungspreise", label: "Wohnungen" },
      { id: "wohnung-preisentwicklung", label: "Preisentwicklung Wohnung" },
      { id: "wohnung-zimmer-flaechen", label: "Zimmer/Flächen" },
      { id: "wohnung-baujahr", label: "Baujahr" },
      { id: "hauspreise", label: "Häuser" },
      { id: "haus-preisentwicklung", label: "Preisentwicklung Haus" },
      { id: "faq-mietpreise", label: "FAQ" },
      { id: "wohnlagen", label: "Wohnlagen" },
    ],
  },

  // Platzhalter: später füllst du toc, aber Tab ist schon da
  { id: "mietrendite", label: "Mietrendite", iconSrc: "/icons/ws24_marktbericht_mietrendite.svg", toc: [] },
  { id: "wohnmarktsituation", label: "Wohnmarktsituation", iconSrc: "/icons/ws24_marktbericht_wohnmarktsituation.svg", toc: [] },
  { id: "grundstueckspreise", label: "Grundstückspreise", iconSrc: "/icons/ws24_marktbericht_grundstueckspreise.svg", toc: [] },
  { id: "wohnlagencheck", label: "Wohnlagencheck", iconSrc: "/icons/ws24_marktbericht_wohnlagencheck.svg", toc: [] },
  { id: "wirtschaft", label: "Wirtschaft", iconSrc: "/icons/ws24_marktbericht_wirtschaft.svg", toc: [] },
];
