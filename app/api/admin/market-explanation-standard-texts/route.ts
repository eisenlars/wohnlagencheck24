import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/security/admin-auth";
import { checkAdminApiRateLimit } from "@/lib/security/rate-limit";
import {
  MARKET_EXPLANATION_STANDARD_TEXT_DEFINITIONS,
  inferMarketExplanationStandardGroup,
  type MarketExplanationStandardTextDefinition,
} from "@/lib/market-explanation-standard-text-definitions";
import { createAdminClient } from "@/utils/supabase/admin";

const SUPABASE_BUCKET = "immobilienmarkt";
const STANDARD_TEXT_PATH = "text-standards/kreis/text_standard_kreis.json";

type JsonObject = Record<string, unknown>;
type TextTree = Record<string, Record<string, string>>;

type StandardPayload = {
  text?: unknown;
  kreisname?: { text?: unknown };
  ortslagenname?: { text?: unknown };
  [key: string]: unknown;
};

type MarketExplanationStandardEntry = {
  key: string;
  value_text: string;
};

type Body = {
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

async function downloadStandardPayload(admin: ReturnType<typeof createAdminClient>): Promise<StandardPayload | null> {
  const res = await admin.storage.from(SUPABASE_BUCKET).download(STANDARD_TEXT_PATH);
  if (res.error || !res.data) return null;
  const raw = await res.data.text();
  const payload = JSON.parse(raw);
  return isRecord(payload) ? (payload as StandardPayload) : null;
}

async function uploadStandardPayload(admin: ReturnType<typeof createAdminClient>, payload: StandardPayload) {
  const res = await admin.storage.from(SUPABASE_BUCKET).upload(STANDARD_TEXT_PATH, JSON.stringify(payload), {
    upsert: true,
    contentType: "application/json",
    cacheControl: "0",
  });
  if (res.error?.message) {
    throw new Error(res.error.message);
  }
}

function sanitizeKey(value: unknown): string {
  const key = asText(value);
  if (!MARKET_EXPLANATION_STANDARD_TEXT_DEFINITIONS.some((entry) => entry.key === key)) {
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

async function loadPayload(admin: ReturnType<typeof createAdminClient>) {
  const payload = await downloadStandardPayload(admin);
  if (!payload) {
    throw new Error("Standard text payload not found at text-standards/kreis/text_standard_kreis.json");
  }
  const tree = resolveStandardTree(payload);
  return {
    definitions: MARKET_EXPLANATION_STANDARD_TEXT_DEFINITIONS,
    entries: buildEntries(MARKET_EXPLANATION_STANDARD_TEXT_DEFINITIONS, tree),
  };
}

export async function GET(req: Request) {
  try {
    const adminUser = await requireAdmin(["admin_super", "admin_ops"]);
    const limit = await checkAdminApiRateLimit(req, adminUser.userId);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } });
    }

    const admin = createAdminClient();
    const payload = await loadPayload(admin);
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
    if (!Array.isArray(body.entries) || body.entries.length === 0) {
      throw new Error("Keine Standardtexte zum Speichern übergeben.");
    }

    const admin = createAdminClient();
    const payload = await downloadStandardPayload(admin);
    if (!payload) {
      throw new Error("Standard text payload not found at text-standards/kreis/text_standard_kreis.json");
    }

    const nextEntries: MarketExplanationStandardEntry[] = body.entries.map((entry) => ({
      key: sanitizeKey(entry.key),
      value_text: String(entry.value_text ?? ""),
    }));

    const currentTree = resolveStandardTree(payload);
    const nextTree = applyEntriesToTree(currentTree, nextEntries);
    const nextPayload: StandardPayload = {
      ...payload,
      text: nextTree,
    };

    await uploadStandardPayload(admin, nextPayload);

    const responsePayload = await loadPayload(admin);
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
