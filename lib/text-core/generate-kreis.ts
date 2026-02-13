import {
  generateText,
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
} from "@/lib/text-core/core";

import kreisPreisPhrases from "@/lib/text-core/phrases/kreis/immobilienpreise.json";
import kreisUeberblickPhrases from "@/lib/text-core/phrases/kreis/immobilienmarkt.json";
import kreisWohnraumPhrases from "@/lib/text-core/phrases/kreis/wohnraumsituation.json";
import kreisWirtschaftPhrases from "@/lib/text-core/phrases/kreis/wirtschaft.json";

type AnyRecord = Record<string, unknown>;

function pickRandom<T>(items: T[], rng?: () => number): T {
  if (!items.length) {
    throw new Error("pickRandom: empty array");
  }
  const r = rng ?? Math.random;
  return items[Math.floor(r() * items.length)];
}

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

  const rentYear01 = marketValues_generallyPrices_dict?.mietpreise_mittel_kreis ?? marketValues_generallyPrices_dict?.mietpreise_mittel_jahr01_kreis;
  const rentYear02 = marketValues_generallyPrices_dict?.mietpreise_mittel_kreis_vorjahr ?? marketValues_generallyPrices_dict?.mietpreise_mittel_jahr02_kreis;
  const rentYear05 = marketValues_generallyPrices_dict?.mietpreise_mittel_kreis_vor_5_jahren ?? marketValues_generallyPrices_dict?.mietpreise_mittel_jahr05_kreis;
  const rentBl = marketValues_generallyPrices_dict?.mietpreise_mittel_bundesland ?? marketValues_generallyPrices_dict?.mietpreise_mittel_jahr01_bundesland;

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
    mietpreise_mittel_jahr01_kreis: rentYear01,
    mietpreise_mittel_jahr02_kreis: rentYear02,
    mietpreise_mittel_jahr05_kreis: rentYear05,
    mietpreise_mittel_jahr01_bundesland: rentBl,
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

function toFinite(value: unknown) {
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

    const tenTrend = base.match(/^(.*)_10jahrestrend_(kreis)$/);
    if (tenTrend) {
      const stem = tenTrend[1];
      const a = raw[`${stem}_jahr01_kreis`];
      const b = raw[`${stem}_jahr10_kreis`];
      if (typeof a === "number" && typeof b === "number" && b !== 0) {
        trends[trendKey] = { rel_change: ((a - b) / b) * 100 };
      }
      continue;
    }

    const tenSaldo = base.match(/^(.*)_10jahressaldo_(kreis)$/);
    if (tenSaldo) {
      const stem = tenSaldo[1];
      const a = raw[`${stem}_jahr01_kreis`];
      const b = raw[`${stem}_jahr10_kreis`];
      if (typeof a === "number" && typeof b === "number" && b !== 0) {
        trends[trendKey] = { rel_change: ((a - b) / b) * 100 };
      }
      continue;
    }

    const fiveSaldo = base.match(/^(.*)_5jahresSaldo_(kreis)$/);
    if (fiveSaldo) {
      const stem = fiveSaldo[1];
      const a = raw[`${stem}_jahr01_kreis`];
      const b = raw[`${stem}_jahr05_kreis`];
      if (typeof a === "number" && typeof b === "number") {
        trends[trendKey] = { abs_delta: a - b };
      }
      continue;
    }

    const vorjahrTrend = base.match(/^(.*)_vorjahrestrend_(kreis)$/);
    if (vorjahrTrend) {
      const stem = vorjahrTrend[1];
      const a = raw[`${stem}_jahr01_kreis`];
      const b = raw[`${stem}_jahr02_kreis`];
      if (typeof a === "number" && typeof b === "number" && b !== 0) {
        trends[trendKey] = { rel_change: ((a - b) / b) * 100 };
      }
      continue;
    }

    const vorjahrSaldo = base.match(/^(.*)_vorjahressaldo_(kreis)$/);
    if (vorjahrSaldo) {
      const stem = vorjahrSaldo[1];
      const a = raw[`${stem}_jahr01_kreis`];
      const b = raw[`${stem}_jahr02_kreis`];
      if (typeof a === "number" && typeof b === "number") {
        trends[trendKey] = { abs_delta: a - b };
      }
      continue;
    }

    if (base.includes("jugendquotient_altenquotient_vergleich")) {
      const a = raw["altenquotient_kreis"];
      const b = raw["jugendquotient_kreis"];
      if (typeof a === "number" && typeof b === "number") {
        trends[trendKey] = { direct_comparison: { value_a: a, value_b: b } };
      }
      continue;
    }

    if (base === "guenstigster_immobilienpreis_vergleich_kreis_bundesland") {
      const aRaw = raw["guenstigster_immobilienpreis_wert"];
      const bRaw = raw["immobilienpreise_mittel_jahr01_bundesland"];
      const a = typeof aRaw === "number" ? aRaw : Number(aRaw);
      const b = typeof bRaw === "number" ? bRaw : Number(bRaw);
      if (Number.isFinite(a) && Number.isFinite(b)) {
        trends[trendKey] = { direct_comparison: { value_a: a, value_b: b } };
      }
      continue;
    }

    if (base.startsWith("regionentyp_")) {
      const a = raw["einwohneranzahl_jahr01_kreis"];
      const b = raw["einwohneranzahl_jahr05_kreis"];
      if (typeof a === "number" && typeof b === "number" && b !== 0) {
        trends[trendKey] = { rel_change: ((a - b) / b) * 100 };
      }
      continue;
    }

    const indexMatch = base.match(/^(.*)_index(?:_jahr01)?_kreis$/);
    if (indexMatch) {
      const stem = indexMatch[1];
      let v = raw[base];
      if (typeof v !== "number") {
        const a = raw[`${stem}_jahr01_kreis`];
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

function computeTextDefinition(key: string) {
  const resolvedKey = resolveDefinitionKey(key);
  return (
    (kreisPreisPhrases as AnyRecord)[resolvedKey] ??
    (kreisUeberblickPhrases as AnyRecord)[resolvedKey] ??
    (kreisWohnraumPhrases as AnyRecord)[resolvedKey] ??
    (kreisWirtschaftPhrases as AnyRecord)[resolvedKey] ??
    null
  );
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
  const trendBlock = definition?.trend_verbkonstrukte ?? {};
  const keys = new Set<string>();
  for (const key of Object.keys(trendBlock)) {
    if (key.startsWith("phrases_")) keys.add(key.replace("phrases_", ""));
    if (key.startsWith("verbkonstrukt_")) keys.add(key.replace("verbkonstrukt_", ""));
  }

  for (const trendKey of keys) {
    if (!trendKey.startsWith("trendText_")) continue;
    const phrasesKey = `phrases_${trendKey}`;
    const verbKey = `verbkonstrukt_${trendKey}`;
    const phrasesByCategory = trendBlock[phrasesKey] ?? {};
    const verbByCategory = trendBlock[verbKey] ?? {};

    const trendValue = trendValues[trendKey] ?? {};
    let category = "gleich";
    if ("index1" in trendValue) category = determineIndex1Category(trendValue.index1);
    else if ("index100" in trendValue) category = determineIndex100Category(trendValue.index100);
    else if ("rel_change" in trendValue) category = determineTrendCategory(trendValue.rel_change);
    else if ("abs_delta" in trendValue) category = determineAbsoluteCategoryWithDirection(trendValue.abs_delta);
    else if ("direct_comparison" in trendValue) category = determineSimpleComparisonCategory(trendValue.direct_comparison.value_a, trendValue.direct_comparison.value_b);
    else if ("index50" in trendValue) category = determineIndex50Category(trendValue.index50);

    const templateCategory = mapTrendCategoryToTemplateKey(category);
    const phraseEntries = phrasesByCategory[templateCategory] ?? [];
    const verbPatterns = verbByCategory[templateCategory] ?? [];
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
          const rendered = renderTemplate(String(pattern), { ...baseVars, phrase, auxiliar: aux });
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

    if ("rel_change" in trendData && typeof trendData.rel_change === "number") {
      baseVars[baseKey] = Math.abs(trendData.rel_change).toLocaleString("de-DE", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      });
      continue;
    }
    if ("abs_delta" in trendData && typeof trendData.abs_delta === "number") {
      baseVars[baseKey] = trendData.abs_delta.toLocaleString("de-DE", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      });
      continue;
    }
    if ("index1" in trendData && typeof trendData.index1 === "number") {
      baseVars[baseKey] = trendData.index1.toLocaleString("de-DE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      continue;
    }
    if ("index100" in trendData && typeof trendData.index100 === "number") {
      baseVars[baseKey] = trendData.index100.toLocaleString("de-DE", {
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
    const list = allTemplates[mode] ?? [];
    for (const template of list) {
      const raw = String(template);
      const keys = Array.from(new Set(raw.match(/{{\s*([^}]+)\s*}}/g) ?? []))
        .map((m) => m.replace(/{{\s*|\s*}}/g, ""));
      let variants = [raw];
      for (const key of keys) {
        const choices = options[key] ?? [baseVars[key] ?? ""];
        const next: string[] = [];
        const pattern = new RegExp(`{{\\s*${escapeRegExp(key)}\\s*}}`, "g");
        for (const variant of variants) {
          for (const choice of choices) {
            next.push(variant.replace(pattern, String(choice)));
          }
        }
        variants = next;
      }
      results.push(...variants.map((value) => value.trim()).filter(Boolean));
    }
  }
  return results;
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
      yield current.trim();
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

  return current.trim();
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

    const tenTrend = base.match(/^(.*)_10jahrestrend_(kreis)$/);
    if (tenTrend) {
      const stem = tenTrend[1];
      deps.add(`${stem}_jahr01_kreis`);
      deps.add(`${stem}_jahr10_kreis`);
      continue;
    }

    const tenSaldo = base.match(/^(.*)_10jahressaldo_(kreis)$/);
    if (tenSaldo) {
      const stem = tenSaldo[1];
      deps.add(`${stem}_jahr01_kreis`);
      deps.add(`${stem}_jahr10_kreis`);
      continue;
    }

    const fiveSaldo = base.match(/^(.*)_5jahresSaldo_(kreis)$/);
    if (fiveSaldo) {
      const stem = fiveSaldo[1];
      deps.add(`${stem}_jahr01_kreis`);
      deps.add(`${stem}_jahr05_kreis`);
      continue;
    }

    const vorjahrTrend = base.match(/^(.*)_vorjahrestrend_(kreis)$/);
    if (vorjahrTrend) {
      const stem = vorjahrTrend[1];
      deps.add(`${stem}_jahr01_kreis`);
      deps.add(`${stem}_jahr02_kreis`);
      continue;
    }

    const vorjahrSaldo = base.match(/^(.*)_vorjahressaldo_(kreis)$/);
    if (vorjahrSaldo) {
      const stem = vorjahrSaldo[1];
      deps.add(`${stem}_jahr01_kreis`);
      deps.add(`${stem}_jahr02_kreis`);
      continue;
    }

    if (base.includes("jugendquotient_altenquotient_vergleich")) {
      deps.add("altenquotient_kreis");
      deps.add("jugendquotient_kreis");
      continue;
    }

    if (base.startsWith("regionentyp_")) {
      deps.add("einwohneranzahl_jahr01_kreis");
      deps.add("einwohneranzahl_jahr05_kreis");
      continue;
    }

    const indexMatch = base.match(/^(.*)_index(?:_jahr01)?_kreis$/);
    if (indexMatch) {
      const stem = indexMatch[1];
      deps.add(base);
      deps.add(`${stem}_jahr01_kreis`);
      deps.add(`${stem}_jahr01_land`);
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

function resolveDefinitionKey(key: string) {
  if (key === "wohnmarktsituation_bauueberhang_baufortschritt") return "wohnmarktsituation_bauueberhang";
  if (key === "wirtschaft_sv_beschaeftigte_arbeitsort") return "wirtschaft_sv_beschaeftigte_arbeits_und_wohnort";
  return key;
}

export function generateKreisTextVariants(key: string, inputs: AnyRecord) {
  const definition = computeTextDefinition(key);
  if (!definition) return [];
  const { inputData, raw } = buildInputData(inputs);
  const blocks = definition.text_blocks;
  if (!Array.isArray(blocks) || !blocks.length) return [];

  const allVariants: string[] = [];
  for (const block of blocks) {
    const trendValues = computeTrendValues(block, raw);
    const baseVars = { ...inputData };
    applyTrendBaseVars(trendValues, baseVars);
    const staticOptions = expandStaticVerbkonstrukte(block.static_verbkonstrukte ?? {}, baseVars);
    const trendOptions = expandTrendVerbkonstrukte(block, trendValues, baseVars);
    const options = { ...staticOptions, ...trendOptions };
    const variants = expandTemplates(block.templates, baseVars, options);
    allVariants.push(...variants);
  }

  return allVariants;
}

export function countKreisTextVariants(key: string, inputs: AnyRecord) {
  const definition = computeTextDefinition(key);
  if (!definition) return 0;
  const { inputData, raw } = buildInputData(inputs);
  const blocks = definition.text_blocks;
  if (!Array.isArray(blocks) || !blocks.length) return 0;

  let total = 0;
  for (const block of blocks) {
    const trendValues = computeTrendValues(block, raw);
    const baseVars = { ...inputData };
    applyTrendBaseVars(trendValues, baseVars);
    const staticOptions = expandStaticVerbkonstrukte(block.static_verbkonstrukte ?? {}, baseVars);
    const trendOptions = expandTrendVerbkonstrukte(block, trendValues, baseVars);
    const options = { ...staticOptions, ...trendOptions };
    const templates = block.templates ?? {};
    for (const list of Object.values(templates)) {
      if (!Array.isArray(list)) continue;
      for (const tpl of list) {
        total += countTemplateVariants(String(tpl), options);
      }
    }
  }
  return total;
}

export function* iterateKreisTextVariants(key: string, inputs: AnyRecord): Generator<string> {
  const definition = computeTextDefinition(key);
  if (!definition) return;
  const { inputData, raw } = buildInputData(inputs);
  const blocks = definition.text_blocks;
  if (!Array.isArray(blocks) || !blocks.length) return;

  for (const block of blocks) {
    const trendValues = computeTrendValues(block, raw);
    const baseVars = { ...inputData };
    applyTrendBaseVars(trendValues, baseVars);
    const staticOptions = expandStaticVerbkonstrukte(block.static_verbkonstrukte ?? {}, baseVars);
    const trendOptions = expandTrendVerbkonstrukte(block, trendValues, baseVars);
    const options = { ...staticOptions, ...trendOptions };
    const templates = block.templates ?? {};
    for (const list of Object.values(templates)) {
      if (!Array.isArray(list)) continue;
      for (const tpl of list) {
        yield* iterateTemplateVariants(String(tpl), options, baseVars);
      }
    }
  }
}

export function sampleKreisTextVariants(key: string, inputs: AnyRecord, sampleSize = 50) {
  const definition = computeTextDefinition(key);
  if (!definition) return { total: 0, samples: [] as Array<{ index: number; text: string }> };
  const { inputData, raw } = buildInputData(inputs);
  const blocks = definition.text_blocks;
  if (!Array.isArray(blocks) || !blocks.length) return { total: 0, samples: [] };

  const templates: Array<{ template: string; options: AnyRecord; baseVars: AnyRecord; count: number }> = [];
  let total = 0;

  for (const block of blocks) {
    const trendValues = computeTrendValues(block, raw);
    const baseVars = { ...inputData };
    applyTrendBaseVars(trendValues, baseVars);
    const staticOptions = expandStaticVerbkonstrukte(block.static_verbkonstrukte ?? {}, baseVars);
    const trendOptions = expandTrendVerbkonstrukte(block, trendValues, baseVars);
    const options = { ...staticOptions, ...trendOptions };
    const tplMap = block.templates ?? {};
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

export function generateKreisTextVariantDiagnostics(key: string, inputs: AnyRecord) {
  const definition = computeTextDefinition(key);
  if (!definition) {
    return {
      error: "definition_missing",
      templateKeys: [],
      optionCounts: {},
      emptyKeys: [],
      missingTemplateKeys: [],
      emptyOptionKeys: [],
      sampleOptions: {},
    };
  }
  const { inputData, raw } = buildInputData(inputs);
  const blocks = definition.text_blocks;
  if (!Array.isArray(blocks) || !blocks.length) {
    return {
      error: "text_blocks_missing",
      templateKeys: [],
      optionCounts: {},
      emptyKeys: [],
      missingTemplateKeys: [],
      emptyOptionKeys: [],
      sampleOptions: {},
    };
  }

  const templateKeys = new Set<string>();
  const optionCounts: Record<string, number> = {};
  const emptyKeys = new Set<string>();
  const missingTemplateKeys = new Set<string>();
  const emptyOptionKeys = new Set<string>();
  const sampleOptions: Record<string, string[]> = {};

  for (const block of blocks) {
    const trendValues = computeTrendValues(block, raw);
    const baseVars = { ...inputData };
    applyTrendBaseVars(trendValues, baseVars);
    const staticOptions = expandStaticVerbkonstrukte(block.static_verbkonstrukte ?? {}, baseVars);
    const trendOptions = expandTrendVerbkonstrukte(block, trendValues, baseVars);
    const options = { ...staticOptions, ...trendOptions };

    const templates = block.templates ?? {};
    Object.values(templates).forEach((list) => {
      if (!Array.isArray(list)) return;
      list.forEach((tpl) => {
        const rawTpl = String(tpl);
        const keys = rawTpl.match(/{{\s*([^}]+)\s*}}/g) ?? [];
        keys.forEach((k) => templateKeys.add(k.replace(/{{\s*|\s*}}/g, "")));
      });
    });

    for (const [optKey, values] of Object.entries(options)) {
      const cleaned = Array.isArray(values)
        ? values.map((v) => String(v).trim()).filter((v) => v.length > 0)
        : [];
      const count = cleaned.length;
      optionCounts[optKey] = (optionCounts[optKey] ?? 0) + count;
      if (count === 0) {
        emptyKeys.add(optKey);
        emptyOptionKeys.add(optKey);
      }
      if (!sampleOptions[optKey] && cleaned.length) {
        sampleOptions[optKey] = cleaned.slice(0, 2);
      }
    }

    for (const keyName of templateKeys) {
      if (Object.prototype.hasOwnProperty.call(options, keyName)) continue;
      if (Object.prototype.hasOwnProperty.call(baseVars, keyName)) continue;
      missingTemplateKeys.add(keyName);
    }
  }

  return {
    error: null,
    templateKeys: Array.from(templateKeys),
    optionCounts,
    emptyKeys: Array.from(emptyKeys),
    missingTemplateKeys: Array.from(missingTemplateKeys),
    emptyOptionKeys: Array.from(emptyOptionKeys),
    sampleOptions,
  };
}

export function buildKreisSectionSignatures(inputs: AnyRecord) {
  const { inputData, raw } = buildInputData(inputs);
  const signatures: Record<string, string> = {};
  for (const [, key] of KREIS_TEXT_MAP) {
    const defKey = resolveDefinitionKey(key);
    const definition =
      (kreisPreisPhrases as AnyRecord)[defKey] ??
      (kreisUeberblickPhrases as AnyRecord)[defKey] ??
      (kreisWohnraumPhrases as AnyRecord)[defKey] ??
      (kreisWirtschaftPhrases as AnyRecord)[defKey];
    if (!definition) continue;
    signatures[key] = buildDefinitionSignature(definition, raw, inputData);
  }
  return signatures;
}

function generateFromDefinition(defKey: string, inputData: AnyRecord, raw: AnyRecord, rng?: () => number) {
  const resolvedKey = resolveDefinitionKey(defKey);
  const definition =
    (kreisPreisPhrases as AnyRecord)[resolvedKey] ??
    (kreisUeberblickPhrases as AnyRecord)[resolvedKey] ??
    (kreisWohnraumPhrases as AnyRecord)[resolvedKey] ??
    (kreisWirtschaftPhrases as AnyRecord)[resolvedKey];
  if (!definition) return null;
  const blocks = definition?.text_blocks;
  if (!blocks || !Array.isArray(blocks) || blocks.length === 0) {
    throw new Error(`'text_blocks' fehlt oder ist keine Liste in Definition '${resolvedKey}'.`);
  }
  const block = pickRandom(blocks, rng);
  const trendValues = computeTrendValues(block, raw);
  const guardKey = "trendText_guenstigster_immobilienpreis_vergleich_kreis_bundesland";
  if (!(guardKey in trendValues)) {
    const aRaw = raw["guenstigster_immobilienpreis_wert"];
    const bRaw = raw["immobilienpreise_mittel_jahr01_bundesland"];
    const a = typeof aRaw === "number" ? aRaw : Number(aRaw);
    const b = typeof bRaw === "number" ? bRaw : Number(bRaw);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      trendValues[guardKey] = { direct_comparison: { value_a: a, value_b: b } };
    }
  }
  return generateText(block, inputData, trendValues, resolvedKey, undefined, undefined, rng);
}

export function generateKreisPriceTexts(
  text: AnyRecord,
  inputs: AnyRecord,
  allowedKeys?: Set<string>,
  rngByKey?: (key: string) => () => number,
) {
  const { inputData, raw } = buildInputData(inputs);
  const updated = { ...text };

  for (const [group, key] of KREIS_TEXT_MAP) {
    if (allowedKeys && !allowedKeys.has(key)) continue;
    if (!updated[group]) continue;
    const textValue = generateFromDefinition(key, inputData, raw, rngByKey ? rngByKey(key) : undefined);
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
