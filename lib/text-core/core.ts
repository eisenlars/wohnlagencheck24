/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-explicit-any */
// @ts-nocheck
type AnyRecord = Record<string, any>;
type Rng = () => number;

export function createSeededRng(seed: string): Rng {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let state = h >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickRandom<T>(items: T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)];
}

function shuffleInPlace<T>(items: T[], rng: Rng) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
}

const DEFAULT_MAX_PASSES = 5;

function normalizeGeneratedText(text: string): string {
  return String(text)
    .replace(/ {2,}/g, " ")
    .replace(/ +([,.!?;:])/g, "$1")
    .trim();
}

export function renderTemplate(template: string, context: AnyRecord): string {
  return template.replace(/{{\s*([^}]+)\s*}}/g, (_, key) => {
    const value = context[key.trim()];
    return value === undefined || value === null ? "" : String(value);
  });
}

export function fullyRenderTemplate(text: string, context: AnyRecord, maxPasses = DEFAULT_MAX_PASSES): string {
  let out = text;
  for (let i = 0; i < maxPasses; i += 1) {
    if (!out.includes("{{")) break;
    out = renderTemplate(out, context);
  }
  return out;
}

export function calculateTrendPercent(valueCurrent: number, valuePrevious: number, returnStatus = false) {
  if (valuePrevious === 0) {
    if (valueCurrent === 0) return returnStatus ? [null, "no_data"] : null;
    return returnStatus ? [null, "second_value_is_0"] : null;
  }
  if (valueCurrent === 0) return returnStatus ? [null, "first_value_is_0"] : null;
  const trend = Math.round(((valueCurrent - valuePrevious) / valuePrevious) * 100 * 100) / 100;
  return returnStatus ? [trend, "valid"] : trend;
}

export function determineIndex1Category(indexValue: number, thresholds = [0.02, 0.05, 0.10]) {
  const delta = indexValue - 1;
  const absDelta = Math.abs(delta);
  if (absDelta <= thresholds[0]) return "gleich";
  if (delta > 0) {
    if (absDelta <= thresholds[1]) return "leicht_groesser";
    if (absDelta <= thresholds[2]) return "groesser";
    return "viel_groesser";
  }
  if (absDelta <= thresholds[1]) return "leicht_kleiner";
  if (absDelta <= thresholds[2]) return "kleiner";
  return "viel_kleiner";
}

export function determineIndex100Category(indexValue: number, thresholds = [2, 5, 10]) {
  const delta = indexValue - 100;
  const absDelta = Math.abs(delta);
  if (absDelta <= thresholds[0]) return "gleich";
  if (delta > 0) {
    if (absDelta <= thresholds[1]) return "leicht_groesser";
    if (absDelta <= thresholds[2]) return "groesser";
    return "viel_groesser";
  }
  if (absDelta <= thresholds[1]) return "leicht_kleiner";
  if (absDelta <= thresholds[2]) return "kleiner";
  return "viel_kleiner";
}

export function determineIndex50Category(value: number, thresholds = [5, 10, 20]) {
  const delta = value - 50;
  const absDelta = Math.abs(delta);
  if (absDelta <= thresholds[0]) return "gleich";
  if (delta > 0) {
    if (absDelta <= thresholds[1]) return "leicht_groesser";
    if (absDelta <= thresholds[2]) return "groesser";
    return "viel_groesser";
  }
  if (absDelta <= thresholds[1]) return "leicht_kleiner";
  if (absDelta <= thresholds[2]) return "kleiner";
  return "viel_kleiner";
}

export function determineTrendCategory(relativeChange: number, thresholds = [2, 5, 10]) {
  const absChange = Math.abs(relativeChange);
  if (absChange <= thresholds[0]) return "gleich";
  if (relativeChange > 0) {
    if (absChange <= thresholds[1]) return "leicht_groesser";
    if (absChange <= thresholds[2]) return "groesser";
    return "viel_groesser";
  }
  if (absChange <= thresholds[1]) return "leicht_kleiner";
  if (absChange <= thresholds[2]) return "kleiner";
  return "viel_kleiner";
}

export function determineAbsoluteCategoryWithDirection(delta: number, thresholds = [10, 50, 100]) {
  const absDelta = Math.abs(delta);
  if (absDelta <= thresholds[0]) return "gleich";
  if (delta > 0) {
    if (absDelta <= thresholds[1]) return "leicht_groesser";
    if (absDelta <= thresholds[2]) return "groesser";
    return "viel_groesser";
  }
  if (absDelta <= thresholds[1]) return "leicht_kleiner";
  if (absDelta <= thresholds[2]) return "kleiner";
  return "viel_kleiner";
}

export function determineSimpleComparisonCategory(valueA: number, valueB: number) {
  if (valueA > valueB) return "groesser";
  if (valueA < valueB) return "kleiner";
  return "gleich";
}

export function determineGenericConnectorType(valueA: number, valueB: number, thresholdNeutral = 0.02) {
  const isNeutral = (v: number) => Math.abs(v) <= thresholdNeutral;
  if (isNeutral(valueA) && isNeutral(valueB)) return "neutral";
  if ((valueA > thresholdNeutral && valueB < -thresholdNeutral) || (valueA < -thresholdNeutral && valueB > thresholdNeutral)) {
    return "optimal";
  }
  if ((valueA > thresholdNeutral && valueB > thresholdNeutral) || (valueA < -thresholdNeutral && valueB < -thresholdNeutral)) {
    return "ungünstig";
  }
  return "neutral";
}

export function mapTrendCategoryToTemplateKey(category: string) {
  const allowed = new Set([
    "gleich",
    "leicht_groesser",
    "groesser",
    "viel_groesser",
    "leicht_kleiner",
    "kleiner",
    "viel_kleiner",
  ]);
  if (!allowed.has(category)) {
    throw new Error(`Unbekannte Kategorie: ${category}`);
  }
  return category;
}

export function classifyOver100Level(value: number) {
  if (value <= 100) return "normal";
  if (value <= 150) return "factor_1_5";
  if (value <= 200) return "factor_2";
  if (value <= 300) return "factor_3";
  return "factor_3plus";
}

export function selectPhraseEntry(category: string, phraseJson: AnyRecord, strict = true, rng: Rng = Math.random) {
  const rawOptions = phraseJson?.[category];
  const options = Array.isArray(rawOptions) ? rawOptions : [];
  if (!options.length) {
    // Backward-compatible fallback for legacy phrase blocks that only define
    // coarse buckets (gleich/groesser/kleiner).
    const coarseFallback: Record<string, string> = {
      leicht_groesser: "groesser",
      viel_groesser: "groesser",
      leicht_kleiner: "kleiner",
      viel_kleiner: "kleiner",
    };
    const fallbackCategory = coarseFallback[category];
    if (fallbackCategory) {
      const fallbackRaw = phraseJson?.[fallbackCategory];
      const fallbackOptions = Array.isArray(fallbackRaw) ? fallbackRaw : [];
      if (fallbackOptions.length) {
        return pickRandom(fallbackOptions, rng);
      }
    }
    if (strict) {
      throw new Error(`Phrasen fehlen für Kategorie '${category}'. Vorhandene Keys: ${Object.keys(phraseJson ?? {})}`);
    }
    return { phrase: "", auxiliar: "" };
  }
  return pickRandom(options, rng);
}

export function generateVerbkonstrukt(
  patterns: unknown[],
  renderContext: AnyRecord,
  connectorConfig?: AnyRecord,
  rng: Rng = Math.random,
) {
  if (!patterns || !patterns.length) return ["", null, null] as const;
  const rawPattern = pickRandom(patterns, rng);
  let pattern = "";
  let phrase = "";

  if (typeof rawPattern === "object" && rawPattern !== null) {
    const patternObj = rawPattern as AnyRecord;
    if ("phrase" in patternObj || "auxiliar" in patternObj) {
      renderContext = { ...renderContext, ...patternObj };
      phrase = String(patternObj.phrase ?? "");
      const aux = String(patternObj.auxiliar ?? "");
      pattern = `${aux} ${phrase}`.trim();
    } else {
      pattern = String(Object.keys(patternObj)[0] ?? "");
    }
  } else {
    pattern = String(rawPattern);
  }

  if (connectorConfig) {
    const normalizeConnectorKey = (value: unknown) =>
      String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();

    const connectorTypeRaw = renderContext.connector_type;
    const connectorType = typeof connectorTypeRaw === "string" && connectorTypeRaw.trim().length > 0
      ? connectorTypeRaw
      : "neutral";
    const connectorEntryDirect = connectorConfig[connectorType];
    let connectorEntry = connectorEntryDirect;
    if (!connectorEntry || typeof connectorEntry !== "object") {
      const wanted = normalizeConnectorKey(connectorType);
      for (const [candidateKey, candidateValue] of Object.entries(connectorConfig)) {
        if (normalizeConnectorKey(candidateKey) === wanted) {
          connectorEntry = candidateValue;
          break;
        }
      }
    }
    if (!connectorEntry || typeof connectorEntry !== "object") {
      connectorEntry = connectorConfig.neutral;
    }
    const connectorRecord =
      connectorEntry && typeof connectorEntry === "object"
        ? (connectorEntry as Record<string, unknown>)
        : null;
    const noteRaw = connectorRecord?.note;
    const noteOptions = Array.isArray(noteRaw) ? noteRaw : [];
    const linkRaw = connectorRecord?.link;
    const linkOptions = Array.isArray(linkRaw) ? linkRaw : [];
    const neutralRaw = connectorConfig?.neutral;
    const neutralRecord =
      neutralRaw && typeof neutralRaw === "object"
        ? (neutralRaw as Record<string, unknown>)
        : null;
    const neutralLinkRaw = neutralRecord?.link;
    const neutralLinkOptions = Array.isArray(neutralLinkRaw) ? neutralLinkRaw : [];
    const selectedLink = linkOptions.length
      ? String(pickRandom(linkOptions, rng))
      : neutralLinkOptions.length
        ? String(pickRandom(neutralLinkOptions, rng))
        : "Zudem";
    renderContext = {
      ...renderContext,
      note_word: noteOptions.length ? String(pickRandom(noteOptions, rng)) : "",
      link_word: selectedLink,
    };
  }

  const result = renderTemplate(pattern, renderContext);
  return [result, pattern, phrase] as const;
}

export function generateDynamicPlaceholders(
  textDefinition: AnyRecord,
  inputData: AnyRecord,
  trendValues: AnyRecord,
  quoteValues: AnyRecord = {},
  connectorConfig?: AnyRecord,
  rng: Rng = Math.random,
) {
  const resultPlaceholders: AnyRecord = { ...inputData };

  const trendVerbkonstrukteRaw = textDefinition.trend_verbkonstrukte;
  const trendVerbkonstrukte =
    trendVerbkonstrukteRaw && typeof trendVerbkonstrukteRaw === "object"
      ? (trendVerbkonstrukteRaw as Record<string, unknown>)
      : {};
  const trendKeys = new Set<string>();
  for (const key of Object.keys(trendValues ?? {})) {
    if (key.startsWith("trendText_")) trendKeys.add(key);
  }

  for (const trendKey of trendKeys) {
    const trendData = (trendValues ?? {})[trendKey];
    const phrasesKey = `phrases_${trendKey}`;
    const verbKey = `verbkonstrukt_${trendKey}`;
    const phrasesBlock = trendVerbkonstrukte[phrasesKey];
    const verbBlock = trendVerbkonstrukte[verbKey];
    if (!phrasesBlock) continue;
    const trendDataObj =
      trendData && typeof trendData === "object"
        ? (trendData as Record<string, unknown>)
        : {};
    if (typeof phrasesBlock !== "object" || phrasesBlock === null) continue;
    const phrasesBlockRecord = phrasesBlock as Record<string, unknown>;

    const baseVarKey = trendKey.replace(/^trendText_/, "");
    let category = "gleich";
    if (typeof trendDataObj.index1 === "number") category = determineIndex1Category(trendDataObj.index1);
    else if (typeof trendDataObj.index100 === "number") category = determineIndex100Category(trendDataObj.index100);
    else if (typeof trendDataObj.rel_change === "number") category = determineTrendCategory(trendDataObj.rel_change);
    else if (typeof trendDataObj.abs_delta === "number") category = determineAbsoluteCategoryWithDirection(trendDataObj.abs_delta);
    else if (
      trendDataObj.direct_comparison &&
      typeof trendDataObj.direct_comparison === "object"
    ) {
      const directComparison = trendDataObj.direct_comparison as Record<string, unknown>;
      if (typeof directComparison.value_a === "number" && typeof directComparison.value_b === "number") {
        category = determineSimpleComparisonCategory(directComparison.value_a, directComparison.value_b);
      }
    } else if (typeof trendDataObj.index50 === "number") category = determineIndex50Category(trendDataObj.index50);

    if (!(baseVarKey in resultPlaceholders)) {
      if (typeof trendDataObj.rel_change === "number") {
        resultPlaceholders[baseVarKey] = Math.abs(trendDataObj.rel_change).toLocaleString("de-DE", {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        });
      } else if (typeof trendDataObj.abs_delta === "number") {
        resultPlaceholders[baseVarKey] = trendDataObj.abs_delta.toLocaleString("de-DE", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        });
      } else if (typeof trendDataObj.index1 === "number") {
        resultPlaceholders[baseVarKey] = trendDataObj.index1.toLocaleString("de-DE", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      } else if (typeof trendDataObj.index100 === "number") {
        resultPlaceholders[baseVarKey] = trendDataObj.index100.toLocaleString("de-DE", {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        });
      }
    }

    const templateCategory = mapTrendCategoryToTemplateKey(category);
    const phraseEntry = selectPhraseEntry(templateCategory, phrasesBlockRecord, true, rng) as AnyRecord;
    const renderedPhrase = fullyRenderTemplate(String(phraseEntry.phrase ?? ""), resultPlaceholders);
    resultPlaceholders[trendKey] = renderedPhrase;

    if (verbBlock && typeof verbBlock === "object") {
      const verbBlockRecord = verbBlock as Record<string, unknown>;
      const patternsRaw = verbBlockRecord[templateCategory];
      let patterns = Array.isArray(patternsRaw) ? patternsRaw : [];
      if (!patterns.length) {
        const coarseFallback: Record<string, string> = {
          leicht_groesser: "groesser",
          viel_groesser: "groesser",
          leicht_kleiner: "kleiner",
          viel_kleiner: "kleiner",
        };
        const fallbackCategory = coarseFallback[templateCategory];
        if (fallbackCategory) {
          const fallbackRaw = verbBlockRecord[fallbackCategory];
          patterns = Array.isArray(fallbackRaw) ? fallbackRaw : [];
        }
      }
      if (!patterns.length) {
        throw new Error(`Verbkonstrukt fehlt für Kategorie '${templateCategory}' im Block '${verbKey}'.`);
      }
      const [verbtext] = generateVerbkonstrukt(patterns, { ...resultPlaceholders, ...phraseEntry }, connectorConfig, rng);
      resultPlaceholders[`verbkonstrukt_${trendKey}`] = verbtext;
    }
  }

  const staticVerbkonstrukteRaw = textDefinition.static_verbkonstrukte;
  const staticVerbkonstrukte =
    staticVerbkonstrukteRaw && typeof staticVerbkonstrukteRaw === "object"
      ? (staticVerbkonstrukteRaw as Record<string, unknown>)
      : {};
  for (const [staticKey, verbPatterns] of Object.entries(staticVerbkonstrukte)) {
    if (!staticKey.startsWith("verbkonstrukt_")) continue;
    if (!Array.isArray(verbPatterns) || verbPatterns.length === 0) continue;
    const phraseKey = staticKey.replace("verbkonstrukt_", "phrases_");
    const phrasesRaw = staticVerbkonstrukte[phraseKey];
    const phrasesList = Array.isArray(phrasesRaw) ? phrasesRaw : [];
    let phraseEntry: AnyRecord = { phrase: "", auxiliar: "" };
    if (Array.isArray(phrasesList) && phrasesList.length) {
      const pick = pickRandom(phrasesList, rng);
      phraseEntry = typeof pick === "object" ? pick : { phrase: String(pick), auxiliar: "" };
    }
    phraseEntry = {
      phrase: fullyRenderTemplate(String(phraseEntry.phrase ?? ""), resultPlaceholders),
      auxiliar: String(phraseEntry.auxiliar ?? ""),
    };
    const chosen = pickRandom(verbPatterns, rng);
    const template = typeof chosen === "object"
      ? `${chosen.auxiliar ?? ""} ${chosen.phrase ?? ""}`.trim()
      : String(chosen);
    const merged = { ...resultPlaceholders, ...phraseEntry };
    const renderedOnce = fullyRenderTemplate(template, merged);
    const rendered = fullyRenderTemplate(renderedOnce, merged);
    resultPlaceholders[staticKey] = rendered;
  }

  const quoteVerbkonstrukteRaw = textDefinition.quote_verbkonstrukte;
  const quoteVerbkonstrukte =
    quoteVerbkonstrukteRaw && typeof quoteVerbkonstrukteRaw === "object"
      ? (quoteVerbkonstrukteRaw as Record<string, unknown>)
      : {};
  for (const [varname, rawValue] of Object.entries(quoteValues ?? {})) {
    const value = Number(rawValue);
    if (!Number.isFinite(value)) continue;
    const phrasesKey = `phrases_quote_${varname}`;
    const phrasesBlock = quoteVerbkonstrukte[phrasesKey] ?? trendVerbkonstrukte[phrasesKey];
    let renderedPhrase = "";
    let renderedAux = "";
    if (phrasesBlock && typeof phrasesBlock === "object") {
      const category = classifyOver100Level(value);
      const phraseEntry = selectPhraseEntry(category, phrasesBlock as Record<string, unknown>, true, rng) as AnyRecord;
      renderedPhrase = fullyRenderTemplate(String(phraseEntry.phrase ?? ""), { ...resultPlaceholders, value }).trim();
      renderedAux = String(phraseEntry.auxiliar ?? "");
    } else {
      renderedPhrase = `${Math.round(value * 10) / 10} %`;
    }
    resultPlaceholders[`quoteText_${varname}`] = renderedPhrase;

    const vkKey = `verbkonstrukt_quoteText_${varname}`;
    const vkPatternsRaw = quoteVerbkonstrukte[vkKey];
    const vkPatterns = Array.isArray(vkPatternsRaw) ? vkPatternsRaw : [];
    if (vkPatterns.length) {
      const [verbtext] = generateVerbkonstrukt(vkPatterns, { ...resultPlaceholders, phrase: renderedPhrase, auxiliar: renderedAux }, connectorConfig, rng);
      resultPlaceholders[vkKey] = verbtext;
    }
  }

  const hasVerbkonstrukt = Object.entries(resultPlaceholders).some(([k, v]) => k.startsWith("verbkonstrukt_") && v);
  return [resultPlaceholders, hasVerbkonstrukt] as const;
}

export function renderFinalText(templates: AnyRecord, placeholders: AnyRecord, hasVerbkonstrukt: boolean, rng: Rng = Math.random) {
  const templateMode = hasVerbkonstrukt ? "mit_verbkonstrukt" : "ohne_verbkonstrukt";
  if (!templates || !templates[templateMode]) {
    throw new Error(`Template-Modus '${templateMode}' fehlt.`);
  }
  const filteredRaw = templates[templateMode];
  const filtered = Array.isArray(filteredRaw) ? filteredRaw : [];
  if (!filtered.length) {
    throw new Error(`Kein Template für Modus '${templateMode}'.`);
  }
  const chosen = pickRandom(filtered, rng);
  const chosenText = String(chosen);
  const firstPass = renderTemplate(chosenText, placeholders);
  const finalPass = renderTemplate(firstPass, placeholders);
  return [normalizeGeneratedText(finalPass), chosenText, templateMode] as const;
}

export function generateTextFromMultiblock(
  textDefinition: AnyRecord,
  inputData: AnyRecord,
  trendValues: AnyRecord,
  textLabel: string,
  quoteValues?: AnyRecord,
  connectorConfig?: AnyRecord,
  rng: Rng = Math.random,
) {
  const blocks = textDefinition?.text_blocks;
  if (!blocks || !Array.isArray(blocks)) {
    throw new Error(`'text_blocks' fehlt oder ist keine Liste in Definition '${textLabel}'.`);
  }
  const selected = pickRandom(blocks, rng);
  return generateText(selected, inputData, trendValues, textLabel, quoteValues, connectorConfig, rng);
}

export function generateText(
  textDefinition: AnyRecord,
  inputData: AnyRecord,
  trendValues: AnyRecord,
  textLabel: string,
  quoteValues?: AnyRecord,
  connectorConfig?: AnyRecord,
  rng: Rng = Math.random,
) {
  const asset = textLabel.includes("_haus_") ? "haus" : "wohnung";
  let baseInput = inputData;
  if (textDefinition?.scoring_dynamic_subblocks_preisangaben || textDefinition?.scoring_dynamic_subblocks_lagekombination) {
    const scoringTexts = generateScoringTextbausteine(textDefinition, inputData, asset, rng);
    baseInput = {
      ...inputData,
      ...scoringTexts,
    };
  }
  const [placeholders, hasVerbkonstrukt] = generateDynamicPlaceholders(
    textDefinition,
    baseInput,
    trendValues,
    quoteValues ?? {},
    connectorConfig,
    rng,
  );
  const specialTemplateRaw = textDefinition?.special_cases_template;
  const specialTemplate =
    specialTemplateRaw && typeof specialTemplateRaw === "object"
      ? (specialTemplateRaw as AnyRecord)
      : null;
  if (specialTemplate) {
    const specialText = renderSpecialCasesTemplate(specialTemplate, baseInput, rng);
    if (specialText) return specialText;
  }
  const templatesRaw = textDefinition.templates;
  const templates =
    templatesRaw && typeof templatesRaw === "object"
      ? (templatesRaw as AnyRecord)
      : {};
  const [finalText] = renderFinalText(templates, placeholders, hasVerbkonstrukt, rng);
  return finalText;
}

export function renderSpecialCasesTemplate(specialTemplateBlock: AnyRecord, inputData: AnyRecord, rng: Rng = Math.random) {
  const availableKeys = Object.keys(inputData).filter((k) => k.startsWith("sondertext_") && inputData[k]);
  if (!availableKeys.length) return null;
  for (const key of availableKeys) inputData[key] = inputData[key];
  const templatesRaw = specialTemplateBlock?.templates;
  const templates = Array.isArray(templatesRaw) ? templatesRaw : [];
  if (!templates.length) return String(specialTemplateBlock?.fallback_text ?? "") || null;
  const chosen = pickRandom(templates, rng);
  const rendered = renderTemplate(String(chosen), inputData);
  const fallbackText = String(specialTemplateBlock?.fallback_text ?? "");
  return rendered.trim() || fallbackText || null;
}

export function generateScoringTextbausteine(textDefinition: AnyRecord, inputData: AnyRecord, asset = "wohnung", rng: Rng = Math.random) {
  const SCORES = ["01", "02", "03", "04", "05"];
  const detectSuffix = () => {
    const base = `quadratmeterpreis_avg_${asset}_lagescore01`;
    if (inputData[`${base}_kreis`] !== undefined) return "_kreis";
    if (inputData[`${base}_ortslage`] !== undefined) return "_ortslage";
    return "";
  };
  const suffix = detectSuffix();
  const priceKey = (metric: string, score: string) => `quadratmeterpreis_${metric}_${asset}_lagescore${score}${suffix}`;
  const fmtEur = (v: number | null) => {
    if (v === null || v === undefined) return "";
    try {
      const rounded = Math.round(v);
      return `${rounded.toLocaleString("de-DE")} €`;
    } catch {
      return String(v);
    }
  };
  const availableScores = () => SCORES.filter((s) => inputData[priceKey("avg", s)] !== null && inputData[priceKey("avg", s)] !== undefined);
  const textBlocksRaw = textDefinition?.text_blocks;
  const textBlocks = Array.isArray(textBlocksRaw) ? textBlocksRaw : [];
  const blockRaw = (textDefinition?.scoring_dynamic_subblocks_preisangaben || textDefinition?.scoring_dynamic_subblocks_lagekombination)
    ? textDefinition
    : (textBlocks[0] ?? {});
  const block =
    blockRaw && typeof blockRaw === "object"
      ? (blockRaw as Record<string, unknown>)
      : {};
  const scoringPreisRaw = block.scoring_dynamic_subblocks_preisangaben;
  const scoringPreis =
    scoringPreisRaw && typeof scoringPreisRaw === "object"
      ? (scoringPreisRaw as Record<string, unknown>)
      : {};
  const scoringLageRaw = block.scoring_dynamic_subblocks_lagekombination;
  const scoringLage =
    scoringLageRaw && typeof scoringLageRaw === "object"
      ? (scoringLageRaw as Record<string, unknown>)
      : {};
  const preisCfgRaw = scoringPreis.text_wohnlagen_liste;
  const preisCfg =
    preisCfgRaw && typeof preisCfgRaw === "object"
      ? (preisCfgRaw as Record<string, unknown>)
      : {};
  const lageCfgRaw = scoringLage.text_lageverteilung;
  const lageCfg =
    lageCfgRaw && typeof lageCfgRaw === "object"
      ? (lageCfgRaw as Record<string, unknown>)
      : {};

  const labelsByScore = preisCfg.label_by_score ?? {};
  const regionName = String(inputData.region_name ?? "").trim();

  const normalizeText = (text: string) =>
    text
      .replace(/\s+/g, " ")
      .replace(/\s+,/g, ",")
      .replace(/\s+\./g, ".")
      .replace(/Top-\s+Lagen/g, "Top-Lagen")
      .trim();

  const ensureSentence = (text: string) => {
    const t = normalizeText(text);
    if (!t) return "";
    return /[.!?]$/.test(t) ? t : `${t}.`;
  };

  const scoreContext = () => {
    const ctx: AnyRecord = {};
    for (const s of SCORES) {
      const vAvg = inputData[priceKey("avg", s)];
      const vMin = inputData[priceKey("min", s)];
      const vMax = inputData[priceKey("max", s)];
      ctx[`preis_avg_${s}`] = vAvg != null ? fmtEur(vAvg) : "";
      ctx[`preis_min_${s}`] = vMin != null ? fmtEur(vMin) : "";
      ctx[`preis_max_${s}`] = vMax != null ? fmtEur(vMax) : "";
      if (labelsByScore[s]) ctx[`label_${s}`] = labelsByScore[s];
    }
    return ctx;
  };

  const renderStep = (tpl: string, score: string) => {
    const vAvg = inputData[priceKey("avg", score)];
    if (vAvg == null) return "";
    const vMin = inputData[priceKey("min", score)];
    const vMax = inputData[priceKey("max", score)];
    const lab = labelsByScore[score] ?? "";
    const ctx: AnyRecord = {
      region_name: inputData.region_name ?? "",
      label: lab,
      preis_avg: fmtEur(vAvg),
      preis_min: vMin != null ? fmtEur(vMin) : "",
      preis_max: vMax != null ? fmtEur(vMax) : "",
    };
    ctx[`label_${score}`] = lab;
    ctx[`preis_avg_${score}`] = ctx.preis_avg;
    ctx[`preis_min_${score}`] = ctx.preis_min;
    ctx[`preis_max_${score}`] = ctx.preis_max;
    Object.assign(ctx, scoreContext());
    return ensureSentence(renderTemplate(String(tpl), ctx));
  };

  const buildFromSequencesFixed = () => {
    const seqs = preisCfg.sequences_fixed ?? [];
    if (!seqs.length) return null;
    const seq = pickRandom(seqs, rng) as AnyRecord;
    const out: string[] = [];
    const used = new Set<string>();
    const steps = Array.isArray(seq.steps) ? (seq.steps as AnyRecord[]) : [];
    for (const step of steps) {
      let score = step.score ?? "any";
      const tpl = step.template ?? "";
      if (!tpl) continue;
      if (score === "any") {
        let candidates = availableScores().filter((s) => !used.has(s));
        if (!candidates.length) candidates = availableScores();
        if (!candidates.length) continue;
        score = pickRandom(candidates, rng);
        used.add(score);
      }
      const rendered = renderStep(tpl, score);
      if (rendered) out.push(rendered);
    }
    return out;
  };

  const buildFromTemplatesByCase = () => {
    const cfg = preisCfg.templates_by_case ?? {};
    const avail = availableScores();
    if (!avail.length) return null;
    let caseKey = "list";
    if (avail.length === 1 && cfg.single) caseKey = "single";
    else if (avail.length === 2 && cfg.pair) caseKey = "pair";
    else if (cfg.list || cfg.pair) {
      const options = ["list", "pair"].filter((k) => cfg[k]);
      caseKey = pickRandom(options, rng) ?? "list";
    }
    const caseBlocks = cfg[caseKey] ?? [];
    if (!caseBlocks.length) return null;
    const block = pickRandom(caseBlocks, rng) as AnyRecord;
    const templates = block.templates ?? [];
    if (!templates.length) return null;
    const tpl = pickRandom(templates, rng);
    const slots = block.slots ?? {};
    const distinct = block.distinct_slots !== false;
    const chosen: AnyRecord = {};
    if (distinct) {
      const picked = avail.length <= Object.keys(slots).length ? avail : (() => { const tmp = [...avail]; shuffleInPlace(tmp, rng); return tmp.slice(0, Object.keys(slots).length); })();
      if (picked.length < Object.keys(slots).length) return null;
      let i = 0;
      for (const slotName of Object.keys(slots)) {
        chosen[slotName] = picked[i++];
      }
    } else {
      for (const slotName of Object.keys(slots)) {
        chosen[slotName] = pickRandom(avail, rng);
      }
    }
    const ctx: AnyRecord = { region_name: inputData.region_name ?? "" };
    for (const [slot, score] of Object.entries(chosen)) {
      const vAvg = inputData[priceKey("avg", score as string)];
      const vMin = inputData[priceKey("min", score as string)];
      const vMax = inputData[priceKey("max", score as string)];
      ctx[`label_${slot}`] = labelsByScore[score as string] ?? "";
      ctx[`preis_avg_${slot}`] = vAvg != null ? fmtEur(vAvg) : "";
      ctx[`preis_min_${slot}`] = vMin != null ? fmtEur(vMin) : "";
      ctx[`preis_max_${slot}`] = vMax != null ? fmtEur(vMax) : "";
    }
    Object.assign(ctx, scoreContext());
    return [ensureSentence(renderTemplate(String(tpl), ctx))];
  };

  const buildFromBlocks = () => {
    const avail = availableScores();
    const n = avail.length;
    if (!n) return [];
    const pickTotal = n === 1 ? 1 : n === 2 ? (rng() < 0.5 ? 1 : 2) : (rng() < 0.5 ? 2 : 3);
    let scoresCfg = preisCfg.scores ?? {};
    if (!Object.keys(scoresCfg).length && preisCfg.blocks) {
      scoresCfg = Object.fromEntries(avail.map((s) => [s, preisCfg.blocks]));
    }
    const candidates: Array<[string, string]> = [];
    for (const [score, blocks] of Object.entries(scoresCfg)) {
      const vAvg = inputData[priceKey("avg", score)];
      if (vAvg == null) continue;
      const blockList = blocks as unknown[];
      for (let bi = 0; bi < blockList.length; bi += 1) {
        const blockDef = blockList[bi] as AnyRecord;
        const label = blockDef?.attributes?.label ?? blockDef?.attributes?.label_by_score?.[score] ?? labelsByScore[score] ?? "";
        for (let ti = 0; ti < (blockDef?.templates ?? []).length; ti += 1) {
          const tpl = String(blockDef.templates[ti]);
          const vMin = inputData[priceKey("min", score)];
          const vMax = inputData[priceKey("max", score)];
          if ((tpl.includes("{{ preis_min") || tpl.includes("{{ preis_max")) && (vMin == null || vMax == null)) continue;
          const ctx: AnyRecord = {
            region_name: inputData.region_name ?? "",
            label,
            preis_avg: fmtEur(vAvg),
            preis_min: vMin != null ? fmtEur(vMin) : "",
            preis_max: vMax != null ? fmtEur(vMax) : "",
            ...scoreContext(),
          };
          const rendered = ensureSentence(renderTemplate(tpl, ctx));
          if (rendered) candidates.push([rendered, `block${bi}_tpl${ti}`]);
        }
      }
    }
    if (!candidates.length) return [];
    shuffleInPlace(candidates, rng);
    const picked: string[] = [];
    const used = new Set<string>();
    for (const [text, key] of candidates) {
      if (used.has(key)) continue;
      picked.push(text);
      used.add(key);
      if (picked.length >= pickTotal) break;
    }
    return picked;
  };

  const priceTexts = buildFromSequencesFixed() ?? buildFromTemplatesByCase() ?? buildFromBlocks();
  const joinLabels = (labels: string[]) => {
    if (labels.length === 1) return labels[0];
    if (labels.length === 2) return `${labels[0]} und ${labels[1]}`;
    return `${labels.slice(0, -1).join(", ")} und ${labels[labels.length - 1]}`;
  };
  const buildLageText = () => {
    const labelsByScoreCfg = lageCfg.labels_by_score ?? {};
    const order = lageCfg.order ?? SCORES;
    const templates = lageCfg.templates ?? {};
    const present = order.filter((s: string) => inputData[priceKey("avg", s)] != null);
    if (!present.length) return "";
    const labels = present.map((s: string) => labelsByScoreCfg[s]?.label_pl).filter(Boolean);
    if (!labels.length) return "";
    const ctx = {
      region_name: inputData.region_name ?? "",
      single: labels[0],
      pair: joinLabels(labels.slice(0, 2)),
      list: joinLabels(labels),
      first: labels[0],
      last: labels[labels.length - 1],
    };
    if (labels.length >= 3 && templates.range && rng() < 0.4) {
      const tpl = pickRandom(templates.range, rng);
      return ensureSentence(renderTemplate(String(tpl), ctx));
    }
    let candidates: string[] = [];
    if (labels.length === 1 && templates.single) candidates = templates.single;
    else if (labels.length === 2 && templates.pair) candidates = templates.pair;
    else if (labels.length === 3 && templates.list_3) candidates = templates.list_3;
    else if (labels.length === 4 && templates.list_4) candidates = templates.list_4;
    else if (labels.length >= 5 && templates.list_5) candidates = templates.list_5;
    else candidates = templates.list ?? [];
    if (!candidates.length) return "";
    const tpl = pickRandom(candidates, rng);
    return ensureSentence(renderTemplate(String(tpl), ctx));
  };

  const buildPriceFallback = () => {
    const scores = availableScores();
    if (!scores.length) {
      const fallbackRegion = regionName || "der Region";
      return ensureSentence(
        `Im Marktüberblick für ${fallbackRegion} zeigen die Lageklassen unterschiedliche Preisniveaus.`,
      );
    }
    const scored = scores
      .map((s) => ({
        score: s,
        label: labelsByScore[s] ?? `Lagescore ${s}`,
        avg: inputData[priceKey("avg", s)] as number,
      }))
      .filter((x) => typeof x.avg === "number")
      .sort((a, b) => a.avg - b.avg);
    if (!scored.length) return "";

    const openerOptions = [
      `${regionName} zeigt eine differenzierte Preisstruktur über die Lageklassen hinweg`,
      `Die Lagequalität wirkt sich in ${regionName} deutlich auf die Preisniveaus aus`,
      `Im regionalen Vergleich von ${regionName} unterscheiden sich die Preisniveaus je Lageklasse klar`,
    ];
    const opener = pickRandom(openerOptions, rng);

    const segments = scored.map((entry) => `${entry.label} mit durchschnittlich ${fmtEur(entry.avg)}`);
    const body =
      segments.length === 1
        ? segments[0]
        : segments.length === 2
          ? `${segments[0]} und ${segments[1]}`
          : `${segments.slice(0, -1).join(", ")} sowie ${segments[segments.length - 1]}`;
    return ensureSentence(`${opener}: ${body}`);
  };

  const buildLageFallback = () => {
    const labelsByScoreCfg = lageCfg.labels_by_score ?? {};
    const present = SCORES.filter((s) => inputData[priceKey("avg", s)] != null);
    const labels = present.map((s) => labelsByScoreCfg[s]?.label_pl ?? labelsByScore[s]).filter(Boolean);
    if (!labels.length) {
      const fallbackRegion = regionName || "der Region";
      return ensureSentence(
        `Die Lageverteilung in ${fallbackRegion} ordnet die Preisentwicklung nach Lagequalität ein.`,
      );
    }
    if (labels.length === 1) {
      return ensureSentence(`Aktuell ist in ${regionName} vor allem die Lagekategorie ${labels[0]} aktiv.`);
    }
    if (labels.length === 2) {
      return ensureSentence(`Die Preisverteilung in ${regionName} konzentriert sich auf ${labels[0]} und ${labels[1]}.`);
    }
    return ensureSentence(`In ${regionName} verteilt sich das Preisniveau über ${joinLabels(labels)}.`);
  };

  const wohnlagenList = ensureSentence((priceTexts ?? []).join(" ").trim()) || buildPriceFallback();
  const lageText = ensureSentence(buildLageText()) || buildLageFallback();

  return {
    text_wohnlagen_liste: wohnlagenList,
    text_lageverteilung: lageText,
  };
}

export function formatPriceValue(value: number) {
  if (value < 100) return Math.round(value);
  if (value < 1000) return Math.round(value / 10) * 10;
  if (value < 10000) return Math.round(value / 10) * 10;
  return Math.round(value / 1000) * 1000;
}

export function formatHigherNumbersWithSuffix(value: number) {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)} Mrd`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(2)} Mio`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(2)} Tsd`;
  return `${sign}${abs}`;
}

export function redefineNumber(value: number, rng: Rng = Math.random) {
  const lower = value * 0.975;
  const upper = value * 1.025;
  return lower + rng() * (upper - lower);
}

export function getValueOfCleanArray(array: number[]) {
  const filtered = array.filter((v) => v !== 0);
  if (!filtered.length) return 0;
  return filtered.reduce((a, b) => a + b, 0) / filtered.length;
}

export function formatRentValue(value: number) {
  const s = String(value).replace(".", ",");
  return Number(parseFloat(s).toFixed(2));
}

export function umlauteUmwandeln(text: string) {
  const replacements: Record<string, string> = {
    ae: "ä",
    oe: "ö",
    ue: "ü",
    Ae: "Ä",
    Oe: "Ö",
    Ue: "Ü",
  };
  let out = text;
  for (const [src, dest] of Object.entries(replacements)) {
    out = out.replace(new RegExp(src, "g"), dest);
  }
  return out;
}

export function capitalizeWords(input: string) {
  return input
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
