import { hashText } from "@/lib/text-hash";

export type AdminAreaTextScopeKind = "bundesland";
export type AdminAreaTextType = "general" | "individual";
export type AdminAreaTextStatus = "draft" | "approved";

export type AdminAreaTextRecord = {
  scope_kind: AdminAreaTextScopeKind;
  scope_key: string;
  section_key: string;
  text_type: AdminAreaTextType;
  raw_content: string | null;
  optimized_content: string | null;
  status: AdminAreaTextStatus;
  source_snapshot_hash: string | null;
  source_last_updated: string | null;
  updated_by: string | null;
  last_updated: string | null;
};

export type SupabaseClientLike = {
  from: (table: string) => any;
};

function asText(value: unknown): string {
  return String(value ?? "").trim();
}

export function buildAdminAreaTextSourceHash(value: string): string {
  return hashText(String(value ?? ""));
}

export async function loadAdminAreaTextRows(args: {
  supabaseClient: SupabaseClientLike;
  scopeKind: AdminAreaTextScopeKind;
  scopeKey: string;
  keys?: string[];
  approvedOnly?: boolean;
}): Promise<AdminAreaTextRecord[]> {
  try {
    let query = args.supabaseClient
      .from("admin_area_texts")
      .select(
        "scope_kind, scope_key, section_key, text_type, raw_content, optimized_content, status, source_snapshot_hash, source_last_updated, updated_by, last_updated",
      )
      .eq("scope_kind", args.scopeKind)
      .eq("scope_key", args.scopeKey);
    if (args.approvedOnly) {
      query = query.eq("status", "approved");
    }
    if (Array.isArray(args.keys) && args.keys.length > 0 && typeof query.in === "function") {
      query = query.in("section_key", args.keys);
    }
    if (typeof query.order === "function") {
      query = query.order("section_key", { ascending: true });
    }
    const res = await query;
    const { data, error } = res as { data?: unknown; error?: { message?: string } | null };
    if (error) {
      const msg = asText(error.message).toLowerCase();
      if (msg.includes("admin_area_texts") && msg.includes("does not exist")) return [];
      throw new Error(asText(error.message) || "admin_area_texts query failed");
    }
    return Array.isArray(data) ? (data as AdminAreaTextRecord[]) : [];
  } catch (error) {
    const msg = asText((error as Error)?.message);
    if (msg.toLowerCase().includes("admin_area_texts") && msg.toLowerCase().includes("does not exist")) {
      return [];
    }
    throw error;
  }
}

export async function upsertAdminAreaTextRows(args: {
  supabaseClient: SupabaseClientLike;
  rows: Array<{
    scope_kind: AdminAreaTextScopeKind;
    scope_key: string;
    section_key: string;
    text_type: AdminAreaTextType;
    raw_content: string;
    optimized_content: string;
    status?: AdminAreaTextStatus;
    updated_by?: string | null;
    source_last_updated?: string | null;
  }>;
}): Promise<void> {
  if (!Array.isArray(args.rows) || args.rows.length === 0) return;
  const nowIso = new Date().toISOString();
  const payload = args.rows.map((row) => ({
    scope_kind: row.scope_kind,
    scope_key: row.scope_key,
    section_key: row.section_key,
    text_type: row.text_type,
    raw_content: row.raw_content,
    optimized_content: row.optimized_content,
    status: row.status ?? "approved",
    source_snapshot_hash: buildAdminAreaTextSourceHash(row.raw_content),
    source_last_updated: row.source_last_updated ?? nowIso,
    updated_by: row.updated_by ?? null,
    last_updated: nowIso,
  }));
  const table = args.supabaseClient.from("admin_area_texts");
  if (typeof table.upsert !== "function") {
    throw new Error("admin_area_texts upsert is not available");
  }
  const res = await table.upsert(payload, {
    onConflict: "scope_kind,scope_key,section_key",
  });
  if (res?.error?.message) {
    throw new Error(String(res.error.message));
  }
}

export async function deleteAdminAreaTextRows(args: {
  supabaseClient: SupabaseClientLike;
  scopeKind: AdminAreaTextScopeKind;
  scopeKey: string;
  keys: string[];
}): Promise<void> {
  const keys = Array.from(new Set((args.keys ?? []).map((key) => asText(key)).filter(Boolean)));
  if (keys.length === 0) return;
  const table = args.supabaseClient.from("admin_area_texts");
  if (typeof table.delete !== "function") {
    throw new Error("admin_area_texts delete is not available");
  }
  let query = table
    .delete()
    .eq("scope_kind", args.scopeKind)
    .eq("scope_key", args.scopeKey);
  if (typeof query.in === "function") {
    query = query.in("section_key", keys);
  } else {
    for (const key of keys) {
      query = query.eq("section_key", key);
    }
  }
  const res = await query;
  const { error } = res as { error?: { message?: string } | null };
  if (error?.message) {
    throw new Error(String(error.message));
  }
}
