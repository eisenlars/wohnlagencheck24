// features/immobilienmarkt/selectors/kreis/uebersicht.ts

import type { Report } from "@/lib/data";
import { toNumberOrNull } from "@/utils/toNumberOrNull";
import { getText } from "@/utils/getText";
import { formatEurPerSqm } from "@/utils/format";

import type { VergleichItem } from "@/components/VergleichChart";
import type { Zeitreihenpunkt } from "@/components/ZeitreiheChart";
import type { OrtslagenUebersichtRow } from "@/components/OrtslagenUebersichtTable";


export type PreisgrenzenData = {
  cheapestName: string;
  cheapestValue: number | null;
  priciestName: string;
  priciestValue: number | null;
};



export type KreisUebersichtVM = {
  kreisName: string;
  bundeslandName?: string;
  basePath: string;

  hero: {
    imageSrc: string;
    title: string;
    subtitle: string;
    // Hero-Overlay (Tacho) – vorerst wie im Bestand statisch
    kaufmarktValue: number;
    mietmarktValue: number;
  };

  berater: {
    name: string;
    telefon: string;
    email: string;
    taetigkeit: string;
    imageSrc: string;
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

  images: {
    teaserImage: string;
    agentSuggestImage: string;
  };

  standort: {
    bevoelkerungsdynamik: number | null;
    arbeitsmarktdynamik: number | null;
    wirtschaftskraft: number | null;
    wohnraumsituation: number | null;
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
    basisjahrImmobilien: number | null;
    basisjahrGrundstueck: number | null;
    basisjahrMiete: number | null;
    indexImmobilien: number | null;
    indexGrundstueck: number | null;
    indexMiete: number | null;
  };

  ortslagenUebersicht: OrtslagenUebersichtRow[];
  preisgrenzen: {
    immobilie: PreisgrenzenData | null;
    grund: PreisgrenzenData | null;
    miete: PreisgrenzenData | null;
  };
};

const toVergleichItems = (raw: any[], valueKey: string): VergleichItem[] =>
  (raw ?? [])
    .map((item: any) => ({
      region: String(item?.region ?? ""),
      value:
        typeof item?.[valueKey] === "number"
          ? item[valueKey]
          : Number(item?.[valueKey]),
    }))
    .filter((x) => x.region && Number.isFinite(x.value));

const toZeitreihe = (raw: any[], valueKey: string): Zeitreihenpunkt[] =>
  Array.isArray(raw)
    ? raw
        .map((item: any) => ({
          jahr: Number(item?.jahr),
          value: Number(item?.[valueKey]),
        }))
        .filter((p) => Number.isFinite(p.jahr) && Number.isFinite(p.value) && p.jahr > 1900)
        .sort((a, b) => a.jahr - b.jahr)
    : [];

export function buildKreisUebersichtVM(args: {
  report: Report;
  bundeslandSlug: string;
  kreisSlug: string;
}): KreisUebersichtVM {
  const { report, bundeslandSlug, kreisSlug } = args;

  const kreisName =
    (report.meta as any)?.amtlicher_name ?? report.meta?.name ?? kreisSlug;

  const bundeslandName = (report.meta as any)?.bundesland_name;

  const basePath = `/immobilienmarkt/${bundeslandSlug}/${kreisSlug}`;

  // Hero
  const heroImageSrc = `/images/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/immobilienmarktbericht-${kreisSlug}.jpg`;

  // Berater
  const beraterName =
    (report.data as any)?.text?.berater?.berater_name ?? "Lars Hofmann";
  const beraterTelefon =
    (report.data as any)?.text?.berater?.berater_telefon ?? "+49 351/287051-0";
  const beraterEmail =
    (report.data as any)?.text?.berater?.berater_email ?? "kontakt@wohnlagencheck24.de";

  const beraterTaetigkeit = `Standort- / Immobilienberatung – ${kreisName}`;
  const beraterImageSrc = `/images/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/immobilienberatung-${kreisSlug}.png`;

  // Texte
  const teaser = getText(
    report,
    "text.immobilienmarkt_ueberblick.immobilienmarkt_allgemein",
    "",
  );

  const standortTeaser = getText(
    report,
    "text.immobilienmarkt_ueberblick.immobilienmarkt_standort_teaser",
    "",
  );

  const individual01 = getText(
    report,
    "text.immobilienmarkt_ueberblick.immobilienmarkt_individuell_01",
    "",
  );

  const zitat = getText(
    report,
    "text.immobilienmarkt_ueberblick.immobilienmarkt_zitat",
    "",
  );

  const individual02 = getText(
    report,
    "text.immobilienmarkt_ueberblick.immobilienmarkt_individuell_02",
    "",
  );

  const beschreibung01 = getText(
    report,
    "text.immobilienmarkt_ueberblick.immobilienmarkt_beschreibung_01",
    "",
  );

  const beschreibung02 = getText(
    report,
    "text.immobilienmarkt_ueberblick.immobilienmarkt_beschreibung_02",
    "",
  );

  const marketBasicKnowledge = getText(
    report,
    "text.immobilienmarkt_ueberblick.immobilienmarkt_besonderheiten",
    "",
  );

  const agentSuggest = getText(
    report,
    "text.immobilienmarkt_ueberblick.immobilienmarkt_maklerempfehlung",
    "",
  );

  // Bilder
  const teaserImage = `/images/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/immobilienmarktbericht-${kreisSlug}-preview.jpg`;
  const agentSuggestImage = `/images/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/makler-${kreisSlug}-logo.jpg`;

  // Standortindikatoren
  const standortAllgemein = (report.data as any)?.standort_allgemein?.[0] ?? null;

  const bevoelkerungsdynamik =
    standortAllgemein && typeof standortAllgemein.bevoelkerungsdynamik === "number"
      ? standortAllgemein.bevoelkerungsdynamik
      : null;

  const arbeitsmarktdynamik =
    standortAllgemein && typeof standortAllgemein.arbeitsmarktdynamik === "number"
      ? standortAllgemein.arbeitsmarktdynamik
      : null;

  const wirtschaftskraft =
    standortAllgemein && typeof standortAllgemein.wirtschaftskraft === "number"
      ? standortAllgemein.wirtschaftskraft
      : null;

  const wohnraumsituation =
    standortAllgemein && typeof standortAllgemein.wohnraumsituation === "number"
      ? standortAllgemein.wohnraumsituation
      : null;

  // KPI Basiswerte
  const kaufpreis = toNumberOrNull((report.data as any)?.immobilien_kaufpreis?.[0]?.kaufpreis_immobilien);
  const grundstueckspreis = toNumberOrNull((report.data as any)?.grundstueck_kaufpreis?.[0]?.kaufpreis_grundstueck);
  const kaltmiete = toNumberOrNull((report.data as any)?.mietpreise_gesamt?.[0]?.preis_kaltmiete);

  const kaufpreisLabel = formatEurPerSqm(kaufpreis, "kaufpreis_qm");
  const grundstueckLabel = formatEurPerSqm(grundstueckspreis, "grundstueck_qm");
  const kaltmieteLabel = formatEurPerSqm(kaltmiete, "miete_qm");

  // Überregionaler Vergleich
  const immVergleich = toVergleichItems(
    (report.data as any)?.immobilienpreise_ueberregionaler_vergleich,
    "immobilienpreis",
  );

  const grundVergleich = toVergleichItems(
    (report.data as any)?.grundstueckspreise_ueberregionaler_vergleich,
    "grundstueckspreis",
  );

  const mieteVergleich = toVergleichItems(
    (report.data as any)?.mietpreise_ueberregionaler_vergleich,
    "kaltmiete",
  );

  // Historien
  const immobilienHistorie = toZeitreihe(
    (report.data as any)?.immobilie_kaufpreisentwicklung ?? [],
    "kaufpreisentwicklung_immobilie",
  );

  const grundHistorie = toZeitreihe(
    (report.data as any)?.grundstueck_kaufpreisentwicklung ?? [],
    "kaufpreisentwicklung_grundstueck",
  );

  const mieteHistorie = toZeitreihe(
    (report.data as any)?.immobilie_mietpreisentwicklung ?? [],
    "mietpreisentwicklung_immobilie",
  );

  // Preisindex
  const basisjahrRaw = (report.data as any)?.basisjahr?.[0] ?? null;
  const preisindexRaw = (report.data as any)?.preisindex?.[0] ?? null;

  const basisjahrImmobilien = toNumberOrNull(basisjahrRaw?.basisjahr_immobilienpreisindex);
  const basisjahrGrundstueck = toNumberOrNull(basisjahrRaw?.basisjahr_grundstueckspreisindex);
  const basisjahrMiete = toNumberOrNull(basisjahrRaw?.basisjahr_mietpreisindex);

  const indexImmobilien = toNumberOrNull(preisindexRaw?.immobilienpreisindex);
  const indexGrundstueck = toNumberOrNull(preisindexRaw?.grundstueckspreisindex);
  const indexMiete = toNumberOrNull(preisindexRaw?.mietpreisindex);

  // Ortslagen-Übersicht
  const ortslagenUebersichtRaw = (report.data as any)?.ortslagen_uebersicht ?? [];

  const ortslagenUebersicht: OrtslagenUebersichtRow[] = Array.isArray(ortslagenUebersichtRaw)
    ? ortslagenUebersichtRaw
        .filter((item: any) => {
          const k = String(item?.kreis ?? "").toLowerCase();
          return !k || k === kreisSlug;
        })
        .map((item: any) => ({
          ortslage: String(item?.ortslage ?? "").trim(),

          immobilienpreise_value: toNumberOrNull(item?.immobilienpreise_wert),
          immobilienpreise_yoy: toNumberOrNull(item?.immobilienpreise_tendenz),

          grundstueckspreise_value: toNumberOrNull(item?.grundstueckspreise_wert),
          grundstueckspreise_yoy: toNumberOrNull(item?.grundstueckspreise_tendenz),

          mietpreise_value: toNumberOrNull(item?.mietpreise_wert),
          mietpreise_yoy: toNumberOrNull(item?.mietpreise_tendenz),
        }))
        .filter((r) => r.ortslage.length > 0)
    : [];

  // Preisgrenzen
  const preisgrenzenImmobilieRaw =
    (report.data as any)?.ortslagen_preisgrenzen_immobilie?.[0] ?? null;

  const preisgrenzenGrundRaw =
    (report.data as any)?.ortslagen_preisgrenzen_grundstueck?.[0] ?? null;

  const preisgrenzenMieteRaw =
    (report.data as any)?.ortslagen_preisgrenzen_miete?.[0] ?? null;

  const preisgrenzenImmobilie: PreisgrenzenData | null = preisgrenzenImmobilieRaw
    ? {
        cheapestName: String(preisgrenzenImmobilieRaw?.guenstigste_ortslage_immobilie ?? "").trim(),
        cheapestValue: toNumberOrNull(preisgrenzenImmobilieRaw?.guenstigste_ortslage_immobilienpreis),
        priciestName: String(preisgrenzenImmobilieRaw?.teuerste_ortslage_immobilie ?? "").trim(),
        priciestValue: toNumberOrNull(preisgrenzenImmobilieRaw?.teuerste_ortslage_immobilienpreis),
      }
    : null;

  const preisgrenzenGrund: PreisgrenzenData | null = preisgrenzenGrundRaw
    ? {
        cheapestName: String(preisgrenzenGrundRaw?.guenstigste_ortslage_grundstueck ?? "").trim(),
        cheapestValue: toNumberOrNull(preisgrenzenGrundRaw?.guenstigste_ortslage_grundstueckspreis),
        priciestName: String(preisgrenzenGrundRaw?.teuerste_ortslage_grundstueck ?? "").trim(),
        priciestValue: toNumberOrNull(preisgrenzenGrundRaw?.teuerste_ortslage_grundstueckspreis),
      }
    : null;

  const preisgrenzenMiete: PreisgrenzenData | null = preisgrenzenMieteRaw
    ? {
        cheapestName: String(preisgrenzenMieteRaw?.guenstigste_ortslage_miete ?? "").trim(),
        cheapestValue: toNumberOrNull(preisgrenzenMieteRaw?.guenstigste_ortslage_mietpreis),
        priciestName: String(preisgrenzenMieteRaw?.teuerste_ortslage_miete ?? "").trim(),
        priciestValue: toNumberOrNull(preisgrenzenMieteRaw?.teuerste_ortslage_mietpreis),
      }
    : null;

  return {
    kreisName,
    bundeslandName,
    basePath,

    hero: {
      imageSrc: heroImageSrc,
      title: kreisName,
      subtitle: "regionaler Standortberater",
      kaufmarktValue: 20,
      mietmarktValue: -15,
    },

    berater: {
      name: beraterName,
      telefon: beraterTelefon,
      email: beraterEmail,
      taetigkeit: beraterTaetigkeit,
      imageSrc: beraterImageSrc,
    },

    texts: {
      teaser,
      standortTeaser,
      individual01,
      zitat,
      individual02,
      beschreibung01,
      beschreibung02,
      marketBasicKnowledge,
      agentSuggest,
    },

    images: {
      teaserImage,
      agentSuggestImage,
    },

    standort: {
      bevoelkerungsdynamik,
      arbeitsmarktdynamik,
      wirtschaftskraft,
      wohnraumsituation,
    },

    kpis: {
      kaufpreis,
      kaufpreisLabel,
      grundstueckspreis,
      grundstueckLabel,
      kaltmiete,
      kaltmieteLabel,
    },

    vergleich: {
      immobilien: immVergleich,
      grundstueck: grundVergleich,
      miete: mieteVergleich,
    },

    historien: {
      immobilien: immobilienHistorie,
      grundstueck: grundHistorie,
      miete: mieteHistorie,
    },

    preisindex: {
      basisjahrImmobilien,
      basisjahrGrundstueck,
      basisjahrMiete,
      indexImmobilien,
      indexGrundstueck,
      indexMiete,
    },

    ortslagenUebersicht,

    preisgrenzen: {
      immobilie: preisgrenzenImmobilie,
      grund: preisgrenzenGrund,
      miete: preisgrenzenMiete,
    },
  };
}
