// features/immobilienmarkt/selectors/ort/immobilienpreise.ts

import type { Report } from "@/lib/data";
import { toNumberOrNull } from "@/utils/toNumberOrNull";
import { getText } from "@/utils/getText";
import { asArray, asRecord, asString } from "@/utils/records";
import type { ImmobilienpreiseReportData } from "@/types/reports";

import { buildTableModel } from "@/utils/buildTableModel";
type TableModel = ReturnType<typeof buildTableModel>;

import { buildBarModel } from "@/utils/barModel";
import type { BarModel } from "@/utils/barModel";

/**
 * WICHTIG:
 * - Keine type-imports aus Client-Komponenten (z.B. VergleichChart/ZeitreiheChart),
 *   um Turbopack-Chunk-Probleme zu vermeiden.
 * - Lokale Typen (Shape) reichen völlig.
 */
export type Zeitreihenpunkt = { jahr: number; value: number };
export type ZeitreiheSeries = { key: string; label: string; points: Zeitreihenpunkt[] };

export type OrtImmobilienpreiseVM = {
  ortName: string;
  kreisName?: string;
  bundeslandName?: string;
  basePath: string;

  // Texte/Überschriften in der Form, wie die Section sie nutzt
  teaserImmobilienpreise: string;

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

  // Leitkennzahl
  kaufpreisQm: number | null;

  // Haus: Preisspanne
  hausMin: number | null;
  hausAvg: number | null;
  hausMax: number | null;
  indexHaus: number | null;

  // Wohnung: Preisspanne
  wohnungMin: number | null;
  wohnungAvg: number | null;
  wohnungMax: number | null;
  indexWohnung: number | null;

  // MatrixTable-Modelle
  ueberregionalModelHaus: TableModel | null;
  lageModelHaus: TableModel | null;
  haustypModel: TableModel | null;

  ueberregionalModelWohnung: TableModel | null;
  lageModelWohnung: TableModel | null;

  // Zeitreihen (ZeitreiheChart)
  hausKaufpreisentwicklungSeries: ZeitreiheSeries[];
  wohnungKaufpreisentwicklungSeries: ZeitreiheSeries[];

  // Bar-Charts (VergleichBarChart)
  wohnungZimmerModel: BarModel | null;
  wohnungFlaechenModel: BarModel | null;
};

/** ---------- Helper ---------- */

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
  ort: Zeitreihenpunkt[];
  bundesland: Zeitreihenpunkt[];
  deutschland: Zeitreihenpunkt[];
  labelOrt: string;
  labelBL: string;
  labelDE: string;
}): ZeitreiheSeries[] {
  const { ort, bundesland, deutschland, labelOrt, labelBL, labelDE } = args;

  const series: ZeitreiheSeries[] = [
    { key: "ort", label: labelOrt, points: ort ?? [] },
    { key: "bundesland", label: labelBL, points: bundesland ?? [] },
    { key: "deutschland", label: labelDE, points: deutschland ?? [] },
  ];

  return series.filter((s) => Array.isArray(s.points) && s.points.length > 0);
}

/** ---------- Builder ---------- */

export function buildOrtImmobilienpreiseVM(args: {
  report: Report<ImmobilienpreiseReportData>;
  bundeslandSlug: string;
  kreisSlug: string;
  ortSlug: string;
}): OrtImmobilienpreiseVM {
  const { report, bundeslandSlug, kreisSlug, ortSlug } = args;

  const meta = asRecord(report.meta) ?? {};
  const data = report.data ?? {};

  const ortName = asString(meta["amtlicher_name"]) ?? asString(meta["name"]) ?? ortSlug;

  // Optional: falls in meta vorhanden. Wenn nicht: fallback auf Slug, aber als "optional" im VM
  const bundeslandName = asString(meta["bundesland_name"]);
  const kreisName = asString(meta["kreis_name"]) ?? kreisSlug;

  const basePath = `/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/${ortSlug}`;

  // Intro / Teaser
  const teaserImmobilienpreise = getText(report, "text.immobilienpreise.immobilienpreise_intro", "");

  // Überschriften (optional individuell) – Keys identisch wie Kreis (wenn eure JSON so ist)
  // Falls ihr ortsspezifische Überschriften später anders ablegt, könnt ihr hier umschalten.
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

  // Haus-Texte
  const hauspreiseIntro = getText(report, "text.immobilienpreise.immobilienpreise_haus_intro", "");
  const hausVergleichIntro = getText(report, "text.immobilienpreise.immobilienpreise_haus_allgemein", "");
  const textHausLage = getText(report, "text.immobilienpreise.immobilienpreise_haus_lage", "");
  const textHausKaufpreisentwicklung = getText(
    report,
    "text.immobilienpreise.immobilienpreise_haus_preisentwicklung",
    "",
  );
  const textHaustypen = getText(report, "text.immobilienpreise.immobilienpreise_haus_haustypen", "");

  // Wohnung-Texte
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

  // Leitkennzahl
  const immobilienKaufpreis = data.immobilien_kaufpreis?.[0];
  const kaufpreisQm = toNumberOrNull(immobilienKaufpreis?.kaufpreis_immobilien);

  // Haus: Preisspanne + Index
  const hausPreisspanne = data.haus_kaufpreisspanne?.[0];
  const hausMin = toNumberOrNull(hausPreisspanne?.preis_haus_min);
  const hausAvg = toNumberOrNull(hausPreisspanne?.preis_haus_avg);
  const hausMax = toNumberOrNull(hausPreisspanne?.preis_haus_max);

  const preisindexRegionalRaw = data.immobilienpreisindex_regional?.[0];
  const indexHaus = toNumberOrNull(preisindexRegionalRaw?.immobilienpreisindex_haus);

  // Wohnung: Preisspanne + Index
  const wohnungPreisspanne = data.wohnung_kaufpreisspanne?.[0];
  const wohnungMin = toNumberOrNull(wohnungPreisspanne?.preis_wohnung_min);
  const wohnungAvg = toNumberOrNull(wohnungPreisspanne?.preis_wohnung_avg);
  const wohnungMax = toNumberOrNull(wohnungPreisspanne?.preis_wohnung_max);

  const indexWohnung = toNumberOrNull(preisindexRegionalRaw?.immobilienpreisindex_wohnung);

  // Tabellen (können auf Ortsebene ggf. fehlen – bleibt robust)
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

  // Zeitreihen
  const hausKaufpreisentwicklungRaw = data.haus_kaufpreisentwicklung ?? [];
  const wohnungKaufpreisentwicklungRaw = data.wohnung_kaufpreisentwicklung ?? [];

  const hausOrt = toZeitreihe(hausKaufpreisentwicklungRaw, "preis_k");
  const hausBL = toZeitreihe(hausKaufpreisentwicklungRaw, "preis_bl");
  const hausDE = toZeitreihe(hausKaufpreisentwicklungRaw, "preis_l");

  const wohnOrt = toZeitreihe(wohnungKaufpreisentwicklungRaw, "preis_k");
  const wohnBL = toZeitreihe(wohnungKaufpreisentwicklungRaw, "preis_bl");
  const wohnDE = toZeitreihe(wohnungKaufpreisentwicklungRaw, "preis_l");

  const hausKaufpreisentwicklungSeries = buildSeriesTriplet({
    ort: hausOrt,
    bundesland: hausBL,
    deutschland: hausDE,
    labelOrt: ortName,
    labelBL: bundeslandName ?? "Bundesland",
    labelDE: "Deutschland",
  });

  const wohnungKaufpreisentwicklungSeries = buildSeriesTriplet({
    ort: wohnOrt,
    bundesland: wohnBL,
    deutschland: wohnDE,
    labelOrt: ortName,
    labelBL: bundeslandName ?? "Bundesland",
    labelDE: "Deutschland",
  });

  // Bar-Modelle
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
    ortName,
    kreisName,
    bundeslandName,
    basePath,

    teaserImmobilienpreise: normalizeText(teaserImmobilienpreise),

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
