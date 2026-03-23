import { NextResponse } from "next/server";

import { translateAdminTextItems } from "@/lib/admin-text-i18n";
import { requireAdmin } from "@/lib/security/admin-auth";
import { checkAdminApiRateLimit } from "@/lib/security/rate-limit";
import {
  PORTAL_SYSTEM_TEXT_DEFINITIONS,
  getPortalSystemTextDefaultValue,
  type PortalSystemTextKey,
} from "@/lib/portal-system-text-definitions";
import {
  buildPortalSystemTextI18nMetaViews,
  buildPortalSystemTextSourceSnapshotHash,
  loadPortalSystemTextI18nMeta,
  upsertPortalSystemTextI18nMeta,
  type PortalSystemTextEntryRecord,
  type PortalSystemTextEntryStatus,
} from "@/lib/portal-system-text-meta";
import { normalizePortalLocaleCode } from "@/lib/portal-locale-registry";
import { createAdminClient } from "@/utils/supabase/admin";

type PortalSystemTextEntryInput = {
  key?: unknown;
  locale?: unknown;
  status?: unknown;
  value_text?: unknown;
};

type PortalSystemTextSyncInput = {
  target_locale?: unknown;
  mode?: unknown;
};

type PortalSystemTextTranslateInput = {
  target_locale?: unknown;
  keys?: unknown;
};

type Body = {
  entries?: PortalSystemTextEntryInput[];
  sync?: PortalSystemTextSyncInput;
  translate?: PortalSystemTextTranslateInput;
};

function isMissingTable(error: unknown, table: string): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return (
    (msg.includes(`public.${table}`) && msg.includes("does not exist"))
    || (msg.includes(table) && msg.includes("column") && msg.includes("does not exist"))
  );
}

function asText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeStatus(value: unknown): PortalSystemTextEntryStatus {
  const normalized = asText(value).toLowerCase();
  if (normalized === "internal" || normalized === "live") return normalized;
  return "draft";
}

function sanitizeKey(value: unknown): PortalSystemTextKey {
  const normalized = asText(value) as PortalSystemTextKey;
  if (!PORTAL_SYSTEM_TEXT_DEFINITIONS.some((item) => item.key === normalized)) {
    throw new Error(`Unbekannter Systemtext-Key: ${normalized}`);
  }
  return normalized;
}

function resolveAutoWriteStatus(currentStatus: PortalSystemTextEntryStatus | null | undefined): PortalSystemTextEntryStatus {
  if (currentStatus === "live") return "internal";
  if (currentStatus === "internal") return "internal";
  return "draft";
}

function normalizeTranslateKeys(value: unknown): PortalSystemTextKey[] {
  if (!Array.isArray(value) || value.length === 0) {
    return PORTAL_SYSTEM_TEXT_DEFINITIONS.map((item) => item.key);
  }
  return Array.from(new Set(value.map((item) => sanitizeKey(item))));
}

async function loadSystemTexts(admin: ReturnType<typeof createAdminClient>) {
  const [entriesRes, metaRes] = await Promise.all([
    admin
      .from("portal_system_text_entries")
      .select("key, locale, status, value_text, updated_at")
      .order("locale", { ascending: true })
      .order("key", { ascending: true }),
    loadPortalSystemTextI18nMeta(admin),
  ]);

  if (entriesRes.error) throw entriesRes.error;

  const entries: PortalSystemTextEntryRecord[] = (entriesRes.data ?? []).map((row) => ({
    key: sanitizeKey(row.key),
    locale: normalizePortalLocaleCode(row.locale),
    status: normalizeStatus(row.status),
    value_text: String(row.value_text ?? ""),
    updated_at: row.updated_at ? String(row.updated_at) : null,
  }));

  return {
    definitions: PORTAL_SYSTEM_TEXT_DEFINITIONS,
    entries,
    metas: buildPortalSystemTextI18nMetaViews({
      metas: metaRes,
      entries,
    }),
  };
}

async function loadEffectiveGermanSourceMap(admin: ReturnType<typeof createAdminClient>) {
  const { data, error } = await admin
    .from("portal_system_text_entries")
    .select("key, locale, status, value_text, updated_at")
    .eq("locale", "de");
  if (error) throw error;
  const map = new Map<PortalSystemTextKey, { value_text: string; updated_at: string | null }>();
  for (const def of PORTAL_SYSTEM_TEXT_DEFINITIONS) {
    const row = (data ?? []).find((item) => String(item.key ?? "") === def.key);
    map.set(def.key, {
      value_text: row ? String(row.value_text ?? "") : getPortalSystemTextDefaultValue("de", def.key),
      updated_at: row?.updated_at ? String(row.updated_at) : null,
    });
  }
  return map;
}

export async function GET(req: Request) {
  try {
    const adminUser = await requireAdmin(["admin_super", "admin_ops"]);
    const limit = await checkAdminApiRateLimit(req, adminUser.userId);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } });
    }

    const admin = createAdminClient();
    const payload = await loadSystemTexts(admin);
    return NextResponse.json({ ok: true, ...payload });
  } catch (error) {
    if (isMissingTable(error, "portal_system_text_entries")) {
      return NextResponse.json({ error: "Systemtext-Tabellen fehlen. Bitte `docs/sql/portal_cms.sql` ausführen." }, { status: 409 });
    }
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
    const admin = createAdminClient();

    if (body.translate) {
      const targetLocale = normalizePortalLocaleCode(body.translate.target_locale);
      const selectedKeys = normalizeTranslateKeys(body.translate.keys);
      if (!targetLocale || targetLocale === "de") {
        throw new Error("Systemtext-KI-Uebersetzung benoetigt eine Ziel-Locale ungleich de.");
      }

      const [targetRes, sourceMap] = await Promise.all([
        admin
          .from("portal_system_text_entries")
          .select("key, locale, status, value_text, updated_at")
          .eq("locale", targetLocale),
        loadEffectiveGermanSourceMap(admin),
      ]);
      if (targetRes.error) throw targetRes.error;

      const targetMap = new Map(
        (targetRes.data ?? []).map((row) => [String(row.key ?? ""), row] as const),
      );

      const translatedValues = await translateAdminTextItems({
        admin,
        domain: "portal_system_texts",
        domainLabel: "Portalweite Systemtexte",
        targetLocale,
        items: selectedKeys.map((key) => ({
          key,
          label: PORTAL_SYSTEM_TEXT_DEFINITIONS.find((item) => item.key === key)?.label ?? key,
          sourceText: sourceMap.get(key)?.value_text ?? getPortalSystemTextDefaultValue("de", key),
        })),
      });

      const upsertRows = selectedKeys.flatMap((key) => {
        const translatedText = translatedValues.get(key);
        if (!translatedText) return [];
        const current = targetMap.get(key);
        return [{
          key,
          locale: targetLocale,
          status: resolveAutoWriteStatus(normalizeStatus(current?.status)),
          value_text: translatedText,
          updated_at: new Date().toISOString(),
        }];
      });

      if (upsertRows.length > 0) {
        const { error } = await admin.from("portal_system_text_entries").upsert(upsertRows, {
          onConflict: "key,locale",
        });
        if (error) throw error;

        await upsertPortalSystemTextI18nMeta(admin, upsertRows.map((row) => {
          const source = sourceMap.get(row.key);
          return {
            key: row.key,
            locale: row.locale,
            source_locale: "de",
            source_snapshot_hash: source ? buildPortalSystemTextSourceSnapshotHash({ key: row.key, valueText: source.value_text }) : null,
            source_updated_at: source?.updated_at ?? null,
            translation_origin: "ai" as const,
          };
        }));
      }
    }

    if (body.sync) {
      const targetLocale = normalizePortalLocaleCode(body.sync.target_locale);
      const mode = String(body.sync.mode ?? "").trim().toLowerCase() === "copy_all" ? "copy_all" : "fill_missing";
      if (!targetLocale || targetLocale === "de") {
        throw new Error("Systemtext-Sync benötigt eine Ziel-Locale ungleich de.");
      }

      const [targetRes, sourceMap] = await Promise.all([
        admin
          .from("portal_system_text_entries")
          .select("key, locale, status, value_text, updated_at")
          .eq("locale", targetLocale),
        loadEffectiveGermanSourceMap(admin),
      ]);
      if (targetRes.error) throw targetRes.error;

      const targetMap = new Map(
        (targetRes.data ?? []).map((row) => [String(row.key ?? ""), row] as const),
      );

      const upsertRows = PORTAL_SYSTEM_TEXT_DEFINITIONS.flatMap((def) => {
        const source = sourceMap.get(def.key);
        if (!source) return [];
        const current = targetMap.get(def.key);
        const currentValue = String(current?.value_text ?? "");
        if (mode === "fill_missing" && currentValue.trim()) return [];
        return [{
          key: def.key,
          locale: targetLocale,
          status: resolveAutoWriteStatus(normalizeStatus(current?.status)),
          value_text: source.value_text,
          updated_at: new Date().toISOString(),
        }];
      });

      if (upsertRows.length > 0) {
        const { error } = await admin.from("portal_system_text_entries").upsert(upsertRows, {
          onConflict: "key,locale",
        });
        if (error) throw error;

        await upsertPortalSystemTextI18nMeta(admin, upsertRows.map((row) => {
          const source = sourceMap.get(row.key);
          return {
            key: row.key,
            locale: row.locale,
            source_locale: "de",
            source_snapshot_hash: source ? buildPortalSystemTextSourceSnapshotHash({ key: row.key, valueText: source.value_text }) : null,
            source_updated_at: source?.updated_at ?? null,
            translation_origin: mode === "copy_all" ? "sync_copy_all" : "sync_fill_missing",
          };
        }));
      }
    }

    if (Array.isArray(body.entries) && body.entries.length > 0) {
      const rows = body.entries.map((row) => ({
        key: sanitizeKey(row.key),
        locale: normalizePortalLocaleCode(row.locale),
        status: normalizeStatus(row.status),
        value_text: String(row.value_text ?? ""),
        updated_at: new Date().toISOString(),
      }));

      const { error } = await admin.from("portal_system_text_entries").upsert(rows, {
        onConflict: "key,locale",
      });
      if (error) throw error;

      const translatedRows = rows.filter((row) => row.locale !== "de");
      if (translatedRows.length > 0) {
        const sourceMap = await loadEffectiveGermanSourceMap(admin);
        await upsertPortalSystemTextI18nMeta(admin, translatedRows.map((row) => {
          const source = sourceMap.get(row.key);
          return {
            key: row.key,
            locale: row.locale,
            source_locale: "de",
            source_snapshot_hash: source ? buildPortalSystemTextSourceSnapshotHash({ key: row.key, valueText: source.value_text }) : null,
            source_updated_at: source?.updated_at ?? null,
            translation_origin: "manual" as const,
          };
        }));
      }
    }

    const payload = await loadSystemTexts(admin);
    return NextResponse.json({ ok: true, ...payload });
  } catch (error) {
    if (isMissingTable(error, "portal_system_text_entries")) {
      return NextResponse.json({ error: "Systemtext-Tabellen fehlen. Bitte `docs/sql/portal_cms.sql` ausführen." }, { status: 409 });
    }
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
