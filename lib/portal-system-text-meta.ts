import { createHash } from "node:crypto";

import { getPortalSystemTextDefaultValue, type PortalSystemTextKey } from "@/lib/portal-system-text-definitions";
import { createAdminClient } from "@/utils/supabase/admin";

export type PortalSystemTextEntryStatus = "draft" | "internal" | "live";

export type PortalSystemTextEntryRecord = {
  key: PortalSystemTextKey;
  locale: string;
  status: PortalSystemTextEntryStatus;
  value_text: string;
  updated_at?: string | null;
};

export type PortalSystemTextI18nMetaRecord = {
  key: PortalSystemTextKey;
  locale: string;
  source_locale: string;
  source_snapshot_hash: string | null;
  source_updated_at: string | null;
  translation_origin: "manual" | "ai" | "sync_copy_all" | "sync_fill_missing";
  updated_at?: string | null;
};

export type PortalSystemTextI18nMetaViewRecord = PortalSystemTextI18nMetaRecord & {
  translation_is_stale: boolean;
  effective_source_value: string;
};

function isMissingTable(error: unknown, table: string): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return msg.includes(`public.${table}`) && msg.includes("does not exist");
}

export function buildPortalSystemTextSourceSnapshotHash(args: {
  key: PortalSystemTextKey;
  valueText: string;
}): string {
  return createHash("sha256")
    .update(JSON.stringify({ key: args.key, value_text: args.valueText }))
    .digest("hex");
}

export async function loadPortalSystemTextI18nMeta(
  admin: ReturnType<typeof createAdminClient>,
): Promise<PortalSystemTextI18nMetaRecord[]> {
  const { data, error } = await admin
    .from("portal_system_text_i18n_meta")
    .select("key, locale, source_locale, source_snapshot_hash, source_updated_at, translation_origin, updated_at")
    .order("locale", { ascending: true })
    .order("key", { ascending: true });

  if (error) {
    if (isMissingTable(error, "portal_system_text_i18n_meta")) return [];
    throw error;
  }

  return (data ?? []).map((row) => ({
    key: String(row.key ?? "") as PortalSystemTextKey,
    locale: String(row.locale ?? "").trim().toLowerCase(),
    source_locale: String(row.source_locale ?? "de").trim().toLowerCase(),
    source_snapshot_hash: row.source_snapshot_hash ? String(row.source_snapshot_hash) : null,
    source_updated_at: row.source_updated_at ? String(row.source_updated_at) : null,
    translation_origin: String(row.translation_origin ?? "manual") as PortalSystemTextI18nMetaRecord["translation_origin"],
    updated_at: row.updated_at ? String(row.updated_at) : null,
  }));
}

export async function upsertPortalSystemTextI18nMeta(
  admin: ReturnType<typeof createAdminClient>,
  rows: PortalSystemTextI18nMetaRecord[],
): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await admin.from("portal_system_text_i18n_meta").upsert(rows.map((row) => ({
    key: row.key,
    locale: row.locale,
    source_locale: row.source_locale,
    source_snapshot_hash: row.source_snapshot_hash,
    source_updated_at: row.source_updated_at,
    translation_origin: row.translation_origin,
    updated_at: new Date().toISOString(),
  })), {
    onConflict: "key,locale",
  });
  if (error) throw error;
}

export function buildPortalSystemTextI18nMetaViews(args: {
  metas: PortalSystemTextI18nMetaRecord[];
  entries: PortalSystemTextEntryRecord[];
}): PortalSystemTextI18nMetaViewRecord[] {
  const sourceEntryMap = new Map<string, PortalSystemTextEntryRecord>();
  for (const entry of args.entries) {
    if (entry.locale !== "de") continue;
    sourceEntryMap.set(entry.key, entry);
  }

  return args.metas.map((meta) => {
    const sourceEntry = sourceEntryMap.get(meta.key);
    const effectiveSourceValue = sourceEntry?.value_text ?? getPortalSystemTextDefaultValue("de", meta.key);
    const sourceHash = buildPortalSystemTextSourceSnapshotHash({
      key: meta.key,
      valueText: effectiveSourceValue,
    });
    return {
      ...meta,
      effective_source_value: effectiveSourceValue,
      translation_is_stale: Boolean(meta.source_snapshot_hash) && meta.source_snapshot_hash !== sourceHash,
    };
  });
}
