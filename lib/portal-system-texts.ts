import { cache } from "react";

import { getPortalSystemTextDefaultMap, type PortalSystemTextMap } from "@/lib/portal-system-text-definitions";
import { normalizePublicLocale } from "@/lib/public-locale-routing";
import { createAdminClient } from "@/utils/supabase/admin";

function isMissingTable(error: unknown, table: string): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return msg.includes(`public.${table}`) && msg.includes("does not exist");
}

const loadPortalSystemTextLiveEntries = cache(async (): Promise<Map<string, Partial<PortalSystemTextMap>>> => {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("portal_system_text_entries")
      .select("key, locale, value_text")
      .eq("status", "live");
    if (error) throw error;

    const map = new Map<string, Partial<PortalSystemTextMap>>();
    for (const row of data ?? []) {
      const locale = String(row.locale ?? "").trim().toLowerCase();
      const key = String(row.key ?? "").trim();
      if (!locale || !key) continue;
      const current = map.get(locale) ?? {};
      current[key as keyof PortalSystemTextMap] = String(row.value_text ?? "");
      map.set(locale, current);
    }
    return map;
  } catch (error) {
    if (isMissingTable(error, "portal_system_text_entries")) {
      return new Map();
    }
    return new Map();
  }
});

export const getPortalSystemTexts = cache(async (locale: string | null | undefined): Promise<PortalSystemTextMap> => {
  const normalized = normalizePublicLocale(locale);
  const base = {
    ...getPortalSystemTextDefaultMap("de"),
    ...getPortalSystemTextDefaultMap(normalized),
  };
  const liveEntries = await loadPortalSystemTextLiveEntries();
  const localizedEntries = liveEntries.get(normalized) ?? {};
  return {
    ...base,
    ...localizedEntries,
  };
});
