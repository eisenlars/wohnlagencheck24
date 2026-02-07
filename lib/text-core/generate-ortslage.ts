import {
  generateTextFromMultiblock,
  formatPriceValue,
  capitalizeWords,
  umlauteUmwandeln,
} from "@/lib/text-core/core";

import ortslagePhrases from "@/lib/text-core/phrases/ortslage/immobilienpreise.json";

type AnyRecord = Record<string, any>;

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
  } = inputs;

  let ortName = capitalizeWords(umlauteUmwandeln(String(ortslage_name ?? ""))).replace("ortslage_", "");
  const kreisName = capitalizeWords(umlauteUmwandeln(String(kreis_name ?? "")));
  const bundeslandName = capitalizeWords(umlauteUmwandeln(String(bundesland_name ?? "")));

  if (regionale_zuordnung === "stadtteil") {
    ortName = `${kreisName} ${ortName}`;
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
    jahr01_minus_1: year01 - 1,
    ...statValues_locationFactors_dict,
    ...statValues_generally_dict,
    ...statValues_livingSpaceDemand_dict,
    ...statValues_livingSpaceOffer_dict,
    ...statValues_economy_dict,
    ...priceValues_properties_dict,
    ...priceValues_plots_dict,
    ...priceValues_rent_dict,
    ...priceValues_rendite_dict,
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

  return { inputData, raw };
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

    if (base.endsWith("_vergleich_ortslage_kreis")) {
      const stem = base.replace(/_vergleich_ortslage_kreis$/, "");
      const mode = stem.includes("kaltmiete") || stem.includes("miet") ? "index1" : "index100";
      const a = raw[`${stem}_jahr01_ortslage`];
      const b = raw[`${stem}_jahr01_kreis`];
      if (typeof a === "number" && typeof b === "number" && b !== 0) {
        trends[trendKey] = { [mode]: (a / b) * (mode === "index100" ? 100 : 1) };
      }
      continue;
    }

    if (base.endsWith("_vergleich_ortslage_bundesland")) {
      const stem = base.replace(/_vergleich_ortslage_bundesland$/, "");
      const mode = stem.includes("kaltmiete") || stem.includes("miet") ? "index1" : "index100";
      const a = raw[`${stem}_jahr01_ortslage`];
      const b = raw[`${stem}_jahr01_bundesland`];
      if (typeof a === "number" && typeof b === "number" && b !== 0) {
        trends[trendKey] = { [mode]: (a / b) * (mode === "index100" ? 100 : 1) };
      }
      continue;
    }

    if (base.endsWith("_vergleich_ortslage_land")) {
      const stem = base.replace(/_vergleich_ortslage_land$/, "");
      const mode = stem.includes("kaltmiete") || stem.includes("miet") ? "index1" : "index100";
      const a = raw[`${stem}_jahr01_ortslage`];
      const b = raw[`${stem}_jahr01_land`];
      if (typeof a === "number" && typeof b === "number" && b !== 0) {
        trends[trendKey] = { [mode]: (a / b) * (mode === "index100" ? 100 : 1) };
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

    if (base.endsWith("_vergleich_ortslage_kreis")) {
      const stem = base.replace(/_vergleich_ortslage_kreis$/, "");
      deps.add(`${stem}_jahr01_ortslage`);
      deps.add(`${stem}_jahr01_kreis`);
      continue;
    }

    if (base.endsWith("_vergleich_ortslage_bundesland")) {
      const stem = base.replace(/_vergleich_ortslage_bundesland$/, "");
      deps.add(`${stem}_jahr01_ortslage`);
      deps.add(`${stem}_jahr01_bundesland`);
      continue;
    }

    if (base.endsWith("_vergleich_ortslage_land")) {
      const stem = base.replace(/_vergleich_ortslage_land$/, "");
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

    const fiveTrend = base.match(/^(.*)_5jahrestrend_(ortslage)$/);
    if (fiveTrend) {
      const stem = fiveTrend[1];
      deps.add(`${stem}_jahr01_ortslage`);
      deps.add(`${stem}_jahr05_ortslage`);
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

export function buildOrtslageSectionSignatures(inputs: AnyRecord) {
  const { inputData, raw } = buildInputData(inputs);
  const signatures: Record<string, string> = {};
  for (const [, key] of ORTSLAGE_TEXT_MAP) {
    const definition = (ortslagePhrases as AnyRecord)[key];
    if (!definition) continue;
    signatures[key] = buildDefinitionSignature(definition, raw, inputData);
  }
  return signatures;
}

function generateFromDefinition(defKey: string, inputData: AnyRecord, raw: AnyRecord) {
  const definition = (ortslagePhrases as AnyRecord)[defKey];
  if (!definition) return null;
  const trendValues = computeTrendValues(definition, raw);
  return generateTextFromMultiblock(definition, inputData, trendValues, defKey);
}

export function generateOrtslagePriceTexts(text: AnyRecord, inputs: AnyRecord, allowedKeys?: Set<string>) {
  const { inputData, raw } = buildInputData(inputs);
  const updated = { ...text };

  for (const [group, key] of ORTSLAGE_TEXT_MAP) {
    if (allowedKeys && !allowedKeys.has(key)) continue;
    if (!updated[group]) continue;
    const textValue = generateFromDefinition(key, inputData, raw);
    if (textValue) {
      updated[group] = { ...updated[group], [key]: textValue };
    }
  }

  return updated;
}
