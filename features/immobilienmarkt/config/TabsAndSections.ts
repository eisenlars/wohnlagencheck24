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
  {
    id: "mietrendite",
    label: "Mietrendite",
    iconSrc: "/icons/ws24_marktbericht_mietrendite.svg",
    toc: [
      { id: "einleitung", label: "Einleitung" },
      { id: "kaufpreisfaktor-gesamt", label: "Kaufpreisfaktor & Gesamt" },
      { id: "kaufpreisfaktor-entwicklung", label: "Kaufpreisfaktor Entwicklung" },
      { id: "rendite-allgemein", label: "Brutto & Netto" },
      { id: "rendite-hinweis", label: "Hinweis" },
      { id: "rendite-etw", label: "ETW" },
      { id: "rendite-efh", label: "EFH" },
      { id: "rendite-mfh", label: "MFH" },
      { id: "brutto-entwicklung", label: "Bruttomietrendite Entwicklung" },
      { id: "faq-mietrendite", label: "FAQ" },
      { id: "wohnlagen", label: "Wohnlagen" },
    ],
  },
  {
    id: "wohnmarktsituation",
    label: "Wohnmarktsituation",
    iconSrc: "/icons/ws24_marktbericht_wohnmarktsituation.svg",
    toc: [
      { id: "einleitung", label: "Einleitung" },
      { id: "wohnungssaldo", label: "Wohnungssaldo" },
      { id: "wohnraumnachfrage", label: "Wohnraumnachfrage" },
      { id: "wohnraumangebot", label: "Wohnraumangebot" },
      { id: "faq-wohnmarktsituation", label: "FAQ" },
      { id: "wohnlagen", label: "Wohnlagen" },
    ],
  },
  {
    id: "grundstueckspreise",
    label: "Grundstückspreise",
    iconSrc: "/icons/ws24_marktbericht_grundstueckspreise.svg",
    toc: [
      { id: "einleitung", label: "Einleitung" },
      { id: "leitkennzahl", label: "Leitkennzahl" },
      { id: "grundstueckspreise-allgemein", label: "Allgemein" },
      { id: "grundstueckspreise-ueberregional", label: "Überregionaler Vergleich" },
      { id: "grundstueckspreise-preisentwicklung", label: "Preisentwicklung" },
      { id: "faq-grundstueckspreise", label: "FAQ" },
      { id: "wohnlagen", label: "Wohnlagen" },
    ],
  },
  {
    id: "wohnlagencheck",
    label: "Wohnlagencheck",
    iconSrc: "/icons/ws24_marktbericht_wohnlagencheck.svg",
    toc: [
      { id: "einleitung", label: "Einleitung" },
      { id: "standortfaktoren-uebersicht", label: "Standortfaktoren Übersicht" },
      { id: "mobilitaet", label: "Mobilität" },
      { id: "bildung", label: "Bildung" },
      { id: "gesundheit", label: "Gesundheit" },
      { id: "naherholung", label: "Naherholung" },
      { id: "nahversorgung", label: "Nahversorgung" },
      { id: "kultur-freizeit", label: "Kultur & Freizeit" },
      { id: "faq-wohnlagencheck", label: "FAQ" },
      { id: "wohnlagen", label: "Wohnlagen" },
    ],
  },
  {
    id: "wirtschaft",
    label: "Wirtschaft",
    iconSrc: "/icons/ws24_marktbericht_wirtschaft.svg",
    toc: [
      { id: "einleitung", label: "Einleitung" },
      { id: "kaufkraftindex", label: "Kaufkraftindex" },
      { id: "wirtschaft", label: "Wirtschaft" },
      { id: "bip", label: "Bruttoinlandsprodukt" },
      { id: "gewerbesaldo", label: "Gewerbesaldo" },
      { id: "einkommen", label: "Nettoeinkommen & Kaufkraft" },
      { id: "arbeitsmarkt", label: "Arbeitsmarkt" },
      { id: "beschaeftigung", label: "Beschäftigung" },
      { id: "arbeitslosigkeit", label: "Arbeitslosigkeit" },
      { id: "faq-wirtschaft", label: "FAQ" },
      { id: "wohnlagen", label: "Wohnlagen" },
    ],
  },
];
