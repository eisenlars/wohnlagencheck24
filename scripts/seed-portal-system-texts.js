#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const { createClient } = require("@supabase/supabase-js");
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const TARGET_LOCALES = [
  "en",
  "en-us",
  "en-gb",
  "fr",
  "it",
  "es",
  "nl",
  "pt",
  "pt-br",
  "pl",
  "tr",
  "ar",
  "ru",
  "zh",
];

function parseArgs(argv) {
  const args = {
    locales: null,
    status: "draft",
  };
  for (const raw of argv) {
    if (raw.startsWith("--locales=")) {
      args.locales = raw
        .slice("--locales=".length)
        .split(",")
        .map((value) => String(value || "").trim().toLowerCase())
        .filter(Boolean);
      continue;
    }
    if (raw.startsWith("--status=")) {
      const value = raw.slice("--status=".length).trim().toLowerCase();
      if (value === "draft" || value === "internal" || value === "live") {
        args.status = value;
      }
    }
  }
  return args;
}

function buildSourceSnapshotHash(key, valueText) {
  return createHash("sha256")
    .update(JSON.stringify({ key, value_text: valueText }))
    .digest("hex");
}

function loadSystemTextDefaults() {
  const filePath = path.join(__dirname, "..", "lib", "portal-system-text-definitions.ts");
  const source = fs.readFileSync(filePath, "utf8");
  const match = source.match(/export const PORTAL_SYSTEM_TEXT_DEFAULTS[\s\S]*?=\s*({[\s\S]*?^});/m);
  if (!match || !match[1]) {
    throw new Error("PORTAL_SYSTEM_TEXT_DEFAULTS konnten nicht aus lib/portal-system-text-definitions.ts gelesen werden.");
  }
  const sandbox = {};
  const script = new vm.Script(`result = ${match[1]};`);
  script.runInNewContext(sandbox);
  if (!sandbox.result || typeof sandbox.result !== "object") {
    throw new Error("PORTAL_SYSTEM_TEXT_DEFAULTS konnten nicht ausgewertet werden.");
  }
  return sandbox.result;
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlt.");
  }

  const args = parseArgs(process.argv.slice(2));
  const locales = Array.from(new Set((args.locales && args.locales.length > 0 ? args.locales : TARGET_LOCALES)
    .map((value) => String(value || "").trim().toLowerCase())
    .filter((value) => value && value !== "de")));

  if (locales.length === 0) {
    console.log("Keine Ziel-Locales übergeben.");
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: sourceRows, error: sourceError } = await supabase
    .from("portal_system_text_entries")
    .select("key, value_text, updated_at")
    .eq("locale", "de");
  if (sourceError) throw new Error(`DE-Systemtexte konnten nicht geladen werden: ${sourceError.message}`);

  const rows = Array.isArray(sourceRows) ? sourceRows : [];
  const defaults = loadSystemTextDefaults();
  const germanDefaults = defaults.de && typeof defaults.de === "object" ? defaults.de : null;
  if (!germanDefaults) {
    throw new Error("Deutsche Systemtext-Defaults fehlen.");
  }
  const germanSourceMap = new Map(
    rows.length > 0
      ? rows
        .map((row) => [String(row.key || "").trim(), {
          value_text: String(row.value_text || ""),
          updated_at: row.updated_at ? String(row.updated_at) : null,
        }])
        .filter(([key]) => Boolean(key))
      : Object.entries(germanDefaults).map(([key, value]) => [key, {
        value_text: String(value || ""),
        updated_at: null,
      }]),
  );

  const nowIso = new Date().toISOString();
  const entryPayload = [];
  const metaPayload = [];

  for (const locale of locales) {
    const localeDefaults = defaults[locale] && typeof defaults[locale] === "object"
      ? defaults[locale]
      : germanDefaults;
    for (const [key, germanSource] of germanSourceMap.entries()) {
      if (!key) continue;
      const localeValue = Object.prototype.hasOwnProperty.call(localeDefaults, key)
        ? String(localeDefaults[key] || "")
        : String(germanSource.value_text || "");
      entryPayload.push({
        key,
        locale,
        status: args.status,
        value_text: localeValue,
        updated_at: nowIso,
      });
      metaPayload.push({
        key,
        locale,
        source_locale: "de",
        source_snapshot_hash: buildSourceSnapshotHash(key, String(germanSource.value_text || "")),
        source_updated_at: germanSource.updated_at,
        translation_origin: "sync_copy_all",
        updated_at: nowIso,
      });
    }
  }

  const { error: entryError } = await supabase
    .from("portal_system_text_entries")
    .upsert(entryPayload, { onConflict: "key,locale" });
  if (entryError) throw new Error(`Systemtext-Einträge konnten nicht geschrieben werden: ${entryError.message}`);

  const { error: metaError } = await supabase
    .from("portal_system_text_i18n_meta")
    .upsert(metaPayload, { onConflict: "key,locale" });
  if (metaError) throw new Error(`Systemtext-Meta konnte nicht geschrieben werden: ${metaError.message}`);

  console.log(JSON.stringify({
    ok: true,
    locales,
    status: args.status,
    source_rows: germanSourceMap.size,
    upserted_entries: entryPayload.length,
    upserted_meta: metaPayload.length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
