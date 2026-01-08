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
    ueberschrift_grundstueckspreise?: string;
    ueberschrift_mietrendite_bruttomietrendite?: string;
    ueberschrift_mietrendite_nettomietrendite?: string;
    ueberschrift_wohnmarktsituation_wohnraumnachfrage_individuell?: string;
    ueberschrift_wohnmarktsituation_wohnraumangebot_individuell?: string;
    ueberschrift_wirtschaft_individuell?: string;
    ueberschrift_arbeitsmarkt_individuell?: string;
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
  grundstueckspreise?: {
    grundstueckspreise_intro?: string;
    grundstueckspreise_allgemein?: string;
    grundstueckspreise_preisentwicklung?: string;
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
  wohnmarktsituation?: {
    wohnmarktsituation_intro?: string;
    wohnmarktsituation_wohnraumnachfrage?: string;
    wohnmarktsituation_natuerlicher_saldo_intro?: string;
    wohnmarktsituation_jugendquotient_altenquotient_intro?: string;
    wohnmarktsituation_wanderungssaldo_intro?: string;
    wohnmarktsituation_wohnraumangebot_intro?: string;
    wohnmarktsituation_bautaetigkeit_intro?: string;
    wohnmarktsituation_wohnungsbestand_intro?: string;
    wohnmarktsituation_baufertigstellungen_intro?: string;
    wohnmarktsituation_baugenehmigungen_intro?: string;
    wohnmarktsituation_bauueberhang_baufortschritt?: string;
    wohnmarktsituation_allgemein?: string;
    wohnmarktsituation_bevoelkerungsentwicklung?: string;
    wohnmarktsituation_haushalte?: string;
    wohnmarktsituation_natuerlicher_saldo?: string;
    wohnmarktsituation_wanderungssaldo?: string;
    wohnmarktsituation_alterstruktur?: string;
    wohnmarktsituation_jugendquotient_altenquotient?: string;
    wohnmarktsituation_wohnungsbestand_anzahl?: string;
    wohnmarktsituation_wohnungsbestand_wohnflaeche?: string;
    wohnmarktsituation_baufertigstellungen?: string;
    wohnmarktsituation_baugenehmigungen?: string;
  };
  wirtschaft?: {
    wirtschaft_intro?: string;
    wirtschaft_gewerbesaldo?: string;
    wirtschaft_arbeitsmarkt?: string;
    wirtschaft_sv_beschaeftigte_wohnort?: string;
    wirtschaft_arbeitslosendichte?: string;
    wirtschaft_bruttoinlandsprodukt?: string;
    wirtschaft_einkommen?: string;
    wirtschaft_sv_beschaeftigte_arbeitsort?: string;
    wirtschaft_arbeitsplatzzentralitaet?: string;
    wirtschaft_pendler?: string;
    wirtschaft_arbeitslosigkeit?: string;
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

export type WohnungsnachfrageAllgemeinRow = {
  anzahl_einwohner?: number | string;
  anzahl_haushalte?: number | string;
  mittlere_haushaltsgroesse?: number | string;
  wanderungssaldo?: number | string;
  natuerlicher_saldo?: number | string;
  einwohnerdichte?: number | string;
  siedlungsdichte?: number | string;
  jugendquotient?: number | string;
  altenquotient?: number | string;
};

export type WohnbauflaechenanteilRow = {
  label?: string;
  hectar?: number | string;
};

export type FlaechennutzungWohnbauRow = {
  flaechennutzung_wohnbau?: number | string;
};

export type GewerbeflaechenanteilRow = {
  label?: string;
  hectar?: number | string;
};

export type FlaechennutzungGewerbeRow = {
  flaechennutzung_gewerbe?: number | string;
};

export type WirtschaftAllgemeinRow = {
  kaufkraftindex_k?: number | string;
  kaufkraftindex_ol?: number | string;
  kaufkraft_nominal_k?: number | string;
  kaufkraft_nominal_ol?: number | string;
  kaufkraft_real_k?: number | string;
  kaufkraft_real_ol?: number | string;
  bip?: number | string;
  pendlersaldo_k?: number | string;
  pendlersaldo_ol?: number | string;
  gewerbesaldo?: number | string;
  arbeitsplatzzentralitaet_k?: number | string;
  arbeitsplatzzentralitaet_ol?: number | string;
  arbeitslosenquote_k?: number | string;
  arbeitslosenquote_ol?: number | string;
  beschaeftigtenquote_k?: number | string;
  beschaeftigtenquote_ol?: number | string;
  arbeitslosendichte?: number | string;
};

export type GewerbesaldoAbsRow = {
  jahr?: number | string;
  gewerbeanmeldungen?: number | string;
  gewerbeabmeldungen?: number | string;
  gewerbesaldo?: number | string;
};

export type GewerbesaldoJe1000Row = {
  jahr?: number | string;
  gewerbesaldo_pro_1000_ew?: number | string;
  gewerbesaldo_pro_1000_ew_bl?: number | string;
  gewerbesaldo_pro_1000_ew_l?: number | string;
};

export type BIPAbsRow = {
  jahr?: number | string;
  bip_abs?: number | string;
};

export type BIPProEwRow = {
  jahr?: number | string;
  bip_pro_ew?: number | string;
  bip_pro_ew_bl?: number | string;
  bip_pro_ew_l?: number | string;
};

export type NettoeinkommenProEwRow = {
  jahr?: number | string;
  nettoeinkommen_pro_ew_ol?: number | string;
  nettoeinkommen_pro_ew_k?: number | string;
  nettoeinkommen_pro_ew_bl?: number | string;
  nettoeinkommen_pro_ew_l?: number | string;
};

export type NettoeinkommenProHhRow = {
  jahr?: number | string;
  nettoeinkommen_pro_hh_ol?: number | string;
  nettoeinkommen_pro_hh_k?: number | string;
  nettoeinkommen_pro_hh_bl?: number | string;
  nettoeinkommen_pro_hh_l?: number | string;
};

export type SvbWohnortRow = {
  jahr?: number | string;
  anzahl_ol?: number | string;
  anzahl_k?: number | string;
};

export type SvbWohnortIndexRow = {
  jahr?: number | string;
  index_ol?: number | string;
  index_k?: number | string;
  index_bl?: number | string;
  index_l?: number | string;
};

export type SvbArbeitsortRow = {
  jahr?: number | string;
  anzahl_ol?: number | string;
  anzahl_k?: number | string;
};

export type SvbArbeitsortIndexRow = {
  jahr?: number | string;
  index_ol?: number | string;
  index_k?: number | string;
  index_bl?: number | string;
  index_l?: number | string;
};

export type ArbeitslosenzahlenRow = {
  jahr?: number | string;
  anzahl_ol?: number | string;
  anzahl_k?: number | string;
};

export type ArbeitslosenquotenRow = {
  jahr?: number | string;
  quote_ol?: number | string;
  quote_k?: number | string;
  quote_bl?: number | string;
  quote_l?: number | string;
};

export type WohnungsangebotAllgemeinRow = {
  wohnungsbestand?: number | string;
  baufertigstellungen?: number | string;
  baugenehmigungen?: number | string;
  leerstandsquote?: number | string;
  wohnungsbestand_anzahl_absolut?: number | string;
  wohnungsbestand_wohnraumsaldo?: number | string;
  wohnungsbestand_wohnraumsaldo_per_1000_ew?: number | string;
  wohnungsbestand_wohnflaeche_pro_ew?: number | string;
  wohnungsbestand_mittlere_wohnflaeche?: number | string;
  wohnungsbestand_raum_pro_ew?: number | string;
  baufertigstellungen_anzahl_absolut?: number | string;
  baufertigstellungen_flaeche_absolut?: number | string;
  baugenehmigungen_anzahl_absolut?: number | string;
  baugenehmigungen_flaeche_absolut?: number | string;
  baugenehmigungen_erloschen?: number | string;
};

export type ZeitreiheKreisBundLandRow = {
  jahr?: number | string;
  einwohner_k?: number | string;
  einwohner_bl?: number | string;
  einwohner_l?: number | string;
  einwohner_ol?: number | string;
};

export type BevoelkerungsentwicklungAbsolutRow = {
  jahr?: number | string;
  einwohner?: number | string;
};

export type BevoelkerungsaltersentwicklungRow = {
  jahr?: number | string;
  durchschnittsalter_k?: number | string;
  durchschnittsalter_bl?: number | string;
  durchschnittsalter_l?: number | string;
  durchschnittsalter_ol?: number | string;
};

export type AltersverteilungRow = {
  label?: string;
  altersspanne?: number | string;
};

export type BevoelkerungsbewegungGesamtRow = {
  jahr?: number | string;
  natuerlich?: number | string;
  wanderung?: number | string;
  saldo?: number | string;
};

export type NatuerlicheBevoelkerungsbewegungRow = {
  jahr?: number | string;
  saldo?: number | string;
  geburten?: number | string;
  sterbefaelle?: number | string;
};

export type WanderungssaldoRow = {
  jahr?: number | string;
  saldo?: number | string;
  zuzug?: number | string;
  fortzug?: number | string;
};

export type AussenwanderungssaldoRow = {
  jahr?: number | string;
  aussenwanderungssaldo_bundesland_ew?: number | string;
  aussenwanderungssaldo_deutschland_ew?: number | string;
  aussenwanderungssaldo_ausland_ew?: number | string;
  aussenwanderungssaldo_gesamt_ew?: number | string;
};

export type AussenwanderungssaldoNachAlterRow = {
  zeitraum?: number | string;
  aussenwanderungssaldo_nach_alter_ueber_bundeslandgrenzen?: Array<number | string>;
  aussenwanderungssaldo_nach_alter_ueber_auslandsgrenzen?: Array<number | string>;
};

export type HaushalteJe1000Row = {
  jahr?: number | string;
  anzahl_k?: number | string;
  anzahl_bl?: number | string;
  anzahl_l?: number | string;
  anzahl_ol?: number | string;
};

export type HaushaltsgroesseNachPersonenanzahlRow = {
  jahr?: number | string;
  personenanzahl_1?: number | string;
  personenanzahl_2?: number | string;
  personenanzahl_3?: number | string;
};

export type WohnungsbestandWohnflaecheRow = {
  jahr?: number | string;
  flaeche_k?: number | string;
  flaeche_bl?: number | string;
  flaeche_l?: number | string;
  flaeche_ol?: number | string;
};

export type WohnungsbestandWohnungsanzahlRow = {
  jahr?: number | string;
  anzahl?: number | string;
};

export type WohnungsbestandWohnungsanzahlJe1000Row = {
  jahr?: number | string;
  anzahl_k?: number | string;
  anzahl_bl?: number | string;
  anzahl_l?: number | string;
  anzahl_ol?: number | string;
};

export type WohnungsbestandGebaeudeverteilungRow = {
  label?: string;
  anzahl?: number | string;
};

export type WohnungsbestandWohnungsverteilungRow = {
  label?: string;
  anzahl?: number | string;
};

export type BaufertigstellungenWohnflaecheRow = {
  jahr?: number | string;
  flaeche?: number | string;
};

export type BaufertigstellungenWohnungsanzahlRow = {
  jahr?: number | string;
  anzahl?: number | string;
};

export type BaufertigstellungenWohnungsanzahlJe1000Row = {
  jahr?: number | string;
  anzahl_k?: number | string;
  anzahl_bl?: number | string;
  anzahl_l?: number | string;
  anzahl_ol?: number | string;
};

export type BaufertigstellungenGebaeudeanzahlRow = {
  jahr?: number | string;
  anzahl?: number | string;
};

export type BaufertigstellungenWohnungsanzahlGebaeudeVerteilungRow = {
  wohnungsanzahl_gebaeude_efh?: number | string;
  wohnungsanzahl_gebaeude_zfh?: number | string;
  wohnungsanzahl_gebaeude_mfh?: number | string;
};

export type BaufertigstellungenGebaeudeverteilungRow = {
  label?: string;
  anzahl?: number | string;
};

export type BaugenehmigungenWohnflaecheRow = {
  jahr?: number | string;
  flaeche?: number | string;
};

export type BaugenehmigungenWohnungsanzahlRow = {
  jahr?: number | string;
  anzahl?: number | string;
};

export type BaugenehmigungenWohnungsanzahlJe1000Row = {
  jahr?: number | string;
  anzahl_k?: number | string;
  anzahl_bl?: number | string;
  anzahl_l?: number | string;
  anzahl_ol?: number | string;
};

export type BaugenehmigungenGebaeudeanzahlRow = {
  jahr?: number | string;
  anzahl?: number | string;
};

export type BaugenehmigungenWohnungsanzahlGebaeudeVerteilungRow = {
  wohnungsanzahl_gebaeude_efh?: number | string;
  wohnungsanzahl_gebaeude_zfh?: number | string;
  wohnungsanzahl_gebaeude_mfh?: number | string;
};

export type BaugenehmigungenGebaeudeverteilungRow = {
  label?: string;
  anzahl?: number | string;
};

export type BauUeberhangGenehmigungFertigstellungRow = {
  jahr?: number | string;
  anzahl_genehmigung_k?: number | string;
  anzahl_fertigstellung_k?: number | string;
  anzahl_ueberhang_k?: number | string;
  anzahl_abgang_k?: number | string;
  anzahl_genehmigung_ol?: number | string;
  anzahl_fertigstellung_ol?: number | string;
  anzahl_ueberhang_ol?: number | string;
  anzahl_abgang_ol?: number | string;
};

export type BauueberhangBaufortschrittRow = {
  jahr?: number | string;
  anzahl_genehmigung_erloschen_k?: number | string;
  anzahl_bauueberhang_noch_nicht_begonnen_k?: number | string;
  anzahl_bauueberhang_noch_nicht_unter_dach_k?: number | string;
  anzahl_bauueberhang_unter_dach_k?: number | string;
  anzahl_genehmigungen_k?: number | string;
  anzahl_genehmigung_erloschen_ol?: number | string;
  anzahl_bauueberhang_noch_nicht_begonnen_ol?: number | string;
  anzahl_bauueberhang_noch_nicht_unter_dach_ol?: number | string;
  anzahl_bauueberhang_unter_dach_ol?: number | string;
  anzahl_genehmigungen_ol?: number | string;
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

export type GrundstueckKaufpreisspanneRow = {
  preis_grundstueck_min?: number | string;
  preis_grundstueck_avg?: number | string;
  preis_grundstueck_max?: number | string;
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

export type GrundstueckPreisentwicklungRow = {
  jahr?: number | string;
  angebotspreisentwicklung_grundstueck_k?: number | string;
  verkaufspreisentwicklung_grundstueck_k?: number | string;
  angebotspreisentwicklung_grundstueck_ol?: number | string;
  verkaufspreisentwicklung_grundstueck_ol?: number | string;
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

export type GrundstueckspreisindexRegionalRow = {
  grundstueckspreisindex?: number | string;
};

export type GrundstueckspreiseReportData = {
  text?: BerichtTexte;
  grundstueck_kaufpreisspanne?: GrundstueckKaufpreisspanneRow[];
  grundstueckspreisindex_regional?: GrundstueckspreisindexRegionalRow[];
  grundstueck_kaufpreise_im_ueberregionalen_vergleich?: PreisinfoRow[];
  grundstueck_preisentwicklung?: GrundstueckPreisentwicklungRow[];
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

export type WohnmarktsituationReportData = {
  text?: BerichtTexte;
  wohnungsnachfrage_allgemein?: WohnungsnachfrageAllgemeinRow[];
  wohnbauflaechenanteil?: WohnbauflaechenanteilRow[];
  flaechennutzung_wohnbau?: FlaechennutzungWohnbauRow[];
  wohnungsangebot_allgemein?: WohnungsangebotAllgemeinRow[];
  bevoelkerungsentwicklung_relativ?: ZeitreiheKreisBundLandRow[];
  bevoelkerungsentwicklung_absolut?: BevoelkerungsentwicklungAbsolutRow[];
  bevoelkerungsaltersentwicklung?: BevoelkerungsaltersentwicklungRow[];
  altersverteilung?: AltersverteilungRow[];
  bevoelkerungsbewegung_gesamt?: BevoelkerungsbewegungGesamtRow[];
  natuerliche_bevoelkerungsbewegung?: NatuerlicheBevoelkerungsbewegungRow[];
  natuerliche_bevoelkerungsbewegung_je_1000_ew?: ZeitreiheKreisBundLandRow[];
  wanderungssaldo?: WanderungssaldoRow[];
  wanderungssaldo_je_1000_ew?: ZeitreiheKreisBundLandRow[];
  aussenwanderungssaldo?: AussenwanderungssaldoRow[];
  aussenwanderungssaldo_nach_alter?: AussenwanderungssaldoNachAlterRow[];
  haushalte_je_1000_ew?: HaushalteJe1000Row[];
  haushaltsgroesse_nach_personenanzahl?: HaushaltsgroesseNachPersonenanzahlRow[];
  wohnungsbestand_wohnflaeche?: WohnungsbestandWohnflaecheRow[];
  wohnungsbestand_wohnungsanzahl?: WohnungsbestandWohnungsanzahlRow[];
  wohnungsbestand_wohnungsanzahl_je_1000_ew?: WohnungsbestandWohnungsanzahlJe1000Row[];
  wohnungsbestand_gebaeudeverteilung?: WohnungsbestandGebaeudeverteilungRow[];
  wohnungsbestand_wohnungsverteilung?: WohnungsbestandWohnungsverteilungRow[];
  baufertigstellungen_wohnflaeche?: BaufertigstellungenWohnflaecheRow[];
  baufertigstellungen_wohnungsanzahl?: BaufertigstellungenWohnungsanzahlRow[];
  baufertigstellungen_wohnungsanzahl_je_1000_ew?: BaufertigstellungenWohnungsanzahlJe1000Row[];
  baufertigstellungen_gebaeudeanzahl?: BaufertigstellungenGebaeudeanzahlRow[];
  baufertigstellungen_wohnungsanzahl_gebaeude_verteilung?: BaufertigstellungenWohnungsanzahlGebaeudeVerteilungRow[];
  baufertigstellungen_gebaeudeverteilung?: BaufertigstellungenGebaeudeverteilungRow[];
  baugenehmigungen_wohnflaeche?: BaugenehmigungenWohnflaecheRow[];
  baugenehmigungen_wohnungsanzahl?: BaugenehmigungenWohnungsanzahlRow[];
  baugenehmigungen_wohnungsanzahl_je_1000_ew?: BaugenehmigungenWohnungsanzahlJe1000Row[];
  baugenehmigungen_gebaeudeanzahl?: BaugenehmigungenGebaeudeanzahlRow[];
  baugenehmigungen_wohnungsanzahl_gebaeude_verteilung?: BaugenehmigungenWohnungsanzahlGebaeudeVerteilungRow[];
  baugenehmigungen_gebaeudeverteilung?: BaugenehmigungenGebaeudeverteilungRow[];
  bau_ueberhang_genehmigung_fertigstellung?: BauUeberhangGenehmigungFertigstellungRow[];
  bauueberhang_baufortschritt?: BauueberhangBaufortschrittRow[];
};

export type WirtschaftReportData = {
  text?: BerichtTexte;
  gewerbeflaechenanteil?: GewerbeflaechenanteilRow[];
  flaechennutzung_gewerbe?: FlaechennutzungGewerbeRow[];
  wirtschaft_allgemein?: WirtschaftAllgemeinRow[];
  gewerbesaldo_abs?: GewerbesaldoAbsRow[];
  gewerbesaldo_je_1000_ew?: GewerbesaldoJe1000Row[];
  bruttoinlandsprodukt_abs?: BIPAbsRow[];
  bruttoinlandsprodukt_pro_ew?: BIPProEwRow[];
  nettoeinkommen_pro_ew?: NettoeinkommenProEwRow[];
  nettoeinkommen_pro_hh?: NettoeinkommenProHhRow[];
  sv_pflichtig_beschaeftigte_wohnort?: SvbWohnortRow[];
  sv_pflichtig_beschaeftigte_wohnort_index?: SvbWohnortIndexRow[];
  sv_pflichtig_beschaeftigte_arbeitsort?: SvbArbeitsortRow[];
  sv_pflichtig_beschaeftigte_arbeitsort_index?: SvbArbeitsortIndexRow[];
  arbeitslosenzahlen?: ArbeitslosenzahlenRow[];
  arbeitslosenquoten?: ArbeitslosenquotenRow[];
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
