import type { DoughnutSlice } from "@/components/DoughnutChart";

export type Zeitreihenpunkt = { jahr: number; value: number };
export type ZeitreiheSeries = { key: string; label: string; points: Zeitreihenpunkt[]; color?: string };

export type ComboSeries = { key: string; label: string; values: Array<number | null>; color?: string };

export type ComboModel = {
  categories: string[];
  bars: ComboSeries[];
  lines: ComboSeries[];
};

export type WirtschaftVM = {
  level: "kreis" | "ort";
  regionName: string;
  bundeslandName?: string;
  basePath: string;
  updatedAt?: string;

  headlineMain: string;
  headlineWirtschaft: string;
  headlineWirtschaftIndividuell?: string;
  headlineArbeitsmarkt: string;
  headlineArbeitsmarktIndividuell?: string;

  teaser?: string;
  introText: string;
  einkommenText: string;
  bruttoinlandsproduktText: string;
  gewerbesaldoText: string;
  arbeitsmarktText: string;
  arbeitslosenquoteText: string;
  arbeitslosendichteText: string;
  svBeschaeftigteWohnortText: string;
  svBeschaeftigteArbeitsortText: string;
  arbeitsplatzzentralitaetText: string;
  pendlerText: string;

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
    kaufkraftindex: number | null;
    flaecheGewerbe: number | null;
    bip: number | null;
    gewerbesaldo: number | null;
    kaufkraftNominal: number | null;
    kaufkraftReal: number | null;
    arbeitsplatzzentralitaet: number | null;
    pendlersaldo: number | null;
    arbeitslosenquote: number | null;
    beschaeftigtenquote: number | null;
    arbeitslosendichte: number | null;
  };

  gewerbeflaechenanteil: DoughnutSlice[];

  gewerbesaldoAbs: ComboModel;
  gewerbesaldoPro1000: ZeitreiheSeries[];
  bipAbs: ZeitreiheSeries[];
  bipProEw: ZeitreiheSeries[];
  nettoeinkommenProEw: ZeitreiheSeries[];
  nettoeinkommenProHh: ZeitreiheSeries[];
  svbWohnortAbs: ZeitreiheSeries[];
  svbWohnortIndex: ZeitreiheSeries[];
  svbArbeitsortAbs: ZeitreiheSeries[];
  svbArbeitsortIndex: ZeitreiheSeries[];
  arbeitslosenzahlen: ZeitreiheSeries[];
  arbeitslosenquoten: ZeitreiheSeries[];
};
