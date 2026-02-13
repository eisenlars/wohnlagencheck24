#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const LOG_PATH = path.join(process.cwd(), "tmp", "textgen-preview.log");

function parseArgs(argv) {
  const args = { key: null, limit: 5 };
  for (let i = 2; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === "--key" && argv[i + 1]) {
      args.key = argv[i + 1];
      i += 1;
      continue;
    }
    if (value === "--limit" && argv[i + 1]) {
      const n = Number(argv[i + 1]);
      if (Number.isFinite(n) && n > 0) args.limit = Math.floor(n);
      i += 1;
      continue;
    }
  }
  return args;
}

function readLines(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, "utf8").trim();
  if (!raw) return [];
  return raw.split(/\n+/).filter(Boolean);
}

function pickLastBatch(items) {
  if (!items.length) return [];
  const last = items[items.length - 1];
  const total = Number(last.total);
  if (!Number.isFinite(total) || total <= 0 || items.length < total) return items;
  return items.slice(-total);
}

function trackExample(store, key, text) {
  if (!store[key]) store[key] = text;
}

function main() {
  const args = parseArgs(process.argv);
  if (!args.key) {
    console.log("Usage: node scripts/textgen-qa.js --key <text_key> [--limit 5]");
    process.exit(1);
  }

  const lines = readLines(LOG_PATH);
  const entries = [];
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (obj && obj.key === args.key && typeof obj.text === "string") {
        entries.push(obj);
      }
    } catch {
      // ignore
    }
  }

  const batch = pickLastBatch(entries);
  console.log(`key: ${args.key}`);
  console.log(`variants in batch: ${batch.length}`);

  const issues = {
    fragment_dot_sind: 0,
    grund_liegt_ohne_bei: 0,
    plural_betraegt: 0,
    damit_liegt_sie: 0,
    doppelt_durchschnitt: 0,
  };
  const examples = {};

  for (const v of batch) {
    const text = String(v.text || "");
    if (/\.\s*sind die Preise/.test(text)) {
      issues.fragment_dot_sind += 1;
      trackExample(examples, "fragment_dot_sind", text);
    }
    if (/Grundstücks[^.\n]*liegt\s+\d/.test(text)) {
      issues.grund_liegt_ohne_bei += 1;
      trackExample(examples, "grund_liegt_ohne_bei", text);
    }
    if (/Durchschnittsmieten[^.\n]*beträgt/.test(text)) {
      issues.plural_betraegt += 1;
      trackExample(examples, "plural_betraegt", text);
    }
    if (/Damit liegt sie/.test(text)) {
      issues.damit_liegt_sie += 1;
      trackExample(examples, "damit_liegt_sie", text);
    }
    if (/Durchschnitt.*Durchschnitt/.test(text)) {
      issues.doppelt_durchschnitt += 1;
      trackExample(examples, "doppelt_durchschnitt", text);
    }
  }

  console.log("issue counts:", issues);
  console.log("");
  const keys = Object.keys(examples).slice(0, args.limit);
  for (const key of keys) {
    console.log(`EXAMPLE ${key}:`);
    console.log(examples[key]);
    console.log("");
  }
}

main();
