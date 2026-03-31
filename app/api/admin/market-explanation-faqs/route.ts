import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { translateAdminTextItems } from "@/lib/admin-text-i18n";
import {
  MARKET_EXPLANATION_STANDARD_TABS,
  type MarketExplanationStandardTabId,
} from "@/lib/market-explanation-standard-text-definitions";
import {
  buildMarketExplanationFaqI18nMetaViews,
  buildMarketExplanationFaqSourceSnapshotHash,
  getMarketExplanationFaqDefaultItems,
  loadMarketExplanationFaqI18nMeta,
  normalizeMarketExplanationFaqTabId,
  upsertMarketExplanationFaqI18nMeta,
  type MarketExplanationFaqEntryRecord,
  type MarketExplanationFaqEntryStatus,
  type MarketExplanationFaqI18nMetaRecord,
} from "@/lib/market-explanation-faqs";
import type { PortalLocaleConfigRecord } from "@/lib/portal-cms";
import { normalizePortalLocaleCode } from "@/lib/portal-locale-registry";
import { requireAdmin } from "@/lib/security/admin-auth";
import { checkAdminApiRateLimit } from "@/lib/security/rate-limit";
import { createAdminClient } from "@/utils/supabase/admin";

type FaqEntryInput = {
  item_id?: unknown;
  question?: unknown;
  answer?: unknown;
  status?: unknown;
  sort_order?: unknown;
};

type FaqSyncInput = {
  target_locale?: unknown;
  tab_id?: unknown;
  mode?: unknown;
};

type FaqTranslateInput = {
  target_locale?: unknown;
  tab_id?: unknown;
  item_ids?: unknown;
};

type Body = {
  locale?: unknown;
  tab_id?: unknown;
  entries?: FaqEntryInput[];
  sync?: FaqSyncInput;
  translate?: FaqTranslateInput;
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

function normalizeStatus(value: unknown): MarketExplanationFaqEntryStatus {
  const normalized = asText(value).toLowerCase();
  if (normalized === "internal" || normalized === "live") return normalized;
  return "draft";
}

function sanitizeTabId(value: unknown): MarketExplanationStandardTabId {
  return normalizeMarketExplanationFaqTabId(value);
}

function resolveAutoWriteStatus(
  currentStatus: MarketExplanationFaqEntryStatus | null | undefined,
): MarketExplanationFaqEntryStatus {
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

function mapFaqRow(row: Record<string, unknown>): MarketExplanationFaqEntryRecord {
  return {
    tab_id: sanitizeTabId(row.tab_id),
    item_id: asText(row.item_id),
    locale: normalizePortalLocaleCode(row.locale),
    status: normalizeStatus(row.status),
    question: String(row.question ?? ""),
    answer: String(row.answer ?? ""),
    sort_order: Number.isFinite(Number(row.sort_order)) ? Number(row.sort_order) : 0,
    updated_at: row.updated_at ? String(row.updated_at) : null,
  };
}

async function loadFaqEntries(admin: ReturnType<typeof createAdminClient>): Promise<MarketExplanationFaqEntryRecord[]> {
  const { data, error } = await admin
    .from("market_explanation_faq_entries")
    .select("tab_id, item_id, locale, status, question, answer, sort_order, updated_at")
    .order("tab_id", { ascending: true })
    .order("locale", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("item_id", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => mapFaqRow(row as Record<string, unknown>));
}

async function loadEffectiveGermanFaqItems(
  admin: ReturnType<typeof createAdminClient>,
  tabId: MarketExplanationStandardTabId,
) {
  const { data, error } = await admin
    .from("market_explanation_faq_entries")
    .select("tab_id, item_id, locale, status, question, answer, sort_order, updated_at")
    .eq("tab_id", tabId)
    .eq("locale", "de")
    .order("sort_order", { ascending: true })
    .order("item_id", { ascending: true });
  if (error) throw error;
  const rows = (data ?? []).map((row) => mapFaqRow(row as Record<string, unknown>));
  if (rows.length > 0) return rows;
  return getMarketExplanationFaqDefaultItems(tabId).map((item) => ({
    tab_id: tabId,
    item_id: item.item_id,
    locale: "de",
    status: "live" as const,
    question: item.question,
    answer: item.answer,
    sort_order: item.sort_order,
    updated_at: null,
  }));
}

async function loadFaqPayload(admin: ReturnType<typeof createAdminClient>) {
  const [entries, metas, locales] = await Promise.all([
    loadFaqEntries(admin),
    loadMarketExplanationFaqI18nMeta(admin),
    loadLocales(admin),
  ]);
  return {
    locales,
    tabs: MARKET_EXPLANATION_STANDARD_TABS,
    entries,
    metas: buildMarketExplanationFaqI18nMetaViews({
      metas,
      entries,
    }),
  };
}

function normalizeTranslateItemIds(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) return [];
  return Array.from(new Set(value.map((item) => asText(item)).filter(Boolean)));
}

function normalizeIncomingEntries(
  tabId: MarketExplanationStandardTabId,
  locale: string,
  rows: FaqEntryInput[],
): MarketExplanationFaqEntryRecord[] {
  const next: MarketExplanationFaqEntryRecord[] = [];
  const seen = new Set<string>();
  rows.forEach((row, index) => {
    const question = String(row.question ?? "").trim();
    const answer = String(row.answer ?? "").trim();
    if (!question && !answer) return;
    if (!question || !answer) {
      throw new Error("FAQ-Eintraege muessen immer Frage und Antwort enthalten.");
    }
    const itemId = asText(row.item_id) || randomUUID();
    if (seen.has(itemId)) return;
    seen.add(itemId);
    next.push({
      tab_id: tabId,
      item_id: itemId,
      locale,
      status: normalizeStatus(row.status),
      question,
      answer,
      sort_order: index,
      updated_at: null,
    });
  });
  return next;
}

async function deleteFaqEntries(args: {
  admin: ReturnType<typeof createAdminClient>;
  tabId: MarketExplanationStandardTabId;
  itemIds: string[];
  locale?: string;
}) {
  if (args.itemIds.length === 0) return;
  let query = args.admin
    .from("market_explanation_faq_entries")
    .delete()
    .eq("tab_id", args.tabId);
  if (args.locale) query = query.eq("locale", args.locale);
  query = query.in("item_id", args.itemIds);
  const { error } = await query;
  if (error) throw error;
}

async function deleteFaqMeta(args: {
  admin: ReturnType<typeof createAdminClient>;
  tabId: MarketExplanationStandardTabId;
  itemIds: string[];
  locale?: string;
}) {
  if (args.itemIds.length === 0) return;
  let query = args.admin
    .from("market_explanation_faq_i18n_meta")
    .delete()
    .eq("tab_id", args.tabId);
  if (args.locale) query = query.eq("locale", args.locale);
  query = query.in("item_id", args.itemIds);
  const { error } = await query;
  if (error) throw error;
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
    const payload = await loadFaqPayload(admin);
    return NextResponse.json({ ok: true, ...payload });
  } catch (error) {
    if (
      isMissingTable(error, "market_explanation_faq_entries")
      || isMissingTable(error, "market_explanation_faq_i18n_meta")
    ) {
      return NextResponse.json(
        { error: "Markterklaerungs-FAQ-Tabellen fehlen. Bitte `docs/sql/portal_cms.sql` ausfuehren." },
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

    if (body.translate) {
      const targetLocale = normalizePortalLocaleCode(body.translate.target_locale);
      const tabId = sanitizeTabId(body.translate.tab_id);
      if (!targetLocale || targetLocale === "de") {
        throw new Error("FAQ-KI-Uebersetzung benoetigt eine Ziel-Locale ungleich de.");
      }

      const sourceItems = await loadEffectiveGermanFaqItems(admin, tabId);
      const selectedItemIds = normalizeTranslateItemIds(body.translate.item_ids);
      const filteredItems = selectedItemIds.length > 0
        ? sourceItems.filter((item) => selectedItemIds.includes(item.item_id))
        : sourceItems;

      const { data: targetData, error: targetError } = await admin
        .from("market_explanation_faq_entries")
        .select("tab_id, item_id, locale, status, question, answer, sort_order, updated_at")
        .eq("tab_id", tabId)
        .eq("locale", targetLocale);
      if (targetError) throw targetError;
      const targetMap = new Map(
        (targetData ?? []).map((row) => {
          const mapped = mapFaqRow(row as Record<string, unknown>);
          return [mapped.item_id, mapped] as const;
        }),
      );

      const translatedValues = await translateAdminTextItems({
        admin,
        domain: "market_explanation_faqs",
        domainLabel: `Markterklaerungs-FAQ ${tabId}`,
        targetLocale,
        items: filteredItems.flatMap((item) => ([
          {
            key: `${item.item_id}:question`,
            label: `FAQ ${item.item_id} Frage`,
            sourceText: item.question,
          },
          {
            key: `${item.item_id}:answer`,
            label: `FAQ ${item.item_id} Antwort`,
            sourceText: item.answer,
          },
        ])),
      });

      const upsertRows = filteredItems.map((item) => {
        const current = targetMap.get(item.item_id);
        return {
          tab_id: tabId,
          item_id: item.item_id,
          locale: targetLocale,
          status: resolveAutoWriteStatus(current?.status),
          question: translatedValues.get(`${item.item_id}:question`) ?? item.question,
          answer: translatedValues.get(`${item.item_id}:answer`) ?? item.answer,
          sort_order: item.sort_order,
          updated_at: new Date().toISOString(),
        };
      });
      if (upsertRows.length > 0) {
        const { error } = await admin.from("market_explanation_faq_entries").upsert(upsertRows, {
          onConflict: "tab_id,item_id,locale",
        });
        if (error) throw error;
        await upsertMarketExplanationFaqI18nMeta(admin, filteredItems.map<MarketExplanationFaqI18nMetaRecord>((item) => ({
          tab_id: tabId,
          item_id: item.item_id,
          locale: targetLocale,
          source_locale: "de",
          source_snapshot_hash: buildMarketExplanationFaqSourceSnapshotHash({
            tabId,
            itemId: item.item_id,
            question: item.question,
            answer: item.answer,
          }),
          source_updated_at: item.updated_at ?? null,
          translation_origin: "ai",
        })));
      }
      const payload = await loadFaqPayload(admin);
      return NextResponse.json({ ok: true, ...payload });
    }

    if (body.sync) {
      const targetLocale = normalizePortalLocaleCode(body.sync.target_locale);
      const tabId = sanitizeTabId(body.sync.tab_id);
      const mode = String(body.sync.mode ?? "fill_missing") === "copy_all" ? "copy_all" : "fill_missing";
      if (!targetLocale || targetLocale === "de") {
        throw new Error("FAQ-DE-Sync benoetigt eine Ziel-Locale ungleich de.");
      }

      const sourceItems = await loadEffectiveGermanFaqItems(admin, tabId);
      const { data: targetData, error: targetError } = await admin
        .from("market_explanation_faq_entries")
        .select("tab_id, item_id, locale, status, question, answer, sort_order, updated_at")
        .eq("tab_id", tabId)
        .eq("locale", targetLocale);
      if (targetError) throw targetError;
      const targetMap = new Map(
        (targetData ?? []).map((row) => {
          const mapped = mapFaqRow(row as Record<string, unknown>);
          return [mapped.item_id, mapped] as const;
        }),
      );

      const upsertRows = sourceItems.flatMap((item) => {
        const current = targetMap.get(item.item_id);
        if (mode === "fill_missing" && current && current.question.trim() && current.answer.trim()) return [];
        return [{
          tab_id: tabId,
          item_id: item.item_id,
          locale: targetLocale,
          status: resolveAutoWriteStatus(current?.status),
          question: item.question,
          answer: item.answer,
          sort_order: item.sort_order,
          updated_at: new Date().toISOString(),
        }];
      });
      if (upsertRows.length > 0) {
        const { error } = await admin.from("market_explanation_faq_entries").upsert(upsertRows, {
          onConflict: "tab_id,item_id,locale",
        });
        if (error) throw error;
        await upsertMarketExplanationFaqI18nMeta(admin, sourceItems.map<MarketExplanationFaqI18nMetaRecord>((item) => ({
          tab_id: tabId,
          item_id: item.item_id,
          locale: targetLocale,
          source_locale: "de",
          source_snapshot_hash: buildMarketExplanationFaqSourceSnapshotHash({
            tabId,
            itemId: item.item_id,
            question: item.question,
            answer: item.answer,
          }),
          source_updated_at: item.updated_at ?? null,
          translation_origin: mode,
        })));
      }
      const payload = await loadFaqPayload(admin);
      return NextResponse.json({ ok: true, ...payload });
    }

    if (Array.isArray(body.entries)) {
      const locale = normalizePortalLocaleCode(body.locale);
      const tabId = sanitizeTabId(body.tab_id);
      const nextRows = normalizeIncomingEntries(tabId, locale, body.entries);

      const { data: existingData, error: existingError } = await admin
        .from("market_explanation_faq_entries")
        .select("tab_id, item_id, locale, status, question, answer, sort_order, updated_at")
        .eq("tab_id", tabId)
        .eq("locale", locale);
      if (existingError) throw existingError;
      const existingRows = (existingData ?? []).map((row) => mapFaqRow(row as Record<string, unknown>));
      const nextItemIds = new Set(nextRows.map((row) => row.item_id));
      const removedItemIds = existingRows
        .filter((row) => !nextItemIds.has(row.item_id))
        .map((row) => row.item_id);

      if (removedItemIds.length > 0) {
        await deleteFaqEntries({
          admin,
          tabId,
          itemIds: removedItemIds,
          locale: locale === "de" ? undefined : locale,
        });
        await deleteFaqMeta({
          admin,
          tabId,
          itemIds: removedItemIds,
          locale: locale === "de" ? undefined : locale,
        });
      }

      if (nextRows.length > 0) {
        const { error } = await admin.from("market_explanation_faq_entries").upsert(
          nextRows.map((row) => ({
            tab_id: row.tab_id,
            item_id: row.item_id,
            locale: row.locale,
            status: row.status,
            question: row.question,
            answer: row.answer,
            sort_order: row.sort_order,
            updated_at: new Date().toISOString(),
          })),
          { onConflict: "tab_id,item_id,locale" },
        );
        if (error) throw error;
      }

      if (locale !== "de" && nextRows.length > 0) {
        const germanSource = await loadEffectiveGermanFaqItems(admin, tabId);
        const sourceMap = new Map(germanSource.map((row) => [row.item_id, row] as const));
        await upsertMarketExplanationFaqI18nMeta(admin, nextRows.map<MarketExplanationFaqI18nMetaRecord>((row) => {
          const source = sourceMap.get(row.item_id);
          return {
            tab_id: row.tab_id,
            item_id: row.item_id,
            locale: row.locale,
            source_locale: "de",
            source_snapshot_hash: buildMarketExplanationFaqSourceSnapshotHash({
              tabId: row.tab_id,
              itemId: row.item_id,
              question: source?.question ?? "",
              answer: source?.answer ?? "",
            }),
            source_updated_at: source?.updated_at ?? null,
            translation_origin: "manual",
          };
        }));
      }

      const payload = await loadFaqPayload(admin);
      return NextResponse.json({ ok: true, ...payload });
    }

    throw new Error("Keine FAQ-Aktion uebergeben.");
  } catch (error) {
    if (
      isMissingTable(error, "market_explanation_faq_entries")
      || isMissingTable(error, "market_explanation_faq_i18n_meta")
    ) {
      return NextResponse.json(
        { error: "Markterklaerungs-FAQ-Tabellen fehlen. Bitte `docs/sql/portal_cms.sql` ausfuehren." },
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
