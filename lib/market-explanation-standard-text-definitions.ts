export type MarketExplanationStandardTabId =
  | "uebersicht"
  | "immobilienpreise"
  | "mietpreise"
  | "mietrendite"
  | "wohnmarktsituation"
  | "grundstueckspreise"
  | "wohnlagencheck"
  | "wirtschaft";

export type MarketExplanationStandardTab = {
  id: MarketExplanationStandardTabId;
  label: string;
};

export type MarketExplanationStandardTextDefinition = {
  key: string;
  tab: MarketExplanationStandardTabId;
};

export type MarketExplanationStandardScope = "kreis" | "bundesland";

export const MARKET_EXPLANATION_STANDARD_TABS: MarketExplanationStandardTab[] = [
  { id: "uebersicht", label: "Übersicht" },
  { id: "immobilienpreise", label: "Immobilienpreise" },
  { id: "mietpreise", label: "Mietpreise" },
  { id: "mietrendite", label: "Mietrendite" },
  { id: "wohnmarktsituation", label: "Wohnmarktsituation" },
  { id: "grundstueckspreise", label: "Grundstückspreise" },
  { id: "wohnlagencheck", label: "Wohnlagencheck" },
  { id: "wirtschaft", label: "Wirtschaft" },
];

export const MARKET_EXPLANATION_STANDARD_TEXT_DEFINITIONS_KREIS: MarketExplanationStandardTextDefinition[] = [
  { key: "immobilienmarkt_allgemein", tab: "uebersicht" },
  { key: "immobilienmarkt_standort_teaser", tab: "uebersicht" },
  { key: "immobilienmarkt_besonderheiten", tab: "uebersicht" },

  { key: "immobilienpreise_intro", tab: "immobilienpreise" },
  { key: "immobilienpreise_haus_intro", tab: "immobilienpreise" },
  { key: "immobilienpreise_wohnung_intro", tab: "immobilienpreise" },

  { key: "mietpreise_intro", tab: "mietpreise" },

  { key: "mietrendite_intro", tab: "mietrendite" },
  { key: "mietrendite_hinweis", tab: "mietrendite" },

  { key: "wohnmarktsituation_intro", tab: "wohnmarktsituation" },
  { key: "wohnmarktsituation_wohnraumnachfrage", tab: "wohnmarktsituation" },
  { key: "wohnmarktsituation_natuerlicher_saldo_intro", tab: "wohnmarktsituation" },
  { key: "wohnmarktsituation_wanderungssaldo_intro", tab: "wohnmarktsituation" },
  { key: "wohnmarktsituation_jugendquotient_altenquotient_intro", tab: "wohnmarktsituation" },
  { key: "wohnmarktsituation_wohnraumangebot_intro", tab: "wohnmarktsituation" },
  { key: "wohnmarktsituation_wohnungsbestand_intro", tab: "wohnmarktsituation" },
  { key: "wohnmarktsituation_baufertigstellungen_intro", tab: "wohnmarktsituation" },
  { key: "wohnmarktsituation_baugenehmigungen_intro", tab: "wohnmarktsituation" },
  { key: "wohnmarktsituation_bautaetigkeit_intro", tab: "wohnmarktsituation" },

  { key: "grundstueckspreise_intro", tab: "grundstueckspreise" },

  { key: "wohnlagencheck_allgemein", tab: "wohnlagencheck" },
  { key: "wohnlagencheck_lage", tab: "wohnlagencheck" },
  { key: "wohnlagencheck_standortfaktoren_intro", tab: "wohnlagencheck" },
  { key: "wohnlagencheck_faktor_mobilitaet", tab: "wohnlagencheck" },
  { key: "wohnlagencheck_faktor_bildung", tab: "wohnlagencheck" },
  { key: "wohnlagencheck_faktor_gesundheit", tab: "wohnlagencheck" },
  { key: "wohnlagencheck_faktor_nahversorgung", tab: "wohnlagencheck" },
  { key: "wohnlagencheck_faktor_naherholung", tab: "wohnlagencheck" },
  { key: "wohnlagencheck_faktor_kultur_freizeit", tab: "wohnlagencheck" },
  { key: "wohnlagencheck_faktor_arbeitsplatz", tab: "wohnlagencheck" },
  { key: "wohnlagencheck_faktor_lebenserhaltungskosten", tab: "wohnlagencheck" },
  { key: "wohnlagencheck_faktor_sicherheit", tab: "wohnlagencheck" },

  { key: "wirtschaft_intro", tab: "wirtschaft" },
  { key: "wirtschaft_gewerbesaldo", tab: "wirtschaft" },
  { key: "wirtschaft_arbeitsmarkt", tab: "wirtschaft" },
  { key: "wirtschaft_sv_beschaeftigte_wohnort", tab: "wirtschaft" },
  { key: "wirtschaft_arbeitslosendichte", tab: "wirtschaft" },
];

export const MARKET_EXPLANATION_STANDARD_TEXT_DEFINITIONS_BUNDESLAND: MarketExplanationStandardTextDefinition[] = [
  { key: "immobilienmarkt_allgemein", tab: "uebersicht" },
  { key: "immobilienmarkt_standort_teaser", tab: "uebersicht" },
  { key: "immobilienmarkt_individuell_01", tab: "uebersicht" },
  { key: "immobilienmarkt_individuell_02", tab: "uebersicht" },
  { key: "immobilienmarkt_besonderheiten", tab: "uebersicht" },
];

export const MARKET_EXPLANATION_STANDARD_TEXT_DEFINITIONS = MARKET_EXPLANATION_STANDARD_TEXT_DEFINITIONS_KREIS;

export function getMarketExplanationStandardDefinitions(scope: MarketExplanationStandardScope): MarketExplanationStandardTextDefinition[] {
  return scope === "bundesland"
    ? MARKET_EXPLANATION_STANDARD_TEXT_DEFINITIONS_BUNDESLAND
    : MARKET_EXPLANATION_STANDARD_TEXT_DEFINITIONS_KREIS;
}

export function inferMarketExplanationStandardGroup(key: string): string {
  if (key.startsWith("immobilienmarkt_")) return "immobilienmarkt_ueberblick";
  if (key.startsWith("immobilienpreise_") || key.startsWith("ueberschrift_immobilienpreise_")) return "immobilienpreise";
  if (key.startsWith("mietpreise_") || key.startsWith("ueberschrift_mietpreise_")) return "mietpreise";
  if (key.startsWith("mietrendite_") || key.startsWith("ueberschrift_mietrendite_")) return "mietrendite";
  if (key.startsWith("wohnmarktsituation_") || key.startsWith("ueberschrift_wohnmarktsituation_")) return "wohnmarktsituation";
  if (key.startsWith("grundstueckspreise_") || key === "ueberschrift_grundstueckspreise") return "grundstueckspreise";
  if (key.startsWith("wohnlagencheck_") || key.startsWith("ueberschrift_wohnlagencheck_")) return "wohnlagencheck";
  if (key.startsWith("wirtschaft_") || key.startsWith("ueberschrift_wirtschaft_") || key.startsWith("ueberschrift_arbeitsmarkt_")) return "wirtschaft";
  return "immobilienmarkt_ueberblick";
}
