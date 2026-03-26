export type TextKeyClass =
  | "GENERAL_STANDARD"
  | "GENERAL_REGION_FOCUS"
  | "INDIVIDUAL_MANDATORY"
  | "INDIVIDUAL_OPTIONAL"
  | "DATA_DRIVEN"
  | "MARKETING";

export const GENERAL_REGION_FOCUS_KEYS = [
  "wohnlagencheck_allgemein",
  "wohnlagencheck_lage",
] as const;

export const INDIVIDUAL_MANDATORY_KEYS = [
  "immobilienmarkt_individuell_01",
  "immobilienmarkt_individuell_02",
  "immobilienmarkt_zitat",
  "immobilienmarkt_maklerempfehlung",
  "berater_name",
  "berater_email",
  "berater_telefon_fest",
  "berater_telefon_mobil",
  "berater_adresse_strasse",
  "berater_adresse_hnr",
  "berater_adresse_plz",
  "berater_adresse_ort",
  "berater_beschreibung",
  "berater_ausbildung",
  "makler_name",
  "makler_empfehlung",
  "makler_beschreibung",
  "makler_benefits",
  "makler_provision",
  "makler_email",
  "makler_telefon_fest",
  "makler_telefon_mobil",
  "makler_adresse_strasse",
  "makler_adresse_hnr",
  "makler_adresse_plz",
  "makler_adresse_ort",
] as const;

export const GENERAL_STANDARD_KEYS = [
  "immobilienmarkt_allgemein",
  "immobilienmarkt_standort_teaser",
  "immobilienmarkt_besonderheiten",
  "immobilienpreise_intro",
  "immobilienpreise_haus_intro",
  "immobilienpreise_wohnung_intro",
  "mietpreise_intro",
  "mietrendite_intro",
  "mietrendite_hinweis",
  "wohnmarktsituation_intro",
  "wohnmarktsituation_wohnraumnachfrage",
  "wohnmarktsituation_wohnraumangebot_intro",
  "wohnmarktsituation_wohnungsbestand_intro",
  "wohnmarktsituation_baufertigstellungen_intro",
  "wohnmarktsituation_baugenehmigungen_intro",
  "wohnmarktsituation_bautaetigkeit_intro",
  "wohnmarktsituation_natuerlicher_saldo_intro",
  "wohnmarktsituation_wanderungssaldo_intro",
  "wohnmarktsituation_jugendquotient_altenquotient_intro",
  "wirtschaft_intro",
  "wirtschaft_arbeitsmarkt",
  "wirtschaft_gewerbesaldo",
  "wirtschaft_arbeitslosendichte",
  "wirtschaft_sv_beschaeftigte_wohnort",
  "grundstueckspreise_intro",
  "ueberschrift_wohnlagencheck_allgemein",
  "wohnlagencheck_standortfaktoren_intro",
  "wohnlagencheck_faktor_mobilitaet",
  "wohnlagencheck_faktor_bildung",
  "wohnlagencheck_faktor_gesundheit",
  "wohnlagencheck_faktor_nahversorgung",
  "wohnlagencheck_faktor_naherholung",
  "wohnlagencheck_faktor_kultur_freizeit",
  "wohnlagencheck_faktor_arbeitsplatz",
  "wohnlagencheck_faktor_lebenserhaltungskosten",
  "wohnlagencheck_faktor_sicherheit",
] as const;

export const TEXT_KEY_REGISTRY_VERSION = "v2";
