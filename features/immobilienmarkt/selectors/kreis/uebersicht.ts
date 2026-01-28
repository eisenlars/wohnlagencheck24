// features/immobilienmarkt/selectors/kreis/uebersicht.ts

import type { Report } from "@/lib/data";
import { toNumberOrNull } from "@/utils/toNumberOrNull";
import { getText } from "@/utils/getText";
import { formatEurPerSqm } from "@/utils/format";
import { asArray, asRecord, asString } from "@/utils/records";
import { formatRegionFallback, getRegionDisplayName } from "@/utils/regionName";
import { buildWebAssetUrl } from "@/utils/assets";
import type { UebersichtReportData } from "@/types/reports";

export type VergleichItem = { region: string; value: number };
export type Zeitpunkt = { jahr: number; value: number };

export type OrtslagenUebersichtRow = {
  ortslage: string;

  immobilienpreise_value: number | null;
  immobilienpreise_yoy: number | null;

  grundstueckspreise_value: number | null;
  grundstueckspreise_yoy: number | null;

  mietpreise_value: number | null;
  mietpreise_yoy: number | null;
};



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
    immobilien: Zeitpunkt[];
    grundstueck: Zeitpunkt[];
    miete: Zeitpunkt[];
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

const toVergleichItems = (raw: unknown, valueKey: string): VergleichItem[] =>
  asArray(raw)
    .map((item) => asRecord(item))
    .filter((row): row is Record<string, unknown> => Boolean(row))
    .map((item) => ({
      region: String(item["region"] ?? ""),
      value:
        typeof item[valueKey] === "number"
          ? item[valueKey]
          : Number(item[valueKey]),
    }))
    .filter((x) => x.region && Number.isFinite(x.value));

const toZeitreihe = (raw: unknown, valueKey: string): Zeitpunkt[] =>
  asArray(raw)
    .map((item) => asRecord(item))
    .filter((row): row is Record<string, unknown> => Boolean(row))
    .map((item) => ({
      jahr: Number(item["jahr"]),
      value: Number(item[valueKey]),
    }))
    .filter((p) => Number.isFinite(p.jahr) && Number.isFinite(p.value) && p.jahr > 1900)
    .sort((a, b) => a.jahr - b.jahr);

export function buildKreisUebersichtVM(args: {
  report: Report<UebersichtReportData>;
  bundeslandSlug: string;
  kreisSlug: string;
}): KreisUebersichtVM {
  const { report, bundeslandSlug, kreisSlug } = args;

  const meta = asRecord(report.meta) ?? {};
  const data = report.data ?? {};
  const text = data.text ?? {};
  const berater = text.berater ?? {};

  const kreisName = getRegionDisplayName({
    meta,
    level: "kreis",
    fallbackSlug: kreisSlug,
  });

  const bundeslandNameRaw = asString(meta["bundesland_name"])?.trim();
  const bundeslandName = bundeslandNameRaw ? formatRegionFallback(bundeslandNameRaw) : undefined;

  const basePath = `/immobilienmarkt/${bundeslandSlug}/${kreisSlug}`;

  // Hero
  const heroImageSrc = buildWebAssetUrl(
    `/images/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/immobilienmarktbericht-${kreisSlug}.jpg`,
  );

  // Berater
  const beraterName =
    (typeof berater.berater_name === "string" ? berater.berater_name : undefined) ??
    "Lars Hofmann";
  const beraterTelefon =
    (typeof berater.berater_telefon === "string" ? berater.berater_telefon : undefined) ??
    "+49 351/287051-0";
  const beraterEmail =
    (typeof berater.berater_email === "string" ? berater.berater_email : undefined) ??
    "kontakt@wohnlagencheck24.de";

  const beraterTaetigkeit = `Standort- / Immobilienberatung – ${kreisName}`;
  const beraterImageSrc = buildWebAssetUrl(
    `/images/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/immobilienberatung-${kreisSlug}.png`,
  );

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
  const teaserImage = buildWebAssetUrl(
    `/images/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/immobilienmarktbericht-${kreisSlug}-preview.jpg`,
  );
  const agentSuggestImage = buildWebAssetUrl(
    `/images/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/makler-${kreisSlug}-logo.jpg`,
  );

  // Standortindikatoren
  const standortAllgemein = data.standort_allgemein?.[0];

  const bevoelkerungsdynamik =
    standortAllgemein && typeof standortAllgemein["bevoelkerungsdynamik"] === "number"
      ? (standortAllgemein["bevoelkerungsdynamik"] as number)
      : null;

  const arbeitsmarktdynamik =
    standortAllgemein && typeof standortAllgemein["arbeitsmarktdynamik"] === "number"
      ? (standortAllgemein["arbeitsmarktdynamik"] as number)
      : null;

  const wirtschaftskraft =
    standortAllgemein && typeof standortAllgemein["wirtschaftskraft"] === "number"
      ? (standortAllgemein["wirtschaftskraft"] as number)
      : null;

  const wohnraumsituation =
    standortAllgemein && typeof standortAllgemein["wohnraumsituation"] === "number"
      ? (standortAllgemein["wohnraumsituation"] as number)
      : null;

  // KPI Basiswerte
  const immobilienKaufpreis = data.immobilien_kaufpreis?.[0];
  const grundstueckKaufpreis = data.grundstueck_kaufpreis?.[0];
  const mietpreiseGesamt = data.mietpreise_gesamt?.[0];

  const kaufpreis = toNumberOrNull(immobilienKaufpreis?.["kaufpreis_immobilien"]);
  const grundstueckspreis = toNumberOrNull(grundstueckKaufpreis?.["kaufpreis_grundstueck"]);
  const kaltmiete = toNumberOrNull(mietpreiseGesamt?.["preis_kaltmiete"]);

  const kaufpreisLabel = formatEurPerSqm(kaufpreis, "kaufpreis_qm");
  const grundstueckLabel = formatEurPerSqm(grundstueckspreis, "grundstueck_qm");
  const kaltmieteLabel = formatEurPerSqm(kaltmiete, "miete_qm");

  // Überregionaler Vergleich
  const immVergleich = toVergleichItems(
    data.immobilienpreise_ueberregionaler_vergleich,
    "immobilienpreis",
  );

  const grundVergleich = toVergleichItems(
    data.grundstueckspreise_ueberregionaler_vergleich,
    "grundstueckspreis",
  );

  const mieteVergleich = toVergleichItems(
    data.mietpreise_ueberregionaler_vergleich,
    "kaltmiete",
  );

  // Historien
  const immobilienHistorie = toZeitreihe(
    data.immobilie_kaufpreisentwicklung,
    "kaufpreisentwicklung_immobilie",
  );

  const grundHistorie = toZeitreihe(
    data.grundstueck_kaufpreisentwicklung,
    "kaufpreisentwicklung_grundstueck",
  );

  const mieteHistorie = toZeitreihe(
    data.immobilie_mietpreisentwicklung,
    "mietpreisentwicklung_immobilie",
  );

  // Preisindex
  const basisjahrRaw = data.basisjahr?.[0];
  const preisindexRaw = data.preisindex?.[0];

  const basisjahrImmobilien = toNumberOrNull(basisjahrRaw?.["basisjahr_immobilienpreisindex"]);
  const basisjahrGrundstueck = toNumberOrNull(basisjahrRaw?.["basisjahr_grundstueckspreisindex"]);
  const basisjahrMiete = toNumberOrNull(basisjahrRaw?.["basisjahr_mietpreisindex"]);

  const indexImmobilien = toNumberOrNull(preisindexRaw?.["immobilienpreisindex"]);
  const indexGrundstueck = toNumberOrNull(preisindexRaw?.["grundstueckspreisindex"]);
  const indexMiete = toNumberOrNull(preisindexRaw?.["mietpreisindex"]);

  // Ortslagen-Übersicht
  const ortslagenUebersichtRaw = data.ortslagen_uebersicht ?? [];

  const ortslagenUebersicht: OrtslagenUebersichtRow[] = ortslagenUebersichtRaw
    .filter((item) => {
      const k = String(item.kreis ?? "").toLowerCase();
      return !k || k === kreisSlug;
    })
    .map((item) => ({
      ortslage: String(item.ortslage ?? "").trim(),

      immobilienpreise_value: toNumberOrNull(item.immobilienpreise_wert),
      immobilienpreise_yoy: toNumberOrNull(item.immobilienpreise_tendenz),

      grundstueckspreise_value: toNumberOrNull(item.grundstueckspreise_wert),
      grundstueckspreise_yoy: toNumberOrNull(item.grundstueckspreise_tendenz),

      mietpreise_value: toNumberOrNull(item.mietpreise_wert),
      mietpreise_yoy: toNumberOrNull(item.mietpreise_tendenz),
    }))
    .filter((r) => r.ortslage.length > 0);

  // Preisgrenzen
  const preisgrenzenImmobilieRaw = data.ortslagen_preisgrenzen_immobilie?.[0];
  const preisgrenzenGrundRaw = data.ortslagen_preisgrenzen_grundstueck?.[0];
  const preisgrenzenMieteRaw = data.ortslagen_preisgrenzen_miete?.[0];

  const preisgrenzenImmobilie: PreisgrenzenData | null = preisgrenzenImmobilieRaw
    ? {
        cheapestName: String(preisgrenzenImmobilieRaw["guenstigste_ortslage_immobilie"] ?? "").trim(),
        cheapestValue: toNumberOrNull(preisgrenzenImmobilieRaw["guenstigste_ortslage_immobilienpreis"]),
        priciestName: String(preisgrenzenImmobilieRaw["teuerste_ortslage_immobilie"] ?? "").trim(),
        priciestValue: toNumberOrNull(preisgrenzenImmobilieRaw["teuerste_ortslage_immobilienpreis"]),
      }
    : null;

  const preisgrenzenGrund: PreisgrenzenData | null = preisgrenzenGrundRaw
    ? {
        cheapestName: String(preisgrenzenGrundRaw["guenstigste_ortslage_grundstueck"] ?? "").trim(),
        cheapestValue: toNumberOrNull(preisgrenzenGrundRaw["guenstigste_ortslage_grundstueckspreis"]),
        priciestName: String(preisgrenzenGrundRaw["teuerste_ortslage_grundstueck"] ?? "").trim(),
        priciestValue: toNumberOrNull(preisgrenzenGrundRaw["teuerste_ortslage_grundstueckspreis"]),
      }
    : null;

  const preisgrenzenMiete: PreisgrenzenData | null = preisgrenzenMieteRaw
    ? {
        cheapestName: String(preisgrenzenMieteRaw["guenstigste_ortslage_miete"] ?? "").trim(),
        cheapestValue: toNumberOrNull(preisgrenzenMieteRaw["guenstigste_ortslage_mietpreis"]),
        priciestName: String(preisgrenzenMieteRaw["teuerste_ortslage_miete"] ?? "").trim(),
        priciestValue: toNumberOrNull(preisgrenzenMieteRaw["teuerste_ortslage_mietpreis"]),
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
