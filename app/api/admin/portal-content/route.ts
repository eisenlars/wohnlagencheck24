import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/security/admin-auth";
import { checkAdminApiRateLimit } from "@/lib/security/rate-limit";
import {
  buildPortalCmsSourceSnapshotHash,
  buildPortalContentI18nMetaViews,
  loadPortalContentI18nMeta,
  upsertPortalContentI18nMeta,
  type PortalContentI18nMetaViewRecord,
} from "@/lib/portal-cms-i18n-meta";
import {
  DEFAULT_PORTAL_LOCALES,
  getPortalCmsPage,
  getPortalCmsPages,
  getPortalCmsSection,
  type PortalContentEntryRecord,
  type PortalContentEntryStatus,
  type PortalLocaleConfigRecord,
  type PortalLocaleStatus,
} from "@/lib/portal-cms";
import { createAdminClient } from "@/utils/supabase/admin";

type PortalLocaleConfigInput = {
  locale?: unknown;
  status?: unknown;
  partner_bookable?: unknown;
  is_active?: unknown;
};

type PortalContentEntryInput = {
  page_key?: unknown;
  section_key?: unknown;
  locale?: unknown;
  status?: unknown;
  fields_json?: unknown;
};

type Body = {
  locale_configs?: PortalLocaleConfigInput[];
  entries?: PortalContentEntryInput[];
};

function isMissingTable(error: unknown, table: string): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return msg.includes(`public.${table}`) && msg.includes("does not exist");
}

function asText(value: unknown): string {
  return String(value ?? "").trim();
}

function asBool(value: unknown): boolean {
  return value === true;
}

function normalizeLocaleStatus(value: unknown): PortalLocaleStatus {
  const normalized = asText(value).toLowerCase();
  if (normalized === "internal" || normalized === "live") return normalized;
  return "planned";
}

function normalizeContentStatus(value: unknown): PortalContentEntryStatus {
  const normalized = asText(value).toLowerCase();
  if (normalized === "internal" || normalized === "live") return normalized;
  return "draft";
}

function sanitizeFields(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>((acc, [key, fieldValue]) => {
    acc[String(key)] = String(fieldValue ?? "");
    return acc;
  }, {});
}

async function loadPortalContent(admin: ReturnType<typeof createAdminClient>) {
  const [localeRes, contentRes, metaRes] = await Promise.all([
    admin
      .from("portal_locale_config")
      .select("locale, status, partner_bookable, is_active, updated_at")
      .order("locale", { ascending: true }),
    admin
      .from("portal_content_entries")
      .select("page_key, section_key, locale, status, fields_json, updated_at")
      .order("page_key", { ascending: true })
      .order("section_key", { ascending: true })
      .order("locale", { ascending: true }),
    loadPortalContentI18nMeta(admin),
  ]);

  if (localeRes.error) throw localeRes.error;
  if (contentRes.error) throw contentRes.error;

  const locales = Array.isArray(localeRes.data) && localeRes.data.length > 0
    ? (localeRes.data as PortalLocaleConfigRecord[])
    : DEFAULT_PORTAL_LOCALES;

  const entries: PortalContentEntryRecord[] = (contentRes.data ?? []).map((row) => ({
    page_key: String(row.page_key ?? ""),
    section_key: String(row.section_key ?? ""),
    locale: String(row.locale ?? ""),
    status: normalizeContentStatus(row.status),
    fields_json: sanitizeFields(row.fields_json),
    updated_at: row.updated_at ?? null,
  }));
  const metas: PortalContentI18nMetaViewRecord[] = buildPortalContentI18nMetaViews({
    metas: metaRes,
    entries,
  });

  return {
    locales,
    pages: getPortalCmsPages(),
    entries,
    metas,
  };
}

export async function GET(req: Request) {
  try {
    const adminUser = await requireAdmin(["admin_super", "admin_ops"]);
    const limit = await checkAdminApiRateLimit(req, adminUser.userId);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } });
    }

    const admin = createAdminClient();
    const payload = await loadPortalContent(admin);
    return NextResponse.json({ ok: true, ...payload });
  } catch (error) {
    if (isMissingTable(error, "portal_locale_config") || isMissingTable(error, "portal_content_entries")) {
      return NextResponse.json({ error: "Portal-CMS-Tabellen fehlen. Bitte `docs/sql/portal_cms.sql` ausführen." }, { status: 409 });
    }
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

    if (Array.isArray(body.locale_configs) && body.locale_configs.length > 0) {
      const localeRows = body.locale_configs.map((row) => {
        const locale = asText(row.locale).toLowerCase();
        if (!locale) throw new Error("Locale-Konfiguration benötigt einen Locale-Code.");
        return {
          locale,
          status: normalizeLocaleStatus(row.status),
          partner_bookable: asBool(row.partner_bookable),
          is_active: asBool(row.is_active),
          updated_at: new Date().toISOString(),
        };
      });
      const { error } = await admin.from("portal_locale_config").upsert(localeRows, { onConflict: "locale" });
      if (error) throw error;
    }

    if (Array.isArray(body.entries) && body.entries.length > 0) {
      const entryRows = body.entries.map((row) => {
        const pageKey = asText(row.page_key);
        const sectionKey = asText(row.section_key);
        const locale = asText(row.locale).toLowerCase();
        const page = getPortalCmsPage(pageKey);
        const section = getPortalCmsSection(pageKey, sectionKey);
        if (!page || !section) {
          throw new Error(`Unbekannter Portal-CMS-Bereich: ${pageKey}/${sectionKey}`);
        }
        if (!locale) throw new Error(`Portal-CMS-Eintrag für ${pageKey}/${sectionKey} benötigt eine Locale.`);

        const rawFields = sanitizeFields(row.fields_json);
        const allowedKeys = new Set(section.fields.map((field) => field.key));
        const fieldsJson = Object.entries(rawFields).reduce<Record<string, string>>((acc, [key, value]) => {
          if (!allowedKeys.has(key)) return acc;
          acc[key] = value;
          return acc;
        }, {});

        return {
          page_key: pageKey,
          section_key: sectionKey,
          locale,
          status: normalizeContentStatus(row.status),
          fields_json: fieldsJson,
          updated_at: new Date().toISOString(),
        };
      });

      const { error } = await admin.from("portal_content_entries").upsert(entryRows, {
        onConflict: "page_key,section_key,locale",
      });
      if (error) throw error;

      const translatedRows = entryRows.filter((row) => row.locale !== "de");
      if (translatedRows.length > 0) {
        const sourcePages = Array.from(new Set(translatedRows.map((row) => row.page_key)));
        const sourceRes = await admin
          .from("portal_content_entries")
          .select("page_key, section_key, locale, status, fields_json, updated_at")
          .in("page_key", sourcePages)
          .eq("locale", "de");
        if (sourceRes.error) throw sourceRes.error;
        const sourceMap = new Map(
          (sourceRes.data ?? []).map((row) => {
            const entry: PortalContentEntryRecord = {
              page_key: String(row.page_key ?? ""),
              section_key: String(row.section_key ?? ""),
              locale: String(row.locale ?? ""),
              status: normalizeContentStatus(row.status),
              fields_json: sanitizeFields(row.fields_json),
              updated_at: row.updated_at ?? null,
            };
            return [`${entry.page_key}::${entry.section_key}`, entry] as const;
          }),
        );
        await upsertPortalContentI18nMeta(admin, translatedRows.map((row) => {
          const sourceEntry = sourceMap.get(`${row.page_key}::${row.section_key}`);
          return {
            page_key: row.page_key,
            section_key: row.section_key,
            locale: row.locale,
            source_locale: "de",
            source_snapshot_hash: sourceEntry
              ? buildPortalCmsSourceSnapshotHash({
                  pageKey: row.page_key,
                  sectionKey: row.section_key,
                  fieldsJson: sourceEntry.fields_json,
                })
              : null,
            source_updated_at: sourceEntry?.updated_at ?? null,
            translation_origin: "manual" as const,
          };
        }));
      }
    }

    const payload = await loadPortalContent(admin);
    return NextResponse.json({ ok: true, ...payload });
  } catch (error) {
    if (isMissingTable(error, "portal_locale_config") || isMissingTable(error, "portal_content_entries")) {
      return NextResponse.json({ error: "Portal-CMS-Tabellen fehlen. Bitte `docs/sql/portal_cms.sql` ausführen." }, { status: 409 });
    }
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
