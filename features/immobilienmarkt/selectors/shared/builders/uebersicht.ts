// features/immobilienmarkt/selectors/shared/builders/uebersicht.ts

import type { Report } from "@/lib/data";
import { toNumberOrNull } from "@/utils/toNumberOrNull";
import { getText } from "@/utils/getText";
import { asArray, asRecord, asString } from "@/utils/records";
import { formatRegionFallback } from "@/utils/regionName";
import type { UebersichtReportData } from "@/types/reports";
import type { UnitKey } from "@/utils/format";
import { getRegionDisplayName } from "@/utils/regionName";

import type {
  UebersichtVM,
  UebersichtLevel,
  VergleichItem,
  Zeitreihenpunkt,
  Preisgrenze,
} from "../types/uebersicht";

/**
 * Meta ist bei euch teils Object, teils Array (Ortsebene).
 * Kreis/Bundesland: Object.
 */
function pickMeta(report: Report): Record<string, unknown> {
  const meta = report.meta as unknown;
  const m0 = Array.isArray(meta) ? meta[0] : meta;
  return asRecord(m0) ?? {};
}

function parseYear(aktualisierung: unknown): string {
  const text = typeof aktualisierung === "string" ? aktualisierung : "";
  const match = text.match(/(\d{4})/);
  return match?.[1] ?? "2025";
}

function formatEuroPerSqm(val: number | null): string {
  if (val === null || !Number.isFinite(val)) return "";
  const nf = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });
  return `${nf.format(val)} €/m²`;
}

function safeTrim(value: unknown): string {
  return String(value ?? "").trim();
}

/**
 * Vergleich: alte Logik 1:1, nur in den neuen VergleichItem-Shape gegossen:
 * - label statt region
 * - value kann null sein, wir filtern nicht aggressiv weg
 */
function toVergleichItems(raw: unknown, valueKey: string): VergleichItem[] {
  const arr = asArray(raw)
    .map((item) => asRecord(item))
    .filter((row): row is Record<string, unknown> => Boolean(row));
  return arr
    .map((item) => {
      const label = safeTrim(item["region"]);
      const v = toNumberOrNull(item[valueKey]);
      return {
        label: label || "Region",
        value: v,
        kind: undefined,
        unitKey: "eur_per_sqm" as UnitKey,
      };
    })
    .filter((x) => !!x.label); // label ist immer gesetzt, aber safe
}

/**
 * Zeitreihe: alte Logik 1:1 (valueKey fix wie im Bestand)
 */
function toZeitreihe(raw: unknown, valueKey: string): Zeitreihenpunkt[] {
  const arr = asArray(raw)
    .map((item) => asRecord(item))
    .filter((row): row is Record<string, unknown> => Boolean(row));

  return arr
    .map((item) => ({
      jahr: Number(item["jahr"]),
      value: Number(item[valueKey]),
    }))
    .filter((p) => Number.isFinite(p.jahr) && Number.isFinite(p.value) && p.jahr > 1900)
    .sort((a, b) => a.jahr - b.jahr);
}

function buildPreisgrenzeFromOld(raw: unknown, args: {
  cheapestNameKey: string;
  cheapestValueKey: string;
  priciestNameKey: string;
  priciestValueKey: string;
}): Preisgrenze | null {
  const rec = asRecord(raw);
  if (!rec) return null;

  const cheapestName = safeTrim(rec[args.cheapestNameKey]);
  const priciestName = safeTrim(rec[args.priciestNameKey]);

  const cheapestValue = toNumberOrNull(rec[args.cheapestValueKey]);
  const priciestValue = toNumberOrNull(rec[args.priciestValueKey]);

  if (!cheapestName && !priciestName) return null;

  return {
    cheapestName: cheapestName || "Günstig",
    cheapestValue,
    priciestName: priciestName || "Teuer",
    priciestValue,
  };
}

function normalizeText(v: unknown): string {
  return safeTrim(v);
}

export function buildUebersichtVM(args: {
  report: Report<UebersichtReportData>;
  level: UebersichtLevel;
  bundeslandSlug?: string;
  kreisSlug?: string;
}): UebersichtVM {
  const { report, level, bundeslandSlug, kreisSlug } = args;

  const meta = pickMeta(report);
  const data = report.data ?? {};
  const text = data.text ?? {};
  const berater = text.berater ?? {};

  // Region Name: robustes Fallback auf Kreis/Bundesland-Slug
  const regionName = getRegionDisplayName({
    meta,
    level: level === "bundesland" ? "bundesland" : level === "kreis" ? "kreis" : "deutschland",
    fallbackSlug: level === "kreis" ? kreisSlug : level === "bundesland" ? bundeslandSlug : undefined,
  });

  const bundeslandNameRaw = String(meta["bundesland_name"] ?? "").trim();
  const bundeslandName = bundeslandNameRaw ? formatRegionFallback(bundeslandNameRaw) : "";

  // basePath
  let basePath = "/immobilienmarkt";
  if (level === "bundesland" && bundeslandSlug) basePath += `/${bundeslandSlug}`;
  if (level === "kreis" && bundeslandSlug && kreisSlug) basePath += `/${bundeslandSlug}/${kreisSlug}`;

  // Hero image: wie im Bestand (nur dort, wo Pfade existieren)
  const heroImageSrc =
    level === "kreis" && bundeslandSlug && kreisSlug
      ? `/images/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/immobilienmarktbericht-${kreisSlug}.jpg`
      : level === "bundesland" && bundeslandSlug
        ? `/images/immobilienmarkt/${bundeslandSlug}/immobilienmarktbericht-${bundeslandSlug}.jpg`
        : level === "deutschland"
          ? `/images/immobilienmarkt/deutschland/immobilienmarktbericht-deutschland.jpg`
          : undefined;

  
  const aktualisierung = asString(meta["aktualisierung"]);
  const jahrLabel = parseYear(aktualisierung);
  const updatedAt = aktualisierung || undefined;
  
  
  
  /**
   * TEXTE: ausschließlich euer Schema (Altbestand)
   */
  const teaser = getText(report, "text.immobilienmarkt_ueberblick.immobilienmarkt_allgemein", "");
  const teaserText = normalizeText(teaser);
  
  const standortTeaser = getText(report, "text.immobilienmarkt_ueberblick.immobilienmarkt_standort_teaser", "");
  const individual01 = getText(report, "text.immobilienmarkt_ueberblick.immobilienmarkt_individuell_01", "");
  const zitat = getText(report, "text.immobilienmarkt_ueberblick.immobilienmarkt_zitat", "");
  const individual02 = getText(report, "text.immobilienmarkt_ueberblick.immobilienmarkt_individuell_02", "");
  const beschreibung01 = getText(report, "text.immobilienmarkt_ueberblick.immobilienmarkt_beschreibung_01", "");
  const beschreibung02 = getText(report, "text.immobilienmarkt_ueberblick.immobilienmarkt_beschreibung_02", "");
  const marketBasicKnowledge = getText(report, "text.immobilienmarkt_ueberblick.immobilienmarkt_besonderheiten", "");
  const agentSuggest = getText(report, "text.immobilienmarkt_ueberblick.immobilienmarkt_maklerempfehlung", "");


  const headlineMain = `Standort & Immobilienmarkt - ${jahrLabel} ${regionName}`
  
  
  
     

  /**
   * Berater: im Bestand aus data.text.berater.* (nicht meta)
   * -> VM hat nur name/taetigkeit/imageSrc
   */
  const beraterName =
    (typeof berater.berater_name === "string" ? berater.berater_name : undefined) ??
    "Lars Hofmann";

  const beraterTaetigkeit = `Standort- / Immobilienberatung – ${regionName}`;

  const beraterImageSrc =
    (bundeslandSlug && (kreisSlug || level === "bundesland"))
      ? `/images/immobilienmarkt/${bundeslandSlug}/${kreisSlug || bundeslandSlug}/immobilienberatung-${kreisSlug || bundeslandSlug}.png`
      : undefined;

  /**
   * Tachowerte:
   * In deiner neuen shared-Version kommen die aus data.immobilienmarkt_situation bzw marktspannung.
   * Im alten Kreis-Selector waren sie statisch (20/-15).
   * -> Wir lesen, falls vorhanden; sonst Fallback wie im Bestand.
   */
  const kaufmarktValue =
    toNumberOrNull(data.immobilienmarkt_situation?.[0]?.kaufmarkt_value) ??
    toNumberOrNull(data.marktspannung?.[0]?.kaufmarkt_value) ??
    20;

  const mietmarktValue =
    toNumberOrNull(data.immobilienmarkt_situation?.[0]?.mietmarkt_value) ??
    toNumberOrNull(data.marktspannung?.[0]?.mietmarkt_value) ??
    -15;

  /**
   * Standortindikatoren: wie im Bestand
   */
  const standortAllgemein = data.standort_allgemein?.[0];

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

  /**
   * KPI: wie im Bestand (Kreis-Keys)
   */
  const immobilienKaufpreis = data.immobilien_kaufpreis?.[0];
  const grundstueckKaufpreis = data.grundstueck_kaufpreis?.[0];
  const mietpreiseGesamt = data.mietpreise_gesamt?.[0];

  const kaufpreis = toNumberOrNull(immobilienKaufpreis?.kaufpreis_immobilien);
  const grundstueckspreis = toNumberOrNull(grundstueckKaufpreis?.kaufpreis_grundstueck);
  const kaltmiete = toNumberOrNull(mietpreiseGesamt?.preis_kaltmiete);

  /**
   * KPI Labels: einfacher €/m² Formatter (wie du es im shared Builder schon machst)
   * Wenn du zwingend formatMetric brauchst, kann man das später vereinheitlichen.
   */
  const kaufpreisLabel = formatEuroPerSqm(kaufpreis);
  const grundstueckLabel = formatEuroPerSqm(grundstueckspreis);
  const kaltmieteLabel = formatEuroPerSqm(kaltmiete);

  /**
   * Vergleich: wie im Bestand
   */
  const vergleichImmobilien = toVergleichItems(data.immobilienpreise_ueberregionaler_vergleich, "immobilienpreis");
  const vergleichGrundstueck = toVergleichItems(data.grundstueckspreise_ueberregionaler_vergleich, "grundstueckspreis");
  const vergleichMiete = toVergleichItems(data.mietpreise_ueberregionaler_vergleich, "kaltmiete");

  /**
   * Historien: wie im Bestand (valueKeys!)
   */
  const historienImmobilien = toZeitreihe(data.immobilie_kaufpreisentwicklung, "kaufpreisentwicklung_immobilie");
  const historienGrundstueck = toZeitreihe(data.grundstueck_kaufpreisentwicklung, "kaufpreisentwicklung_grundstueck");
  const historienMiete = toZeitreihe(data.immobilie_mietpreisentwicklung, "mietpreisentwicklung_immobilie");

  /**
   * Preisindex: wie im Bestand
   */
  const basisjahrRaw = data.basisjahr?.[0];
  const preisindexRaw = data.preisindex?.[0];

  const basisjahrImmobilien = toNumberOrNull(basisjahrRaw?.basisjahr_immobilienpreisindex);
  const basisjahrGrundstueck = toNumberOrNull(basisjahrRaw?.basisjahr_grundstueckspreisindex);
  const basisjahrMiete = toNumberOrNull(basisjahrRaw?.basisjahr_mietpreisindex);

  const indexImmobilien = toNumberOrNull(preisindexRaw?.immobilienpreisindex);
  const indexGrundstueck = toNumberOrNull(preisindexRaw?.grundstueckspreisindex);
  const indexMiete = toNumberOrNull(preisindexRaw?.mietpreisindex);

  /**
   * Ortslagen-Übersicht: wie im Bestand
   * -> wir geben exakt das zurück, was die Table erwartet.
   */
  const ortslagenUebersichtRaw = data.ortslagen_uebersicht ?? [];
  const ortslagenUebersicht = ortslagenUebersichtRaw
    .filter((item) => {
      const k = String(item.kreis ?? "").toLowerCase();
      return !k || (kreisSlug ? k === String(kreisSlug).toLowerCase() : true);
    })
    .map((item) => ({
      ortslage: safeTrim(item.ortslage),

      immobilienpreise_value: toNumberOrNull(item.immobilienpreise_wert),
      immobilienpreise_yoy: toNumberOrNull(item.immobilienpreise_tendenz),

      grundstueckspreise_value: toNumberOrNull(item.grundstueckspreise_wert),
      grundstueckspreise_yoy: toNumberOrNull(item.grundstueckspreise_tendenz),

      mietpreise_value: toNumberOrNull(item.mietpreise_wert),
      mietpreise_yoy: toNumberOrNull(item.mietpreise_tendenz),
    }))
    .filter((r) => typeof r.ortslage === "string" && r.ortslage.length > 0);

  /**
   * Preisgrenzen: wie im Bestand
   */
  const preisgrenzenImmobilieRaw = data.ortslagen_preisgrenzen_immobilie?.[0];
  const preisgrenzenGrundRaw = data.ortslagen_preisgrenzen_grundstueck?.[0];
  const preisgrenzenMieteRaw = data.ortslagen_preisgrenzen_miete?.[0];

  const preisgrenzen = {
    immobilie: buildPreisgrenzeFromOld(preisgrenzenImmobilieRaw, {
      cheapestNameKey: "guenstigste_ortslage_immobilie",
      cheapestValueKey: "guenstigste_ortslage_immobilienpreis",
      priciestNameKey: "teuerste_ortslage_immobilie",
      priciestValueKey: "teuerste_ortslage_immobilienpreis",
    }),
    grund: buildPreisgrenzeFromOld(preisgrenzenGrundRaw, {
      cheapestNameKey: "guenstigste_ortslage_grundstueck",
      cheapestValueKey: "guenstigste_ortslage_grundstueckspreis",
      priciestNameKey: "teuerste_ortslage_grundstueck",
      priciestValueKey: "teuerste_ortslage_grundstueckspreis",
    }),
    miete: buildPreisgrenzeFromOld(preisgrenzenMieteRaw, {
      cheapestNameKey: "guenstigste_ortslage_miete",
      cheapestValueKey: "guenstigste_ortslage_mietpreis",
      priciestNameKey: "teuerste_ortslage_miete",
      priciestValueKey: "teuerste_ortslage_mietpreis",
    }),
  };

  /**
   * Bilder: wie im Bestand, aber optional, weil nicht überall vorhanden
   */
  const teaserImage =
    level === "kreis" && bundeslandSlug && kreisSlug
      ? `/images/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/immobilienmarktbericht-${kreisSlug}-preview.jpg`
      : level === "bundesland" && bundeslandSlug
        ? `/images/immobilienmarkt/${bundeslandSlug}/immobilienmarktbericht-${bundeslandSlug}-preview.jpg`
        : undefined;

  const agentSuggestImage =
    bundeslandSlug && kreisSlug
      ? `/images/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/makler-${kreisSlug}-logo.jpg`
      : undefined;

  return {
    level,
    regionName,
    bundeslandName: bundeslandName || undefined,
    kreisName: level === "kreis" ? regionName : undefined,

    basePath,

    hero: {
      title: regionName,
      subtitle: "regionaler Standortberater",
      imageSrc: heroImageSrc,

      kaufmarktValue: Number.isFinite(kaufmarktValue) ? kaufmarktValue : 0,
      mietmarktValue: Number.isFinite(mietmarktValue) ? mietmarktValue : 0,
    },

    berater: {
      name: safeTrim(beraterName) || "Lars Hofmann",
      taetigkeit: normalizeText(beraterTaetigkeit),
      imageSrc: beraterImageSrc,
    },

    updatedAt,
    headlineMain,
    teaser: teaserText,

    images: {
      teaserImage,
      agentSuggestImage,
    },

    texts: {
      teaser: teaserText,
      standortTeaser: normalizeText(standortTeaser),

      individual01: normalizeText(individual01),
      zitat: normalizeText(zitat),
      individual02: normalizeText(individual02),

      beschreibung01: normalizeText(beschreibung01),
      beschreibung02: normalizeText(beschreibung02),

      marketBasicKnowledge: normalizeText(marketBasicKnowledge),
      agentSuggest: normalizeText(agentSuggest),
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
      immobilien: vergleichImmobilien,
      grundstueck: vergleichGrundstueck,
      miete: vergleichMiete,
    },

    historien: {
      immobilien: historienImmobilien,
      grundstueck: historienGrundstueck,
      miete: historienMiete,
    },

    preisindex: {
      indexImmobilien,
      basisjahrImmobilien,

      indexGrundstueck,
      basisjahrGrundstueck,

      indexMiete,
      basisjahrMiete,
    },

    ortslagenUebersicht,

    preisgrenzen,
  };
}
