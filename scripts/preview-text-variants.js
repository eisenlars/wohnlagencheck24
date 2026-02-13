#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function formatPercent(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return value.toFixed(1).replace(".", ",") + " %";
}

function formatEur(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return (
    value
      .toFixed(0)
      .replace(/\B(?=(\d{3})+(?!\d))/g, ".") +
    " €/m²"
  );
}

function formatNumber(value, decimals = 1) {
  return value.toLocaleString("de-DE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function toNumber(value) {
  if (value == null) return undefined;
  const num = Number(value);
  return Number.isNaN(num) ? undefined : num;
}

function capitalizeWords(value) {
  return String(value)
    .split(" ")
    .map((word) => {
      return word
        .split("-")
        .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
        .join("-");
    })
    .join(" ");
}

function determineTrendCategory(relativeChange, thresholds = [2, 5, 10]) {
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

function determineIndex100Category(indexValue, thresholds = [2, 5, 10]) {
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

function determineIndex1Category(indexValue, thresholds = [0.02, 0.05, 0.1]) {
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

function replaceVars(template, vars) {
  return template.replace(/{{\s*([^}]+)\s*}}/g, (_, key) => {
    const value = vars[key.trim()];
    return value != null ? String(value) : `{{ ${key.trim()} }}`;
  });
}

function buildVars(report) {
  const inputs = report?.textgen_inputs?.kreis || {};
  const metaBase = report?.meta?.base_values?.kreis || {};

  const prices = inputs?.marketValues_generallyPrices_dict || {};
  const plots = inputs?.priceValues_plots_dict || {};

  const year01 = toNumber(inputs.year01) ?? 2026;

  const immobilien_kaufpreis = toNumber(prices.immobilienpreise_mittel_jahr01_kreis) ?? toNumber(metaBase.immobilien_kaufpreis);
  const immobilien_kaufpreis_bl = toNumber(prices.immobilienpreise_mittel_jahr01_bundesland);
  const immobilien_kaufpreis_vorjahr = toNumber(prices.immobilienpreise_mittel_jahr02_kreis);
  const immobilien_kaufpreis_vor5 = toNumber(prices.immobilienpreise_mittel_jahr05_kreis);

  const grund = toNumber(plots.quadratmeterpreis_avg_grundstueck_jahr01_kreis) ?? toNumber(metaBase.grundstueck_kaufpreis);
  const grund_bl = toNumber(plots.quadratmeterpreis_avg_grundstueck_jahr01_bundesland);
  const grund_vorjahr = toNumber(plots.quadratmeterpreis_avg_grundstueck_jahr02_kreis);
  const grund_vor5 = toNumber(plots.quadratmeterpreis_avg_grundstueck_jahr05_kreis);

  const miete = toNumber(prices.mietpreise_mittel_kreis) ?? toNumber(metaBase.mietpreise_gesamt);
  const miete_bl = toNumber(prices.mietpreise_mittel_bundesland);
  const miete_vorjahr = toNumber(prices.mietpreise_mittel_kreis_vorjahr);
  const miete_vor5 = toNumber(prices.mietpreise_mittel_kreis_vor_5_jahren);

  const regionName = capitalizeWords(report?.meta?.amtlicher_name || report?.meta?.kreis_name || "");
  const bundeslandName = capitalizeWords(report?.meta?.bundesland_name || "");

  const trendImmobilien5 = immobilien_kaufpreis_vor5
    ? ((immobilien_kaufpreis - immobilien_kaufpreis_vor5) / immobilien_kaufpreis_vor5) * 100
    : 0;
  const trendImmobilien1 = immobilien_kaufpreis_vorjahr
    ? ((immobilien_kaufpreis - immobilien_kaufpreis_vorjahr) / immobilien_kaufpreis_vorjahr) * 100
    : 0;

  const trendGrund1 = grund_vorjahr
    ? ((grund - grund_vorjahr) / grund_vorjahr) * 100
    : 0;
  const trendGrund5 = grund_vor5
    ? ((grund - grund_vor5) / grund_vor5) * 100
    : 0;

  const trendMiete1 = miete_vorjahr
    ? ((miete - miete_vorjahr) / miete_vorjahr) * 100
    : 0;
  const trendMiete5 = miete_vor5 ? ((miete - miete_vor5) / miete_vor5) * 100 : 0;

  const vars = {
    region_name: regionName,
    kreis_name: regionName,
    bundesland_name: bundeslandName,
    jahr01: year01,
    jahr05: year01 - 4,
    immobilienpreise_mittel_jahr01_kreis_eur: formatEur(immobilien_kaufpreis),
    immobilienpreise_mittel_jahr05_kreis_eur: formatEur(immobilien_kaufpreis_vor5),
    grundstueckspreise_mittel_jahr01_kreis_eur: formatEur(grund),
    mietpreise_mittel_kreis_eur: formatEur(miete),
    immobilienpreise_mittel_vorjahrestrend_kreis_pct: formatPercent(Math.abs(trendImmobilien1)),
    immobilienpreise_mittel_vorjahrestrend_kreis: formatNumber(Math.abs(trendImmobilien1), 1).replace(".", ","),
    immobilienpreise_mittel_5jahrestrend_kreis: formatNumber(Math.abs(trendImmobilien5), 1).replace(".", ","),
    grundstueckspreise_mittel_vorjahrestrend_kreis: formatNumber(Math.abs(trendGrund1), 1).replace(".", ","),
    grundstueckspreise_mittel_5jahrestrend_kreis: formatNumber(Math.abs(trendGrund5), 1).replace(".", ","),
    mietpreise_mittel_vorjahrestrend_kreis: formatNumber(Math.abs(trendMiete1), 1).replace(".", ","),
    mietpreise_mittel_5jahrestrend_kreis: formatNumber(Math.abs(trendMiete5), 1).replace(".", ","),
  };

  const trendCategories = {
    trendText_immobilienpreise_mittel_vergleich_kreis_bundesland: determineIndex100Category(
      immobilien_kaufpreis_bl ? (immobilien_kaufpreis / immobilien_kaufpreis_bl) * 100 : 100
    ),
    trendText_immobilienpreise_mittel_vorjahrestrend_kreis: determineTrendCategory(trendImmobilien1),
    trendText_immobilienpreise_mittel_5jahrestrend_kreis: determineTrendCategory(trendImmobilien5),
    trendText_grundstueckspreise_mittel_vergleich_kreis_bundesland: determineIndex100Category(
      grund_bl ? (grund / grund_bl) * 100 : 100
    ),
    trendText_grundstueckspreise_mittel_vorjahrestrend_kreis: determineTrendCategory(trendGrund1),
    trendText_grundstueckspreise_mittel_5jahrestrend_kreis: determineTrendCategory(trendGrund5),
    trendText_mietpreise_mittel_vergleich_kreis_bundesland: determineIndex1Category(
      miete_bl ? miete / miete_bl : 1
    ),
    trendText_mietpreise_mittel_vorjahrestrend_kreis: determineTrendCategory(trendMiete1),
    trendText_mietpreise_mittel_5jahrestrend_kreis: determineTrendCategory(trendMiete5),
  };

  return { vars, trendCategories };
}

function expandVerbkonstrukte(verbPatterns, phraseEntries, baseVars) {
  const out = [];
  for (const verbPattern of verbPatterns) {
    for (const phraseEntry of phraseEntries) {
      const renderedPhrase = replaceVars(String(phraseEntry.phrase ?? ""), baseVars);
      const auxiliar = String(phraseEntry.auxiliar ?? "");
      const rendered = replaceVars(String(verbPattern), {
        ...baseVars,
        phrase: renderedPhrase,
        auxiliar,
      });
      out.push(rendered);
    }
  }
  return out;
}

function buildPlaceholderOptions(definition, baseVars, trendCategories) {
  const options = {};

  const trendBlocks = definition.trend_verbkonstrukte || {};
  const trendKeys = new Set();
  for (const key of Object.keys(trendBlocks)) {
    if (key.startsWith("phrases_")) trendKeys.add(key.replace("phrases_", ""));
    if (key.startsWith("verbkonstrukt_")) trendKeys.add(key.replace("verbkonstrukt_", ""));
  }

  for (const trendKey of trendKeys) {
    const category = trendCategories[trendKey];
    const phrasesKey = `phrases_${trendKey}`;
    const verbKey = `verbkonstrukt_${trendKey}`;

    const phrases = trendBlocks[phrasesKey]?.[category] || [];
    const verbPatterns = trendBlocks[verbKey]?.[category] || [];

    if (phrases.length) {
      const renderedPhrases = phrases.map((entry) => replaceVars(String(entry.phrase ?? ""), baseVars));
      options[trendKey] = renderedPhrases;
    }

    if (phrases.length && verbPatterns.length) {
      options[verbKey] = expandVerbkonstrukte(verbPatterns, phrases, baseVars);
    }
  }

  const staticBlocks = definition.static_verbkonstrukte || {};
  for (const [staticKey, patterns] of Object.entries(staticBlocks)) {
    if (!staticKey.startsWith("verbkonstrukt_")) continue;
    const phraseKey = staticKey.replace("verbkonstrukt_", "phrases_");
    const phrases = staticBlocks[phraseKey] || [];
    if (!Array.isArray(patterns) || !patterns.length || !Array.isArray(phrases) || !phrases.length) continue;
    options[staticKey] = expandVerbkonstrukte(patterns, phrases, baseVars);
  }

  return options;
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function expandTemplate(template, optionsMap, baseVars) {
  const keys = Array.from(new Set(template.match(/{{\s*([^}]+)\s*}}/g) || [])).map((raw) =>
    raw.replace(/{{\s*|\s*}}/g, "")
  );

  let variants = [template];
  for (const key of keys) {
    const options = optionsMap[key] || [baseVars[key] != null ? String(baseVars[key]) : `{{ ${key} }}`];
    const regex = new RegExp(`{{\\s*${escapeRegExp(key)}\\s*}}`, "g");
    const next = [];
    for (const variant of variants) {
      for (const option of options) {
        next.push(variant.replace(regex, option));
      }
    }
    variants = next;
  }
  return variants;
}

function main() {
  const reportPath = path.join(
    __dirname,
    "..",
    "data",
    "json",
    "reports",
    "deutschland",
    "sachsen",
    "leipzig.json"
  );
  const phrasesPath = path.join(
    __dirname,
    "..",
    "lib",
    "text-core",
    "phrases",
    "kreis",
    "immobilienmarkt.json"
  );

  const report = readJson(reportPath);
  const phrases = readJson(phrasesPath);

  const def = phrases.immobilienmarkt_beschreibung_01;
  if (!def) {
    console.error("Definition not found for immobilienmarkt_beschreibung_01");
    process.exit(1);
  }

  const { vars, trendCategories } = buildVars(report);
  const placeholderOptions = buildPlaceholderOptions(def, vars, trendCategories);

  const output = [];
  let blockIndex = 1;
  for (const block of def.text_blocks) {
    output.push(`=== Block ${blockIndex} ===`);
    blockIndex += 1;

    for (const [mode, templates] of Object.entries(block.templates || {})) {
      output.push(`-- Mode: ${mode} --`);
      for (const tpl of templates) {
        const expanded = expandTemplate(String(tpl), placeholderOptions, vars);
        let idx = 1;
        for (const variant of expanded) {
          output.push(`--- Variante ${idx} ---`);
          output.push(variant.trim());
          output.push("");
          idx += 1;
        }
      }
    }
    output.push("");
  }

  const outPath = path.join(__dirname, "..", "tmp", "text-variants.txt");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, output.join("\n"), "utf8");

  console.log(`Wrote variants to ${outPath}`);
}

main();
