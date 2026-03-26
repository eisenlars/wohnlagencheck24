import { NextResponse } from "next/server";

import {
  getMarketExplanationStandardDefinitions,
  inferMarketExplanationStandardGroup,
  type MarketExplanationStandardScope,
  type MarketExplanationStandardTextDefinition,
} from "@/lib/market-explanation-standard-text-definitions";
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

type Body = {
  scope?: unknown;
  entries?: Array<{
    key?: unknown;
    value_text?: unknown;
  }>;
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

function resolveSourceTree(payload: StandardPayload | null, scope: MarketExplanationStandardScope): TextTree {
  if (!payload) return {};
  const top = toTextTree(payload.text);
  if (Object.keys(top).length > 0) return top;
  if (scope === "bundesland") {
    return toTextTree(payload.bundeslandname?.text);
  }
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

function applyEntriesToTree(tree: TextTree, entries: Array<{ key: string; value_text: string }>): TextTree {
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

function buildEntries(definitions: MarketExplanationStandardTextDefinition[], tree: TextTree) {
  return definitions.map((definition) => ({
    key: definition.key,
    value_text: findTextByKey(tree, definition.key),
    text_type: definition.type,
  }));
}

function buildStoragePath(scope: MarketExplanationStandardScope): string {
  return scope === "bundesland" ? BUNDESLAND_STANDARD_TEXT_PATH : KREIS_STANDARD_TEXT_PATH;
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

async function uploadStandardPayload(
  admin: ReturnType<typeof createAdminClient>,
  scope: MarketExplanationStandardScope,
  payload: StandardPayload,
): Promise<void> {
  const res = await admin.storage.from(SUPABASE_BUCKET).upload(buildStoragePath(scope), JSON.stringify(payload), {
    upsert: true,
    contentType: "application/json",
    cacheControl: "0",
  });
  if (res.error?.message) {
    throw new Error(res.error.message);
  }
}

function hasTopLevelText(payload: StandardPayload | null): boolean {
  return Object.keys(toTextTree(payload?.text)).length > 0;
}

function withSourceTree(payload: StandardPayload | null, scope: MarketExplanationStandardScope, tree: TextTree): StandardPayload {
  const current = isRecord(payload) ? payload : {};
  if (hasTopLevelText(payload)) {
    return {
      ...current,
      text: tree,
    };
  }
  if (scope === "bundesland") {
    const bundeslandname = isRecord(current.bundeslandname) ? current.bundeslandname : {};
    return {
      ...current,
      bundeslandname: {
        ...bundeslandname,
        text: tree,
      },
    };
  }
  const kreisname = isRecord(current.kreisname) ? current.kreisname : {};
  return {
    ...current,
    kreisname: {
      ...kreisname,
      text: tree,
    },
  };
}

function sanitizeKey(value: unknown, definitions: MarketExplanationStandardTextDefinition[]): string {
  const key = asText(value);
  if (!definitions.some((definition) => definition.key === key)) {
    throw new Error(`Unbekannter Standardtext-Key: ${key}`);
  }
  return key;
}

async function buildPayload(admin: ReturnType<typeof createAdminClient>, scope: MarketExplanationStandardScope) {
  const definitions = getMarketExplanationStandardDefinitions(scope);
  const sourcePayload = await downloadStandardPayload(admin, scope);
  const tree = resolveSourceTree(sourcePayload, scope);
  return {
    scope,
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
    const scope = sanitizeScope(url.searchParams.get("scope"));
    const admin = createAdminClient();
    const payload = await buildPayload(admin, scope);
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
    const scope = sanitizeScope(body.scope);
    const admin = createAdminClient();
    const definitions = getMarketExplanationStandardDefinitions(scope);
    if (!Array.isArray(body.entries) || body.entries.length === 0) {
      throw new Error("Keine Standardtexte zum Speichern übergeben.");
    }
    const nextEntries = body.entries.map((entry) => ({
      key: sanitizeKey(entry.key, definitions),
      value_text: String(entry.value_text ?? ""),
    }));

    const sourcePayload = await downloadStandardPayload(admin, scope);
    const sourceTree = resolveSourceTree(sourcePayload, scope);
    const nextTree = applyEntriesToTree(sourceTree, nextEntries);
    const nextPayload = withSourceTree(sourcePayload, scope, nextTree);
    await uploadStandardPayload(admin, scope, nextPayload);

    const responsePayload = await buildPayload(admin, scope);
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
