import type { Report } from "@/lib/data";
import { toNumberOrNull } from "@/utils/toNumberOrNull";
import { getText } from "@/utils/getText";
import { asArray, asRecord, asString } from "@/utils/records";
import { formatRegionFallback, getRegionDisplayName } from "@/utils/regionName";
import { buildTableModel } from "@/utils/buildTableModel";

import type {
  GrundstueckspreiseVM,
  ZeitreiheSeries,
  Zeitreihenpunkt,
} from "@/features/immobilienmarkt/selectors/shared/types/grundstueckspreise";
import type { GrundstueckspreiseReportData } from "@/types/reports";

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

function buildSeries(
  raw: unknown,
  defs: Array<{ key: string; label: string; valueKey: string; color?: string }>,
): ZeitreiheSeries[] {
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

export function buildGrundstueckspreiseVM(args: {
  report: Report<GrundstueckspreiseReportData>;
  level: "kreis" | "ort";
  bundeslandSlug: string;
  kreisSlug: string;
  ortSlug?: string;
}): GrundstueckspreiseVM {
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
  const regionaleZuordnung = typeof meta["regionale_zuordnung"] === "string" ? meta["regionale_zuordnung"] : "";
  const aktualisierung = asString(meta["aktualisierung"]);
  const jahrLabel = parseYear(aktualisierung);
  const isLandkreis = (kreisName ?? formatRegionFallback(kreisSlug ?? "")).toLowerCase().includes("landkreis");

  const teaser = getText(report, "text.grundstueckspreise.grundstueckspreise_intro", "");
  const ueberregionalText = getText(report, "text.grundstueckspreise.grundstueckspreise_allgemein", "");
  const preisentwicklungText = getText(report, "text.grundstueckspreise.grundstueckspreise_preisentwicklung", "");

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

  const grundstueckSpanne = data.grundstueck_kaufpreisspanne?.[0];
  const minPreis = toNumberOrNull(grundstueckSpanne?.preis_grundstueck_min);
  const avgPreis = toNumberOrNull(grundstueckSpanne?.preis_grundstueck_avg);
  const maxPreis = toNumberOrNull(grundstueckSpanne?.preis_grundstueck_max);

  const preisindexRegional = data.grundstueckspreisindex_regional?.[0];
  const grundstueckspreisindex = toNumberOrNull(preisindexRegional?.grundstueckspreisindex);

  const ueberregionalRaw = asArray(data.grundstueck_kaufpreise_im_ueberregionalen_vergleich);
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
          kind: "grundstueck_qm",
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

  const preisentwicklungSeries = buildSeries(data.grundstueck_preisentwicklung, [
    ...(level === "ort"
      ? [
          {
            key: "angebot",
            label: "Angebotspreis",
            valueKey: "angebotspreisentwicklung_grundstueck_ol",
            color: "rgba(95, 132, 162, 1)",
          },
          {
            key: "verkauf",
            label: "Verkaufspreis",
            valueKey: "verkaufspreisentwicklung_grundstueck_ol",
            color: "rgba(75, 192, 192, 1)",
          },
        ]
      : [
          {
            key: "angebot",
            label: "Angebotspreis",
            valueKey: "angebotspreisentwicklung_grundstueck_k",
            color: "rgba(95, 132, 162, 1)",
          },
          {
            key: "verkauf",
            label: "Verkaufspreis",
            valueKey: "verkaufspreisentwicklung_grundstueck_k",
            color: "rgba(75, 192, 192, 1)",
          },
        ]),
  ]);

  const basePath =
    level === "ort" && ortSlug
      ? `/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/${ortSlug}`
      : `/immobilienmarkt/${bundeslandSlug}/${kreisSlug}`;

  const heroImageSrc = `/images/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/immobilienmarktbericht-${kreisSlug}.jpg`;

  const headlineMain =
    level === "ort"
      ? isLandkreis
        ? `Grundstueckspreise ${jahrLabel} - ${regionName}`
        : `Grundstueckspreise ${jahrLabel} - ${kreisName ?? formatRegionFallback(kreisSlug ?? "")} ${regionName}`
      : `Grundstueckspreise ${jahrLabel} - ${regionName}`;

  const headlineSection =
    level === "ort"
      ? isLandkreis
        ? `Kaufpreise fuer Grundstuecke in ${regionName}`
        : `Kaufpreise fuer Grundstuecke in ${kreisName ?? formatRegionFallback(kreisSlug ?? "")} ${regionName}`
      : `Kaufpreise fuer Grundstuecke in ${regionName}`;

  const headlineSectionIndividuell =
    level === "kreis" ? getText(report, "text.ueberschriften_kreis.ueberschrift_grundstueckspreise", "") : "";

  return {
    level,
    regionName,
    bundeslandName,
    basePath,
    updatedAt: aktualisierung,

    headlineMain,
    headlineSection,
    headlineSectionIndividuell: headlineSectionIndividuell || undefined,

    teaser,
    ueberregionalText,
    preisentwicklungText,

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

    kpis: {
      min: minPreis,
      avg: avgPreis,
      max: maxPreis,
    },
    avgPreis,
    grundstueckspreisindex,
    ueberregionalModel,
    preisentwicklungSeries,
    showMap: regionaleZuordnung !== "stadtkreis",
  };
}
