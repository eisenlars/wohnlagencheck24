// features/immobilienmarkt/selectors/shared/builders/immobilienpreise.ts

import type { Report } from "@/lib/data";
import { toNumberOrNull } from "@/utils/toNumberOrNull";
import { getText } from "@/utils/getText";
import { buildTableModel } from "@/utils/buildTableModel";
import { buildBarModel } from "@/utils/barModel";
import { asArray, asRecord, asString } from "@/utils/records";
import type { ImmobilienpreiseReportData } from "@/types/reports";

import type { ImmobilienpreiseVM, Zeitreihenpunkt, ZeitreiheSeries } from "../types/immobilienpreise";

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

  const meta = asRecord(report.meta) ?? {};
  const data = report.data ?? {};

  const metaAmtlicherName = asString(meta["amtlicher_name"]);
  const metaName = asString(meta["name"]);

  const regionName =
    metaAmtlicherName ??
    metaName ??
    (level === "ort" ? ortSlug ?? "Ort" : kreisSlug);

  const bundeslandName = asString(meta["bundesland_name"]);

  const basePath =
    level === "ort" && ortSlug
      ? `/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/${ortSlug}`
      : `/immobilienmarkt/${bundeslandSlug}/${kreisSlug}`;

  const teaserImmobilienpreise = getText(report, "text.immobilienpreise.immobilienpreise_intro", "");

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
    labelBL: bundeslandName ?? "Bundesland",
    labelDE: "Deutschland",
  });

  const wohnungKaufpreisentwicklungSeries = buildSeriesTriplet({
    region: wohnRegion,
    bundesland: wohnBL,
    deutschland: wohnDE,
    labelRegion: regionName,
    labelBL: bundeslandName ?? "Bundesland",
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
