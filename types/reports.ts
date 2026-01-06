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
  };
  mietpreise?: {
    mietpreise_intro?: string;
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
