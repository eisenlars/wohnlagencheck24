import type { DoughnutSlice } from "@/components/DoughnutChart";

export type Zeitreihenpunkt = { jahr: number; value: number };
export type ZeitreiheSeries = { key: string; label: string; points: Zeitreihenpunkt[]; color?: string };

export type ComboSeries = { key: string; label: string; values: Array<number | null>; color?: string };

export type ComboModel = {
  categories: string[];
  bars: ComboSeries[];
  lines: ComboSeries[];
};

export type WohnmarktsituationVM = {
  level: "kreis" | "ort";
  regionName: string;
  bundeslandName?: string;
  basePath: string;
  updatedAt?: string;

  headlineMain: string;
  headlineWohnraumnachfrage: string;
  headlineWohnraumnachfrageIndividuell?: string;
  headlineWohnraumangebot: string;
  headlineWohnraumangebotIndividuell?: string;

  teaser: string;
  allgemeinText: string;

  wohnraumnachfrageText: string;
  natuerlicherSaldoIntro: string;
  wanderungssaldoIntro: string;
  jugendAltenQuotientIntro: string;

  wohnraumangebotIntro: string;
  bautaetigkeitIntro: string;
  wohnungsbestandIntro: string;
  baufertigstellungenIntro: string;
  baugenehmigungenIntro: string;
  bauueberhangBaufortschrittText: string;

  bevoelkerungsentwicklungText: string;
  haushalteText: string;
  natuerlicherSaldoText: string;
  wanderungssaldoText: string;
  alterstrukturText: string;
  jugendAltenQuotientText: string;
  wohnungsbestandAnzahlText: string;
  wohnungsbestandWohnflaecheText: string;
  baufertigstellungenText: string;
  baugenehmigungenText: string;

  bevoelkerungsentwicklungBasisjahr?: string;
  aussenwanderungssaldoNachAlterZeitraum?: string;

  berater: {
    name: string;
    telefon: string;
    email: string;
    taetigkeit: string;
    imageSrc: string;
  };

  hero: {
    imageSrc: string;
    title: string;
    subtitle: string;
  };

  kpis: {
    einwohner: number | string | null;
    haushalte: number | string | null;
    haushaltsgroesse: number | string | null;
    wanderungssaldo: number | string | null;
    natuerlicherSaldo: number | string | null;
    einwohnerdichte: number | string | null;
    siedlungsdichte: number | string | null;
    jugendquotient: number | string | null;
    altenquotient: number | string | null;

    wohnungsbestand: number | string | null;
    baufertigstellungen: number | string | null;
    baugenehmigungen: number | string | null;
    leerstandsquote: number | string | null;
    flaecheWohnbau: number | string | null;
    wohnungsbestandAnzahlAbsolut: number | string | null;
    wohnungsbestandWohnraumsaldo: number | string | null;
    wohnungsbestandWohnraumsaldoPer1000: number | string | null;
    wohnungsbestandWohnflaecheProEw: number | string | null;
    wohnungsbestandMittlereWohnflaeche: number | string | null;

    baufertigstellungenAnzahlAbsolut: number | string | null;
    baufertigstellungenFlaecheAbsolut: number | string | null;
    baugenehmigungenAnzahlAbsolut: number | string | null;
    baugenehmigungenFlaecheAbsolut: number | string | null;
    baugenehmigungenErloschen: number | string | null;
  };

  wohnbauflaechenanteil: DoughnutSlice[];
  wohnungsbestandGebaeudeverteilung: DoughnutSlice[];
  baufertigstellungenGebaeudeverteilung: DoughnutSlice[];
  baugenehmigungenGebaeudeverteilung: DoughnutSlice[];
  altersverteilung: DoughnutSlice[];

  bevoelkerungsentwicklungRelativ: ZeitreiheSeries[];
  bevoelkerungsentwicklungAbsolut: ComboModel;
  bevoelkerungsaltersentwicklung: ZeitreiheSeries[];
  bevoelkerungsbewegungGesamt: ComboModel;
  natuerlicheBevoelkerungsbewegung: ComboModel;
  natuerlicheBevoelkerungsbewegungJe1000: ZeitreiheSeries[];
  wanderungssaldo: ComboModel;
  wanderungssaldoJe1000: ZeitreiheSeries[];
  aussenwanderungssaldo: ComboModel;
  aussenwanderungssaldoNachAlter: ComboModel;
  haushalteJe1000: ZeitreiheSeries[];
  haushaltsgroesseNachPersonenanzahl: ComboModel;
  wohnungsbestandWohnflaeche: ZeitreiheSeries[];
  wohnungsbestandWohnungsanzahl: ComboModel;
  wohnungsbestandWohnungsanzahlJe1000: ZeitreiheSeries[];
  baufertigstellungenWohnungsanzahl: ComboModel;
  baufertigstellungenWohnungsanzahlJe1000: ZeitreiheSeries[];
  baugenehmigungenWohnungsanzahl: ComboModel;
  baugenehmigungenWohnungsanzahlJe1000: ZeitreiheSeries[];
  bauUeberhangGenehmigungFertigstellung: ZeitreiheSeries[];
  bauueberhangBaufortschritt: ComboModel;
};
