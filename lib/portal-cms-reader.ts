import {
  migratePortalContentWraps,
  parsePortalContentWraps,
  type PortalContentEntryRecord,
  type PortalContentSectionDefinition,
  type PortalContentWrap,
} from "@/lib/portal-cms";
import { createAdminClient } from "@/utils/supabase/admin";

function isMissingTable(error: unknown, table: string): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return msg.includes(`public.${table}`) && msg.includes("does not exist");
}

export async function loadPortalCmsEntriesByPage(pageKey: string, locale = "de"): Promise<Map<string, PortalContentEntryRecord>> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("portal_content_entries")
      .select("page_key, section_key, locale, status, fields_json, updated_at")
      .eq("page_key", pageKey)
      .eq("locale", locale)
      .eq("status", "live");

    if (error) throw error;

    return new Map(
      (data ?? []).map((row) => [
        String(row.section_key ?? ""),
        ({
          page_key: String(row.page_key ?? ""),
          section_key: String(row.section_key ?? ""),
          locale: String(row.locale ?? locale),
          status: String(row.status ?? "draft") as PortalContentEntryRecord["status"],
          fields_json: Object.entries((row.fields_json ?? {}) as Record<string, unknown>).reduce<Record<string, string>>((acc, [key, value]) => {
            acc[key] = String(value ?? "");
            return acc;
          }, {}),
          updated_at: row.updated_at ?? null,
        } as PortalContentEntryRecord),
      ]),
    );
  } catch (error) {
    if (isMissingTable(error, "portal_content_entries")) return new Map();
    return new Map();
  }
}

export function resolvePortalCmsField(
  entries: Map<string, PortalContentEntryRecord>,
  section: Pick<PortalContentSectionDefinition, "section_key"> | string,
  fieldKey: string,
  fallback: string,
): string {
  const sectionKey = typeof section === "string" ? section : section.section_key;
  const rawValue = entries.get(sectionKey)?.fields_json?.[fieldKey];
  const value = String(rawValue ?? "").trim();
  return value.length > 0 ? value : fallback;
}

export function resolvePortalCmsWraps(
  entries: Map<string, PortalContentEntryRecord>,
  pageKey: string,
  section: Pick<PortalContentSectionDefinition, "section_key"> | string,
  fieldKey = "wraps",
): PortalContentWrap[] {
  const sectionKey = typeof section === "string" ? section : section.section_key;
  const rawValue = entries.get(sectionKey)?.fields_json?.[fieldKey];
  const raw = String(rawValue ?? "").trim();
  if (raw) {
    return parsePortalContentWraps(raw);
  }
  return migratePortalContentWraps(
    pageKey,
    Array.from(entries.values()).filter((entry) => entry.page_key === pageKey),
  );
}
