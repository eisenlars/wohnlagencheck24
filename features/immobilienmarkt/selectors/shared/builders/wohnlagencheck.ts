// features/immobilienmarkt/selectors/shared/builders/wohnlagencheck.ts

import type { Report } from "@/lib/data";
import { getText } from "@/utils/getText";
import { asArray, asRecord, asString } from "@/utils/records";
import { formatRegionFallback, getRegionDisplayName } from "@/utils/regionName";

import type {
  WohnlagencheckBildung,
  WohnlagencheckFaktor,
  WohnlagencheckGesundheit,
  WohnlagencheckKulturFreizeit,
  WohnlagencheckMobilitaet,
  WohnlagencheckNaherholung,
  WohnlagencheckNahversorgung,
  WohnlagencheckPoiImage,
  WohnlagencheckTheme,
  WohnlagencheckVM,
} from "@/features/immobilienmarkt/selectors/shared/types/wohnlagencheck";
import { toNumberOrNull } from "@/utils/toNumberOrNull";

type UnknownRecord = Record<string, unknown>;

function pickMeta(report: Report): UnknownRecord {
  const meta = report.meta as unknown;
  const m0 = Array.isArray(meta) ? meta[0] : meta;
  return asRecord(m0) ?? {};
}

function buildGalleryImages(args: {
  level: "kreis" | "ort";
  bundeslandSlug: string;
  kreisSlug: string;
  ortSlug?: string;
  regionName: string;
  kreisName?: string;
}): WohnlagencheckVM["gallery"] {
  const { level, bundeslandSlug, kreisSlug, ortSlug, regionName, kreisName } = args;

  const basePath =
    level === "ort" && ortSlug
      ? `/images/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/${ortSlug}`
      : `/images/immobilienmarkt/${bundeslandSlug}/${kreisSlug}`;

  const imageKey = level === "ort" && ortSlug ? ortSlug : kreisSlug;
  const altBase =
    level === "ort"
      ? kreisName && !kreisName.toLowerCase().includes("landkreis")
        ? `${kreisName} ${regionName}`
        : regionName
      : regionName;

  return [1, 2, 3].map((idx) => ({
    src: `${basePath}/immobilienmarktbericht-${imageKey}-standortcheck-0${idx}.jpg`,
    alt: `Immobilienmarktbericht ${altBase}`,
  }));
}

function cleanQuotedList(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text) return "";
  return text.replace(/^["']+|["']+$/g, "");
}

function buildPoiImage(args: {
  bundeslandSlug: string;
  kreisSlug: string;
  ortSlug?: string;
  folder: string;
  filePrefix: string;
  mode: "driving" | "walking";
  alt: string;
}): WohnlagencheckPoiImage {
  const { bundeslandSlug, kreisSlug, ortSlug, folder, filePrefix, mode, alt } = args;
  const regionSlug = ortSlug ? `${kreisSlug}_${ortSlug}` : kreisSlug;
  return {
    src: `/visuals/map_poi_availabilities/deutschland/${bundeslandSlug}/${kreisSlug}/${folder}/${filePrefix}_${regionSlug}_${mode}.webp`,
    alt,
  };
}

function toChartSlices(raw: unknown): Array<{ label: string; value: number | null }> {
  const rows = asArray(raw)
    .map((item) => asRecord(item))
    .filter((row): row is UnknownRecord => Boolean(row));

  return rows.map((row) => ({
    label: String(row["label"] ?? "").trim() || "Wert",
    value: toNumberOrNull(row["hectar"]),
  }));
}

function parseYear(aktualisierung: unknown): number | null {
  const text = typeof aktualisierung === "string" ? aktualisierung : "";
  const match = text.match(/(\d{4})/);
  const year = match?.[1] ? Number(match[1]) : null;
  return Number.isFinite(year) ? year : null;
}

function normalizeFaktorLabel(value: string): string {
  return value
    .replace(/_/g, " & ")
    .replace(/ae/g, "ä")
    .replace(/oe/g, "ö")
    .replace(/ue/g, "ü")
    .replace(/Ae/g, "Ä")
    .replace(/Oe/g, "Ö")
    .replace(/Ue/g, "Ü")
    .replace(/ss/g, "ß")
    .split(" ")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : ""))
    .join(" ");
}

function buildRadarPoints(raw: unknown): Array<{ label: string; value: number }> {
  const rows = asArray(raw)
    .map((item) => asRecord(item))
    .filter((row): row is UnknownRecord => Boolean(row));

  return rows
    .map((row) => {
      const faktor = String(row["faktor"] ?? "").trim();
      const value = toNumberOrNull(row["wert"]);
      if (!faktor || value === null) return null;
      return {
        label: normalizeFaktorLabel(faktor),
        value,
      };
    })
    .filter((row): row is { label: string; value: number } => Boolean(row));
}

function pickFirstRecord(raw: unknown): UnknownRecord | null {
  return asRecord(asArray(raw)[0]) ?? null;
}

function pickStandortfaktorIndex(raw: unknown, theme: WohnlagencheckTheme): { value: number | null; color?: string } {
  const rows = asArray(raw)
    .map((item) => asRecord(item))
    .filter((row): row is UnknownRecord => Boolean(row));

  const match = rows.find((row) => String(row["faktor"] ?? "") === theme);
  return {
    value: toNumberOrNull(match?.["wert"]),
    color: typeof match?.["color"] === "string" ? String(match?.["color"]) : undefined,
  };
}

function pickStandortfaktorValues(raw: unknown, theme: WohnlagencheckTheme): UnknownRecord | null {
  const rows = asArray(raw)
    .map((item) => asRecord(item))
    .filter((row): row is UnknownRecord => Boolean(row));

  for (const row of rows) {
    const candidate = asRecord(row[theme]);
    if (candidate) return candidate;
  }

  return null;
}

function selectRegionalSlices(args: {
  raw: unknown;
  level: "kreis" | "ort";
  valueKeyBase: string;
}): { slices: Array<{ label: string; value: number | null }>; regionLabel?: string } {
  const { raw, level, valueKeyBase } = args;
  const rows = asArray(raw)
    .map((item) => asRecord(item))
    .filter((row): row is UnknownRecord => Boolean(row));

  if (!rows.length) return { slices: [] };

  const first = rows[0] ?? {};
  const ortValue = toNumberOrNull(first[`${valueKeyBase}_ol`]);
  const useOrt = level === "ort" && ortValue !== null && ortValue !== 0;

  const slices = rows.map((row) => ({
    label: String(row["label"] ?? "").trim() || "Wert",
    value: toNumberOrNull(row[useOrt ? `${valueKeyBase}_ol` : `${valueKeyBase}_k`]),
  }));

  return {
    slices,
    regionLabel: useOrt ? undefined : level === "ort" ? "(Kreis)" : undefined,
  };
}

export function buildWohnlagencheckVM(args: {
  report: Report;
  level: "kreis" | "ort";
  bundeslandSlug: string;
  kreisSlug: string;
  ortSlug?: string;
}): WohnlagencheckVM {
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

  const basePath =
    level === "ort" && ortSlug
      ? `/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/${ortSlug}`
      : `/immobilienmarkt/${bundeslandSlug}/${kreisSlug}`;


  /*
  const headlineMain =
    level === "ort"
      ? isLandkreis
        ? `Wohnen in ${regionName}`
        : `Wohnen in ${kreisName ?? formatRegionFallback(kreisSlug ?? "")} ${regionName}`
      : `Wohnen in ${regionName}`;
  */
      
      
  const headlineMain =
    level === "ort"
      ? isLandkreis
        ? `Wohnen ${jahrLabel ?? ""} in ${regionName}`
        : `Wohnen ${jahrLabel ?? ""} in ${
            kreisName ?? formatRegionFallback(kreisSlug ?? "")
          } ${regionName}`
      : `Wohnen ${jahrLabel ?? ""} in ${regionName}`;
      
      

  const headlineAllgemein =
    level === "ort"
      ? isLandkreis
        ? `${regionName} - Charakter, Historisches, Lage`
        : `${kreisName ?? formatRegionFallback(kreisSlug ?? "")} ${regionName} - Charakter, Historisches, Lage`
      : `${regionName} - Charakter, Historisches, Lage`;

  const headlineAllgemeinIndividuell =
    level === "kreis"
      ? getText(report, "text.ueberschriften_kreis.ueberschrift_wohnlagencheck_allgemein_individuell", "")
      : "";

  const textAllgemein = getText(report, "text.wohnlagencheck.wohnlagencheck_allgemein", "");
  const textLage = getText(report, "text.wohnlagencheck.wohnlagencheck_lage", "");

  const flaecheRow = asRecord(asArray(data["flaeche_gesamt"])[0]) ?? {};
  const flaecheGesamt = toNumberOrNull(flaecheRow["flaeche_gesamt"]);
  const flaechenverteilung = toChartSlices(data["flaechenverteilung"]);
  const siedlungsflaechenverteilung = toChartSlices(data["siedlungsflaechenverteilung"]);
  const quellenangabeGebiete = String(
    asArray(data["quellenangaben"])
      .map((item) => asRecord(item))
      .filter(Boolean)
      .map((row) => String((row as UnknownRecord)["quellenangabe_gebiete"] ?? ""))
      .filter((value) => value.trim().length > 0)
      .join(", "),
  ).trim();

  const headlineFaktoren =
    level === "ort"
      ? isLandkreis
        ? `Standortfaktoren ${regionName}`
        : `Standortfaktoren ${kreisName ?? formatRegionFallback(kreisSlug ?? "")} ${regionName}`
      : `Standortfaktoren ${regionName}`;

  const headlineFaktorenIndividuell =
    level === "kreis"
      ? getText(report, "text.ueberschriften_kreis.ueberschrift_wohnlagencheck_faktoren_individuell", "")
      : "";

  const standortfaktorenIntro = getText(
    report,
    "text.wohnlagencheck.wohnlagencheck_standortfaktoren_intro",
    "",
  );

  const radarPoints = buildRadarPoints(data["standortfaktoren"]);

  const beraterName =
    (typeof berater["berater_name"] === "string" ? berater["berater_name"] : undefined) ??
    "Lars Hofmann";
  const beraterTaetigkeit = `Standort- / Immobilienberatung – ${regionName}`;
  const beraterImageSrc = `/images/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/immobilienberatung-${kreisSlug}.png`;

  const mobilitaetIndex = pickStandortfaktorIndex(data["standortfaktoren"], "mobilitaet");
  const bildungIndex = pickStandortfaktorIndex(data["standortfaktoren"], "bildung");
  const gesundheitIndex = pickStandortfaktorIndex(data["standortfaktoren"], "gesundheit");
  const naherholungIndex = pickStandortfaktorIndex(data["standortfaktoren"], "naherholung");
  const nahversorgungIndex = pickStandortfaktorIndex(data["standortfaktoren"], "nahversorgung");
  const kulturIndex = pickStandortfaktorIndex(data["standortfaktoren"], "kultur_freizeit");

  const mobilitaetValues = pickStandortfaktorValues(data["standortfaktoren_werte"], "mobilitaet") ?? {};
  const bildungValues = pickStandortfaktorValues(data["standortfaktoren_werte"], "bildung") ?? {};
  const gesundheitValues = pickStandortfaktorValues(data["standortfaktoren_werte"], "gesundheit") ?? {};
  const naherholungValues = pickStandortfaktorValues(data["standortfaktoren_werte"], "naherholung") ?? {};
  const nahversorgungValues = pickStandortfaktorValues(data["standortfaktoren_werte"], "nahversorgung") ?? {};
  const kulturValues = pickStandortfaktorValues(data["standortfaktoren_werte"], "kultur_freizeit") ?? {};

  const fernanbindung = pickFirstRecord(data["mobilitaet_fernanbindung"]) ?? {};
  const oepnvLinien = pickFirstRecord(data["mobilitaet_oepnv_linien"]) ?? {};

  const verkehrsflaechenanteil = selectRegionalSlices({
    raw: data["verkehrsflaechenanteil"],
    level,
    valueKeyBase: "hectar",
  });

  const vegetationsflaechenanteil = selectRegionalSlices({
    raw: data["vegetationsflaechenanteil"],
    level,
    valueKeyBase: "hectar",
  });

  const absolventenverteilung = selectRegionalSlices({
    raw: data["absolventenverteilung"],
    level,
    valueKeyBase: "anzahl",
  });

  const mobilitaetFaktor: WohnlagencheckMobilitaet = {
    theme: "mobilitaet",
    title: "Mobilität & Verkehrsanbindung",
    text: getText(report, "text.wohnlagencheck.wohnlagencheck_faktor_mobilitaet", ""),
    index: mobilitaetIndex,
    fernanbindung: {
      autobahn: cleanQuotedList(fernanbindung["autobahn"]),
      flughafen: cleanQuotedList(fernanbindung["flughafen"]),
      bahnhof: cleanQuotedList(fernanbindung["bahnhof"]),
    },
    oepnvLinien: cleanQuotedList(oepnvLinien["tram"]),
    values: {
      autobahnCount: toNumberOrNull(mobilitaetValues["mobilitaet_07"]),
      autobahnDistance: toNumberOrNull(mobilitaetValues["mobilitaet_02"]),
      flughafenCount: toNumberOrNull(mobilitaetValues["mobilitaet_08"]),
      flughafenDistance: toNumberOrNull(mobilitaetValues["mobilitaet_04"]),
      bahnhofCount: toNumberOrNull(mobilitaetValues["mobilitaet_09"]),
      bahnhofDistance: toNumberOrNull(mobilitaetValues["mobilitaet_06"]),
      tankstellen: toNumberOrNull(mobilitaetValues["mobilitaet_10"]),
      autogas: toNumberOrNull(mobilitaetValues["mobilitaet_11"]),
      eladesaeulen: toNumberOrNull(mobilitaetValues["mobilitaet_12"]),
      ticketpreis: toNumberOrNull(mobilitaetValues["mobilitaet_14"]),
      oepnvErreichbarkeit: toNumberOrNull(mobilitaetValues["mobilitaet_15"]),
      linienDichte: toNumberOrNull(mobilitaetValues["mobilitaet_16"]),
    },
    maps: {
      autobahn: buildPoiImage({
        bundeslandSlug,
        kreisSlug,
        ortSlug,
        folder: "autobahnauffahrten",
        filePrefix: "autobahnauffahrten",
        mode: "driving",
        alt: `Autobahnanbindung ${regionName}`,
      }),
      flughafen: buildPoiImage({
        bundeslandSlug,
        kreisSlug,
        ortSlug,
        folder: "flughafenentfernung",
        filePrefix: "flughafenentfernung",
        mode: "driving",
        alt: `Flughafenanbindung ${regionName}`,
      }),
      bahnhof: buildPoiImage({
        bundeslandSlug,
        kreisSlug,
        ortSlug,
        folder: "bahnhoefe",
        filePrefix: "bahnhoefe",
        mode: "driving",
        alt: `Bahnhofsanbindung ${regionName}`,
      }),
      oepnv: buildPoiImage({
        bundeslandSlug,
        kreisSlug,
        ortSlug,
        folder: "haltestellen",
        filePrefix: "haltestellen",
        mode: "walking",
        alt: `ÖPNV Erreichbarkeit ${regionName}`,
      }),
    },
    verkehrsflaechenanteil: verkehrsflaechenanteil.slices,
    verkehrsflaechenanteilRegionLabel: verkehrsflaechenanteil.regionLabel,
  };

  const bildungFaktor: WohnlagencheckBildung = {
    theme: "bildung",
    title: "Betreuungs- & Bildungsangebot",
    text: getText(report, "text.wohnlagencheck.wohnlagencheck_faktor_bildung", ""),
    index: bildungIndex,
    values: {
      kitas: toNumberOrNull(bildungValues["bildung_01"]),
      fachpersonal: toNumberOrNull(bildungValues["bildung_02"]),
      integrativ: toNumberOrNull(bildungValues["bildung_03"]),
      kitaErreichbarkeit: toNumberOrNull(bildungValues["bildung_04"]),
      grundschuleErreichbarkeit: toNumberOrNull(bildungValues["bildung_05"]),
      allgemeinbildendeSchulen: toNumberOrNull(bildungValues["bildung_06"]),
      gymnasiumErreichbarkeit: toNumberOrNull(bildungValues["bildung_08"]),
      ohneAbschluss: toNumberOrNull(bildungValues["bildung_09"]),
      hochschulreife: toNumberOrNull(bildungValues["bildung_10"]),
      foerderschulen: toNumberOrNull(bildungValues["bildung_11"]),
      hochschulen: toNumberOrNull(bildungValues["bildung_13"]),
      internationalisierung: toNumberOrNull(bildungValues["bildung_14"]),
      studenten: toNumberOrNull(bildungValues["bildung_15"]),
    },
    maps: {
      kita: buildPoiImage({
        bundeslandSlug,
        kreisSlug,
        ortSlug,
        folder: "kindertagesstaetten",
        filePrefix: "kindertagesstaetten",
        mode: "driving",
        alt: `Kindertagesstätten ${regionName}`,
      }),
      grundschule: buildPoiImage({
        bundeslandSlug,
        kreisSlug,
        ortSlug,
        folder: "grundschulen",
        filePrefix: "grundschulen",
        mode: "driving",
        alt: `Grundschulen ${regionName}`,
      }),
      gymnasium: buildPoiImage({
        bundeslandSlug,
        kreisSlug,
        ortSlug,
        folder: "gymnasien",
        filePrefix: "gymnasien",
        mode: "driving",
        alt: `Gymnasien ${regionName}`,
      }),
    },
    absolventenverteilung: absolventenverteilung.slices,
    absolventenverteilungRegionLabel: absolventenverteilung.regionLabel,
  };

  const gesundheitFaktor: WohnlagencheckGesundheit = {
    theme: "gesundheit",
    title: "Gesundheit & Pflege",
    text: getText(report, "text.wohnlagencheck.wohnlagencheck_faktor_gesundheit", ""),
    index: gesundheitIndex,
    values: {
      arzt: toNumberOrNull(gesundheitValues["gesundheit_01"]),
      zahnarzt: toNumberOrNull(gesundheitValues["gesundheit_02"]),
      apotheke: toNumberOrNull(gesundheitValues["gesundheit_03"]),
      kliniken: toNumberOrNull(gesundheitValues["gesundheit_04"]),
      klinikenErreichbarkeit: toNumberOrNull(gesundheitValues["gesundheit_05"]),
      reha: toNumberOrNull(gesundheitValues["gesundheit_06"]),
      pflegeStationaer: toNumberOrNull(gesundheitValues["gesundheit_07"]),
      pflegeAmbulant: toNumberOrNull(gesundheitValues["gesundheit_08"]),
      bettenKliniken: toNumberOrNull(gesundheitValues["gesundheit_09"]),
      bettenReha: toNumberOrNull(gesundheitValues["gesundheit_10"]),
      plaetzePflege: toNumberOrNull(gesundheitValues["gesundheit_11"]),
    },
    maps: {
      arzt: buildPoiImage({
        bundeslandSlug,
        kreisSlug,
        ortSlug,
        folder: "arztpraxen",
        filePrefix: "arztpraxen",
        mode: "driving",
        alt: `Arztpraxen ${regionName}`,
      }),
      zahnarzt: buildPoiImage({
        bundeslandSlug,
        kreisSlug,
        ortSlug,
        folder: "zahnarztpraxen",
        filePrefix: "zahnarztpraxen",
        mode: "driving",
        alt: `Zahnarztpraxen ${regionName}`,
      }),
      apotheke: buildPoiImage({
        bundeslandSlug,
        kreisSlug,
        ortSlug,
        folder: "apotheken",
        filePrefix: "apotheken",
        mode: "driving",
        alt: `Apotheken ${regionName}`,
      }),
      kliniken: buildPoiImage({
        bundeslandSlug,
        kreisSlug,
        ortSlug,
        folder: "kliniken",
        filePrefix: "kliniken",
        mode: "driving",
        alt: `Kliniken ${regionName}`,
      }),
    },
  };

  const naherholungFaktor: WohnlagencheckNaherholung = {
    theme: "naherholung",
    title: "Naherholung",
    text: getText(report, "text.wohnlagencheck.wohnlagencheck_faktor_naherholung", ""),
    index: naherholungIndex,
    values: {
      wald: toNumberOrNull(naherholungValues["naherholung_01"]),
      wasser: toNumberOrNull(naherholungValues["naherholung_03"]),
      parkanteil: toNumberOrNull(naherholungValues["naherholung_04"]),
      parkErreichbarkeit: toNumberOrNull(naherholungValues["naherholung_05"]),
      parkBereitstellung: toNumberOrNull(naherholungValues["naherholung_06"]),
      naturschutz: toNumberOrNull(naherholungValues["naherholung_07"]),
      luftqualitaet: toNumberOrNull(naherholungValues["naherholung_09"]),
      landschaftqualitaet: toNumberOrNull(naherholungValues["naherholung_08"]),
    },
    maps: {
      parks: buildPoiImage({
        bundeslandSlug,
        kreisSlug,
        ortSlug,
        folder: "parks",
        filePrefix: "parks",
        mode: "walking",
        alt: `Parkanlagen ${regionName}`,
      }),
    },
    vegetationsflaechenanteil: vegetationsflaechenanteil.slices,
    vegetationsflaechenanteilRegionLabel: vegetationsflaechenanteil.regionLabel,
  };

  const nahversorgungFaktor: WohnlagencheckNahversorgung = {
    theme: "nahversorgung",
    title: "Nahversorgung",
    text: getText(report, "text.wohnlagencheck.wohnlagencheck_faktor_nahversorgung", ""),
    index: nahversorgungIndex,
    values: {
      supermarktVersorgung: toNumberOrNull(nahversorgungValues["nahversorgung_01"]),
      supermarktErreichbarkeit: toNumberOrNull(nahversorgungValues["nahversorgung_02"]),
    },
    maps: {
      supermaerkte: buildPoiImage({
        bundeslandSlug,
        kreisSlug,
        ortSlug,
        folder: "supermaerkte",
        filePrefix: "supermaerkte",
        mode: "driving",
        alt: `Supermarktversorgung ${regionName}`,
      }),
    },
  };

  const kulturFaktor: WohnlagencheckKulturFreizeit = {
    theme: "kultur_freizeit",
    title: "Kultur & Freizeit",
    text: getText(report, "text.wohnlagencheck.wohnlagencheck_faktor_kultur_freizeit", ""),
    index: kulturIndex,
    values: {
      museum: toNumberOrNull(kulturValues["kultur_freizeit_01"]),
      theater: toNumberOrNull(kulturValues["kultur_freizeit_02"]),
      kino: toNumberOrNull(kulturValues["kultur_freizeit_03"]),
      kulturErreichbarkeit: toNumberOrNull(kulturValues["kultur_freizeit_04"]),
      sportanlagen: toNumberOrNull(kulturValues["kultur_freizeit_05"]),
      spielplaetze: toNumberOrNull(kulturValues["kultur_freizeit_06"]),
      schwimmbaeder: toNumberOrNull(kulturValues["kultur_freizeit_07"]),
      essenTrinken: toNumberOrNull(kulturValues["kultur_freizeit_08"]),
      nightlife: toNumberOrNull(kulturValues["kultur_freizeit_09"]),
    },
    maps: {
      kultur: buildPoiImage({
        bundeslandSlug,
        kreisSlug,
        ortSlug,
        folder: "kultureinrichtungen",
        filePrefix: "kultureinrichtungen",
        mode: "driving",
        alt: `Kultureinrichtungen ${regionName}`,
      }),
      sport: buildPoiImage({
        bundeslandSlug,
        kreisSlug,
        ortSlug,
        folder: "sporteinrichtungen",
        filePrefix: "sporteinrichtungen",
        mode: "driving",
        alt: `Sporteinrichtungen ${regionName}`,
      }),
      spielplaetze: buildPoiImage({
        bundeslandSlug,
        kreisSlug,
        ortSlug,
        folder: "spielplaetze",
        filePrefix: "spielplaetze",
        mode: "walking",
        alt: `Spielplätze ${regionName}`,
      }),
      schwimmbaeder: buildPoiImage({
        bundeslandSlug,
        kreisSlug,
        ortSlug,
        folder: "freizeitbaeder",
        filePrefix: "freizeitbaeder",
        mode: "driving",
        alt: `Schwimmbäder ${regionName}`,
      }),
      essenTrinken: buildPoiImage({
        bundeslandSlug,
        kreisSlug,
        ortSlug,
        folder: "essen_trinken",
        filePrefix: "essen_trinken",
        mode: "driving",
        alt: `Gastronomie ${regionName}`,
      }),
      nightlife: buildPoiImage({
        bundeslandSlug,
        kreisSlug,
        ortSlug,
        folder: "nightlife",
        filePrefix: "nightlife",
        mode: "driving",
        alt: `Nightlife ${regionName}`,
      }),
    },
  };

  const faktoren: WohnlagencheckFaktor[] = [
    mobilitaetFaktor,
    bildungFaktor,
    gesundheitFaktor,
    naherholungFaktor,
    nahversorgungFaktor,
    kulturFaktor,
  ].filter((faktor) => faktor.index.value !== null || faktor.text.length > 0);

  const gallery = buildGalleryImages({
    level,
    bundeslandSlug,
    kreisSlug,
    ortSlug,
    regionName,
    kreisName,
  });

  return {
    level,
    regionName,
    kreisName,
    bundeslandName,
    basePath,
    updatedAt: aktualisierung,
    headlineMain,
    headlineAllgemein,
    headlineAllgemeinIndividuell: headlineAllgemeinIndividuell || undefined,
    textAllgemein,
    textLage,
    flaecheGesamt,
    flaechenverteilung,
    siedlungsflaechenverteilung,
    quellenangabeGebiete: quellenangabeGebiete || undefined,
    headlineFaktoren,
    headlineFaktorenIndividuell: headlineFaktorenIndividuell || undefined,
    standortfaktorenIntro,
    radarPoints,
    hero: {
      title: regionName,
      subtitle: "Wohnlagencheck",
      imageSrc: `/images/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/immobilienmarktbericht-${kreisSlug}.jpg`,
    },
    berater: {
      name: beraterName,
      taetigkeit: beraterTaetigkeit,
      imageSrc: beraterImageSrc,
    },
    gallery,
    faktoren,
  };
}
