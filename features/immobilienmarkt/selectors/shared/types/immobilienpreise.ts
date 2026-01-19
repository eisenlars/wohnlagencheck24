// features/immobilienmarkt/selectors/shared/types/immobilienpreise.ts

import type { BarModel } from "@/utils/barModel";
import type { buildTableModel } from "@/utils/buildTableModel";

export type TableModel = ReturnType<typeof buildTableModel>;

export type Zeitreihenpunkt = { jahr: number; value: number };
export type ZeitreiheSeries = { key: string; label: string; points: Zeitreihenpunkt[] };

export type ImmobilienpreiseVM = {
  level: "kreis" | "ort";
  regionName: string;
  bundeslandName?: string;
  basePath: string;

  updatedAt?: string;
  headlineMain: string;
  teaser: string;
  berater: {
    name: string;
    taetigkeit: string;
    imageSrc: string;
    telefon?: string;
    email?: string;
  };

  ueberschriftHausIndividuell: string;
  hauspreiseIntro: string;
  hausVergleichIntro: string;
  textHausLage: string;
  textHausKaufpreisentwicklung: string;
  textHaustypen: string;

  ueberschriftWohnungIndividuell: string;
  wohnungspreiseIntro: string;
  wohnungVergleichIntro: string;
  textWohnungLage: string;
  textWohnungKaufpreisentwicklung: string;
  textWohnungZimmerFlaechen: string;

  kaufpreisQm: number | null;

  hausMin: number | null;
  hausAvg: number | null;
  hausMax: number | null;
  indexHaus: number | null;

  wohnungMin: number | null;
  wohnungAvg: number | null;
  wohnungMax: number | null;
  indexWohnung: number | null;

  ueberregionalModelHaus: TableModel | null;
  lageModelHaus: TableModel | null;
  haustypModel: TableModel | null;

  ueberregionalModelWohnung: TableModel | null;
  lageModelWohnung: TableModel | null;

  hausKaufpreisentwicklungSeries: ZeitreiheSeries[];
  wohnungKaufpreisentwicklungSeries: ZeitreiheSeries[];

  wohnungZimmerModel: BarModel | null;
  wohnungFlaechenModel: BarModel | null;
};
