import { KREIS_TEXT_MAP } from "@/lib/text-core/generate-kreis";
import { ORTSLAGE_TEXT_MAP } from "@/lib/text-core/generate-ortslage";

export type PartnerAreaRuntimeScope = "kreis" | "ortslage";

export type PartnerAreaRuntimeStateRecord = {
  partner_id: string;
  area_id: string;
  scope: PartnerAreaRuntimeScope;
  factors_snapshot: Record<string, unknown>;
  data_json: Record<string, unknown>;
  textgen_inputs_json: Record<string, unknown>;
  helpers_json: Record<string, unknown>;
  rebuilt_at: string | null;
  updated_at: string | null;
};

export type PartnerAreaGeneratedTextRecord = {
  partner_id: string;
  area_id: string;
  scope: PartnerAreaRuntimeScope;
  section_key: string;
  value_text: string;
  source_signature: string | null;
  updated_at: string | null;
};

export type SupabaseClientLike = {
  from: (table: string) => any;
};

type TextTree = Record<string, Record<string, string>>;

function asText(value: unknown): string {
  return String(value ?? "").trim();
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function isMissingTable(error: unknown, table: string): boolean {
  const msg = asText((error as { message?: string } | null)?.message).toLowerCase();
  return msg.includes(table.toLowerCase()) && msg.includes("does not exist");
}

function readSectionKey(textTree: TextTree, sectionKey: string): string {
  for (const group of Object.values(textTree)) {
    if (Object.prototype.hasOwnProperty.call(group, sectionKey)) {
      return String(group[sectionKey] ?? "");
    }
  }
  return "";
}

function runtimeTextKeysForScope(scope: PartnerAreaRuntimeScope): string[] {
  const map = scope === "ortslage" ? ORTSLAGE_TEXT_MAP : KREIS_TEXT_MAP;
  return Array.from(new Set(map.map(([, key]) => key)));
}

export function extractGeneratedTextRows(args: {
  partnerId: string;
  areaId: string;
  scope: PartnerAreaRuntimeScope;
  textTree: TextTree;
  signatures: Record<string, string>;
}): PartnerAreaGeneratedTextRecord[] {
  const keys = runtimeTextKeysForScope(args.scope);
  const nowIso = new Date().toISOString();
  return keys.map((sectionKey) => ({
    partner_id: args.partnerId,
    area_id: args.areaId,
    scope: args.scope,
    section_key: sectionKey,
    value_text: readSectionKey(args.textTree, sectionKey),
    source_signature: asText(args.signatures[sectionKey]) || null,
    updated_at: nowIso,
  }));
}

export async function loadPartnerAreaRuntimeState(args: {
  supabaseClient: SupabaseClientLike;
  partnerId: string;
  areaId: string;
  scope: PartnerAreaRuntimeScope;
}): Promise<PartnerAreaRuntimeStateRecord | null> {
  try {
    const query = args.supabaseClient
      .from("partner_area_runtime_states")
      .select("partner_id, area_id, scope, factors_snapshot, data_json, textgen_inputs_json, helpers_json, rebuilt_at, updated_at")
      .eq("partner_id", args.partnerId)
      .eq("area_id", args.areaId)
      .eq("scope", args.scope);
    if (typeof query.maybeSingle === "function") {
      const res = await query.maybeSingle();
      const { data, error } = res as { data?: unknown; error?: { message?: string } | null };
      if (error) {
        if (isMissingTable(error, "partner_area_runtime_states")) return null;
        throw new Error(asText(error.message) || "partner_area_runtime_states query failed");
      }
      if (!data) return null;
      const row = data as Record<string, unknown>;
      return {
        partner_id: asText(row.partner_id),
        area_id: asText(row.area_id),
        scope: asText(row.scope) === "ortslage" ? "ortslage" : "kreis",
        factors_snapshot: asObject(row.factors_snapshot),
        data_json: asObject(row.data_json),
        textgen_inputs_json: asObject(row.textgen_inputs_json),
        helpers_json: asObject(row.helpers_json),
        rebuilt_at: row.rebuilt_at ? String(row.rebuilt_at) : null,
        updated_at: row.updated_at ? String(row.updated_at) : null,
      };
    }
    const res = await query;
    const { data, error } = res as { data?: unknown; error?: { message?: string } | null };
    if (error) {
      if (isMissingTable(error, "partner_area_runtime_states")) return null;
      throw new Error(asText(error.message) || "partner_area_runtime_states query failed");
    }
    const row = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : undefined;
    if (!row) return null;
    return {
      partner_id: asText(row.partner_id),
      area_id: asText(row.area_id),
      scope: asText(row.scope) === "ortslage" ? "ortslage" : "kreis",
      factors_snapshot: asObject(row.factors_snapshot),
      data_json: asObject(row.data_json),
      textgen_inputs_json: asObject(row.textgen_inputs_json),
      helpers_json: asObject(row.helpers_json),
      rebuilt_at: row.rebuilt_at ? String(row.rebuilt_at) : null,
      updated_at: row.updated_at ? String(row.updated_at) : null,
    };
  } catch (error) {
    if (isMissingTable(error, "partner_area_runtime_states")) return null;
    throw error;
  }
}

export async function loadPartnerAreaGeneratedTexts(args: {
  supabaseClient: SupabaseClientLike;
  partnerId: string;
  areaId: string;
  scope: PartnerAreaRuntimeScope;
}): Promise<PartnerAreaGeneratedTextRecord[]> {
  try {
    let query = args.supabaseClient
      .from("partner_area_generated_texts")
      .select("partner_id, area_id, scope, section_key, value_text, source_signature, updated_at")
      .eq("partner_id", args.partnerId)
      .eq("area_id", args.areaId)
      .eq("scope", args.scope);
    if (typeof query.order === "function") {
      query = query.order("section_key", { ascending: true });
    }
    const res = await query;
    const { data, error } = res as { data?: unknown; error?: { message?: string } | null };
    if (error) {
      if (isMissingTable(error, "partner_area_generated_texts")) return [];
      throw new Error(asText(error.message) || "partner_area_generated_texts query failed");
    }
    return Array.isArray(data)
      ? (data as Array<Record<string, unknown>>).map((row) => ({
          partner_id: asText(row.partner_id),
          area_id: asText(row.area_id),
          scope: asText(row.scope) === "ortslage" ? "ortslage" : "kreis",
          section_key: asText(row.section_key),
          value_text: String(row.value_text ?? ""),
          source_signature: asText(row.source_signature) || null,
          updated_at: row.updated_at ? String(row.updated_at) : null,
        }))
      : [];
  } catch (error) {
    if (isMissingTable(error, "partner_area_generated_texts")) return [];
    throw error;
  }
}

export async function upsertPartnerAreaRuntimeState(args: {
  supabaseClient: SupabaseClientLike;
  row: {
    partner_id: string;
    area_id: string;
    scope: PartnerAreaRuntimeScope;
    factors_snapshot: Record<string, unknown>;
    data_json: Record<string, unknown>;
    textgen_inputs_json: Record<string, unknown>;
    helpers_json: Record<string, unknown>;
    rebuilt_at?: string;
  };
}): Promise<void> {
  const payload = {
    ...args.row,
    rebuilt_at: args.row.rebuilt_at ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const table = args.supabaseClient.from("partner_area_runtime_states");
  if (typeof table.upsert !== "function") {
    throw new Error("partner_area_runtime_states upsert is not available");
  }
  const res = await table.upsert(payload, {
    onConflict: "partner_id,area_id,scope",
  });
  if (res?.error?.message) {
    throw new Error(String(res.error.message));
  }
}

export async function replacePartnerAreaGeneratedTexts(args: {
  supabaseClient: SupabaseClientLike;
  partnerId: string;
  areaId: string;
  scope: PartnerAreaRuntimeScope;
  rows: PartnerAreaGeneratedTextRecord[];
}): Promise<void> {
  const table = args.supabaseClient.from("partner_area_generated_texts");
  if (typeof table.delete !== "function" || typeof table.upsert !== "function") {
    throw new Error("partner_area_generated_texts write is not available");
  }
  const deleteRes = await table
    .delete()
    .eq("partner_id", args.partnerId)
    .eq("area_id", args.areaId)
    .eq("scope", args.scope);
  if (deleteRes?.error?.message && !isMissingTable(deleteRes.error, "partner_area_generated_texts")) {
    throw new Error(String(deleteRes.error.message));
  }
  if (!Array.isArray(args.rows) || args.rows.length === 0) return;
  const upsertRes = await table.upsert(args.rows, {
    onConflict: "partner_id,area_id,scope,section_key",
  });
  if (upsertRes?.error?.message) {
    throw new Error(String(upsertRes.error.message));
  }
}
