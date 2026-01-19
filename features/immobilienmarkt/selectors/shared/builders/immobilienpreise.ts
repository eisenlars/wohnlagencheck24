// features/immobilienmarkt/selectors/shared/builders/immobilienpreise.ts

import type { Report } from "@/lib/data";
import { toNumberOrNull } from "@/utils/toNumberOrNull";
import { getText } from "@/utils/getText";
import { buildTableModel } from "@/utils/buildTableModel";
import { buildBarModel } from "@/utils/barModel";
import { asArray, asRecord, asString } from "@/utils/records";
import { formatRegionFallback, getRegionDisplayName } from "@/utils/regionName";
import type { ImmobilienpreiseReportData } from "@/types/reports";

import type { ImmobilienpreiseVM, Zeitreihenpunkt, ZeitreiheSeries } from "../types/immobilienpreise";

type UnknownRecord = Record<string, unknown>;

function pickMeta(report: Report<ImmobilienpreiseReportData>): UnknownRecord {
  const meta = report.meta as unknown;
  const picked = Array.isArray(meta) ? meta[0] : meta;
  return asRecord(picked) ?? {};
}

function parseYear(aktualisierung: unknown): string {
  const text = typeof aktualisierung === "string" ? aktualisierung : "";
  const match = text.match(/(\d{4})/);
  return match?.[1] ?? "2025";
}

function toZeitreihe(raw: unknown, valueKey: string): Zeitreihenpunkt[] {
  const rows = asArray(raw)
    .map((item) => asRecord(item))
    .filter((row): row is Record<string, unknown> => Boolean(row));

  return rows
    .map((item) => ({
      jahr: Number(item["jahr"]),
      value: Number(item[valueKey]),
    }))
    .filter((p) => Number.isFinite(p.jahr) && Number.isFinite(p.value) && p.jahr > 1900)
    .sort((a, b) => a.jahr - b.jahr);
}

function normalizeText(s: unknown): string {
  return String(s ?? "").trim();
}

function buildSeriesTriplet(args: {
  region: Zeitreihenpunkt[];
  bundesland: Zeitreihenpunkt[];
  deutschland: Zeitreihenpunkt[];
  labelRegion: string;
  labelBL: string;
  labelDE: string;
}): ZeitreiheSeries[] {
  const { region, bundesland, deutschland, labelRegion, labelBL, labelDE } = args;

  const series: ZeitreiheSeries[] = [
    { key: "region", label: labelRegion, points: region ?? [] },
    { key: "bundesland", label: labelBL, points: bundesland ?? [] },
    { key: "deutschland", label: labelDE, points: deutschland ?? [] },
  ];

  return series.filter((s) => Array.isArray(s.points) && s.points.length > 0);
}

export function buildImmobilienpreiseVM(args: {
  report: Report<ImmobilienpreiseReportData>;
  level: "kreis" | "ort";
  bundeslandSlug: string;
  kreisSlug: string;
  ortSlug?: string;
}): ImmobilienpreiseVM {
  const { report, level, bundeslandSlug, kreisSlug, ortSlug } = args;

  const meta = pickMeta(report);
  const data = report.data ?? {};
  const text = asRecord(data["text"]) ?? {};
  const beraterRecord = asRecord(text["berater"]) ?? {};

  const regionName = getRegionDisplayName({
    meta,
    level: level === "ort" ? "ort" : "kreis",
    fallbackSlug: level === "ort" ? ortSlug ?? "ort" : kreisSlug,
  });

  const bundeslandNameRaw = asString(meta["bundesland_name"])?.trim();
  const bundeslandName = bundeslandNameRaw ? formatRegionFallback(bundeslandNameRaw) : undefined;
  const kreisNameRaw = asString(meta["kreis_name"])?.trim();
  const kreisName = kreisNameRaw ? formatRegionFallback(kreisNameRaw) : undefined;

  const basePath =
    level === "ort" && ortSlug
      ? `/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/${ortSlug}`
      : `/immobilienmarkt/${bundeslandSlug}/${kreisSlug}`;

  const aktualisierung = asString(meta["aktualisierung"]);
  const jahrLabel = parseYear(aktualisierung);
  const isLandkreis = (kreisName ?? "").toLowerCase().includes("landkreis");
  const labelKreis = kreisName ?? formatRegionFallback(kreisSlug ?? "kreis");
  const headlineMain =
    level === "ort"
      ? isLandkreis
        ? `Immobilienpreise ${jahrLabel} - ${regionName}`
        : `Immobilienpreise ${jahrLabel} - ${labelKreis} ${regionName}`
      : `Immobilienpreise ${jahrLabel} - ${regionName}`;
  const updatedAt = aktualisierung?.trim() ? aktualisierung : undefined;

  const teaser = getText(report, "text.immobilienpreise.immobilienpreise_intro", "");

  const ueberschriftHausIndividuell = getText(
    report,
    "text.ueberschriften_kreis.ueberschrift_immobilienpreise_haus",
    "",
  );
  const ueberschriftWohnungIndividuell = getText(
    report,
    "text.ueberschriften_kreis.ueberschrift_immobilienpreise_wohnung",
    "",
  );

  const hauspreiseIntro = getText(report, "text.immobilienpreise.immobilienpreise_haus_intro", "");
  const hausVergleichIntro = getText(report, "text.immobilienpreise.immobilienpreise_haus_allgemein", "");
  const textHausLage = getText(report, "text.immobilienpreise.immobilienpreise_haus_lage", "");
  const textHausKaufpreisentwicklung = getText(
    report,
    "text.immobilienpreise.immobilienpreise_haus_preisentwicklung",
    "",
  );
  const textHaustypen = getText(report, "text.immobilienpreise.immobilienpreise_haus_haustypen", "");

  const wohnungspreiseIntro = getText(report, "text.immobilienpreise.immobilienpreise_wohnung_intro", "");
  const wohnungVergleichIntro = getText(report, "text.immobilienpreise.immobilienpreise_wohnung_allgemein", "");
  const textWohnungLage = getText(report, "text.immobilienpreise.immobilienpreise_wohnung_lage", "");
  const textWohnungKaufpreisentwicklung = getText(
    report,
    "text.immobilienpreise.immobilienpreise_wohnung_preisentwicklung",
    "",
  );
  const textWohnungZimmerFlaechen = getText(
    report,
    "text.immobilienpreise.immobilienpreise_wohnung_nach_flaechen_und_zimmern",
    "",
  );

  const beraterName =
    (typeof beraterRecord["berater_name"] === "string" ? beraterRecord["berater_name"] : undefined) ??
    "Lars Hofmann";
  const beraterTelefon =
    (typeof beraterRecord["berater_telefon"] === "string" ? beraterRecord["berater_telefon"] : undefined) ??
    "+49 351/287051-0";
  const beraterEmail =
    (typeof beraterRecord["berater_email"] === "string" ? beraterRecord["berater_email"] : undefined) ??
    "kontakt@wohnlagencheck24.de";
  const beraterTaetigkeit = `Standort- / Immobilienberatung – ${regionName}`;
  const beraterImageSrc = `/images/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/immobilienberatung-${kreisSlug}.png`;

  const immobilienKaufpreis = data.immobilien_kaufpreis?.[0];
  const kaufpreisQm = toNumberOrNull(immobilienKaufpreis?.kaufpreis_immobilien);

  const hausPreisspanne = data.haus_kaufpreisspanne?.[0];
  const hausMin = toNumberOrNull(hausPreisspanne?.preis_haus_min);
  const hausAvg = toNumberOrNull(hausPreisspanne?.preis_haus_avg);
  const hausMax = toNumberOrNull(hausPreisspanne?.preis_haus_max);

  const preisindexRegionalRaw = data.immobilienpreisindex_regional?.[0];
  const indexHaus = toNumberOrNull(preisindexRegionalRaw?.immobilienpreisindex_haus);

  const wohnungPreisspanne = data.wohnung_kaufpreisspanne?.[0];
  const wohnungMin = toNumberOrNull(wohnungPreisspanne?.preis_wohnung_min);
  const wohnungAvg = toNumberOrNull(wohnungPreisspanne?.preis_wohnung_avg);
  const wohnungMax = toNumberOrNull(wohnungPreisspanne?.preis_wohnung_max);

  const indexWohnung = toNumberOrNull(preisindexRegionalRaw?.immobilienpreisindex_wohnung);

  const ueberregionalRawHaus = data.haus_kaufpreise_im_ueberregionalen_vergleich ?? [];
  const ueberregionalModelHaus =
    Array.isArray(ueberregionalRawHaus) && ueberregionalRawHaus.length > 0
      ? buildTableModel(ueberregionalRawHaus, {
          kind: "kaufpreis_qm",
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

  const lageRawHaus = data.haus_kaufpreise_lage ?? [];
  const lageModelHaus =
    Array.isArray(lageRawHaus) && lageRawHaus.length > 0
      ? buildTableModel(lageRawHaus, {
          kind: "kaufpreis_qm",
          ctx: "table",
          mode: "matrix",
          orientation: "transpose",
          rowLabelKey: "preisinfo_label",
          rowLabelHeader: "Lagequalität",
          columnLabelMap: {
            preis_einfache_lage: "Einfach",
            preis_mittlere_lage: "Mittel",
            preis_gute_lage: "Gut",
            preis_sehr_gute_lage: "Sehr gut",
            preis_top_lage: "Top",
          },
          unitKeyFromRaw: (u) => (String(u) === "pricePerSqm" ? "eur_per_sqm" : "none"),
        })
      : null;

  const haustypRaw = data.haus_kaufpreis_haustypen ?? [];
  const haustypModel =
    Array.isArray(haustypRaw) && haustypRaw.length > 0
      ? buildTableModel(haustypRaw, {
          kind: "kaufpreis_qm",
          ctx: "table",
          mode: "matrix",
          orientation: "transpose",
          rowLabelKey: "preisinfo_label",
          rowLabelHeader: "Haustyp",
          columnLabelMap: {
            reihenhaus: "Reihenhaus",
            doppelhaushaelfte: "Doppelhaushälfte",
            einfamilienhaus: "Einfamilienhaus",
          },
          unitKeyFromRaw: (u) => (String(u) === "pricePerSqm" ? "eur_per_sqm" : "none"),
        })
      : null;

  const ueberregionalRawWohnung = data.wohnung_kaufpreise_im_ueberregionalen_vergleich ?? [];
  const ueberregionalModelWohnung =
    Array.isArray(ueberregionalRawWohnung) && ueberregionalRawWohnung.length > 0
      ? buildTableModel(ueberregionalRawWohnung, {
          kind: "kaufpreis_qm",
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

  const lageRawWohnung = data.wohnung_kaufpreise_lage ?? [];
  const lageModelWohnung =
    Array.isArray(lageRawWohnung) && lageRawWohnung.length > 0
      ? buildTableModel(lageRawWohnung, {
          kind: "kaufpreis_qm",
          ctx: "table",
          mode: "matrix",
          orientation: "transpose",
          rowLabelKey: "preisinfo_label",
          rowLabelHeader: "Lagequalität",
          columnLabelMap: {
            preis_einfache_lage: "Einfach",
            preis_mittlere_lage: "Mittel",
            preis_gute_lage: "Gut",
            preis_sehr_gute_lage: "Sehr gut",
            preis_top_lage: "Top",
          },
          unitKeyFromRaw: (u) => (String(u) === "pricePerSqm" ? "eur_per_sqm" : "none"),
        })
      : null;

  const hausKaufpreisentwicklungRaw = data.haus_kaufpreisentwicklung ?? [];
  const wohnungKaufpreisentwicklungRaw = data.wohnung_kaufpreisentwicklung ?? [];

  const hausRegion = toZeitreihe(hausKaufpreisentwicklungRaw, "preis_k");
  const hausBL = toZeitreihe(hausKaufpreisentwicklungRaw, "preis_bl");
  const hausDE = toZeitreihe(hausKaufpreisentwicklungRaw, "preis_l");

  const wohnRegion = toZeitreihe(wohnungKaufpreisentwicklungRaw, "preis_k");
  const wohnBL = toZeitreihe(wohnungKaufpreisentwicklungRaw, "preis_bl");
  const wohnDE = toZeitreihe(wohnungKaufpreisentwicklungRaw, "preis_l");

  const hausKaufpreisentwicklungSeries = buildSeriesTriplet({
    region: hausRegion,
    bundesland: hausBL,
    deutschland: hausDE,
    labelRegion: regionName,
    labelBL: bundeslandName ?? formatRegionFallback(bundeslandSlug ?? "bundesland"),
    labelDE: "Deutschland",
  });

  const wohnungKaufpreisentwicklungSeries = buildSeriesTriplet({
    region: wohnRegion,
    bundesland: wohnBL,
    deutschland: wohnDE,
    labelRegion: regionName,
    labelBL: bundeslandName ?? formatRegionFallback(bundeslandSlug ?? "bundesland"),
    labelDE: "Deutschland",
  });

  const wohnungZimmerRaw = data.wohnung_kaufpreise_nach_zimmern ?? [];
  const wohnungFlaechenRaw = data.wohnung_kaufpreise_nach_flaechen ?? [];

  const wohnungZimmerModel =
    Array.isArray(wohnungZimmerRaw) && wohnungZimmerRaw.length > 0
      ? buildBarModel(wohnungZimmerRaw, {
          valueKind: "kaufpreis_qm",
          labelKey: "zimmer",
          seriesKeys: ["preis", "preis_vorjahr"],
          seriesLabelMap: { preis: "Aktuell", preis_vorjahr: "Vorjahr" },
        })
      : null;

  const wohnungFlaechenModel =
    Array.isArray(wohnungFlaechenRaw) && wohnungFlaechenRaw.length > 0
      ? buildBarModel(wohnungFlaechenRaw, {
          valueKind: "kaufpreis_qm",
          labelKey: "flaeche",
          seriesKeys: ["preis", "preis_vorjahr"],
          seriesLabelMap: { preis: "Aktuell", preis_vorjahr: "Vorjahr" },
        })
      : null;

  return {
    level,
    regionName,
    bundeslandName,
    basePath,
    updatedAt,
    headlineMain,
    teaser: normalizeText(teaser),
    berater: {
      name: beraterName,
      taetigkeit: beraterTaetigkeit,
      imageSrc: beraterImageSrc,
      telefon: beraterTelefon,
      email: beraterEmail,
    },

    ueberschriftHausIndividuell: normalizeText(ueberschriftHausIndividuell),
    hauspreiseIntro: normalizeText(hauspreiseIntro),
    hausVergleichIntro: normalizeText(hausVergleichIntro),
    textHausLage: normalizeText(textHausLage),
    textHausKaufpreisentwicklung: normalizeText(textHausKaufpreisentwicklung),
    textHaustypen: normalizeText(textHaustypen),

    ueberschriftWohnungIndividuell: normalizeText(ueberschriftWohnungIndividuell),
    wohnungspreiseIntro: normalizeText(wohnungspreiseIntro),
    wohnungVergleichIntro: normalizeText(wohnungVergleichIntro),
    textWohnungLage: normalizeText(textWohnungLage),
    textWohnungKaufpreisentwicklung: normalizeText(textWohnungKaufpreisentwicklung),
    textWohnungZimmerFlaechen: normalizeText(textWohnungZimmerFlaechen),

    kaufpreisQm,

    hausMin,
    hausAvg,
    hausMax,
    indexHaus,

    wohnungMin,
    wohnungAvg,
    wohnungMax,
    indexWohnung,

    ueberregionalModelHaus,
    lageModelHaus,
    haustypModel,

    ueberregionalModelWohnung,
    lageModelWohnung,

    hausKaufpreisentwicklungSeries,
    wohnungKaufpreisentwicklungSeries,

    wohnungZimmerModel,
    wohnungFlaechenModel,
  };
}
