import type { Report } from "@/lib/data";
import { toNumberOrNull } from "@/utils/toNumberOrNull";
import { getText } from "@/utils/getText";
import { asArray, asRecord, asString } from "@/utils/records";
import { formatRegionFallback, getRegionDisplayName } from "@/utils/regionName";

import type { WirtschaftReportData } from "@/types/reports";
import type {
  ComboModel,
  ComboSeries,
  ZeitreiheSeries,
  Zeitreihenpunkt,
  WirtschaftVM,
} from "@/features/immobilienmarkt/selectors/shared/types/wirtschaft";

type UnknownRecord = Record<string, unknown>;

function pickMeta(report: Report): UnknownRecord {
  const meta = report.meta as unknown;
  const m0 = Array.isArray(meta) ? meta[0] : meta;
  return asRecord(m0) ?? {};
}

function parseYear(aktualisierung: unknown): number | null {
  const text = typeof aktualisierung === "string" ? aktualisierung : "";
  const match = text.match(/(\d{4})/);
  const year = match?.[1] ? Number(match[1]) : null;
  return Number.isFinite(year) ? year : null;
}

function toZeitreihe(raw: unknown, valueKey: string, baseYear: number | null = null): Zeitreihenpunkt[] {
  const rows = asArray(raw)
    .map((item) => asRecord(item))
    .filter((row): row is UnknownRecord => Boolean(row));

  return rows
    .map((item) => {
      const rawYear = toNumberOrNull(item["jahr"]);
      const year = rawYear !== null && rawYear < 0 && baseYear ? baseYear + rawYear : rawYear;
      return {
        jahr: Number(year),
        value: Number(item[valueKey]),
      };
    })
    .filter((p) => Number.isFinite(p.jahr) && Number.isFinite(p.value) && p.jahr > 1900)
    .sort((a, b) => a.jahr - b.jahr);
}

function buildSeries(
  raw: unknown,
  defs: Array<{ key: string; label: string; valueKey: string; color?: string }>,
  baseYear: number | null = null,
): ZeitreiheSeries[] {
  return defs.flatMap((d) => {
    const points = toZeitreihe(raw, d.valueKey, baseYear);
    return points.length ? [{ key: d.key, label: d.label, points, color: d.color }] : [];
  });
}

function buildComboModel(
  raw: unknown,
  defs: {
    bars?: Array<{ key: string; label: string; valueKey: string; color?: string }>;
    lines?: Array<{ key: string; label: string; valueKey: string; color?: string }>;
  },
): ComboModel {
  const rows = asArray(raw)
    .map((item) => asRecord(item))
    .filter((row): row is UnknownRecord => Boolean(row));

  const categories = rows
    .map((row) => toNumberOrNull(row["jahr"]))
    .filter((year): year is number => typeof year === "number" && Number.isFinite(year))
    .map((year) => String(Math.trunc(year)));

  const makeSeries = (s: { key: string; label: string; valueKey: string; color?: string }): ComboSeries => ({
    key: s.key,
    label: s.label,
    color: s.color,
    values: rows.map((row) => toNumberOrNull(row[s.valueKey])),
  });

  return {
    categories,
    bars: (defs.bars ?? []).map(makeSeries),
    lines: (defs.lines ?? []).map(makeSeries),
  };
}

export function buildWirtschaftVM(args: {
  report: Report<WirtschaftReportData>;
  level: "kreis" | "ort";
  bundeslandSlug: string;
  kreisSlug: string;
  ortSlug?: string;
}): WirtschaftVM {
  const { report, level, bundeslandSlug, kreisSlug, ortSlug } = args;

  const meta = pickMeta(report);
  const data: WirtschaftReportData = report.data ?? {};
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
  
  const aktualisierung = asString(meta["aktualisierung"]);
  const jahrLabel = parseYear(aktualisierung);
  
  const regionaleZuordnung = typeof meta["regionale_zuordnung"] === "string" ? meta["regionale_zuordnung"] : "";
  
  
  const isLandkreis = (kreisName ?? formatRegionFallback(kreisSlug ?? "")).toLowerCase().includes("landkreis");


  // Texte 
  const teaser = getText(report, "text.wirtschaft.wirtschaft_intro", "")
  
  const headlineWirtschaftIndividuell =
    level === "kreis" ? getText(report, "text.ueberschriften_kreis.ueberschrift_wirtschaft_individuell", "") : "";
  const headlineArbeitsmarktIndividuell =
    level === "kreis" ? getText(report, "text.ueberschriften_kreis.ueberschrift_arbeitsmarkt_individuell", "") : "";

  const einkommenText = getText(report, "text.wirtschaft.wirtschaft_einkommen", "")
  const bruttoinlandsproduktText = getText(report, "text.wirtschaft.wirtschaft_bruttoinlandsprodukt", "")
  const gewerbesaldoText = getText(report, "text.wirtschaft.wirtschaft_gewerbesaldo", "")
  const arbeitsmarktText = getText(report, "text.wirtschaft.wirtschaft_arbeitsmarkt", "")
  const arbeitslosenquoteText = getText(report, "text.wirtschaft.wirtschaft_arbeitslosigkeit", "")
  const arbeitslosendichteText = getText(report, "text.wirtschaft.wirtschaft_arbeitslosendichte", "")
  const svBeschaeftigteWohnortText = getText(report, "text.wirtschaft.wirtschaft_sv_beschaeftigte_wohnort", "")
  const svBeschaeftigteArbeitsortText = getText(report, "text.wirtschaft.wirtschaft_sv_beschaeftigte_arbeitsort", "")
  const arbeitsplatzzentralitaetText = getText(report, "text.wirtschaft.wirtschaft_arbeitsplatzzentralitaet", "")
  const pendlerText = getText(report, "text.wirtschaft.wirtschaft_pendler", "")

  

  const allgemeine = asRecord(asArray(data["wirtschaft_allgemein"])[0]) ?? {};
  
  const regionLabel =
    level === "ort"
      ? kreisName ?? formatRegionFallback(kreisSlug ?? "kreis")
      : regionName;

  const basePath =
    level === "ort" && ortSlug
      ? `/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/${ortSlug}`
      : `/immobilienmarkt/${bundeslandSlug}/${kreisSlug}`;

  const heroImageSrc = `/images/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/immobilienmarktbericht-${kreisSlug}.jpg`;

  const headlineMain =
    level === "ort"
      ? isLandkreis
        ? `Wirtschaft & Arbeitsmarkt ${jahrLabel ?? ""} - ${regionName}`
        : `Wirtschaft & Arbeitsmarkt ${jahrLabel ?? ""} - ${
            kreisName ?? formatRegionFallback(kreisSlug ?? "")
          } ${regionName}`
      : `Wirtschaft & Arbeitsmarkt ${jahrLabel ?? ""} - ${regionName}`;

  const headlineWirtschaft =
    level === "ort"
      ? isLandkreis
        ? `Wirtschaftliche Kenndaten für ${regionName}`
        : `Wirtschaftliche Kenndaten für ${kreisName ?? formatRegionFallback(kreisSlug ?? "")} ${regionName}`
      : `Wirtschaftliche Kenndaten für ${regionName}`;

  const headlineArbeitsmarkt =
    level === "ort"
      ? isLandkreis
        ? `Arbeitsmarkt ${regionName}`
        : `Arbeitsmarkt ${kreisName ?? formatRegionFallback(kreisSlug ?? "")} ${regionName}`
      : `Arbeitsmarkt ${regionName}`;

  

  const gewerbeflaechenanteil = asArray(data["gewerbeflaechenanteil"])
    .map((row) => asRecord(row))
    .filter((row): row is UnknownRecord => Boolean(row))
    .map((row) => ({
      label: String(row["label"] ?? "").trim(),
      value: toNumberOrNull(row["hectar"]),
    }))
    .filter((row) => row.label);

  const flaecheGewerbe = toNumberOrNull(data.flaechennutzung_gewerbe?.[0]?.flaechennutzung_gewerbe);
  const kpis = {
    kaufkraftindex:
      level === "ort"
        ? toNumberOrNull(allgemeine["kaufkraftindex_ol"])
        : toNumberOrNull(allgemeine["kaufkraftindex_k"]),
    flaecheGewerbe,
    bip: toNumberOrNull(allgemeine["bip"]),
    gewerbesaldo: toNumberOrNull(allgemeine["gewerbesaldo"]),
    kaufkraftNominal:
      level === "ort"
        ? toNumberOrNull(allgemeine["kaufkraft_nominal_ol"])
        : toNumberOrNull(allgemeine["kaufkraft_nominal_k"]),
    kaufkraftReal:
      level === "ort" ? toNumberOrNull(allgemeine["kaufkraft_real_ol"]) : toNumberOrNull(allgemeine["kaufkraft_real_k"]),
    arbeitsplatzzentralitaet:
      level === "ort"
        ? toNumberOrNull(allgemeine["arbeitsplatzzentralitaet_ol"])
        : toNumberOrNull(allgemeine["arbeitsplatzzentralitaet_k"]),
    pendlersaldo:
      level === "ort" ? toNumberOrNull(allgemeine["pendlersaldo_ol"]) : toNumberOrNull(allgemeine["pendlersaldo_k"]),
    arbeitslosenquote:
      level === "ort"
        ? toNumberOrNull(allgemeine["arbeitslosenquote_ol"])
        : toNumberOrNull(allgemeine["arbeitslosenquote_k"]),
    beschaeftigtenquote:
      level === "ort"
        ? toNumberOrNull(allgemeine["beschaeftigtenquote_ol"])
        : toNumberOrNull(allgemeine["beschaeftigtenquote_k"]),
    arbeitslosendichte: toNumberOrNull(allgemeine["arbeitslosendichte"]),
  };

  const gewerbesaldoAbsRaw = buildComboModel(data["gewerbesaldo_abs"], {
    bars: [
      { key: "saldo", label: "Saldo", valueKey: "gewerbesaldo", color: "rgba(75,192,192,0.7)" },
    ],
    lines: [
      { key: "anmeldungen", label: "Anmeldungen", valueKey: "gewerbeanmeldungen", color: "rgba(54,162,235,1)" },
      { key: "abmeldungen", label: "Abmeldungen", valueKey: "gewerbeabmeldungen", color: "rgba(95,132,162,1)" },
    ],
  });
  const gewerbesaldoAbs = gewerbesaldoAbsRaw;

  const gewerbesaldoPro1000 = buildSeries(data["gewerbesaldo_je_1000_ew"], [
    {
      key: "region",
      label: regionLabel,
      valueKey: "gewerbesaldo_pro_1000_ew",
      color: "rgba(75,192,192,1)",
    },
    {
      key: "bl",
      label: bundeslandName ?? formatRegionFallback(bundeslandSlug ?? "bundesland"),
      valueKey: "gewerbesaldo_pro_1000_ew_bl",
      color: "rgba(95,132,162,1)",
    },
    { key: "l", label: "Deutschland", valueKey: "gewerbesaldo_pro_1000_ew_l", color: "rgba(54,162,235,1)" },
  ]);

  const bipAbs = buildSeries(data["bruttoinlandsprodukt_abs"], [
    { key: "bip", label: regionLabel, valueKey: "bip_abs", color: "rgba(75,192,192,0.9)" },
  ]);

  const bipProEw = buildSeries(data["bruttoinlandsprodukt_pro_ew"], [
    { key: "region", label: regionLabel, valueKey: "bip_pro_ew", color: "rgba(75,192,192,1)" },
    {
      key: "bl",
      label: bundeslandName ?? formatRegionFallback(bundeslandSlug ?? "bundesland"),
      valueKey: "bip_pro_ew_bl",
      color: "rgba(95,132,162,1)",
    },
    { key: "l", label: "Deutschland", valueKey: "bip_pro_ew_l", color: "rgba(54,162,235,1)" },
  ]);

  const nettoeinkommenProEw = buildSeries(
    data["nettoeinkommen_pro_ew"],
    [
      {
        key: "region",
        label: level === "ort" ? regionName : regionLabel,
        valueKey: level === "ort" ? "nettoeinkommen_pro_ew_ol" : "nettoeinkommen_pro_ew_k",
        color: "rgba(200,213,79,1)",
      },
      {
        key: "bl",
        label: bundeslandName ?? formatRegionFallback(bundeslandSlug ?? "bundesland"),
        valueKey: "nettoeinkommen_pro_ew_bl",
        color: "rgba(95,132,162,1)",
      },
      { key: "l", label: "Deutschland", valueKey: "nettoeinkommen_pro_ew_l", color: "rgba(54,162,235,1)" },
    ],
    jahrLabel,
  );

  const nettoeinkommenProHh = buildSeries(
    data["nettoeinkommen_pro_hh"],
    [
      {
        key: "region",
        label: level === "ort" ? regionName : regionLabel,
        valueKey: level === "ort" ? "nettoeinkommen_pro_hh_ol" : "nettoeinkommen_pro_hh_k",
        color: "rgba(200,213,79,1)",
      },
      {
        key: "bl",
        label: bundeslandName ?? formatRegionFallback(bundeslandSlug ?? "bundesland"),
        valueKey: "nettoeinkommen_pro_hh_bl",
        color: "rgba(95,132,162,1)",
      },
      { key: "l", label: "Deutschland", valueKey: "nettoeinkommen_pro_hh_l", color: "rgba(54,162,235,1)" },
    ],
    jahrLabel,
  );

  const svbWohnortAbs = buildSeries(data["sv_pflichtig_beschaeftigte_wohnort"], [
    {
      key: "anzahl",
      label: "Anzahl",
      valueKey: level === "ort" ? "anzahl_ol" : "anzahl_k",
      color: "rgba(75,192,192,0.9)",
    },
  ]);

  const svbWohnortIndex = buildSeries(data["sv_pflichtig_beschaeftigte_wohnort_index"], [
    {
      key: "region",
      label: level === "ort" ? regionName : regionLabel,
      valueKey: level === "ort" ? "index_ol" : "index_k",
      color: "rgba(200,213,79,1)",
    },
    {
      key: "bl",
      label: bundeslandName ?? formatRegionFallback(bundeslandSlug ?? "bundesland"),
      valueKey: "index_bl",
      color: "rgba(95,132,162,1)",
    },
    { key: "l", label: "Deutschland", valueKey: "index_l", color: "rgba(54,162,235,1)" },
  ]);

  const svbArbeitsortAbs = buildSeries(data["sv_pflichtig_beschaeftigte_arbeitsort"], [
    {
      key: "anzahl",
      label: "Anzahl",
      valueKey: level === "ort" ? "anzahl_ol" : "anzahl_k",
      color: "rgba(75,192,192,0.9)",
    },
  ]);

  const svbArbeitsortIndex = buildSeries(data["sv_pflichtig_beschaeftigte_arbeitsort_index"], [
    {
      key: "region",
      label: level === "ort" ? regionName : regionLabel,
      valueKey: level === "ort" ? "index_ol" : "index_k",
      color: "rgba(200,213,79,1)",
    },
    {
      key: "bl",
      label: bundeslandName ?? formatRegionFallback(bundeslandSlug ?? "bundesland"),
      valueKey: "index_bl",
      color: "rgba(95,132,162,1)",
    },
    { key: "l", label: "Deutschland", valueKey: "index_l", color: "rgba(54,162,235,1)" },
  ]);

  const arbeitslosenzahlen = buildSeries(data["arbeitslosenzahlen"], [
    {
      key: "anzahl",
      label: "Anzahl",
      valueKey: level === "ort" ? "anzahl_ol" : "anzahl_k",
      color: "rgba(75,192,192,0.9)",
    },
  ]);

  const arbeitslosenquoten = buildSeries(data["arbeitslosenquoten"], [
    {
      key: "region",
      label: level === "ort" ? regionName : regionLabel,
      valueKey: level === "ort" ? "quote_ol" : "quote_k",
      color: "rgba(200,213,79,1)",
    },
    {
      key: "bl",
      label: bundeslandName ?? formatRegionFallback(bundeslandSlug ?? "bundesland"),
      valueKey: "quote_bl",
      color: "rgba(95,132,162,1)",
    },
    { key: "l", label: "Deutschland", valueKey: "quote_l", color: "rgba(54,162,235,1)" },
  ]);

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

  return {
    level,
    regionName,
    bundeslandName,
    basePath,
    updatedAt: aktualisierung,

    headlineMain,
    headlineWirtschaft,
    headlineWirtschaftIndividuell: headlineWirtschaftIndividuell || undefined,
    headlineArbeitsmarkt,
    headlineArbeitsmarktIndividuell: headlineArbeitsmarktIndividuell || undefined,

    teaser,
    introText: teaser,
    einkommenText,
    bruttoinlandsproduktText,
    gewerbesaldoText,
    arbeitsmarktText,
    arbeitslosenquoteText,
    arbeitslosendichteText,
    svBeschaeftigteWohnortText,
    svBeschaeftigteArbeitsortText,
    arbeitsplatzzentralitaetText,
    pendlerText,

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

    kpis,

    gewerbeflaechenanteil,

    gewerbesaldoAbs,
    gewerbesaldoPro1000,
    bipAbs,
    bipProEw,
    nettoeinkommenProEw,
    nettoeinkommenProHh,
    svbWohnortAbs,
    svbWohnortIndex,
    svbArbeitsortAbs,
    svbArbeitsortIndex,
    arbeitslosenzahlen,
    arbeitslosenquoten,
  };
}
