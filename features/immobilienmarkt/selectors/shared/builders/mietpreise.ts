import type { Report } from "@/lib/data";
import { toNumberOrNull } from "@/utils/toNumberOrNull";
import { getText } from "@/utils/getText";
import { asArray, asRecord, asString } from "@/utils/records";
import { formatRegionFallback, getRegionDisplayName } from "@/utils/regionName";
import { buildTableModel } from "@/utils/buildTableModel";
import { buildBarModel } from "@/utils/barModel";

import type {
  MietpreiseVM,
  ZeitreiheSeries,
  Zeitreihenpunkt,
} from "@/features/immobilienmarkt/selectors/shared/types/mietpreise";
import type { MietpreiseReportData } from "@/types/reports";

type UnknownRecord = Record<string, unknown>;

function pickMeta(report: Report): UnknownRecord {
  const meta = report.meta as unknown;
  const m0 = Array.isArray(meta) ? meta[0] : meta;
  return asRecord(m0) ?? {};
}

function toZeitreihe(raw: unknown, valueKey: string): Zeitreihenpunkt[] {
  const rows = asArray(raw)
    .map((item) => asRecord(item))
    .filter((row): row is UnknownRecord => Boolean(row));

  return rows
    .map((item) => ({
      jahr: Number(item["jahr"]),
      value: Number(item[valueKey]),
    }))
    .filter((p) => Number.isFinite(p.jahr) && Number.isFinite(p.value) && p.jahr > 1900)
    .sort((a, b) => a.jahr - b.jahr);
}

function buildSeries(raw: unknown, defs: Array<{ key: string; label: string; valueKey: string; color?: string }>): ZeitreiheSeries[] {
  return defs.flatMap((d) => {
    const points = toZeitreihe(raw, d.valueKey);
    return points.length ? [{ key: d.key, label: d.label, points, color: d.color }] : [];
  });
}

function parseYear(aktualisierung: unknown): string {
  const text = typeof aktualisierung === "string" ? aktualisierung : "";
  const match = text.match(/(\d{4})/);
  return match?.[1] ?? "2025";
}

export function buildMietpreiseVM(args: {
  report: Report<MietpreiseReportData>;
  level: "kreis" | "ort";
  bundeslandSlug: string;
  kreisSlug: string;
  ortSlug?: string;
}): MietpreiseVM {
  const { report, level, bundeslandSlug, kreisSlug, ortSlug } = args;

  const meta = pickMeta(report);
  const data = report.data ?? {};
  const text = asRecord(data["text"]) ?? {};
  const berater = asRecord(text["berater"]) ?? {};

  const regionName = getRegionDisplayName({
    meta,
    level: level === "ort" ? "ort" : "kreis",
    fallbackSlug: level === "ort" ? ortSlug ?? "ort" : kreisSlug,
  });

  const bundeslandNameRaw = asString(meta["bundesland_name"])?.trim();
  const bundeslandName = bundeslandNameRaw ? formatRegionFallback(bundeslandNameRaw) : undefined;
  const kreisNameRaw = asString(meta["kreis_name"])?.trim();
  const kreisName = kreisNameRaw ? formatRegionFallback(kreisNameRaw) : undefined;

  const isLandkreis = (kreisName ?? "").toLowerCase().includes("landkreis");
  
  const aktualisierung = asString(meta["aktualisierung"]);
  const jahrLabel = parseYear(aktualisierung);

  const teaser = getText(report, "text.mietpreise.mietpreise_intro", "");
  const ueberregionalText = getText(report, "text.mietpreise.mietpreise_allgemein", "");
  const wohnungText = getText(report, "text.mietpreise.mietpreise_wohnung_allgemein", "");
  const wohnungEntwicklungText = getText(report, "text.mietpreise.mietpreise_wohnung_preisentwicklung", "");
  const wohnungZimmerFlaechenText = getText(report, "text.mietpreise.mietpreise_wohnung_nach_flaechen_und_zimmern","",);
  const hausText = getText(report, "text.mietpreise.mietpreise_haus_allgemein", "");
  const hausEntwicklungText = getText(report, "text.mietpreise.mietpreise_haus_preisentwicklung", "");


  const beraterName =
    (typeof berater["berater_name"] === "string" ? berater["berater_name"] : undefined) ??
    "Lars Hofmann";
  const beraterTelefon =
    (typeof berater["berater_telefon"] === "string" ? berater["berater_telefon"] : undefined) ??
    "+49 351/287051-0";
  const beraterEmail =
    (typeof berater["berater_email"] === "string" ? berater["berater_email"] : undefined) ??
    "kontakt@wohnlagencheck24.de";
  const beraterTaetigkeit = `Standort- / Immobilienberatung – ${regionName}`;
  const beraterImageSrc = `/images/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/immobilienberatung-${kreisSlug}.png`;

  const mietpreiseGesamt = data.mietpreise_gesamt?.[0];

  const kaltmiete = toNumberOrNull(mietpreiseGesamt?.preis_kaltmiete);
  const nebenkosten = toNumberOrNull(mietpreiseGesamt?.preis_nebenkosten);
  const warmmiete = toNumberOrNull(mietpreiseGesamt?.preis_warmmiete);

  const mietpreisindexRegional = data.mietpreisindex_regional?.[0];
  const mietpreisindexWohnung = toNumberOrNull(mietpreisindexRegional?.mietpreisindex_wohnung);

  const ueberregionalRaw = asArray(data.mietpreise_im_ueberregionalen_vergleich);
  const ueberregionalRows = ueberregionalRaw
    .map((item) => asRecord(item))
    .filter((row): row is UnknownRecord => Boolean(row))
    .map((row) => {
      const label = String(row["preisinfo_label"] ?? "").trim().toLowerCase();
      if (label === "tendenz") {
        return { ...row, einheit: "percent" };
      }
      return row;
    });
  const ueberregionalModel =
    ueberregionalRows.length > 0
      ? buildTableModel(ueberregionalRows, {
          kind: "miete_qm",
          ctx: "table",
          mode: "keyValue",
          orientation: "transpose",
          rowLabelKey: "preisinfo_label",
          valueKey: "preis",
          rowLabelHeader: "",
          unitKeyFromRaw: (u) =>
            String(u) === "pricePerSqm" ? "eur_per_sqm" : String(u) === "percent" ? "percent" : "none",
        })
      : null;

  const wohnungGesamt = data.mietpreise_wohnung_gesamt?.[0];
  const wohnungMin = toNumberOrNull(wohnungGesamt?.preis_wohnung_min);
  const wohnungAvg = toNumberOrNull(wohnungGesamt?.preis_wohnung_avg);
  const wohnungMax = toNumberOrNull(wohnungGesamt?.preis_wohnung_max);

  const wohnungBaujahr = data.mietpreise_wohnung_nach_baujahr?.[0];
  const wohnungBaujahrBestand = toNumberOrNull(wohnungBaujahr?.kaltmiete_bestand);
  const wohnungBaujahrBestandVorjahr = toNumberOrNull(wohnungBaujahr?.kaltmiete_bestand_vorjahr);
  const wohnungBaujahrNeubau = toNumberOrNull(wohnungBaujahr?.kaltmiete_neubau);
  const wohnungBaujahrNeubauVorjahr = toNumberOrNull(wohnungBaujahr?.kaltmiete_neubau_vorjahr);

  const wohnungZimmerModel = Array.isArray(data.mietpreise_wohnung_nach_zimmern) && data.mietpreise_wohnung_nach_zimmern.length > 0
    ? buildBarModel(data.mietpreise_wohnung_nach_zimmern, {
        valueKind: "miete_qm",
        labelKey: "zimmer",
        seriesKeys: ["kaltmiete_vorjahr", "kaltmiete"],
        seriesLabelMap: {
          kaltmiete_vorjahr: "Vorjahr",
          kaltmiete: "Kaltmiete",
        },
      })
    : null;

  const wohnungFlaechenModel = Array.isArray(data.mietpreise_wohnung_nach_flaechen) && data.mietpreise_wohnung_nach_flaechen.length > 0
    ? buildBarModel(data.mietpreise_wohnung_nach_flaechen, {
        valueKind: "miete_qm",
        labelKey: "flaeche",
        seriesKeys: ["kaltmiete_vorjahr", "kaltmiete"],
        seriesLabelMap: {
          kaltmiete_vorjahr: "Vorjahr",
          kaltmiete: "Kaltmiete",
        },
      })
    : null;

  const labelKreis = kreisName ?? formatRegionFallback(kreisSlug ?? "kreis");
  const labelOrt = regionName;
  const labelBL = bundeslandName ?? formatRegionFallback(bundeslandSlug ?? "bundesland");
  const labelDE = "Deutschland";

  const wohnungEntwicklungSeries = buildSeries(data.mietpreisentwicklung_wohnung, [
    ...(level === "ort"
      ? [
          { key: "ol", label: labelOrt, valueKey: "preis_ol", color: "rgba(200, 213, 79, 1)" },
        ]
      : []),
    { key: "k", label: labelKreis, valueKey: "preis_k", color: "rgba(75, 192, 192, 1)" },
    { key: "bl", label: labelBL, valueKey: "preis_bl", color: "rgb(95, 132, 162)" },
    { key: "l", label: labelDE, valueKey: "preis_l", color: "rgb(54, 162, 235)" },
  ]);

  const hausEntwicklungSeries = buildSeries(data.mietpreisentwicklung_haus, [
    ...(level === "ort"
      ? [
          { key: "ol", label: labelOrt, valueKey: "preis_ol", color: "rgba(200, 213, 79, 1)" },
        ]
      : []),
    { key: "k", label: labelKreis, valueKey: "preis_k", color: "rgba(75, 192, 192, 1)" },
    { key: "bl", label: labelBL, valueKey: "preis_bl", color: "rgb(95, 132, 162)" },
    { key: "l", label: labelDE, valueKey: "preis_l", color: "rgb(54, 162, 235)" },
  ]);

  const hausGesamt = data.mietpreise_haus_gesamt?.[0];
  const hausMin = toNumberOrNull(hausGesamt?.preis_haus_min);
  const hausAvg = toNumberOrNull(hausGesamt?.preis_haus_avg);
  const hausMax = toNumberOrNull(hausGesamt?.preis_haus_max);

  const basePath =
    level === "ort" && ortSlug
      ? `/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/${ortSlug}`
      : `/immobilienmarkt/${bundeslandSlug}/${kreisSlug}`;

  const heroImageSrc = `/images/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/immobilienmarktbericht-${kreisSlug}.jpg`;

  const headlineMain =
    level === "ort"
      ? isLandkreis
        ? `Mietpreise ${jahrLabel} - ${regionName}`
        : `Mietpreise ${jahrLabel} - ${labelKreis} ${regionName}`
      : `Mietpreise ${jahrLabel} - ${regionName}`;

  const headlineWohnung =
    level === "ort"
      ? isLandkreis
        ? `Mietpreise für Wohnungen in ${regionName}`
        : `Mietpreise für Wohnungen in ${labelKreis} ${regionName}`
      : `Mietpreise für Wohnungen in ${regionName}`;

  const headlineHaus =
    level === "ort"
      ? isLandkreis
        ? `Mietpreise für Häuser in ${regionName}`
        : `Mietpreise für Häuser in ${labelKreis} ${regionName}`
      : `Mietpreise für Häuser in ${regionName}`;

  const headlineWohnungIndividuell =
    level === "kreis" ? getText(report, "text.ueberschriften_kreis.ueberschrift_mietpreise_wohnung", "") : "";
  const headlineHausIndividuell =
    level === "kreis" ? getText(report, "text.ueberschriften_kreis.ueberschrift_mietpreise_haus", "") : "";

  return {
    level,
    regionName,
    bundeslandName,
    basePath,
    updatedAt: aktualisierung,

    headlineMain,
    headlineWohnung,
    headlineHaus,
    headlineWohnungIndividuell: headlineWohnungIndividuell || undefined,
    headlineHausIndividuell: headlineHausIndividuell || undefined,

    teaser,
    ueberregionalText,
    wohnungText,
    wohnungEntwicklungText,
    wohnungZimmerFlaechenText,
    hausText,
    hausEntwicklungText,

    berater: {
      name: beraterName,
      telefon: beraterTelefon,
      email: beraterEmail,
      taetigkeit: beraterTaetigkeit,
      imageSrc: beraterImageSrc,
    },

    hero: {
      imageSrc: heroImageSrc,
      title: regionName,
      subtitle: "regionaler Standortberater",
    },

    kpis: { kaltmiete, nebenkosten, warmmiete },
    mietpreisindexWohnung,
    ueberregionalModel,

    wohnungMin,
    wohnungAvg,
    wohnungMax,

    wohnungBaujahrBestand,
    wohnungBaujahrBestandVorjahr,
    wohnungBaujahrNeubau,
    wohnungBaujahrNeubauVorjahr,

    wohnungZimmerModel,
    wohnungFlaechenModel,
    wohnungEntwicklungSeries,

    hausMin,
    hausAvg,
    hausMax,
    hausEntwicklungSeries,
  };
}
