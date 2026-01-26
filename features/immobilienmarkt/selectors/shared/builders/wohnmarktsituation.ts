import type { Report } from "@/lib/data";
import { getText } from "@/utils/getText";
import { asArray, asRecord, asString } from "@/utils/records";
import { formatRegionFallback, getRegionDisplayName } from "@/utils/regionName";

import type { WohnmarktsituationReportData } from "@/types/reports";
import type {
  WohnmarktsituationVM,
  ZeitreiheSeries,
  Zeitreihenpunkt,
  ComboModel,
  ComboSeries,
} from "@/features/immobilienmarkt/selectors/shared/types/wohnmarktsituation";

type UnknownRecord = Record<string, unknown>;

function pickMeta(report: Report): UnknownRecord {
  const meta = report.meta as unknown;
  const m0 = Array.isArray(meta) ? meta[0] : meta;
  return asRecord(m0) ?? {};
}

function parseGermanNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^[\d\s.,+-]+$/.test(trimmed)) return null;

  const hasDot = trimmed.includes(".");
  const hasComma = trimmed.includes(",");

  let normalized = trimmed;
  if (hasDot && hasComma) {
    // de-DE: Tausenderpunkt + Dezimalkomma
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    // Komma als Dezimaltrenner
    normalized = normalized.replace(",", ".");
  } else {
    // Punkt als Dezimaltrenner (oder nur Ziffern)
    normalized = normalized.replace(/\s+/g, "");
  }

  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") return parseGermanNumber(value);
  return null;
}

function readKpiValue(value: unknown): number | string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const numeric = parseGermanNumber(trimmed);
    return numeric !== null ? numeric : trimmed;
  }
  return null;
}

function hasNonZero(points: Zeitreihenpunkt[]): boolean {
  return points.some((p) => Number.isFinite(p.value) && p.value !== 0);
}

function toZeitreihe(raw: unknown, valueKey: string): Zeitreihenpunkt[] {
  const rows = asArray(raw)
    .map((item) => asRecord(item))
    .filter((row): row is UnknownRecord => Boolean(row));

  return rows
    .map((item) => ({
      jahr: Number(item["jahr"]),
      value: Number(toNumber(item[valueKey]) ?? 0),
    }))
    .filter((p) => Number.isFinite(p.jahr) && Number.isFinite(p.value) && p.jahr > 1900)
    .sort((a, b) => a.jahr - b.jahr);
}

function buildSeries(raw: unknown, defs: Array<{ key: string; label: string; valueKey: string; color?: string }>): ZeitreiheSeries[] {
  return defs.flatMap((d) => {
    const points = toZeitreihe(raw, d.valueKey);
    if (!points.length || !hasNonZero(points)) return [];
    return [{ key: d.key, label: d.label, points, color: d.color }];
  });
}

function buildComparisonSeries(args: {
  raw: unknown;
  level: "kreis" | "ort";
  keys: { ol: string; k: string; bl: string; l: string };
  labels: { ol: string; k: string; bl: string; l: string };
  colors?: { ol?: string; k?: string; bl?: string; l?: string };
}): ZeitreiheSeries[] {
  const { raw, level, keys, labels, colors } = args;
  const defs = [
    { key: "ol", label: labels.ol, valueKey: keys.ol, color: colors?.ol },
    { key: "k", label: labels.k, valueKey: keys.k, color: colors?.k },
    { key: "bl", label: labels.bl, valueKey: keys.bl, color: colors?.bl },
    { key: "l", label: labels.l, valueKey: keys.l, color: colors?.l },
  ];

  const series = buildSeries(raw, defs);

  if (level === "kreis") {
    return series.filter((s) => s.key === "k" || s.key === "bl" || s.key === "l");
  }
  return series.filter((s) => s.key === "ol" || s.key === "k");
}

function buildComboFromRows(args: {
  raw: unknown;
  categoryKey: string;
  bars?: Array<{ key: string; label: string; valueKey: string; color?: string }>;
  lines?: Array<{ key: string; label: string; valueKey: string; color?: string }>;
}): ComboModel {
  const { raw, categoryKey, bars = [], lines = [] } = args;
  const rows = asArray(raw)
    .map((item) => asRecord(item))
    .filter((row): row is UnknownRecord => Boolean(row));

  const categories = rows.map((row) => String(row[categoryKey] ?? "").trim()).filter(Boolean);

  const build = (defs: Array<{ key: string; label: string; valueKey: string; color?: string }>): ComboSeries[] =>
    defs.map((def) => ({
      key: def.key,
      label: def.label,
      color: def.color,
      values: rows.map((row) => toNumber(row[def.valueKey])),
    }));

  return {
    categories,
    bars: build(bars),
    lines: build(lines),
  };
}

function pickRows(raw: unknown): UnknownRecord[] {
  return asArray(raw).map((item) => asRecord(item)).filter((row): row is UnknownRecord => Boolean(row));
}

export function buildWohnmarktsituationVM(args: {
  report: Report<WohnmarktsituationReportData>;
  level: "kreis" | "ort";
  bundeslandSlug: string;
  kreisSlug: string;
  ortSlug?: string;
}): WohnmarktsituationVM {
  const { report, level, bundeslandSlug, kreisSlug, ortSlug } = args;
  const meta = pickMeta(report);
  const data = report.data ?? {};

  const regionName = getRegionDisplayName({
    meta,
    level: level === "ort" ? "ort" : "kreis",
    fallbackSlug: level === "ort" ? ortSlug ?? "ort" : kreisSlug,
  });

  const bundeslandNameRaw = asString(meta["bundesland_name"])?.trim();
  const bundeslandName = bundeslandNameRaw ? formatRegionFallback(bundeslandNameRaw) : undefined;
  const kreisNameRaw = asString(meta["kreis_name"])?.trim();
  const kreisName = kreisNameRaw ? formatRegionFallback(kreisNameRaw) : undefined;
  const aktualisierung = asString(meta["aktualisierung"]);
  const isLandkreis = (kreisName ?? formatRegionFallback(kreisSlug ?? "")).toLowerCase().includes("landkreis");

  const text = asRecord(data["text"]) ?? {};
  const berater = asRecord(text["berater"]) ?? {};

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

  const basePath =
    level === "ort" && ortSlug
      ? `/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/${ortSlug}`
      : `/immobilienmarkt/${bundeslandSlug}/${kreisSlug}`;

  const headlineMain =
    level === "ort"
      ? isLandkreis
        ? `Wohnmarktsituation ${regionName}`
        : `Wohnmarktsituation ${kreisName ?? formatRegionFallback(kreisSlug ?? "")} ${regionName}`
      : `Wohnmarktsituation ${regionName}`;

  const headlineWohnraumnachfrage =
    level === "ort"
      ? isLandkreis
        ? `Wohnraumnachfrage in ${regionName}`
        : `Wohnraumnachfrage in ${kreisName ?? formatRegionFallback(kreisSlug ?? "")} ${regionName}`
      : `Wohnraumnachfrage, Bevölkerung, Haushalte in ${regionName}`;

  const headlineWohnraumangebot =
    level === "ort"
      ? isLandkreis
        ? `Wohnraumverfügbarkeit in ${regionName}`
        : `Wohnraumverfügbarkeit in ${kreisName ?? formatRegionFallback(kreisSlug ?? "")} ${regionName}`
      : `Wohnraumverfügbarkeit und Baugeschehen in ${regionName}`;

  const headlineWohnraumnachfrageIndividuell =
    level === "kreis"
      ? getText(
          report,
          "text.ueberschriften_kreis.ueberschrift_wohnmarktsituation_wohnraumnachfrage_individuell",
          "",
        )
      : "";

  const headlineWohnraumangebotIndividuell =
    level === "kreis"
      ? getText(
          report,
          "text.ueberschriften_kreis.ueberschrift_wohnmarktsituation_wohnraumangebot_individuell",
          "",
        )
      : "";

  const wohnungsnachfrage = asRecord(asArray(data.wohnungsnachfrage_allgemein)[0]) ?? {};
  const wohnungsangebot = asRecord(asArray(data.wohnungsangebot_allgemein)[0]) ?? {};
  const flaecheWohnbauRow = asRecord(asArray(data.flaechennutzung_wohnbau)[0]) ?? {};

  const wohnbauflaechenRows = pickRows(data.wohnbauflaechenanteil);
  const wohnungsbestandGebaeudeRows = pickRows(data.wohnungsbestand_gebaeudeverteilung);
  const baufertigstellungenGebaeudeRows = pickRows(data.baufertigstellungen_gebaeudeverteilung);
  const baugenehmigungenGebaeudeRows = pickRows(data.baugenehmigungen_gebaeudeverteilung);
  const altersverteilungRows = pickRows(data.altersverteilung);

  const bevoelkerungsentwicklungBasisjahr =
    asString(asRecord(asArray(data.bevoelkerungsentwicklung_relativ)[0])?.jahr) ?? undefined;

  const aussenwanderungssaldoNachAlterRows = pickRows(data.aussenwanderungssaldo_nach_alter);
  const aussenwanderungssaldoNachAlterZeitraum = asString(aussenwanderungssaldoNachAlterRows[0]?.zeitraum);
  const aussenwanderungBundeslandRow = aussenwanderungssaldoNachAlterRows.find((row) =>
    Array.isArray(row["aussenwanderungssaldo_nach_alter_ueber_bundeslandgrenzen"]),
  );
  const aussenwanderungAuslandRow = aussenwanderungssaldoNachAlterRows.find((row) =>
    Array.isArray(row["aussenwanderungssaldo_nach_alter_ueber_auslandsgrenzen"]),
  );

  const baseSeriesLabels = {
    ol: regionName,
    k: kreisName ?? formatRegionFallback(kreisSlug ?? "kreis"),
    bl: bundeslandName ?? formatRegionFallback(bundeslandSlug ?? "bundesland"),
    l: "D",
  };

  const chartColors = {
    ol: "rgba(200, 213, 79, 1)",
    k: "rgba(75, 192, 192, 1)",
    bl: "rgb(95, 132, 162)",
    l: "rgb(54, 162, 235)",
  };

  return {
    level,
    regionName,
    bundeslandName,
    basePath,
    updatedAt: aktualisierung,

    headlineMain,
    headlineWohnraumnachfrage,
    headlineWohnraumnachfrageIndividuell: headlineWohnraumnachfrageIndividuell || undefined,
    headlineWohnraumangebot,
    headlineWohnraumangebotIndividuell: headlineWohnraumangebotIndividuell || undefined,

    teaser: getText(report, "text.wohnmarktsituation.wohnmarktsituation_intro", ""),
    allgemeinText: getText(report, "text.wohnmarktsituation.wohnmarktsituation_allgemein", ""),

    wohnraumnachfrageText: getText(report, "text.wohnmarktsituation.wohnmarktsituation_wohnraumnachfrage", ""),
    natuerlicherSaldoIntro: getText(report, "text.wohnmarktsituation.wohnmarktsituation_natuerlicher_saldo_intro", ""),
    wanderungssaldoIntro: getText(report, "text.wohnmarktsituation.wohnmarktsituation_wanderungssaldo_intro", ""),
    jugendAltenQuotientIntro: getText(
      report,
      "text.wohnmarktsituation.wohnmarktsituation_jugendquotient_altenquotient_intro",
      "",
    ),

    wohnraumangebotIntro: getText(report, "text.wohnmarktsituation.wohnmarktsituation_wohnraumangebot_intro", ""),
    bautaetigkeitIntro: getText(report, "text.wohnmarktsituation.wohnmarktsituation_bautaetigkeit_intro", ""),
    wohnungsbestandIntro: getText(report, "text.wohnmarktsituation.wohnmarktsituation_wohnungsbestand_intro", ""),
    baufertigstellungenIntro: getText(report, "text.wohnmarktsituation.wohnmarktsituation_baufertigstellungen_intro", ""),
    baugenehmigungenIntro: getText(report, "text.wohnmarktsituation.wohnmarktsituation_baugenehmigungen_intro", ""),
    bauueberhangBaufortschrittText: getText(
      report,
      "text.wohnmarktsituation.wohnmarktsituation_bauueberhang_baufortschritt",
      "",
    ),

    bevoelkerungsentwicklungText: getText(
      report,
      "text.wohnmarktsituation.wohnmarktsituation_bevoelkerungsentwicklung",
      "",
    ),
    haushalteText: getText(report, "text.wohnmarktsituation.wohnmarktsituation_haushalte", ""),
    natuerlicherSaldoText: getText(report, "text.wohnmarktsituation.wohnmarktsituation_natuerlicher_saldo", ""),
    wanderungssaldoText: getText(report, "text.wohnmarktsituation.wohnmarktsituation_wanderungssaldo", ""),
    alterstrukturText: getText(report, "text.wohnmarktsituation.wohnmarktsituation_alterstruktur", ""),
    jugendAltenQuotientText: getText(
      report,
      "text.wohnmarktsituation.wohnmarktsituation_jugendquotient_altenquotient",
      "",
    ),
    wohnungsbestandAnzahlText: getText(
      report,
      "text.wohnmarktsituation.wohnmarktsituation_wohnungsbestand_anzahl",
      "",
    ),
    wohnungsbestandWohnflaecheText: getText(
      report,
      "text.wohnmarktsituation.wohnmarktsituation_wohnungsbestand_wohnflaeche",
      "",
    ),
    baufertigstellungenText: getText(
      report,
      "text.wohnmarktsituation.wohnmarktsituation_baufertigstellungen",
      "",
    ),
    baugenehmigungenText: getText(
      report,
      "text.wohnmarktsituation.wohnmarktsituation_baugenehmigungen",
      "",
    ),

    bevoelkerungsentwicklungBasisjahr: bevoelkerungsentwicklungBasisjahr || undefined,
    aussenwanderungssaldoNachAlterZeitraum: aussenwanderungssaldoNachAlterZeitraum || undefined,

    berater: {
      name: beraterName,
      telefon: beraterTelefon,
      email: beraterEmail,
      taetigkeit: beraterTaetigkeit,
      imageSrc: beraterImageSrc,
    },

    hero: {
      imageSrc: `/images/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/immobilienmarktbericht-${kreisSlug}.jpg`,
      title: "Wohnmarktsituation",
      subtitle: regionName,
    },

    kpis: {
      einwohner: readKpiValue(wohnungsnachfrage["anzahl_einwohner"]),
      haushalte: readKpiValue(wohnungsnachfrage["anzahl_haushalte"]),
      haushaltsgroesse: readKpiValue(wohnungsnachfrage["mittlere_haushaltsgroesse"]),
      wanderungssaldo: readKpiValue(wohnungsnachfrage["wanderungssaldo"]),
      natuerlicherSaldo: readKpiValue(wohnungsnachfrage["natuerlicher_saldo"]),
      einwohnerdichte: readKpiValue(wohnungsnachfrage["einwohnerdichte"]),
      siedlungsdichte: readKpiValue(wohnungsnachfrage["siedlungsdichte"]),
      jugendquotient: readKpiValue(wohnungsnachfrage["jugendquotient"]),
      altenquotient: readKpiValue(wohnungsnachfrage["altenquotient"]),

      wohnungsbestand: readKpiValue(wohnungsangebot["wohnungsbestand"]),
      baufertigstellungen: readKpiValue(wohnungsangebot["baufertigstellungen"]),
      baugenehmigungen: readKpiValue(wohnungsangebot["baugenehmigungen"]),
      leerstandsquote: readKpiValue(wohnungsangebot["leerstandsquote"]),
      flaecheWohnbau: readKpiValue(flaecheWohnbauRow["flaechennutzung_wohnbau"]),
      wohnungsbestandAnzahlAbsolut: readKpiValue(wohnungsangebot["wohnungsbestand_anzahl_absolut"]),
      wohnungsbestandWohnraumsaldo: readKpiValue(wohnungsangebot["wohnungsbestand_wohnraumsaldo"]),
      wohnungsbestandWohnraumsaldoPer1000: readKpiValue(wohnungsangebot["wohnungsbestand_wohnraumsaldo_per_1000_ew"]),
      wohnungsbestandWohnflaecheProEw: readKpiValue(wohnungsangebot["wohnungsbestand_wohnflaeche_pro_ew"]),
      wohnungsbestandMittlereWohnflaeche: readKpiValue(wohnungsangebot["wohnungsbestand_mittlere_wohnflaeche"]),

      baufertigstellungenAnzahlAbsolut: readKpiValue(wohnungsangebot["baufertigstellungen_anzahl_absolut"]),
      baufertigstellungenFlaecheAbsolut: readKpiValue(wohnungsangebot["baufertigstellungen_flaeche_absolut"]),
      baugenehmigungenAnzahlAbsolut: readKpiValue(wohnungsangebot["baugenehmigungen_anzahl_absolut"]),
      baugenehmigungenFlaecheAbsolut: readKpiValue(wohnungsangebot["baugenehmigungen_flaeche_absolut"]),
      baugenehmigungenErloschen: readKpiValue(wohnungsangebot["baugenehmigungen_erloschen"]),
    },

    wohnbauflaechenanteil: wohnbauflaechenRows.map((row, idx) => ({
      label: String(row["label"] ?? "").trim() || `Kategorie ${idx + 1}`,
      value: toNumber(row["hectar"]),
      color: idx === 0 ? "#dddddd" : "#0087CC",
    })),
    wohnungsbestandGebaeudeverteilung: wohnungsbestandGebaeudeRows.map((row, idx) => ({
      label: String(row["label"] ?? "").trim() || `Kategorie ${idx + 1}`,
      value: toNumber(row["anzahl"]),
      color: idx === 0 ? "rgba(75,192,192,0.9)" : idx === 1 ? "rgb(54,162,235)" : "rgb(255,205,86)",
    })),
    baufertigstellungenGebaeudeverteilung: baufertigstellungenGebaeudeRows.map((row, idx) => ({
      label: String(row["label"] ?? "").trim() || `Kategorie ${idx + 1}`,
      value: toNumber(row["anzahl"]),
      color: idx === 0 ? "rgba(75,192,192,0.9)" : idx === 1 ? "rgb(54,162,235)" : "rgb(255,205,86)",
    })),
    baugenehmigungenGebaeudeverteilung: baugenehmigungenGebaeudeRows.map((row, idx) => ({
      label: String(row["label"] ?? "").trim() || `Kategorie ${idx + 1}`,
      value: toNumber(row["anzahl"]),
      color: idx === 0 ? "rgba(75,192,192,0.9)" : idx === 1 ? "rgb(54,162,235)" : "rgb(255,205,86)",
    })),
    altersverteilung: altersverteilungRows.map((row, idx) => ({
      label: String(row["label"] ?? "").trim() || `Kategorie ${idx + 1}`,
      value: toNumber(row["altersspanne"]),
      color: idx === 0 ? "rgba(75,192,192,0.9)" : idx === 1 ? "rgb(54,162,235)" : "rgb(95,132,162)",
    })),

    bevoelkerungsentwicklungRelativ: buildComparisonSeries({
      raw: data.bevoelkerungsentwicklung_relativ,
      level,
      keys: { ol: "einwohner_ol", k: "einwohner_k", bl: "einwohner_bl", l: "einwohner_l" },
      labels: baseSeriesLabels,
      colors: chartColors,
    }),
    bevoelkerungsentwicklungAbsolut: buildComboFromRows({
      raw: data.bevoelkerungsentwicklung_absolut,
      categoryKey: "jahr",
      bars: [{ key: "einwohner", label: "Einwohner", valueKey: "einwohner", color: "rgba(75, 192, 192, 0.7)" }],
    }),
    bevoelkerungsaltersentwicklung: buildComparisonSeries({
      raw: data.bevoelkerungsaltersentwicklung,
      level,
      keys: {
        ol: "durchschnittsalter_ol",
        k: "durchschnittsalter_k",
        bl: "durchschnittsalter_bl",
        l: "durchschnittsalter_l",
      },
      labels: baseSeriesLabels,
      colors: chartColors,
    }),
    bevoelkerungsbewegungGesamt: buildComboFromRows({
      raw: data.bevoelkerungsbewegung_gesamt,
      categoryKey: "jahr",
      bars: [
        { key: "natuerlich", label: "natürliche Bewegung", valueKey: "natuerlich", color: "rgba(54, 162, 235, 0.85)" },
        { key: "wanderung", label: "Wanderung", valueKey: "wanderung", color: "rgba(95, 132, 162, 0.85)" },
      ],
      lines: [{ key: "saldo", label: "Saldo", valueKey: "saldo", color: "rgba(200, 213, 79, 1)" }],
    }),
    natuerlicheBevoelkerungsbewegung: buildComboFromRows({
      raw: data.natuerliche_bevoelkerungsbewegung,
      categoryKey: "jahr",
      bars: [
        { key: "geburten", label: "Geburten", valueKey: "geburten", color: "rgba(54, 162, 235, 0.85)" },
        { key: "sterbefaelle", label: "Sterbefälle", valueKey: "sterbefaelle", color: "rgba(95, 132, 162, 0.85)" },
      ],
      lines: [{ key: "saldo", label: "Saldo", valueKey: "saldo", color: "rgba(200, 213, 79, 1)" }],
    }),
    natuerlicheBevoelkerungsbewegungJe1000: buildComparisonSeries({
      raw: data.natuerliche_bevoelkerungsbewegung_je_1000_ew,
      level,
      keys: { ol: "einwohner_ol", k: "einwohner_k", bl: "einwohner_bl", l: "einwohner_l" },
      labels: baseSeriesLabels,
      colors: chartColors,
    }),
    wanderungssaldo: buildComboFromRows({
      raw: data.wanderungssaldo,
      categoryKey: "jahr",
      bars: [
        { key: "zuzug", label: "Zuzüge", valueKey: "zuzug", color: "rgba(54, 162, 235, 0.85)" },
        { key: "fortzug", label: "Fortzüge", valueKey: "fortzug", color: "rgba(95, 132, 162, 0.85)" },
      ],
      lines: [{ key: "saldo", label: "Saldo", valueKey: "saldo", color: "rgba(200, 213, 79, 1)" }],
    }),
    wanderungssaldoJe1000: buildComparisonSeries({
      raw: data.wanderungssaldo_je_1000_ew,
      level,
      keys: { ol: "einwohner_ol", k: "einwohner_k", bl: "einwohner_bl", l: "einwohner_l" },
      labels: baseSeriesLabels,
      colors: chartColors,
    }),
    aussenwanderungssaldo: buildComboFromRows({
      raw: data.aussenwanderungssaldo,
      categoryKey: "jahr",
      bars: [
        {
          key: "bundesland",
          label: bundeslandName ?? formatRegionFallback(bundeslandSlug ?? "bundesland"),
          valueKey: "aussenwanderungssaldo_bundesland_ew",
          color: "rgba(75, 192, 192, 0.85)",
        },
        { key: "deutschland", label: "Deutschland", valueKey: "aussenwanderungssaldo_deutschland_ew", color: "rgba(95, 132, 162, 0.85)" },
        { key: "ausland", label: "Ausland", valueKey: "aussenwanderungssaldo_ausland_ew", color: "rgba(54, 162, 235, 0.85)" },
      ],
      lines: [{ key: "gesamt", label: "Gesamt", valueKey: "aussenwanderungssaldo_gesamt_ew", color: "rgba(200, 213, 79, 1)" }],
    }),
    aussenwanderungssaldoNachAlter: {
      categories: ["unter 18", "18-25", "25-30", "30-50", "50-65", "über 65"],
      bars: [
        {
          key: "bundesgebiet",
          label: `Bundesgebiet (${bundeslandName ?? formatRegionFallback(bundeslandSlug ?? "bundesland")})`,
          color: "rgba(95, 132, 162, 0.85)",
          values: asArray(aussenwanderungBundeslandRow?.aussenwanderungssaldo_nach_alter_ueber_bundeslandgrenzen)
            .map((v) => toNumber(v)),
        },
        {
          key: "ausland",
          label: "Ausland",
          color: "rgba(200, 213, 79, 0.85)",
          values: asArray(aussenwanderungAuslandRow?.aussenwanderungssaldo_nach_alter_ueber_auslandsgrenzen)
            .map((v) => toNumber(v)),
        },
      ],
      lines: [],
    },
    haushalteJe1000: buildComparisonSeries({
      raw: data.haushalte_je_1000_ew,
      level,
      keys: { ol: "anzahl_ol", k: "anzahl_k", bl: "anzahl_bl", l: "anzahl_l" },
      labels: baseSeriesLabels,
      colors: chartColors,
    }),
    haushaltsgroesseNachPersonenanzahl: buildComboFromRows({
      raw: data.haushaltsgroesse_nach_personenanzahl,
      categoryKey: "jahr",
      bars: [
        { key: "ein", label: "1", valueKey: "personenanzahl_1", color: "rgba(75, 192, 192, 0.85)" },
        { key: "zwei", label: "2", valueKey: "personenanzahl_2", color: "rgba(95, 132, 162, 0.85)" },
        { key: "drei", label: "3 und mehr", valueKey: "personenanzahl_3", color: "rgba(200, 213, 79, 0.85)" },
      ],
    }),
    wohnungsbestandWohnflaeche: buildComparisonSeries({
      raw: data.wohnungsbestand_wohnflaeche,
      level,
      keys: { ol: "flaeche_ol", k: "flaeche_k", bl: "flaeche_bl", l: "flaeche_l" },
      labels: baseSeriesLabels,
      colors: chartColors,
    }),
    wohnungsbestandWohnungsanzahl: buildComboFromRows({
      raw: data.wohnungsbestand_wohnungsanzahl,
      categoryKey: "jahr",
      bars: [{ key: "anzahl", label: "Wohnungen", valueKey: "anzahl", color: "rgba(75, 192, 192, 0.7)" }],
    }),
    wohnungsbestandWohnungsanzahlJe1000: buildComparisonSeries({
      raw: data.wohnungsbestand_wohnungsanzahl_je_1000_ew,
      level,
      keys: { ol: "anzahl_ol", k: "anzahl_k", bl: "anzahl_bl", l: "anzahl_l" },
      labels: baseSeriesLabels,
      colors: chartColors,
    }),
    baufertigstellungenWohnungsanzahl: buildComboFromRows({
      raw: data.baufertigstellungen_wohnungsanzahl,
      categoryKey: "jahr",
      bars: [{ key: "anzahl", label: "Wohnungen", valueKey: "anzahl", color: "rgba(75, 192, 192, 0.7)" }],
    }),
    baufertigstellungenWohnungsanzahlJe1000: buildComparisonSeries({
      raw: data.baufertigstellungen_wohnungsanzahl_je_1000_ew,
      level,
      keys: { ol: "anzahl_ol", k: "anzahl_k", bl: "anzahl_bl", l: "anzahl_l" },
      labels: baseSeriesLabels,
      colors: chartColors,
    }),
    baugenehmigungenWohnungsanzahl: buildComboFromRows({
      raw: data.baugenehmigungen_wohnungsanzahl,
      categoryKey: "jahr",
      bars: [{ key: "anzahl", label: "Wohnungen", valueKey: "anzahl", color: "rgba(75, 192, 192, 0.7)" }],
    }),
    baugenehmigungenWohnungsanzahlJe1000: buildComparisonSeries({
      raw: data.baugenehmigungen_wohnungsanzahl_je_1000_ew,
      level,
      keys: { ol: "anzahl_ol", k: "anzahl_k", bl: "anzahl_bl", l: "anzahl_l" },
      labels: baseSeriesLabels,
      colors: chartColors,
    }),
    bauUeberhangGenehmigungFertigstellung: (() => {
      const seriesAll = buildSeries(data.bau_ueberhang_genehmigung_fertigstellung, [
        { key: "genehmigung_ol", label: "Genehmigungen", valueKey: "anzahl_genehmigung_ol", color: "rgba(75, 192, 192, 1)" },
        { key: "fertigstellung_ol", label: "Fertigstellungen", valueKey: "anzahl_fertigstellung_ol", color: "rgba(95, 132, 162, 1)" },
        { key: "ueberhang_ol", label: "Überhang", valueKey: "anzahl_ueberhang_ol", color: "rgba(54, 162, 235, 1)" },
        { key: "abgang_ol", label: "Abgang", valueKey: "anzahl_abgang_ol", color: "rgba(200, 213, 79, 1)" },
        { key: "genehmigung_k", label: "Genehmigungen (Kreis)", valueKey: "anzahl_genehmigung_k", color: "rgba(75, 192, 192, 1)" },
        { key: "fertigstellung_k", label: "Fertigstellungen (Kreis)", valueKey: "anzahl_fertigstellung_k", color: "rgba(95, 132, 162, 1)" },
        { key: "ueberhang_k", label: "Überhang (Kreis)", valueKey: "anzahl_ueberhang_k", color: "rgba(54, 162, 235, 1)" },
        { key: "abgang_k", label: "Abgang (Kreis)", valueKey: "anzahl_abgang_k", color: "rgba(200, 213, 79, 1)" },
      ]);

      if (level === "kreis") {
        return seriesAll.filter((series) => series.key.endsWith("_k"));
      }

      const hasOl = seriesAll.some((series) => series.key.endsWith("_ol"));
      return seriesAll.filter((series) => series.key.endsWith(hasOl ? "_ol" : "_k"));
    })(),
    bauueberhangBaufortschritt: (() => {
      const rows = pickRows(data.bauueberhang_baufortschritt);
      if (!rows.length) return { categories: [], bars: [], lines: [] };

      const hasOlData = rows.some((row) =>
        [
          "anzahl_bauueberhang_noch_nicht_begonnen_ol",
          "anzahl_bauueberhang_noch_nicht_unter_dach_ol",
          "anzahl_bauueberhang_unter_dach_ol",
        ].some((key) => {
          const value = toNumber(row[key]);
          return typeof value === "number" && Number.isFinite(value) && value !== 0;
        }),
      );
      const useOl = level === "ort" && hasOlData;

      return buildComboFromRows({
        raw: rows,
        categoryKey: "jahr",
        bars: [
          {
            key: "noch_nicht_begonnen",
            label: "Noch nicht begonnen",
            valueKey: useOl ? "anzahl_bauueberhang_noch_nicht_begonnen_ol" : "anzahl_bauueberhang_noch_nicht_begonnen_k",
            color: "rgba(75, 192, 192, 0.85)",
          },
          {
            key: "noch_nicht_unter_dach",
            label: "Noch nicht unter Dach",
            valueKey: useOl ? "anzahl_bauueberhang_noch_nicht_unter_dach_ol" : "anzahl_bauueberhang_noch_nicht_unter_dach_k",
            color: "rgba(95, 132, 162, 0.85)",
          },
          {
            key: "unter_dach",
            label: "Unter Dach (baureif)",
            valueKey: useOl ? "anzahl_bauueberhang_unter_dach_ol" : "anzahl_bauueberhang_unter_dach_k",
            color: "rgba(54, 162, 235, 0.85)",
          },
          {
            key: "genehmigung_erloschen",
            label: "Genehmigung erloschen",
            valueKey: useOl ? "anzahl_genehmigung_erloschen_ol" : "anzahl_genehmigung_erloschen_k",
            color: "rgba(255, 99, 132, 0.6)",
          },
        ],
        lines: [
          {
            key: "genehmigungen",
            label: "Genehmigungen",
            valueKey: useOl ? "anzahl_genehmigungen_ol" : "anzahl_genehmigungen_k",
            color: "rgba(200, 213, 79, 1)",
          },
        ],
      });
    })(),
    bauueberhangBaufortschrittUsesKreisFallback: (() => {
      if (level !== "ort") return false;
      const rows = pickRows(data.bauueberhang_baufortschritt);
      if (!rows.length) return false;
      const hasOlData = rows.some((row) =>
        [
          "anzahl_bauueberhang_noch_nicht_begonnen_ol",
          "anzahl_bauueberhang_noch_nicht_unter_dach_ol",
          "anzahl_bauueberhang_unter_dach_ol",
        ].some((key) => {
          const value = toNumber(row[key]);
          return typeof value === "number" && Number.isFinite(value) && value !== 0;
        }),
      );
      return !hasOlData;
    })(),
  };
}
