type AnyRecord = Record<string, any>;

const DEFAULT_MAX_PASSES = 5;

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

export function determineTrendCategory(relativeChange: number, thresholds = [0.02, 0.05, 0.10]) {
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

export function selectPhraseEntry(category: string, phraseJson: AnyRecord, strict = true) {
  const options = phraseJson?.[category] ?? [];
  if (!options.length) {
    if (strict) {
      throw new Error(`Phrasen fehlen für Kategorie '${category}'. Vorhandene Keys: ${Object.keys(phraseJson ?? {})}`);
    }
    return { phrase: "", auxiliar: "" };
  }
  return options[Math.floor(Math.random() * options.length)];
}

export function generateVerbkonstrukt(
  patterns: any[],
  renderContext: AnyRecord,
  connectorConfig?: AnyRecord,
) {
  if (!patterns || !patterns.length) return ["", null, null] as const;
  const rawPattern = patterns[Math.floor(Math.random() * patterns.length)];
  let pattern = "";
  let phrase = "";

  if (typeof rawPattern === "object" && rawPattern !== null) {
    if ("phrase" in rawPattern || "auxiliar" in rawPattern) {
      renderContext = { ...renderContext, ...rawPattern };
      phrase = rawPattern.phrase ?? "";
      const aux = rawPattern.auxiliar ?? "";
      pattern = `${aux} ${phrase}`.trim();
    } else {
      pattern = String(Object.keys(rawPattern)[0] ?? "");
    }
  } else {
    pattern = String(rawPattern);
  }

  if (connectorConfig) {
    const connectorType = renderContext.connector_type ?? "neutral";
    const linkOptions = connectorConfig?.[connectorType]?.link ?? [];
    renderContext = { ...renderContext, link_word: linkOptions.length ? linkOptions[Math.floor(Math.random() * linkOptions.length)] : "" };
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
) {
  const resultPlaceholders: AnyRecord = { ...inputData };

  const trendVerbkonstrukte = textDefinition.trend_verbkonstrukte ?? {};
  for (const [trendKey, trendData] of Object.entries(trendValues ?? {})) {
    const phrasesKey = `phrases_${trendKey}`;
    const verbKey = `verbkonstrukt_${trendKey}`;
    const phrasesBlock = trendVerbkonstrukte?.[phrasesKey];
    const verbBlock = trendVerbkonstrukte?.[verbKey];
    if (!phrasesBlock) continue;

    let category = "gleich";
    if ("index1" in trendData) category = determineIndex1Category(trendData.index1);
    else if ("index100" in trendData) category = determineIndex100Category(trendData.index100);
    else if ("rel_change" in trendData) category = determineTrendCategory(trendData.rel_change);
    else if ("abs_delta" in trendData) category = determineAbsoluteCategoryWithDirection(trendData.abs_delta);
    else if ("direct_comparison" in trendData) category = determineSimpleComparisonCategory(trendData.direct_comparison.value_a, trendData.direct_comparison.value_b);
    else if ("index50" in trendData) category = determineIndex50Category(trendData.index50);

    const templateCategory = mapTrendCategoryToTemplateKey(category);
    const phraseEntry = selectPhraseEntry(templateCategory, phrasesBlock, true);
    const renderedPhrase = fullyRenderTemplate(phraseEntry.phrase ?? "", resultPlaceholders);
    resultPlaceholders[trendKey] = renderedPhrase;

    if (verbBlock) {
      const patterns = verbBlock[templateCategory] ?? [];
      if (!patterns.length) {
        throw new Error(`Verbkonstrukt fehlt für Kategorie '${templateCategory}' im Block '${verbKey}'.`);
      }
      const [verbtext] = generateVerbkonstrukt(patterns, { ...resultPlaceholders, ...phraseEntry }, connectorConfig);
      resultPlaceholders[`verbkonstrukt_${trendKey}`] = verbtext;
    }
  }

  const staticVerbkonstrukte = textDefinition.static_verbkonstrukte ?? {};
  for (const [staticKey, verbPatterns] of Object.entries(staticVerbkonstrukte)) {
    if (!staticKey.startsWith("verbkonstrukt_")) continue;
    if (!Array.isArray(verbPatterns) || verbPatterns.length === 0) continue;
    const phraseKey = staticKey.replace("verbkonstrukt_", "phrases_");
    const phrasesList = staticVerbkonstrukte[phraseKey] ?? [];
    let phraseEntry: AnyRecord = { phrase: "", auxiliar: "" };
    if (Array.isArray(phrasesList) && phrasesList.length) {
      const pick = phrasesList[Math.floor(Math.random() * phrasesList.length)];
      phraseEntry = typeof pick === "object" ? pick : { phrase: String(pick), auxiliar: "" };
    }
    phraseEntry = {
      phrase: fullyRenderTemplate(String(phraseEntry.phrase ?? ""), resultPlaceholders),
      auxiliar: String(phraseEntry.auxiliar ?? ""),
    };
    const chosen = verbPatterns[Math.floor(Math.random() * verbPatterns.length)];
    const template = typeof chosen === "object"
      ? `${chosen.auxiliar ?? ""} ${chosen.phrase ?? ""}`.trim()
      : String(chosen);
    const merged = { ...resultPlaceholders, ...phraseEntry };
    const renderedOnce = fullyRenderTemplate(template, merged);
    const rendered = fullyRenderTemplate(renderedOnce, merged);
    resultPlaceholders[staticKey] = rendered;
  }

  const quoteVerbkonstrukte = textDefinition.quote_verbkonstrukte ?? {};
  for (const [varname, rawValue] of Object.entries(quoteValues ?? {})) {
    const value = Number(rawValue);
    if (!Number.isFinite(value)) continue;
    const phrasesKey = `phrases_quote_${varname}`;
    const phrasesBlock = quoteVerbkonstrukte[phrasesKey] ?? trendVerbkonstrukte[phrasesKey];
    let renderedPhrase = "";
    let renderedAux = "";
    if (phrasesBlock) {
      const category = classifyOver100Level(value);
      const phraseEntry = selectPhraseEntry(category, phrasesBlock, true);
      renderedPhrase = fullyRenderTemplate(phraseEntry.phrase ?? "", { ...resultPlaceholders, value }).trim();
      renderedAux = phraseEntry.auxiliar ?? "";
    } else {
      renderedPhrase = `${Math.round(value * 10) / 10} %`;
    }
    resultPlaceholders[`quoteText_${varname}`] = renderedPhrase;

    const vkKey = `verbkonstrukt_quoteText_${varname}`;
    const vkPatterns = quoteVerbkonstrukte[vkKey] ?? trendVerbkonstrukte?.quote_verbkonstrukte?.[vkKey];
    if (vkPatterns) {
      const [verbtext] = generateVerbkonstrukt(vkPatterns, { ...resultPlaceholders, phrase: renderedPhrase, auxiliar: renderedAux }, connectorConfig);
      resultPlaceholders[vkKey] = verbtext;
    }
  }

  const hasVerbkonstrukt = Object.entries(resultPlaceholders).some(([k, v]) => k.startsWith("verbkonstrukt_") && v);
  return [resultPlaceholders, hasVerbkonstrukt] as const;
}

export function renderFinalText(templates: AnyRecord, placeholders: AnyRecord, hasVerbkonstrukt: boolean) {
  const templateMode = hasVerbkonstrukt ? "mit_verbkonstrukt" : "ohne_verbkonstrukt";
  if (!templates || !templates[templateMode]) {
    throw new Error(`Template-Modus '${templateMode}' fehlt.`);
  }
  const filtered = templates[templateMode];
  if (!filtered || filtered.length === 0) {
    throw new Error(`Kein Template für Modus '${templateMode}'.`);
  }
  const chosen = filtered[Math.floor(Math.random() * filtered.length)];
  const firstPass = renderTemplate(chosen, placeholders);
  const finalPass = renderTemplate(firstPass, placeholders);
  return [finalPass, chosen, templateMode] as const;
}

export function generateTextFromMultiblock(
  textDefinition: AnyRecord,
  inputData: AnyRecord,
  trendValues: AnyRecord,
  textLabel: string,
  quoteValues?: AnyRecord,
  connectorConfig?: AnyRecord,
) {
  const blocks = textDefinition?.text_blocks;
  if (!blocks || !Array.isArray(blocks)) {
    throw new Error(`'text_blocks' fehlt oder ist keine Liste in Definition '${textLabel}'.`);
  }
  const selected = blocks[Math.floor(Math.random() * blocks.length)];
  return generateText(selected, inputData, trendValues, textLabel, quoteValues, connectorConfig);
}

export function generateText(
  textDefinition: AnyRecord,
  inputData: AnyRecord,
  trendValues: AnyRecord,
  textLabel: string,
  quoteValues?: AnyRecord,
  connectorConfig?: AnyRecord,
) {
  const [placeholders, hasVerbkonstrukt] = generateDynamicPlaceholders(
    textDefinition,
    inputData,
    trendValues,
    quoteValues ?? {},
    connectorConfig,
  );
  const specialTemplate = textDefinition?.special_cases_template;
  if (specialTemplate) {
    const specialText = renderSpecialCasesTemplate(specialTemplate, inputData);
    if (specialText) return specialText;
  }
  const [finalText] = renderFinalText(textDefinition.templates, placeholders, hasVerbkonstrukt);
  return finalText;
}

export function renderSpecialCasesTemplate(specialTemplateBlock: AnyRecord, inputData: AnyRecord) {
  const availableKeys = Object.keys(inputData).filter((k) => k.startsWith("sondertext_") && inputData[k]);
  if (!availableKeys.length) return null;
  for (const key of availableKeys) inputData[key] = inputData[key];
  const templates = specialTemplateBlock?.templates ?? [];
  if (!templates.length) return specialTemplateBlock?.fallback_text ?? null;
  const chosen = templates[Math.floor(Math.random() * templates.length)];
  const rendered = renderTemplate(String(chosen), inputData);
  const fallbackText = specialTemplateBlock?.fallback_text;
  return rendered.trim() || fallbackText || null;
}

export function generateScoringTextbausteine(textDefinition: AnyRecord, inputData: AnyRecord, asset = "wohnung") {
  const SCORES = ["01", "02", "03", "04", "05"];
  const priceKey = (metric: string, score: string) => `quadratmeterpreis_${metric}_${asset}_lagescore${score}`;
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
  const block = (textDefinition?.text_blocks ?? [{}])[0];
  const preisCfg = block?.scoring_dynamic_subblocks_preisangaben?.text_wohnlagen_liste ?? {};
  const lageCfg = block?.scoring_dynamic_subblocks_lagekombination?.text_lageverteilung ?? {};

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
    const seq = seqs[Math.floor(Math.random() * seqs.length)];
    const out: string[] = [];
    const used = new Set<string>();
    for (const step of seq.steps ?? []) {
      let score = step.score ?? "any";
      const tpl = step.template ?? "";
      if (!tpl) continue;
      if (score === "any") {
        let candidates = availableScores().filter((s) => !used.has(s));
        if (!candidates.length) candidates = availableScores();
        if (!candidates.length) continue;
        score = candidates[Math.floor(Math.random() * candidates.length)];
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
      caseKey = options[Math.floor(Math.random() * options.length)] ?? "list";
    }
    const caseBlocks = cfg[caseKey] ?? [];
    if (!caseBlocks.length) return null;
    const block = caseBlocks[Math.floor(Math.random() * caseBlocks.length)];
    const templates = block.templates ?? [];
    if (!templates.length) return null;
    const tpl = templates[Math.floor(Math.random() * templates.length)];
    const slots = block.slots ?? {};
    const distinct = block.distinct_slots !== false;
    const chosen: AnyRecord = {};
    if (distinct) {
      const picked = avail.length <= Object.keys(slots).length ? avail : [...avail].sort(() => Math.random() - 0.5).slice(0, Object.keys(slots).length);
      if (picked.length < Object.keys(slots).length) return null;
      let i = 0;
      for (const slotName of Object.keys(slots)) {
        chosen[slotName] = picked[i++];
      }
    } else {
      for (const slotName of Object.keys(slots)) {
        chosen[slotName] = avail[Math.floor(Math.random() * avail.length)];
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
    const pickTotal = n === 1 ? 1 : n === 2 ? (Math.random() < 0.5 ? 1 : 2) : (Math.random() < 0.5 ? 2 : 3);
    let scoresCfg = preisCfg.scores ?? {};
    if (!Object.keys(scoresCfg).length && preisCfg.blocks) {
      scoresCfg = Object.fromEntries(avail.map((s) => [s, preisCfg.blocks]));
    }
    const candidates: Array<[string, string]> = [];
    for (const [score, blocks] of Object.entries(scoresCfg)) {
      const vAvg = inputData[priceKey("avg", score)];
      if (vAvg == null) continue;
      for (let bi = 0; bi < (blocks as any[]).length; bi += 1) {
        const blockDef = (blocks as any[])[bi];
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
    candidates.sort(() => Math.random() - 0.5);
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
    if (labels.length >= 3 && templates.range && Math.random() < 0.4) {
      const tpl = templates.range[Math.floor(Math.random() * templates.range.length)];
      return ensureSentence(renderTemplate(tpl, ctx));
    }
    let candidates: string[] = [];
    if (labels.length === 1 && templates.single) candidates = templates.single;
    else if (labels.length === 2 && templates.pair) candidates = templates.pair;
    else if (labels.length === 3 && templates.list_3) candidates = templates.list_3;
    else if (labels.length === 4 && templates.list_4) candidates = templates.list_4;
    else if (labels.length >= 5 && templates.list_5) candidates = templates.list_5;
    else candidates = templates.list ?? [];
    if (!candidates.length) return "";
    const tpl = candidates[Math.floor(Math.random() * candidates.length)];
    return ensureSentence(renderTemplate(tpl, ctx));
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
    const opener = openerOptions[Math.floor(Math.random() * openerOptions.length)];

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

export function redefineNumber(value: number) {
  const lower = value * 0.975;
  const upper = value * 1.025;
  return lower + Math.random() * (upper - lower);
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
    ss: "ß",
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
