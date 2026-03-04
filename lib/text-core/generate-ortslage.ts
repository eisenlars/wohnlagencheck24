import {
  generateText,
  generateScoringTextbausteine,
  formatPriceValue,
  capitalizeWords,
  umlauteUmwandeln,
  renderTemplate,
  mapTrendCategoryToTemplateKey,
  determineIndex1Category,
  determineIndex100Category,
  determineIndex50Category,
  determineTrendCategory,
  determineAbsoluteCategoryWithDirection,
  determineSimpleComparisonCategory,
  determineGenericConnectorType,
} from "@/lib/text-core/core";

import ortslagePhrases from "@/lib/text-core/phrases/ortslage/immobilienpreise.json";
import ortslageWohnraumPhrases from "@/lib/text-core/phrases/ortslage/wohnraumsituation.json";
import ortslageWirtschaftPhrases from "@/lib/text-core/phrases/ortslage/wirtschaft.json";

type AnyRecord = Record<string, unknown>;

function pickRandom<T>(items: T[], rng?: () => number): T {
  if (!items.length) {
    throw new Error("pickRandom: empty array");
  }
  const r = rng ?? Math.random;
  return items[Math.floor(r() * items.length)];
}

export const ORTSLAGE_TEXT_MAP: Array<[string, string]> = [
  ["immobilienpreise", "immobilienpreise_haus_allgemein"],
  ["immobilienpreise", "immobilienpreise_haus_lage"],
  ["immobilienpreise", "immobilienpreise_haus_haustypen"],
  ["immobilienpreise", "immobilienpreise_haus_preisentwicklung"],
  ["immobilienpreise", "immobilienpreise_wohnung_allgemein"],
  ["immobilienpreise", "immobilienpreise_wohnung_lage"],
  ["immobilienpreise", "immobilienpreise_wohnung_nach_flaechen_und_zimmern"],
  ["immobilienpreise", "immobilienpreise_wohnung_preisentwicklung"],
  ["grundstueckspreise", "grundstueckspreise_allgemein"],
  ["grundstueckspreise", "grundstueckspreise_preisentwicklung"],
  ["mietpreise", "mietpreise_allgemein"],
  ["mietpreise", "mietpreise_wohnung_allgemein"],
  ["mietpreise", "mietpreise_wohnung_preisentwicklung"],
  ["mietpreise", "mietpreise_wohnung_nach_flaechen_und_zimmern"],
  ["mietpreise", "mietpreise_haus_allgemein"],
  ["mietpreise", "mietpreise_haus_preisentwicklung"],
  ["mietrendite", "mietrendite_kaufpreisfaktor"],
  ["mietrendite", "mietrendite_allgemein"],
  ["mietrendite", "mietrendite_etw"],
  ["mietrendite", "mietrendite_efh"],
  ["mietrendite", "mietrendite_mfh"],
  ["wohnmarktsituation", "wohnmarktsituation_allgemein"],
  ["wohnmarktsituation", "wohnmarktsituation_bevoelkerungsentwicklung"],
  ["wohnmarktsituation", "wohnmarktsituation_haushalte"],
  ["wohnmarktsituation", "wohnmarktsituation_natuerlicher_saldo"],
  ["wohnmarktsituation", "wohnmarktsituation_wanderungssaldo"],
  ["wohnmarktsituation", "wohnmarktsituation_alterstruktur"],
  ["wohnmarktsituation", "wohnmarktsituation_jugendquotient_altenquotient"],
  ["wohnmarktsituation", "wohnmarktsituation_wohnungsbestand_anzahl"],
  ["wohnmarktsituation", "wohnmarktsituation_wohnungsbestand_wohnflaeche"],
  ["wohnmarktsituation", "wohnmarktsituation_baufertigstellungen"],
  ["wohnmarktsituation", "wohnmarktsituation_baugenehmigungen"],
  ["wohnmarktsituation", "wohnmarktsituation_bauueberhang_baufortschritt"],
  ["wirtschaft", "wirtschaft_bruttoinlandsprodukt"],
  ["wirtschaft", "wirtschaft_einkommen"],
  ["wirtschaft", "wirtschaft_sv_beschaeftigte_arbeitsort"],
  ["wirtschaft", "wirtschaft_sv_beschaeftigte_wohnort"],
  ["wirtschaft", "wirtschaft_arbeitsplatzzentralitaet"],
  ["wirtschaft", "wirtschaft_pendler"],
  ["wirtschaft", "wirtschaft_arbeitslosigkeit"],
];

function formatNumber(value: number, decimals = 0) {
  return value.toLocaleString("de-DE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatLargeEconomyValue(value: number) {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${sign}${formatNumber(abs / 1e9, 2)} Mrd.`;
  if (abs >= 1e6) return `${sign}${formatNumber(abs / 1e6, 2)} Mio.`;
  if (abs >= 1e3) return `${sign}${formatNumber(abs / 1e3, 2)} Tsd.`;
  return `${sign}${formatNumber(abs, 0)}`;
}

function parseNumericValue(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const compact = trimmed.replace(/\s+/g, "");
  const deThousands = /^[+-]?\d{1,3}(?:\.\d{3})+(?:,\d+)?$/;
  const usThousands = /^[+-]?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/;
  const plainNumber = /^[+-]?\d+(?:[.,]\d+)?$/;
  if (!deThousands.test(compact) && !usThousands.test(compact) && !plainNumber.test(compact)) {
    return null;
  }

  let normalized = compact;
  if (deThousands.test(compact)) {
    normalized = compact.replace(/\./g, "").replace(",", ".");
  } else if (usThousands.test(compact)) {
    normalized = compact.replace(/,/g, "");
  } else if (compact.includes(",") && !compact.includes(".")) {
    normalized = compact.replace(",", ".");
  }

  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function formatValueForKey(key: string, value: number) {
  if (key.startsWith("jahr")) {
    return String(Math.round(value));
  }
  if (key.includes("mietrendite") || key.includes("kaufpreisfaktor")) {
    return formatNumber(value, 2).replace(".", ",");
  }
  if (key.includes("kaltmiete") || key.includes("mietpreis") || key.includes("warmmiete")) {
    return formatNumber(formatPriceValue(value), 1).replace(".", ",");
  }
  return formatNumber(formatPriceValue(value), 0);
}

function buildInputData(inputs: AnyRecord) {
  const source = (inputs ?? {}) as AnyRecord;
  const {
    year01: year01Raw,
    regionale_zuordnung_kreis,
    ortslage_name,
    kreis_name,
    bundesland_name,
    statValues_locationFactors_dict,
    statValues_generally_dict,
    statValues_livingSpaceDemand_dict,
    statValues_livingSpaceOffer_dict,
    statValues_economy_dict,
    priceValues_properties_dict,
    priceValues_plots_dict,
    priceValues_rent_dict,
    priceValues_rendite_dict,
  } = source;

  const year01Parsed = typeof year01Raw === "number" ? year01Raw : Number(year01Raw);
  const year01 = Number.isFinite(year01Parsed) ? year01Parsed : new Date().getFullYear();
  const locationFactors = (statValues_locationFactors_dict ?? {}) as AnyRecord;
  const generallyValues = (statValues_generally_dict ?? {}) as AnyRecord;
  const livingSpaceDemandValues = (statValues_livingSpaceDemand_dict ?? {}) as AnyRecord;
  const livingSpaceOfferValues = (statValues_livingSpaceOffer_dict ?? {}) as AnyRecord;
  const economyValues = (statValues_economy_dict ?? {}) as AnyRecord;
  const propertyValues = (priceValues_properties_dict ?? {}) as AnyRecord;
  const plotValues = (priceValues_plots_dict ?? {}) as AnyRecord;
  const rentValues = (priceValues_rent_dict ?? {}) as AnyRecord;
  const renditeValues = (priceValues_rendite_dict ?? {}) as AnyRecord;

  const rawOrtslageName = String(ortslage_name ?? "").trim();
  const normalizedOrtslageSlug = umlauteUmwandeln(rawOrtslageName)
    .replace(/^ortslage[_\-\s]*/i, "")
    .replace(/_/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  let ortName = capitalizeWords(normalizedOrtslageSlug);
  if (!ortName) {
    ortName = capitalizeWords(umlauteUmwandeln(rawOrtslageName).replace(/_/g, "-"));
  }
  const kreisName = capitalizeWords(umlauteUmwandeln(String(kreis_name ?? "")));
  const bundeslandName = capitalizeWords(umlauteUmwandeln(String(bundesland_name ?? "")));

  const isLandkreis = String(regionale_zuordnung_kreis ?? "").toLowerCase() === "landkreis";
  const cityStateSet = new Set(["hamburg", "berlin", "bremen"]);
  const bundeslandKey = String(bundesland_name ?? "").trim().toLowerCase();
  const namePrefix = isLandkreis ? "" : cityStateSet.has(bundeslandKey) ? bundeslandName : kreisName;
  if (namePrefix) {
    const current = ortName.toLowerCase();
    const pref = `${namePrefix.toLowerCase()} `;
    if (!current.startsWith(pref)) {
      ortName = `${namePrefix} ${ortName}`.trim();
    }
  }

  const inOderIm = regionale_zuordnung_kreis === "landkreis" ? "im" : "in";

  const raw: AnyRecord = {
    region_name: ortName,
    ortslage_name: ortName,
    kreis_name: kreisName,
    bundesland_name: bundeslandName,
    in_oder_im: inOderIm,
    jahr01: year01,
    jahr02: year01 - 1,
    jahr05: year01 - 4,
    jahr10: year01 - 9,
    jahr01_minus_1: year01 - 1,
    jahr10_einwohneranzahl_trend: year01 - 9,
    jahr10_haushaltsanzahl_trend: year01 - 9,
    ...locationFactors,
    ...generallyValues,
    ...livingSpaceDemandValues,
    ...livingSpaceOfferValues,
    ...economyValues,
    ...propertyValues,
    ...plotValues,
    ...rentValues,
    ...renditeValues,
  };

  const inputData: AnyRecord = { ...raw };
  for (const [key, value] of Object.entries(raw)) {
    const numeric = parseNumericValue(value);
    if (numeric === null) continue;
    raw[key] = numeric;
  }
  normalizeOrtslageWohnflaecheUnit(raw);
  for (const [key, value] of Object.entries(raw)) {
    const numeric = parseNumericValue(value);
    if (numeric === null) continue;
    if (key.includes("lagescore")) {
      inputData[key] = numeric;
      continue;
    }
    inputData[key] = formatValueForKey(key, numeric);
  }

  normalizeOrtslageBevoelkerungSaldo(inputData, raw);
  normalizeOrtslageHaushaltsSaldo(inputData, raw);
  normalizeOrtslageNatuerlicherSaldo(inputData, raw);
  normalizeOrtslageWanderungssaldo(inputData, raw);
  normalizeOrtslageBauueberhangFortschritt(inputData, raw);
  normalizeOrtslageEinkommenDisplay(inputData, raw);
  normalizeOrtslageBipDisplay(inputData, raw);
  normalizeOrtslageArbeitsplatzzentralitaetDisplay(inputData, raw);

  return { inputData, raw };
}

function toFinite(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeOrtslageWohnflaecheUnit(raw: AnyRecord) {
  const total = toFinite(raw.wohnflaeche_jahr01_ortslage);
  const perEw = toFinite(raw.wohnflaeche_per_ew_jahr01_ortslage);
  const population = toFinite(raw.einwohneranzahl_jahr01_ortslage);
  if (total === null || perEw === null || population === null || total <= 0 || perEw <= 0 || population <= 0) return;

  const impliedTotal = population * perEw;
  const factor = impliedTotal / total;
  // Legacy source values for total living space are sometimes delivered in thousand m².
  if (factor > 700 && factor < 1300) {
    raw.wohnflaeche_jahr01_ortslage = total * 1000;
  }
}

function normalizeOrtslageBevoelkerungSaldo(inputData: AnyRecord, raw: AnyRecord) {
  const current = toFinite(raw.einwohneranzahl_jahr01_ortslage);
  const past = toFinite(raw.einwohneranzahl_jahr10_ortslage);
  if (current === null || past === null) return;
  const saldoAbs = Math.abs(current - past);
  raw.einwohneranzahl_10jahressaldo_ortslage = saldoAbs;
  inputData.einwohneranzahl_10jahressaldo_ortslage = formatValueForKey("einwohneranzahl_10jahressaldo_ortslage", saldoAbs);
}

function normalizeOrtslageHaushaltsSaldo(inputData: AnyRecord, raw: AnyRecord) {
  const current = toFinite(raw.haushaltsanzahl_jahr01_ortslage);
  const past = toFinite(raw.haushaltsanzahl_jahr10_ortslage);
  if (current === null || past === null) return;
  const saldoAbs = Math.abs(current - past);
  raw.haushaltsanzahl_10jahressaldo_ortslage = saldoAbs;
  inputData.haushaltsanzahl_10jahressaldo_ortslage = formatValueForKey("haushaltsanzahl_10jahressaldo_ortslage", saldoAbs);
}

function normalizeOrtslageNatuerlicherSaldo(inputData: AnyRecord, raw: AnyRecord) {
  const saldo = toFinite(raw.natuerliches_bevoelkerungssaldo_jahr01_ortslage);
  if (saldo !== null) {
    const saldoAbs = Math.abs(saldo);
    raw.natuerliches_bevoelkerungssaldo_jahr01_ortslage = saldoAbs;
    inputData.natuerliches_bevoelkerungssaldo_jahr01_ortslage = formatValueForKey(
      "natuerliches_bevoelkerungssaldo_jahr01_ortslage",
      saldoAbs,
    );
    inputData.natuerliches_bevoelkerungssaldo_richtung_ortslage =
      saldo < 0 ? "negativen" : saldo > 0 ? "positiven" : "ausgeglichenen";
  }

  const per1000Raw = toFinite(raw.natuerliches_bevoelkerungssaldo_je_1000ew_ortslage);
  const population = toFinite(raw.einwohneranzahl_jahr01_ortslage);
  let per1000Abs: number | null = null;
  if (per1000Raw !== null) per1000Abs = Math.abs(per1000Raw);
  else if (saldo !== null && population !== null && population > 0) per1000Abs = Math.abs((saldo / population) * 1000);
  if (per1000Abs !== null) {
    inputData.natuerliches_bevoelkerungssaldo_je_1000ew_ortslage = formatNumber(per1000Abs, 1).replace(".", ",");
  }
}

function normalizeOrtslageWanderungssaldo(inputData: AnyRecord, raw: AnyRecord) {
  const calcTrendStatus = (current: number | null, previous: number | null) => {
    if (current === null || previous === null) return { status: "no_data" as const, pctAbs: null as number | null };
    if (previous === 0) {
      if (current === 0) return { status: "no_data" as const, pctAbs: null as number | null };
      return { status: "second_value_is_0" as const, pctAbs: null as number | null };
    }
    if (current === 0) return { status: "first_value_is_0" as const, pctAbs: null as number | null };
    return {
      status: "valid" as const,
      pctAbs: Math.abs(((current - previous) / previous) * 100),
    };
  };

  const formatTrendValue = (value: number | null) =>
    value === null ? "" : formatNumber(value, 1).replace(".", ",");

  const current = toFinite(raw.wanderungssaldo_jahr01_ortslage);
  if (current !== null) {
    const currentAbs = Math.abs(current);
    raw.wanderungssaldo_jahr01_ortslage = currentAbs;
    inputData.wanderungssaldo_jahr01_ortslage = formatValueForKey("wanderungssaldo_jahr01_ortslage", currentAbs);
    inputData.wanderungssaldo_richtung_jahr01_ortslage =
      current < 0 ? "negativen" : current > 0 ? "positiven" : "ausgeglichenen";
  }

  const year05 = toFinite(raw.wanderungssaldo_jahr05_ortslage);
  if (current !== null && year05 !== null) {
    const delta = current - year05;
    inputData.wanderungssaldo_5jahresSaldo_ortslage_abs = formatValueForKey(
      "wanderungssaldo_5jahresSaldo_ortslage",
      Math.abs(delta),
    );
    inputData.wanderungssaldo_5jahresrichtung_ortslage =
      delta < 0 ? "negativer" : delta > 0 ? "positiver" : "ausgeglichener";
  }

  const zuz01 = toFinite(raw.wanderungssaldo_zuzuege_jahr01_ortslage);
  const zuz05 = toFinite(raw.wanderungssaldo_zuzuege_jahr05_ortslage);
  const fort01 = toFinite(raw.wanderungssaldo_fortzuege_jahr01_ortslage);
  const fort05 = toFinite(raw.wanderungssaldo_fortzuege_jahr05_ortslage);

  const zuzStatus = calcTrendStatus(zuz01, zuz05);
  const fortStatus = calcTrendStatus(fort01, fort05);

  if (zuzStatus.status === "valid") {
    inputData.wanderungssaldo_zuzuege_5jahrestrend_ortslage = formatTrendValue(zuzStatus.pctAbs);
  } else {
    const fallback = toFinite(raw.wanderungssaldo_zuzuege_5jahrestrend_ortslage);
    inputData.wanderungssaldo_zuzuege_5jahrestrend_ortslage = formatTrendValue(fallback === null ? null : Math.abs(fallback));
  }

  if (fortStatus.status === "valid") {
    inputData.wanderungssaldo_fortzuege_5jahrestrend_ortslage = formatTrendValue(fortStatus.pctAbs);
  } else {
    const fallback = toFinite(raw.wanderungssaldo_fortzuege_5jahrestrend_ortslage);
    inputData.wanderungssaldo_fortzuege_5jahrestrend_ortslage = formatTrendValue(fallback === null ? null : Math.abs(fallback));
  }

  if (zuzStatus.status === "second_value_is_0") {
    inputData.sondertext_zuzuege = "Nach Jahren ohne Zuzüge werden inzwischen wieder Zuzüge verzeichnet.";
  } else if (zuzStatus.status === "first_value_is_0") {
    inputData.sondertext_zuzuege = "Aktuell werden keine Zuzüge mehr verzeichnet.";
  }

  if (fortStatus.status === "second_value_is_0") {
    inputData.sondertext_fortzuege = "Nach Jahren ohne Fortzüge werden inzwischen wieder Fortzüge verzeichnet.";
  } else if (fortStatus.status === "first_value_is_0") {
    inputData.sondertext_fortzuege = "Aktuell werden keine Fortzüge mehr verzeichnet.";
  }

  if (zuzStatus.status === "no_data" && fortStatus.status === "no_data") {
    inputData.wanderungssaldo_no_data_beide_ortslage = true;
  }
}

function normalizeOrtslageBipDisplay(inputData: AnyRecord, raw: AnyRecord) {
  const bipJahr01Kreis = toFinite(raw.bruttoinlandsprodukt_jahr01_kreis);
  if (bipJahr01Kreis !== null) {
    inputData.bruttoinlandsprodukt_jahr01_kreis = formatLargeEconomyValue(bipJahr01Kreis);
  }
  const bipJahr05Kreis = toFinite(raw.bruttoinlandsprodukt_jahr05_kreis);
  if (bipJahr05Kreis !== null) {
    inputData.bruttoinlandsprodukt_jahr05_kreis = formatLargeEconomyValue(bipJahr05Kreis);
  }
}

function normalizeOrtslageArbeitsplatzzentralitaetDisplay(inputData: AnyRecord, raw: AnyRecord) {
  const keys = [
    "arbeitsplatzzentralitaet_ortslage",
    "arbeitsplatzzentralitaet_ol",
    "arbeitsplatzzentralitaet_kreis",
    "arbeitsplatzzentralitaet_k",
  ];
  for (const key of keys) {
    const value = toFinite(raw[key]);
    if (value === null) continue;
    inputData[key] = formatNumber(value, 2);
  }
}

function normalizeOrtslageEinkommenDisplay(inputData: AnyRecord, raw: AnyRecord) {
  const totalKeys = [
    "verfuegbares_einkommen_jahr01_ortslage",
    "verfuegbares_einkommen_jahr05_ortslage",
  ];
  for (const key of totalKeys) {
    const value = toFinite(raw[key]);
    if (value === null) continue;
    inputData[key] = formatLargeEconomyValue(value);
  }

  const detailedKeys = [
    "verfuegbares_einkommen_per_ew_jahr01_ortslage",
    "verfuegbares_einkommen_per_ew_jahr05_ortslage",
    "verfuegbares_einkommen_per_hh_jahr01_ortslage",
  ];
  for (const key of detailedKeys) {
    const value = toFinite(raw[key]);
    if (value === null) continue;
    inputData[key] = formatNumber(Math.round(value), 0);
  }
}

function readFirstFinite(raw: AnyRecord, keys: string[]) {
  for (const key of keys) {
    const value = toFinite(raw[key]);
    if (value !== null) return value;
  }
  return null;
}

function normalizeOrtslageBauueberhangFortschritt(inputData: AnyRecord, raw: AnyRecord) {
  const readSeries = (scope: "ortslage" | "kreis") => {
    const suffixes = scope === "ortslage" ? ["ortslage", "ol"] : ["kreis", "k"];
    const pick = (metric: string, year: "jahr01" | "jahr02" | "jahr05", isGenehmigung = false) => {
      const keys: string[] = [];
      for (const suffix of suffixes) {
        if (isGenehmigung) {
          keys.push(`anzahl_genehmigungen_${year}_${suffix}`);
          keys.push(`anzahl_genehmigung_${year}_${suffix}`);
        } else {
          keys.push(`anzahl_${metric}_${year}_${suffix}`);
        }
      }
      return readFirstFinite(raw, keys);
    };

    const nnb01 = pick("bauueberhang_noch_nicht_begonnen", "jahr01");
    const nnu01 = pick("bauueberhang_noch_nicht_unter_dach", "jahr01");
    const ud01 = pick("bauueberhang_unter_dach", "jahr01");
    const g01 = pick("", "jahr01", true);
    const nnb02 = pick("bauueberhang_noch_nicht_begonnen", "jahr02");
    const nnu02 = pick("bauueberhang_noch_nicht_unter_dach", "jahr02");
    const ud02 = pick("bauueberhang_unter_dach", "jahr02");
    const g02 = pick("", "jahr02", true);
    const nnb05 = pick("bauueberhang_noch_nicht_begonnen", "jahr05");
    const nnu05 = pick("bauueberhang_noch_nicht_unter_dach", "jahr05");
    const ud05 = pick("bauueberhang_unter_dach", "jahr05");
    const g05 = pick("", "jahr05", true);

    const complete =
      nnb01 !== null && nnu01 !== null && ud01 !== null && g01 !== null && g01 > 0 &&
      nnb02 !== null && nnu02 !== null && ud02 !== null && g02 !== null && g02 > 0 &&
      nnb05 !== null && nnu05 !== null && ud05 !== null && g05 !== null && g05 > 0;

    return {
      complete,
      nnb01,
      nnu01,
      ud01,
      g01,
      nnb02,
      nnu02,
      ud02,
      g02,
      nnb05,
      nnu05,
      ud05,
      g05,
    };
  };

  const ortslageSeries = readSeries("ortslage");
  const kreisSeries = readSeries("kreis");
  const useOrtslage = ortslageSeries.complete && (ortslageSeries.nnb01 ?? 0) > 0;
  const useKreis = !useOrtslage && kreisSeries.complete && (kreisSeries.nnb01 ?? 0) > 0;
  const series = useOrtslage ? ortslageSeries : useKreis ? kreisSeries : null;

  if (!series) {
    inputData.bauueberhang_no_data_basis_kreis = true;
    return;
  }

  inputData.bauueberhang_datenbasis = useOrtslage ? "ortslage" : "kreis";
  inputData.bauueberhang_datenbasis_hinweis = useKreis ? "__kreis__" : "__ortslage__";

  const nnb01 = series.nnb01 as number;
  const nnu01 = series.nnu01 as number;
  const ud01 = series.ud01 as number;
  const g01 = series.g01 as number;
  const nnb02 = series.nnb02 as number;
  const nnu02 = series.nnu02 as number;
  const ud02 = series.ud02 as number;
  const g02 = series.g02 as number;
  const nnb05 = series.nnb05 as number;
  const nnu05 = series.nnu05 as number;
  const ud05 = series.ud05 as number;
  const g05 = series.g05 as number;

  const bauQ01 = ((nnb01 + nnu01) / g01) * 100;
  const bauQ02 = ((nnb02 + nnu02) / g02) * 100;
  const bauQ05 = ((nnb05 + nnu05) / g05) * 100;
  const fertQ01 = (ud01 / g01) * 100;
  const fertQ02 = (ud02 / g02) * 100;
  const fertQ05 = (ud05 / g05) * 100;

  raw.bauueberhangsquote_jahr01_kreis = bauQ01;
  raw.bauueberhangsquote_jahr02_kreis = bauQ02;
  raw.bauueberhangsquote_jahr05_kreis = bauQ05;
  raw.fertigstellungsquote_jahr01_kreis = fertQ01;
  raw.fertigstellungsquote_jahr02_kreis = fertQ02;
  raw.fertigstellungsquote_jahr05_kreis = fertQ05;
  raw.bauueberhangsquote_kreis = bauQ01;
  raw.fertigstellungsquote_kreis = fertQ01;

  inputData.bauueberhangsquote_jahr01_kreis = formatValueForKey("bauueberhangsquote_jahr01_kreis", Math.round(bauQ01));
  inputData.fertigstellungsquote_jahr01_kreis = formatValueForKey("fertigstellungsquote_jahr01_kreis", Math.round(fertQ01));
}

function trendKeyCandidates(definition: AnyRecord) {
  const trend = definition?.trend_verbkonstrukte ?? {};
  const keys = new Set<string>();
  for (const k of Object.keys(trend)) {
    if (k.startsWith("phrases_")) keys.add(k.replace("phrases_", ""));
    if (k.startsWith("verbkonstrukt_")) keys.add(k.replace("verbkonstrukt_", ""));
  }
  return [...keys];
}

function computeTrendValues(definition: AnyRecord, raw: AnyRecord) {
  const trends: AnyRecord = {};
  const normalizeYear01Stem = (stem: string) => (stem.endsWith("_jahr01") ? stem.slice(0, -7) : stem);
  for (const trendKey of trendKeyCandidates(definition)) {
    if (!trendKey.startsWith("trendText_")) continue;
    const base = trendKey.replace(/^trendText_/, "");

    if (base.endsWith("_vergleich_ortslage_kreis")) {
      const stemRaw = base.replace(/_vergleich_ortslage_kreis$/, "");
      const stem = normalizeYear01Stem(stemRaw);
      const mode = stemRaw.includes("kaltmiete") || stemRaw.includes("miet") ? "index1" : "index100";
      const a = raw[`${stem}_jahr01_ortslage`];
      const b = raw[`${stem}_jahr01_kreis`];
      if (typeof a === "number" && typeof b === "number" && b !== 0) {
        trends[trendKey] = { [mode]: (a / b) * (mode === "index100" ? 100 : 1) };
      }
      continue;
    }

    if (base.endsWith("_vergleich_ortslage_bundesland")) {
      const stemRaw = base.replace(/_vergleich_ortslage_bundesland$/, "");
      const stem = normalizeYear01Stem(stemRaw);
      const mode = stemRaw.includes("kaltmiete") || stemRaw.includes("miet") ? "index1" : "index100";
      const a = raw[`${stem}_jahr01_ortslage`];
      const b = raw[`${stem}_jahr01_bundesland`];
      if (typeof a === "number" && typeof b === "number" && b !== 0) {
        trends[trendKey] = { [mode]: (a / b) * (mode === "index100" ? 100 : 1) };
      }
      continue;
    }

    if (base.endsWith("_vergleich_ortslage_land")) {
      const stemRaw = base.replace(/_vergleich_ortslage_land$/, "");
      const stem = normalizeYear01Stem(stemRaw);
      const mode = stemRaw.includes("kaltmiete") || stemRaw.includes("miet") ? "index1" : "index100";
      const a = raw[`${stem}_jahr01_ortslage`];
      const b = raw[`${stem}_jahr01_land`];
      if (typeof a === "number" && typeof b === "number" && b !== 0) {
        trends[trendKey] = { [mode]: (a / b) * (mode === "index100" ? 100 : 1) };
      }
      continue;
    }

    const tenTrend = base.match(/^(.*)_10jahrestrend_(ortslage)$/);
    if (tenTrend) {
      const stem = tenTrend[1];
      const a = raw[`${stem}_jahr01_ortslage`];
      const b = raw[`${stem}_jahr10_ortslage`];
      if (typeof a === "number" && typeof b === "number" && b !== 0) {
        trends[trendKey] = { rel_change: ((a - b) / b) * 100 };
      }
      continue;
    }

    const tenSaldo = base.match(/^(.*)_10jahressaldo_(ortslage)$/);
    if (tenSaldo) {
      const stem = tenSaldo[1];
      const a = raw[`${stem}_jahr01_ortslage`];
      const b = raw[`${stem}_jahr10_ortslage`];
      if (typeof a === "number" && typeof b === "number" && b !== 0) {
        trends[trendKey] = {
          abs_delta: a - b,
          rel_change: ((a - b) / b) * 100,
        };
      }
      continue;
    }

    const twoTrend = base.match(/^(.*)_2jahrestrend_(ortslage)$/);
    if (twoTrend) {
      const stem = twoTrend[1];
      const a = raw[`${stem}_jahr01_ortslage`];
      const b = raw[`${stem}_jahr02_ortslage`];
      if (typeof a === "number" && typeof b === "number" && b !== 0) {
        trends[trendKey] = { rel_change: ((a - b) / b) * 100 };
      }
      continue;
    }

    const twoTrendKreis = base.match(/^(.*)_2jahrestrend_(kreis)$/);
    if (twoTrendKreis) {
      const stem = twoTrendKreis[1];
      const a = raw[`${stem}_jahr01_kreis`];
      const b = raw[`${stem}_jahr02_kreis`];
      if (typeof a === "number" && typeof b === "number" && b !== 0) {
        trends[trendKey] = { rel_change: ((a - b) / b) * 100 };
      }
      continue;
    }

    const fiveTrend = base.match(/^(.*)_5jahrestrend_(ortslage)$/);
    if (fiveTrend) {
      const stem = fiveTrend[1];
      const a = raw[`${stem}_jahr01_ortslage`];
      const b = raw[`${stem}_jahr05_ortslage`];
      if (typeof a === "number" && typeof b === "number" && b !== 0) {
        trends[trendKey] = { rel_change: ((a - b) / b) * 100 };
      }
      continue;
    }

    const fiveTrendKreis = base.match(/^(.*)_5jahrestrend_(kreis)$/);
    if (fiveTrendKreis) {
      const stem = fiveTrendKreis[1];
      const a = raw[`${stem}_jahr01_kreis`];
      const b = raw[`${stem}_jahr05_kreis`];
      if (typeof a === "number" && typeof b === "number" && b !== 0) {
        trends[trendKey] = { rel_change: ((a - b) / b) * 100 };
      }
      continue;
    }

    const fiveSaldo = base.match(/^(.*)_5jahresSaldo_(ortslage)$/);
    if (fiveSaldo) {
      const stem = fiveSaldo[1];
      const a = raw[`${stem}_jahr01_ortslage`];
      const b = raw[`${stem}_jahr05_ortslage`];
      if (typeof a === "number" && typeof b === "number") {
        trends[trendKey] = { abs_delta: a - b };
      }
      continue;
    }

    const vorjahrTrend = base.match(/^(.*)_vorjahrestrend_(ortslage)$/);
    if (vorjahrTrend) {
      const stem = vorjahrTrend[1];
      const a = raw[`${stem}_jahr01_ortslage`];
      const b = raw[`${stem}_jahr02_ortslage`];
      if (typeof a === "number" && typeof b === "number" && b !== 0) {
        trends[trendKey] = { rel_change: ((a - b) / b) * 100 };
      }
      continue;
    }

    const vorjahrSaldo = base.match(/^(.*)_vorjahressaldo_(ortslage)$/);
    if (vorjahrSaldo) {
      const stem = vorjahrSaldo[1];
      const a = raw[`${stem}_jahr01_ortslage`];
      const b = raw[`${stem}_jahr02_ortslage`];
      if (typeof a === "number" && typeof b === "number") {
        trends[trendKey] = { abs_delta: a - b };
      }
      continue;
    }

    if (base.includes("jugendquotient_altenquotient_vergleich")) {
      const a = raw["altenquotient_ortslage"];
      const b = raw["jugendquotient_ortslage"];
      if (typeof a === "number" && typeof b === "number") {
        trends[trendKey] = { direct_comparison: { value_a: a, value_b: b } };
      }
      continue;
    }

    if (base.startsWith("regionentyp_")) {
      const a = raw["einwohneranzahl_jahr01_ortslage"];
      const b = raw["einwohneranzahl_jahr05_ortslage"];
      if (typeof a === "number" && typeof b === "number" && b !== 0) {
        trends[trendKey] = { rel_change: ((a - b) / b) * 100 };
      }
      continue;
    }

    if (base === "arbeitsplatzzentralitaet_kreis") {
      const direct = raw.arbeitsplatzzentralitaet_kreis;
      const fallback = raw.arbeitsplatzzentralitaet_k;
      const v = typeof direct === "number" ? direct : typeof fallback === "number" ? fallback : null;
      if (typeof v === "number" && Number.isFinite(v) && v > 0) {
        trends[trendKey] = { index1: v };
      }
      continue;
    }

    if (base === "arbeitsplatzzentralitaet_ortslage") {
      const direct = raw.arbeitsplatzzentralitaet_ortslage;
      const fallback = raw.arbeitsplatzzentralitaet_ol;
      const v = typeof direct === "number" ? direct : typeof fallback === "number" ? fallback : null;
      if (typeof v === "number" && Number.isFinite(v) && v > 0) {
        trends[trendKey] = { index1: v };
      }
      continue;
    }

    const indexMatch = base.match(/^(.*)_index(?:_jahr01)?_ortslage$/);
    if (indexMatch) {
      const stem = indexMatch[1];
      let v = raw[base];
      if (typeof v !== "number") {
        const a = raw[`${stem}_jahr01_ortslage`];
        const b = raw[`${stem}_jahr01_land`];
        if (typeof a === "number" && typeof b === "number" && b !== 0) {
          v = (a / b) * 100;
        }
      }
      if (typeof v === "number") {
        trends[trendKey] = { index100: v };
      }
      continue;
    }

    if (base.includes("vergleich_neubau_bestand")) {
      const a = raw["quadratmeterkaltmiete_avg_wohnung_neubau_jahr01_ortslage"];
      const b = raw["quadratmeterkaltmiete_avg_wohnung_bestand_jahr01_ortslage"];
      if (typeof a === "number" && typeof b === "number") {
        trends[trendKey] = { direct_comparison: { value_a: a, value_b: b } };
      }
      continue;
    }
  }
  return trends;
}

function computeTextDefinition(key: string): AnyRecord | null {
  return ((
    (ortslagePhrases as AnyRecord)[key] ??
    (ortslageWohnraumPhrases as AnyRecord)[key] ??
    (ortslageWirtschaftPhrases as AnyRecord)[key] ??
    null
  ) as AnyRecord | null);
}

function getTrendRelChange(trendValues: AnyRecord, trendKey: string) {
  const trend = trendValues?.[trendKey];
  if (!trend || typeof trend !== "object") return 0;
  const rel = (trend as AnyRecord).rel_change;
  return typeof rel === "number" && Number.isFinite(rel) ? rel : 0;
}

function toRecord(value: unknown): AnyRecord {
  return value && typeof value === "object" ? (value as AnyRecord) : {};
}

function enrichBaseVarsForScoring(block: AnyRecord, baseVars: AnyRecord, key: string, rng?: () => number) {
  const hasScoring =
    !!block?.scoring_dynamic_subblocks_preisangaben ||
    !!block?.scoring_dynamic_subblocks_lagekombination;
  if (!hasScoring) return baseVars;
  const asset = key.includes("_haus_") ? "haus" : "wohnung";
  const scoringTexts = generateScoringTextbausteine(block, baseVars, asset, rng);
  return { ...baseVars, ...scoringTexts };
}

function buildScoringPlaceholderOptions(block: AnyRecord, baseVars: AnyRecord, key: string) {
  const scoringBlockRaw = block?.scoring_dynamic_subblocks_preisangaben;
  const scoringBlock = scoringBlockRaw && typeof scoringBlockRaw === "object"
    ? (scoringBlockRaw as AnyRecord)
    : null;
  const scoringRaw = scoringBlock?.text_wohnlagen_liste;
  if (!scoringRaw || typeof scoringRaw !== "object") return {} as Record<string, string[]>;

  const scoringCfg = scoringRaw as AnyRecord;
  const sequences = Array.isArray(scoringCfg.sequences_fixed) ? scoringCfg.sequences_fixed : [];
  if (!sequences.length) return {} as Record<string, string[]>;

  const asset = key.includes("_haus_") ? "haus" : "wohnung";
  const detectSuffix = () => {
    const base = `quadratmeterpreis_avg_${asset}_lagescore01`;
    if (baseVars[`${base}_kreis`] !== undefined) return "_kreis";
    if (baseVars[`${base}_ortslage`] !== undefined) return "_ortslage";
    return "";
  };
  const suffix = detectSuffix();
  const priceKey = (metric: "avg" | "min" | "max", score: string) =>
    `quadratmeterpreis_${metric}_${asset}_lagescore${score}${suffix}`;
  const fmtEur = (v: number | null | undefined) => {
    if (v === null || v === undefined) return "";
    return `${Math.round(v).toLocaleString("de-DE")} €`;
  };
  const normalize = (text: string) =>
    text
      .replace(/\s+/g, " ")
      .replace(/\s+,/g, ",")
      .replace(/\s+\./g, ".")
      .replace(/Top-\s+Lagen/g, "Top-Lagen")
      .trim();
  const ensureSentence = (text: string) => {
    const t = normalize(text);
    if (!t) return "";
    return /[.!?]$/.test(t) ? t : `${t}.`;
  };

  const labels = (scoringCfg.label_by_score && typeof scoringCfg.label_by_score === "object")
    ? (scoringCfg.label_by_score as AnyRecord)
    : {};
  const availableScores = ["01", "02", "03", "04", "05"].filter((s) => baseVars[priceKey("avg", s)] != null);

  const expandSequenceSteps = (steps: AnyRecord[], idx: number, used: Set<string>): string[] => {
    if (idx >= steps.length) return [""];
    const step = steps[idx] ?? {};
    const tpl = String(step.template ?? "").trim();
    if (!tpl) return expandSequenceSteps(steps, idx + 1, used);
    const rawScore = String(step.score ?? "any");
    const candidates =
      rawScore === "any"
        ? availableScores.filter((s) => !used.has(s))
        : [rawScore];
    if (!candidates.length) return expandSequenceSteps(steps, idx + 1, used);
    const out: string[] = [];
    for (const score of candidates) {
      const avgRaw = baseVars[priceKey("avg", score)];
      const minRaw = baseVars[priceKey("min", score)];
      const maxRaw = baseVars[priceKey("max", score)];
      const avg = typeof avgRaw === "number" ? avgRaw : null;
      if (avg == null) continue;
      const min = typeof minRaw === "number" ? minRaw : null;
      const max = typeof maxRaw === "number" ? maxRaw : null;
      const ctx: AnyRecord = {
        region_name: baseVars.region_name ?? "",
        label: labels[score] ?? "",
        preis_avg: fmtEur(avg),
        preis_min: fmtEur(min),
        preis_max: fmtEur(max),
      };
      const renderedStep = ensureSentence(renderTemplate(tpl, ctx));
      const nextUsed = new Set(used);
      nextUsed.add(score);
      const tails = expandSequenceSteps(steps, idx + 1, nextUsed);
      for (const tail of tails) {
        out.push(normalize(`${renderedStep} ${tail}`));
      }
    }
    if (!out.length) return expandSequenceSteps(steps, idx + 1, used);
    return out;
  };

  const variants: string[] = [];
  for (const seq of sequences) {
    const steps = Array.isArray((seq as AnyRecord)?.steps) ? ((seq as AnyRecord).steps as AnyRecord[]) : [];
    if (!steps.length) continue;
    const rendered = expandSequenceSteps(steps, 0, new Set<string>());
    variants.push(...rendered.map((v) => normalize(v)).filter(Boolean));
  }

  const unique = Array.from(new Set(variants.map((v) => normalize(v)).filter(Boolean)));
  if (!unique.length) return {} as Record<string, string[]>;
  return { text_wohnlagen_liste: unique };
}

function consumeBlockSelectionRng(rng?: () => number) {
  if (!rng) return;
  rng();
}

function expandStaticVerbkonstrukte(staticBlock: AnyRecord, baseVars: AnyRecord) {
  const options: AnyRecord = {};
  for (const [key, patterns] of Object.entries(staticBlock ?? {})) {
    if (!key.startsWith("verbkonstrukt_")) continue;
    const phraseKey = key.replace("verbkonstrukt_", "phrases_");
    const phrases = (staticBlock as AnyRecord)[phraseKey] ?? [];
    if (!Array.isArray(patterns) || !patterns.length || !Array.isArray(phrases) || !phrases.length) continue;

    const expanded: string[] = [];
    for (const pattern of patterns as string[]) {
      for (const phraseEntry of phrases as AnyRecord[]) {
        const phrase = renderTemplate(String(phraseEntry?.phrase ?? phraseEntry ?? ""), baseVars);
        const aux = String(phraseEntry?.auxiliar ?? "");
        const rendered = renderTemplate(String(pattern), { ...baseVars, phrase, auxiliar: aux });
        expanded.push(rendered);
      }
    }
    options[key] = expanded;
  }
  return options;
}

function expandTrendVerbkonstrukte(definition: AnyRecord, trendValues: AnyRecord, baseVars: AnyRecord) {
  const options: AnyRecord = {};
  const trendBlock = (definition?.trend_verbkonstrukte ?? {}) as Record<string, unknown>;
  const connectorMap: Record<string, { note: string[]; link: string[] }> = {
    optimal: { note: ["glücklicherweise", "erfreulich"], link: ["Gleichzeitig", "Parallel dazu", "Ebenso"] },
    "ungünstig": { note: ["leider", "bedauerlich"], link: ["Gleichzeitig", "Parallel dazu", "Ebenso"] },
    neutral: { note: [""], link: ["Jedoch", "Hingegen"] },
  };
  const connectorType = String(baseVars.connector_type ?? "neutral");
  const connector = connectorMap[connectorType] ?? connectorMap.neutral;
  const connectorVars = {
    note_word: connector.note[0] ?? "",
    link_word: connector.link[0] ?? "Zudem",
  };
  const coarseFallback: Record<string, string> = {
    leicht_groesser: "groesser",
    viel_groesser: "groesser",
    leicht_kleiner: "kleiner",
    viel_kleiner: "kleiner",
  };
  const keys = new Set<string>();
  for (const key of Object.keys(trendBlock)) {
    if (key.startsWith("phrases_")) keys.add(key.replace("phrases_", ""));
    if (key.startsWith("verbkonstrukt_")) keys.add(key.replace("verbkonstrukt_", ""));
  }

  for (const trendKey of keys) {
    if (!trendKey.startsWith("trendText_")) continue;
    const phrasesKey = `phrases_${trendKey}`;
    const verbKey = `verbkonstrukt_${trendKey}`;
    const phrasesByCategory = (trendBlock[phrasesKey] ?? {}) as Record<string, unknown>;
    const verbByCategory = (trendBlock[verbKey] ?? {}) as Record<string, unknown>;

    const trendValueRaw = trendValues[trendKey];
    const trendValue = trendValueRaw && typeof trendValueRaw === "object"
      ? (trendValueRaw as AnyRecord)
      : {};
    let category = "gleich";
    if (typeof trendValue.index1 === "number") category = determineIndex1Category(trendValue.index1);
    else if (typeof trendValue.index100 === "number") category = determineIndex100Category(trendValue.index100);
    else if (typeof trendValue.rel_change === "number") category = determineTrendCategory(trendValue.rel_change);
    else if (typeof trendValue.abs_delta === "number") category = determineAbsoluteCategoryWithDirection(trendValue.abs_delta);
    else if (
      trendValue.direct_comparison &&
      typeof trendValue.direct_comparison === "object" &&
      typeof (trendValue.direct_comparison as AnyRecord).value_a === "number" &&
      typeof (trendValue.direct_comparison as AnyRecord).value_b === "number"
    ) {
      const directComparison = trendValue.direct_comparison as AnyRecord;
      category = determineSimpleComparisonCategory(directComparison.value_a as number, directComparison.value_b as number);
    } else if (typeof trendValue.index50 === "number") category = determineIndex50Category(trendValue.index50);

    const templateCategory = mapTrendCategoryToTemplateKey(category);
    const fallbackCategory = coarseFallback[templateCategory];
    const phraseEntries =
      phrasesByCategory[templateCategory] ??
      (fallbackCategory ? phrasesByCategory[fallbackCategory] : []) ??
      [];
    const verbPatterns =
      verbByCategory[templateCategory] ??
      (fallbackCategory ? verbByCategory[fallbackCategory] : []) ??
      [];
    if (!Array.isArray(phraseEntries) || !phraseEntries.length) continue;

    const renderedPhrases = phraseEntries.map((entry: AnyRecord) =>
      renderTemplate(String(entry?.phrase ?? entry ?? ""), baseVars),
    );
    options[trendKey] = renderedPhrases;

    if (Array.isArray(verbPatterns) && verbPatterns.length) {
      const expanded: string[] = [];
      for (const pattern of verbPatterns as string[]) {
        for (const phraseEntry of phraseEntries as AnyRecord[]) {
          const phrase = renderTemplate(String(phraseEntry?.phrase ?? phraseEntry ?? ""), baseVars);
          const aux = String(phraseEntry?.auxiliar ?? "");
          const rendered = renderTemplate(String(pattern), { ...baseVars, ...connectorVars, phrase, auxiliar: aux });
          expanded.push(rendered);
        }
      }
      options[verbKey] = expanded;
    }
  }
  return options;
}

function applyTrendBaseVars(trendValues: AnyRecord, baseVars: AnyRecord) {
  for (const [trendKey, trendData] of Object.entries(trendValues ?? {})) {
    if (!trendKey.startsWith("trendText_")) continue;
    const baseKey = trendKey.replace(/^trendText_/, "");
    if (baseKey in baseVars) continue;
    if (!trendData || typeof trendData !== "object") continue;
    const trendDataObj = trendData as AnyRecord;

    const isSaldoKey = /saldo/i.test(baseKey);
    if (isSaldoKey && typeof trendDataObj.abs_delta === "number") {
      baseVars[baseKey] = Math.abs(trendDataObj.abs_delta).toLocaleString("de-DE", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      });
      continue;
    }

    if (typeof trendDataObj.rel_change === "number") {
      baseVars[baseKey] = Math.abs(trendDataObj.rel_change).toLocaleString("de-DE", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      });
      continue;
    }
    if (typeof trendDataObj.abs_delta === "number") {
      baseVars[baseKey] = trendDataObj.abs_delta.toLocaleString("de-DE", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      });
      continue;
    }
    if (typeof trendDataObj.index1 === "number") {
      baseVars[baseKey] = trendDataObj.index1.toLocaleString("de-DE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      continue;
    }
    if (typeof trendDataObj.index100 === "number") {
      baseVars[baseKey] = trendDataObj.index100.toLocaleString("de-DE", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      });
      continue;
    }
  }
}

function expandTemplates(templates: AnyRecord, baseVars: AnyRecord, options: AnyRecord) {
  const results: string[] = [];
  const allTemplates = templates ?? {};
  const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (const mode of Object.keys(allTemplates)) {
    const listRaw = allTemplates[mode];
    const list = Array.isArray(listRaw) ? listRaw : [];
    for (const template of list) {
      const raw = String(template);
      const keys = Array.from(new Set(raw.match(/{{\s*([^}]+)\s*}}/g) ?? []))
        .map((m) => m.replace(/{{\s*|\s*}}/g, ""));
      let variants = [raw];
      for (const key of keys) {
        const choicesRaw = options[key];
        const choices = Array.isArray(choicesRaw) ? choicesRaw : [baseVars[key] ?? ""];
        const next: string[] = [];
        const pattern = new RegExp(`{{\\s*${escapeRegExp(key)}\\s*}}`, "g");
        for (const variant of variants) {
          for (const choice of choices) {
            next.push(variant.replace(pattern, String(choice)));
          }
        }
        variants = next;
      }
      results.push(...variants.map((value) => normalizeGeneratedText(value)).filter(Boolean));
    }
  }
  return results;
}

function normalizeGeneratedText(text: string) {
  return String(text)
    .replace(/ {2,}/g, " ")
    .replace(/\.{2,}/g, ".")
    .replace(/\.\s*\./g, ".")
    .replace(/ +([,.!?;:])/g, "$1")
    .replace(/\.{2,}/g, ".")
    .trim();
}

function countTemplateVariants(raw: string, options: AnyRecord) {
  const keys = Array.from(new Set(raw.match(/{{\s*([^}]+)\s*}}/g) ?? []))
    .map((m) => m.replace(/{{\s*|\s*}}/g, ""));
  return keys.reduce((acc, key) => {
    const choices = options[key];
    const count = Array.isArray(choices) && choices.length ? choices.length : 1;
    return acc * count;
  }, 1);
}

function* iterateTemplateVariants(raw: string, options: AnyRecord, baseVars: AnyRecord) {
  const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const keys = Array.from(new Set(raw.match(/{{\s*([^}]+)\s*}}/g) ?? []))
    .map((m) => m.replace(/{{\s*|\s*}}/g, ""));

  function* walk(current: string, index: number): Generator<string> {
    if (index >= keys.length) {
      yield normalizeGeneratedText(current);
      return;
    }
    const key = keys[index];
    const choices = Array.isArray(options[key]) && options[key].length
      ? options[key]
      : [baseVars[key] ?? ""];
    const pattern = new RegExp(`{{\\s*${escapeRegExp(key)}\\s*}}`, "g");
    for (const choice of choices) {
      const next = current.replace(pattern, String(choice));
      yield* walk(next, index + 1);
    }
  }

  yield* walk(raw, 0);
}

function renderTemplateVariantAt(raw: string, options: AnyRecord, baseVars: AnyRecord, index: number) {
  const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const keys = Array.from(new Set(raw.match(/{{\s*([^}]+)\s*}}/g) ?? []))
    .map((m) => m.replace(/{{\s*|\s*}}/g, ""));
  const counts = keys.map((key) => {
    const choices = Array.isArray(options[key]) && options[key].length
      ? options[key]
      : [baseVars[key] ?? ""];
    return choices.length || 1;
  });
  const total = counts.reduce((acc, count) => acc * count, 1);
  if (total <= 0 || index < 0 || index >= total) return null;

  const suffix = new Array(counts.length).fill(1);
  for (let i = counts.length - 2; i >= 0; i -= 1) {
    suffix[i] = suffix[i + 1] * counts[i + 1];
  }

  let current = raw;
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    const choices = Array.isArray(options[key]) && options[key].length
      ? options[key]
      : [baseVars[key] ?? ""];
    const blockSize = suffix[i] ?? 1;
    const choiceIndex = Math.floor(index / blockSize) % choices.length;
    const pattern = new RegExp(`{{\\s*${escapeRegExp(key)}\\s*}}`, "g");
    current = current.replace(pattern, String(choices[choiceIndex] ?? ""));
  }

  return normalizeGeneratedText(current);
}

function buildSampleIndexes(total: number, sampleSize: number) {
  if (total <= 0) return [];
  if (total <= sampleSize) {
    return Array.from({ length: total }, (_, i) => i);
  }
  if (sampleSize <= 1) return [0];
  const set = new Set<number>();
  for (let i = 0; i < sampleSize; i += 1) {
    const idx = Math.round((i * (total - 1)) / (sampleSize - 1));
    set.add(idx);
  }
  return Array.from(set).sort((a, b) => a - b);
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash +=
      (hash << 1) +
      (hash << 4) +
      (hash << 7) +
      (hash << 8) +
      (hash << 24);
  }
  return (hash >>> 0).toString(16);
}

function collectTemplatePlaceholders(definition: AnyRecord) {
  const placeholders = new Set<string>();
  const serialized = JSON.stringify(definition ?? {});
  const regex = /{{\s*([^}]+)\s*}}/g;
  let match: RegExpExecArray | null = null;
  while ((match = regex.exec(serialized)) !== null) {
    const key = String(match[1] ?? "").trim();
    if (!key) continue;
    placeholders.add(key);
  }
  return placeholders;
}

function collectTrendDependencyKeys(definition: AnyRecord) {
  const deps = new Set<string>();
  const normalizeYear01Stem = (stem: string) => (stem.endsWith("_jahr01") ? stem.slice(0, -7) : stem);
  for (const trendKey of trendKeyCandidates(definition)) {
    if (!trendKey.startsWith("trendText_")) continue;
    const base = trendKey.replace(/^trendText_/, "");

    if (base.endsWith("_vergleich_ortslage_kreis")) {
      const stem = normalizeYear01Stem(base.replace(/_vergleich_ortslage_kreis$/, ""));
      deps.add(`${stem}_jahr01_ortslage`);
      deps.add(`${stem}_jahr01_kreis`);
      continue;
    }

    if (base.endsWith("_vergleich_ortslage_bundesland")) {
      const stem = normalizeYear01Stem(base.replace(/_vergleich_ortslage_bundesland$/, ""));
      deps.add(`${stem}_jahr01_ortslage`);
      deps.add(`${stem}_jahr01_bundesland`);
      continue;
    }

    if (base.endsWith("_vergleich_ortslage_land")) {
      const stem = normalizeYear01Stem(base.replace(/_vergleich_ortslage_land$/, ""));
      deps.add(`${stem}_jahr01_ortslage`);
      deps.add(`${stem}_jahr01_land`);
      continue;
    }

    const twoTrend = base.match(/^(.*)_2jahrestrend_(ortslage)$/);
    if (twoTrend) {
      const stem = twoTrend[1];
      deps.add(`${stem}_jahr01_ortslage`);
      deps.add(`${stem}_jahr02_ortslage`);
      continue;
    }

    const twoTrendKreis = base.match(/^(.*)_2jahrestrend_(kreis)$/);
    if (twoTrendKreis) {
      const stem = twoTrendKreis[1];
      deps.add(`${stem}_jahr01_kreis`);
      deps.add(`${stem}_jahr02_kreis`);
      continue;
    }

    const fiveTrend = base.match(/^(.*)_5jahrestrend_(ortslage)$/);
    if (fiveTrend) {
      const stem = fiveTrend[1];
      deps.add(`${stem}_jahr01_ortslage`);
      deps.add(`${stem}_jahr05_ortslage`);
      continue;
    }

    const fiveTrendKreis = base.match(/^(.*)_5jahrestrend_(kreis)$/);
    if (fiveTrendKreis) {
      const stem = fiveTrendKreis[1];
      deps.add(`${stem}_jahr01_kreis`);
      deps.add(`${stem}_jahr05_kreis`);
      continue;
    }

    const tenTrend = base.match(/^(.*)_10jahrestrend_(ortslage)$/);
    if (tenTrend) {
      const stem = tenTrend[1];
      deps.add(`${stem}_jahr01_ortslage`);
      deps.add(`${stem}_jahr10_ortslage`);
      continue;
    }

    const tenSaldo = base.match(/^(.*)_10jahressaldo_(ortslage)$/);
    if (tenSaldo) {
      const stem = tenSaldo[1];
      deps.add(`${stem}_jahr01_ortslage`);
      deps.add(`${stem}_jahr10_ortslage`);
      continue;
    }

    const fiveSaldo = base.match(/^(.*)_5jahresSaldo_(ortslage)$/);
    if (fiveSaldo) {
      const stem = fiveSaldo[1];
      deps.add(`${stem}_jahr01_ortslage`);
      deps.add(`${stem}_jahr05_ortslage`);
      continue;
    }

    const vorjahrTrend = base.match(/^(.*)_vorjahrestrend_(ortslage)$/);
    if (vorjahrTrend) {
      const stem = vorjahrTrend[1];
      deps.add(`${stem}_jahr01_ortslage`);
      deps.add(`${stem}_jahr02_ortslage`);
      continue;
    }

    const vorjahrSaldo = base.match(/^(.*)_vorjahressaldo_(ortslage)$/);
    if (vorjahrSaldo) {
      const stem = vorjahrSaldo[1];
      deps.add(`${stem}_jahr01_ortslage`);
      deps.add(`${stem}_jahr02_ortslage`);
      continue;
    }

    if (base.includes("jugendquotient_altenquotient_vergleich")) {
      deps.add("altenquotient_ortslage");
      deps.add("jugendquotient_ortslage");
      continue;
    }

    if (base.startsWith("regionentyp_")) {
      deps.add("einwohneranzahl_jahr01_ortslage");
      deps.add("einwohneranzahl_jahr05_ortslage");
      continue;
    }

    const indexMatch = base.match(/^(.*)_index(?:_jahr01)?_ortslage$/);
    if (indexMatch) {
      const stem = indexMatch[1];
      deps.add(base);
      deps.add(`${stem}_jahr01_ortslage`);
      deps.add(`${stem}_jahr01_land`);
      continue;
    }

    if (base.includes("vergleich_neubau_bestand")) {
      deps.add("quadratmeterkaltmiete_avg_wohnung_neubau_jahr01_ortslage");
      deps.add("quadratmeterkaltmiete_avg_wohnung_bestand_jahr01_ortslage");
      continue;
    }
  }
  return deps;
}

function buildDefinitionSignature(definition: AnyRecord, raw: AnyRecord, inputData: AnyRecord) {
  const payload: AnyRecord = {};
  payload.template_hash = hashString(JSON.stringify(definition ?? {}));
  const placeholders = collectTemplatePlaceholders(definition);
  placeholders.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(inputData, key)) {
      payload[`tpl:${key}`] = inputData[key];
    } else if (Object.prototype.hasOwnProperty.call(raw, key)) {
      payload[`tpl:${key}`] = raw[key];
    }
  });

  const trendDeps = collectTrendDependencyKeys(definition);
  trendDeps.forEach((key) => {
    payload[`trend:${key}`] = Object.prototype.hasOwnProperty.call(raw, key) ? raw[key] : null;
  });

  const stable = Object.keys(payload)
    .sort()
    .reduce((acc: AnyRecord, key) => {
      acc[key] = payload[key];
      return acc;
    }, {});
  return hashString(JSON.stringify(stable));
}

function resolveDefinitionKey(key: string, raw: AnyRecord) {
  if (key === "wohnmarktsituation_bauueberhang_baufortschritt") return "wohnmarktsituation_bauueberhang";
  if (key === "wirtschaft_sv_beschaeftigte_arbeitsort") return "wirtschaft_sv_beschaeftigte_arbeits_und_wohnort";
  if (key === "wirtschaft_arbeitsplatzzentralitaet") {
    const v = raw?.arbeitsplatzzentralitaet_ortslage;
    return !v ? "wirtschaft_arbeitsplatzzentralitaet_kreis" : "wirtschaft_arbeitsplatzzentralitaet_ortslage";
  }
  if (key === "wirtschaft_pendler") {
    const einRaw = raw?.einpendler_jahr01_ortslage;
    const ausRaw = raw?.auspendler_jahr01_ortslage;
    const ein = typeof einRaw === "number" ? einRaw : Number(einRaw);
    const aus = typeof ausRaw === "number" ? ausRaw : Number(ausRaw);
    const hasEin = Number.isFinite(ein);
    const hasAus = Number.isFinite(aus);
    return !hasEin || !hasAus ? "wirtschaft_pendler_kreis" : "wirtschaft_pendler_ortslage";
  }
  if (key === "wirtschaft_arbeitslosigkeit") {
    const qRaw = raw?.arbeitslosenquote_jahr01_ortslage;
    const q = typeof qRaw === "number" ? qRaw : Number(qRaw);
    return Number.isFinite(q) ? "wirtschaft_arbeitslosigkeit_ortslage" : "wirtschaft_arbeitslosigkeit_kreis";
  }
  return key;
}

export function buildOrtslageSectionSignatures(inputs: AnyRecord) {
  const { inputData, raw } = buildInputData(inputs);
  const signatures: Record<string, string> = {};
  for (const [, key] of ORTSLAGE_TEXT_MAP) {
    const defKey = resolveDefinitionKey(key, raw);
    const definition =
      (ortslagePhrases as AnyRecord)[defKey] ??
      (ortslageWohnraumPhrases as AnyRecord)[defKey] ??
      (ortslageWirtschaftPhrases as AnyRecord)[defKey];
    if (!definition) continue;
    signatures[key] = buildDefinitionSignature(definition as AnyRecord, raw, inputData);
  }
  return signatures;
}

function generateFromDefinition(defKey: string, inputData: AnyRecord, raw: AnyRecord, rng?: () => number) {
  const resolvedKey = resolveDefinitionKey(defKey, raw);
  const definition =
    (ortslagePhrases as AnyRecord)[resolvedKey] ??
    (ortslageWohnraumPhrases as AnyRecord)[resolvedKey] ??
    (ortslageWirtschaftPhrases as AnyRecord)[resolvedKey];
  if (!definition) return null;
  const definitionObj = definition as AnyRecord;
  const blocksRaw = definitionObj.text_blocks;
  const blocks = Array.isArray(blocksRaw) ? (blocksRaw as AnyRecord[]) : [];
  if (blocks.length === 0) {
    throw new Error(`'text_blocks' fehlt oder ist keine Liste in Definition '${resolvedKey}'.`);
  }
  const block = pickRandom(blocks, rng);
  const trendValues = computeTrendValues(block, raw);
  const localInput = { ...inputData };
  let connectorConfig: AnyRecord | undefined;
  let quoteValues: AnyRecord | undefined;

  if (resolvedKey === "wohnmarktsituation_wanderungssaldo") {
    if (localInput.wanderungssaldo_no_data_beide_ortslage) {
      return null;
    }

    const relZuzPct = getTrendRelChange(trendValues, "trendText_wanderungssaldo_zuzuege_5jahrestrend_ortslage");
    const relFortPct = getTrendRelChange(trendValues, "trendText_wanderungssaldo_fortzuege_5jahrestrend_ortslage");
    const relZuz = Number.isFinite(relZuzPct) ? relZuzPct / 100 : 0;
    const relFort = Number.isFinite(relFortPct) ? relFortPct / 100 : 0;

    const connectorType = determineGenericConnectorType(relZuz, relFort, 0.02);
    connectorConfig = {
      optimal: {
        note: ["glücklicherweise", "erfreulich"],
        link: ["Gleichzeitig", "Parallel dazu", "Ebenso"],
      },
      ungünstig: {
        note: ["leider", "bedauerlich"],
        link: ["Gleichzeitig", "Parallel dazu", "Ebenso"],
      },
      neutral: {
        note: [""],
        link: ["Jedoch", "Hingegen"],
      },
    };

    localInput.connector_type = connectorType;
  }

  if (resolvedKey === "wohnmarktsituation_bauueberhang") {
    if (localInput.bauueberhang_no_data_basis_kreis) {
      return "";
    }
    const datenbasis = String(localInput.bauueberhang_datenbasis ?? "");
    if (datenbasis === "kreis") {
      localInput.bauueberhang_datenbasis_hinweis = pickRandom(
        [
          "Hinweis: Für diese Ortslage basieren die Kennzahlen auf Kreisdaten.",
          "Hinweis: Für diese Auswertung wurden mangels belastbarer Ortslagedaten die Kreisdaten herangezogen.",
          "Hinweis: Da für diese Ortslage keine konsistente Zeitreihe vorliegt, wird auf Kreisdaten zurückgegriffen.",
        ],
        rng,
      );
    } else {
      localInput.bauueberhang_datenbasis_hinweis = "";
    }
    const bauQuote = toFinite(raw.bauueberhangsquote_kreis);
    const fertQuote = toFinite(raw.fertigstellungsquote_kreis);
    if (bauQuote !== null && fertQuote !== null) {
      quoteValues = {
        bauueberhangsquote_kreis: Math.round(bauQuote),
        fertigstellungsquote_kreis: Math.round(fertQuote),
      };
    }
  }

  if (resolvedKey === "wirtschaft_sv_beschaeftigte_arbeits_und_wohnort") {
    const hasArbeitsortTrend = Boolean(trendValues.trendText_sv_pflichtig_beschaeftigte_arbeitsort_5jahrestrend_ortslage);
    const hasWohnortTrend = Boolean(trendValues.trendText_sv_pflichtig_beschaeftigte_wohnort_5jahrestrend_ortslage);

    if (!hasArbeitsortTrend && hasWohnortTrend) {
      localInput.sondertext_beschaeftigte_arbeitsort =
        "Für den Arbeitsort liegen in dieser Ortslage derzeit keine belastbaren Vergleichsdaten vor.";
      localInput.sondertext_beschaeftigte_wohnort =
        `Am Wohnort liegt die Zahl der Beschäftigten aktuell bei ${localInput.sv_pflichtig_beschaeftigte_wohnort_jahr01_ortslage}.`;
    } else if (hasArbeitsortTrend && !hasWohnortTrend) {
      localInput.sondertext_beschaeftigte_wohnort =
        "Für den Wohnort liegen in dieser Ortslage derzeit keine belastbaren Vergleichsdaten vor.";
      localInput.sondertext_beschaeftigte_arbeitsort =
        `Am Arbeitsort liegt die Zahl der Beschäftigten aktuell bei ${localInput.sv_pflichtig_beschaeftigte_arbeitsort_jahr01_ortslage}.`;
    } else if (!hasArbeitsortTrend && !hasWohnortTrend) {
      localInput.sondertext_beschaeftigte_arbeitsort =
        "Für Arbeits- und Wohnort liegen in dieser Ortslage derzeit keine belastbaren Vergleichsdaten vor.";
      localInput.sondertext_beschaeftigte_wohnort = "";
    }
  }

  if (resolvedKey === "wirtschaft_sv_beschaeftigte_wohnort") {
    const hasWohnortTrend = Boolean(trendValues.trendText_sv_pflichtig_beschaeftigte_wohnort_5jahrestrend_ortslage);
    if (!hasWohnortTrend) {
      const current = String(localInput.sv_pflichtig_beschaeftigte_wohnort_jahr01_ortslage ?? "").trim();
      localInput.sondertext_beschaeftigte_wohnort = current
        ? `Aktuell liegt die Zahl der Wohnort-Beschäftigten bei ${current}. Für den Fünfjahrestrend liegen in dieser Ortslage derzeit keine belastbaren Vergleichsdaten vor.`
        : "Für die Wohnort-Beschäftigten liegen in dieser Ortslage derzeit keine belastbaren Vergleichsdaten vor.";
    }
  }

  return generateText(block, localInput, trendValues, resolvedKey, quoteValues, connectorConfig, rng);
}

function deriveWanderungConnectorTypeOrtslage(trendValues: AnyRecord) {
  const relZuzPct = getTrendRelChange(trendValues, "trendText_wanderungssaldo_zuzuege_5jahrestrend_ortslage");
  const relFortPct = getTrendRelChange(trendValues, "trendText_wanderungssaldo_fortzuege_5jahrestrend_ortslage");
  const relZuz = Number.isFinite(relZuzPct) ? relZuzPct / 100 : 0;
  const relFort = Number.isFinite(relFortPct) ? relFortPct / 100 : 0;
  return determineGenericConnectorType(relZuz, relFort, 0.02);
}

export function generateOrtslagePriceTexts(
  text: AnyRecord,
  inputs: AnyRecord,
  allowedKeys?: Set<string>,
  rngByKey?: (key: string) => () => number,
) {
  const { inputData, raw } = buildInputData(inputs);
  const updated = { ...text };

  for (const [group, key] of ORTSLAGE_TEXT_MAP) {
    if (allowedKeys && !allowedKeys.has(key)) continue;
    if (!updated[group]) continue;
    const textValue = generateFromDefinition(key, inputData, raw, rngByKey ? rngByKey(key) : undefined);
    if (textValue !== null && textValue !== undefined) {
      updated[group] = { ...updated[group], [key]: textValue };
    }
  }

  return updated;
}

export function generateOrtslageTextVariants(key: string, inputs: AnyRecord) {
  const definition = computeTextDefinition(key);
  if (!definition) return [];
  const { inputData, raw } = buildInputData(inputs);
  const resolvedKey = resolveDefinitionKey(key, raw);
  const blocksRaw = definition.text_blocks;
  const blocks = Array.isArray(blocksRaw) ? (blocksRaw as AnyRecord[]) : [];
  if (!blocks.length) return [];
  if (resolvedKey === "wohnmarktsituation_wanderungssaldo" && inputData.wanderungssaldo_no_data_beide_ortslage) return [];
  if (resolvedKey === "wohnmarktsituation_bauueberhang" && inputData.bauueberhang_no_data_basis_kreis) return [];

  consumeBlockSelectionRng();
  const allVariants: string[] = [];
  for (const block of blocks) {
    const trendValues = computeTrendValues(block, raw);
    const baseVarsRaw = { ...inputData };
    if (resolvedKey === "wohnmarktsituation_wanderungssaldo") {
      baseVarsRaw.connector_type = deriveWanderungConnectorTypeOrtslage(trendValues);
    }
    applyTrendBaseVars(trendValues, baseVarsRaw);
    const scoringOptions = buildScoringPlaceholderOptions(block, baseVarsRaw, key);
    const baseVars = Object.keys(scoringOptions).length
      ? baseVarsRaw
      : enrichBaseVarsForScoring(block, baseVarsRaw, key);
    const staticOptions = expandStaticVerbkonstrukte(toRecord(block.static_verbkonstrukte), baseVars);
    const trendOptions = expandTrendVerbkonstrukte(block, trendValues, baseVars);
    const options = { ...staticOptions, ...trendOptions, ...scoringOptions };
    const variants = expandTemplates(toRecord(block.templates), baseVars, options);
    allVariants.push(...variants);
  }

  return allVariants;
}

export function countOrtslageTextVariants(key: string, inputs: AnyRecord) {
  const definition = computeTextDefinition(key);
  if (!definition) return 0;
  const { inputData, raw } = buildInputData(inputs);
  const resolvedKey = resolveDefinitionKey(key, raw);
  const blocksRaw = definition.text_blocks;
  const blocks = Array.isArray(blocksRaw) ? (blocksRaw as AnyRecord[]) : [];
  if (!blocks.length) return 0;
  if (resolvedKey === "wohnmarktsituation_wanderungssaldo" && inputData.wanderungssaldo_no_data_beide_ortslage) return 0;
  if (resolvedKey === "wohnmarktsituation_bauueberhang" && inputData.bauueberhang_no_data_basis_kreis) return 0;

  consumeBlockSelectionRng();
  let total = 0;
  for (const block of blocks) {
    const trendValues = computeTrendValues(block, raw);
    const baseVarsRaw = { ...inputData };
    if (resolvedKey === "wohnmarktsituation_wanderungssaldo") {
      baseVarsRaw.connector_type = deriveWanderungConnectorTypeOrtslage(trendValues);
    }
    applyTrendBaseVars(trendValues, baseVarsRaw);
    const scoringOptions = buildScoringPlaceholderOptions(block, baseVarsRaw, key);
    const baseVars = Object.keys(scoringOptions).length
      ? baseVarsRaw
      : enrichBaseVarsForScoring(block, baseVarsRaw, key);
    const staticOptions = expandStaticVerbkonstrukte(toRecord(block.static_verbkonstrukte), baseVars);
    const trendOptions = expandTrendVerbkonstrukte(block, trendValues, baseVars);
    const options = { ...staticOptions, ...trendOptions, ...scoringOptions };
    const templates = toRecord(block.templates);
    for (const list of Object.values(templates)) {
      if (!Array.isArray(list)) continue;
      for (const tpl of list) {
        total += countTemplateVariants(String(tpl), options);
      }
    }
  }
  return total;
}

export function* iterateOrtslageTextVariants(key: string, inputs: AnyRecord): Generator<string> {
  const definition = computeTextDefinition(key);
  if (!definition) return;
  const { inputData, raw } = buildInputData(inputs);
  const resolvedKey = resolveDefinitionKey(key, raw);
  const blocksRaw = definition.text_blocks;
  const blocks = Array.isArray(blocksRaw) ? (blocksRaw as AnyRecord[]) : [];
  if (!blocks.length) return;
  if (resolvedKey === "wohnmarktsituation_wanderungssaldo" && inputData.wanderungssaldo_no_data_beide_ortslage) return;
  if (resolvedKey === "wohnmarktsituation_bauueberhang" && inputData.bauueberhang_no_data_basis_kreis) return;

  consumeBlockSelectionRng();
  for (const block of blocks) {
    const trendValues = computeTrendValues(block, raw);
    const baseVarsRaw = { ...inputData };
    if (resolvedKey === "wohnmarktsituation_wanderungssaldo") {
      baseVarsRaw.connector_type = deriveWanderungConnectorTypeOrtslage(trendValues);
    }
    applyTrendBaseVars(trendValues, baseVarsRaw);
    const scoringOptions = buildScoringPlaceholderOptions(block, baseVarsRaw, key);
    const baseVars = Object.keys(scoringOptions).length
      ? baseVarsRaw
      : enrichBaseVarsForScoring(block, baseVarsRaw, key);
    const staticOptions = expandStaticVerbkonstrukte(toRecord(block.static_verbkonstrukte), baseVars);
    const trendOptions = expandTrendVerbkonstrukte(block, trendValues, baseVars);
    const options = { ...staticOptions, ...trendOptions, ...scoringOptions };
    const templates = toRecord(block.templates);
    for (const list of Object.values(templates)) {
      if (!Array.isArray(list)) continue;
      for (const tpl of list) {
        yield* iterateTemplateVariants(String(tpl), options, baseVars);
      }
    }
  }
}

export function sampleOrtslageTextVariants(key: string, inputs: AnyRecord, sampleSize = 50) {
  const definition = computeTextDefinition(key);
  if (!definition) return { total: 0, samples: [] as Array<{ index: number; text: string }> };
  const { inputData, raw } = buildInputData(inputs);
  const resolvedKey = resolveDefinitionKey(key, raw);
  const blocksRaw = definition.text_blocks;
  const blocks = Array.isArray(blocksRaw) ? (blocksRaw as AnyRecord[]) : [];
  if (!blocks.length) return { total: 0, samples: [] };
  if (resolvedKey === "wohnmarktsituation_wanderungssaldo" && inputData.wanderungssaldo_no_data_beide_ortslage) {
    return { total: 0, samples: [] };
  }
  if (resolvedKey === "wohnmarktsituation_bauueberhang" && inputData.bauueberhang_no_data_basis_kreis) {
    return { total: 0, samples: [] };
  }

  consumeBlockSelectionRng();
  const templates: Array<{ template: string; options: AnyRecord; baseVars: AnyRecord; count: number }> = [];
  let total = 0;

  for (const block of blocks) {
    const trendValues = computeTrendValues(block, raw);
    const baseVarsRaw = { ...inputData };
    if (resolvedKey === "wohnmarktsituation_wanderungssaldo") {
      baseVarsRaw.connector_type = deriveWanderungConnectorTypeOrtslage(trendValues);
    }
    applyTrendBaseVars(trendValues, baseVarsRaw);
    const scoringOptions = buildScoringPlaceholderOptions(block, baseVarsRaw, key);
    const baseVars = Object.keys(scoringOptions).length
      ? baseVarsRaw
      : enrichBaseVarsForScoring(block, baseVarsRaw, key);
    const staticOptions = expandStaticVerbkonstrukte(toRecord(block.static_verbkonstrukte), baseVars);
    const trendOptions = expandTrendVerbkonstrukte(block, trendValues, baseVars);
    const options = { ...staticOptions, ...trendOptions, ...scoringOptions };
    const tplMap = toRecord(block.templates);
    for (const list of Object.values(tplMap)) {
      if (!Array.isArray(list)) continue;
      for (const tpl of list) {
        const rawTpl = String(tpl);
        const count = countTemplateVariants(rawTpl, options);
        total += count;
        templates.push({ template: rawTpl, options, baseVars, count });
      }
    }
  }

  const sampleIndexes = buildSampleIndexes(total, sampleSize);
  const samples: Array<{ index: number; text: string }> = [];
  for (const globalIndex of sampleIndexes) {
    let offset = globalIndex;
    for (const entry of templates) {
      if (offset < entry.count) {
        const rendered = renderTemplateVariantAt(entry.template, entry.options, entry.baseVars, offset);
        if (rendered) samples.push({ index: globalIndex + 1, text: rendered });
        break;
      }
      offset -= entry.count;
    }
  }

  return { total, samples };
}
