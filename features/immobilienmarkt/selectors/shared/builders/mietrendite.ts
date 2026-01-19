import type { Report } from "@/lib/data";
import { toNumberOrNull } from "@/utils/toNumberOrNull";
import { getText } from "@/utils/getText";
import { asArray, asRecord, asString } from "@/utils/records";
import { formatRegionFallback, getRegionDisplayName } from "@/utils/regionName";
import { buildTableModel } from "@/utils/buildTableModel";
import type { UnitKey } from "@/utils/format";

import type {
  MietrenditeVM,
  ZeitreiheSeries,
  Zeitreihenpunkt,
} from "@/features/immobilienmarkt/selectors/shared/types/mietrendite";
import type { MietrenditeReportData } from "@/types/reports";

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

export function buildMietrenditeVM(args: {
  report: Report<MietrenditeReportData>;
  level: "kreis" | "ort";
  bundeslandSlug: string;
  kreisSlug: string;
  ortSlug?: string;
}): MietrenditeVM {
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
  const aktualisierung = asString(meta["aktualisierung"]);
  const jahrLabel = parseYear(aktualisierung);
  const isLandkreis = (kreisName ?? formatRegionFallback(kreisSlug ?? "")).toLowerCase().includes("landkreis");

  const teaser = getText(report, "text.mietrendite.mietrendite_intro", "");
  const hinweisText = getText(report, "text.mietrendite.mietrendite_hinweis", "");
  const kaufpreisfaktorText = getText(report, "text.mietrendite.mietrendite_kaufpreisfaktor", "");
  const allgemeinText = getText(report, "text.mietrendite.mietrendite_allgemein", "");
  const etwText = getText(report, "text.mietrendite.mietrendite_etw", "");
  const efhText = getText(report, "text.mietrendite.mietrendite_efh", "");
  const mfhText = getText(report, "text.mietrendite.mietrendite_mfh", "");

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

  const mietrenditeGesamt = data.mietrendite_gesamt?.[0];
  const gesamtKaufpreisfaktor = toNumberOrNull(mietrenditeGesamt?.kaufpreisfaktor);
  const gesamtBrutto = toNumberOrNull(mietrenditeGesamt?.bruttomietrendite);
  const gesamtNetto = toNumberOrNull(mietrenditeGesamt?.nettomietrendite);

  const bruttoAllg = data.bruttomietrendite_allgemein?.[0];
  const nettoAllg = data.nettomietrendite_allgemein?.[0];
  const kaufpreisAllg = data.kaufpreisfaktor_allgemein?.[0];

  const etwKpi = {
    brutto: toNumberOrNull(bruttoAllg?.bruttomietrendite_etw),
    netto: toNumberOrNull(nettoAllg?.nettomietrendite_etw),
    kaufpreisfaktor: toNumberOrNull(kaufpreisAllg?.kaufpreisfaktor_etw),
  };
  const efhKpi = {
    brutto: toNumberOrNull(bruttoAllg?.bruttomietrendite_efh),
    netto: toNumberOrNull(nettoAllg?.nettomietrendite_efh),
    kaufpreisfaktor: toNumberOrNull(kaufpreisAllg?.kaufpreisfaktor_efh),
  };
  const mfhKpi = {
    brutto: toNumberOrNull(bruttoAllg?.bruttomietrendite_mfh),
    netto: toNumberOrNull(nettoAllg?.nettomietrendite_mfh),
    kaufpreisfaktor: toNumberOrNull(kaufpreisAllg?.kaufpreisfaktor_mfh),
  };

  const etwTableRaw = data.mietrendite_etw ?? [];
  const efhTableRaw = data.mietrendite_efh ?? [];
  const mfhTableRaw = data.mietrendite_mfh ?? [];

  const tableOptions = (prefix: string) => ({
    kind: "quote" as const,
    ctx: "table" as const,
    mode: "matrix" as const,
    orientation: "transpose" as const,
    rowLabelKey: "label",
    rowLabelHeader: "Immobilienart",
    columnLabelMap: {
      [`${prefix}_neubau`]: "Neubau",
      [`${prefix}_bestand_unsaniert`]: "Bestand unsaniert",
      [`${prefix}_bestand_kernsaniert`]: "Bestand kernsaniert",
    },
    unitKeyFromRaw: () => "percent" as UnitKey,
  });

  const etwTable =
    Array.isArray(etwTableRaw) && etwTableRaw.length > 0
      ? buildTableModel(etwTableRaw, tableOptions("etw"))
      : null;
  const efhTable =
    Array.isArray(efhTableRaw) && efhTableRaw.length > 0
      ? buildTableModel(efhTableRaw, tableOptions("efh"))
      : null;
  const mfhTable =
    Array.isArray(mfhTableRaw) && mfhTableRaw.length > 0
      ? buildTableModel(mfhTableRaw, tableOptions("mfh"))
      : null;

  const kaufpreisfaktorSeries = buildSeries(data.mietrendite_entwicklung, [
    { key: "kaufpreisfaktor", label: "Kaufpreisfaktor", valueKey: "kaufpreisfaktor", color: "rgb(54, 162, 235)" },
  ]);
  const bruttoRenditeSeries = buildSeries(data.mietrendite_entwicklung, [
    { key: "brutto", label: "Brutto-Mietrendite", valueKey: "brutto_mietrendite", color: "rgba(75, 192, 192, 1)" },
  ]);

  const basePath =
    level === "ort" && ortSlug
      ? `/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/${ortSlug}`
      : `/immobilienmarkt/${bundeslandSlug}/${kreisSlug}`;

  const heroImageSrc = `/images/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/immobilienmarktbericht-${kreisSlug}.jpg`;

  const headlineMain =
    level === "ort"
      ? isLandkreis
        ? `Mietrendite ${jahrLabel} - ${regionName}`
        : `Mietrendite ${jahrLabel} - ${kreisName ?? formatRegionFallback(kreisSlug ?? "")} ${regionName}`
      : `Mietrendite ${jahrLabel} - ${regionName}`;

  const headlineBruttoNetto =
    level === "ort"
      ? isLandkreis
        ? `Brutto- & Nettomietrendite in ${regionName}`
        : `Brutto- & Nettomietrendite in ${kreisName ?? formatRegionFallback(kreisSlug ?? "")} ${regionName}`
      : `Brutto- & Nettomietrendite in ${regionName}`;

  const headlineBruttoNettoIndividuell =
    level === "kreis"
      ? getText(report, "text.ueberschriften_kreis.ueberschrift_mietrendite_bruttomietrendite", "")
      : "";

  return {
    level,
    regionName,
    bundeslandName,
    basePath,
    updatedAt: aktualisierung,

    headlineMain,
    headlineBruttoNetto,
    headlineBruttoNettoIndividuell: headlineBruttoNettoIndividuell || undefined,

    teaser,
    kaufpreisfaktorText,
    allgemeinText,
    hinweisText,
    etwText,
    efhText,
    mfhText,

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

    gesamt: {
      kaufpreisfaktor: gesamtKaufpreisfaktor,
      bruttomietrendite: gesamtBrutto,
      nettomietrendite: gesamtNetto,
    },

    etw: {
      ...etwKpi,
      table: etwTable,
    },
    efh: {
      ...efhKpi,
      table: efhTable,
    },
    mfh: {
      ...mfhKpi,
      table: mfhTable,
    },

    kaufpreisfaktorSeries,
    bruttoRenditeSeries,
  };
}
