import { NextResponse } from "next/server";

import { translateAdminTextItems } from "@/lib/admin-text-i18n";
import { getBundeslaender } from "@/lib/data";
import {
  getMarketExplanationStandardDefinitions,
  inferMarketExplanationStandardGroup,
  type MarketExplanationStandardScope,
  type MarketExplanationStandardTextDefinition,
} from "@/lib/market-explanation-standard-text-definitions";
import { getTextKeyLabel } from "@/lib/text-key-labels";
import { requireAdmin } from "@/lib/security/admin-auth";
import { checkAdminApiRateLimit } from "@/lib/security/rate-limit";
import { createAdminClient } from "@/utils/supabase/admin";

const SUPABASE_BUCKET = "immobilienmarkt";
const KREIS_STANDARD_TEXT_PATH = "text-standards/kreis/text_standard_kreis.json";
const BUNDESLAND_STANDARD_TEXT_PATH = "text-standards/bundesland/text_standard_bundesland.json";

type JsonObject = Record<string, unknown>;
type TextTree = Record<string, Record<string, string>>;

type StandardPayload = {
  text?: unknown;
  bundeslandname?: { text?: unknown };
  kreisname?: { text?: unknown };
  ortslagenname?: { text?: unknown };
  [key: string]: unknown;
};

type ReportPayload = {
  text?: unknown;
  data?: {
    text?: unknown;
    [key: string]: unknown;
  } | unknown;
  [key: string]: unknown;
};

type MarketExplanationStandardEntry = {
  key: string;
  value_text: string;
};

type Body = {
  level?: unknown;
  bundesland_slug?: unknown;
  locale?: unknown;
  entries?: Array<{
    key?: unknown;
    value_text?: unknown;
  }>;
  sync?: {
    target_locale?: unknown;
    mode?: unknown;
  };
  translate?: {
    target_locale?: unknown;
    keys?: unknown;
  };
};

function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asText(value: unknown): string {
  return String(value ?? "").trim();
}

function sanitizeScope(value: unknown): MarketExplanationStandardScope {
  return String(value ?? "").trim().toLowerCase() === "bundesland" ? "bundesland" : "kreis";
}

function sanitizeLocale(value: unknown): string {
  return String(value ?? "de").trim().toLowerCase() || "de";
}

function sanitizeBundeslandSlug(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function toTextTree(value: unknown): TextTree {
  if (!isRecord(value)) return {};
  const out: TextTree = {};
  for (const [groupKey, groupValue] of Object.entries(value)) {
    if (!isRecord(groupValue)) continue;
    const nextGroup: Record<string, string> = {};
    for (const [textKey, textValue] of Object.entries(groupValue)) {
      nextGroup[textKey] = String(textValue ?? "");
    }
    out[groupKey] = nextGroup;
  }
  return out;
}

function cloneTextTree(tree: TextTree): TextTree {
  const out: TextTree = {};
  for (const [groupKey, group] of Object.entries(tree)) {
    out[groupKey] = { ...group };
  }
  return out;
}

function resolveStandardTree(payload: StandardPayload | null): TextTree {
  if (!payload) return {};
  const top = toTextTree(payload.text);
  if (Object.keys(top).length > 0) return top;
  const bundesland = toTextTree(payload.bundeslandname?.text);
  if (Object.keys(bundesland).length > 0) return bundesland;
  const kreis = toTextTree(payload.kreisname?.text);
  if (Object.keys(kreis).length > 0) return kreis;
  return toTextTree(payload.ortslagenname?.text);
}

function findTextByKey(tree: TextTree, key: string): string {
  for (const group of Object.values(tree)) {
    if (Object.prototype.hasOwnProperty.call(group, key)) {
      return String(group[key] ?? "");
    }
  }
  return "";
}

function applyEntriesToTree(tree: TextTree, entries: MarketExplanationStandardEntry[]): TextTree {
  const next = cloneTextTree(tree);
  for (const entry of entries) {
    let targetGroup: string | null = null;
    for (const [groupKey, group] of Object.entries(next)) {
      if (Object.prototype.hasOwnProperty.call(group, entry.key)) {
        targetGroup = groupKey;
        break;
      }
    }
    const groupKey = targetGroup ?? inferMarketExplanationStandardGroup(entry.key);
    next[groupKey] = {
      ...(next[groupKey] ?? {}),
      [entry.key]: entry.value_text,
    };
  }
  return next;
}

function ensureBundeslandScope(scope: MarketExplanationStandardScope, bundeslandSlug: string) {
  if (scope === "bundesland" && !bundeslandSlug) {
    throw new Error("Für Bundesland-Standardtexte wird ein Bundesland-Slug benötigt.");
  }
}

function buildStoragePath(scope: MarketExplanationStandardScope): string {
  if (scope === "kreis") return KREIS_STANDARD_TEXT_PATH;
  return BUNDESLAND_STANDARD_TEXT_PATH;
}

function buildBundeslandReportPath(bundeslandSlug: string): string {
  return `reports/deutschland/${bundeslandSlug}.json`;
}

async function downloadStandardPayload(
  admin: ReturnType<typeof createAdminClient>,
  scope: MarketExplanationStandardScope,
): Promise<StandardPayload | null> {
  const res = await admin.storage.from(SUPABASE_BUCKET).download(buildStoragePath(scope));
  if (res.error || !res.data) return null;
  const raw = await res.data.text();
  const payload = JSON.parse(raw);
  return isRecord(payload) ? (payload as StandardPayload) : null;
}

async function downloadBundeslandReport(
  admin: ReturnType<typeof createAdminClient>,
  bundeslandSlug: string,
) : Promise<ReportPayload | null> {
  const res = await admin.storage.from(SUPABASE_BUCKET).download(buildBundeslandReportPath(bundeslandSlug));
  if (res.error || !res.data) return null;
  const raw = await res.data.text();
  const payload = JSON.parse(raw);
  return isRecord(payload) ? (payload as ReportPayload) : null;
}

async function uploadBundeslandReport(
  admin: ReturnType<typeof createAdminClient>,
  bundeslandSlug: string,
  payload: ReportPayload,
) {
  const res = await admin.storage.from(SUPABASE_BUCKET).upload(
    buildBundeslandReportPath(bundeslandSlug),
    JSON.stringify(payload),
    {
      upsert: true,
      contentType: "application/json",
      cacheControl: "0",
    },
  );
  if (res.error?.message) {
    throw new Error(res.error.message);
  }
}

function sanitizeKey(value: unknown, definitions: MarketExplanationStandardTextDefinition[]): string {
  const key = asText(value);
  if (!definitions.some((entry) => entry.key === key)) {
    throw new Error(`Unbekannter Standardtext-Key: ${key}`);
  }
  return key;
}

function buildEntries(definitions: MarketExplanationStandardTextDefinition[], tree: TextTree) {
  return definitions.map((definition) => ({
    key: definition.key,
    value_text: findTextByKey(tree, definition.key),
  }));
}

function withTreePayload(payload: StandardPayload | null, tree: TextTree): StandardPayload {
  return {
    ...(payload ?? {}),
    text: tree,
  };
}

function resolveReportTree(payload: ReportPayload | null): TextTree {
  if (!payload) return {};
  const top = toTextTree(payload.text);
  if (Object.keys(top).length > 0) return top;
  if (isRecord(payload.data)) {
    return toTextTree(payload.data.text);
  }
  return {};
}

function withReportTreePayload(payload: ReportPayload | null, tree: TextTree): ReportPayload {
  const base = payload ?? {};
  const data = isRecord(base.data) ? base.data : {};
  return {
    ...base,
    text: tree,
    data: {
      ...data,
      text: tree,
    },
  };
}

function mergeMissingEntriesFromStandard(reportTree: TextTree, standardTree: TextTree, definitions: MarketExplanationStandardTextDefinition[]): TextTree {
  const next = cloneTextTree(reportTree);
  for (const definition of definitions) {
    const current = findTextByKey(next, definition.key).trim();
    if (current) continue;
    const fallbackValue = findTextByKey(standardTree, definition.key);
    if (!String(fallbackValue ?? "").trim()) continue;
    const groupKey = inferMarketExplanationStandardGroup(definition.key);
    next[groupKey] = {
      ...(next[groupKey] ?? {}),
      [definition.key]: fallbackValue,
    };
  }
  return next;
}

async function loadPayload(args: {
  admin: ReturnType<typeof createAdminClient>;
  scope: MarketExplanationStandardScope;
  bundeslandSlug: string;
  locale: string;
}) {
  const definitions = getMarketExplanationStandardDefinitions(args.scope);
  let tree: TextTree;
  if (args.scope === "bundesland") {
    const reportPayload = await downloadBundeslandReport(args.admin, args.bundeslandSlug);
    const reportTree = resolveReportTree(reportPayload);
    const standardPayload = await downloadStandardPayload(args.admin, "bundesland");
    const standardTree = resolveStandardTree(standardPayload);
    tree = mergeMissingEntriesFromStandard(reportTree, standardTree, definitions);
  } else {
    const payload = await downloadStandardPayload(args.admin, args.scope);
    tree = resolveStandardTree(payload);
  }
  const bundeslaender = await getBundeslaender();
  return {
    level: args.scope,
    locale: args.scope === "bundesland" ? "de" : args.locale,
    bundesland_slug: args.bundeslandSlug,
    bundeslaender,
    definitions,
    entries: buildEntries(definitions, tree),
  };
}

export async function GET(req: Request) {
  try {
    const adminUser = await requireAdmin(["admin_super", "admin_ops"]);
    const limit = await checkAdminApiRateLimit(req, adminUser.userId);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } });
    }

    const url = new URL(req.url);
    const scope = sanitizeScope(url.searchParams.get("level"));
    const locale = sanitizeLocale(url.searchParams.get("locale"));
    const bundeslandSlug = sanitizeBundeslandSlug(url.searchParams.get("bundesland_slug"));
    ensureBundeslandScope(scope, bundeslandSlug);

    const admin = createAdminClient();
    const payload = await loadPayload({ admin, scope, bundeslandSlug, locale });
    return NextResponse.json({ ok: true, ...payload });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const adminUser = await requireAdmin(["admin_super", "admin_ops"]);
    const limit = await checkAdminApiRateLimit(req, adminUser.userId);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } });
    }

    const body = (await req.json()) as Body;
    const scope = sanitizeScope(body.level);
    const locale = sanitizeLocale(body.locale);
    const bundeslandSlug = sanitizeBundeslandSlug(body.bundesland_slug);
    ensureBundeslandScope(scope, bundeslandSlug);
    const definitions = getMarketExplanationStandardDefinitions(scope);
    const admin = createAdminClient();

    if (body.translate) {
      if (scope !== "bundesland") {
        throw new Error("KI-Übersetzung ist für Standardtexte nur auf Bundeslandebene vorgesehen.");
      }
      const requestedKeys = Array.isArray(body.translate.keys)
        ? body.translate.keys.map((item) => sanitizeKey(item, definitions))
        : definitions.map((definition) => definition.key);
      const reportPayload = await downloadBundeslandReport(admin, bundeslandSlug);
      const reportTree = resolveReportTree(reportPayload);
      const standardPayload = await downloadStandardPayload(admin, "bundesland");
      const standardTree = resolveStandardTree(standardPayload);
      const sourceTree = mergeMissingEntriesFromStandard(reportTree, standardTree, definitions);
      const items = requestedKeys.map((key) => ({
        key,
        label: getTextKeyLabel(key, key),
        sourceText: findTextByKey(sourceTree, key),
      }));
      const translated = await translateAdminTextItems({
        admin,
        domain: `market-standard-${scope}`,
        domainLabel: `Markterklärungstexte ${bundeslandSlug}`,
        targetLocale: "de",
        items,
      });
      const targetPayload = await downloadBundeslandReport(admin, bundeslandSlug);
      const targetTree = resolveReportTree(targetPayload);
      const nextTree = applyEntriesToTree(
        targetTree,
        Array.from(translated.entries()).map(([key, value_text]) => ({ key, value_text })),
      );
      await uploadBundeslandReport(admin, bundeslandSlug, withReportTreePayload(targetPayload, nextTree));
      const responsePayload = await loadPayload({ admin, scope, bundeslandSlug, locale: "de" });
      return NextResponse.json({ ok: true, ...responsePayload });
    }

    if (body.sync) {
      throw new Error("DE-Sync ist für Bundesland-Standardtexte nicht vorgesehen.");
    }

    if (!Array.isArray(body.entries) || body.entries.length === 0) {
      throw new Error("Keine Standardtexte zum Speichern übergeben.");
    }

    const currentTree = scope === "bundesland"
      ? resolveReportTree(await downloadBundeslandReport(admin, bundeslandSlug))
      : resolveStandardTree(await downloadStandardPayload(admin, scope));
    const nextEntries: MarketExplanationStandardEntry[] = body.entries.map((entry) => ({
      key: sanitizeKey(entry.key, definitions),
      value_text: String(entry.value_text ?? ""),
    }));
    const nextTree = applyEntriesToTree(currentTree, nextEntries);
    if (scope === "bundesland") {
      const currentPayload = await downloadBundeslandReport(admin, bundeslandSlug);
      await uploadBundeslandReport(admin, bundeslandSlug, withReportTreePayload(currentPayload, nextTree));
    } else {
      const currentPayload = await downloadStandardPayload(admin, scope);
      await admin.storage.from(SUPABASE_BUCKET).upload(
        buildStoragePath(scope),
        JSON.stringify(withTreePayload(currentPayload, nextTree)),
        {
          upsert: true,
          contentType: "application/json",
          cacheControl: "0",
        },
      );
    }

    const responsePayload = await loadPayload({ admin, scope, bundeslandSlug, locale });
    return NextResponse.json({ ok: true, ...responsePayload });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
