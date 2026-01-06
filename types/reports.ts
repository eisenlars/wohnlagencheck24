export type BerichtBerater = {
  berater_name?: string;
  berater_telefon?: string;
  berater_email?: string;
};

export type BerichtTexte = {
  immobilienmarkt_ueberblick?: {
    immobilienmarkt_allgemein?: string;
    immobilienmarkt_standort_teaser?: string;
    immobilienmarkt_individuell_01?: string;
    immobilienmarkt_zitat?: string;
    immobilienmarkt_individuell_02?: string;
    immobilienmarkt_beschreibung_01?: string;
    immobilienmarkt_beschreibung_02?: string;
    immobilienmarkt_besonderheiten?: string;
    immobilienmarkt_maklerempfehlung?: string;
  };
  immobilienpreise?: {
    immobilienpreise_intro?: string;
    immobilienpreise_haus_intro?: string;
    immobilienpreise_haus_allgemein?: string;
    immobilienpreise_haus_lage?: string;
    immobilienpreise_haus_preisentwicklung?: string;
    immobilienpreise_haus_haustypen?: string;
    immobilienpreise_wohnung_intro?: string;
    immobilienpreise_wohnung_allgemein?: string;
    immobilienpreise_wohnung_lage?: string;
    immobilienpreise_wohnung_preisentwicklung?: string;
    immobilienpreise_wohnung_nach_flaechen_und_zimmern?: string;
  };
  ueberschriften_kreis?: {
    ueberschrift_immobilienpreise_haus?: string;
    ueberschrift_immobilienpreise_wohnung?: string;
    ueberschrift_mietpreise_wohnung?: string;
    ueberschrift_mietpreise_haus?: string;
    ueberschrift_mietrendite_bruttomietrendite?: string;
    ueberschrift_mietrendite_nettomietrendite?: string;
  };
  mietpreise?: {
    mietpreise_intro?: string;
    mietpreise_allgemein?: string;
    mietpreise_wohnung_allgemein?: string;
    mietpreise_wohnung_preisentwicklung?: string;
    mietpreise_wohnung_nach_flaechen_und_zimmern?: string;
    mietpreise_haus_allgemein?: string;
    mietpreise_haus_preisentwicklung?: string;
  };
  mietrendite?: {
    mietrendite_intro?: string;
    mietrendite_hinweis?: string;
    mietrendite_kaufpreisfaktor?: string;
    mietrendite_allgemein?: string;
    mietrendite_etw?: string;
    mietrendite_efh?: string;
    mietrendite_mfh?: string;
  };
  berater?: BerichtBerater;
};

export type ImmobilienKaufpreisRow = {
  kaufpreis_immobilien?: number | string;
};

export type GrundstueckKaufpreisRow = {
  kaufpreis_grundstueck?: number | string;
};

export type MietpreiseGesamtRow = {
  preis_kaltmiete?: number | string;
  preis_nebenkosten?: number | string;
  preis_warmmiete?: number | string;
};

export type MietpreisindexRegionalRow = {
  mietpreisindex_wohnung?: number | string;
};

export type MietpreiseWohnungGesamtRow = {
  preis_wohnung_min?: number | string;
  preis_wohnung_avg?: number | string;
  preis_wohnung_max?: number | string;
};

export type MietpreiseHausGesamtRow = {
  preis_haus_min?: number | string;
  preis_haus_avg?: number | string;
  preis_haus_max?: number | string;
};

export type MietpreiseWohnungNachZimmernRow = {
  zimmer?: number | string;
  kaltmiete?: number | string;
  kaltmiete_vorjahr?: number | string;
};

export type MietpreiseWohnungNachFlaechenRow = {
  flaeche?: number | string;
  kaltmiete?: number | string;
  kaltmiete_vorjahr?: number | string;
};

export type MietpreiseWohnungNachBaujahrRow = {
  kaltmiete_bestand?: number | string;
  kaltmiete_bestand_vorjahr?: number | string;
  kaltmiete_neubau?: number | string;
  kaltmiete_neubau_vorjahr?: number | string;
};

export type MietpreiseEntwicklungRow = {
  jahr?: number | string;
  preis_ol?: number | string;
  preis_k?: number | string;
  preis_bl?: number | string;
  preis_l?: number | string;
};

export type MietrenditeGesamtRow = {
  kaufpreisfaktor?: number | string;
  bruttomietrendite?: number | string;
  nettomietrendite?: number | string;
};

export type BruttomietrenditeAllgemeinRow = {
  bruttomietrendite_mfh?: number | string;
  bruttomietrendite_gwa?: number | string;
  bruttomietrendite_hh?: number | string;
  bruttomietrendite_etw?: number | string;
  bruttomietrendite_efh?: number | string;
  bruttomietrendite_dhh?: number | string;
  bruttomietrendite_rmh?: number | string;
};

export type NettomietrenditeAllgemeinRow = {
  nettomietrendite_mfh?: number | string;
  nettomietrendite_gwa?: number | string;
  nettomietrendite_hh?: number | string;
  nettomietrendite_etw?: number | string;
  nettomietrendite_efh?: number | string;
  nettomietrendite_dhh?: number | string;
  nettomietrendite_rmh?: number | string;
};

export type KaufpreisfaktorAllgemeinRow = {
  kaufpreisfaktor_mfh?: number | string;
  kaufpreisfaktor_gwa?: number | string;
  kaufpreisfaktor_hh?: number | string;
  kaufpreisfaktor_etw?: number | string;
  kaufpreisfaktor_efh?: number | string;
  kaufpreisfaktor_dhh?: number | string;
  kaufpreisfaktor_rmh?: number | string;
};

export type MietrenditeTableRow = {
  label?: string;
  [key: string]: number | string | undefined;
};

export type MietrenditeEntwicklungRow = {
  jahr?: number | string;
  brutto_mietrendite?: number | string;
  kaufpreisfaktor?: number | string;
};

export type ImmobilienpreisindexRegionalRow = {
  immobilienpreisindex_haus?: number | string;
  immobilienpreisindex_wohnung?: number | string;
};

export type HausKaufpreisspanneRow = {
  preis_haus_min?: number | string;
  preis_haus_avg?: number | string;
  preis_haus_max?: number | string;
};

export type WohnungKaufpreisspanneRow = {
  preis_wohnung_min?: number | string;
  preis_wohnung_avg?: number | string;
  preis_wohnung_max?: number | string;
};

export type PreisinfoRow = {
  preisinfo_label?: string;
  preis?: number | string;
  einheit?: string;
  [key: string]: unknown;
};

export type LageRow = {
  preisinfo_label?: string;
  einheit?: string;
  preis_einfache_lage?: number | string;
  preis_mittlere_lage?: number | string;
  preis_gute_lage?: number | string;
  preis_sehr_gute_lage?: number | string;
  preis_top_lage?: number | string;
  [key: string]: unknown;
};

export type HaustypRow = {
  preisinfo_label?: string;
  einheit?: string;
  reihenhaus?: number | string;
  doppelhaushaelfte?: number | string;
  einfamilienhaus?: number | string;
  [key: string]: unknown;
};

export type PreisentwicklungRow = {
  jahr?: number | string;
  preis_k?: number | string;
  preis_bl?: number | string;
  preis_l?: number | string;
  [key: string]: unknown;
};

export type ZimmerPreisRow = {
  zimmer?: number | string;
  preis?: number | string;
  preis_vorjahr?: number | string;
  einheit?: string;
  [key: string]: unknown;
};

export type FlaechenPreisRow = {
  flaeche?: number | string;
  preis?: number | string;
  preis_vorjahr?: number | string;
  einheit?: string;
  [key: string]: unknown;
};

export type ImmobilienmarktSituationRow = {
  kaufmarkt_value?: number | string;
  mietmarkt_value?: number | string;
};

export type StandortAllgemeinRow = {
  bevoelkerungsdynamik?: number;
  arbeitsmarktdynamik?: number;
  wirtschaftskraft?: number;
  wohnraumsituation?: number;
};

export type VergleichRow = {
  region?: string;
  [key: string]: number | string | undefined;
};

export type ZeitreiheWertRow = {
  jahr?: number | string;
  [key: string]: number | string | undefined;
};

export type BasisjahrRow = {
  basisjahr_immobilienpreisindex?: number | string;
  basisjahr_grundstueckspreisindex?: number | string;
  basisjahr_mietpreisindex?: number | string;
};

export type PreisindexRow = {
  immobilienpreisindex?: number | string;
  grundstueckspreisindex?: number | string;
  mietpreisindex?: number | string;
};

export type OrtslagenUebersichtItem = {
  ortslage?: string;
  kreis?: string;
  immobilienpreise_wert?: number | string;
  immobilienpreise_tendenz?: number | string;
  grundstueckspreise_wert?: number | string;
  grundstueckspreise_tendenz?: number | string;
  mietpreise_wert?: number | string;
  mietpreise_tendenz?: number | string;
};

export type PreisgrenzenImmobilieRow = {
  guenstigste_ortslage_immobilie?: string;
  guenstigste_ortslage_immobilienpreis?: number | string;
  teuerste_ortslage_immobilie?: string;
  teuerste_ortslage_immobilienpreis?: number | string;
};

export type PreisgrenzenGrundRow = {
  guenstigste_ortslage_grundstueck?: string;
  guenstigste_ortslage_grundstueckspreis?: number | string;
  teuerste_ortslage_grundstueck?: string;
  teuerste_ortslage_grundstueckspreis?: number | string;
};

export type PreisgrenzenMieteRow = {
  guenstigste_ortslage_miete?: string;
  guenstigste_ortslage_mietpreis?: number | string;
  teuerste_ortslage_miete?: string;
  teuerste_ortslage_mietpreis?: number | string;
};

export type ImmobilienpreiseReportData = {
  text?: BerichtTexte;
  immobilien_kaufpreis?: ImmobilienKaufpreisRow[];
  haus_kaufpreisspanne?: HausKaufpreisspanneRow[];
  immobilienpreisindex_regional?: ImmobilienpreisindexRegionalRow[];
  wohnung_kaufpreisspanne?: WohnungKaufpreisspanneRow[];
  haus_kaufpreise_im_ueberregionalen_vergleich?: PreisinfoRow[];
  haus_kaufpreise_lage?: LageRow[];
  haus_kaufpreis_haustypen?: HaustypRow[];
  wohnung_kaufpreise_im_ueberregionalen_vergleich?: PreisinfoRow[];
  wohnung_kaufpreise_lage?: LageRow[];
  haus_kaufpreisentwicklung?: PreisentwicklungRow[];
  wohnung_kaufpreisentwicklung?: PreisentwicklungRow[];
  wohnung_kaufpreise_nach_zimmern?: ZimmerPreisRow[];
  wohnung_kaufpreise_nach_flaechen?: FlaechenPreisRow[];
};

export type MietpreiseReportData = {
  text?: BerichtTexte;
  mietpreise_gesamt?: MietpreiseGesamtRow[];
  mietpreisindex_regional?: MietpreisindexRegionalRow[];
  mietpreise_im_ueberregionalen_vergleich?: PreisinfoRow[];
  mietpreise_wohnung_gesamt?: MietpreiseWohnungGesamtRow[];
  mietpreise_wohnung_nach_zimmern?: MietpreiseWohnungNachZimmernRow[];
  mietpreise_wohnung_nach_flaechen?: MietpreiseWohnungNachFlaechenRow[];
  mietpreise_wohnung_nach_baujahr?: MietpreiseWohnungNachBaujahrRow[];
  mietpreisentwicklung_wohnung?: MietpreiseEntwicklungRow[];
  mietpreise_haus_gesamt?: MietpreiseHausGesamtRow[];
  mietpreisentwicklung_haus?: MietpreiseEntwicklungRow[];
};

export type MietrenditeReportData = {
  text?: BerichtTexte;
  mietrendite_gesamt?: MietrenditeGesamtRow[];
  bruttomietrendite_allgemein?: BruttomietrenditeAllgemeinRow[];
  nettomietrendite_allgemein?: NettomietrenditeAllgemeinRow[];
  kaufpreisfaktor_allgemein?: KaufpreisfaktorAllgemeinRow[];
  mietrendite_etw?: MietrenditeTableRow[];
  mietrendite_efh?: MietrenditeTableRow[];
  mietrendite_mfh?: MietrenditeTableRow[];
  mietrendite_gwa?: MietrenditeTableRow[];
  mietrendite_hh?: MietrenditeTableRow[];
  mietrendite_dhh?: MietrenditeTableRow[];
  mietrendite_rmh?: MietrenditeTableRow[];
  mietrendite_reh?: MietrenditeTableRow[];
  mietrendite_entwicklung?: MietrenditeEntwicklungRow[];
};

export type UebersichtReportData = {
  text?: BerichtTexte;
  immobilienmarkt_situation?: ImmobilienmarktSituationRow[];
  marktspannung?: ImmobilienmarktSituationRow[];
  standort_allgemein?: StandortAllgemeinRow[];
  immobilien_kaufpreis?: ImmobilienKaufpreisRow[];
  grundstueck_kaufpreis?: GrundstueckKaufpreisRow[];
  mietpreise_gesamt?: MietpreiseGesamtRow[];
  immobilienpreise_ueberregionaler_vergleich?: VergleichRow[];
  grundstueckspreise_ueberregionaler_vergleich?: VergleichRow[];
  mietpreise_ueberregionaler_vergleich?: VergleichRow[];
  immobilie_kaufpreisentwicklung?: ZeitreiheWertRow[];
  grundstueck_kaufpreisentwicklung?: ZeitreiheWertRow[];
  immobilie_mietpreisentwicklung?: ZeitreiheWertRow[];
  basisjahr?: BasisjahrRow[];
  preisindex?: PreisindexRow[];
  ortslagen_uebersicht?: OrtslagenUebersichtItem[];
  ortslagen_preisgrenzen_immobilie?: PreisgrenzenImmobilieRow[];
  ortslagen_preisgrenzen_grundstueck?: PreisgrenzenGrundRow[];
  ortslagen_preisgrenzen_miete?: PreisgrenzenMieteRow[];
};
