import { cache } from "react";

import {
  getMarketExplanationStaticTextDefaultMap,
  type MarketExplanationStaticTextMap,
} from "@/lib/market-explanation-static-text-definitions";
import { normalizePublicLocale } from "@/lib/public-locale-routing";
import { createAdminClient } from "@/utils/supabase/admin";

function isMissingTable(error: unknown, table: string): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return msg.includes(`public.${table}`) && msg.includes("does not exist");
}

const loadMarketExplanationStaticLiveEntries = cache(
  async (): Promise<Map<string, Partial<MarketExplanationStaticTextMap>>> => {
    try {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from("market_explanation_static_text_entries")
        .select("key, locale, value_text")
        .eq("status", "live");
      if (error) throw error;

      const map = new Map<string, Partial<MarketExplanationStaticTextMap>>();
      for (const row of data ?? []) {
        const locale = String(row.locale ?? "").trim().toLowerCase();
        const key = String(row.key ?? "").trim();
        if (!locale || !key) continue;
        const current = map.get(locale) ?? {};
        current[key as keyof MarketExplanationStaticTextMap] = String(row.value_text ?? "");
        map.set(locale, current);
      }
      return map;
    } catch (error) {
      if (isMissingTable(error, "market_explanation_static_text_entries")) {
        return new Map();
      }
      return new Map();
    }
  },
);

export const getMarketExplanationStaticTexts = cache(
  async (locale: string | null | undefined): Promise<MarketExplanationStaticTextMap> => {
    const normalized = normalizePublicLocale(locale);
    const base = {
      ...getMarketExplanationStaticTextDefaultMap("de"),
      ...getMarketExplanationStaticTextDefaultMap(normalized),
    };
    const liveEntries = await loadMarketExplanationStaticLiveEntries();
    const germanEntries = liveEntries.get("de") ?? {};
    const localizedEntries = liveEntries.get(normalized) ?? {};
    return {
      ...base,
      ...germanEntries,
      ...localizedEntries,
    };
  },
);
