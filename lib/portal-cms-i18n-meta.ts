import { getPortalCmsSection, normalizePortalCmsFields, type PortalContentEntryRecord, type PortalContentEntryStatus } from "@/lib/portal-cms";
import { hashText } from "@/lib/text-hash";
import { createAdminClient } from "@/utils/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export type PortalContentTranslationOrigin =
  | "manual"
  | "ai"
  | "sync_copy_all"
  | "sync_fill_missing";

export type PortalContentI18nMetaRecord = {
  page_key: string;
  section_key: string;
  locale: string;
  source_locale: string;
  source_snapshot_hash: string | null;
  source_updated_at: string | null;
  translation_origin: PortalContentTranslationOrigin;
  updated_at?: string | null;
};

export type PortalContentI18nMetaViewRecord = PortalContentI18nMetaRecord & {
  is_stale: boolean;
};

function asText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeIso(value: string | null | undefined): string | null {
  const raw = asText(value);
  if (!raw) return null;
  const ts = Date.parse(raw);
  if (!Number.isFinite(ts)) return null;
  return new Date(ts).toISOString();
}

export function isMissingPortalCmsMetaTable(error: unknown): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return msg.includes("public.portal_content_i18n_meta") && msg.includes("does not exist");
}

export function resolvePortalCmsAutomatedStatus(status: PortalContentEntryStatus | null | undefined): PortalContentEntryStatus {
  return status === "draft" ? "draft" : "internal";
}

export function buildPortalCmsSourceSnapshotHash(args: {
  pageKey: string;
  sectionKey: string;
  fieldsJson?: Record<string, string> | null;
}): string {
  const section = getPortalCmsSection(args.pageKey, args.sectionKey);
  if (!section) return hashText("{}");
  const normalized = normalizePortalCmsFields(section, args.fieldsJson ?? {});
  return hashText(JSON.stringify(normalized));
}

export function buildPortalCmsMetaKey(pageKey: string, sectionKey: string, locale: string): string {
  return `${pageKey}::${sectionKey}::${locale}`;
}

export async function loadPortalContentI18nMeta(
  admin: AdminClient,
  filters?: { pageKey?: string; locale?: string },
): Promise<PortalContentI18nMetaRecord[]> {
  let query = admin
    .from("portal_content_i18n_meta")
    .select("page_key, section_key, locale, source_locale, source_snapshot_hash, source_updated_at, translation_origin, updated_at");
  if (filters?.pageKey) query = query.eq("page_key", filters.pageKey);
  if (filters?.locale) query = query.eq("locale", filters.locale);
  const { data, error } = await query;
  if (error) {
    if (isMissingPortalCmsMetaTable(error)) return [];
    throw new Error(String(error.message ?? "Portal-CMS i18n Meta konnte nicht geladen werden."));
  }
  return (data ?? []).map((row) => ({
    page_key: asText(row.page_key),
    section_key: asText(row.section_key),
    locale: asText(row.locale).toLowerCase(),
    source_locale: asText(row.source_locale).toLowerCase(),
    source_snapshot_hash: asText(row.source_snapshot_hash) || null,
    source_updated_at: normalizeIso(row.source_updated_at as string | null | undefined),
    translation_origin: (asText(row.translation_origin) || "manual") as PortalContentTranslationOrigin,
    updated_at: normalizeIso(row.updated_at as string | null | undefined),
  }));
}

export async function upsertPortalContentI18nMeta(
  admin: AdminClient,
  rows: PortalContentI18nMetaRecord[],
): Promise<void> {
  if (rows.length === 0) return;
  const payload = rows.map((row) => ({
    page_key: row.page_key,
    section_key: row.section_key,
    locale: row.locale,
    source_locale: row.source_locale,
    source_snapshot_hash: row.source_snapshot_hash,
    source_updated_at: row.source_updated_at,
    translation_origin: row.translation_origin,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await admin.from("portal_content_i18n_meta").upsert(payload, {
    onConflict: "page_key,section_key,locale",
  });
  if (error && !isMissingPortalCmsMetaTable(error)) {
    throw new Error(String(error.message ?? "Portal-CMS i18n Meta konnte nicht gespeichert werden."));
  }
}

export function buildPortalContentI18nMetaViews(args: {
  metas: PortalContentI18nMetaRecord[];
  entries: PortalContentEntryRecord[];
}): PortalContentI18nMetaViewRecord[] {
  const entryMap = new Map(
    args.entries.map((entry) => [
      buildPortalCmsMetaKey(entry.page_key, entry.section_key, entry.locale),
      entry,
    ] as const),
  );
  return args.metas.map((meta) => {
    const sourceEntry = entryMap.get(buildPortalCmsMetaKey(meta.page_key, meta.section_key, meta.source_locale));
    const currentSourceHash = buildPortalCmsSourceSnapshotHash({
      pageKey: meta.page_key,
      sectionKey: meta.section_key,
      fieldsJson: sourceEntry?.fields_json,
    });
    return {
      ...meta,
      is_stale: Boolean(meta.source_snapshot_hash) && currentSourceHash !== meta.source_snapshot_hash,
    };
  });
}
