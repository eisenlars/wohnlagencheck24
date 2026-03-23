import { NextResponse } from "next/server";

import {
  MARKET_EXPLANATION_STATIC_TEXT_DEFINITIONS,
  getMarketExplanationStaticTextDefaultValue,
  type MarketExplanationStaticTextKey,
} from "@/lib/market-explanation-static-text-definitions";
import {
  buildMarketExplanationStaticTextI18nMetaViews,
  buildMarketExplanationStaticTextSourceSnapshotHash,
  loadMarketExplanationStaticTextI18nMeta,
  upsertMarketExplanationStaticTextI18nMeta,
  type MarketExplanationStaticTextEntryRecord,
  type MarketExplanationStaticTextEntryStatus,
} from "@/lib/market-explanation-static-text-meta";
import type { PortalLocaleConfigRecord } from "@/lib/portal-cms";
import { normalizePortalLocaleCode } from "@/lib/portal-locale-registry";
import { requireAdmin } from "@/lib/security/admin-auth";
import { checkAdminApiRateLimit } from "@/lib/security/rate-limit";
import { createAdminClient } from "@/utils/supabase/admin";

type StaticTextEntryInput = {
  key?: unknown;
  locale?: unknown;
  status?: unknown;
  value_text?: unknown;
};

type StaticTextSyncInput = {
  target_locale?: unknown;
  mode?: unknown;
};

type Body = {
  entries?: StaticTextEntryInput[];
  sync?: StaticTextSyncInput;
};

function isMissingTable(error: unknown, table: string): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return (
    (msg.includes(`public.${table}`) && msg.includes("does not exist")) ||
    (msg.includes(table) && msg.includes("column") && msg.includes("does not exist"))
  );
}

function asText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeStatus(value: unknown): MarketExplanationStaticTextEntryStatus {
  const normalized = asText(value).toLowerCase();
  if (normalized === "internal" || normalized === "live") return normalized;
  return "draft";
}

function sanitizeKey(value: unknown): MarketExplanationStaticTextKey {
  const normalized = asText(value) as MarketExplanationStaticTextKey;
  if (!MARKET_EXPLANATION_STATIC_TEXT_DEFINITIONS.some((item) => item.key === normalized)) {
    throw new Error(`Unbekannter statischer Erklärungstext-Key: ${normalized}`);
  }
  return normalized;
}

function resolveAutoWriteStatus(
  currentStatus: MarketExplanationStaticTextEntryStatus | null | undefined,
): MarketExplanationStaticTextEntryStatus {
  if (currentStatus === "live") return "internal";
  if (currentStatus === "internal") return "internal";
  return "draft";
}

async function loadLocales(admin: ReturnType<typeof createAdminClient>): Promise<PortalLocaleConfigRecord[]> {
  const { data, error } = await admin
    .from("portal_locale_config")
    .select("locale, status, partner_bookable, is_active, label_native, label_de, bcp47_tag, fallback_locale, text_direction, number_locale, date_locale, currency_code, billing_feature_code")
    .order("locale", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    locale: normalizePortalLocaleCode(row.locale),
    status: String(row.status ?? "planned") as PortalLocaleConfigRecord["status"],
    partner_bookable: row.partner_bookable === true,
    is_active: row.is_active === true,
    label_native: row.label_native ? String(row.label_native) : null,
    label_de: row.label_de ? String(row.label_de) : null,
    bcp47_tag: row.bcp47_tag ? String(row.bcp47_tag) : null,
    fallback_locale: row.fallback_locale ? String(row.fallback_locale) : "de",
    text_direction: row.text_direction === "rtl" ? "rtl" : "ltr",
    number_locale: row.number_locale ? String(row.number_locale) : null,
    date_locale: row.date_locale ? String(row.date_locale) : null,
    currency_code: row.currency_code ? String(row.currency_code) : "EUR",
    billing_feature_code: row.billing_feature_code ? String(row.billing_feature_code) : null,
  }));
}

async function loadStaticTexts(admin: ReturnType<typeof createAdminClient>) {
  const [entriesRes, metaRes, locales] = await Promise.all([
    admin
      .from("market_explanation_static_text_entries")
      .select("key, locale, status, value_text, updated_at")
      .order("locale", { ascending: true })
      .order("key", { ascending: true }),
    loadMarketExplanationStaticTextI18nMeta(admin),
    loadLocales(admin),
  ]);

  if (entriesRes.error) throw entriesRes.error;

  const entries: MarketExplanationStaticTextEntryRecord[] = (entriesRes.data ?? []).map((row) => ({
    key: sanitizeKey(row.key),
    locale: normalizePortalLocaleCode(row.locale),
    status: normalizeStatus(row.status),
    value_text: String(row.value_text ?? ""),
    updated_at: row.updated_at ? String(row.updated_at) : null,
  }));

  return {
    locales,
    definitions: MARKET_EXPLANATION_STATIC_TEXT_DEFINITIONS,
    entries,
    metas: buildMarketExplanationStaticTextI18nMetaViews({
      metas: metaRes,
      entries,
    }),
  };
}

async function loadEffectiveGermanSourceMap(admin: ReturnType<typeof createAdminClient>) {
  const { data, error } = await admin
    .from("market_explanation_static_text_entries")
    .select("key, locale, status, value_text, updated_at")
    .eq("locale", "de");
  if (error) throw error;

  const map = new Map<MarketExplanationStaticTextKey, { value_text: string; updated_at: string | null }>();
  for (const def of MARKET_EXPLANATION_STATIC_TEXT_DEFINITIONS) {
    const row = (data ?? []).find((item) => String(item.key ?? "") === def.key);
    map.set(def.key, {
      value_text: row ? String(row.value_text ?? "") : getMarketExplanationStaticTextDefaultValue("de", def.key),
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
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
      );
    }

    const admin = createAdminClient();
    const payload = await loadStaticTexts(admin);
    return NextResponse.json({ ok: true, ...payload });
  } catch (error) {
    if (isMissingTable(error, "market_explanation_static_text_entries")) {
      return NextResponse.json(
        {
          error:
            "Tabellen für statische Markterklärungstexte fehlen. Bitte `docs/sql/portal_cms.sql` ausführen.",
        },
        { status: 409 },
      );
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
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
      );
    }

    const body = (await req.json()) as Body;
    const admin = createAdminClient();

    if (body.sync) {
      const targetLocale = normalizePortalLocaleCode(body.sync.target_locale);
      const mode = String(body.sync.mode ?? "").trim().toLowerCase() === "copy_all"
        ? "copy_all"
        : "fill_missing";
      if (!targetLocale || targetLocale === "de") {
        throw new Error("Statische Erklärungstext-Sync benötigt eine Ziel-Locale ungleich de.");
      }

      const [targetRes, sourceMap] = await Promise.all([
        admin
          .from("market_explanation_static_text_entries")
          .select("key, locale, status, value_text, updated_at")
          .eq("locale", targetLocale),
        loadEffectiveGermanSourceMap(admin),
      ]);
      if (targetRes.error) throw targetRes.error;

      const targetMap = new Map(
        (targetRes.data ?? []).map((row) => [String(row.key ?? ""), row] as const),
      );

      const upsertRows = MARKET_EXPLANATION_STATIC_TEXT_DEFINITIONS.flatMap((def) => {
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
        const { error } = await admin.from("market_explanation_static_text_entries").upsert(
          upsertRows,
          { onConflict: "key,locale" },
        );
        if (error) throw error;

        await upsertMarketExplanationStaticTextI18nMeta(
          admin,
          upsertRows.map((row) => {
            const source = sourceMap.get(row.key);
            return {
              key: row.key,
              locale: row.locale,
              source_locale: "de",
              source_snapshot_hash: source
                ? buildMarketExplanationStaticTextSourceSnapshotHash({
                    key: row.key,
                    valueText: source.value_text,
                  })
                : null,
              source_updated_at: source?.updated_at ?? null,
              translation_origin: mode === "copy_all" ? "sync_copy_all" : "sync_fill_missing",
            };
          }),
        );
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

      const { error } = await admin.from("market_explanation_static_text_entries").upsert(rows, {
        onConflict: "key,locale",
      });
      if (error) throw error;

      const translatedRows = rows.filter((row) => row.locale !== "de");
      if (translatedRows.length > 0) {
        const sourceMap = await loadEffectiveGermanSourceMap(admin);
        await upsertMarketExplanationStaticTextI18nMeta(
          admin,
          translatedRows.map((row) => {
            const source = sourceMap.get(row.key);
            return {
              key: row.key,
              locale: row.locale,
              source_locale: "de",
              source_snapshot_hash: source
                ? buildMarketExplanationStaticTextSourceSnapshotHash({
                    key: row.key,
                    valueText: source.value_text,
                  })
                : null,
              source_updated_at: source?.updated_at ?? null,
              translation_origin: "manual" as const,
            };
          }),
        );
      }
    }

    const payload = await loadStaticTexts(admin);
    return NextResponse.json({ ok: true, ...payload });
  } catch (error) {
    if (isMissingTable(error, "market_explanation_static_text_entries")) {
      return NextResponse.json(
        {
          error:
            "Tabellen für statische Markterklärungstexte fehlen. Bitte `docs/sql/portal_cms.sql` ausführen.",
        },
        { status: 409 },
      );
    }
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
