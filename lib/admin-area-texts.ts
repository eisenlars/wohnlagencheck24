import { hashText } from "@/lib/text-hash";

export type AdminAreaTextScopeKind = "bundesland" | "kreis" | "ortslage";
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

export type AdminAreaTextI18nEntryStatus = "draft" | "internal" | "live";
export type AdminAreaTextI18nTranslationOrigin =
  | "manual"
  | "ai"
  | "sync_copy_all"
  | "sync_fill_missing";

export type AdminAreaTextI18nEntryRecord = {
  scope_kind: AdminAreaTextScopeKind;
  scope_key: string;
  section_key: string;
  locale: string;
  status: AdminAreaTextI18nEntryStatus;
  value_text: string;
  updated_at: string | null;
};

export type AdminAreaTextI18nMetaRecord = {
  scope_kind: AdminAreaTextScopeKind;
  scope_key: string;
  section_key: string;
  locale: string;
  source_locale: string;
  source_snapshot_hash: string | null;
  source_updated_at: string | null;
  translation_origin: AdminAreaTextI18nTranslationOrigin;
  updated_at?: string | null;
};

export type AdminAreaTextI18nMetaViewRecord = AdminAreaTextI18nMetaRecord & {
  translation_is_stale: boolean;
  effective_source_value: string;
};

export type SupabaseClientLike = {
  from: (table: string) => any;
};

function asText(value: unknown): string {
  return String(value ?? "").trim();
}

function isMissingTable(error: unknown, table: string): boolean {
  const msg = asText((error as { message?: string } | null)?.message).toLowerCase();
  return msg.includes(`public.${table}`) && msg.includes("does not exist");
}

export function buildAdminAreaTextSourceHash(value: string): string {
  return hashText(String(value ?? ""));
}

export function buildAdminAreaTextI18nSourceSnapshotHash(args: {
  scopeKind: AdminAreaTextScopeKind;
  scopeKey: string;
  sectionKey: string;
  valueText: string;
}): string {
  return hashText(JSON.stringify({
    scope_kind: args.scopeKind,
    scope_key: args.scopeKey,
    section_key: args.sectionKey,
    value_text: args.valueText,
  }));
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

export async function loadAdminAreaTextI18nEntries(args: {
  supabaseClient: SupabaseClientLike;
  scopeKind: AdminAreaTextScopeKind;
  scopeKey: string;
  locale: string;
  keys?: string[];
  statuses?: AdminAreaTextI18nEntryStatus[];
}): Promise<AdminAreaTextI18nEntryRecord[]> {
  try {
    let query = args.supabaseClient
      .from("admin_area_text_i18n_entries")
      .select("scope_kind, scope_key, section_key, locale, status, value_text, updated_at")
      .eq("scope_kind", args.scopeKind)
      .eq("scope_key", args.scopeKey)
      .eq("locale", asText(args.locale).toLowerCase());
    if (Array.isArray(args.keys) && args.keys.length > 0 && typeof query.in === "function") {
      query = query.in("section_key", args.keys);
    }
    if (Array.isArray(args.statuses) && args.statuses.length > 0) {
      const uniqueStatuses = Array.from(new Set(args.statuses.map((status) => asText(status) as AdminAreaTextI18nEntryStatus)));
      if (uniqueStatuses.length === 1) {
        query = query.eq("status", uniqueStatuses[0]);
      } else if (typeof query.in === "function") {
        query = query.in("status", uniqueStatuses);
      }
    }
    if (typeof query.order === "function") {
      query = query.order("section_key", { ascending: true });
    }
    const res = await query;
    const { data, error } = res as { data?: unknown; error?: { message?: string } | null };
    if (error) {
      if (isMissingTable(error, "admin_area_text_i18n_entries")) return [];
      throw new Error(asText(error.message) || "admin_area_text_i18n_entries query failed");
    }
    return Array.isArray(data)
      ? (data as AdminAreaTextI18nEntryRecord[]).map((row) => ({
          ...row,
          locale: asText(row.locale).toLowerCase(),
          status: asText(row.status || "draft") as AdminAreaTextI18nEntryStatus,
          value_text: String(row.value_text ?? ""),
          updated_at: row.updated_at ? String(row.updated_at) : null,
        }))
      : [];
  } catch (error) {
    if (isMissingTable(error, "admin_area_text_i18n_entries")) return [];
    throw error;
  }
}

export async function upsertAdminAreaTextI18nEntries(args: {
  supabaseClient: SupabaseClientLike;
  rows: Array<{
    scope_kind: AdminAreaTextScopeKind;
    scope_key: string;
    section_key: string;
    locale: string;
    status: AdminAreaTextI18nEntryStatus;
    value_text: string;
  }>;
}): Promise<void> {
  if (!Array.isArray(args.rows) || args.rows.length === 0) return;
  const nowIso = new Date().toISOString();
  const table = args.supabaseClient.from("admin_area_text_i18n_entries");
  if (typeof table.upsert !== "function") {
    throw new Error("admin_area_text_i18n_entries upsert is not available");
  }
  const res = await table.upsert(args.rows.map((row) => ({
    scope_kind: row.scope_kind,
    scope_key: row.scope_key,
    section_key: row.section_key,
    locale: asText(row.locale).toLowerCase(),
    status: row.status,
    value_text: String(row.value_text ?? ""),
    updated_at: nowIso,
  })), {
    onConflict: "scope_kind,scope_key,section_key,locale",
  });
  if (res?.error?.message) {
    throw new Error(String(res.error.message));
  }
}

export async function deleteAdminAreaTextI18nEntries(args: {
  supabaseClient: SupabaseClientLike;
  scopeKind: AdminAreaTextScopeKind;
  scopeKey: string;
  locale: string;
  keys: string[];
}): Promise<void> {
  const keys = Array.from(new Set((args.keys ?? []).map((key) => asText(key)).filter(Boolean)));
  if (keys.length === 0) return;
  const table = args.supabaseClient.from("admin_area_text_i18n_entries");
  if (typeof table.delete !== "function") {
    throw new Error("admin_area_text_i18n_entries delete is not available");
  }
  let query = table
    .delete()
    .eq("scope_kind", args.scopeKind)
    .eq("scope_key", args.scopeKey)
    .eq("locale", asText(args.locale).toLowerCase());
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

export async function loadAdminAreaTextI18nMeta(args: {
  supabaseClient: SupabaseClientLike;
  scopeKind: AdminAreaTextScopeKind;
  scopeKey: string;
  locale: string;
  keys?: string[];
}): Promise<AdminAreaTextI18nMetaRecord[]> {
  try {
    let query = args.supabaseClient
      .from("admin_area_text_i18n_meta")
      .select("scope_kind, scope_key, section_key, locale, source_locale, source_snapshot_hash, source_updated_at, translation_origin, updated_at")
      .eq("scope_kind", args.scopeKind)
      .eq("scope_key", args.scopeKey)
      .eq("locale", asText(args.locale).toLowerCase());
    if (Array.isArray(args.keys) && args.keys.length > 0 && typeof query.in === "function") {
      query = query.in("section_key", args.keys);
    }
    if (typeof query.order === "function") {
      query = query.order("section_key", { ascending: true });
    }
    const res = await query;
    const { data, error } = res as { data?: unknown; error?: { message?: string } | null };
    if (error) {
      if (isMissingTable(error, "admin_area_text_i18n_meta")) return [];
      throw new Error(asText(error.message) || "admin_area_text_i18n_meta query failed");
    }
    return Array.isArray(data)
      ? (data as AdminAreaTextI18nMetaRecord[]).map((row) => ({
          ...row,
          locale: asText(row.locale).toLowerCase(),
          source_locale: asText(row.source_locale || "de").toLowerCase() || "de",
          source_snapshot_hash: row.source_snapshot_hash ? String(row.source_snapshot_hash) : null,
          source_updated_at: row.source_updated_at ? String(row.source_updated_at) : null,
          translation_origin: asText(row.translation_origin || "manual") as AdminAreaTextI18nTranslationOrigin,
          updated_at: row.updated_at ? String(row.updated_at) : null,
        }))
      : [];
  } catch (error) {
    if (isMissingTable(error, "admin_area_text_i18n_meta")) return [];
    throw error;
  }
}

export async function upsertAdminAreaTextI18nMeta(args: {
  supabaseClient: SupabaseClientLike;
  rows: AdminAreaTextI18nMetaRecord[];
}): Promise<void> {
  if (!Array.isArray(args.rows) || args.rows.length === 0) return;
  const table = args.supabaseClient.from("admin_area_text_i18n_meta");
  if (typeof table.upsert !== "function") {
    throw new Error("admin_area_text_i18n_meta upsert is not available");
  }
  const res = await table.upsert(args.rows.map((row) => ({
    scope_kind: row.scope_kind,
    scope_key: row.scope_key,
    section_key: row.section_key,
    locale: asText(row.locale).toLowerCase(),
    source_locale: asText(row.source_locale || "de").toLowerCase() || "de",
    source_snapshot_hash: row.source_snapshot_hash,
    source_updated_at: row.source_updated_at,
    translation_origin: row.translation_origin,
    updated_at: new Date().toISOString(),
  })), {
    onConflict: "scope_kind,scope_key,section_key,locale",
  });
  if (res?.error?.message) {
    throw new Error(String(res.error.message));
  }
}

export async function deleteAdminAreaTextI18nMeta(args: {
  supabaseClient: SupabaseClientLike;
  scopeKind: AdminAreaTextScopeKind;
  scopeKey: string;
  locale: string;
  keys: string[];
}): Promise<void> {
  const keys = Array.from(new Set((args.keys ?? []).map((key) => asText(key)).filter(Boolean)));
  if (keys.length === 0) return;
  const table = args.supabaseClient.from("admin_area_text_i18n_meta");
  if (typeof table.delete !== "function") {
    throw new Error("admin_area_text_i18n_meta delete is not available");
  }
  let query = table
    .delete()
    .eq("scope_kind", args.scopeKind)
    .eq("scope_key", args.scopeKey)
    .eq("locale", asText(args.locale).toLowerCase());
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

export function buildAdminAreaTextI18nMetaViews(args: {
  metas: AdminAreaTextI18nMetaRecord[];
  sourceEntries: Array<{
    scope_kind: AdminAreaTextScopeKind;
    scope_key: string;
    section_key: string;
    value_text: string;
    updated_at?: string | null;
  }>;
}): AdminAreaTextI18nMetaViewRecord[] {
  const sourceMap = new Map(
    args.sourceEntries.map((entry) => [`${entry.scope_kind}::${entry.scope_key}::${entry.section_key}`, entry] as const),
  );
  return args.metas.map((meta) => {
    const source = sourceMap.get(`${meta.scope_kind}::${meta.scope_key}::${meta.section_key}`);
    const effectiveSourceValue = String(source?.value_text ?? "");
    const sourceHash = buildAdminAreaTextI18nSourceSnapshotHash({
      scopeKind: meta.scope_kind,
      scopeKey: meta.scope_key,
      sectionKey: meta.section_key,
      valueText: effectiveSourceValue,
    });
    return {
      ...meta,
      effective_source_value: effectiveSourceValue,
      translation_is_stale: Boolean(meta.source_snapshot_hash) && meta.source_snapshot_hash !== sourceHash,
    };
  });
}
