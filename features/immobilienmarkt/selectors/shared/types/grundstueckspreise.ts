import type { buildTableModel } from "@/utils/buildTableModel";

export type TableModel = ReturnType<typeof buildTableModel>;
export type Zeitreihenpunkt = { jahr: number; value: number };
export type ZeitreiheSeries = { key: string; label: string; points: Zeitreihenpunkt[]; color?: string };

export type GrundstueckspreiseVM = {
  level: "kreis" | "ort";
  regionName: string;
  bundeslandName?: string;
  basePath: string;
  updatedAt?: string;

  headlineMain: string;
  headlineSection: string;
  headlineSectionIndividuell?: string;

  teaser: string;
  ueberregionalText: string;
  preisentwicklungText: string;

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
    min: number | null;
    avg: number | null;
    max: number | null;
  };
  avgPreis: number | null;

  grundstueckspreisindex: number | null;
  ueberregionalModel: TableModel | null;
  preisentwicklungSeries: ZeitreiheSeries[];
  showMap: boolean;
};
