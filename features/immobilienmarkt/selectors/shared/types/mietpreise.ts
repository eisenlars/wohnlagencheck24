import type { BarModel } from "@/utils/barModel";
import type { buildTableModel } from "@/utils/buildTableModel";

export type TableModel = ReturnType<typeof buildTableModel>;
export type Zeitreihenpunkt = { jahr: number; value: number };
export type ZeitreiheSeries = { key: string; label: string; points: Zeitreihenpunkt[]; color?: string };

export type MietpreiseVM = {
  level: "kreis" | "ort";
  regionName: string;
  bundeslandName?: string;
  basePath: string;
  updatedAt?: string;

  headlineMain: string;
  headlineWohnung: string;
  headlineHaus: string;
  headlineWohnungIndividuell?: string;
  headlineHausIndividuell?: string;

  teaser: string;
  ueberregionalText: string;
  wohnungText: string;
  wohnungEntwicklungText: string;
  wohnungZimmerFlaechenText: string;
  hausText: string;
  hausEntwicklungText: string;

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
    kaltmiete: number | null;
    nebenkosten: number | null;
    warmmiete: number | null;
  };

  mietpreisindexWohnung: number | null;
  ueberregionalModel: TableModel | null;

  wohnungMin: number | null;
  wohnungAvg: number | null;
  wohnungMax: number | null;

  wohnungBaujahrBestand: number | null;
  wohnungBaujahrBestandVorjahr: number | null;
  wohnungBaujahrNeubau: number | null;
  wohnungBaujahrNeubauVorjahr: number | null;

  wohnungZimmerModel: BarModel | null;
  wohnungFlaechenModel: BarModel | null;
  wohnungEntwicklungSeries: ZeitreiheSeries[];

  hausMin: number | null;
  hausAvg: number | null;
  hausMax: number | null;
  hausEntwicklungSeries: ZeitreiheSeries[];
};
