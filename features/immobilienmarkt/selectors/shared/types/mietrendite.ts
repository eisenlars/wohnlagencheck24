import type { buildTableModel } from "@/utils/buildTableModel";

export type TableModel = ReturnType<typeof buildTableModel>;
export type Zeitreihenpunkt = { jahr: number; value: number };
export type ZeitreiheSeries = { key: string; label: string; points: Zeitreihenpunkt[]; color?: string };

export type MietrenditeVM = {
  level: "kreis" | "ort";
  regionName: string;
  bundeslandName?: string;
  basePath: string;
  updatedAt?: string;

  headlineMain: string;
  headlineBruttoNetto: string;
  headlineBruttoNettoIndividuell?: string;

  teaser: string;
  kaufpreisfaktorText: string;
  allgemeinText: string;
  hinweisText: string;
  etwText: string;
  efhText: string;
  mfhText: string;

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

  gesamt: {
    kaufpreisfaktor: number | null;
    bruttomietrendite: number | null;
    nettomietrendite: number | null;
  };

  etw: {
    brutto: number | null;
    netto: number | null;
    kaufpreisfaktor: number | null;
    table: TableModel | null;
  };

  efh: {
    brutto: number | null;
    netto: number | null;
    kaufpreisfaktor: number | null;
    table: TableModel | null;
  };

  mfh: {
    brutto: number | null;
    netto: number | null;
    kaufpreisfaktor: number | null;
    table: TableModel | null;
  };

  kaufpreisfaktorSeries: ZeitreiheSeries[];
  bruttoRenditeSeries: ZeitreiheSeries[];
};
