import { createAdminClient } from "@/utils/supabase/admin";

function isMissingTable(error: unknown, table: string): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return msg.includes(`public.${table}`) && msg.includes("does not exist");
}

export async function loadPublicLivePortalLocales(): Promise<Set<string>> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("portal_locale_config")
      .select("locale")
      .eq("is_active", true)
      .eq("status", "live");
    if (error) throw error;
    const locales = new Set(
      (data ?? [])
        .map((row) => String(row.locale ?? "").trim().toLowerCase())
        .filter(Boolean),
    );
    if (locales.size === 0) locales.add("de");
    return locales;
  } catch (error) {
    if (isMissingTable(error, "portal_locale_config")) {
      return new Set(["de"]);
    }
    return new Set(["de"]);
  }
}

export async function isPublicPortalLocaleLive(locale: string): Promise<boolean> {
  const locales = await loadPublicLivePortalLocales();
  return locales.has(String(locale ?? "").trim().toLowerCase());
}
