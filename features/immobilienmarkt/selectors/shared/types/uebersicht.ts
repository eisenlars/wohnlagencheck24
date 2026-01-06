// features/immobilienmarkt/selectors/shared/types/uebersicht.ts

/**
 * WICHTIG:
 * - Keine type-imports aus Client-Komponenten, um Turbopack-Chunk-Probleme zu vermeiden.
 * - Shapes lokal/neutral halten.
 */

export type UebersichtLevel = "deutschland" | "bundesland" | "kreis";

export type Zeitreihenpunkt = { jahr: number; value: number };

/** VergleichChart: minimaler Shape */
export type VergleichItem = {
  label: string;
  value: number | null;
  unitKey?: UnitKey; // z.B. eur_per_sqm, percent, none
  kind?: string;    // z.B. kaufpreis_qm, miete_qm, grundstueck_qm
};

export type Preisgrenze = {
  cheapestName: string;
  cheapestValue: number | null;
  priciestName: string;
  priciestValue: number | null;
};

export type OrtslagenUebersichtRow = {
  ortslage: string;

  immobilienpreise_value: number | null;
  immobilienpreise_yoy: number | null;

  grundstueckspreise_value: number | null;
  grundstueckspreise_yoy: number | null;

  mietpreise_value: number | null;
  mietpreise_yoy: number | null;
};

export type UebersichtVM = {
  level: UebersichtLevel;

  regionName: string;
  bundeslandName?: string;

  // für Kreis-Überschrift etc.
  kreisName?: string;

  // /immobilienmarkt[/bundesland][/kreis]
  basePath: string;

  hero: {
    title: string;
    subtitle: string;
    imageSrc?: string;

    // für die beiden Tachometer im Hero (nur sinnvoll ab Kreis, aber robust überall)
    kaufmarktValue: number;
    mietmarktValue: number;
  };

  berater: {
    name: string;
    taetigkeit: string;
    imageSrc: string;
  };

  images: {
    teaserImage?: string;
    agentSuggestImage?: string;
  };

  texts: {
    teaser: string;

    standortTeaser: string;

    individual01: string;
    zitat: string;
    individual02: string;

    beschreibung01: string;
    beschreibung02: string;

    marketBasicKnowledge: string;
    agentSuggest: string;
  };

  standort: {
    bevoelkerungsdynamik: number | null;  // Prozent (Trend)
    arbeitsmarktdynamik: number | null;   // Prozent (Trend)
    wirtschaftskraft: number | null;      // Prozent (Trend)
    wohnraumsituation: number | null;     // Saldo pro 1000 (Gauge)
  };

  kpis: {
    kaufpreis: number | null;
    kaufpreisLabel: string;

    grundstueckspreis: number | null;
    grundstueckLabel: string;

    kaltmiete: number | null;
    kaltmieteLabel: string;
  };

  vergleich: {
    immobilien: VergleichItem[];
    grundstueck: VergleichItem[];
    miete: VergleichItem[];
  };

  historien: {
    immobilien: Zeitreihenpunkt[];
    grundstueck: Zeitreihenpunkt[];
    miete: Zeitreihenpunkt[];
  };

  preisindex: {
    indexImmobilien: number | null;
    basisjahrImmobilien: number | null;

    indexGrundstueck: number | null;
    basisjahrGrundstueck: number | null;

    indexMiete: number | null;
    basisjahrMiete: number | null;
  };

  ortslagenUebersicht: OrtslagenUebersichtRow[];

  preisgrenzen: {
    immobilie?: Preisgrenze | null;
    grund?: Preisgrenze | null;
    miete?: Preisgrenze | null;
  };
};
import type { UnitKey } from "@/utils/format";
