import { getBookingByIdForPortalPartner } from "@/lib/network-partners/repositories/bookings";
import { getContentByIdForPortalPartner, getContentByIdForNetworkPartner } from "@/lib/network-partners/repositories/content";
import { createAdminClient } from "@/utils/supabase/admin";
import type {
  NetworkContentRecord,
  NetworkContentTranslationRecord,
  NetworkContentTranslationStatus,
  NetworkContentTranslationView,
} from "@/lib/network-partners/types";

function asText(value: unknown): string {
  return String(value ?? "").trim();
}

function asNullableText(value: unknown): string | null {
  const normalized = asText(value);
  return normalized.length > 0 ? normalized : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asRowArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord);
}

export function hashNetworkContentSource(content: Pick<NetworkContentRecord, "title" | "summary" | "body_md" | "cta_label" | "cta_url" | "primary_locale">): string {
  const raw = JSON.stringify({
    title: asText(content.title),
    summary: asNullableText(content.summary),
    body_md: asNullableText(content.body_md),
    cta_label: asNullableText(content.cta_label),
    cta_url: asNullableText(content.cta_url),
    primary_locale: asText(content.primary_locale).toLowerCase() || "de",
  });
  let hash = 2166136261;
  for (let index = 0; index < raw.length; index += 1) {
    hash ^= raw.charCodeAt(index);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return `fnv1a32_${(hash >>> 0).toString(16)}`;
}

function normalizeTranslationStatus(value: unknown): NetworkContentTranslationStatus {
  const normalized = asText(value);
  if (normalized === "reviewed" || normalized === "edited" || normalized === "stale") {
    return normalized;
  }
  return "machine_generated";
}

function mapTranslationRow(row: Record<string, unknown>): NetworkContentTranslationRecord {
  return {
    id: asText(row.id),
    content_item_id: asText(row.content_item_id),
    locale: asText(row.locale).toLowerCase(),
    status: normalizeTranslationStatus(row.status),
    translated_title: asNullableText(row.translated_title),
    translated_summary: asNullableText(row.translated_summary),
    translated_body_md: asNullableText(row.translated_body_md),
    source_snapshot_hash: asNullableText(row.source_snapshot_hash),
    updated_at: asText(row.updated_at),
  };
}

function normalizeLocaleList(locales: string[]): string[] {
  return Array.from(
    new Set(
      (locales ?? [])
        .map((locale) => asText(locale).toLowerCase())
        .filter(Boolean),
    ),
  );
}

export async function listNetworkContentTranslations(
  contentItemId: string,
): Promise<NetworkContentTranslationRecord[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("network_content_i18n")
    .select("id, content_item_id, locale, status, translated_title, translated_summary, translated_body_md, source_snapshot_hash, updated_at")
    .eq("content_item_id", contentItemId)
    .order("locale", { ascending: true });

  if (error) throw new Error(error.message ?? "NETWORK_CONTENT_TRANSLATIONS_LIST_FAILED");
  return asRowArray(data).map((row) => mapTranslationRow(row));
}

export async function listNetworkContentTranslationsForPortalPartner(args: {
  contentItemId: string;
  portalPartnerId: string;
}): Promise<{
  content: NetworkContentRecord;
  required_locales: string[];
  source_snapshot_hash: string;
  translations: NetworkContentTranslationView[];
}> {
  const content = await getContentByIdForPortalPartner(args.contentItemId, args.portalPartnerId);
  if (!content) throw new Error("NOT_FOUND");

  const booking = await getBookingByIdForPortalPartner(content.booking_id, args.portalPartnerId);
  if (!booking) throw new Error("BOOKING_NOT_FOUND");

  const requiredLocales = normalizeLocaleList(booking.required_locales);
  const sourceHash = hashNetworkContentSource(content);
  const rows = await listNetworkContentTranslations(content.id);
  const rowMap = new Map(rows.map((row) => [row.locale, row]));
  const localesToRender = normalizeLocaleList([...requiredLocales, ...rows.map((row) => row.locale)]);

  const translations = localesToRender.map((locale) => {
    const row = rowMap.get(locale);
    const status = row?.status ?? "stale";
    return {
      id: row?.id ?? "",
      content_item_id: content.id,
      locale,
      status,
      translated_title: row?.translated_title ?? null,
      translated_summary: row?.translated_summary ?? null,
      translated_body_md: row?.translated_body_md ?? null,
      source_snapshot_hash: row?.source_snapshot_hash ?? null,
      updated_at: row?.updated_at ?? "",
      is_required: requiredLocales.includes(locale),
      is_stale: locale !== "de" && ((row?.source_snapshot_hash ?? null) !== sourceHash || status === "stale"),
    };
  });

  return {
    content,
    required_locales: requiredLocales,
    source_snapshot_hash: sourceHash,
    translations,
  };
}

export async function listNetworkContentTranslationsForNetworkPartner(args: {
  contentItemId: string;
  networkPartnerId: string;
}): Promise<{
  content: NetworkContentRecord;
  required_locales: string[];
  source_snapshot_hash: string;
  translations: NetworkContentTranslationView[];
}> {
  const content = await getContentByIdForNetworkPartner(args.contentItemId, args.networkPartnerId);
  if (!content) throw new Error("NOT_FOUND");

  const booking = await getBookingByIdForPortalPartner(content.booking_id, content.portal_partner_id);
  if (!booking) throw new Error("BOOKING_NOT_FOUND");

  const requiredLocales = normalizeLocaleList(booking.required_locales);
  const sourceHash = hashNetworkContentSource(content);
  const rows = await listNetworkContentTranslations(content.id);
  const rowMap = new Map(rows.map((row) => [row.locale, row]));
  const localesToRender = normalizeLocaleList([...requiredLocales, ...rows.map((row) => row.locale)]);

  const translations = localesToRender.map((locale) => {
    const row = rowMap.get(locale);
    const status = row?.status ?? "stale";
    return {
      id: row?.id ?? "",
      content_item_id: content.id,
      locale,
      status,
      translated_title: row?.translated_title ?? null,
      translated_summary: row?.translated_summary ?? null,
      translated_body_md: row?.translated_body_md ?? null,
      source_snapshot_hash: row?.source_snapshot_hash ?? null,
      updated_at: row?.updated_at ?? "",
      is_required: requiredLocales.includes(locale),
      is_stale: locale !== "de" && ((row?.source_snapshot_hash ?? null) !== sourceHash || status === "stale"),
    };
  });

  return {
    content,
    required_locales: requiredLocales,
    source_snapshot_hash: sourceHash,
    translations,
  };
}

export async function upsertNetworkContentTranslation(args: {
  contentItemId: string;
  portalPartnerId: string;
  locale: string;
  translated_title?: string | null;
  translated_summary?: string | null;
  translated_body_md?: string | null;
  status: NetworkContentTranslationStatus;
}) {
  const resolved = await listNetworkContentTranslationsForPortalPartner({
    contentItemId: args.contentItemId,
    portalPartnerId: args.portalPartnerId,
  });
  const locale = asText(args.locale).toLowerCase();
  if (!locale || locale === "de") {
    throw new Error("INVALID_TRANSLATION_LOCALE");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("network_content_i18n")
    .upsert({
      content_item_id: resolved.content.id,
      locale,
      status: args.status,
      translated_title: asNullableText(args.translated_title),
      translated_summary: asNullableText(args.translated_summary),
      translated_body_md: asNullableText(args.translated_body_md),
      source_snapshot_hash: resolved.source_snapshot_hash,
    }, { onConflict: "content_item_id,locale" });

  if (error) throw new Error(error.message ?? "NETWORK_CONTENT_TRANSLATION_UPSERT_FAILED");
}

export async function upsertNetworkContentTranslationForNetworkPartner(args: {
  contentItemId: string;
  networkPartnerId: string;
  locale: string;
  translated_title?: string | null;
  translated_summary?: string | null;
  translated_body_md?: string | null;
  status: NetworkContentTranslationStatus;
}) {
  const resolved = await listNetworkContentTranslationsForNetworkPartner({
    contentItemId: args.contentItemId,
    networkPartnerId: args.networkPartnerId,
  });
  const locale = asText(args.locale).toLowerCase();
  if (!locale || locale === "de") {
    throw new Error("INVALID_TRANSLATION_LOCALE");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("network_content_i18n")
    .upsert({
      content_item_id: resolved.content.id,
      locale,
      status: args.status,
      translated_title: asNullableText(args.translated_title),
      translated_summary: asNullableText(args.translated_summary),
      translated_body_md: asNullableText(args.translated_body_md),
      source_snapshot_hash: resolved.source_snapshot_hash,
    }, { onConflict: "content_item_id,locale" });

  if (error) throw new Error(error.message ?? "NETWORK_CONTENT_TRANSLATION_UPSERT_FAILED");
}

export async function markNetworkContentTranslationsStaleIfSourceChanged(args: {
  content: NetworkContentRecord;
  previousSourceHash: string;
}) {
  const nextHash = hashNetworkContentSource(args.content);
  if (nextHash === args.previousSourceHash) return;

  const admin = createAdminClient();
  const { error } = await admin
    .from("network_content_i18n")
    .update({ status: "stale" })
    .eq("content_item_id", args.content.id)
    .neq("locale", args.content.primary_locale || "de");

  if (error) throw new Error(error.message ?? "NETWORK_CONTENT_TRANSLATIONS_STALE_UPDATE_FAILED");
}

function buildMockTranslation(locale: string, sourceText: string | null): string | null {
  const text = asNullableText(sourceText);
  if (!text) return null;
  return `[${locale.toUpperCase()} AUTO] ${text}`;
}

export async function autoPrefillNetworkContentTranslations(args: {
  contentItemId: string;
  portalPartnerId: string;
  locales?: string[];
}) {
  const resolved = await listNetworkContentTranslationsForPortalPartner({
    contentItemId: args.contentItemId,
    portalPartnerId: args.portalPartnerId,
  });

  if (resolved.content.content_type !== "property_offer" && resolved.content.content_type !== "property_request") {
    throw new Error("AUTO_TRANSLATION_NOT_SUPPORTED");
  }

  const targetLocales = normalizeLocaleList(args.locales && args.locales.length > 0 ? args.locales : resolved.required_locales)
    .filter((locale) => locale !== "de");

  for (const locale of targetLocales) {
    await upsertNetworkContentTranslation({
      contentItemId: resolved.content.id,
      portalPartnerId: args.portalPartnerId,
      locale,
      translated_title: buildMockTranslation(locale, resolved.content.title),
      translated_summary: buildMockTranslation(locale, resolved.content.summary),
      translated_body_md: buildMockTranslation(locale, resolved.content.body_md),
      status: "machine_generated",
    });
  }
}

export async function autoPrefillNetworkContentTranslationsForNetworkPartner(args: {
  contentItemId: string;
  networkPartnerId: string;
  locales?: string[];
}) {
  const resolved = await listNetworkContentTranslationsForNetworkPartner({
    contentItemId: args.contentItemId,
    networkPartnerId: args.networkPartnerId,
  });

  if (resolved.content.content_type !== "property_offer" && resolved.content.content_type !== "property_request") {
    throw new Error("AUTO_TRANSLATION_NOT_SUPPORTED");
  }

  const targetLocales = normalizeLocaleList(args.locales && args.locales.length > 0 ? args.locales : resolved.required_locales)
    .filter((locale) => locale !== "de");

  for (const locale of targetLocales) {
    await upsertNetworkContentTranslationForNetworkPartner({
      contentItemId: resolved.content.id,
      networkPartnerId: args.networkPartnerId,
      locale,
      translated_title: buildMockTranslation(locale, resolved.content.title),
      translated_summary: buildMockTranslation(locale, resolved.content.summary),
      translated_body_md: buildMockTranslation(locale, resolved.content.body_md),
      status: "machine_generated",
    });
  }
}

export async function assertNetworkContentRequiredLocalesSatisfied(args: {
  contentItemId: string;
  portalPartnerId: string;
}) {
  const resolved = await listNetworkContentTranslationsForPortalPartner({
    contentItemId: args.contentItemId,
    portalPartnerId: args.portalPartnerId,
  });

  const missingLocales = resolved.required_locales.filter((locale) => {
    if (locale === "de") return false;
    const row = resolved.translations.find((entry) => entry.locale === locale);
    if (!row) return true;
    const hasContent = Boolean(
      asNullableText(row.translated_title)
      || asNullableText(row.translated_summary)
      || asNullableText(row.translated_body_md),
    );
    return !hasContent || row.is_stale;
  });

  if (missingLocales.length > 0) {
    throw new Error(`MISSING_REQUIRED_TRANSLATIONS:${missingLocales.join(",")}`);
  }
}
