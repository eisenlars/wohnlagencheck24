import { createHash } from "node:crypto";
import { cache } from "react";

import {
  MARKET_EXPLANATION_STANDARD_TABS,
  type MarketExplanationStandardTabId,
} from "@/lib/market-explanation-standard-text-definitions";
import { normalizePublicLocale } from "@/lib/public-locale-routing";
import { createAdminClient } from "@/utils/supabase/admin";

export type MarketExplanationFaqEntryStatus = "draft" | "internal" | "live";

export type MarketExplanationFaqEntryRecord = {
  tab_id: MarketExplanationStandardTabId;
  item_id: string;
  locale: string;
  status: MarketExplanationFaqEntryStatus;
  question: string;
  answer: string;
  sort_order: number;
  updated_at?: string | null;
};

export type MarketExplanationFaqI18nMetaRecord = {
  tab_id: MarketExplanationStandardTabId;
  item_id: string;
  locale: string;
  source_locale: string;
  source_snapshot_hash: string | null;
  source_updated_at: string | null;
  translation_origin: "manual" | "ai" | "sync_copy_all" | "sync_fill_missing";
  updated_at?: string | null;
};

export type MarketExplanationFaqI18nMetaViewRecord =
  MarketExplanationFaqI18nMetaRecord & {
    translation_is_stale: boolean;
    effective_source_question: string;
    effective_source_answer: string;
  };

export type MarketExplanationFaqItem = {
  item_id: string;
  question: string;
  answer: string;
  sort_order: number;
};

export type MarketExplanationFaqMap = Record<MarketExplanationStandardTabId, MarketExplanationFaqItem[]>;

const GENERAL_DEFAULT_ITEMS: MarketExplanationFaqItem[] = [
  {
    item_id: "faq_01",
    question: "Wie aktuell sind die Daten im Marktbericht?",
    answer:
      "Die Kennzahlen basieren auf aktuellen Angebotsdaten. Das Aktualisierungsdatum finden Sie im Kopfbereich des Reports (Meta).",
    sort_order: 0,
  },
  {
    item_id: "faq_02",
    question: "Was bedeutet \"Angebotsmiete\"?",
    answer:
      "Angebotsmieten sind inserierte Neuangebote. Sie koennen von tatsaechlich vereinbarten Mieten abweichen (z. B. durch Verhandlung oder abweichende Ausstattung).",
    sort_order: 1,
  },
  {
    item_id: "faq_03",
    question: "Warum unterscheiden sich Preise und Mieten zwischen Ortslagen so stark?",
    answer:
      "Preis- und Mietunterschiede ergeben sich u. a. aus Lagequalitaet, Mikrolage, Objektmix, Zustand/Energieeffizienz sowie Angebot und Nachfrage.",
    sort_order: 2,
  },
  {
    item_id: "faq_04",
    question: "Sind die Werte fuer Haeuser und Wohnungen direkt vergleichbar?",
    answer:
      "Nicht vollstaendig. Haeuser und Wohnungen unterscheiden sich haeufig in Objektqualitaet, Flaechenstruktur, Grundstuecksanteil und Nachfrageprofil. Vergleiche sollten stets innerhalb derselben Objektgruppe erfolgen.",
    sort_order: 3,
  },
  {
    item_id: "faq_05",
    question: "Wie lese ich Vorjahresveraenderungen und Indizes?",
    answer:
      "Vorjahreswerte zeigen die Veraenderung gegenueber dem Vorjahr. Indizes setzen ein Basisjahr oder eine Referenz auf 100 und zeigen die relative Entwicklung bzw. das relative Niveau.",
    sort_order: 4,
  },
];

const DE_DEFAULTS: MarketExplanationFaqMap = {
  uebersicht: GENERAL_DEFAULT_ITEMS,
  immobilienpreise: GENERAL_DEFAULT_ITEMS,
  mietpreise: GENERAL_DEFAULT_ITEMS,
  mietrendite: GENERAL_DEFAULT_ITEMS,
  wohnmarktsituation: [
    {
      item_id: "statistische_daten",
      question: "Woher stammen die statistischen Daten zum Standort {regionName}?",
      answer:
        "Die Quelle fuer die statistischen Informationen zur Bevoelkerung, zum Arbeitsmarkt und zur Wirtschaft sind die Statistischen Bundes- und Landesaemter.",
      sort_order: 0,
    },
    {
      item_id: "standortfaktoren",
      question: "Wie definieren sich die Standortfaktoren in {regionName}?",
      answer:
        "Die Standortfaktoren werden durch unsere regionalen Partner und Immobilienspezialisten bereitgestellt.",
      sort_order: 1,
    },
  ],
  grundstueckspreise: GENERAL_DEFAULT_ITEMS,
  wohnlagencheck: GENERAL_DEFAULT_ITEMS,
  wirtschaft: GENERAL_DEFAULT_ITEMS,
};

function isMissingTable(error: unknown, table: string): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return msg.includes(`public.${table}`) && msg.includes("does not exist");
}

function cloneFaqItems(items: MarketExplanationFaqItem[]): MarketExplanationFaqItem[] {
  return items.map((item) => ({
    item_id: item.item_id,
    question: item.question,
    answer: item.answer,
    sort_order: item.sort_order,
  }));
}

export function normalizeMarketExplanationFaqTabId(value: unknown): MarketExplanationStandardTabId {
  const normalized = String(value ?? "").trim();
  if (!MARKET_EXPLANATION_STANDARD_TABS.some((tab) => tab.id === normalized)) {
    throw new Error(`Unbekannter Markterklaerung-FAQ-Tab: ${normalized}`);
  }
  return normalized as MarketExplanationStandardTabId;
}

export function getMarketExplanationFaqDefaultItems(
  tabId: MarketExplanationStandardTabId,
): MarketExplanationFaqItem[] {
  return cloneFaqItems(DE_DEFAULTS[tabId] ?? []);
}

export function getMarketExplanationFaqDefaultMap(
  locale?: string | null | undefined,
): MarketExplanationFaqMap {
  const _normalized = normalizePublicLocale(locale);
  return MARKET_EXPLANATION_STANDARD_TABS.reduce<MarketExplanationFaqMap>((acc, tab) => {
    acc[tab.id] = getMarketExplanationFaqDefaultItems(tab.id, _normalized);
    return acc;
  }, {} as MarketExplanationFaqMap);
}

export function formatMarketExplanationFaqText(
  template: string,
  replacements: Record<string, string | number | null | undefined>,
): string {
  return String(template ?? "").replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, token) => {
    const value = replacements[token];
    return value === null || value === undefined ? "" : String(value);
  });
}

export function buildMarketExplanationFaqSourceSnapshotHash(args: {
  tabId: MarketExplanationStandardTabId;
  itemId: string;
  question: string;
  answer: string;
}): string {
  return createHash("sha256")
    .update(JSON.stringify({
      tab_id: args.tabId,
      item_id: args.itemId,
      question: args.question,
      answer: args.answer,
    }))
    .digest("hex");
}

function buildEntryKey(tabId: MarketExplanationStandardTabId, itemId: string): string {
  return `${tabId}::${itemId}`;
}

export function buildMarketExplanationFaqEffectiveGermanItems(args: {
  tabId: MarketExplanationStandardTabId;
  entries: MarketExplanationFaqEntryRecord[];
}): MarketExplanationFaqItem[] {
  const germanRows = args.entries
    .filter((entry) => entry.tab_id === args.tabId && entry.locale === "de")
    .sort((left, right) => left.sort_order - right.sort_order || left.item_id.localeCompare(right.item_id));
  if (germanRows.length > 0) {
    return germanRows.map((entry) => ({
      item_id: entry.item_id,
      question: entry.question,
      answer: entry.answer,
      sort_order: entry.sort_order,
    }));
  }
  return getMarketExplanationFaqDefaultItems(args.tabId, "de");
}

export async function loadMarketExplanationFaqI18nMeta(
  admin: ReturnType<typeof createAdminClient>,
): Promise<MarketExplanationFaqI18nMetaRecord[]> {
  const { data, error } = await admin
    .from("market_explanation_faq_i18n_meta")
    .select("tab_id, item_id, locale, source_locale, source_snapshot_hash, source_updated_at, translation_origin, updated_at")
    .order("tab_id", { ascending: true })
    .order("locale", { ascending: true })
    .order("item_id", { ascending: true });

  if (error) {
    if (isMissingTable(error, "market_explanation_faq_i18n_meta")) return [];
    throw error;
  }

  return (data ?? []).map((row) => ({
    tab_id: normalizeMarketExplanationFaqTabId(row.tab_id),
    item_id: String(row.item_id ?? "").trim(),
    locale: String(row.locale ?? "").trim().toLowerCase(),
    source_locale: String(row.source_locale ?? "de").trim().toLowerCase() || "de",
    source_snapshot_hash: row.source_snapshot_hash ? String(row.source_snapshot_hash) : null,
    source_updated_at: row.source_updated_at ? String(row.source_updated_at) : null,
    translation_origin: String(row.translation_origin ?? "manual") as MarketExplanationFaqI18nMetaRecord["translation_origin"],
    updated_at: row.updated_at ? String(row.updated_at) : null,
  }));
}

export async function upsertMarketExplanationFaqI18nMeta(
  admin: ReturnType<typeof createAdminClient>,
  rows: MarketExplanationFaqI18nMetaRecord[],
): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await admin.from("market_explanation_faq_i18n_meta").upsert(
    rows.map((row) => ({
      tab_id: row.tab_id,
      item_id: row.item_id,
      locale: row.locale,
      source_locale: row.source_locale,
      source_snapshot_hash: row.source_snapshot_hash,
      source_updated_at: row.source_updated_at,
      translation_origin: row.translation_origin,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "tab_id,item_id,locale" },
  );
  if (error) throw error;
}

export function buildMarketExplanationFaqI18nMetaViews(args: {
  metas: MarketExplanationFaqI18nMetaRecord[];
  entries: MarketExplanationFaqEntryRecord[];
}): MarketExplanationFaqI18nMetaViewRecord[] {
  const sourceMap = new Map<string, MarketExplanationFaqItem>();
  for (const tab of MARKET_EXPLANATION_STANDARD_TABS) {
    for (const item of buildMarketExplanationFaqEffectiveGermanItems({
      tabId: tab.id,
      entries: args.entries,
    })) {
      sourceMap.set(buildEntryKey(tab.id, item.item_id), item);
    }
  }

  return args.metas.map((meta) => {
    const source = sourceMap.get(buildEntryKey(meta.tab_id, meta.item_id)) ?? {
      item_id: meta.item_id,
      question: "",
      answer: "",
      sort_order: 0,
    };
    const sourceHash = buildMarketExplanationFaqSourceSnapshotHash({
      tabId: meta.tab_id,
      itemId: meta.item_id,
      question: source.question,
      answer: source.answer,
    });
    return {
      ...meta,
      effective_source_question: source.question,
      effective_source_answer: source.answer,
      translation_is_stale:
        Boolean(meta.source_snapshot_hash) && meta.source_snapshot_hash !== sourceHash,
    };
  });
}

const loadMarketExplanationFaqLiveEntries = cache(
  async (): Promise<MarketExplanationFaqEntryRecord[]> => {
    try {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from("market_explanation_faq_entries")
        .select("tab_id, item_id, locale, status, question, answer, sort_order, updated_at")
        .eq("status", "live")
        .order("tab_id", { ascending: true })
        .order("sort_order", { ascending: true })
        .order("item_id", { ascending: true });
      if (error) throw error;

      return (data ?? []).map((row) => ({
        tab_id: normalizeMarketExplanationFaqTabId(row.tab_id),
        item_id: String(row.item_id ?? "").trim(),
        locale: String(row.locale ?? "").trim().toLowerCase(),
        status: String(row.status ?? "draft") as MarketExplanationFaqEntryStatus,
        question: String(row.question ?? ""),
        answer: String(row.answer ?? ""),
        sort_order: Number.isFinite(Number(row.sort_order)) ? Number(row.sort_order) : 0,
        updated_at: row.updated_at ? String(row.updated_at) : null,
      }));
    } catch (error) {
      if (isMissingTable(error, "market_explanation_faq_entries")) return [];
      return [];
    }
  },
);

export const getMarketExplanationFaqs = cache(
  async (locale: string | null | undefined): Promise<MarketExplanationFaqMap> => {
    const normalized = normalizePublicLocale(locale);
    const defaults = getMarketExplanationFaqDefaultMap(normalized);
    const liveEntries = await loadMarketExplanationFaqLiveEntries();

    return MARKET_EXPLANATION_STANDARD_TABS.reduce<MarketExplanationFaqMap>((acc, tab) => {
      const germanRows = liveEntries
        .filter((entry) => entry.tab_id === tab.id && entry.locale === "de")
        .sort((left, right) => left.sort_order - right.sort_order || left.item_id.localeCompare(right.item_id));
      const localizedRows = normalized === "de"
        ? germanRows
        : liveEntries
          .filter((entry) => entry.tab_id === tab.id && entry.locale === normalized)
          .sort((left, right) => left.sort_order - right.sort_order || left.item_id.localeCompare(right.item_id));

      if (germanRows.length === 0 && localizedRows.length === 0) {
        acc[tab.id] = defaults[tab.id];
        return acc;
      }

      if (normalized === "de" || germanRows.length === 0) {
        acc[tab.id] = (localizedRows.length > 0 ? localizedRows : germanRows).map((entry) => ({
          item_id: entry.item_id,
          question: entry.question,
          answer: entry.answer,
          sort_order: entry.sort_order,
        }));
        return acc;
      }

      const localizedMap = new Map(localizedRows.map((entry) => [entry.item_id, entry] as const));
      const merged = germanRows.map((source) => {
        const localized = localizedMap.get(source.item_id);
        return {
          item_id: source.item_id,
          question: localized?.question ?? source.question,
          answer: localized?.answer ?? source.answer,
          sort_order: source.sort_order,
        };
      });
      acc[tab.id] = merged;
      return acc;
    }, {} as MarketExplanationFaqMap);
  },
);
