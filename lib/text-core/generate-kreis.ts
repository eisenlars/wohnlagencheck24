import {
  generateTextFromMultiblock,
  formatPriceValue,
  capitalizeWords,
  umlauteUmwandeln,
} from "@/lib/text-core/core";

import kreisPreisPhrases from "@/lib/text-core/phrases/kreis/immobilienpreise.json";
import kreisUeberblickPhrases from "@/lib/text-core/phrases/kreis/immobilienmarkt.json";

type AnyRecord = Record<string, any>;

export const KREIS_TEXT_MAP: Array<[string, string]> = [
  ["immobilienmarkt_ueberblick", "immobilienmarkt_beschreibung_01"],
  ["immobilienmarkt_ueberblick", "immobilienmarkt_beschreibung_02"],
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
];

function formatNumber(value: number, decimals = 0) {
  return value.toLocaleString("de-DE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
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
  const {
    year01,
    regionale_zuordnung,
    kreis_name,
    bundesland_name,
    statValues_locationFactors_dict,
    statValues_generally_dict,
    statValues_livingSpaceDemand_dict,
    statValues_livingSpaceOffer_dict,
    statValues_economy_dict,
    marketValues_generallyPrices_dict,
    priceValues_properties_dict,
    priceValues_plots_dict,
    priceValues_rent_dict,
    priceValues_rendite_dict,
    ortslagenValues_dict,
  } = inputs;

  const kreisName = capitalizeWords(umlauteUmwandeln(String(kreis_name ?? "")));
  const bundeslandName = capitalizeWords(umlauteUmwandeln(String(bundesland_name ?? "")));
  const inOderIm = regionale_zuordnung === "landkreis" ? "im" : "in";
  const derOder = regionale_zuordnung === "landkreis" ? "der" : "";
  const fuerOder = regionale_zuordnung === "landkreis" ? "für den" : "für";

  const raw: AnyRecord = {
    region_name: kreisName,
    kreis_name: kreisName,
    bundesland_name: bundeslandName,
    in_oder_im: inOderIm,
    der_oder_: derOder,
    fuer_oder_fuerden: fuerOder,
    jahr01: year01,
    jahr02: year01 - 1,
    jahr05: year01 - 4,
    jahr01_minus_1: year01 - 1,
    ...statValues_locationFactors_dict,
    ...statValues_generally_dict,
    ...statValues_livingSpaceDemand_dict,
    ...statValues_livingSpaceOffer_dict,
    ...statValues_economy_dict,
    ...marketValues_generallyPrices_dict,
    ...priceValues_properties_dict,
    ...priceValues_plots_dict,
    ...priceValues_rent_dict,
    ...priceValues_rendite_dict,
    ...ortslagenValues_dict,
  };

  const inputData: AnyRecord = { ...raw };
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== "number" || Number.isNaN(value)) continue;
    if (key.includes("lagescore")) {
      inputData[key] = value;
      continue;
    }
    inputData[key] = formatValueForKey(key, value);
  }

  enrichKreisUebersichtInput(inputData, raw);

  return { inputData, raw };
}

function toFinite(value: any) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function pctAbs(current: number | null, previous: number | null) {
  if (current === null || previous === null || previous === 0) return "0,0 %";
  return `${formatNumber(Math.abs(((current - previous) / previous) * 100), 1).replace(".", ",")} %`;
}

function formatEuroSqm(value: number | null, decimals = 0) {
  if (value === null) return "--- €/m²";
  if (decimals > 0) return `${formatNumber(value, decimals).replace(".", ",")} €/m²`;
  return `${formatNumber(formatPriceValue(value), 0)} €/m²`;
}

function enrichKreisUebersichtInput(inputData: AnyRecord, raw: AnyRecord) {
  const immo01 = toFinite(raw.immobilienpreise_mittel_jahr01_kreis);
  const immo02 = toFinite(raw.immobilienpreise_mittel_jahr02_kreis);
  const immo05 = toFinite(raw.immobilienpreise_mittel_jahr05_kreis);
  const immoBL = toFinite(raw.immobilienpreise_mittel_jahr01_bundesland);

  const plot01 = toFinite(raw.grundstueckspreise_mittel_jahr01_kreis);
  const plot02 = toFinite(raw.grundstueckspreise_mittel_jahr02_kreis);
  const plot05 = toFinite(raw.grundstueckspreise_mittel_jahr05_kreis);
  const plotBL = toFinite(raw.grundstueckspreise_mittel_jahr01_bundesland);

  const rent01 = toFinite(raw.mietpreise_mittel_kreis);
  const rent02 = toFinite(raw.mietpreise_mittel_kreis_vorjahr);
  const rent05 = toFinite(raw.mietpreise_mittel_kreis_vor_5_jahren);
  const rentBL = toFinite(raw.mietpreise_mittel_bundesland);

  const ortslagenAnzahl = toFinite(raw.ortslagen_anzahl) ?? 0;
  const isLandkreis = String(raw.regionale_zuordnung ?? "") === "landkreis";

  const trend5Immo =
    immo01 !== null && immo05 !== null && immo02 !== null
      ? (immo01 > immo05 && immo01 < immo02)
        ? "sind sie immer noch steigend, auch wenn sie aktuell sinken"
        : (immo01 > immo05 && immo01 > immo02)
          ? "sind sie steigend und steigen aktuell weiter"
          : (immo01 < immo05 && immo01 > immo02)
            ? "sind sie sinkend, auch wenn sie aktuell steigen"
            : "sind sie sinkend und sinken aktuell weiter"
      : "zeigen sie eine gemischte Entwicklung";

  inputData.dynWort_immobilienpreise_mittel_vergleich_kreis_bundesland =
    immo01 !== null && immoBL !== null && immo01 > immoBL ? "höher" : "niedriger";
  inputData.dynWortgruppe_immobilienpreise_mittel_5jahrestrend_kreis = trend5Immo;
  inputData.immobilienpreise_mittel_vorjahrestrend_kreis_pct = pctAbs(immo01, immo02);
  inputData.dynWort_immobilienpreise_mittel_vorjahrestrend_kreis =
    immo01 !== null && immo02 !== null && immo01 >= immo02 ? "gestiegen" : "gefallen";

  inputData.dynWort_vergleich_immobilienpreise_grundstueckspreise =
    immo01 !== null && immo02 !== null && plot01 !== null && plot02 !== null &&
    ((immo01 - immo02) * (plot01 - plot02) >= 0)
      ? "analog"
      : "gegenläufig";

  inputData.dynWort_grundstueckspreise_mittel_vorjahrestrend_kreis =
    plot01 !== null && plot02 !== null && plot01 >= plot02 ? "steigen" : "fallen";
  inputData.grundstueckspreise_mittel_vorjahrestrend_kreis_pct = pctAbs(plot01, plot02);
  inputData.dynWort_grundstueckspreise_mittel_kreis_5_jahrestrend =
    plot01 !== null && plot05 !== null && plot01 >= plot05 ? "steigen" : "fallen";
  inputData.grundstueckspreise_mittel_kreis_5_jahrestrend_pct = pctAbs(plot01, plot05);
  inputData.dynWort_grundstueckspreise_vergleich_kreis_bundesland =
    plot01 !== null && plotBL !== null && plot01 > plotBL ? "höher" : "geringer";

  inputData.dynWort_mietpreise_vergleich_kreis_bundesland =
    rent01 !== null && rentBL !== null && rent01 > rentBL ? "höher als" : "niedriger als";
  inputData.dynWort_mietpreise_mittel_kreis_vorjahrestrend =
    rent01 !== null && rent02 !== null && rent01 >= rent02 ? "steigen" : "fallen";
  inputData.mietpreise_mittel_kreis_vorjahrestrend_pct = pctAbs(rent01, rent02);
  inputData.dynWort_mietpreise_mittel_kreis_5_jahrestrend =
    rent01 !== null && rent05 !== null && rent01 >= rent05 ? "Aufwärtstrend" : "Abwärtstrend";

  inputData.immobilienpreise_mittel_jahr01_kreis_eur = formatEuroSqm(immo01, 0);
  inputData.immobilienpreise_mittel_jahr05_kreis_eur = formatEuroSqm(immo05, 0);
  inputData.grundstueckspreise_mittel_jahr01_kreis_eur = formatEuroSqm(plot01, 0);
  inputData.mietpreise_mittel_kreis_eur = formatEuroSqm(rent01, 1);

  inputData.kreiszuordnung = isLandkreis ? "im Landkreis" : "in der kreisfreien Stadt";
  inputData.ortslagen_art = isLandkreis ? "Städte und Gemeinden" : "Stadtteile";
  inputData.ortslagen_anzahl = String(Math.round(ortslagenAnzahl));

  inputData.guenstigster_immobilienpreis_wert_eur = formatEuroSqm(toFinite(raw.guenstigster_immobilienpreis_wert), 0);
  inputData.teuerster_immobilienpreis_wert_eur = formatEuroSqm(toFinite(raw.teuerster_immobilienpreis_wert), 0);
  inputData.guenstigster_mietpreis_wert_eur = formatEuroSqm(toFinite(raw.guenstigster_mietpreis_wert), 1);
  inputData.teuerster_mietpreis_wert_eur = formatEuroSqm(toFinite(raw.teuerster_mietpreis_wert), 1);
  inputData.dynWort_immobilienpreise_vergleich_kreis_bundesland =
    toFinite(raw.guenstigster_immobilienpreis_wert) !== null && immoBL !== null &&
    Number(raw.guenstigster_immobilienpreis_wert) > immoBL
      ? "trotzdem teurer"
      : "günstiger";
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
  for (const trendKey of trendKeyCandidates(definition)) {
    if (!trendKey.startsWith("trendText_")) continue;
    const base = trendKey.replace(/^trendText_/, "");

    if (base.endsWith("_vergleich_kreis_bundesland")) {
      const stem = base.replace(/_vergleich_kreis_bundesland$/, "");
      const mode = stem.includes("kaltmiete") || stem.includes("miet") ? "index1" : "index100";
      const a = raw[`${stem}_jahr01_kreis`];
      const b = raw[`${stem}_jahr01_bundesland`];
      if (typeof a === "number" && typeof b === "number" && b !== 0) {
        trends[trendKey] = { [mode]: (a / b) * (mode === "index100" ? 100 : 1) };
      }
      continue;
    }

    if (base.endsWith("_vergleich_kreis_land")) {
      const stem = base.replace(/_vergleich_kreis_land$/, "");
      const mode = stem.includes("kaltmiete") || stem.includes("miet") ? "index1" : "index100";
      const a = raw[`${stem}_jahr01_kreis`];
      const b = raw[`${stem}_jahr01_land`];
      if (typeof a === "number" && typeof b === "number" && b !== 0) {
        trends[trendKey] = { [mode]: (a / b) * (mode === "index100" ? 100 : 1) };
      }
      continue;
    }

    const twoTrend = base.match(/^(.*)_2jahrestrend_(kreis)$/);
    if (twoTrend) {
      const stem = twoTrend[1];
      const a = raw[`${stem}_jahr01_kreis`];
      const b = raw[`${stem}_jahr02_kreis`];
      if (typeof a === "number" && typeof b === "number" && b !== 0) {
        trends[trendKey] = { rel_change: ((a - b) / b) * 100 };
      }
      continue;
    }

    const fiveTrend = base.match(/^(.*)_5jahrestrend_(kreis)$/);
    if (fiveTrend) {
      const stem = fiveTrend[1];
      const a = raw[`${stem}_jahr01_kreis`];
      const b = raw[`${stem}_jahr05_kreis`];
      if (typeof a === "number" && typeof b === "number" && b !== 0) {
        trends[trendKey] = { rel_change: ((a - b) / b) * 100 };
      }
      continue;
    }

    if (base.includes("vergleich_neubau_bestand")) {
      const a = raw["quadratmeterkaltmiete_avg_wohnung_neubau_jahr01_kreis"];
      const b = raw["quadratmeterkaltmiete_avg_wohnung_bestand_jahr01_kreis"];
      if (typeof a === "number" && typeof b === "number") {
        trends[trendKey] = { direct_comparison: { value_a: a, value_b: b } };
      }
      continue;
    }
  }
  return trends;
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
  for (const trendKey of trendKeyCandidates(definition)) {
    if (!trendKey.startsWith("trendText_")) continue;
    const base = trendKey.replace(/^trendText_/, "");

    if (base.endsWith("_vergleich_kreis_bundesland")) {
      const stem = base.replace(/_vergleich_kreis_bundesland$/, "");
      deps.add(`${stem}_jahr01_kreis`);
      deps.add(`${stem}_jahr01_bundesland`);
      continue;
    }

    if (base.endsWith("_vergleich_kreis_land")) {
      const stem = base.replace(/_vergleich_kreis_land$/, "");
      deps.add(`${stem}_jahr01_kreis`);
      deps.add(`${stem}_jahr01_land`);
      continue;
    }

    const twoTrend = base.match(/^(.*)_2jahrestrend_(kreis)$/);
    if (twoTrend) {
      const stem = twoTrend[1];
      deps.add(`${stem}_jahr01_kreis`);
      deps.add(`${stem}_jahr02_kreis`);
      continue;
    }

    const fiveTrend = base.match(/^(.*)_5jahrestrend_(kreis)$/);
    if (fiveTrend) {
      const stem = fiveTrend[1];
      deps.add(`${stem}_jahr01_kreis`);
      deps.add(`${stem}_jahr05_kreis`);
      continue;
    }

    if (base.includes("vergleich_neubau_bestand")) {
      deps.add("quadratmeterkaltmiete_avg_wohnung_neubau_jahr01_kreis");
      deps.add("quadratmeterkaltmiete_avg_wohnung_bestand_jahr01_kreis");
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

export function buildKreisSectionSignatures(inputs: AnyRecord) {
  const { inputData, raw } = buildInputData(inputs);
  const signatures: Record<string, string> = {};
  for (const [, key] of KREIS_TEXT_MAP) {
    const definition = (kreisPreisPhrases as AnyRecord)[key] ?? (kreisUeberblickPhrases as AnyRecord)[key];
    if (!definition) continue;
    signatures[key] = buildDefinitionSignature(definition, raw, inputData);
  }
  return signatures;
}

function generateFromDefinition(defKey: string, inputData: AnyRecord, raw: AnyRecord) {
  const definition = (kreisPreisPhrases as AnyRecord)[defKey] ?? (kreisUeberblickPhrases as AnyRecord)[defKey];
  if (!definition) return null;
  const trendValues = computeTrendValues(definition, raw);
  return generateTextFromMultiblock(definition, inputData, trendValues, defKey);
}

export function generateKreisPriceTexts(text: AnyRecord, inputs: AnyRecord, allowedKeys?: Set<string>) {
  const { inputData, raw } = buildInputData(inputs);
  const updated = { ...text };

  for (const [group, key] of KREIS_TEXT_MAP) {
    if (allowedKeys && !allowedKeys.has(key)) continue;
    if (!updated[group]) continue;
    const textValue = generateFromDefinition(key, inputData, raw);
    if (textValue) {
      updated[group] = { ...updated[group], [key]: textValue };
    }
  }

  if (updated.immobilienmarkt_ueberblick && typeof updated.immobilienmarkt_ueberblick === "object") {
    const cleaned = { ...updated.immobilienmarkt_ueberblick } as AnyRecord;
    delete cleaned.text_wohnlagen_liste;
    delete cleaned.text_lageverteilung;
    updated.immobilienmarkt_ueberblick = cleaned;
  }

  if (updated.immobilienpreise && typeof updated.immobilienpreise === "object") {
    const cleaned = { ...updated.immobilienpreise } as AnyRecord;
    delete cleaned.text_wohnlagen_liste;
    delete cleaned.text_lageverteilung;
    updated.immobilienpreise = cleaned;
  }

  return updated;
}
