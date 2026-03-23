import type { MarketExplanationStandardTabId } from "@/lib/market-explanation-standard-text-definitions";

export type MarketExplanationStaticTextMap = {
  uebersicht_standort_intro: string;
  uebersicht_wohnungssaldo_definition: string;
  uebersicht_wohnungssaldo_starkes_defizit: string;
  uebersicht_wohnungssaldo_mittleres_defizit: string;
  uebersicht_wohnungssaldo_leichtes_defizit: string;
  uebersicht_wohnungssaldo_ausgeglichen: string;
  uebersicht_wohnungssaldo_leichtes_ueberangebot: string;
  uebersicht_wohnungssaldo_moderates_ueberangebot: string;
  uebersicht_wohnungssaldo_starkes_ueberangebot: string;
  uebersicht_preisvergleich_intro: string;
  uebersicht_preisentwicklung_intro: string;
  uebersicht_ortslagen_tabelle_intro: string;
  wohnmarktsituation_faq_statistische_daten_frage: string;
  wohnmarktsituation_faq_statistische_daten_antwort: string;
  wohnmarktsituation_faq_standortfaktoren_frage: string;
  wohnmarktsituation_faq_standortfaktoren_antwort: string;
  wohnmarktsituation_wohnungssaldo_karte_fehlt: string;
  wohnmarktsituation_bauueberhang_kreisfallback_hinweis: string;
};

export type MarketExplanationStaticTextKey = keyof MarketExplanationStaticTextMap;

export type MarketExplanationStaticTextDefinition = {
  key: MarketExplanationStaticTextKey;
  label: string;
  tab: MarketExplanationStandardTabId;
  kind: "intro" | "definition" | "hint" | "faq_question" | "faq_answer";
};

const DE_DEFAULTS: MarketExplanationStaticTextMap = {
  uebersicht_standort_intro:
    "Die folgenden Indikatoren beschreiben die strukturelle Dynamik der Region {regionName}.",
  uebersicht_wohnungssaldo_definition:
    "Der Wohnungssaldo beschreibt, ob die Region tendenziell eher ein Wohnungsdefizit oder ein Wohnungsüberangebot aufweist.",
  uebersicht_wohnungssaldo_starkes_defizit: "(deutliches Wohnungsdefizit)",
  uebersicht_wohnungssaldo_mittleres_defizit: "(mittleres Wohnungsdefizit)",
  uebersicht_wohnungssaldo_leichtes_defizit: "(leichtes Wohnungsdefizit)",
  uebersicht_wohnungssaldo_ausgeglichen: "(Wohnungsangebot ausgeglichen)",
  uebersicht_wohnungssaldo_leichtes_ueberangebot: "(leichtes Wohnungsüberangebot)",
  uebersicht_wohnungssaldo_moderates_ueberangebot: "(moderates Wohnungsüberangebot)",
  uebersicht_wohnungssaldo_starkes_ueberangebot: "(deutliches Wohnungsüberangebot)",
  uebersicht_preisvergleich_intro:
    "Die folgenden Diagramme zeigen die Region im Vergleich zu Deutschland und dem Bundesland – jeweils auf Basis der aktuellen Angebotsdaten.",
  uebersicht_preisentwicklung_intro:
    "Die folgenden Diagramme zeigen die Entwicklung der durchschnittlichen Immobilienpreise, Grundstückspreise und Angebotsmieten je Quadratmeter nach Kalenderjahr.",
  uebersicht_ortslagen_tabelle_intro:
    "Die Tabelle zeigt die durchschnittlichen Immobilienpreise, Grundstückspreise und Angebotsmieten je Quadratmeter für die erfassten Ortslagen – jeweils inklusive prozentualer Veränderung gegenüber dem Vorjahr.",
  wohnmarktsituation_faq_statistische_daten_frage:
    "Woher stammen die statistischen Daten zum Standort {regionName}?",
  wohnmarktsituation_faq_statistische_daten_antwort:
    "Die Quelle für die statistischen Informationen zur Bevölkerung, zum Arbeitsmarkt und zur Wirtschaft sind die Statistischen Bundes- und Landesämter.",
  wohnmarktsituation_faq_standortfaktoren_frage:
    "Wie definieren sich die Standortfaktoren in {regionName}?",
  wohnmarktsituation_faq_standortfaktoren_antwort:
    "Die Standortfaktoren werden durch unsere regionalen Partner und Immobilienspezialisten bereitgestellt.",
  wohnmarktsituation_wohnungssaldo_karte_fehlt:
    "Für diesen Landkreis liegt aktuell noch keine Wohnungssaldo-Karte vor.",
  wohnmarktsituation_bauueberhang_kreisfallback_hinweis:
    "Hinweis: Für die Ortsebene liegen keine Bauüberhang-Daten vor. Darstellung auf Kreisebene.",
};

export const MARKET_EXPLANATION_STATIC_TEXT_DEFINITIONS: MarketExplanationStaticTextDefinition[] = [
  {
    key: "uebersicht_standort_intro",
    label: "Einleitung Standortüberblick",
    tab: "uebersicht",
    kind: "intro",
  },
  {
    key: "uebersicht_wohnungssaldo_definition",
    label: "Definition Wohnungssaldo",
    tab: "uebersicht",
    kind: "definition",
  },
  {
    key: "uebersicht_wohnungssaldo_starkes_defizit",
    label: "Wohnungssaldo: starkes Defizit",
    tab: "uebersicht",
    kind: "definition",
  },
  {
    key: "uebersicht_wohnungssaldo_mittleres_defizit",
    label: "Wohnungssaldo: mittleres Defizit",
    tab: "uebersicht",
    kind: "definition",
  },
  {
    key: "uebersicht_wohnungssaldo_leichtes_defizit",
    label: "Wohnungssaldo: leichtes Defizit",
    tab: "uebersicht",
    kind: "definition",
  },
  {
    key: "uebersicht_wohnungssaldo_ausgeglichen",
    label: "Wohnungssaldo: ausgeglichen",
    tab: "uebersicht",
    kind: "definition",
  },
  {
    key: "uebersicht_wohnungssaldo_leichtes_ueberangebot",
    label: "Wohnungssaldo: leichtes Überangebot",
    tab: "uebersicht",
    kind: "definition",
  },
  {
    key: "uebersicht_wohnungssaldo_moderates_ueberangebot",
    label: "Wohnungssaldo: moderates Überangebot",
    tab: "uebersicht",
    kind: "definition",
  },
  {
    key: "uebersicht_wohnungssaldo_starkes_ueberangebot",
    label: "Wohnungssaldo: starkes Überangebot",
    tab: "uebersicht",
    kind: "definition",
  },
  {
    key: "uebersicht_preisvergleich_intro",
    label: "Einleitung Preisvergleich",
    tab: "uebersicht",
    kind: "intro",
  },
  {
    key: "uebersicht_preisentwicklung_intro",
    label: "Einleitung Preisentwicklung",
    tab: "uebersicht",
    kind: "intro",
  },
  {
    key: "uebersicht_ortslagen_tabelle_intro",
    label: "Einleitung Ortslagen-Tabelle",
    tab: "uebersicht",
    kind: "intro",
  },
  {
    key: "wohnmarktsituation_faq_statistische_daten_frage",
    label: "FAQ: statistische Daten (Frage)",
    tab: "wohnmarktsituation",
    kind: "faq_question",
  },
  {
    key: "wohnmarktsituation_faq_statistische_daten_antwort",
    label: "FAQ: statistische Daten (Antwort)",
    tab: "wohnmarktsituation",
    kind: "faq_answer",
  },
  {
    key: "wohnmarktsituation_faq_standortfaktoren_frage",
    label: "FAQ: Standortfaktoren (Frage)",
    tab: "wohnmarktsituation",
    kind: "faq_question",
  },
  {
    key: "wohnmarktsituation_faq_standortfaktoren_antwort",
    label: "FAQ: Standortfaktoren (Antwort)",
    tab: "wohnmarktsituation",
    kind: "faq_answer",
  },
  {
    key: "wohnmarktsituation_wohnungssaldo_karte_fehlt",
    label: "Hinweis fehlende Wohnungssaldo-Karte",
    tab: "wohnmarktsituation",
    kind: "hint",
  },
  {
    key: "wohnmarktsituation_bauueberhang_kreisfallback_hinweis",
    label: "Hinweis Kreisfallback Bauüberhang",
    tab: "wohnmarktsituation",
    kind: "hint",
  },
];

export const MARKET_EXPLANATION_STATIC_TEXT_DEFAULTS: Record<string, MarketExplanationStaticTextMap> = {
  de: DE_DEFAULTS,
};

export function getMarketExplanationStaticTextDefaultMap(
  locale: string | null | undefined,
): MarketExplanationStaticTextMap {
  const normalized = String(locale ?? "de").trim().toLowerCase() || "de";
  return {
    ...DE_DEFAULTS,
    ...(MARKET_EXPLANATION_STATIC_TEXT_DEFAULTS[normalized] ?? {}),
  };
}

export function getMarketExplanationStaticTextDefaultValue(
  locale: string | null | undefined,
  key: MarketExplanationStaticTextKey,
): string {
  return getMarketExplanationStaticTextDefaultMap(locale)[key];
}

export function formatMarketExplanationStaticText(
  template: string,
  replacements: Record<string, string | number | null | undefined>,
): string {
  return String(template ?? "").replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, token) => {
    const value = replacements[token];
    return value === null || value === undefined ? "" : String(value);
  });
}
