import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

import { createAdminClient } from "@/utils/supabase/admin";
import { loadPortalLocaleRegistry, normalizePortalLocaleCode } from "@/lib/portal-locale-registry";
import { loadPartnerLocaleAvailabilitySnapshot } from "@/lib/partner-locale-availability";
import { requireAdmin } from "@/lib/security/admin-auth";
import { writeSecurityAuditLog } from "@/lib/security/audit-log";
import { checkAdminApiRateLimit, extractClientIpFromHeaders } from "@/lib/security/rate-limit";
import { publishVisibilityIndex } from "@/lib/visibility-index";
import { sendPartnerAreaAssignedEmail } from "@/lib/notifications/admin-review-email";

type HandoverBody = {
  area_id?: string;
  old_partner_id?: string;
  new_partner_id?: string;
  transfer_mode?: "base_reset" | "copy_partner_state";
  include_report_customization?: boolean;
  include_seo_geo?: boolean;
  blog_transfer_mode?: "keep_old_partner" | "copy_as_draft" | "copy_as_is";
  locale_modes?: Record<string, "skip" | "copy_disabled" | "copy_and_enable">;
};

type TransferMode = "base_reset" | "copy_partner_state";
type LocaleTransferMode = "skip" | "copy_disabled" | "copy_and_enable";
type BlogTransferMode = "keep_old_partner" | "copy_as_draft" | "copy_as_is";

function normalize(value: unknown): string {
  return String(value ?? "").trim();
}

function isKreisAreaId(areaId: string): boolean {
  const parts = areaId.split("-").filter((p) => p.length > 0);
  return parts.length === 3;
}

function isMissingActivationStatusColumn(error: unknown): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return (
    msg.includes("partner_area_map.activation_status") && msg.includes("does not exist")
  ) || (
    msg.includes("partner_area_map.is_public_live") && msg.includes("does not exist")
  );
}

function isMissingTable(error: unknown, table: string): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return msg.includes(table.toLowerCase()) && msg.includes("does not exist");
}

function normalizeTransferMode(value: unknown): TransferMode {
  return String(value ?? "").trim().toLowerCase() === "copy_partner_state"
    ? "copy_partner_state"
    : "base_reset";
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeBlogTransferMode(value: unknown): BlogTransferMode {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "copy_as_draft") return "copy_as_draft";
  if (normalized === "copy_as_is") return "copy_as_is";
  return "keep_old_partner";
}

function normalizeLocaleTransferMode(value: unknown): LocaleTransferMode {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "copy_and_enable") return "copy_and_enable";
  if (normalized === "copy_disabled") return "copy_disabled";
  return "skip";
}

async function resolveTransferAreaIds(
  admin: ReturnType<typeof createAdminClient>,
  areaId: string,
): Promise<string[]> {
  const { data: kreisArea, error: kreisError } = await admin
    .from("areas")
    .select("id, slug, bundesland_slug")
    .eq("id", areaId)
    .maybeSingle();
  if (kreisError || !kreisArea) return [areaId];

  const kreisSlug = String((kreisArea as { slug?: string | null }).slug ?? "").trim();
  const bundeslandSlug = String((kreisArea as { bundesland_slug?: string | null }).bundesland_slug ?? "").trim();
  if (!kreisSlug || !bundeslandSlug) return [areaId];

  const { data: childAreas, error: childError } = await admin
    .from("areas")
    .select("id, parent_slug")
    .eq("bundesland_slug", bundeslandSlug);
  if (childError) return [areaId];

  const childIds = (childAreas ?? [])
    .filter((row) => {
      const id = String((row as { id?: string | null }).id ?? "").trim();
      const parentSlug = String((row as { parent_slug?: string | null }).parent_slug ?? "").trim();
      if (!id) return false;
      return parentSlug === kreisSlug || id.startsWith(`${areaId}-`);
    })
    .map((row) => String((row as { id?: string | null }).id ?? "").trim())
    .filter((id) => id.length > 0);

  return Array.from(
    new Set([
      areaId,
      ...childIds,
    ]),
  );
}

export async function POST(req: Request) {
  try {
    const adminUser = await requireAdmin(["admin_super", "admin_ops"]);
    const adminRate = await checkAdminApiRateLimit(req, adminUser.userId);
    if (!adminRate.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(adminRate.retryAfterSec) } },
      );
    }

    const body = (await req.json()) as HandoverBody;
    const areaId = normalize(body.area_id);
    const oldPartnerId = normalize(body.old_partner_id);
    const newPartnerId = normalize(body.new_partner_id);
    const transferMode = normalizeTransferMode(body.transfer_mode);
    const includeReportCustomization = normalizeBoolean(
      body.include_report_customization,
      transferMode === "copy_partner_state",
    );
    const includeSeoGeo = normalizeBoolean(
      body.include_seo_geo,
      transferMode === "copy_partner_state",
    );
    const blogTransferMode = normalizeBlogTransferMode(
      body.blog_transfer_mode ?? (transferMode === "copy_partner_state" ? "copy_as_draft" : "keep_old_partner"),
    );
    const deactivateOldIntegrations = true;

    if (!areaId || !oldPartnerId || !newPartnerId) {
      return NextResponse.json(
        { error: "Missing required fields: area_id, old_partner_id, new_partner_id" },
        { status: 400 },
      );
    }
    if (oldPartnerId === newPartnerId) {
      return NextResponse.json(
        { error: "old_partner_id and new_partner_id must be different" },
        { status: 400 },
      );
    }
    if (!isKreisAreaId(areaId)) {
      return NextResponse.json({ error: "Only kreis area_id is allowed" }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: partners, error: partnersError } = await admin
      .from("partners")
      .select("id, company_name")
      .in("id", [oldPartnerId, newPartnerId]);
    if (partnersError) return NextResponse.json({ error: partnersError.message }, { status: 500 });

    const oldPartner = (partners ?? []).find((p) => String(p.id) === oldPartnerId);
    const newPartner = (partners ?? []).find((p) => String(p.id) === newPartnerId);
    if (!oldPartner) return NextResponse.json({ error: "Old partner not found" }, { status: 404 });
    if (!newPartner) return NextResponse.json({ error: "New partner not found" }, { status: 404 });

    const { data: areaExists, error: areaError } = await admin
      .from("areas")
      .select("id, name, slug, bundesland_slug")
      .eq("id", areaId)
      .maybeSingle();
    if (areaError) return NextResponse.json({ error: areaError.message }, { status: 500 });
    if (!areaExists) return NextResponse.json({ error: "Area not found" }, { status: 404 });
    const transferAreaIds = await resolveTransferAreaIds(admin, areaId);

    const { data: existingMappings, error: existingMappingsError } = await admin
      .from("partner_area_map")
      .select("id, auth_user_id, area_id")
      .in("area_id", transferAreaIds);
    if (existingMappingsError) return NextResponse.json({ error: existingMappingsError.message }, { status: 500 });

    const conflictingRows = (existingMappings ?? []).filter((row) => {
      const ownerId = String(row.auth_user_id ?? "").trim();
      return ownerId !== oldPartnerId && ownerId !== newPartnerId;
    });
    if (conflictingRows.length > 0) {
      const blockedAreaIds = Array.from(
        new Set(conflictingRows.map((row) => String(row.area_id ?? "").trim()).filter((id) => id.length > 0)),
      );
      return NextResponse.json(
        { error: "Area already has another operational owner", blocked_area_ids: blockedAreaIds },
        { status: 409 },
      );
    }

    await writeSecurityAuditLog({
      actorUserId: adminUser.userId,
      actorRole: adminUser.role,
      eventType: "other",
      entityType: "other",
      entityId: areaId,
      payload: {
        action: "handover_start",
        area_id: areaId,
        transferred_area_ids: transferAreaIds,
        transferred_area_count: transferAreaIds.length,
        old_partner_id: oldPartnerId,
        new_partner_id: newPartnerId,
        transfer_mode: transferMode,
        include_report_customization: includeReportCustomization,
        include_seo_geo: includeSeoGeo,
        blog_transfer_mode: blogTransferMode,
      },
      ip: extractClientIpFromHeaders(req.headers),
      userAgent: req.headers.get("user-agent"),
    });

    if (deactivateOldIntegrations) {
      const { error: deactivateIntegrationsError } = await admin
        .from("partner_integrations")
        .update({ is_active: false })
        .eq("partner_id", oldPartnerId)
        .eq("is_active", true);
      if (deactivateIntegrationsError) {
        return NextResponse.json({ error: deactivateIntegrationsError.message }, { status: 500 });
      }
    }

    const localeRegistry = await loadPortalLocaleRegistry();
    const localeConfigByCode = new Map(
      localeRegistry.map((row) => [normalizePortalLocaleCode(row.locale), row] as const),
    );
    const oldLocaleSnapshot = await loadPartnerLocaleAvailabilitySnapshot(oldPartnerId);
    const managedLocaleModes = new Map<string, LocaleTransferMode>();
    for (const locale of oldLocaleSnapshot.available_locales) {
      const normalizedLocale = normalizePortalLocaleCode(locale);
      if (!normalizedLocale || normalizedLocale === "de") continue;
      managedLocaleModes.set(normalizedLocale, "copy_and_enable");
    }
    for (const [rawLocale, rawMode] of Object.entries(body.locale_modes ?? {})) {
      const locale = normalizePortalLocaleCode(rawLocale);
      if (!locale || locale === "de") continue;
      managedLocaleModes.set(locale, normalizeLocaleTransferMode(rawMode));
    }
    const managedLocales = Array.from(managedLocaleModes.keys());

    const deleteRowsByArea = async (table: string, partnerColumn: string) => {
      const { error } = await admin
        .from(table)
        .delete()
        .eq(partnerColumn, newPartnerId)
        .in("area_id", transferAreaIds);
      if (error && !isMissingTable(error, table)) {
        throw new Error(error.message);
      }
    };

    const deletePartnerTextsI18nByChannels = async (channels: string[], locales?: string[]) => {
      if (channels.length === 0) return;
      let query = admin
        .from("partner_texts_i18n")
        .delete()
        .eq("partner_id", newPartnerId)
        .in("area_id", transferAreaIds)
        .in("channel", channels);
      if (Array.isArray(locales) && locales.length > 0) {
        query = query.in("target_locale", locales);
      }
      const { error } = await query;
      if (error && !isMissingTable(error, "partner_texts_i18n")) {
        throw new Error(error.message);
      }
    };

    const copyPartnerTextsI18nByChannels = async (channels: string[], locales: string[]) => {
      if (channels.length === 0 || locales.length === 0) return 0;
      const { data, error } = await admin
        .from("partner_texts_i18n")
        .select("area_id, section_key, channel, target_locale, translated_content, status, source_snapshot_hash, source_last_updated, created_at, updated_at")
        .eq("partner_id", oldPartnerId)
        .in("area_id", transferAreaIds)
        .in("channel", channels)
        .in("target_locale", locales);
      if (error) {
        if (isMissingTable(error, "partner_texts_i18n")) return 0;
        throw new Error(error.message);
      }
      const rows = Array.isArray(data) ? data : [];
      if (rows.length === 0) return 0;
      const payload = rows.map((row) => ({
        ...(row as Record<string, unknown>),
        partner_id: newPartnerId,
      }));
      const { error: upsertError } = await admin
        .from("partner_texts_i18n")
        .upsert(payload, { onConflict: "partner_id,area_id,section_key,channel,target_locale" });
      if (upsertError) throw new Error(upsertError.message);
      return payload.length;
    };

    const copyDataValueSettings = async () => {
      const { data, error } = await admin
        .from("data_value_settings")
        .select("*")
        .eq("auth_user_id", oldPartnerId)
        .in("area_id", transferAreaIds);
      if (error) {
        if (isMissingTable(error, "data_value_settings")) return 0;
        throw new Error(error.message);
      }
      const rows = Array.isArray(data) ? data : [];
      if (rows.length === 0) return 0;
      const payload = rows.map((row) => {
        const next = { ...(row as Record<string, unknown>) };
        delete next.id;
        next.auth_user_id = newPartnerId;
        return next;
      });
      const { error: upsertError } = await admin
        .from("data_value_settings")
        .upsert(payload, { onConflict: "auth_user_id,area_id" });
      if (upsertError) throw new Error(upsertError.message);
      return payload.length;
    };

    const copyReportTexts = async () => {
      const { data, error } = await admin
        .from("report_texts")
        .select("area_id, section_key, text_type, raw_content, optimized_content, status, last_updated")
        .eq("partner_id", oldPartnerId)
        .in("area_id", transferAreaIds);
      if (error) {
        if (isMissingTable(error, "report_texts")) return 0;
        throw new Error(error.message);
      }
      const rows = Array.isArray(data) ? data : [];
      if (rows.length === 0) return 0;
      const payload = rows.map((row) => ({
        ...(row as Record<string, unknown>),
        partner_id: newPartnerId,
      }));
      const { error: upsertError } = await admin
        .from("report_texts")
        .upsert(payload, { onConflict: "partner_id,area_id,section_key" });
      if (upsertError) throw new Error(upsertError.message);
      return payload.length;
    };

    const copyRuntimeStates = async () => {
      const { data, error } = await admin
        .from("partner_area_runtime_states")
        .select("area_id, scope, factors_snapshot, data_json, textgen_inputs_json, helpers_json, rebuilt_at, updated_at")
        .eq("partner_id", oldPartnerId)
        .in("area_id", transferAreaIds);
      if (error) {
        if (isMissingTable(error, "partner_area_runtime_states")) return 0;
        throw new Error(error.message);
      }
      const rows = Array.isArray(data) ? data : [];
      if (rows.length === 0) return 0;
      const payload = rows.map((row) => ({
        ...(row as Record<string, unknown>),
        partner_id: newPartnerId,
      }));
      const { error: upsertError } = await admin
        .from("partner_area_runtime_states")
        .upsert(payload, { onConflict: "partner_id,area_id,scope" });
      if (upsertError) throw new Error(upsertError.message);
      return payload.length;
    };

    const copyGeneratedTexts = async () => {
      const { data, error } = await admin
        .from("partner_area_generated_texts")
        .select("area_id, scope, section_key, value_text, source_signature, updated_at")
        .eq("partner_id", oldPartnerId)
        .in("area_id", transferAreaIds);
      if (error) {
        if (isMissingTable(error, "partner_area_generated_texts")) return 0;
        throw new Error(error.message);
      }
      const rows = Array.isArray(data) ? data : [];
      if (rows.length === 0) return 0;
      const payload = rows.map((row) => ({
        ...(row as Record<string, unknown>),
        partner_id: newPartnerId,
      }));
      const { error: upsertError } = await admin
        .from("partner_area_generated_texts")
        .upsert(payload, { onConflict: "partner_id,area_id,scope,section_key" });
      if (upsertError) throw new Error(upsertError.message);
      return payload.length;
    };

    const copyMarketingTexts = async () => {
      const { data, error } = await admin
        .from("partner_marketing_texts")
        .select("area_id, section_key, optimized_content, status, text_type, last_updated")
        .eq("partner_id", oldPartnerId)
        .in("area_id", transferAreaIds);
      if (error) {
        if (isMissingTable(error, "partner_marketing_texts")) return 0;
        throw new Error(error.message);
      }
      const rows = Array.isArray(data) ? data : [];
      if (rows.length === 0) return 0;
      const payload = rows.map((row) => ({
        ...(row as Record<string, unknown>),
        partner_id: newPartnerId,
      }));
      const { error: upsertError } = await admin
        .from("partner_marketing_texts")
        .upsert(payload, { onConflict: "partner_id,area_id,section_key" });
      if (upsertError) throw new Error(upsertError.message);
      return payload.length;
    };

    const clearBlogTarget = async () => {
      const { data, error } = await admin
        .from("partner_blog_posts")
        .select("id")
        .eq("partner_id", newPartnerId)
        .in("area_id", transferAreaIds);
      if (error) {
        if (isMissingTable(error, "partner_blog_posts")) return;
        throw new Error(error.message);
      }
      const postIds = (data ?? [])
        .map((row) => String((row as { id?: string | null }).id ?? "").trim())
        .filter((id) => id.length > 0);
      if (postIds.length > 0) {
        const { error: i18nError } = await admin
          .from("partner_blog_post_i18n")
          .delete()
          .eq("partner_id", newPartnerId)
          .in("post_id", postIds);
        if (i18nError && !isMissingTable(i18nError, "partner_blog_post_i18n")) {
          throw new Error(i18nError.message);
        }
      }
      const { error: deletePostsError } = await admin
        .from("partner_blog_posts")
        .delete()
        .eq("partner_id", newPartnerId)
        .in("area_id", transferAreaIds);
      if (deletePostsError && !isMissingTable(deletePostsError, "partner_blog_posts")) {
        throw new Error(deletePostsError.message);
      }
    };

    const copyBlogPosts = async (mode: Exclude<BlogTransferMode, "keep_old_partner">, locales: string[]) => {
      const { data, error } = await admin
        .from("partner_blog_posts")
        .select("id, area_id, area_name, bundesland_slug, kreis_slug, headline, subline, body_md, author_name, author_image_url, source_individual_01, source_individual_02, source_zitat, status, created_at, updated_at")
        .eq("partner_id", oldPartnerId)
        .in("area_id", transferAreaIds);
      if (error) {
        if (isMissingTable(error, "partner_blog_posts")) return { posts: 0, translations: 0 };
        throw new Error(error.message);
      }
      const rows = Array.isArray(data) ? data : [];
      if (rows.length === 0) return { posts: 0, translations: 0 };

      const postIdMap = new Map<string, string>();
      const payload = rows.map((row) => {
        const oldId = String((row as { id?: string | null }).id ?? "").trim();
        const newId = randomUUID();
        postIdMap.set(oldId, newId);
        return {
          ...(row as Record<string, unknown>),
          id: newId,
          partner_id: newPartnerId,
          status: mode === "copy_as_draft" ? "draft" : (row as { status?: string | null }).status ?? "draft",
        };
      });
      const { error: insertError } = await admin
        .from("partner_blog_posts")
        .insert(payload);
      if (insertError) throw new Error(insertError.message);

      if (locales.length === 0 || postIdMap.size === 0) {
        return { posts: payload.length, translations: 0 };
      }

      const { data: i18nRows, error: i18nError } = await admin
        .from("partner_blog_post_i18n")
        .select("post_id, area_id, target_locale, translated_headline, translated_subline, translated_body_md, status, source_snapshot_hash, source_last_updated, created_at, updated_at")
        .eq("partner_id", oldPartnerId)
        .in("post_id", Array.from(postIdMap.keys()))
        .in("target_locale", locales);
      if (i18nError) {
        if (isMissingTable(i18nError, "partner_blog_post_i18n")) return { posts: payload.length, translations: 0 };
        throw new Error(i18nError.message);
      }

      const translationPayload = (Array.isArray(i18nRows) ? i18nRows : [])
        .map((row) => {
          const sourcePostId = String((row as { post_id?: string | null }).post_id ?? "").trim();
          const newPostId = postIdMap.get(sourcePostId);
          if (!newPostId) return null;
          return {
            ...(row as Record<string, unknown>),
            id: randomUUID(),
            partner_id: newPartnerId,
            post_id: newPostId,
            status: mode === "copy_as_draft" ? "draft" : (row as { status?: string | null }).status ?? "draft",
          };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null);

      if (translationPayload.length > 0) {
        const { error: insertTranslationError } = await admin
          .from("partner_blog_post_i18n")
          .insert(translationPayload);
        if (insertTranslationError) throw new Error(insertTranslationError.message);
      }

      return { posts: payload.length, translations: translationPayload.length };
    };

    const applyLocaleEnablementModes = async () => {
      if (managedLocales.length === 0) return { enabled: 0, disabled: 0, skipped: 0 };
      const featureRows = managedLocales
        .map((locale) => {
          const localeConfig = localeConfigByCode.get(locale);
          const featureCode = String(localeConfig?.billing_feature_code ?? "").trim().toLowerCase();
          if (!featureCode) return null;
          return {
            locale,
            feature_code: featureCode,
            mode: managedLocaleModes.get(locale) ?? "skip",
          };
        })
        .filter((row): row is { locale: string; feature_code: string; mode: LocaleTransferMode } => Boolean(row));
      if (featureRows.length === 0) return { enabled: 0, disabled: 0, skipped: managedLocales.length };
      const { data: existingRows, error: existingError } = await admin
        .from("partner_feature_overrides")
        .select("feature_code, monthly_price_eur")
        .eq("partner_id", newPartnerId)
        .in("feature_code", featureRows.map((row) => row.feature_code));
      if (existingError && !isMissingTable(existingError, "partner_feature_overrides")) {
        throw new Error(existingError.message);
      }
      const existingByCode = new Map(
        ((existingRows ?? []) as Array<{ feature_code?: string | null; monthly_price_eur?: number | null }>)
          .map((row) => [String(row.feature_code ?? "").trim().toLowerCase(), row] as const),
      );
      const upsertRows = featureRows.map((row) => ({
        partner_id: newPartnerId,
        feature_code: row.feature_code,
        is_enabled: row.mode === "copy_and_enable",
        monthly_price_eur: existingByCode.get(row.feature_code)?.monthly_price_eur ?? null,
        updated_at: new Date().toISOString(),
      }));
      const { error } = await admin
        .from("partner_feature_overrides")
        .upsert(upsertRows, { onConflict: "partner_id,feature_code" });
      if (error && !isMissingTable(error, "partner_feature_overrides")) {
        throw new Error(error.message);
      }
      return {
        enabled: featureRows.filter((row) => row.mode === "copy_and_enable").length,
        disabled: featureRows.filter((row) => row.mode === "copy_disabled" || row.mode === "skip").length,
        skipped: featureRows.filter((row) => row.mode === "skip").length,
      };
    };

    if (includeReportCustomization) {
      await deleteRowsByArea("data_value_settings", "auth_user_id");
      await deleteRowsByArea("report_texts", "partner_id");
      await deleteRowsByArea("partner_area_runtime_states", "partner_id");
      await deleteRowsByArea("partner_area_generated_texts", "partner_id");
      await deletePartnerTextsI18nByChannels(["portal"], managedLocales);
    }
    if (includeSeoGeo) {
      await deleteRowsByArea("partner_marketing_texts", "partner_id");
      await deletePartnerTextsI18nByChannels(["marketing"], managedLocales);
    }
    await clearBlogTarget();

    const copiedPartnerState = {
      data_value_settings: 0,
      report_texts: 0,
      runtime_states: 0,
      generated_texts: 0,
      portal_i18n: 0,
      marketing_texts: 0,
      marketing_i18n: 0,
      blog_posts: 0,
      blog_i18n: 0,
      locales_enabled: 0,
      locales_disabled: 0,
      locales_skipped: 0,
    };
    if (includeReportCustomization) {
      copiedPartnerState.data_value_settings = await copyDataValueSettings();
      copiedPartnerState.report_texts = await copyReportTexts();
      copiedPartnerState.runtime_states = await copyRuntimeStates();
      copiedPartnerState.generated_texts = await copyGeneratedTexts();
      copiedPartnerState.portal_i18n = await copyPartnerTextsI18nByChannels(
        ["portal"],
        managedLocales.filter((locale) => (managedLocaleModes.get(locale) ?? "skip") !== "skip"),
      );
    }
    if (includeSeoGeo) {
      copiedPartnerState.marketing_texts = await copyMarketingTexts();
      copiedPartnerState.marketing_i18n = await copyPartnerTextsI18nByChannels(
        ["marketing"],
        managedLocales.filter((locale) => (managedLocaleModes.get(locale) ?? "skip") !== "skip"),
      );
    }
    if (blogTransferMode !== "keep_old_partner") {
      const copiedBlog = await copyBlogPosts(
        blogTransferMode,
        managedLocales.filter((locale) => (managedLocaleModes.get(locale) ?? "skip") !== "skip"),
      );
      copiedPartnerState.blog_posts = copiedBlog.posts;
      copiedPartnerState.blog_i18n = copiedBlog.translations;
    }
    const localeEnablement = await applyLocaleEnablementModes();
    copiedPartnerState.locales_enabled = localeEnablement.enabled;
    copiedPartnerState.locales_disabled = localeEnablement.disabled;
    copiedPartnerState.locales_skipped = localeEnablement.skipped;

    let { data: newMappings, error: upsertMappingError } = await admin
      .from("partner_area_map")
      .upsert(
        transferAreaIds.map((targetAreaId) => ({
          auth_user_id: newPartnerId,
          area_id: targetAreaId,
          is_active: false,
          is_public_live: false,
          activation_status: "assigned",
        })),
        { onConflict: "auth_user_id,area_id" },
      )
      .select("id, auth_user_id, area_id, is_active, is_public_live, activation_status");
    if (upsertMappingError && isMissingActivationStatusColumn(upsertMappingError)) {
      type HandoverMappingRow = {
        id: string | null;
        auth_user_id: string | null;
        area_id: string | null;
        is_active: boolean | null;
        is_public_live: boolean | null;
        activation_status: string | null;
      };
      const fallback = await admin
        .from("partner_area_map")
        .upsert(
          transferAreaIds.map((targetAreaId) => ({
            auth_user_id: newPartnerId,
            area_id: targetAreaId,
            is_active: false,
            is_public_live: false,
          })),
          { onConflict: "auth_user_id,area_id" },
        )
        .select("id, auth_user_id, area_id, is_active");
      newMappings = Array.isArray(fallback.data)
        ? fallback.data.map((row) => {
          const baseRow = (row && typeof row === "object" ? row : {}) as Record<string, unknown>;
          const mappedRow: HandoverMappingRow = {
            id: typeof baseRow.id === "string" ? baseRow.id : null,
            auth_user_id: typeof baseRow.auth_user_id === "string" ? baseRow.auth_user_id : null,
            area_id: typeof baseRow.area_id === "string" ? baseRow.area_id : null,
            is_active: typeof baseRow.is_active === "boolean" ? baseRow.is_active : false,
            activation_status: "assigned",
            is_public_live: null,
          };
          return mappedRow;
        })
        : null;
      upsertMappingError = fallback.error;
    }
    if (upsertMappingError) {
      return NextResponse.json({ error: upsertMappingError.message }, { status: 500 });
    }
    if (!newMappings || newMappings.length === 0) {
      return NextResponse.json({ error: "New mapping could not be created" }, { status: 500 });
    }
    const newRootMapping = newMappings.find((row) => String((row as { area_id?: string | null }).area_id ?? "") === areaId) ?? newMappings[0];

    const { data: removedOldMappings, error: deleteOldMappingsError } = await admin
      .from("partner_area_map")
      .delete()
      .in("area_id", transferAreaIds)
      .eq("auth_user_id", oldPartnerId)
      .select("id, auth_user_id, area_id");
    if (deleteOldMappingsError) {
      return NextResponse.json({ error: deleteOldMappingsError.message }, { status: 500 });
    }

    await writeSecurityAuditLog({
      actorUserId: adminUser.userId,
      actorRole: adminUser.role,
      eventType: "delete",
      entityType: "partner_area_map",
      entityId: `${oldPartnerId}:${areaId}`,
      payload: {
        action: "remove_old_mapping",
        area_id: areaId,
        transferred_area_ids: transferAreaIds,
        old_partner_id: oldPartnerId,
        removed_rows: Array.isArray(removedOldMappings) ? removedOldMappings.length : 0,
      },
      ip: extractClientIpFromHeaders(req.headers),
      userAgent: req.headers.get("user-agent"),
    });

    await writeSecurityAuditLog({
      actorUserId: adminUser.userId,
      actorRole: adminUser.role,
      eventType: "create",
      entityType: "partner_area_map",
      entityId: String(newRootMapping.id),
      payload: {
        action: "assign_new_mapping",
        area_id: areaId,
        transferred_area_ids: transferAreaIds,
        assigned_area_count: transferAreaIds.length,
        new_partner_id: newPartnerId,
        is_active: false,
        activation_status: String((newRootMapping as { activation_status?: string | null }).activation_status ?? "assigned"),
      },
      ip: extractClientIpFromHeaders(req.headers),
      userAgent: req.headers.get("user-agent"),
    });

    await writeSecurityAuditLog({
      actorUserId: adminUser.userId,
      actorRole: adminUser.role,
      eventType: "other",
      entityType: "other",
      entityId: areaId,
      payload: {
        action: "handover_done",
        area_id: areaId,
        transferred_area_ids: transferAreaIds,
        transferred_area_count: transferAreaIds.length,
        old_partner_id: oldPartnerId,
        new_partner_id: newPartnerId,
        deactivate_old_integrations: deactivateOldIntegrations,
        transfer_mode: transferMode,
        include_report_customization: includeReportCustomization,
        include_seo_geo: includeSeoGeo,
        blog_transfer_mode: blogTransferMode,
        locale_modes: Object.fromEntries(managedLocaleModes),
        copied_partner_state: copiedPartnerState,
        old_partner_retained: true,
        old_partner_retention_reason: "Old partner remains active after handover by policy",
      },
      ip: extractClientIpFromHeaders(req.headers),
      userAgent: req.headers.get("user-agent"),
    });

    let partnerAssignMailSent = false;
    let partnerAssignMailReason: string | undefined;
    try {
      const { data: newPartnerMailTarget, error: newPartnerMailTargetError } = await admin
        .from("partners")
        .select("id, company_name, contact_email, contact_first_name")
        .eq("id", newPartnerId)
        .maybeSingle();
      if (newPartnerMailTargetError) {
        return NextResponse.json({ error: newPartnerMailTargetError.message }, { status: 500 });
      }

      const partnerMail = await sendPartnerAreaAssignedEmail({
        partnerEmail: String((newPartnerMailTarget as { contact_email?: string | null } | null)?.contact_email ?? "").trim(),
        partnerName: String((newPartnerMailTarget as { contact_first_name?: string | null } | null)?.contact_first_name ?? "").trim()
          || String((newPartnerMailTarget as { company_name?: string | null } | null)?.company_name ?? "").trim()
          || newPartnerId,
        areaId,
        areaName: String((areaExists as { name?: string | null } | null)?.name ?? "").trim() || areaId,
        assignedAtIso: new Date().toISOString(),
      });
      partnerAssignMailSent = partnerMail.sent;
      partnerAssignMailReason = partnerMail.reason;
      if (!partnerMail.sent) {
        console.warn("partner handover assign mail not sent:", partnerMail.reason);
      }
    } catch (mailErr) {
      partnerAssignMailSent = false;
      partnerAssignMailReason = mailErr instanceof Error ? mailErr.message : "mail_error";
      console.warn("partner handover assign mail failed:", mailErr);
    }

    await writeSecurityAuditLog({
      actorUserId: adminUser.userId,
      actorRole: adminUser.role,
      eventType: "other",
      entityType: "other",
      entityId: `${areaId}:handover:partner_mail`,
      payload: {
        action: "mail_admin_handover_partner_notify",
        area_id: areaId,
        partner_id: newPartnerId,
        sent: partnerAssignMailSent,
        reason: partnerAssignMailReason ?? null,
      },
      ip: extractClientIpFromHeaders(req.headers),
      userAgent: req.headers.get("user-agent"),
    });

    try {
      await publishVisibilityIndex(admin as never);
    } catch (publishErr) {
      console.warn("visibility index publish failed after handover:", publishErr);
    }

    return NextResponse.json({
      ok: true,
      handover: {
        area_id: areaId,
        area_name: areaExists.name ?? areaId,
        old_partner: {
          id: oldPartnerId,
          company_name: oldPartner.company_name ?? oldPartnerId,
        },
        new_partner: {
          id: newPartnerId,
          company_name: newPartner.company_name ?? newPartnerId,
        },
        deactivate_old_integrations_applied: deactivateOldIntegrations,
        old_partner_remains_active: true,
        transfer_mode: transferMode,
        include_report_customization: includeReportCustomization,
        include_seo_geo: includeSeoGeo,
        blog_transfer_mode: blogTransferMode,
        locale_modes: Object.fromEntries(managedLocaleModes),
        transferred_area_count: transferAreaIds.length,
        new_mapping_status: String((newRootMapping as { activation_status?: string | null }).activation_status ?? "assigned"),
        new_mapping_is_active: false,
        copied_partner_state: copiedPartnerState,
      },
      notification: {
        partner: {
          sent: partnerAssignMailSent,
          reason: partnerAssignMailReason ?? null,
        },
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
