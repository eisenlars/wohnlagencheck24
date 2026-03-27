"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/utils/supabase/client";
import { getProvidersForKind } from "@/lib/integrations/providers";
import { getMandatoryMediaLabel, isMandatoryMediaKey } from "@/lib/mandatory-media";
import {
  MARKET_EXPLANATION_STATIC_TEXT_DEFINITIONS,
  getMarketExplanationStaticTextDefaultValue,
  type MarketExplanationStaticTextDefinition,
  type MarketExplanationStaticTextKey,
} from "@/lib/market-explanation-static-text-definitions";
import type {
  MarketExplanationStaticTextEntryRecord,
  MarketExplanationStaticTextEntryStatus,
  MarketExplanationStaticTextI18nMetaViewRecord,
} from "@/lib/market-explanation-static-text-meta";
import {
  getMarketExplanationStandardDefinitions,
  MARKET_EXPLANATION_STANDARD_TEXT_DEFINITIONS,
  MARKET_EXPLANATION_STANDARD_TABS,
  type MarketExplanationStandardTextDefinition,
  type MarketExplanationStandardScope,
} from "@/lib/market-explanation-standard-text-definitions";
import { getTextKeyLabel } from "@/lib/text-key-labels";
import {
  buildPortalCmsEmptyFields,
  getPortalCmsPages,
  migratePortalContentWraps,
  normalizePortalCmsFields,
  parsePortalContentBlocks,
  parsePortalContentWraps,
  serializePortalContentBlocks,
  serializePortalContentWraps,
  type PortalContentBlock,
  type PortalContentWrap,
  type PortalContentWrapTextBlock,
  type PortalContentEntryRecord,
  type PortalContentEntryStatus,
  type PortalContentPageDefinition,
  type PortalLocaleConfigRecord,
  type PortalLocaleStatus,
} from "@/lib/portal-cms";
import type { PortalContentI18nMetaViewRecord } from "@/lib/portal-cms-i18n-meta";
import {
  buildPortalLocaleBillingFeatureCode,
  isValidPortalLocaleCode,
  normalizePortalLocaleCode,
} from "@/lib/portal-locale-registry";
import {
  PORTAL_SYSTEM_TEXT_DEFINITIONS,
  getPortalSystemTextDefaultValue,
  type PortalSystemTextDefinition,
  type PortalSystemTextKey,
} from "@/lib/portal-system-text-definitions";
import type {
  PortalSystemTextEntryRecord,
  PortalSystemTextEntryStatus,
  PortalSystemTextI18nMetaViewRecord,
} from "@/lib/portal-system-text-meta";
import {
  restoreSessionScroll,
  storeSessionScroll,
  useSessionViewState,
} from "@/lib/ui/session-view-state";
import {
  EMPTY_SYSTEMPARTNER_DEFAULT_PROFILE,
  getMissingSystempartnerDefaultProfileKeys,
  type SystempartnerDefaultProfile,
} from "@/lib/systempartner-default-profile";
import FullscreenLoader from "@/components/ui/FullscreenLoader";

type Partner = {
  id: string;
  company_name: string;
  contact_email?: string | null;
  contact_first_name?: string | null;
  contact_last_name?: string | null;
  website_url?: string | null;
  is_active?: boolean;
  is_system_default?: boolean;
  llm_partner_managed_allowed?: boolean;
  llm_mode_default?: string | null;
  area_mappings?: AreaMapping[];
};

type AreaMapping = {
  id: string;
  auth_user_id: string;
  area_id: string;
  is_active: boolean;
  is_public_live?: boolean | null;
  activation_status?: string | null;
  partner_preview_signoff_at?: string | null;
  admin_review_note?: string | null;
  areas?: {
    name?: string | null;
    slug?: string | null;
    parent_slug?: string | null;
    bundesland_slug?: string | null;
  } | null;
};

type Integration = {
  id: string;
  partner_id: string;
  kind: string;
  provider: string;
  base_url?: string | null;
  auth_type?: string | null;
  auth_config?: Record<string, unknown> | null;
  detail_url_template?: string | null;
  is_active: boolean;
  settings?: Record<string, unknown> | null;
  last_sync_at?: string | null;
};

type CrmResourceKey = "offers" | "references" | "requests";

type CrmSyncResultPayload = {
  listings_count: number;
  references_count: number;
  requests_count: number;
  offers_count: number;
  deactivated_listings: number;
  deactivated_offers: number;
  skipped: boolean;
  reason?: string;
  notes?: string[];
};

type SyncLogPayload = {
  at?: string | null;
  step?: string | null;
  status?: "running" | "ok" | "warning" | "error" | null;
  message?: string | null;
};

type IntegrationSyncSummary = {
  status: "ok" | "warning" | "error" | "running";
  resource: "offers" | "references" | "requests" | "all";
  mode?: "guarded" | "full" | null;
  message: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  lastSyncAt?: string | null;
  errorClass?: string | null;
  requestCount?: number | null;
  pagesFetched?: number | null;
  traceId?: string | null;
  step?: string | null;
  heartbeatAt?: string | null;
  deadlineAt?: string | null;
  cancelRequested?: boolean;
  log?: SyncLogPayload[];
  result?: CrmSyncResultPayload | null;
};

type IntegrationPreviewSummary = {
  status: "ok" | "warning" | "error";
  resource: "offers" | "references" | "requests" | "all";
  message: string;
  testedAt?: string | null;
  traceId?: string | null;
};

type CrmIntegrationAdminDraft = {
  listingsStatusIds: string;
  referencesArchived: string;
  referencesStatusIds: string;
  referencesCustomFieldKey: string;
  guardedUnitsTargetObjects: string;
  guardedReferencesTargetObjects: string;
  guardedSavedQueriesTargetObjects: string;
  requestFreshnessEnabled: boolean;
  requestFreshnessBasis: "source_updated_at" | "last_seen_at";
  requestFreshnessBuyDays: string;
  requestFreshnessRentDays: string;
  requestFreshnessFallbackToLastSeen: boolean;
};

type AreaOption = {
  id: string;
  name?: string | null;
  slug?: string | null;
  parent_slug?: string | null;
  bundesland_slug?: string | null;
};

type AreaRelationLike = {
  name?: string | null;
  slug?: string | null;
  parent_slug?: string | null;
  bundesland_slug?: string | null;
};

type AreaLabelSource =
  | Pick<AreaMapping, "areas">
  | AreaRelationLike
  | Array<AreaRelationLike | null | undefined>
  | null
  | undefined;

type AuditLogRow = {
  id: string;
  actor_user_id?: string | null;
  actor_role: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  payload?: Record<string, unknown> | null;
  ip?: string | null;
  user_agent?: string | null;
  created_at: string;
};

type MarketExplanationStandardEntry = {
  key: string;
  value_text: string;
  base_value_text?: string;
  override_value_text?: string | null;
  has_override?: boolean;
  text_type?: MarketExplanationStandardTextDefinition["type"];
  override_status?: string | null;
  override_updated_at?: string | null;
  translation_origin?: string | null;
  translation_is_stale?: boolean;
};

type MarketExplanationStandardBundesland = {
  slug: string;
  name: string;
};

type MarketExplanationStandardTranslationStatus = "draft" | "internal" | "live";

type DisplayAreaRow = {
  key: string;
  displayKreisId: string;
  mapping: AreaMapping;
  derivedFromOrtslagen: boolean;
  sourceCount: number;
};

type AreaOverviewRow = {
  key: string;
  kreisId: string;
  kreisName: string;
  partnerId: string;
  partnerName: string;
  isActive: boolean;
  activationStatus: string;
};

type PortalLocalePreset = {
  variant_label: string;
  locale: string;
  label_native: string;
  label_de: string;
  bcp47_tag: string;
  number_locale: string;
  date_locale: string;
  currency_code: string;
  fallback_locale: string;
  text_direction: "ltr" | "rtl";
  billing_feature_code: string;
};

type PortalLocaleLanguagePreset = {
  language_key: string;
  label_de: string;
  variants: PortalLocalePreset[];
};

const PORTAL_LOCALE_LANGUAGE_PRESETS: PortalLocaleLanguagePreset[] = [
  {
    language_key: "en",
    label_de: "Englisch",
    variants: [
      { variant_label: "Standard", locale: "en", label_native: "English", label_de: "Englisch", bcp47_tag: "en-US", number_locale: "en-US", date_locale: "en-US", currency_code: "EUR", fallback_locale: "de", text_direction: "ltr", billing_feature_code: "international_en" },
      { variant_label: "USA", locale: "en-us", label_native: "English (US)", label_de: "Englisch (USA)", bcp47_tag: "en-US", number_locale: "en-US", date_locale: "en-US", currency_code: "USD", fallback_locale: "de", text_direction: "ltr", billing_feature_code: "international_en-us" },
      { variant_label: "Vereinigtes Königreich", locale: "en-gb", label_native: "English (UK)", label_de: "Englisch (UK)", bcp47_tag: "en-GB", number_locale: "en-GB", date_locale: "en-GB", currency_code: "GBP", fallback_locale: "de", text_direction: "ltr", billing_feature_code: "international_en-gb" },
    ],
  },
  {
    language_key: "fr",
    label_de: "Französisch",
    variants: [
      { variant_label: "Standard", locale: "fr", label_native: "Français", label_de: "Französisch", bcp47_tag: "fr-FR", number_locale: "fr-FR", date_locale: "fr-FR", currency_code: "EUR", fallback_locale: "de", text_direction: "ltr", billing_feature_code: "international_fr" },
    ],
  },
  {
    language_key: "it",
    label_de: "Italienisch",
    variants: [
      { variant_label: "Standard", locale: "it", label_native: "Italiano", label_de: "Italienisch", bcp47_tag: "it-IT", number_locale: "it-IT", date_locale: "it-IT", currency_code: "EUR", fallback_locale: "de", text_direction: "ltr", billing_feature_code: "international_it" },
    ],
  },
  {
    language_key: "es",
    label_de: "Spanisch",
    variants: [
      { variant_label: "Standard", locale: "es", label_native: "Español", label_de: "Spanisch", bcp47_tag: "es-ES", number_locale: "es-ES", date_locale: "es-ES", currency_code: "EUR", fallback_locale: "de", text_direction: "ltr", billing_feature_code: "international_es" },
    ],
  },
  {
    language_key: "nl",
    label_de: "Niederländisch",
    variants: [
      { variant_label: "Standard", locale: "nl", label_native: "Nederlands", label_de: "Niederländisch", bcp47_tag: "nl-NL", number_locale: "nl-NL", date_locale: "nl-NL", currency_code: "EUR", fallback_locale: "de", text_direction: "ltr", billing_feature_code: "international_nl" },
    ],
  },
  {
    language_key: "pt",
    label_de: "Portugiesisch",
    variants: [
      { variant_label: "Portugal", locale: "pt", label_native: "Português", label_de: "Portugiesisch", bcp47_tag: "pt-PT", number_locale: "pt-PT", date_locale: "pt-PT", currency_code: "EUR", fallback_locale: "de", text_direction: "ltr", billing_feature_code: "international_pt" },
      { variant_label: "Brasilien", locale: "pt-br", label_native: "Português (Brasil)", label_de: "Portugiesisch (Brasilien)", bcp47_tag: "pt-BR", number_locale: "pt-BR", date_locale: "pt-BR", currency_code: "BRL", fallback_locale: "de", text_direction: "ltr", billing_feature_code: "international_pt-br" },
    ],
  },
  {
    language_key: "pl",
    label_de: "Polnisch",
    variants: [
      { variant_label: "Standard", locale: "pl", label_native: "Polski", label_de: "Polnisch", bcp47_tag: "pl-PL", number_locale: "pl-PL", date_locale: "pl-PL", currency_code: "PLN", fallback_locale: "de", text_direction: "ltr", billing_feature_code: "international_pl" },
    ],
  },
  {
    language_key: "tr",
    label_de: "Türkisch",
    variants: [
      { variant_label: "Standard", locale: "tr", label_native: "Türkçe", label_de: "Türkisch", bcp47_tag: "tr-TR", number_locale: "tr-TR", date_locale: "tr-TR", currency_code: "TRY", fallback_locale: "de", text_direction: "ltr", billing_feature_code: "international_tr" },
    ],
  },
  {
    language_key: "ar",
    label_de: "Arabisch",
    variants: [
      { variant_label: "Standard", locale: "ar", label_native: "العربية", label_de: "Arabisch", bcp47_tag: "ar", number_locale: "ar", date_locale: "ar", currency_code: "EUR", fallback_locale: "de", text_direction: "rtl", billing_feature_code: "international_ar" },
    ],
  },
  {
    language_key: "ru",
    label_de: "Russisch",
    variants: [
      { variant_label: "Standard", locale: "ru", label_native: "Русский", label_de: "Russisch", bcp47_tag: "ru-RU", number_locale: "ru-RU", date_locale: "ru-RU", currency_code: "EUR", fallback_locale: "de", text_direction: "ltr", billing_feature_code: "international_ru" },
    ],
  },
  {
    language_key: "zh",
    label_de: "Chinesisch (Mandarin)",
    variants: [
      { variant_label: "Standard", locale: "zh", label_native: "中文", label_de: "Chinesisch (Mandarin)", bcp47_tag: "zh-CN", number_locale: "zh-CN", date_locale: "zh-CN", currency_code: "EUR", fallback_locale: "de", text_direction: "ltr", billing_feature_code: "international_zh" },
    ],
  },
];

function buildAreaOverviewRows(partnerList: Partner[]): AreaOverviewRow[] {
  const rows = new Map<string, AreaOverviewRow>();
  for (const partner of partnerList) {
    for (const mapping of partner.area_mappings ?? []) {
      const kreisId = String(mapping.area_id ?? "").split("-").slice(0, 3).join("-");
      if (kreisId.split("-").length !== 3) continue;
      const key = `${partner.id}:${kreisId}`;
      if (rows.has(key)) continue;
      rows.set(key, {
        key,
        kreisId,
        kreisName: resolveAreaName(mapping, kreisId),
        partnerId: partner.id,
        partnerName: partner.company_name,
        isActive: Boolean(mapping.is_active),
        activationStatus: normalizeActivationStatus(
          mapping.activation_status,
          Boolean(mapping.is_active),
          Boolean(mapping.is_public_live),
        ),
      });
    }
  }

  return Array.from(rows.values()).sort((a, b) => {
    const byKreis = a.kreisId.localeCompare(b.kreisId, "de");
    if (byKreis !== 0) return byKreis;
    return a.partnerName.localeCompare(b.partnerName, "de");
  });
}

function resolveAreaRecord(
  area: AreaRelationLike | Array<AreaRelationLike | null | undefined> | null | undefined,
): AreaRelationLike | null {
  if (Array.isArray(area)) {
    for (const item of area) {
      if (item && typeof item === "object") return item;
    }
    return null;
  }
  return area && typeof area === "object" ? area : null;
}

function hasAreasRelation(value: AreaLabelSource): value is Pick<AreaMapping, "areas"> {
  const candidate = value;
  return candidate !== null && typeof candidate === "object" && !Array.isArray(candidate) && "areas" in candidate;
}

function resolveAreaName(
  area: AreaLabelSource,
  fallbackId: string,
): string {
  const source: AreaRelationLike | Array<AreaRelationLike | null | undefined> | null | undefined =
    hasAreasRelation(area)
    ? area.areas
    : area;
  const name = String(resolveAreaRecord(source)?.name ?? "").trim();
  return name || fallbackId;
}

function formatAreaLabel(
  area: AreaLabelSource,
  fallbackId: string,
): string {
  const name = resolveAreaName(area, fallbackId);
  return name === fallbackId ? fallbackId : `${name} (${fallbackId})`;
}

function isKreisAreaOption(area: Pick<AreaOption, "parent_slug" | "bundesland_slug"> | null | undefined): boolean {
  return String(area?.parent_slug ?? "") === String(area?.bundesland_slug ?? "");
}

function formatAreaOptionLabel(area: AreaOption): string {
  const id = String(area.id ?? "").trim();
  const name = String(area.name ?? "").trim() || id;
  return name === id ? id : `${name} (${id})`;
}

function formatStandardTextRefreshReason(reason: string | undefined): string {
  const normalized = String(reason ?? "").trim();
  if (!normalized) return "ohne Zusatz";
  if (normalized === "dry_run") return "Dry-Run";
  if (normalized === "no_standard_changes") return "keine Änderungen";
  if (normalized === "report_not_found_or_invalid_json") return "Report fehlt oder ist ungültig";
  if (normalized.startsWith("download_failed")) return normalized.replace("download_failed:", "Download fehlgeschlagen:");
  if (normalized.startsWith("upload_failed")) return normalized.replace("upload_failed:", "Upload fehlgeschlagen:");
  return normalized;
}

function mergeAreaMappingRecord(
  current: AreaMapping | null | undefined,
  patch: Partial<AreaMapping> & Pick<AreaMapping, "area_id" | "auth_user_id">,
): AreaMapping {
  return {
    id: String(patch.id ?? current?.id ?? `${patch.auth_user_id}:${patch.area_id}`),
    auth_user_id: String(patch.auth_user_id ?? current?.auth_user_id ?? ""),
    area_id: String(patch.area_id ?? current?.area_id ?? ""),
    is_active: Boolean(("is_active" in patch) ? patch.is_active : current?.is_active),
    is_public_live: ("is_public_live" in patch) ? patch.is_public_live : current?.is_public_live,
    activation_status: ("activation_status" in patch) ? patch.activation_status : current?.activation_status,
    partner_preview_signoff_at: ("partner_preview_signoff_at" in patch)
      ? patch.partner_preview_signoff_at
      : (current?.partner_preview_signoff_at ?? null),
    admin_review_note: ("admin_review_note" in patch)
      ? patch.admin_review_note
      : (current?.admin_review_note ?? null),
    areas: patch.areas ?? current?.areas ?? null,
  };
}

function upsertAreaMapping(
  list: AreaMapping[],
  patch: Partial<AreaMapping> & Pick<AreaMapping, "area_id" | "auth_user_id">,
): AreaMapping[] {
  const existingIndex = list.findIndex((entry) => entry.area_id === patch.area_id);
  if (existingIndex === -1) {
    return [...list, mergeAreaMappingRecord(undefined, patch)].sort((a, b) =>
      String(a.area_id ?? "").localeCompare(String(b.area_id ?? ""), "de"),
    );
  }

  const next = [...list];
  next[existingIndex] = mergeAreaMappingRecord(next[existingIndex], patch);
  return next;
}

type MandatoryMissingEntry = {
  key?: string;
  reason?: "missing" | "default" | "unapproved";
};

type ReviewField = {
  key: string;
  content: string;
  status: "approved" | "draft";
  present: boolean;
};

type AreaReviewPayload = {
  ok?: boolean;
  mapping?: AreaMapping;
  mandatory?: {
    ok?: boolean;
    status?: number;
    error?: string;
    missing?: MandatoryMissingEntry[];
  };
  fields?: ReviewField[];
  notification?: {
    partner?: {
      sent?: boolean;
      reason?: string | null;
    };
  } | null;
};

type PartnerPurgeCheckPayload = {
  ok?: boolean;
  partner?: { id?: string; company_name?: string | null };
  can_purge?: boolean;
  blockers?: string[];
  summary?: {
    areaMappingsTotal?: number;
    areaMappingsActive?: number;
    areaMappingsPending?: number;
    integrationsTotal?: number;
    integrationsActive?: number;
    storageFiles?: number;
  };
  affected_counts?: Record<string, number>;
};

type AdminView = "home" | "new_partner" | "new_partner_success" | "partner_edit" | "partner_integrations" | "partner_purge" | "audit" | "llm_global" | "billing_defaults" | "language_admin" | "system_texts" | "market_texts" | "standard_text_refresh" | "portal_cms";
type AdminNavMode = "partners" | "areas";
type PartnerPanelTab = "profile" | "systempartner_default" | "areas" | "review" | "handover" | "integrations" | "billing";
type AdminNavIconKey = "partners" | "areas" | "llm" | "billing" | "language" | "texts" | "market_texts" | "refresh" | "cms" | "purge" | "audit" | "logout";
type WorkflowSignalTone = "none" | "red" | "orange" | "green";
type StandardTextRefreshScope = "bundesland" | "kreis" | "kreis_ortslagen" | "ortslage";

type StandardTextRefreshResult = {
  area_id: string;
  report_path: string;
  status: "updated" | "skipped" | "error";
  reason?: string;
  changed_keys?: number;
};

type StandardTextRefreshSelection = AreaOption & {
  id: string;
};

type HandoverLocaleMode = "skip" | "copy_disabled" | "copy_and_enable";
type HandoverBlogTransferMode = "keep_old_partner" | "copy_as_draft" | "copy_as_is";

type HandoverApiResponse = {
  ok?: boolean;
  handover?: {
    area_id?: string;
    area_name?: string;
    old_partner?: { id?: string; company_name?: string };
    new_partner?: { id?: string; company_name?: string };
    deactivate_old_integrations_applied?: boolean;
    old_partner_remains_active?: boolean;
    transfer_mode?: "base_reset" | "copy_partner_state";
    include_report_customization?: boolean;
    include_seo_geo?: boolean;
    blog_transfer_mode?: HandoverBlogTransferMode;
    locale_modes?: Record<string, HandoverLocaleMode>;
    copied_partner_state?: {
      data_value_settings?: number;
      report_texts?: number;
      runtime_states?: number;
      generated_texts?: number;
      portal_i18n?: number;
      marketing_texts?: number;
      marketing_i18n?: number;
      blog_posts?: number;
      blog_i18n?: number;
      locales_enabled?: number;
      locales_disabled?: number;
      locales_skipped?: number;
    };
  };
};

type AdminWelcomeAction = {
  key: string;
  icon: AdminNavIconKey;
  title: string;
  text: string;
  badge?: string | null;
  onClick: () => void;
};

function formatHandoverLocaleModeLabel(mode: HandoverLocaleMode): string {
  if (mode === "copy_and_enable") return "übernehmen und aktivieren";
  if (mode === "copy_disabled") return "übernehmen, deaktiviert";
  return "nicht übernehmen";
}

function formatHandoverBlogTransferModeLabel(mode: HandoverBlogTransferMode): string {
  if (mode === "copy_as_draft") return "als Entwurf kopieren";
  if (mode === "copy_as_is") return "wie bisher übernehmen";
  return "beim alten Partner lassen";
}

type PortalBlockType = PortalContentBlock["type"];
type PortalWrapBlockType = PortalContentWrapTextBlock["type"];

function createEmptyPortalBlock(type: PortalBlockType): PortalContentBlock {
  if (type === "heading") return { type: "heading", level: 2, text: "" };
  if (type === "paragraph") return { type: "paragraph", text: "" };
  if (type === "list") return { type: "list", style: "unordered", items: [""] };
  if (type === "link_list") return { type: "link_list", items: [{ label: "", href: "" }] };
  if (type === "contact") return { type: "contact", lines: [""] };
  return { type: "note", variant: "info", text: "" };
}

function createPortalWrapId(): string {
  return `wrap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createEmptyPortalWrapBlock(type: PortalWrapBlockType): PortalContentWrapTextBlock {
  if (type === "heading") return { type: "heading", level: 2, text: "" };
  return { type: "paragraph", text: "" };
}

function createEmptyPortalWrap(): PortalContentWrap {
  return {
    id: createPortalWrapId(),
    title: "",
    show_title: false,
    blocks: [],
  };
}

function formatPortalWrapBlockTypeLabel(type: PortalWrapBlockType): string {
  if (type === "heading") return "Überschrift";
  return "Absatz";
}

function formatPortalBlockTypeLabel(type: PortalBlockType): string {
  if (type === "heading") return "Überschrift";
  if (type === "paragraph") return "Absatz";
  if (type === "list") return "Liste";
  if (type === "link_list") return "Linkliste";
  if (type === "contact") return "Kontaktblock";
  return "Hinweis";
}

function renderAdminNavIcon(icon: AdminNavIconKey, size = 17) {
  const baseProps = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (icon) {
    case "partners":
      return (
        <svg {...baseProps}>
          <path d="M16 19a4 4 0 0 0-8 0" />
          <circle cx="12" cy="10" r="3" />
          <path d="M5 19a3 3 0 0 1 3-3" />
          <path d="M19 19a3 3 0 0 0-3-3" />
        </svg>
      );
    case "areas":
      return (
        <svg {...baseProps}>
          <path d="m3 7 6-3 6 3 6-3" />
          <path d="m3 7 6 3 6-3 6 3" />
          <path d="M3 7v10l6 3 6-3 6 3V10" />
        </svg>
      );
    case "llm":
      return (
        <svg {...baseProps}>
          <path d="M12 3 4 7v10l8 4 8-4V7l-8-4Z" />
          <path d="M9 12h6" />
          <path d="M12 9v6" />
        </svg>
      );
    case "billing":
      return (
        <svg {...baseProps}>
          <path d="M12 3v18" />
          <path d="M16 7.5c0-1.9-1.8-3.5-4-3.5s-4 1.6-4 3.5 1.8 3.5 4 3.5 4 1.6 4 3.5-1.8 3.5-4 3.5-4-1.6-4-3.5" />
        </svg>
      );
    case "language":
      return (
        <svg {...baseProps}>
          <circle cx="12" cy="12" r="8" />
          <path d="M4 12h16" />
          <path d="M12 4a12 12 0 0 1 0 16" />
          <path d="M12 4a12 12 0 0 0 0 16" />
        </svg>
      );
    case "texts":
      return (
        <svg {...baseProps}>
          <path d="M6 5h12" />
          <path d="M6 9h12" />
          <path d="M6 13h8" />
          <path d="M6 17h10" />
        </svg>
      );
    case "market_texts":
      return (
        <svg {...baseProps}>
          <path d="M4 18h16" />
          <path d="M7 18V9" />
          <path d="M12 18V6" />
          <path d="M17 18v-4" />
        </svg>
      );
    case "refresh":
      return (
        <svg {...baseProps}>
          <path d="M20 7v5h-5" />
          <path d="M4 17v-5h5" />
          <path d="M7.5 9A6 6 0 0 1 18 12" />
          <path d="M16.5 15A6 6 0 0 1 6 12" />
        </svg>
      );
    case "cms":
      return (
        <svg {...baseProps}>
          <rect x="4" y="5" width="16" height="14" rx="2" />
          <path d="M8 9h8" />
          <path d="M8 13h5" />
        </svg>
      );
    case "purge":
      return (
        <svg {...baseProps}>
          <path d="M4 7h16" />
          <path d="m9 7 1-2h4l1 2" />
          <path d="M8 7v11" />
          <path d="M16 7v11" />
          <path d="M10 11v4" />
          <path d="M14 11v4" />
        </svg>
      );
    case "audit":
      return (
        <svg {...baseProps}>
          <path d="M7 4h10v16l-5-3-5 3V4Z" />
          <path d="M9 9h6" />
          <path d="M9 12h6" />
        </svg>
      );
    case "logout":
      return (
        <svg {...baseProps}>
          <path d="M14 7V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-2" />
          <path d="M10 12h10" />
          <path d="m17 8 3 4-3 4" />
        </svg>
      );
  }
}

type LlmGlobalConfig = {
  central_enabled: boolean;
  monthly_token_budget: number | null;
  monthly_cost_budget_eur: number | null;
};

type LlmGlobalProvider = {
  id: string;
  provider_account_id?: string | null;
  provider_model_id?: string | null;
  provider: string;
  provider_display_name?: string | null;
  model: string;
  display_label?: string | null;
  hint?: string | null;
  badges?: string[] | null;
  recommended?: boolean;
  base_url: string;
  auth_type: string;
  api_version?: string | null;
  priority: number;
  is_active: boolean;
  temperature?: number | null;
  max_tokens?: number | null;
  input_cost_usd_per_1k?: number | null;
  output_cost_usd_per_1k?: number | null;
  input_cost_eur_per_1k?: number | null;
  output_cost_eur_per_1k?: number | null;
  price_source?: string | null;
  price_source_url?: string | null;
  price_source_url_override?: string | null;
  price_updated_at?: string | null;
  fx_rate_usd_to_eur?: number | null;
};

type LlmProviderAccount = {
  id: string;
  provider: string;
  display_name?: string | null;
  base_url: string;
  auth_type: string;
  auth_config?: Record<string, unknown> | null;
  api_version?: string | null;
  is_active: boolean;
};

type LlmCreateModelDraft = {
  key: string;
  model: string;
  manual_model_input: boolean;
  display_label: string;
  hint: string;
  badges: string;
  recommended: boolean;
  sort_order: string;
  temperature: string;
  max_tokens: string;
  input_cost_usd_per_1k: string;
  output_cost_usd_per_1k: string;
};

type LlmUsagePartnerRow = {
  partner_id: string;
  tokens: number;
  cost_eur: number;
};

type LlmUsageItemRow = {
  route_name: string;
  provider: string;
  model: string;
  tokens: number;
  cost_eur: number;
};

type LlmUsageStatusRow = {
  status: string;
  entries: number;
  tokens: number;
  cost_eur: number;
};

type BillingGlobalDefaults = {
  portal_base_price_eur: number;
  portal_ortslage_price_eur: number;
  portal_export_ortslage_price_eur: number;
};

type BillingFeature = {
  code: string;
  label: string;
  note?: string | null;
  billing_unit?: string | null;
  default_enabled: boolean;
  default_monthly_price_eur: number;
  sort_order: number;
  is_active: boolean;
};

type BillingLocaleFeature = {
  locale: string;
  label_native?: string | null;
  label_de?: string | null;
  bcp47_tag?: string | null;
  feature_code: string;
  matched_feature_code?: string | null;
  partner_bookable: boolean;
  is_active: boolean;
  status: string;
  feature_exists: boolean;
  feature_is_active: boolean;
  default_enabled: boolean;
  default_monthly_price_eur: number;
  billing_unit: string;
  note?: string | null;
  sort_order: number;
};

type PartnerBillingFeature = {
  code: string;
  label: string;
  note?: string | null;
  billing_unit?: string | null;
  enabled: boolean;
  monthly_price_eur: number;
  default_enabled: boolean;
  default_monthly_price_eur: number;
  override_enabled?: boolean | null;
  override_monthly_price_eur?: number | null;
  is_active?: boolean;
  sort_order?: number;
};

type PartnerLocaleBillingFeature = BillingLocaleFeature & {
  enabled: boolean;
  monthly_price_eur: number;
  override_enabled?: boolean | null;
  override_monthly_price_eur?: number | null;
};

function normalizeActivationStatus(value: unknown, isActive: boolean, isPublicLive = false): string {
  if (isPublicLive) return "live";
  const raw = String(value ?? "").trim().toLowerCase();
  if (
    raw === "assigned"
    || raw === "in_progress"
    || raw === "ready_for_review"
    || raw === "in_review"
    || raw === "changes_requested"
    || raw === "approved_preview"
    || raw === "live"
    || raw === "active"
  ) {
    return raw;
  }
  if (isActive) return "approved_preview";
  return "assigned";
}

function formatAreaStateLabel(isActive: boolean, activationStatus: unknown, isPublicLive = false): string {
  const state = normalizeActivationStatus(activationStatus, isActive, isPublicLive);
  if (state === "live") return "online";
  if (state === "approved_preview" || state === "active") return "preview freigegeben";
  if (state === "ready_for_review") return "freigabebereit";
  if (state === "in_review") return "in prüfung";
  if (state === "changes_requested") return "nachbesserung";
  if (state === "in_progress") return "in bearbeitung";
  return "zugewiesen";
}

function resolveWorkflowSignalTone(states: string[], needsAssignment: boolean, isActive = true, isSystemDefault = false): WorkflowSignalTone {
  if (isSystemDefault) return "none";
  if (!isActive) return "none";
  if (needsAssignment) return "red";
  if (states.length === 0) return "red";
  if (states.every((state) => state === "live")) return "green";
  return "orange";
}

function workflowSignalColor(tone: WorkflowSignalTone): string | null {
  if (tone === "red") return "#dc2626";
  if (tone === "orange") return "#f59e0b";
  if (tone === "green") return "#16a34a";
  return null;
}

function buildPreviewHrefFromArea(area: AreaMapping["areas"], areaId: string): string | null {
  const bundeslandSlug = String(area?.bundesland_slug ?? "").trim();
  const slug = String(area?.slug ?? "").trim();
  const parentSlug = String(area?.parent_slug ?? "").trim();
  if (!bundeslandSlug || !slug) return null;

  const isOrtslage = String(areaId ?? "").split("-").length > 3;
  if (!isOrtslage) {
    return `/preview/immobilienmarkt/${bundeslandSlug}/${slug}`;
  }

  if (!parentSlug) return null;
  return `/preview/immobilienmarkt/${bundeslandSlug}/${parentSlug}/${slug}`;
}

function formatAdminDateTime(value: string | null | undefined): string {
  const iso = String(value ?? "").trim();
  if (!iso) return "";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString("de-DE");
}

function getMaskedAuthSummary(integration: Pick<Integration, "auth_config">): string {
  const auth = (integration.auth_config ?? {}) as Record<string, unknown>;
  const hasApiKey = Boolean(String(auth.api_key ?? auth.api_key_encrypted ?? "").trim());
  const hasToken = Boolean(String(auth.token ?? auth.token_encrypted ?? "").trim());
  const hasSecret = Boolean(String(auth.secret ?? auth.secret_encrypted ?? "").trim());
  const parts: string[] = [];
  if (hasApiKey) parts.push("api_****");
  if (hasToken) parts.push("to*****");
  if (hasSecret) parts.push("se*****");
  if (parts.length === 0) return "Keine hinterlegt";
  return parts.join(" · ");
}

function getIntegrationHealthSummary(integration: Pick<Integration, "settings" | "last_sync_at">): string {
  const settings = (integration.settings ?? {}) as Record<string, unknown>;
  const testedAt = String(settings.last_tested_at ?? "").trim();
  const testStatus = String(settings.last_test_status ?? "").trim();
  const syncAt = String(integration.last_sync_at ?? "").trim();
  const chunks: string[] = [];
  if (testStatus) chunks.push(`Test: ${testStatus}`);
  if (testedAt) chunks.push(`Zuletzt getestet: ${new Date(testedAt).toLocaleString("de-DE")}`);
  if (syncAt) chunks.push(`Letzter Sync: ${new Date(syncAt).toLocaleString("de-DE")}`);
  return chunks.length > 0 ? chunks.join(" | ") : "Kein Test-/Sync-Status";
}

function formatMandatoryKeyLabel(key: string): string {
  if (!key) return key;
  if (isMandatoryMediaKey(key)) return getMandatoryMediaLabel(key);
  return getTextKeyLabel(key);
}

function getSuggestedLatestModel(provider: string): string {
  const p = String(provider ?? "").trim().toLowerCase();
  if (p === "openai") return "gpt-5.2";
  if (p === "anthropic") return "claude-opus-4-1-20250805";
  if (p === "google_gemini") return "gemini-2.5-pro";
  if (p === "mistral") return "mistral-small-latest";
  if (p === "azure_openai") return "gpt-4o-prod";
  return "";
}

function getDefaultLlmBaseUrl(provider: string): string {
  const p = String(provider ?? "").trim().toLowerCase();
  if (p === "openai") return "https://api.openai.com/v1";
  if (p === "anthropic") return "https://api.anthropic.com/v1";
  if (p === "google_gemini") return "https://generativelanguage.googleapis.com/v1beta";
  if (p === "mistral") return "https://api.mistral.ai/v1";
  if (p === "azure_openai") return "https://api.openai.com/v1";
  return "https://api.openai.com/v1";
}

function getLlmModelSuggestions(provider: string): string[] {
  const p = String(provider ?? "").trim().toLowerCase();
  if (p === "openai") return ["gpt-5.2", "gpt-5.2-mini", "gpt-5.2-nano", "gpt-4.1", "gpt-4o"];
  if (p === "anthropic") {
    return ["claude-opus-4-1-20250805", "claude-sonnet-4-20250514", "claude-3-7-sonnet-latest", "claude-3-5-haiku-latest"];
  }
  if (p === "google_gemini") return ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-flash-latest"];
  if (p === "mistral") return ["mistral-large-latest", "mistral-medium-latest", "mistral-small-latest", "codestral-latest"];
  if (p === "azure_openai") return ["gpt-5-prod", "gpt-4.1-prod", "gpt-4o-prod"];
  return [getSuggestedLatestModel(provider) || "gpt-4o-mini"];
}

function parseBadgeInput(value: string): string[] {
  const parts = String(value ?? "")
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const badges: string[] = [];
  for (const part of parts) {
    const key = part.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    badges.push(part);
  }
  return badges;
}

function formatBadgesInput(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .join(", ");
}

function supportsAutomaticPricing(provider: string): boolean {
  const p = String(provider ?? "").trim().toLowerCase();
  const providersWithAutoPricing = new Set<string>(["openai", "anthropic", "google_gemini", "mistral"]);
  return providersWithAutoPricing.has(p);
}

function parsePositiveNumber(value: string): number | null {
  const v = String(value ?? "").trim().replace(",", ".");
  if (!v) return null;
  const parsed = Number(v);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function normalizeLlmBaseUrl(value: string): string {
  return String(value ?? "").trim().replace(/\/+$/, "").toLowerCase();
}

function createEmptyLlmModelDraft(provider: string, recommended = false): LlmCreateModelDraft {
  const normalizedProvider = String(provider ?? "").trim().toLowerCase();
  return {
    key: `${provider}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    model: getSuggestedLatestModel(provider) || "gpt-4o-mini",
    manual_model_input: normalizedProvider === "azure_openai",
    display_label: "",
    hint: "",
    badges: "",
    recommended,
    sort_order: recommended ? "10" : "100",
    temperature: "0.4",
    max_tokens: "900",
    input_cost_usd_per_1k: "",
    output_cost_usd_per_1k: "",
  };
}

function resolveLlmModelDraftTitle(modelDraft: LlmCreateModelDraft, index: number): string {
  const displayLabel = String(modelDraft.display_label ?? "").trim();
  if (displayLabel) return displayLabel;
  const model = String(modelDraft.model ?? "").trim();
  if (model) return model;
  return `Neues Modell ${index + 1}`;
}

async function readJsonSafe(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function extractErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function parseOptionalPositiveInteger(value: string, label: string): number | null {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`${label} muss eine positive Ganzzahl sein.`);
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} muss eine positive Ganzzahl sein.`);
  }
  return parsed;
}

function formatCsvInput(values: unknown): string {
  if (!Array.isArray(values)) return "";
  return values
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(", ");
}

function parseCsvNumberList(value: string, label: string): number[] {
  const parts = String(value ?? "")
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
  const seen = new Set<number>();
  const numbers: number[] = [];
  for (const part of parts) {
    if (!/^\d+$/.test(part)) {
      throw new Error(`${label} darf nur ganze Zahlen enthalten.`);
    }
    const parsed = Number(part);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error(`${label} darf nur positive IDs enthalten.`);
    }
    if (seen.has(parsed)) continue;
    seen.add(parsed);
    numbers.push(parsed);
  }
  return numbers;
}

function formatSyncResultMessage(result: CrmSyncResultPayload): string {
  if (result.skipped) {
    if (result.reason === "integration inactive") return "Die CRM-Anbindung ist derzeit deaktiviert.";
    if (result.reason === "all capabilities disabled") return "Alle CRM-Bereiche sind in dieser Anbindung deaktiviert.";
    return "Der CRM-Sync wurde übersprungen.";
  }

  const parts = [
    `${result.offers_count} Angebote`,
    `${result.references_count} Referenzen`,
    `${result.requests_count} Gesuche`,
  ];
  const extras: string[] = [];
  if (result.deactivated_offers > 0) extras.push(`${result.deactivated_offers} Angebote deaktiviert`);
  if (result.deactivated_listings > 0) extras.push(`${result.deactivated_listings} Rohobjekte deaktiviert`);
  if (result.notes?.length) extras.push(result.notes[0] ?? "");
  return `${parts.join(" · ")} synchronisiert${extras.length ? ` · ${extras.join(" · ")}` : ""}`;
}

function readCrmRuntime(settings: Record<string, unknown>, resource: "all" | CrmResourceKey): Record<string, unknown> {
  if (resource === "all") return settings;
  const runtimes = asObject(settings.sync_resources);
  return asObject(runtimes[resource]);
}

function readCrmPreviewRuntime(settings: Record<string, unknown>, resource: "all" | CrmResourceKey): Record<string, unknown> {
  if (resource === "all") return settings;
  const runtimes = asObject(settings.preview_resources);
  return asObject(runtimes[resource]);
}

function readSyncSummaryFromIntegration(
  integration: Integration,
  resource: "all" | CrmResourceKey = "all",
): IntegrationSyncSummary | null {
  const settings = asObject(integration.settings);
  const runtime = readCrmRuntime(settings, resource);
  const state = String(runtime.sync_state ?? "").trim().toLowerCase();
  const lastSyncAt = asText(integration.last_sync_at);
  const hasRuntimeData =
    Boolean(state)
    || Boolean(asText(runtime.sync_message))
    || Boolean(asText(runtime.sync_started_at))
    || Boolean(asText(runtime.sync_finished_at))
    || Array.isArray(runtime.sync_log);
  if (resource !== "all" && !hasRuntimeData) return null;
  if (resource === "all" && !state && !lastSyncAt) return null;

  const result = (runtime.sync_result ?? null) as CrmSyncResultPayload | null;
  const rawMessage = String(runtime.sync_message ?? "").trim();
  const errorClass = asText(runtime.sync_error_class);
  const isLegacyOperatorMessage =
    state !== "running"
    && (rawMessage.toLowerCase().includes("manuell zurückgesetzt") || rawMessage.toLowerCase().includes("manuell abgebrochen"));
  const isHistoricalOperatorNotice =
    (state === "idle" && (errorClass === "manual_reset" || errorClass === "cancelled"))
    || isLegacyOperatorMessage;
  const message =
    (isHistoricalOperatorNotice ? "" : rawMessage)
    || (result ? formatSyncResultMessage(result) : state === "running" ? "CRM-Synchronisierung läuft..." : "CRM-Synchronisierung");

  return {
    status:
      state === "running"
        ? "running"
        : state === "success"
          ? "ok"
          : state === "error"
          ? "error"
            : "warning",
    resource,
    mode: runtime.sync_mode === "full" || runtime.sync_mode === "guarded" ? runtime.sync_mode : null,
    message,
    startedAt: asText(runtime.sync_started_at),
    finishedAt: asText(runtime.sync_finished_at),
    lastSyncAt,
    errorClass: isHistoricalOperatorNotice ? null : errorClass,
    requestCount: typeof runtime.sync_request_count === "number" ? runtime.sync_request_count : null,
    pagesFetched: typeof runtime.sync_pages_fetched === "number" ? runtime.sync_pages_fetched : null,
    traceId: asText(runtime.sync_trace_id),
    step: asText(runtime.sync_step),
    heartbeatAt: asText(runtime.sync_heartbeat_at),
    deadlineAt: asText(runtime.sync_deadline_at),
    cancelRequested: runtime.sync_cancel_requested === true,
    log: Array.isArray(runtime.sync_log) ? (runtime.sync_log as SyncLogPayload[]) : [],
    result,
  };
}

function readPreviewSummaryFromIntegration(
  integration: Integration,
  resource: "all" | CrmResourceKey = "all",
): IntegrationPreviewSummary | null {
  const settings = asObject(integration.settings);
  const runtime = readCrmPreviewRuntime(settings, resource);
  const status = String(runtime.last_preview_status ?? "").trim().toLowerCase();
  const message = asText(runtime.last_preview_message);
  const testedAt = asText(runtime.last_preview_finished_at) ?? asText(runtime.last_previewed_at);
  if (resource !== "all" && !status && !message && !testedAt) return null;
  if (!status && !message && !testedAt) return null;
  return {
    status:
      status === "ok" || status === "warning" || status === "error"
        ? (status as IntegrationPreviewSummary["status"])
        : "warning",
    resource,
    message: message ?? "Kein CRM-Abruf-Test protokolliert.",
    testedAt,
    traceId: asText(runtime.last_preview_trace_id),
  };
}

function buildCrmIntegrationAdminDraft(integration: Integration): CrmIntegrationAdminDraft {
  const settings = asObject(integration.settings);
  const resourceFilters = asObject(settings.resource_filters);
  const listings = asObject(resourceFilters.listings);
  const references = asObject(resourceFilters.references);
  const guarded = asObject(settings.guarded);
  const units = asObject(guarded.units);
  const refLimits = asObject(guarded.references);
  const savedQueries = asObject(guarded.saved_queries);
  const resources = asObject(settings.resources);
  const requestResource = asObject(resources.requests);
  const requestFreshness = asObject(requestResource.freshness ?? settings.request_freshness);
  const readTargetObjects = (section: Record<string, unknown>) => {
    const direct = asText(section.target_objects);
    if (direct) return direct;
    const maxPages = typeof section.max_pages === "number" ? section.max_pages : Number(asText(section.max_pages) ?? "");
    const perPage = typeof section.per_page === "number" ? section.per_page : Number(asText(section.per_page) ?? "");
    if (Number.isFinite(maxPages) && Number.isFinite(perPage) && maxPages > 0 && perPage > 0) {
      return String(Math.floor(maxPages * perPage));
    }
    return "";
  };

  return {
    listingsStatusIds: formatCsvInput(listings.status_ids),
    referencesArchived: asText(references.archived) ?? "",
    referencesStatusIds: formatCsvInput(references.status_ids),
    referencesCustomFieldKey: asText(references.custom_field_key) ?? "",
    guardedUnitsTargetObjects: readTargetObjects(units),
    guardedReferencesTargetObjects: readTargetObjects(refLimits),
    guardedSavedQueriesTargetObjects: readTargetObjects(savedQueries),
    requestFreshnessEnabled: requestFreshness.enabled === true,
    requestFreshnessBasis: requestFreshness.basis === "last_seen_at" ? "last_seen_at" : "source_updated_at",
    requestFreshnessBuyDays: asText(requestFreshness.max_age_days_buy) ?? "",
    requestFreshnessRentDays: asText(requestFreshness.max_age_days_rent) ?? "",
    requestFreshnessFallbackToLastSeen: requestFreshness.fallback_to_last_seen === true,
  };
}

function applyCrmAdminDraftToSettings(
  integration: Integration,
  draft: CrmIntegrationAdminDraft,
): Record<string, unknown> {
  const settings = { ...asObject(integration.settings) };
  const resourceFilters = { ...asObject(settings.resource_filters) };
  const listings = { ...asObject(resourceFilters.listings) };
  const references = { ...asObject(resourceFilters.references) };
  const guarded = { ...asObject(settings.guarded) };
  const units = { ...asObject(guarded.units) };
  const referenceLimits = { ...asObject(guarded.references) };
  const savedQueries = { ...asObject(guarded.saved_queries) };
  const resources = { ...asObject(settings.resources) };
  const requestResource = { ...asObject(resources.requests) };

  const listingStatusIds = parseCsvNumberList(draft.listingsStatusIds, "Status-IDs für Angebote");
  if (listingStatusIds.length > 0) listings.status_ids = listingStatusIds;
  else delete listings.status_ids;

  const archived = asText(draft.referencesArchived);
  if (archived === "1" || archived === "0" || archived === "-1") references.archived = Number(archived);
  else delete references.archived;

  const statusIds = parseCsvNumberList(draft.referencesStatusIds, "Status-IDs für Referenzen");
  if (statusIds.length > 0) references.status_ids = statusIds;
  else delete references.status_ids;

  const customFieldKey = asText(draft.referencesCustomFieldKey);
  if (customFieldKey) references.custom_field_key = customFieldKey;
  else delete references.custom_field_key;

  const unitsTargetObjects = parseOptionalPositiveInteger(draft.guardedUnitsTargetObjects, "Guarded Angebote target_objects");
  const referencesTargetObjects = parseOptionalPositiveInteger(draft.guardedReferencesTargetObjects, "Guarded Referenzen target_objects");
  const savedQueriesTargetObjects = parseOptionalPositiveInteger(draft.guardedSavedQueriesTargetObjects, "Guarded Gesuche target_objects");

  if (unitsTargetObjects !== null) units.target_objects = unitsTargetObjects;
  else delete units.target_objects;
  delete units.max_pages;
  delete units.per_page;

  if (referencesTargetObjects !== null) referenceLimits.target_objects = referencesTargetObjects;
  else delete referenceLimits.target_objects;
  delete referenceLimits.max_pages;
  delete referenceLimits.per_page;

  if (savedQueriesTargetObjects !== null) savedQueries.target_objects = savedQueriesTargetObjects;
  else delete savedQueries.target_objects;
  delete savedQueries.max_pages;
  delete savedQueries.per_page;

  if (Object.keys(listings).length > 0) resourceFilters.listings = listings;
  else delete resourceFilters.listings;

  if (Object.keys(references).length > 0) resourceFilters.references = references;
  else delete resourceFilters.references;

  if (Object.keys(resourceFilters).length > 0) settings.resource_filters = resourceFilters;
  else delete settings.resource_filters;

  if (Object.keys(units).length > 0) guarded.units = units;
  else delete guarded.units;
  if (Object.keys(referenceLimits).length > 0) guarded.references = referenceLimits;
  else delete guarded.references;
  if (Object.keys(savedQueries).length > 0) guarded.saved_queries = savedQueries;
  else delete guarded.saved_queries;

  if (Object.keys(guarded).length > 0) settings.guarded = guarded;
  else delete settings.guarded;

  const freshnessEnabled = draft.requestFreshnessEnabled;
  const freshnessBuyDays = parseOptionalPositiveInteger(draft.requestFreshnessBuyDays, "Gesuche Freshness Kauf (Tage)");
  const freshnessRentDays = parseOptionalPositiveInteger(draft.requestFreshnessRentDays, "Gesuche Freshness Miete (Tage)");
  if (freshnessEnabled || freshnessBuyDays !== null || freshnessRentDays !== null) {
    requestResource.freshness = {
      enabled: freshnessEnabled,
      basis: draft.requestFreshnessBasis,
      max_age_days_buy: freshnessBuyDays,
      max_age_days_rent: freshnessRentDays,
      fallback_to_last_seen: draft.requestFreshnessFallbackToLastSeen,
    };
    settings.request_freshness = requestResource.freshness;
  } else {
    delete requestResource.freshness;
    delete settings.request_freshness;
  }

  if (Object.keys(requestResource).length > 0) {
    resources.requests = requestResource;
  } else {
    delete resources.requests;
  }

  if (Object.keys(resources).length > 0) settings.resources = resources;
  else delete settings.resources;

  return settings;
}

function formatPortalLocaleStatus(status: PortalLocaleStatus): string {
  if (status === "internal") return "intern";
  if (status === "live") return "live";
  return "geplant";
}

function formatCrmResourceLabel(resource: CrmResourceKey): string {
  if (resource === "offers") return "Angebote";
  if (resource === "references") return "Referenzen";
  return "Gesuche";
}

function formatCrmSyncModeLabel(mode: "guarded" | "full" | null | undefined): string {
  if (mode === "full") return "Vollsync";
  return "Guarded-Sync";
}

function getPortalLocaleBaseLanguage(locale: string): string {
  return normalizePortalLocaleCode(locale).split("-")[0] ?? "";
}

function formatPortalEntryStatus(status: PortalContentEntryStatus): string {
  if (status === "internal") return "intern";
  if (status === "live") return "live";
  return "entwurf";
}

function formatPortalTranslationOrigin(origin: string | null | undefined): string {
  if (origin === "ai") return "KI";
  if (origin === "sync_copy_all") return "komplett aus DE uebernommen";
  if (origin === "sync_fill_missing") return "fehlende Felder aus DE uebernommen";
  if (origin === "manual") return "manuell";
  return "unbekannt";
}

function buildPortalSystemTextDraftKey(locale: string, key: PortalSystemTextKey): string {
  return `${locale}::${key}`;
}

function buildMarketExplanationStandardDraftMap(args: {
  definitions: MarketExplanationStandardTextDefinition[];
  entries: MarketExplanationStandardEntry[];
}): Record<string, string> {
  const entryMap = new Map(args.entries.map((entry) => [entry.key, entry.value_text] as const));
  return args.definitions.reduce<Record<string, string>>((acc, definition) => {
    acc[definition.key] = entryMap.get(definition.key) ?? "";
    return acc;
  }, {});
}

function buildMarketExplanationStandardStatusDraftKey(locale: string, key: string): string {
  return `${locale}::${key}`;
}

function buildMarketExplanationStandardStatusDraftMap(args: {
  locale: string;
  definitions: MarketExplanationStandardTextDefinition[];
  entries: MarketExplanationStandardEntry[];
}): Record<string, MarketExplanationStandardTranslationStatus> {
  if (args.locale === "de") return {};
  const entryMap = new Map(args.entries.map((entry) => [entry.key, entry] as const));
  return args.definitions.reduce<Record<string, MarketExplanationStandardTranslationStatus>>((acc, definition) => {
    const entry = entryMap.get(definition.key);
    acc[buildMarketExplanationStandardStatusDraftKey(args.locale, definition.key)] =
      (entry?.override_status === "internal" || entry?.override_status === "live"
        ? entry.override_status
        : "draft") as MarketExplanationStandardTranslationStatus;
    return acc;
  }, {});
}

function buildMarketExplanationStandardEntryMap(
  entries: MarketExplanationStandardEntry[],
): Record<string, MarketExplanationStandardEntry> {
  return entries.reduce<Record<string, MarketExplanationStandardEntry>>((acc, entry) => {
    acc[entry.key] = entry;
    return acc;
  }, {});
}

function buildMarketExplanationStaticDraftKey(locale: string, key: MarketExplanationStaticTextKey): string {
  return `${locale}::${key}`;
}

function buildMarketExplanationStaticDraftMap(args: {
  locales: PortalLocaleConfigRecord[];
  definitions: MarketExplanationStaticTextDefinition[];
  entries: MarketExplanationStaticTextEntryRecord[];
}): Record<string, { status: MarketExplanationStaticTextEntryStatus; value_text: string }> {
  const entryMap = new Map(
    args.entries.map((entry) => [buildMarketExplanationStaticDraftKey(entry.locale, entry.key), entry] as const),
  );
  const locales = args.locales.length > 0 ? args.locales : [{ locale: "de" } as PortalLocaleConfigRecord];

  return locales.reduce<Record<string, { status: MarketExplanationStaticTextEntryStatus; value_text: string }>>((acc, localeRow) => {
    const locale = String(localeRow.locale ?? "").trim().toLowerCase() || "de";
    for (const def of args.definitions) {
      const draftKey = buildMarketExplanationStaticDraftKey(locale, def.key);
      const existing = entryMap.get(draftKey);
      acc[draftKey] = existing
        ? {
            status: existing.status,
            value_text: existing.value_text,
          }
        : {
            status: locale === "de" ? "live" : "draft",
            value_text: getMarketExplanationStaticTextDefaultValue(locale, def.key),
          };
    }
    return acc;
  }, {});
}

function buildPortalSystemTextDraftMap(args: {
  locales: PortalLocaleConfigRecord[];
  definitions: PortalSystemTextDefinition[];
  entries: PortalSystemTextEntryRecord[];
}): Record<string, { status: PortalSystemTextEntryStatus; value_text: string }> {
  const entryMap = new Map(
    args.entries.map((entry) => [buildPortalSystemTextDraftKey(entry.locale, entry.key), entry] as const),
  );
  const locales = args.locales.length > 0 ? args.locales : [{ locale: "de" } as PortalLocaleConfigRecord];

  return locales.reduce<Record<string, { status: PortalSystemTextEntryStatus; value_text: string }>>((acc, localeRow) => {
    const locale = String(localeRow.locale ?? "").trim().toLowerCase() || "de";
    for (const def of args.definitions) {
      const draftKey = buildPortalSystemTextDraftKey(locale, def.key);
      const existing = entryMap.get(draftKey);
      acc[draftKey] = existing
        ? {
            status: existing.status,
            value_text: existing.value_text,
          }
        : {
            status: locale === "de" ? "live" : "draft",
            value_text: getPortalSystemTextDefaultValue(locale, def.key),
          };
    }
    return acc;
  }, {});
}

type PersistedPortalCmsViewState = {
  pageKey?: string;
  locale?: string;
};

type PersistedAdminViewState = {
  activeView?: AdminView;
  navMode?: AdminNavMode;
  selectedPartnerId?: string;
  partnerTab?: PartnerPanelTab;
  integrationsAdminTab?: "overview" | "llm_partner";
  llmGlobalTab?: "create" | "overview" | "pricing" | "usage";
  marketExplanationMode?: "standard" | "static";
  marketExplanationStandardScope?: MarketExplanationStandardScope;
  marketExplanationStandardLocale?: string;
  marketExplanationStandardBundeslandSlug?: string;
  standardTextRefreshScope?: StandardTextRefreshScope;
  standardTextRefreshBundeslandSlug?: string;
  standardTextRefreshAreaId?: string;
  standardTextRefreshAreaName?: string;
  standardTextRefreshAreaSlug?: string;
  standardTextRefreshAreaParentSlug?: string;
  standardTextRefreshAreaBundeslandSlug?: string;
};

const PORTAL_CMS_VIEW_STATE_KEY = "admin_portal_cms_view_state_v1";
const PORTAL_CMS_SCROLL_STATE_KEY = "admin_portal_cms_scroll_v1";
const PORTAL_CMS_SOURCE_LOCALE = "de";
const ADMIN_VIEW_STATE_KEY = "admin_view_state_v1";

async function api<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  const data = await readJsonSafe(res);
  if (!res.ok) {
    throw new Error(String(data?.error ?? `HTTP ${res.status}`));
  }
  return data as T;
}

export default function AdminClient() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const adminModeBarRef = useRef<HTMLElement | null>(null);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>("");
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [areaMappings, setAreaMappings] = useState<AreaMapping[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [crmIntegrationDrafts, setCrmIntegrationDrafts] = useState<Record<string, CrmIntegrationAdminDraft>>({});
  const [status, setStatus] = useState<string>("Lade Admin-Daten...");
  const [adminDisplayName, setAdminDisplayName] = useState<string>("Admin");
  const [lastLogin, setLastLogin] = useState<string>("");
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [hoveredAdminNavId, setHoveredAdminNavId] = useState<string | null>(null);
  const [hoveredAdminNavTop, setHoveredAdminNavTop] = useState<number | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [areaQuery, setAreaQuery] = useState<string>("");
  const [areaOptions, setAreaOptions] = useState<AreaOption[]>([]);

  const [createPartner, setCreatePartner] = useState({
    company_name: "",
    contact_email: "",
    contact_first_name: "",
    contact_last_name: "",
    website_url: "",
  });
  const [createdPartnerSuccess, setCreatedPartnerSuccess] = useState<{
    mode: "created" | "existing";
    id: string;
    company_name: string;
    contact_email: string;
    delivery_sent?: boolean;
    delivery_message?: string | null;
  } | null>(null);
  const [createPartnerError, setCreatePartnerError] = useState<string | null>(null);

  const [editPartner, setEditPartner] = useState({
    company_name: "",
    contact_email: "",
    contact_first_name: "",
    contact_last_name: "",
    website_url: "",
    is_active: true,
    llm_partner_managed_allowed: false,
  });
  const [systempartnerDefaultProfile, setSystempartnerDefaultProfile] = useState<SystempartnerDefaultProfile>({
    ...EMPTY_SYSTEMPARTNER_DEFAULT_PROFILE,
  });
  const [systempartnerDefaultAvatarUpload, setSystempartnerDefaultAvatarUpload] = useState<{
    uploading: boolean;
    error: string | null;
  }>({
    uploading: false,
    error: null,
  });

  const [assignAreaId, setAssignAreaId] = useState("");
  const [handoverDraft, setHandoverDraft] = useState({
    area_id: "",
    new_partner_id: "",
    transfer_mode: "base_reset" as "base_reset" | "copy_partner_state",
    include_report_customization: true,
    include_seo_geo: true,
    blog_transfer_mode: "copy_as_draft" as HandoverBlogTransferMode,
    locale_modes: {} as Record<string, HandoverLocaleMode>,
  });

  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([]);
  const [reviewAreaId, setReviewAreaId] = useState<string>("");
  const [reviewData, setReviewData] = useState<AreaReviewPayload | null>(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [visibilityIndexBusy, setVisibilityIndexBusy] = useState(false);
  const [reviewActionError, setReviewActionError] = useState<string | null>(null);
  const [reviewActionMessage, setReviewActionMessage] = useState<string | null>(null);
  const [reviewNoteDraft, setReviewNoteDraft] = useState("");
  const [clearReviewOnSuccessClose, setClearReviewOnSuccessClose] = useState(false);
  const [reviewContentDismissed, setReviewContentDismissed] = useState(false);
  const [activeView, setActiveView] = useState<AdminView>("home");
  const [partnerTab, setPartnerTab] = useState<PartnerPanelTab>("profile");
  const [integrationsAdminTab, setIntegrationsAdminTab] = useState<"overview" | "llm_partner">("overview");
  const [llmGlobalTab, setLlmGlobalTab] = useState<"create" | "overview" | "pricing" | "usage">("create");
  const [navMode, setNavMode] = useState<AdminNavMode>("partners");
  const [partnerFilter, setPartnerFilter] = useState("");
  const [areaFilter, setAreaFilter] = useState("");
  const [onlyActiveList, setOnlyActiveList] = useState(true);
  const [successModal, setSuccessModal] = useState<{ open: boolean; title: string; message: string }>({
    open: false,
    title: "",
    message: "",
  });
  const [handoverConfirmModal, setHandoverConfirmModal] = useState<{
    open: boolean;
    areaId: string;
    areaLabel: string;
    oldPartnerId: string;
    newPartnerId: string;
    transferMode: "base_reset" | "copy_partner_state";
    includeReportCustomization: boolean;
    includeSeoGeo: boolean;
    blogTransferMode: HandoverBlogTransferMode;
    localeModes: Record<string, HandoverLocaleMode>;
    oldPartnerIsSystemDefault: boolean;
  }>({
    open: false,
    areaId: "",
    areaLabel: "",
    oldPartnerId: "",
    newPartnerId: "",
    transferMode: "base_reset",
    includeReportCustomization: true,
    includeSeoGeo: true,
    blogTransferMode: "copy_as_draft",
    localeModes: {},
    oldPartnerIsSystemDefault: false,
  });
  const [handoverStatusModal, setHandoverStatusModal] = useState<{
    open: boolean;
    title: string;
    lines: string[];
    done: boolean;
    hasError: boolean;
  }>({
    open: false,
    title: "",
    lines: [],
    done: false,
    hasError: false,
  });
  const [areaDeleteConfirmModal, setAreaDeleteConfirmModal] = useState<{
    open: boolean;
    areaId: string;
    areaName: string;
    isActive: boolean;
  }>({
    open: false,
    areaId: "",
    areaName: "",
    isActive: false,
  });
  const [integrationDeleteConfirmModal, setIntegrationDeleteConfirmModal] = useState<{
    open: boolean;
    integrationId: string;
    provider: string;
    kind: string;
  }>({
    open: false,
    integrationId: "",
    provider: "",
    kind: "",
  });
  const [partnerPurgeModal, setPartnerPurgeModal] = useState<{
    open: boolean;
    partnerId: string;
    partnerName: string;
    loading: boolean;
    deleting: boolean;
    errorMessage: string | null;
    canPurge: boolean;
    blockers: string[];
    summary: {
      areaMappingsTotal: number;
      integrationsActive: number;
      storageFiles: number;
    };
    confirmText: string;
  }>({
    open: false,
    partnerId: "",
    partnerName: "",
    loading: false,
    deleting: false,
    errorMessage: null,
    canPurge: false,
    blockers: [],
    summary: {
      areaMappingsTotal: 0,
      integrationsActive: 0,
      storageFiles: 0,
    },
    confirmText: "",
  });
  const [auditFilters, setAuditFilters] = useState({
    entity_type: "",
    event_type: "",
    actor_user_id: "",
    created_from: "",
    created_to: "",
    limit: 100,
  });
  const successModalRef = useRef<HTMLDivElement | null>(null);
  const handoverConfirmModalRef = useRef<HTMLDivElement | null>(null);
  const handoverStatusModalRef = useRef<HTMLDivElement | null>(null);
  const areaDeleteConfirmModalRef = useRef<HTMLDivElement | null>(null);
  const integrationDeleteConfirmModalRef = useRef<HTMLDivElement | null>(null);
  const partnerPurgeModalRef = useRef<HTMLDivElement | null>(null);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);

  const [llmGlobalConfig, setLlmGlobalConfig] = useState<LlmGlobalConfig>({
    central_enabled: true,
    monthly_token_budget: null,
    monthly_cost_budget_eur: null,
  });
  const [llmAccounts, setLlmAccounts] = useState<LlmProviderAccount[]>([]);
  const [llmProviders, setLlmProviders] = useState<LlmGlobalProvider[]>([]);
  const [llmUsageRows, setLlmUsageRows] = useState<LlmUsagePartnerRow[]>([]);
  const [llmUsageTotals, setLlmUsageTotals] = useState<{ tokens: number; cost_eur: number }>({ tokens: 0, cost_eur: 0 });
  const [llmUsageItems, setLlmUsageItems] = useState<LlmUsageItemRow[]>([]);
  const [llmUsageStatusRows, setLlmUsageStatusRows] = useState<LlmUsageStatusRow[]>([]);
  const [llmUsageMonth, setLlmUsageMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [partnerBillingRows, setPartnerBillingRows] = useState<LlmUsageItemRow[]>([]);
  const [partnerBillingTotals, setPartnerBillingTotals] = useState<{ tokens: number; cost_eur: number }>({ tokens: 0, cost_eur: 0 });
  const [partnerBillingMonth, setPartnerBillingMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [billingDefaultsDraft, setBillingDefaultsDraft] = useState({
    portal_base_price_eur: "50.00",
    portal_ortslage_price_eur: "1.00",
    portal_export_ortslage_price_eur: "1.00",
  });
  const [billingFeatureCatalog, setBillingFeatureCatalog] = useState<BillingFeature[]>([]);
  const [billingLocaleFeatureRows, setBillingLocaleFeatureRows] = useState<BillingLocaleFeature[]>([]);
  const [newBillingFeature, setNewBillingFeature] = useState({
    code: "",
    label: "",
    note: "",
    billing_unit: "pro Monat",
    default_enabled: false,
    default_monthly_price_eur: "5.00",
    sort_order: "100",
    is_active: true,
  });
  const [partnerPortalBillingDraft, setPartnerPortalBillingDraft] = useState({
    portal_base_price_eur: "",
    portal_ortslage_price_eur: "",
    portal_export_ortslage_price_eur: "",
  });
  const [partnerFeatureBillingRows, setPartnerFeatureBillingRows] = useState<PartnerBillingFeature[]>([]);
  const [partnerLocaleBillingRows, setPartnerLocaleBillingRows] = useState<PartnerLocaleBillingFeature[]>([]);
  const portalCmsPages = useMemo<PortalContentPageDefinition[]>(() => getPortalCmsPages(), []);
  const [portalLocaleConfigs, setPortalLocaleConfigs] = useState<PortalLocaleConfigRecord[]>([]);
  const [portalContentEntries, setPortalContentEntries] = useState<PortalContentEntryRecord[]>([]);
  const [portalContentMetas, setPortalContentMetas] = useState<PortalContentI18nMetaViewRecord[]>([]);
  const [portalSystemTextDefinitions, setPortalSystemTextDefinitions] = useState<PortalSystemTextDefinition[]>(PORTAL_SYSTEM_TEXT_DEFINITIONS);
  const [, setPortalSystemTextEntries] = useState<PortalSystemTextEntryRecord[]>([]);
  const [portalSystemTextMetas, setPortalSystemTextMetas] = useState<PortalSystemTextI18nMetaViewRecord[]>([]);
  const [portalSystemTextLocale, setPortalSystemTextLocale] = useState<string>("de");
  const [portalSystemTextActiveGroup, setPortalSystemTextActiveGroup] = useState<string>("Navigation");
  const [marketExplanationMode, setMarketExplanationMode] = useState<"standard" | "static">("standard");
  const [marketExplanationTab, setMarketExplanationTab] = useState<string>(MARKET_EXPLANATION_STANDARD_TABS[0]?.label ?? "Übersicht");
  const [marketExplanationStandardScope, setMarketExplanationStandardScope] = useState<MarketExplanationStandardScope>("kreis");
  const [marketExplanationStandardLocale, setMarketExplanationStandardLocale] = useState<string>("de");
  const [marketExplanationStandardBundeslaender, setMarketExplanationStandardBundeslaender] = useState<MarketExplanationStandardBundesland[]>([]);
  const [marketExplanationStandardBundeslandSlug, setMarketExplanationStandardBundeslandSlug] = useState<string>("");
  const [marketExplanationStandardDefinitions, setMarketExplanationStandardDefinitions] = useState<MarketExplanationStandardTextDefinition[]>(MARKET_EXPLANATION_STANDARD_TEXT_DEFINITIONS);
  const [marketExplanationStandardEntries, setMarketExplanationStandardEntries] = useState<MarketExplanationStandardEntry[]>([]);
  const [marketExplanationStandardDrafts, setMarketExplanationStandardDrafts] = useState<Record<string, string>>({});
  const [marketExplanationStandardStatusDrafts, setMarketExplanationStandardStatusDrafts] = useState<Record<string, MarketExplanationStandardTranslationStatus>>({});
  const [marketExplanationStaticLocale, setMarketExplanationStaticLocale] = useState<string>("de");
  const [marketExplanationStaticDefinitions, setMarketExplanationStaticDefinitions] = useState<MarketExplanationStaticTextDefinition[]>(MARKET_EXPLANATION_STATIC_TEXT_DEFINITIONS);
  const [, setMarketExplanationStaticEntries] = useState<MarketExplanationStaticTextEntryRecord[]>([]);
  const [marketExplanationStaticMetas, setMarketExplanationStaticMetas] = useState<MarketExplanationStaticTextI18nMetaViewRecord[]>([]);
  const [marketExplanationStaticDrafts, setMarketExplanationStaticDrafts] = useState<Record<string, {
    status: MarketExplanationStaticTextEntryStatus;
    value_text: string;
  }>>({});
  const [standardTextRefreshScope, setStandardTextRefreshScope] = useState<StandardTextRefreshScope>("bundesland");
  const [standardTextRefreshBundeslandSlug, setStandardTextRefreshBundeslandSlug] = useState<string>("");
  const [standardTextRefreshAreaQuery, setStandardTextRefreshAreaQuery] = useState<string>("");
  const [standardTextRefreshAreaOptions, setStandardTextRefreshAreaOptions] = useState<AreaOption[]>([]);
  const [standardTextRefreshSelection, setStandardTextRefreshSelection] = useState<StandardTextRefreshSelection | null>(null);
  const [standardTextRefreshResults, setStandardTextRefreshResults] = useState<StandardTextRefreshResult[]>([]);
  const [standardTextRefreshSummary, setStandardTextRefreshSummary] = useState<{
    dryRun: boolean;
    total: number;
    updated: number;
    skipped: number;
    failed: number;
  } | null>(null);
  const [standardTextSourceDefinitions, setStandardTextSourceDefinitions] = useState<MarketExplanationStandardTextDefinition[]>(
    getMarketExplanationStandardDefinitions("bundesland"),
  );
  const [standardTextSourceDrafts, setStandardTextSourceDrafts] = useState<Record<string, string>>({});
  const [standardTextSourceTab, setStandardTextSourceTab] = useState<string>(MARKET_EXPLANATION_STANDARD_TABS[0]?.label ?? "Übersicht");
  const [portalSystemTextDrafts, setPortalSystemTextDrafts] = useState<Record<string, {
    status: PortalSystemTextEntryStatus;
    value_text: string;
  }>>({});
  const [newPortalLocaleDraft, setNewPortalLocaleDraft] = useState<PortalLocaleConfigRecord>({
    locale: "",
    status: "planned",
    partner_bookable: false,
    is_active: false,
    label_native: "",
    label_de: "",
    bcp47_tag: "",
    fallback_locale: "de",
    text_direction: "ltr",
    number_locale: "",
    date_locale: "",
    currency_code: "EUR",
    billing_feature_code: "",
  });
  const [newPortalLocaleSetup, setNewPortalLocaleSetup] = useState({
    syncSystemTexts: true,
    syncPortalCms: true,
  });
  const [newPortalLocaleLanguageKey, setNewPortalLocaleLanguageKey] = useState<string>("");
  const [newPortalLocalePresetKey, setNewPortalLocalePresetKey] = useState<string>("");
  const adminInitialViewState = useMemo<PersistedAdminViewState>(() => ({
    activeView: "home",
    navMode: "partners",
    selectedPartnerId: "",
    partnerTab: "profile",
    integrationsAdminTab: "overview",
    llmGlobalTab: "create",
    marketExplanationMode: "standard",
    marketExplanationStandardScope: "kreis",
    marketExplanationStandardLocale: "de",
    marketExplanationStandardBundeslandSlug: "",
    standardTextRefreshScope: "bundesland",
    standardTextRefreshBundeslandSlug: "",
    standardTextRefreshAreaId: "",
    standardTextRefreshAreaName: "",
    standardTextRefreshAreaSlug: "",
    standardTextRefreshAreaParentSlug: "",
    standardTextRefreshAreaBundeslandSlug: "",
  }), []);
  const portalCmsInitialViewState = useMemo<PersistedPortalCmsViewState>(() => ({
    pageKey: "home",
    locale: "de",
  }), []);
  const [adminViewState, setAdminViewState, adminViewStateHydrated] = useSessionViewState<PersistedAdminViewState>(
    ADMIN_VIEW_STATE_KEY,
    adminInitialViewState,
  );
  const [portalCmsViewState, setPortalCmsViewState] = useSessionViewState<PersistedPortalCmsViewState>(
    PORTAL_CMS_VIEW_STATE_KEY,
    portalCmsInitialViewState,
  );
  const portalCmsPageKey = String(portalCmsViewState.pageKey ?? "home");
  const portalCmsLocale = String(portalCmsViewState.locale ?? "de");
  const availableNewPortalLocaleLanguages = useMemo(() => PORTAL_LOCALE_LANGUAGE_PRESETS
    .map((language) => ({
      ...language,
      variants: language.variants.filter((variant) => !portalLocaleConfigs.some((row) => row.locale === variant.locale)),
    }))
    .filter((language) => language.variants.length > 0), [portalLocaleConfigs]);
  const selectedNewPortalLocaleLanguage = useMemo(
    () => availableNewPortalLocaleLanguages.find((language) => language.language_key === newPortalLocaleLanguageKey) ?? null,
    [availableNewPortalLocaleLanguages, newPortalLocaleLanguageKey],
  );
  const [portalCmsDrafts, setPortalCmsDrafts] = useState<Record<string, {
    status: PortalContentEntryStatus;
    fields_json: Record<string, string>;
  }>>({});
  const pendingPortalCmsScrollRestoreRef = useRef(false);
  const adminViewStateAppliedRef = useRef(false);
  const adminBootstrapRef = useRef(false);
  const auditLoadingRef = useRef(false);
  const [auditLoadedOnce, setAuditLoadedOnce] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [llmProviderDrafts, setLlmProviderDrafts] = useState<Record<string, Partial<{
    model: string;
    display_label: string;
    hint: string;
    badges: string;
    recommended: boolean;
    base_url: string;
    api_version: string;
    priority: string;
    temperature: string;
    max_tokens: string;
    input_cost_usd_per_1k: string;
    output_cost_usd_per_1k: string;
  }>>>({});
  const [newLlmAccount, setNewLlmAccount] = useState({
    existing_account_id: "",
    provider: "openai",
    display_name: "",
    base_url: "https://api.openai.com/v1",
    api_version: "",
    auth_type: "api_key",
    api_key: "",
  });
  const [newLlmModels, setNewLlmModels] = useState<LlmCreateModelDraft[]>([createEmptyLlmModelDraft("openai", true)]);
  const [expandedLlmModelKey, setExpandedLlmModelKey] = useState<string | null>(null);
  const [llmCreateTestBusy, setLlmCreateTestBusy] = useState(false);
  const [llmCreateTestResult, setLlmCreateTestResult] = useState<{
    status: "ok" | "error";
    message: string;
  } | null>(null);
  const [llmCreateSaveResult, setLlmCreateSaveResult] = useState<{
    status: "ok" | "error" | "info";
    message: string;
  } | null>(null);
  const [llmOverviewTestBusyId, setLlmOverviewTestBusyId] = useState<string | null>(null);
  const [llmOverviewTestResults, setLlmOverviewTestResults] = useState<Record<string, {
    status: "ok" | "error";
    message: string;
  }>>({});

  const llmProviderSpecs = useMemo(() => getProvidersForKind("llm"), []);
  const llmModelOptions = useMemo(() => getLlmModelSuggestions(newLlmAccount.provider), [newLlmAccount.provider]);
  const selectedExistingLlmAccount = useMemo(
    () => llmAccounts.find((account) => account.id === newLlmAccount.existing_account_id) ?? null,
    [llmAccounts, newLlmAccount.existing_account_id],
  );
  const matchedExistingLlmAccount = useMemo(() => (
    llmAccounts.find((account) =>
      String(account.provider ?? "").trim().toLowerCase() === String(newLlmAccount.provider ?? "").trim().toLowerCase()
      && normalizeLlmBaseUrl(account.base_url) === normalizeLlmBaseUrl(newLlmAccount.base_url),
    ) ?? null
  ), [llmAccounts, newLlmAccount.base_url, newLlmAccount.provider]);
  const effectiveExistingLlmAccount = selectedExistingLlmAccount ?? matchedExistingLlmAccount;
  const effectiveExistingLlmAccountHasApiKey = useMemo(() => {
    const auth = (effectiveExistingLlmAccount?.auth_config ?? {}) as Record<string, unknown>;
    return Boolean(String(auth.api_key ?? auth.api_key_encrypted ?? "").trim());
  }, [effectiveExistingLlmAccount]);
  const llmAccountReadyForModels = Boolean(effectiveExistingLlmAccount?.id && effectiveExistingLlmAccountHasApiKey);
  const selectedPortalCmsPage = useMemo(
    () => portalCmsPages.find((page) => page.page_key === portalCmsPageKey) ?? portalCmsPages[0] ?? null,
    [portalCmsPageKey, portalCmsPages],
  );
  const setPortalCmsPageKey = (pageKey: string) => {
    setPortalCmsViewState((prev) => ({ ...prev, pageKey }));
  };
  const setPortalCmsLocale = (locale: string) => {
    setPortalCmsViewState((prev) => ({ ...prev, locale }));
  };
  const activePortalLocales = useMemo(
    () => portalLocaleConfigs.filter((row) => row.is_active).sort((a, b) => a.locale.localeCompare(b.locale, "de")),
    [portalLocaleConfigs],
  );
  const portalSystemTextMetaMap = useMemo(
    () => new Map(portalSystemTextMetas.map((meta) => [`${meta.locale}::${meta.key}`, meta] as const)),
    [portalSystemTextMetas],
  );
  const portalSystemTextGroups = useMemo(() => {
    const groups = new Map<string, PortalSystemTextDefinition[]>();
    for (const def of portalSystemTextDefinitions) {
      const current = groups.get(def.group) ?? [];
      current.push(def);
      groups.set(def.group, current);
    }
    return Array.from(groups.entries());
  }, [portalSystemTextDefinitions]);
  const activePortalSystemTextGroups = useMemo(
    () => portalSystemTextGroups.find(([groupName]) => groupName === portalSystemTextActiveGroup)?.[1] ?? portalSystemTextGroups[0]?.[1] ?? [],
    [portalSystemTextActiveGroup, portalSystemTextGroups],
  );
  const activeMarketExplanationStandardDefinitions = useMemo(
    () => marketExplanationStandardDefinitions.filter((definition) => {
      const tab = MARKET_EXPLANATION_STANDARD_TABS.find((entry) => entry.id === definition.tab);
      return (tab?.label ?? definition.tab) === marketExplanationTab;
    }),
    [marketExplanationStandardDefinitions, marketExplanationTab],
  );
  const standardTextRefreshSourceScope = standardTextRefreshScope === "bundesland" ? "bundesland" : "kreis";
  const standardTextSourceVisibleTabs = useMemo(() => {
    const allowed = new Set(standardTextSourceDefinitions.map((definition) => definition.tab));
    return MARKET_EXPLANATION_STANDARD_TABS.filter((tab) => allowed.has(tab.id));
  }, [standardTextSourceDefinitions]);
  const activeStandardTextSourceDefinitions = useMemo(
    () => standardTextSourceDefinitions.filter((definition) => {
      const tab = MARKET_EXPLANATION_STANDARD_TABS.find((entry) => entry.id === definition.tab);
      return (tab?.label ?? definition.tab) === standardTextSourceTab;
    }),
    [standardTextSourceDefinitions, standardTextSourceTab],
  );
  const marketExplanationVisibleTabs = useMemo(() => {
    const sourceDefinitions = marketExplanationMode === "standard"
      ? marketExplanationStandardDefinitions
      : marketExplanationStaticDefinitions;
    const allowed = new Set(sourceDefinitions.map((definition) => definition.tab));
    return MARKET_EXPLANATION_STANDARD_TABS.filter((tab) => allowed.has(tab.id));
  }, [marketExplanationMode, marketExplanationStandardDefinitions, marketExplanationStaticDefinitions]);
  const marketExplanationStandardEntryMap = useMemo(
    () => buildMarketExplanationStandardEntryMap(marketExplanationStandardEntries),
    [marketExplanationStandardEntries],
  );
  const marketExplanationStaticMetaMap = useMemo(
    () => new Map(marketExplanationStaticMetas.map((meta) => [`${meta.locale}::${meta.key}`, meta] as const)),
    [marketExplanationStaticMetas],
  );
  const activeMarketExplanationStaticDefinitions = useMemo(
    () => marketExplanationStaticDefinitions.filter((definition) => {
      const tab = MARKET_EXPLANATION_STANDARD_TABS.find((entry) => entry.id === definition.tab);
      return (tab?.label ?? definition.tab) === marketExplanationTab;
    }),
    [marketExplanationStaticDefinitions, marketExplanationTab],
  );
  const portalContentMetaMap = useMemo(
    () => new Map(portalContentMetas.map((meta) => [`${meta.page_key}::${meta.section_key}::${meta.locale}`, meta] as const)),
    [portalContentMetas],
  );

  useEffect(() => {
    if (newLlmModels.length === 0) {
      setExpandedLlmModelKey(null);
      return;
    }
    if (!newLlmModels.some((item) => item.key === expandedLlmModelKey)) {
      setExpandedLlmModelKey(newLlmModels[0]?.key ?? null);
    }
  }, [expandedLlmModelKey, newLlmModels]);

  useEffect(() => {
    const anyModalOpen =
      successModal.open || handoverConfirmModal.open || handoverStatusModal.open || areaDeleteConfirmModal.open || integrationDeleteConfirmModal.open || partnerPurgeModal.open;

    if (anyModalOpen) {
      if (!lastFocusedElementRef.current && document.activeElement instanceof HTMLElement) {
        lastFocusedElementRef.current = document.activeElement;
      }
      const target =
        (successModal.open ? successModalRef.current : null) ??
        (handoverConfirmModal.open ? handoverConfirmModalRef.current : null) ??
        (handoverStatusModal.open ? handoverStatusModalRef.current : null) ??
        (areaDeleteConfirmModal.open ? areaDeleteConfirmModalRef.current : null) ??
        (integrationDeleteConfirmModal.open ? integrationDeleteConfirmModalRef.current : null) ??
        (partnerPurgeModal.open ? partnerPurgeModalRef.current : null);
      if (target) {
        window.setTimeout(() => target.focus(), 0);
      }
      return;
    }

    if (lastFocusedElementRef.current) {
      lastFocusedElementRef.current.focus();
      lastFocusedElementRef.current = null;
    }
  }, [successModal.open, handoverConfirmModal.open, handoverStatusModal.open, areaDeleteConfirmModal.open, integrationDeleteConfirmModal.open, partnerPurgeModal.open]);

  useEffect(() => {
    if (!portalCmsPages.some((page) => page.page_key === portalCmsPageKey) && portalCmsPages[0]) {
      setPortalCmsPageKey(portalCmsPages[0].page_key);
    }
  }, [portalCmsPageKey, portalCmsPages]);

  useEffect(() => {
    if (!portalLocaleConfigs.some((row) => row.locale === portalCmsLocale) && portalLocaleConfigs[0]?.locale) {
      setPortalCmsLocale(portalLocaleConfigs[0].locale);
    }
  }, [portalCmsLocale, portalLocaleConfigs]);

  useEffect(() => {
    if (!selectedPortalCmsPage || !portalCmsLocale) return;
    setPortalCmsDrafts((prev) => {
      let changed = false;
      const next = { ...prev };
      const pageLocaleEntries = portalContentEntries.filter((entry) =>
        entry.locale === portalCmsLocale
        && entry.page_key === selectedPortalCmsPage.page_key,
      );
      for (const section of selectedPortalCmsPage.sections) {
        const key = `${portalCmsLocale}::${selectedPortalCmsPage.page_key}::${section.section_key}`;
        const existingEntry = pageLocaleEntries.find((entry) =>
          entry.section_key === section.section_key,
        );
        const hasContentWrapField = section.fields.some((field) => field.type === "content_wraps");
        const migratedWraps = !existingEntry && hasContentWrapField
          ? migratePortalContentWraps(selectedPortalCmsPage.page_key, pageLocaleEntries)
          : [];
        const existingFields = existingEntry?.fields_json as Record<string, string> | undefined;
        const migratedFields = migratedWraps.length > 0
          ? { wraps: serializePortalContentWraps(migratedWraps) }
          : undefined;
        const normalizedExistingFields = normalizePortalCmsFields(
          section,
          existingFields ?? migratedFields,
        );
        const normalizedDraftFields = normalizePortalCmsFields(
          section,
          next[key]?.fields_json as Record<string, string> | undefined,
        );
        const nextDraft = {
          status: existingEntry?.status ?? next[key]?.status ?? "draft",
          fields_json: existingEntry
            ? {
                ...normalizedExistingFields,
              }
            : {
                ...normalizedDraftFields,
              },
        };
        const currentDraft = next[key];
        if (!currentDraft || JSON.stringify(currentDraft) !== JSON.stringify(nextDraft)) {
          next[key] = nextDraft;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [portalCmsLocale, portalContentEntries, selectedPortalCmsPage]);

  useEffect(() => {
    if (!pendingPortalCmsScrollRestoreRef.current) return;
    pendingPortalCmsScrollRestoreRef.current = false;
    restoreSessionScroll(PORTAL_CMS_SCROLL_STATE_KEY);
  }, [portalContentEntries, portalCmsLocale, portalCmsPageKey]);

  useEffect(() => {
    if (!adminViewStateHydrated || adminViewStateAppliedRef.current) return;
    const restoredActiveView = adminViewState.activeView ?? "home";
    const restoredMarketExplanationMode = adminViewState.marketExplanationMode ?? "standard";
    const restoredMarketExplanationScope = adminViewState.marketExplanationStandardScope ?? "kreis";
    const restoredMarketExplanationLocale = String(adminViewState.marketExplanationStandardLocale ?? "de").trim().toLowerCase() || "de";
    const restoredMarketExplanationBundeslandSlug = String(adminViewState.marketExplanationStandardBundeslandSlug ?? "").trim().toLowerCase();
    const restoredStandardTextRefreshScope = adminViewState.standardTextRefreshScope ?? "bundesland";
    const restoredStandardTextRefreshBundeslandSlug = String(adminViewState.standardTextRefreshBundeslandSlug ?? "").trim().toLowerCase();
    const restoredStandardTextRefreshAreaId = String(adminViewState.standardTextRefreshAreaId ?? "").trim();
    const restoredStandardTextRefreshAreaName = String(adminViewState.standardTextRefreshAreaName ?? "").trim();
    const restoredStandardTextRefreshAreaSlug = String(adminViewState.standardTextRefreshAreaSlug ?? "").trim();
    const restoredStandardTextRefreshAreaParentSlug = String(adminViewState.standardTextRefreshAreaParentSlug ?? "").trim();
    const restoredStandardTextRefreshAreaBundeslandSlug = String(adminViewState.standardTextRefreshAreaBundeslandSlug ?? "").trim();
    setActiveView(restoredActiveView);
    setNavMode(adminViewState.navMode ?? "partners");
    setSelectedPartnerId(String(adminViewState.selectedPartnerId ?? ""));
    setPartnerTab(adminViewState.partnerTab ?? "profile");
    setIntegrationsAdminTab(adminViewState.integrationsAdminTab ?? "overview");
    setLlmGlobalTab(adminViewState.llmGlobalTab ?? "create");
    setMarketExplanationMode(restoredMarketExplanationMode);
    setMarketExplanationStandardScope(restoredMarketExplanationScope);
    setMarketExplanationStandardLocale(restoredMarketExplanationLocale);
    setMarketExplanationStandardBundeslandSlug(restoredMarketExplanationBundeslandSlug);
    setStandardTextRefreshScope(restoredStandardTextRefreshScope);
    setStandardTextRefreshBundeslandSlug(restoredStandardTextRefreshBundeslandSlug);
    setStandardTextRefreshSelection(restoredStandardTextRefreshAreaId ? {
      id: restoredStandardTextRefreshAreaId,
      name: restoredStandardTextRefreshAreaName || restoredStandardTextRefreshAreaId,
      slug: restoredStandardTextRefreshAreaSlug || null,
      parent_slug: restoredStandardTextRefreshAreaParentSlug || null,
      bundesland_slug: restoredStandardTextRefreshAreaBundeslandSlug || null,
    } : null);
    setStandardTextRefreshAreaQuery(restoredStandardTextRefreshAreaId
      ? formatAreaOptionLabel({
        id: restoredStandardTextRefreshAreaId,
        name: restoredStandardTextRefreshAreaName || restoredStandardTextRefreshAreaId,
        slug: restoredStandardTextRefreshAreaSlug || null,
        parent_slug: restoredStandardTextRefreshAreaParentSlug || null,
        bundesland_slug: restoredStandardTextRefreshAreaBundeslandSlug || null,
      })
      : "");
    if (restoredActiveView === "llm_global") {
      void loadLlmGlobalDashboard();
    } else if (restoredActiveView === "billing_defaults") {
      void loadBillingDefaults();
    } else if (restoredActiveView === "language_admin") {
      void loadPortalCms();
    } else if (restoredActiveView === "system_texts") {
      void loadPortalCms();
    } else if (restoredActiveView === "market_texts") {
      void Promise.all([
        loadMarketExplanationStandardTexts({
          scope: restoredMarketExplanationScope,
          bundeslandSlug: restoredMarketExplanationBundeslandSlug || undefined,
          locale: restoredMarketExplanationScope === "bundesland" ? restoredMarketExplanationLocale : "de",
        }),
        loadMarketExplanationStaticTexts(),
      ]);
    } else if (restoredActiveView === "standard_text_refresh") {
      void Promise.all([
        loadMarketExplanationBundeslaender(),
        loadStandardTextSource(restoredStandardTextRefreshScope === "bundesland" ? "bundesland" : "kreis"),
      ]);
    } else if (restoredActiveView === "portal_cms") {
      void loadPortalCms();
    }
    adminViewStateAppliedRef.current = true;
  }, [
    adminViewState.activeView,
    adminViewState.integrationsAdminTab,
    adminViewState.llmGlobalTab,
    adminViewState.navMode,
    adminViewState.partnerTab,
    adminViewState.selectedPartnerId,
    adminViewState.marketExplanationMode,
    adminViewState.marketExplanationStandardBundeslandSlug,
    adminViewState.marketExplanationStandardLocale,
    adminViewState.marketExplanationStandardScope,
    adminViewState.standardTextRefreshAreaBundeslandSlug,
    adminViewState.standardTextRefreshAreaId,
    adminViewState.standardTextRefreshAreaName,
    adminViewState.standardTextRefreshAreaParentSlug,
    adminViewState.standardTextRefreshAreaSlug,
    adminViewState.standardTextRefreshBundeslandSlug,
    adminViewState.standardTextRefreshScope,
    adminViewStateHydrated,
  ]);

  useEffect(() => {
    if (portalSystemTextGroups.length === 0) return;
    if (!portalSystemTextGroups.some(([groupName]) => groupName === portalSystemTextActiveGroup)) {
      setPortalSystemTextActiveGroup(portalSystemTextGroups[0]?.[0] ?? "Navigation");
    }
  }, [portalSystemTextActiveGroup, portalSystemTextGroups]);

  useEffect(() => {
    if (marketExplanationVisibleTabs.length === 0) return;
    if (!marketExplanationVisibleTabs.some((tab) => tab.label === marketExplanationTab)) {
      setMarketExplanationTab(marketExplanationVisibleTabs[0]?.label ?? "Übersicht");
    }
  }, [marketExplanationTab, marketExplanationVisibleTabs]);

  useEffect(() => {
    if (standardTextSourceVisibleTabs.length === 0) return;
    if (!standardTextSourceVisibleTabs.some((tab) => tab.label === standardTextSourceTab)) {
      setStandardTextSourceTab(standardTextSourceVisibleTabs[0]?.label ?? "Übersicht");
    }
  }, [standardTextSourceTab, standardTextSourceVisibleTabs]);

  useEffect(() => {
    if (marketExplanationStandardBundeslaender.length === 0) return;
    if (!marketExplanationStandardBundeslaender.some((entry) => entry.slug === marketExplanationStandardBundeslandSlug)) {
      setMarketExplanationStandardBundeslandSlug(marketExplanationStandardBundeslaender[0]?.slug ?? "");
    }
  }, [marketExplanationStandardBundeslandSlug, marketExplanationStandardBundeslaender]);

  useEffect(() => {
    if (marketExplanationStandardBundeslaender.length === 0) return;
    if (!marketExplanationStandardBundeslaender.some((entry) => entry.slug === standardTextRefreshBundeslandSlug)) {
      setStandardTextRefreshBundeslandSlug(marketExplanationStandardBundeslaender[0]?.slug ?? "");
    }
  }, [marketExplanationStandardBundeslaender, standardTextRefreshBundeslandSlug]);

  useEffect(() => {
    if (marketExplanationMode !== "standard" || marketExplanationStandardScope !== "bundesland") return;
    if (!marketExplanationStandardBundeslandSlug) return;
    void loadMarketExplanationStandardTexts({
      scope: "bundesland",
      bundeslandSlug: marketExplanationStandardBundeslandSlug,
      locale: marketExplanationStandardLocale,
    });
  }, [marketExplanationMode, marketExplanationStandardBundeslandSlug, marketExplanationStandardLocale, marketExplanationStandardScope]);

  useEffect(() => {
    if (marketExplanationStandardScope !== "bundesland") return;
    if (portalLocaleConfigs.length === 0) return;
    if (!portalLocaleConfigs.some((row) => row.locale === marketExplanationStandardLocale)) {
      const fallbackLocale = portalLocaleConfigs.find((row) => row.locale === "de")?.locale
        ?? portalLocaleConfigs.find((row) => row.is_active)?.locale
        ?? portalLocaleConfigs[0]?.locale
        ?? "de";
      setMarketExplanationStandardLocale(fallbackLocale);
    }
  }, [marketExplanationStandardLocale, marketExplanationStandardScope, portalLocaleConfigs]);

  useEffect(() => {
    if (portalLocaleConfigs.length === 0) return;
    if (!portalLocaleConfigs.some((row) => row.locale === marketExplanationStaticLocale)) {
      const fallbackLocale = portalLocaleConfigs.find((row) => row.is_active)?.locale ?? portalLocaleConfigs[0]?.locale ?? "de";
      setMarketExplanationStaticLocale(fallbackLocale);
    }
  }, [marketExplanationStaticLocale, portalLocaleConfigs]);

  useEffect(() => {
    if (!standardTextRefreshAreaQuery.trim()) {
      setStandardTextRefreshAreaOptions([]);
      return;
    }
    if (
      standardTextRefreshSelection
      && standardTextRefreshAreaQuery.trim() === formatAreaOptionLabel(standardTextRefreshSelection)
    ) {
      setStandardTextRefreshAreaOptions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const data = await api<{ areas: AreaOption[] }>(
          `/api/admin/areas?q=${encodeURIComponent(standardTextRefreshAreaQuery)}&limit=20`,
        );
        setStandardTextRefreshAreaOptions(data.areas ?? []);
      } catch {
        setStandardTextRefreshAreaOptions([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [standardTextRefreshAreaQuery, standardTextRefreshSelection]);

  useEffect(() => {
    setStandardTextRefreshResults([]);
    setStandardTextRefreshSummary(null);
  }, [standardTextRefreshScope, standardTextRefreshBundeslandSlug, standardTextRefreshSelection?.id]);

  useEffect(() => {
    if (activeView !== "standard_text_refresh") return;
    void loadStandardTextSource(standardTextRefreshSourceScope);
  }, [activeView, standardTextRefreshSourceScope]);

  useEffect(() => {
    if (partnerTab === "systempartner_default" && !selectedPartner?.is_system_default) {
      setPartnerTab("profile");
    }
  }, [partnerTab, selectedPartner?.is_system_default]);

  useEffect(() => {
    if (activeView !== "partner_edit") return;
    if (partnerTab !== "systempartner_default") return;
    if (!selectedPartner?.is_system_default) return;
    void loadSystempartnerDefaultProfile();
  }, [activeView, partnerTab, selectedPartner?.id, selectedPartner?.is_system_default]);

  useEffect(() => {
    if (!adminViewStateHydrated || !adminViewStateAppliedRef.current) return;
    setAdminViewState({
      activeView,
      navMode,
      selectedPartnerId,
      partnerTab,
      integrationsAdminTab,
      llmGlobalTab,
      marketExplanationMode,
      marketExplanationStandardScope,
      marketExplanationStandardLocale,
      marketExplanationStandardBundeslandSlug,
      standardTextRefreshScope,
      standardTextRefreshBundeslandSlug,
      standardTextRefreshAreaId: standardTextRefreshSelection?.id ?? "",
      standardTextRefreshAreaName: standardTextRefreshSelection?.name ?? "",
      standardTextRefreshAreaSlug: String(standardTextRefreshSelection?.slug ?? ""),
      standardTextRefreshAreaParentSlug: String(standardTextRefreshSelection?.parent_slug ?? ""),
      standardTextRefreshAreaBundeslandSlug: String(standardTextRefreshSelection?.bundesland_slug ?? ""),
    });
  }, [
    activeView,
    adminViewStateHydrated,
    integrationsAdminTab,
    llmGlobalTab,
    marketExplanationMode,
    marketExplanationStandardBundeslandSlug,
    marketExplanationStandardLocale,
    marketExplanationStandardScope,
    navMode,
    partnerTab,
    selectedPartnerId,
    standardTextRefreshBundeslandSlug,
    standardTextRefreshScope,
    standardTextRefreshSelection,
    setAdminViewState,
  ]);

  const formatPartnerName = (partner: Pick<Partner, "company_name">) =>
    partner.company_name;

  const selectedPartnerLabel = selectedPartner
    ? `${formatPartnerName(selectedPartner)} (${selectedPartner.id})`
    : "Kein Partner ausgewählt";
  const areaOverview = useMemo(() => buildAreaOverviewRows(partners), [partners]);

  const partnerIdsWithAreaMapping = useMemo(() => {
    const ids = new Set<string>();
    for (const row of areaOverview) ids.add(row.partnerId);
    return ids;
  }, [areaOverview]);

  const partnerNeedsAssignment = useMemo(() => {
    const pending = new Set<string>();
    for (const p of partners) {
      if (!p.is_active) continue;
      if (!partnerIdsWithAreaMapping.has(p.id)) pending.add(p.id);
    }
    return pending;
  }, [partners, partnerIdsWithAreaMapping]);
  const partnerWorkflowSignalById = useMemo(() => {
    const byPartner = new Map<string, string[]>();
    for (const row of areaOverview) {
      const list = byPartner.get(row.partnerId) ?? [];
      list.push(String(row.activationStatus ?? ""));
      byPartner.set(row.partnerId, list);
    }
    const result = new Map<string, WorkflowSignalTone>();
    for (const partner of partners) {
      const states = byPartner.get(partner.id) ?? [];
      result.set(
        partner.id,
        resolveWorkflowSignalTone(
          states,
          partnerNeedsAssignment.has(partner.id),
          Boolean(partner.is_active),
          Boolean(partner.is_system_default),
        ),
      );
    }
    return result;
  }, [areaOverview, partners, partnerNeedsAssignment]);
  const filteredPartners = useMemo(() => {
    const q = partnerFilter.trim().toLowerCase();
    return partners
      .filter((p) => {
        if (onlyActiveList && !p.is_active) return false;
        if (!q) return true;
        const hay = [
          p.company_name ?? "",
          p.contact_email ?? "",
          p.id ?? "",
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => {
        const aDefault = a.is_system_default ? 1 : 0;
        const bDefault = b.is_system_default ? 1 : 0;
        if (aDefault !== bDefault) return bDefault - aDefault;
        const signalPriority = (tone: WorkflowSignalTone) => {
          if (tone === "red") return 3;
          if (tone === "orange") return 2;
          if (tone === "green") return 1;
          return 0;
        };
        const aPriority = signalPriority(partnerWorkflowSignalById.get(a.id) ?? "none");
        const bPriority = signalPriority(partnerWorkflowSignalById.get(b.id) ?? "none");
        if (aPriority !== bPriority) return bPriority - aPriority;
        const aInactive = a.is_active ? 0 : 1;
        const bInactive = b.is_active ? 0 : 1;
        if (aInactive !== bInactive) return bInactive - aInactive;
        return String(a.company_name ?? "").localeCompare(String(b.company_name ?? ""), "de");
      });
  }, [partners, partnerFilter, onlyActiveList, partnerWorkflowSignalById]);

  const filteredAreaOverview = useMemo(() => {
    const q = areaFilter.trim().toLowerCase();
    return areaOverview.filter((row) => {
      if (onlyActiveList && !row.isActive) return false;
      if (!q) return true;
      const hay = [
        row.kreisName,
        row.kreisId,
        row.partnerName,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [areaOverview, areaFilter, onlyActiveList]);

  const pendingAreaAssignmentCount = useMemo(() => partnerNeedsAssignment.size, [partnerNeedsAssignment]);

  useEffect(() => {
    if (navMode !== "partners") return;
    if (pendingAreaAssignmentCount <= 0) return;
    setOnlyActiveList(false);
  }, [navMode, pendingAreaAssignmentCount]);

  useEffect(() => {
    if (!adminViewStateHydrated || !adminViewStateAppliedRef.current) return;
    const persistedPartnerId = String(adminViewState.selectedPartnerId ?? "").trim();
    if (!persistedPartnerId) return;
    if (!partners.some((partner) => partner.id === persistedPartnerId)) return;
    setSelectedPartnerId((current) => current || persistedPartnerId);
  }, [adminViewState.selectedPartnerId, adminViewStateHydrated, partners]);

  const displayAreaRows = useMemo<DisplayAreaRow[]>(() => {
    const getKreisId = (areaId: string) =>
      String(areaId ?? "")
        .split("-")
        .slice(0, 3)
        .join("-");

    const kreisLevel = areaMappings.filter((m) => String(m.area_id ?? "").split("-").length <= 3);
    if (kreisLevel.length > 0) {
      return kreisLevel.map((mapping) => ({
        key: mapping.id,
        displayKreisId: mapping.area_id,
        mapping,
        derivedFromOrtslagen: false,
        sourceCount: 1,
      }));
    }

    const byKreis = new Map<string, { mapping: AreaMapping; count: number }>();
    for (const mapping of areaMappings) {
      const kreisId = getKreisId(mapping.area_id) || mapping.area_id;
      const existing = byKreis.get(kreisId);
      if (!existing) {
        byKreis.set(kreisId, { mapping, count: 1 });
      } else {
        byKreis.set(kreisId, { mapping: existing.mapping, count: existing.count + 1 });
      }
    }

    return Array.from(byKreis.entries()).map(([kreisId, value]) => ({
      key: `${kreisId}:${value.mapping.id}`,
      displayKreisId: kreisId,
      mapping: value.mapping,
      derivedFromOrtslagen: true,
      sourceCount: value.count,
    }));
  }, [areaMappings]);
  const selectedPartnerSummary = useMemo(() => {
    const states = displayAreaRows.map((row) =>
      normalizeActivationStatus(
        row.mapping.activation_status,
        row.mapping.is_active,
        Boolean(row.mapping.is_public_live),
      ),
    );
    return {
      totalAreas: displayAreaRows.length,
      liveAreas: states.filter((state) => state === "live").length,
      activationOpen: states.filter((state) => state !== "live").length,
      activeIntegrationCount: integrations.filter((integration) => integration.is_active).length,
    };
  }, [displayAreaRows, integrations]);

  const selectedPartnerNeedsAreaAssignment = Boolean(selectedPartner?.is_active) && displayAreaRows.length === 0;

  const reviewAreaOptions = useMemo(
    () =>
      displayAreaRows.filter((row) => {
        const state = normalizeActivationStatus(
          row.mapping.activation_status,
          row.mapping.is_active,
          Boolean(row.mapping.is_public_live),
        );
        return (
          state === "ready_for_review"
          || state === "in_review"
          || state === "changes_requested"
          || state === "approved_preview"
          || state === "live"
        );
      }),
    [displayAreaRows],
  );
  const pendingReviewCount = useMemo(
    () =>
      reviewAreaOptions.filter((row) => {
        const state = normalizeActivationStatus(
          row.mapping.activation_status,
          row.mapping.is_active,
          Boolean(row.mapping.is_public_live),
        );
        return state === "ready_for_review";
      }).length,
    [reviewAreaOptions],
  );
  const selectedPartnerWorkflowSignal = useMemo(
    () =>
      resolveWorkflowSignalTone(
        displayAreaRows.map((row) =>
          normalizeActivationStatus(
            row.mapping.activation_status,
            row.mapping.is_active,
            Boolean(row.mapping.is_public_live),
          ),
        ),
        selectedPartnerNeedsAreaAssignment,
        Boolean(selectedPartner?.is_active),
        Boolean(selectedPartner?.is_system_default),
      ),
    [displayAreaRows, selectedPartnerNeedsAreaAssignment, selectedPartner?.is_active, selectedPartner?.is_system_default],
  );
  const currentReviewState = useMemo(
    () => normalizeActivationStatus(
      reviewData?.mapping?.activation_status,
      Boolean(reviewData?.mapping?.is_active),
      Boolean(reviewData?.mapping?.is_public_live),
    ),
    [reviewData],
  );
  const currentReviewPreviewHref = useMemo(
    () => buildPreviewHrefFromArea(reviewData?.mapping?.areas ?? null, reviewData?.mapping?.area_id ?? ""),
    [reviewData],
  );
  const currentReviewPreviewSignoffAt = useMemo(
    () => String(reviewData?.mapping?.partner_preview_signoff_at ?? "").trim(),
    [reviewData],
  );
  const currentReviewAllowsDirectGoLive = Boolean(selectedPartner?.is_system_default);
  const systempartnerDefaultMissingKeys = useMemo(
    () => getMissingSystempartnerDefaultProfileKeys(systempartnerDefaultProfile),
    [systempartnerDefaultProfile],
  );
  const systempartnerDefaultMissingLabels = useMemo(
    () =>
      systempartnerDefaultMissingKeys.map((key) => {
        switch (key) {
          case "berater_name":
            return "Beratername";
          case "berater_email":
            return "Berater-E-Mail";
          case "berater_telefon_fest":
            return "Telefon Festnetz";
          case "media_berater_avatar":
            return getMandatoryMediaLabel("media_berater_avatar");
          default:
            return key;
        }
      }),
    [systempartnerDefaultMissingKeys],
  );
  const systempartnerDefaultCanSave = systempartnerDefaultMissingKeys.length === 0;

  const handoverAreaOptions = useMemo(
    () => displayAreaRows.map((row) => ({
      id: row.displayKreisId,
      label: resolveAreaName(row.mapping, row.displayKreisId),
      displayLabel: formatAreaLabel(row.mapping, row.displayKreisId),
    })),
    [displayAreaRows],
  );
  const selectedHandoverAreaOption = useMemo(
    () => handoverAreaOptions.find((option) => option.id === handoverDraft.area_id) ?? null,
    [handoverAreaOptions, handoverDraft.area_id],
  );
  const handoverNewPartnerOptions = useMemo(
    () => partners
      .filter((p) => p.id !== selectedPartnerId)
      .slice()
      .sort((a, b) => {
        const aDefault = a.is_system_default ? 1 : 0;
        const bDefault = b.is_system_default ? 1 : 0;
        if (aDefault !== bDefault) return bDefault - aDefault;
        return String(a.company_name ?? "").localeCompare(String(b.company_name ?? ""), "de");
      }),
    [partners, selectedPartnerId],
  );
  const handoverTargetPartner = useMemo(
    () => partners.find((p) => p.id === handoverDraft.new_partner_id) ?? null,
    [partners, handoverDraft.new_partner_id],
  );
  const handoverLocaleOptions = useMemo(
    () => partnerLocaleBillingRows
      .filter((row) => row.enabled)
      .slice()
      .sort((a, b) => Number(a.sort_order ?? 100) - Number(b.sort_order ?? 100)),
    [partnerLocaleBillingRows],
  );
  useEffect(() => {
    setHandoverDraft((prev) => {
      const nextModes: Record<string, HandoverLocaleMode> = {};
      for (const row of handoverLocaleOptions) {
        const locale = String(row.locale ?? "").trim().toLowerCase();
        if (!locale || locale === "de") continue;
        nextModes[locale] = prev.locale_modes[locale] ?? "copy_and_enable";
      }
      const sameKeys = Object.keys(nextModes).length === Object.keys(prev.locale_modes).length
        && Object.entries(nextModes).every(([locale, mode]) => prev.locale_modes[locale] === mode);
      if (sameKeys) return prev;
      return { ...prev, locale_modes: nextModes };
    });
  }, [handoverLocaleOptions]);
  const portalPartner = useMemo(
    () => partners.find((partner) => partner.is_system_default === true) ?? null,
    [partners],
  );
  const adminWelcomeActions = useMemo<AdminWelcomeAction[]>(
    () => [
      {
        key: "partners",
        icon: "partners",
        title: "Partnerverwaltung",
        text: "Bestehende Partner öffnen, Profil- und Gebietsdaten prüfen und Detailbereiche aufrufen.",
        badge: partners.length > 0 ? `${partners.length} Partner` : null,
        onClick: () => {
          setNavMode("partners");
          if (portalPartner?.id) {
            void selectPartnerView(portalPartner.id, "partner_edit");
            return;
          }
          setActiveView("partner_edit");
        },
      },
      {
        key: "areas",
        icon: "areas",
        title: "Gebiete",
        text: "Kreiszuordnungen, Übergaben und Aktivierungsstände gebietsbezogen prüfen.",
        badge: areaOverview.length > 0 ? `${areaOverview.length} Zuordnungen` : null,
        onClick: () => {
          setNavMode("areas");
          setActiveView("partner_edit");
        },
      },
      {
        key: "llm",
        icon: "llm",
        title: "LLM-Verwaltung",
        text: "Globale Provider, Modelle, Preise und Nutzungsgrenzen zentral steuern.",
        onClick: () => {
          setActiveView("llm_global");
          void run("Globale LLM-Verwaltung laden", async () => {
            await loadLlmGlobalDashboard();
          });
        },
      },
      {
        key: "billing",
        icon: "billing",
        title: "Leistungsabrechnung",
        text: "Billing-Standards und Berechnungsgrundlagen für Portal und Partner pflegen.",
        onClick: () => {
          setActiveView("billing_defaults");
          void run("Billing-Standards laden", async () => {
            await loadBillingDefaults();
          });
        },
      },
      {
        key: "language",
        icon: "language",
        title: "Sprachverwaltung",
        text: "Globale Locale-Freigaben, Status und Partnerbuchbarkeit zentral steuern.",
        badge: portalLocaleConfigs.length > 0 ? `${portalLocaleConfigs.length} Locales` : null,
        onClick: () => {
          setActiveView("language_admin");
          void run("Sprachverwaltung laden", async () => {
            await loadPortalCms();
          }, { showSuccessModal: false });
        },
      },
      {
        key: "system_texts",
        icon: "texts",
        title: "Systemtexte",
        text: "Navigation, Footer, Fallbacks und UI-Texte tabweise pro Locale bearbeiten.",
        badge: portalSystemTextDefinitions.length > 0 ? `${portalSystemTextDefinitions.length} Texte` : null,
        onClick: () => {
          setActiveView("system_texts");
          void run("Systemtexte laden", async () => {
            await loadPortalCms();
          }, { showSuccessModal: false });
        },
      },
      {
        key: "market_texts",
        icon: "market_texts",
        title: "Markterklärungstexte",
        text: "Fachliche Standard- und Erklärungstexte für den Immobilienmarkt strukturiert vorbereiten.",
        onClick: () => {
          setActiveView("market_texts");
          void run("Markterklärungstexte laden", async () => {
            await Promise.all([
              loadMarketExplanationStandardTexts(),
              loadMarketExplanationStaticTexts(),
            ]);
          }, { showSuccessModal: false });
        },
      },
      {
        key: "standard_text_refresh",
        icon: "refresh",
        title: "Standardtext-Refresh",
        text: "Verbesserte Standardtexte kontrolliert auf die Report-Basis von Bundesländern, Kreisen und Ortslagen anwenden.",
        onClick: () => {
          setActiveView("standard_text_refresh");
          void run("Standardtext-Refresh laden", async () => {
            await Promise.all([
              loadMarketExplanationBundeslaender(),
              loadStandardTextSource("bundesland"),
            ]);
          }, { showSuccessModal: false });
        },
      },
      {
        key: "cms",
        icon: "cms",
        title: "Portal-CMS",
        text: "Globale Portalinhalte, Locale-Stati und CMS-Einträge bearbeiten.",
        onClick: () => {
          setActiveView("portal_cms");
          void run("Portal-CMS laden", async () => {
            await loadPortalCms();
          }, { showSuccessModal: false });
        },
      },
    ],
    [partners.length, areaOverview.length, portalLocaleConfigs.length, portalPartner?.id, portalSystemTextDefinitions.length],
  );
  const hoveredAdminNavLabel = useMemo(() => {
    if (hoveredAdminNavId === "partners") return "Partnerverwaltung";
    if (hoveredAdminNavId === "areas") return "Gebiete";
    if (hoveredAdminNavId === "llm") return "LLM-Verwaltung";
    if (hoveredAdminNavId === "billing") return "Leistungsabrechnung";
    if (hoveredAdminNavId === "language") return "Sprachverwaltung";
    if (hoveredAdminNavId === "texts") return "Systemtexte";
    if (hoveredAdminNavId === "market_texts") return "Markterklärungstexte";
    if (hoveredAdminNavId === "refresh") return "Standardtext-Refresh";
    if (hoveredAdminNavId === "cms") return "Portal-CMS";
    return null;
  }, [hoveredAdminNavId]);

  const updateHoveredAdminNav = (navId: string, element: HTMLElement) => {
    const asideRect = adminModeBarRef.current?.getBoundingClientRect();
    const buttonRect = element.getBoundingClientRect();
    const nextTop = asideRect ? (buttonRect.top - asideRect.top) + (buttonRect.height / 2) : null;
    setHoveredAdminNavId(navId);
    setHoveredAdminNavTop(nextTop);
  };

  async function loadPartners(selectId?: string, options?: { refreshSelectedDetails?: boolean }) {
    const data = await api<{ partners: Partner[] }>("/api/admin/partners?include_inactive=1");
    const nextPartners = data.partners ?? [];
    setPartners(nextPartners);

    const existingSelected = selectedPartnerId
      ? nextPartners.find((p) => p.id === selectedPartnerId)?.id ?? ""
      : "";
    const requestedSelected = selectId
      ? nextPartners.find((p) => p.id === selectId)?.id ?? ""
      : "";
    const nextId = requestedSelected || existingSelected;
    if (nextId) {
      setSelectedPartnerId(nextId);
      if (options?.refreshSelectedDetails !== false) {
        await loadPartnerDetails(nextId);
      }
    } else {
      setSelectedPartner(null);
      setAreaMappings([]);
      setIntegrations([]);
    }
  }

  function applyLocalAreaMappingUpdate(
    partnerId: string,
    mappingPatch: Partial<AreaMapping> & Pick<AreaMapping, "area_id" | "auth_user_id">,
  ) {
    setPartners((prev) => prev.map((partner) => (
      partner.id !== partnerId
        ? partner
        : {
          ...partner,
          area_mappings: upsertAreaMapping(partner.area_mappings ?? [], mappingPatch),
        }
    )));
    setAreaMappings((prev) => upsertAreaMapping(prev, mappingPatch));
    setReviewData((prev) => {
      if (!prev?.mapping || prev.mapping.area_id !== mappingPatch.area_id) return prev;
      return {
        ...prev,
        mapping: mergeAreaMappingRecord(prev.mapping, mappingPatch),
      };
    });
  }

  async function loadPartnerDetails(partnerId: string) {
    if (!partnerId) return;
    const [partnerData, integrationsData] = await Promise.all([
      api<{ partner: Partner; area_mappings: AreaMapping[] }>(`/api/admin/partners/${partnerId}`),
      api<{ integrations: Integration[] }>(`/api/admin/partners/${partnerId}/integrations`),
    ]);
    setSelectedPartner(partnerData.partner);
    setAreaMappings(partnerData.area_mappings ?? []);
    setIntegrations(integrationsData.integrations ?? []);
    const reviewCandidate = (partnerData.area_mappings ?? []).find((mapping) => {
      const state = normalizeActivationStatus(
        mapping.activation_status,
        Boolean(mapping.is_active),
        Boolean(mapping.is_public_live),
      );
      return state === "ready_for_review"
        || state === "in_review"
        || state === "changes_requested"
        || state === "approved_preview"
        || state === "live";
    });
    setReviewAreaId(String(reviewCandidate?.area_id ?? ""));
    setReviewData(null);
    setReviewNoteDraft("");
    setEditPartner({
      company_name: partnerData.partner.company_name ?? "",
      contact_email: partnerData.partner.contact_email ?? "",
      contact_first_name: partnerData.partner.contact_first_name ?? "",
      contact_last_name: partnerData.partner.contact_last_name ?? "",
      website_url: partnerData.partner.website_url ?? "",
      is_active: Boolean(partnerData.partner.is_active),
      llm_partner_managed_allowed: Boolean(partnerData.partner.llm_partner_managed_allowed),
    });
    setPartnerBillingRows([]);
    setPartnerBillingTotals({ tokens: 0, cost_eur: 0 });
    setPartnerFeatureBillingRows([]);
    setPartnerPortalBillingDraft({
      portal_base_price_eur: "",
      portal_ortslage_price_eur: "",
      portal_export_ortslage_price_eur: "",
    });
    try {
      await loadPartnerBillingConfig(partnerId);
    } catch {
      setPartnerFeatureBillingRows([]);
    }
  }

  async function loadAreaReview(areaId: string) {
    if (!selectedPartnerId || !areaId) {
      setReviewData(null);
      setReviewActionError(null);
      setReviewActionMessage(null);
      setReviewNoteDraft("");
      return;
    }
    setReviewBusy(true);
    try {
      const data = await api<AreaReviewPayload>(`/api/admin/partners/${selectedPartnerId}/areas/${encodeURIComponent(areaId)}/review`);
      setReviewData(data);
      setReviewNoteDraft(String(data.mapping?.admin_review_note ?? ""));
      setReviewActionError(null);
      setReviewActionMessage(null);
    } catch (error) {
      setReviewData(null);
      setStatus(error instanceof Error ? error.message : "Freigabeprüfung konnte nicht geladen werden.");
    } finally {
      setReviewBusy(false);
    }
  }

  async function applyAreaReviewAction(action: "in_review" | "changes_requested" | "approve") {
    if (!selectedPartnerId || !reviewAreaId) return;
    setReviewBusy(true);
    try {
      const note = action === "changes_requested" ? reviewNoteDraft.trim() : "";
      if (action === "changes_requested" && !note) {
        setReviewActionError("Bitte einen Hinweis für die Nachbesserung eintragen.");
        setReviewActionMessage(null);
        return;
      }
      const response = await api<AreaReviewPayload>(`/api/admin/partners/${selectedPartnerId}/areas/${encodeURIComponent(reviewAreaId)}/review`, {
        method: "PATCH",
        body: JSON.stringify({ action, note: note || null }),
      });
      if (response.mapping) {
        applyLocalAreaMappingUpdate(selectedPartnerId, response.mapping);
      }
      setReviewData(response);
      setReviewNoteDraft(String(response.mapping?.admin_review_note ?? ""));
      if ((action === "approve" || action === "changes_requested") && response?.notification?.partner?.sent === false) {
        const reason = String(response?.notification?.partner?.reason ?? "unbekannt");
        setReviewActionError(
          action === "approve"
            ? `Preview wurde freigegeben, Partner-Mail aber nicht versendet (${reason}).`
            : `Nachbesserung wurde gesetzt, Partner-Mail aber nicht versendet (${reason}).`,
        );
        setReviewActionMessage(null);
        return;
      }
      setReviewActionError(null);
      setReviewActionMessage(
        action === "approve"
          ? "Previewfreigabe erfolgreich gesetzt und Partner-Mail versendet."
          : action === "changes_requested"
            ? "Aufforderung zur Nachbesserung erfolgreich an den Partner versendet."
            : "Prüfstatus erfolgreich aktualisiert.",
      );
    } catch (error) {
      setReviewActionError(error instanceof Error ? error.message : "Aktion konnte nicht ausgeführt werden.");
      setReviewActionMessage(null);
      throw error;
    } finally {
      setReviewBusy(false);
    }
  }

  async function setAreaPublication(live: boolean) {
    if (!selectedPartnerId || !reviewAreaId) return;
    return setAreaPublicationForArea(reviewAreaId, live);
  }

  async function setAreaPublicationForArea(areaId: string, live: boolean) {
    if (!selectedPartnerId || !areaId) return;
    setReviewBusy(true);
    try {
      const response = await api<AreaReviewPayload>(
        `/api/admin/partners/${selectedPartnerId}/areas/${encodeURIComponent(areaId)}/publish`,
        {
          method: live ? "POST" : "DELETE",
        },
      );
      if (response.mapping) {
        applyLocalAreaMappingUpdate(selectedPartnerId, response.mapping);
      }
      if (live && response?.notification?.partner?.sent === false && !selectedPartner?.is_system_default) {
        const reason = String(response?.notification?.partner?.reason ?? "unbekannt");
        setReviewActionError(`Gebiet wurde online geschaltet, Partner-Mail aber nicht versendet (${reason}).`);
        setReviewActionMessage(null);
        return;
      }
      setReviewActionError(null);
      setReviewActionMessage(live ? "Gebiet erfolgreich online geschaltet." : "Gebiet erfolgreich offline genommen.");
      setStatus(live ? "Gebiet erfolgreich online geschaltet." : "Gebiet erfolgreich offline genommen.");
    } catch (error) {
      setReviewActionError(error instanceof Error ? error.message : "Veröffentlichung konnte nicht aktualisiert werden.");
      setReviewActionMessage(null);
      throw error;
    } finally {
      setReviewBusy(false);
    }
  }

  async function rebuildVisibilityIndex() {
    setVisibilityIndexBusy(true);
    try {
      const response = await api<{ ok?: boolean; index?: { generated_at?: string | null } }>(
        "/api/admin/visibility-index/rebuild",
        { method: "POST" },
      );
      setReviewActionError(null);
      setReviewActionMessage(
        `Visibility-Index erfolgreich neu publiziert${String(response?.index?.generated_at ?? "").trim() ? ` (${formatAdminDateTime(String(response?.index?.generated_at ?? "").trim())})` : "."}`,
      );
    } catch (error) {
      setReviewActionError(error instanceof Error ? error.message : "Visibility-Index konnte nicht neu publiziert werden.");
      setReviewActionMessage(null);
      throw error;
    } finally {
      setVisibilityIndexBusy(false);
    }
  }

  async function loadAuditLogs() {
    if (auditLoadingRef.current) return;
    auditLoadingRef.current = true;
    setAuditLoading(true);
    const params = new URLSearchParams();
    if (auditFilters.entity_type.trim()) params.set("entity_type", auditFilters.entity_type.trim());
    if (auditFilters.event_type.trim()) params.set("event_type", auditFilters.event_type.trim());
    if (auditFilters.actor_user_id.trim()) params.set("actor_user_id", auditFilters.actor_user_id.trim());
    if (auditFilters.created_from.trim()) params.set("created_from", auditFilters.created_from.trim());
    if (auditFilters.created_to.trim()) params.set("created_to", auditFilters.created_to.trim());
    params.set("limit", String(auditFilters.limit));

    try {
      const data = await api<{ logs: AuditLogRow[] }>(`/api/admin/audit-log?${params.toString()}`);
      setAuditLogs(data.logs ?? []);
      setAuditLoadedOnce(true);
    } finally {
      auditLoadingRef.current = false;
      setAuditLoading(false);
    }
  }

  async function loadLlmGlobalConfig() {
    const data = await api<{ config?: LlmGlobalConfig }>("/api/admin/llm/global");
    if (data?.config) {
      setLlmGlobalConfig({
        central_enabled: data.config.central_enabled !== false,
        monthly_token_budget: typeof data.config.monthly_token_budget === "number" ? data.config.monthly_token_budget : null,
        monthly_cost_budget_eur: typeof data.config.monthly_cost_budget_eur === "number" ? data.config.monthly_cost_budget_eur : null,
      });
    }
  }

  async function loadLlmAccounts() {
    const data = await api<{ accounts?: LlmProviderAccount[] }>("/api/admin/llm/accounts");
    const accounts = data.accounts ?? [];
    setLlmAccounts(accounts);
    return accounts;
  }

  async function loadLlmProviders() {
    const data = await api<{ providers?: LlmGlobalProvider[] }>("/api/admin/llm/providers");
    const providers = data.providers ?? [];
    setLlmProviders(providers);
    setLlmProviderDrafts(
      providers.reduce((acc, p) => {
        acc[p.id] = {
          model: String(p.model ?? ""),
          display_label: String(p.display_label ?? ""),
          hint: String(p.hint ?? ""),
          badges: formatBadgesInput(p.badges),
          recommended: p.recommended === true,
          base_url: String(p.base_url ?? ""),
          api_version: String(p.api_version ?? ""),
          priority: String(p.priority ?? 100),
          temperature: p.temperature === null || p.temperature === undefined ? "" : String(p.temperature),
          max_tokens: p.max_tokens === null || p.max_tokens === undefined ? "" : String(p.max_tokens),
          input_cost_usd_per_1k: p.input_cost_usd_per_1k === null || p.input_cost_usd_per_1k === undefined ? "" : String(p.input_cost_usd_per_1k),
          output_cost_usd_per_1k: p.output_cost_usd_per_1k === null || p.output_cost_usd_per_1k === undefined ? "" : String(p.output_cost_usd_per_1k),
        };
        return acc;
      }, {} as Record<string, Partial<{
        model: string;
        display_label: string;
        hint: string;
        badges: string;
        recommended: boolean;
        base_url: string;
        api_version: string;
        priority: string;
        temperature: string;
        max_tokens: string;
        input_cost_usd_per_1k: string;
        output_cost_usd_per_1k: string;
      }>>),
    );
  }

  async function testSavedLlmProvider(provider: LlmGlobalProvider) {
    const draft = llmProviderDrafts[provider.id] ?? {};
    setLlmOverviewTestBusyId(provider.id);
    setLlmOverviewTestResults((prev) => ({
      ...prev,
      [provider.id]: {
        status: "ok",
        message: "Verbindungstest läuft...",
      },
    }));
    try {
      const resp = await api<{ result?: { status?: string; message?: string } }>("/api/admin/llm/providers/test", {
        method: "POST",
        body: JSON.stringify({
          provider_model_id: provider.id,
          provider: String(provider.provider ?? "").trim().toLowerCase(),
          model: String(draft.model ?? provider.model ?? "").trim(),
          base_url: String(draft.base_url ?? provider.base_url ?? "").trim(),
          api_version: String(draft.api_version ?? provider.api_version ?? "").trim() || null,
        }),
      });
      const resultStatus = String(resp.result?.status ?? "").toLowerCase();
      const resultMessage = String(resp.result?.message ?? "Kein Testergebnis.");
      const normalizedStatus = resultStatus === "ok" ? "ok" : "error";
      setLlmOverviewTestResults((prev) => ({
        ...prev,
        [provider.id]: {
          status: normalizedStatus,
          message: resultMessage,
        },
      }));
      if (normalizedStatus !== "ok") throw new Error(resultMessage);
      setStatus(`Verbindungstest erfolgreich: ${provider.display_label || provider.model}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Verbindungstest fehlgeschlagen.";
      setLlmOverviewTestResults((prev) => ({
        ...prev,
        [provider.id]: {
          status: "error",
          message,
        },
      }));
      throw error;
    } finally {
      setLlmOverviewTestBusyId(null);
    }
  }

  async function saveLlmAccountApiKey(accountId: string, apiKey: string) {
    const cleanAccountId = String(accountId ?? "").trim();
    const cleanApiKey = String(apiKey ?? "").trim();
    if (!cleanAccountId) throw new Error("Bitte zuerst einen bestehenden Provider-Account auswählen.");
    if (!cleanApiKey) throw new Error("Bitte einen API-Key eingeben, bevor du ihn speicherst.");
    await api(`/api/admin/llm/accounts/${cleanAccountId}/secrets`, {
      method: "POST",
      body: JSON.stringify({ api_key: cleanApiKey }),
    });
    await loadLlmAccounts();
    setLlmCreateSaveResult({
      status: "ok",
      message: "API-Key wurde für den Provider-Account gespeichert.",
    });
    setNewLlmAccount((prev) => ({ ...prev, existing_account_id: cleanAccountId, api_key: "" }));
  }

  async function ensureLlmAccountReady(): Promise<{ accountId: string; hasStoredApiKey: boolean }> {
    if (!newLlmAccount.api_key.trim() && !effectiveExistingLlmAccountHasApiKey) {
      throw new Error("Bitte zuerst einen API-Key für den Provider-Account eingeben und speichern.");
    }

    let accountId = String(newLlmAccount.existing_account_id || "").trim();
    let accountHasStoredApiKey = effectiveExistingLlmAccountHasApiKey;

    if (!accountId) {
      const matchingAccount = llmAccounts.find((account) =>
        String(account.provider ?? "").trim().toLowerCase() === String(newLlmAccount.provider ?? "").trim().toLowerCase()
        && normalizeLlmBaseUrl(account.base_url) === normalizeLlmBaseUrl(newLlmAccount.base_url),
      );
      if (matchingAccount?.id) {
        accountId = matchingAccount.id;
        accountHasStoredApiKey = Boolean(String(((matchingAccount.auth_config ?? {}) as Record<string, unknown>).api_key ?? ((matchingAccount.auth_config ?? {}) as Record<string, unknown>).api_key_encrypted ?? "").trim());
        setNewLlmAccount((prev) => ({ ...prev, existing_account_id: matchingAccount.id }));
      } else {
        const createdAccount = await api<{ account?: { id: string } }>("/api/admin/llm/accounts", {
          method: "POST",
          body: JSON.stringify({
            provider: newLlmAccount.provider,
            display_name: newLlmAccount.display_name.trim() || null,
            base_url: newLlmAccount.base_url,
            auth_type: newLlmAccount.auth_type,
            api_version: String(newLlmAccount.api_version || "").trim() || null,
          }),
        });
        accountId = String(createdAccount.account?.id ?? "").trim();
      }
    }

    if (!accountId) {
      throw new Error("Provider-Account wurde ohne gültige ID angelegt.");
    }

    if (newLlmAccount.api_key.trim()) {
      await saveLlmAccountApiKey(accountId, newLlmAccount.api_key);
      accountHasStoredApiKey = true;
    } else {
      await loadLlmAccounts();
      setNewLlmAccount((prev) => ({ ...prev, existing_account_id: accountId }));
    }

    if (!accountHasStoredApiKey) {
      throw new Error("Für diesen Provider-Account ist kein API-Key gespeichert.");
    }

    return { accountId, hasStoredApiKey: accountHasStoredApiKey };
  }

  async function loadLlmUsage(month = llmUsageMonth) {
    const data = await api<{ by_partner?: LlmUsagePartnerRow[]; by_item?: LlmUsageItemRow[]; by_status?: LlmUsageStatusRow[]; totals?: { tokens?: number; cost_eur?: number } }>(
      `/api/admin/llm/usage?month=${encodeURIComponent(`${month}-01`)}&status=all`,
    );
    setLlmUsageRows(data.by_partner ?? []);
    setLlmUsageItems(data.by_item ?? []);
    setLlmUsageStatusRows(data.by_status ?? []);
    setLlmUsageTotals({
      tokens: Number(data.totals?.tokens ?? 0),
      cost_eur: Number(data.totals?.cost_eur ?? 0),
    });
  }

  async function loadPartnerBilling(partnerId: string, month = partnerBillingMonth) {
    if (!partnerId) return;
    const data = await api<{ by_item?: LlmUsageItemRow[]; totals?: { tokens?: number; cost_eur?: number } }>(
      `/api/admin/llm/usage?partner_id=${encodeURIComponent(partnerId)}&month=${encodeURIComponent(`${month}-01`)}&status=ok`,
    );
    setPartnerBillingRows(data.by_item ?? []);
    setPartnerBillingTotals({
      tokens: Number(data.totals?.tokens ?? 0),
      cost_eur: Number(data.totals?.cost_eur ?? 0),
    });
  }

  async function loadBillingDefaults() {
    const data = await api<{
      defaults?: BillingGlobalDefaults;
      features?: BillingFeature[];
      locale_features?: BillingLocaleFeature[];
    }>("/api/admin/billing/defaults");
    const defaults = data.defaults ?? {
      portal_base_price_eur: 50,
      portal_ortslage_price_eur: 1,
      portal_export_ortslage_price_eur: 1,
    };
    setBillingDefaultsDraft({
      portal_base_price_eur: Number(defaults.portal_base_price_eur ?? 50).toFixed(2),
      portal_ortslage_price_eur: Number(defaults.portal_ortslage_price_eur ?? 1).toFixed(2),
      portal_export_ortslage_price_eur: Number(defaults.portal_export_ortslage_price_eur ?? 1).toFixed(2),
    });
    setBillingFeatureCatalog((data.features ?? []).map((feature) => ({
      ...feature,
      default_monthly_price_eur: Number(feature.default_monthly_price_eur ?? 0),
      sort_order: Number(feature.sort_order ?? 100),
      default_enabled: feature.default_enabled === true,
      is_active: feature.is_active !== false,
    })));
    setBillingLocaleFeatureRows((data.locale_features ?? []).map((row) => ({
      ...row,
      feature_exists: row.feature_exists === true,
      feature_is_active: row.feature_is_active === true,
      partner_bookable: row.partner_bookable === true,
      is_active: row.is_active === true,
      default_enabled: row.default_enabled === true,
      default_monthly_price_eur: Number(row.default_monthly_price_eur ?? 0),
      sort_order: Number(row.sort_order ?? 100),
    })));
  }

  async function loadPortalCms() {
    const [contentData, systemTextData] = await Promise.all([
      api<{
        locales?: PortalLocaleConfigRecord[];
        pages?: PortalContentPageDefinition[];
        entries?: PortalContentEntryRecord[];
        metas?: PortalContentI18nMetaViewRecord[];
      }>("/api/admin/portal-content"),
      api<{
        definitions?: PortalSystemTextDefinition[];
        entries?: PortalSystemTextEntryRecord[];
        metas?: PortalSystemTextI18nMetaViewRecord[];
      }>("/api/admin/portal-system-texts"),
    ]);
    const nextLocales = contentData.locales ?? [];
    const nextSystemDefinitions = systemTextData.definitions ?? PORTAL_SYSTEM_TEXT_DEFINITIONS;
    const nextSystemEntries = systemTextData.entries ?? [];
    setPortalLocaleConfigs(nextLocales);
    setPortalContentEntries(contentData.entries ?? []);
    setPortalContentMetas(contentData.metas ?? []);
    setPortalSystemTextDefinitions(nextSystemDefinitions);
    setPortalSystemTextEntries(nextSystemEntries);
    setPortalSystemTextMetas(systemTextData.metas ?? []);
    setPortalSystemTextDrafts(buildPortalSystemTextDraftMap({
      locales: nextLocales,
      definitions: nextSystemDefinitions,
      entries: nextSystemEntries,
    }));
    const fallbackLocale = nextLocales.find((row) => row.is_active)?.locale ?? nextLocales[0]?.locale ?? "de";
    setPortalCmsViewState((prev) => {
      const nextLocale = nextLocales.some((row) => row.locale === prev.locale)
        ? String(prev.locale ?? fallbackLocale)
        : fallbackLocale;
      const nextPageKey = portalCmsPages.some((page) => page.page_key === prev.pageKey)
        ? String(prev.pageKey ?? "home")
        : (portalCmsPages[0]?.page_key ?? "home");
      return {
        ...prev,
        locale: nextLocale,
        pageKey: nextPageKey,
      };
    });
    setPortalSystemTextLocale((prev) => nextLocales.some((row) => row.locale === prev) ? prev : fallbackLocale);
  }

  async function loadMarketExplanationStandardTexts(options?: {
    scope?: MarketExplanationStandardScope;
    bundeslandSlug?: string;
    locale?: string;
  }) {
    const scope = options?.scope ?? marketExplanationStandardScope;
    const locale = options?.locale ?? (scope === "bundesland" ? marketExplanationStandardLocale : "de");
    const bundeslandSlug = options?.bundeslandSlug ?? marketExplanationStandardBundeslandSlug;
    const params = new URLSearchParams();
    params.set("level", scope);
    if (scope === "bundesland") {
      if (!bundeslandSlug) {
        throw new Error("Bitte zuerst ein Bundesland auswählen.");
      }
      params.set("bundesland_slug", bundeslandSlug);
      params.set("locale", locale);
    }
    const data = await api<{
      level?: MarketExplanationStandardScope;
      locale?: string;
      bundesland_slug?: string;
      bundeslaender?: MarketExplanationStandardBundesland[];
      definitions?: MarketExplanationStandardTextDefinition[];
      entries?: MarketExplanationStandardEntry[];
    }>(`/api/admin/market-explanation-standard-texts?${params.toString()}`);
    const nextLevel = data.level ?? scope;
    const nextBundeslaender = data.bundeslaender ?? [];
    const nextBundeslandSlug = data.bundesland_slug ?? bundeslandSlug;
    const nextLocale = data.locale ?? locale;
    const nextDefinitions = data.definitions ?? getMarketExplanationStandardDefinitions(nextLevel);
    const nextEntries = data.entries ?? [];
    setMarketExplanationStandardScope(nextLevel);
    setMarketExplanationStandardBundeslaender(nextBundeslaender);
    setMarketExplanationStandardBundeslandSlug(nextBundeslandSlug);
    setMarketExplanationStandardLocale(nextLocale);
    setMarketExplanationStandardDefinitions(nextDefinitions);
    setMarketExplanationStandardEntries(nextEntries);
    setMarketExplanationStandardDrafts(buildMarketExplanationStandardDraftMap({
      definitions: nextDefinitions,
      entries: nextEntries,
    }));
    setMarketExplanationStandardStatusDrafts(buildMarketExplanationStandardStatusDraftMap({
      locale: nextLocale,
      definitions: nextDefinitions,
      entries: nextEntries,
    }));
  }

  async function loadMarketExplanationStaticTexts() {
    const data = await api<{
      locales?: PortalLocaleConfigRecord[];
      definitions?: MarketExplanationStaticTextDefinition[];
      entries?: MarketExplanationStaticTextEntryRecord[];
      metas?: MarketExplanationStaticTextI18nMetaViewRecord[];
    }>("/api/admin/market-explanation-static-texts");
    const nextLocales = data.locales ?? [];
    const nextDefinitions = data.definitions ?? MARKET_EXPLANATION_STATIC_TEXT_DEFINITIONS;
    const nextEntries = data.entries ?? [];
    setPortalLocaleConfigs((prev) => (nextLocales.length > 0 ? nextLocales : prev));
    setMarketExplanationStaticDefinitions(nextDefinitions);
    setMarketExplanationStaticEntries(nextEntries);
    setMarketExplanationStaticMetas(data.metas ?? []);
    setMarketExplanationStaticDrafts(buildMarketExplanationStaticDraftMap({
      locales: nextLocales.length > 0 ? nextLocales : portalLocaleConfigs,
      definitions: nextDefinitions,
      entries: nextEntries,
    }));
    const fallbackLocale = (nextLocales.length > 0 ? nextLocales : portalLocaleConfigs).find((row) => row.is_active)?.locale
      ?? (nextLocales.length > 0 ? nextLocales : portalLocaleConfigs)[0]?.locale
      ?? "de";
    setMarketExplanationStaticLocale((prev) =>
      (nextLocales.length > 0 ? nextLocales : portalLocaleConfigs).some((row) => row.locale === prev) ? prev : fallbackLocale,
    );
  }

  async function loadMarketExplanationBundeslaender() {
    const data = await api<{ bundeslaender?: MarketExplanationStandardBundesland[] }>(
      "/api/admin/market-explanation-standard-texts?level=kreis",
    );
    const nextBundeslaender = data.bundeslaender ?? [];
    setMarketExplanationStandardBundeslaender(nextBundeslaender);
    setStandardTextRefreshBundeslandSlug((prev) => {
      if (nextBundeslaender.some((entry) => entry.slug === prev)) return prev;
      return nextBundeslaender[0]?.slug ?? "";
    });
  }

  async function loadStandardTextSource(scope: MarketExplanationStandardScope) {
    const data = await api<{
      scope?: MarketExplanationStandardScope;
      definitions?: MarketExplanationStandardTextDefinition[];
      entries?: MarketExplanationStandardEntry[];
    }>(`/api/admin/standard-text-sources?scope=${encodeURIComponent(scope)}`);
    const nextScope = data.scope ?? scope;
    const nextDefinitions = data.definitions ?? getMarketExplanationStandardDefinitions(nextScope);
    const nextEntries = data.entries ?? [];
    setStandardTextSourceDefinitions(nextDefinitions);
    setStandardTextSourceDrafts(
      nextEntries.reduce<Record<string, string>>((acc, entry) => {
        acc[entry.key] = entry.value_text ?? "";
        return acc;
      }, {}),
    );
  }

  async function saveStandardTextSource(scope: MarketExplanationStandardScope) {
    const rows = standardTextSourceDefinitions.map((definition) => ({
      key: definition.key,
      value_text: standardTextSourceDrafts[definition.key] ?? "",
    }));
    const data = await api<{
      scope?: MarketExplanationStandardScope;
      definitions?: MarketExplanationStandardTextDefinition[];
      entries?: MarketExplanationStandardEntry[];
    }>("/api/admin/standard-text-sources", {
      method: "POST",
      body: JSON.stringify({
        scope,
        entries: rows,
      }),
    });
    const nextScope = data.scope ?? scope;
    const nextDefinitions = data.definitions ?? getMarketExplanationStandardDefinitions(nextScope);
    const nextEntries = data.entries ?? [];
    setStandardTextSourceDefinitions(nextDefinitions);
    setStandardTextSourceDrafts(
      nextEntries.reduce<Record<string, string>>((acc, entry) => {
        acc[entry.key] = entry.value_text ?? "";
        return acc;
      }, {}),
    );
  }

  async function loadSystempartnerDefaultProfile() {
    const data = await api<{ profile?: SystempartnerDefaultProfile }>("/api/admin/systempartner-default-profile");
    setSystempartnerDefaultProfile({
      ...EMPTY_SYSTEMPARTNER_DEFAULT_PROFILE,
      ...(data.profile ?? {}),
    });
  }

  async function saveSystempartnerDefaultProfile() {
    const data = await api<{ profile?: SystempartnerDefaultProfile }>("/api/admin/systempartner-default-profile", {
      method: "POST",
      body: JSON.stringify({
        profile: systempartnerDefaultProfile,
      }),
    });
    setSystempartnerDefaultProfile({
      ...EMPTY_SYSTEMPARTNER_DEFAULT_PROFILE,
      ...(data.profile ?? {}),
    });
  }

  async function uploadSystempartnerDefaultAvatar(rawFile: File) {
    setSystempartnerDefaultAvatarUpload({ uploading: true, error: null });
    try {
      const form = new FormData();
      form.append("file", rawFile);
      const res = await fetch("/api/admin/systempartner-default-profile/media/upload", {
        method: "POST",
        body: form,
        cache: "no-store",
      });
      const data = await readJsonSafe(res);
      if (!res.ok) {
        throw new Error(String(data?.error ?? `HTTP ${res.status}`));
      }
      setSystempartnerDefaultProfile({
        ...EMPTY_SYSTEMPARTNER_DEFAULT_PROFILE,
        ...(data?.profile ?? {}),
      });
      setSystempartnerDefaultAvatarUpload({ uploading: false, error: null });
      setStatus("Systempartner-Avatar erfolgreich hochgeladen.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Avatar konnte nicht hochgeladen werden.";
      setSystempartnerDefaultAvatarUpload({ uploading: false, error: message });
      throw error;
    }
  }

  async function runStandardTextRefresh(dryRun: boolean) {
    const selection = standardTextRefreshSelection;
    const areaIsKreis = isKreisAreaOption(selection);
    if (standardTextRefreshScope === "bundesland") {
      if (!standardTextRefreshBundeslandSlug) {
        throw new Error("Bitte zuerst ein Bundesland auswählen.");
      }
    } else {
      if (!selection?.id) {
        throw new Error("Bitte zuerst ein Gebiet auswählen.");
      }
      if ((standardTextRefreshScope === "kreis" || standardTextRefreshScope === "kreis_ortslagen") && !areaIsKreis) {
        throw new Error("Für diesen Modus muss ein Kreis ausgewählt werden.");
      }
      if (standardTextRefreshScope === "ortslage" && areaIsKreis) {
        throw new Error("Für den Ortslagen-Modus bitte eine Ortslage auswählen.");
      }
    }

    const data = await api<{
      dry_run?: boolean;
      total?: number;
      updated?: number;
      skipped?: number;
      failed?: number;
      results?: StandardTextRefreshResult[];
    }>("/api/admin/bootstrap-area-texts", {
      method: "POST",
      body: JSON.stringify({
        mode: "standard_overwrite",
        dry_run: dryRun,
        bundesland_slug: standardTextRefreshScope === "bundesland" ? standardTextRefreshBundeslandSlug : undefined,
        area_id: standardTextRefreshScope === "bundesland" ? undefined : selection?.id,
        include_ortslagen: standardTextRefreshScope === "kreis_ortslagen",
      }),
    });

    const nextResults = data.results ?? [];
    setStandardTextRefreshResults(nextResults);
    setStandardTextRefreshSummary({
      dryRun: data.dry_run === true,
      total: Number(data.total ?? nextResults.length),
      updated: Number(data.updated ?? nextResults.filter((row) => row.status === "updated").length),
      skipped: Number(data.skipped ?? nextResults.filter((row) => row.status === "skipped").length),
      failed: Number(data.failed ?? nextResults.filter((row) => row.status === "error").length),
    });
  }

  function resetNewPortalLocaleDraft() {
    setNewPortalLocaleDraft({
      locale: "",
      status: "planned",
      partner_bookable: false,
      is_active: false,
      label_native: "",
      label_de: "",
      bcp47_tag: "",
      fallback_locale: "de",
      text_direction: "ltr",
      number_locale: "",
      date_locale: "",
      currency_code: "EUR",
      billing_feature_code: "",
    });
    setNewPortalLocaleSetup({
      syncSystemTexts: true,
      syncPortalCms: true,
    });
    setNewPortalLocaleLanguageKey("");
    setNewPortalLocalePresetKey("");
  }

  function buildPortalLocaleDraftFromPreset(preset: PortalLocalePreset): PortalLocaleConfigRecord {
    return {
      locale: preset.locale,
      status: "planned",
      partner_bookable: false,
      is_active: false,
      label_native: preset.label_native,
      label_de: preset.label_de,
      bcp47_tag: preset.bcp47_tag,
      fallback_locale: preset.fallback_locale,
      text_direction: preset.text_direction,
      number_locale: preset.number_locale,
      date_locale: preset.date_locale,
      currency_code: preset.currency_code,
      billing_feature_code: preset.billing_feature_code,
    };
  }

  function applyNewPortalLocalePreset(languageKey: string, locale: string) {
    const normalizedLanguage = normalizePortalLocaleCode(languageKey);
    const normalizedLocale = normalizePortalLocaleCode(locale);
    const preset = PORTAL_LOCALE_LANGUAGE_PRESETS
      .find((language) => language.language_key === normalizedLanguage)
      ?.variants.find((item) => item.locale === normalizedLocale);
    if (!preset) {
      resetNewPortalLocaleDraft();
      return;
    }
    setNewPortalLocaleLanguageKey(normalizedLanguage);
    setNewPortalLocalePresetKey(normalizedLocale);
    setNewPortalLocaleDraft(buildPortalLocaleDraftFromPreset(preset));
    setNewPortalLocaleSetup({
      syncSystemTexts: true,
      syncPortalCms: true,
    });
  }

  function handleNewPortalLocaleLanguageChange(languageKey: string) {
    const normalizedLanguage = normalizePortalLocaleCode(languageKey);
    const language = availableNewPortalLocaleLanguages.find((item) => item.language_key === normalizedLanguage);
    if (!language) {
      resetNewPortalLocaleDraft();
      return;
    }
    const firstVariant = language.variants[0];
    applyNewPortalLocalePreset(normalizedLanguage, firstVariant.locale);
  }

  function buildNewPortalLocaleDraftPayload() {
    const locale = normalizePortalLocaleCode(newPortalLocaleDraft.locale);
    if (!locale) throw new Error("Bitte zuerst einen Locale-Code eingeben.");
    if (!isValidPortalLocaleCode(locale)) throw new Error(`Ungültiger Locale-Code: ${locale}`);
    if (portalLocaleConfigs.some((row) => row.locale === locale)) throw new Error(`Locale ${locale} ist bereits vorhanden.`);

    const bcp47Tag = String(newPortalLocaleDraft.bcp47_tag ?? "").trim() || locale;
    const nextRow: PortalLocaleConfigRecord = {
      locale,
      status: newPortalLocaleDraft.status ?? "planned",
      partner_bookable: false,
      is_active: Boolean(newPortalLocaleDraft.is_active),
      label_native: String(newPortalLocaleDraft.label_native ?? "").trim() || locale,
      label_de: String(newPortalLocaleDraft.label_de ?? "").trim() || locale,
      bcp47_tag: bcp47Tag,
      fallback_locale: String(newPortalLocaleDraft.fallback_locale ?? "").trim().toLowerCase() || "de",
      text_direction: newPortalLocaleDraft.text_direction === "rtl" ? "rtl" : "ltr",
      number_locale: String(newPortalLocaleDraft.number_locale ?? "").trim() || bcp47Tag,
      date_locale: String(newPortalLocaleDraft.date_locale ?? "").trim() || bcp47Tag,
      currency_code: String(newPortalLocaleDraft.currency_code ?? "EUR").trim().toUpperCase() || "EUR",
      billing_feature_code: String(newPortalLocaleDraft.billing_feature_code ?? "").trim() || buildPortalLocaleBillingFeatureCode(locale),
    };

    const nextConfigs = [...portalLocaleConfigs, nextRow].sort((a, b) => a.locale.localeCompare(b.locale, "de"));
    return { locale, nextConfigs };
  }

  async function savePortalLocaleConfigs(rows: PortalLocaleConfigRecord[]) {
    await api("/api/admin/portal-content", {
      method: "POST",
      body: JSON.stringify({ locale_configs: rows }),
    });
  }

  async function initializePortalLocaleFromDe(locale: string) {
    if (!locale || locale === PORTAL_CMS_SOURCE_LOCALE) return;
    if (newPortalLocaleSetup.syncSystemTexts) {
      await syncPortalSystemTextLocaleFromDe(locale, "fill_missing");
    }
    if (newPortalLocaleSetup.syncPortalCms) {
      for (const page of portalCmsPages) {
        await api("/api/admin/portal-content/sync", {
          method: "POST",
          body: JSON.stringify({
            page_key: page.page_key,
            source_locale: PORTAL_CMS_SOURCE_LOCALE,
            target_locale: locale,
            mode: "copy_all",
            target_entries: page.sections.map((section) => ({
              section_key: section.section_key,
              status: "draft",
              fields_json: buildPortalCmsEmptyFields(section),
            })),
          }),
        });
      }
    }
  }

  async function createPortalLocaleWithSetup() {
    const { locale, nextConfigs } = buildNewPortalLocaleDraftPayload();
    const baseLanguage = getPortalLocaleBaseLanguage(locale);
    const existingVariants = portalLocaleConfigs.filter((row) => (
      getPortalLocaleBaseLanguage(row.locale) === baseLanguage
      && normalizePortalLocaleCode(row.locale) !== normalizePortalLocaleCode(locale)
    ));
    if (existingVariants.length > 0) {
      const confirmed = window.confirm(
        `Für ${newPortalLocaleDraft.label_de || locale} existiert bereits mindestens eine Variante (${existingVariants.map((row) => row.locale).join(", ")}). Möchtest du ${locale} wirklich zusätzlich anlegen?`,
      );
      if (!confirmed) return;
    }
    await savePortalLocaleConfigs(nextConfigs);
    setPortalLocaleConfigs(nextConfigs);
    setPortalSystemTextLocale(locale);
    try {
      await initializePortalLocaleFromDe(locale);
      await loadPortalCms();
      resetNewPortalLocaleDraft();
    } catch (error) {
      await loadPortalCms();
      throw error;
    }
  }

  async function savePortalSystemTextLocale(locale: string) {
    const rows = portalSystemTextDefinitions.map((def) => {
      const draft = portalSystemTextDrafts[buildPortalSystemTextDraftKey(locale, def.key)] ?? {
        status: locale === "de" ? "live" as PortalSystemTextEntryStatus : "draft" as PortalSystemTextEntryStatus,
        value_text: getPortalSystemTextDefaultValue(locale, def.key),
      };
      return {
        key: def.key,
        locale,
        status: draft.status,
        value_text: draft.value_text,
      };
    });
    const data = await api<{
      definitions?: PortalSystemTextDefinition[];
      entries?: PortalSystemTextEntryRecord[];
      metas?: PortalSystemTextI18nMetaViewRecord[];
    }>("/api/admin/portal-system-texts", {
      method: "POST",
      body: JSON.stringify({ entries: rows }),
    });
    setPortalSystemTextDefinitions(data.definitions ?? PORTAL_SYSTEM_TEXT_DEFINITIONS);
    setPortalSystemTextEntries(data.entries ?? []);
    setPortalSystemTextMetas(data.metas ?? []);
    setPortalSystemTextDrafts(buildPortalSystemTextDraftMap({
      locales: portalLocaleConfigs,
      definitions: data.definitions ?? PORTAL_SYSTEM_TEXT_DEFINITIONS,
      entries: data.entries ?? [],
    }));
  }

  async function syncPortalSystemTextLocaleFromDe(locale: string, mode: "copy_all" | "fill_missing") {
    const data = await api<{
      definitions?: PortalSystemTextDefinition[];
      entries?: PortalSystemTextEntryRecord[];
      metas?: PortalSystemTextI18nMetaViewRecord[];
    }>("/api/admin/portal-system-texts", {
      method: "POST",
      body: JSON.stringify({
        sync: {
          target_locale: locale,
          mode,
        },
      }),
    });
    setPortalSystemTextDefinitions(data.definitions ?? PORTAL_SYSTEM_TEXT_DEFINITIONS);
    setPortalSystemTextEntries(data.entries ?? []);
    setPortalSystemTextMetas(data.metas ?? []);
    setPortalSystemTextDrafts(buildPortalSystemTextDraftMap({
      locales: portalLocaleConfigs,
      definitions: data.definitions ?? PORTAL_SYSTEM_TEXT_DEFINITIONS,
      entries: data.entries ?? [],
    }));
  }

  async function translatePortalSystemTextLocaleWithAi(locale: string, keys?: PortalSystemTextKey[]) {
    const data = await api<{
      definitions?: PortalSystemTextDefinition[];
      entries?: PortalSystemTextEntryRecord[];
      metas?: PortalSystemTextI18nMetaViewRecord[];
    }>("/api/admin/portal-system-texts", {
      method: "POST",
      body: JSON.stringify({
        translate: {
          target_locale: locale,
          keys: keys && keys.length > 0 ? keys : undefined,
        },
      }),
    });
    setPortalSystemTextDefinitions(data.definitions ?? PORTAL_SYSTEM_TEXT_DEFINITIONS);
    setPortalSystemTextEntries(data.entries ?? []);
    setPortalSystemTextMetas(data.metas ?? []);
    setPortalSystemTextDrafts(buildPortalSystemTextDraftMap({
      locales: portalLocaleConfigs,
      definitions: data.definitions ?? PORTAL_SYSTEM_TEXT_DEFINITIONS,
      entries: data.entries ?? [],
    }));
  }

  async function saveMarketExplanationStandardTexts() {
    const rows = marketExplanationStandardDefinitions.map((definition) => ({
      key: definition.key,
      value_text: marketExplanationStandardDrafts[definition.key] ?? "",
    }));
    const data = await api<{
      level?: MarketExplanationStandardScope;
      locale?: string;
      bundesland_slug?: string;
      bundeslaender?: MarketExplanationStandardBundesland[];
      definitions?: MarketExplanationStandardTextDefinition[];
      entries?: MarketExplanationStandardEntry[];
    }>("/api/admin/market-explanation-standard-texts", {
      method: "POST",
      body: JSON.stringify({
        level: marketExplanationStandardScope,
        bundesland_slug: marketExplanationStandardScope === "bundesland" ? marketExplanationStandardBundeslandSlug : undefined,
        locale: marketExplanationStandardScope === "bundesland" ? marketExplanationStandardLocale : "de",
        entries: rows,
      }),
    });
    const nextLevel = data.level ?? marketExplanationStandardScope;
    const nextDefinitions = data.definitions ?? getMarketExplanationStandardDefinitions(nextLevel);
    const nextEntries = data.entries ?? [];
    setMarketExplanationStandardScope(nextLevel);
    setMarketExplanationStandardLocale(data.locale ?? marketExplanationStandardLocale);
    setMarketExplanationStandardBundeslandSlug(data.bundesland_slug ?? marketExplanationStandardBundeslandSlug);
    setMarketExplanationStandardBundeslaender(data.bundeslaender ?? marketExplanationStandardBundeslaender);
    setMarketExplanationStandardDefinitions(nextDefinitions);
    setMarketExplanationStandardEntries(nextEntries);
    setMarketExplanationStandardDrafts(buildMarketExplanationStandardDraftMap({
      definitions: nextDefinitions,
      entries: nextEntries,
    }));
  }

  async function saveMarketExplanationStandardBundeslandKey(key: string) {
    if (!marketExplanationStandardBundeslandSlug) {
      throw new Error("Bitte zuerst ein Bundesland auswählen.");
    }
    const definition = marketExplanationStandardDefinitions.find((entry) => entry.key === key);
    if (!definition) {
      throw new Error(`Unbekannter Standardtext-Key: ${key}`);
    }
    const data = await api<{
      level?: MarketExplanationStandardScope;
      locale?: string;
      bundesland_slug?: string;
      bundeslaender?: MarketExplanationStandardBundesland[];
      definitions?: MarketExplanationStandardTextDefinition[];
      entries?: MarketExplanationStandardEntry[];
    }>("/api/admin/market-explanation-standard-texts", {
      method: "POST",
      body: JSON.stringify({
        level: "bundesland",
        bundesland_slug: marketExplanationStandardBundeslandSlug,
        locale: marketExplanationStandardLocale,
        entries: [{
          key,
          value_text: marketExplanationStandardDrafts[key] ?? "",
          status: marketExplanationStandardLocale === "de"
            ? undefined
            : marketExplanationStandardStatusDrafts[
              buildMarketExplanationStandardStatusDraftKey(marketExplanationStandardLocale, key)
            ] ?? "draft",
        }],
      }),
    });
    const nextDefinitions = data.definitions ?? getMarketExplanationStandardDefinitions("bundesland");
    const nextEntries = data.entries ?? [];
    setMarketExplanationStandardScope(data.level ?? "bundesland");
    setMarketExplanationStandardLocale(data.locale ?? "de");
    setMarketExplanationStandardBundeslandSlug(data.bundesland_slug ?? marketExplanationStandardBundeslandSlug);
    setMarketExplanationStandardBundeslaender(data.bundeslaender ?? marketExplanationStandardBundeslaender);
    setMarketExplanationStandardDefinitions(nextDefinitions);
    setMarketExplanationStandardEntries(nextEntries);
    setMarketExplanationStandardDrafts(buildMarketExplanationStandardDraftMap({
      definitions: nextDefinitions,
      entries: nextEntries,
    }));
    setMarketExplanationStandardStatusDrafts(buildMarketExplanationStandardStatusDraftMap({
      locale: data.locale ?? marketExplanationStandardLocale,
      definitions: nextDefinitions,
      entries: nextEntries,
    }));
  }

  async function resetMarketExplanationStandardBundeslandKey(key: string) {
    if (!marketExplanationStandardBundeslandSlug) {
      throw new Error("Bitte zuerst ein Bundesland auswählen.");
    }
    const data = await api<{
      level?: MarketExplanationStandardScope;
      locale?: string;
      bundesland_slug?: string;
      bundeslaender?: MarketExplanationStandardBundesland[];
      definitions?: MarketExplanationStandardTextDefinition[];
      entries?: MarketExplanationStandardEntry[];
    }>("/api/admin/market-explanation-standard-texts", {
      method: "POST",
      body: JSON.stringify({
        level: "bundesland",
        bundesland_slug: marketExplanationStandardBundeslandSlug,
        locale: marketExplanationStandardLocale,
        reset: {
          keys: [key],
        },
      }),
    });
    const nextDefinitions = data.definitions ?? getMarketExplanationStandardDefinitions("bundesland");
    const nextEntries = data.entries ?? [];
    setMarketExplanationStandardScope(data.level ?? "bundesland");
    setMarketExplanationStandardLocale(data.locale ?? "de");
    setMarketExplanationStandardBundeslandSlug(data.bundesland_slug ?? marketExplanationStandardBundeslandSlug);
    setMarketExplanationStandardBundeslaender(data.bundeslaender ?? marketExplanationStandardBundeslaender);
    setMarketExplanationStandardDefinitions(nextDefinitions);
    setMarketExplanationStandardEntries(nextEntries);
    setMarketExplanationStandardDrafts(buildMarketExplanationStandardDraftMap({
      definitions: nextDefinitions,
      entries: nextEntries,
    }));
    setMarketExplanationStandardStatusDrafts(buildMarketExplanationStandardStatusDraftMap({
      locale: data.locale ?? marketExplanationStandardLocale,
      definitions: nextDefinitions,
      entries: nextEntries,
    }));
  }

  async function translateMarketExplanationStandardBundeslandWithAi(locale: string, keys?: string[]) {
    if (!marketExplanationStandardBundeslandSlug) {
      throw new Error("Bitte zuerst ein Bundesland auswählen.");
    }
    const data = await api<{
      level?: MarketExplanationStandardScope;
      locale?: string;
      bundesland_slug?: string;
      bundeslaender?: MarketExplanationStandardBundesland[];
      definitions?: MarketExplanationStandardTextDefinition[];
      entries?: MarketExplanationStandardEntry[];
    }>("/api/admin/market-explanation-standard-texts", {
      method: "POST",
      body: JSON.stringify({
        level: "bundesland",
        bundesland_slug: marketExplanationStandardBundeslandSlug,
        locale,
        translate: {
          target_locale: locale,
          keys: keys && keys.length > 0 ? keys : undefined,
        },
      }),
    });
    const nextDefinitions = data.definitions ?? getMarketExplanationStandardDefinitions("bundesland");
    const nextEntries = data.entries ?? [];
    setMarketExplanationStandardScope(data.level ?? "bundesland");
    setMarketExplanationStandardLocale(data.locale ?? locale);
    setMarketExplanationStandardBundeslandSlug(data.bundesland_slug ?? marketExplanationStandardBundeslandSlug);
    setMarketExplanationStandardBundeslaender(data.bundeslaender ?? marketExplanationStandardBundeslaender);
    setMarketExplanationStandardDefinitions(nextDefinitions);
    setMarketExplanationStandardEntries(nextEntries);
    setMarketExplanationStandardDrafts(buildMarketExplanationStandardDraftMap({
      definitions: nextDefinitions,
      entries: nextEntries,
    }));
    setMarketExplanationStandardStatusDrafts(buildMarketExplanationStandardStatusDraftMap({
      locale: data.locale ?? locale,
      definitions: nextDefinitions,
      entries: nextEntries,
    }));
  }

  async function saveMarketExplanationStaticLocale(locale: string) {
    const rows = marketExplanationStaticDefinitions.map((def) => {
      const draft = marketExplanationStaticDrafts[buildMarketExplanationStaticDraftKey(locale, def.key)] ?? {
        status: locale === "de" ? "live" as MarketExplanationStaticTextEntryStatus : "draft" as MarketExplanationStaticTextEntryStatus,
        value_text: getMarketExplanationStaticTextDefaultValue(locale, def.key),
      };
      return {
        key: def.key,
        locale,
        status: draft.status,
        value_text: draft.value_text,
      };
    });
    const data = await api<{
      locales?: PortalLocaleConfigRecord[];
      definitions?: MarketExplanationStaticTextDefinition[];
      entries?: MarketExplanationStaticTextEntryRecord[];
      metas?: MarketExplanationStaticTextI18nMetaViewRecord[];
    }>("/api/admin/market-explanation-static-texts", {
      method: "POST",
      body: JSON.stringify({ entries: rows }),
    });
    const nextLocales = data.locales ?? portalLocaleConfigs;
    const nextDefinitions = data.definitions ?? MARKET_EXPLANATION_STATIC_TEXT_DEFINITIONS;
    const nextEntries = data.entries ?? [];
    setPortalLocaleConfigs(nextLocales);
    setMarketExplanationStaticDefinitions(nextDefinitions);
    setMarketExplanationStaticEntries(nextEntries);
    setMarketExplanationStaticMetas(data.metas ?? []);
    setMarketExplanationStaticDrafts(buildMarketExplanationStaticDraftMap({
      locales: nextLocales,
      definitions: nextDefinitions,
      entries: nextEntries,
    }));
  }

  async function syncMarketExplanationStaticLocaleFromDe(locale: string, mode: "copy_all" | "fill_missing") {
    const data = await api<{
      locales?: PortalLocaleConfigRecord[];
      definitions?: MarketExplanationStaticTextDefinition[];
      entries?: MarketExplanationStaticTextEntryRecord[];
      metas?: MarketExplanationStaticTextI18nMetaViewRecord[];
    }>("/api/admin/market-explanation-static-texts", {
      method: "POST",
      body: JSON.stringify({
        sync: {
          target_locale: locale,
          mode,
        },
      }),
    });
    const nextLocales = data.locales ?? portalLocaleConfigs;
    const nextDefinitions = data.definitions ?? MARKET_EXPLANATION_STATIC_TEXT_DEFINITIONS;
    const nextEntries = data.entries ?? [];
    setPortalLocaleConfigs(nextLocales);
    setMarketExplanationStaticDefinitions(nextDefinitions);
    setMarketExplanationStaticEntries(nextEntries);
    setMarketExplanationStaticMetas(data.metas ?? []);
    setMarketExplanationStaticDrafts(buildMarketExplanationStaticDraftMap({
      locales: nextLocales,
      definitions: nextDefinitions,
      entries: nextEntries,
    }));
  }

  async function translateMarketExplanationStaticLocaleWithAi(locale: string, keys?: MarketExplanationStaticTextKey[]) {
    const data = await api<{
      locales?: PortalLocaleConfigRecord[];
      definitions?: MarketExplanationStaticTextDefinition[];
      entries?: MarketExplanationStaticTextEntryRecord[];
      metas?: MarketExplanationStaticTextI18nMetaViewRecord[];
    }>("/api/admin/market-explanation-static-texts", {
      method: "POST",
      body: JSON.stringify({
        translate: {
          target_locale: locale,
          keys: keys && keys.length > 0 ? keys : undefined,
        },
      }),
    });
    const nextLocales = data.locales ?? portalLocaleConfigs;
    const nextDefinitions = data.definitions ?? MARKET_EXPLANATION_STATIC_TEXT_DEFINITIONS;
    const nextEntries = data.entries ?? [];
    setPortalLocaleConfigs(nextLocales);
    setMarketExplanationStaticDefinitions(nextDefinitions);
    setMarketExplanationStaticEntries(nextEntries);
    setMarketExplanationStaticMetas(data.metas ?? []);
    setMarketExplanationStaticDrafts(buildMarketExplanationStaticDraftMap({
      locales: nextLocales,
      definitions: nextDefinitions,
      entries: nextEntries,
    }));
  }

  function buildPortalCmsPageDraftEntries(page: PortalContentPageDefinition, locale: string) {
    return page.sections.map((section) => {
      const draftKey = `${locale}::${page.page_key}::${section.section_key}`;
      const draft = portalCmsDrafts[draftKey] ?? {
        status: "draft" as PortalContentEntryStatus,
        fields_json: buildPortalCmsEmptyFields(section),
      };
      return {
        section_key: section.section_key,
        status: draft.status,
        fields_json: draft.fields_json,
      };
    });
  }

  async function syncSelectedPortalCmsPageFromDe(mode: "copy_all" | "fill_missing" = "copy_all") {
    if (!selectedPortalCmsPage || !portalCmsLocale) return;
    storeSessionScroll(PORTAL_CMS_SCROLL_STATE_KEY);
    pendingPortalCmsScrollRestoreRef.current = true;
    await api("/api/admin/portal-content/sync", {
      method: "POST",
      body: JSON.stringify({
        page_key: selectedPortalCmsPage.page_key,
        source_locale: PORTAL_CMS_SOURCE_LOCALE,
        target_locale: portalCmsLocale,
        mode,
        target_entries: buildPortalCmsPageDraftEntries(selectedPortalCmsPage, portalCmsLocale),
      }),
    });
    await loadPortalCms();
  }

  async function translatePortalCmsSectionFromDe(args: {
    section: PortalContentPageDefinition["sections"][number];
    fieldKey?: string;
    applyMode?: "overwrite" | "fill_missing";
  }) {
    if (!selectedPortalCmsPage || !portalCmsLocale) return;
    const { section, fieldKey, applyMode = "overwrite" } = args;
    const draftKey = `${portalCmsLocale}::${selectedPortalCmsPage.page_key}::${section.section_key}`;
    const draft = portalCmsDrafts[draftKey] ?? {
      status: "draft" as PortalContentEntryStatus,
      fields_json: buildPortalCmsEmptyFields(section),
    };
    storeSessionScroll(PORTAL_CMS_SCROLL_STATE_KEY);
    pendingPortalCmsScrollRestoreRef.current = true;
    await api("/api/admin/portal-content/ai", {
      method: "POST",
      body: JSON.stringify({
        page_key: selectedPortalCmsPage.page_key,
        section_key: section.section_key,
        field_key: fieldKey,
        source_locale: PORTAL_CMS_SOURCE_LOCALE,
        target_locale: portalCmsLocale,
        apply_mode: applyMode,
        target_entry: {
          section_key: section.section_key,
          status: draft.status,
          fields_json: draft.fields_json,
        },
      }),
    });
    await loadPortalCms();
  }

  async function translateSelectedPortalCmsPageMissingFromDe() {
    if (!selectedPortalCmsPage || !portalCmsLocale) return;
    storeSessionScroll(PORTAL_CMS_SCROLL_STATE_KEY);
    pendingPortalCmsScrollRestoreRef.current = true;
    for (const section of selectedPortalCmsPage.sections) {
      const draftKey = `${portalCmsLocale}::${selectedPortalCmsPage.page_key}::${section.section_key}`;
      const draft = portalCmsDrafts[draftKey] ?? {
        status: "draft" as PortalContentEntryStatus,
        fields_json: buildPortalCmsEmptyFields(section),
      };
      await api("/api/admin/portal-content/ai", {
        method: "POST",
        body: JSON.stringify({
          page_key: selectedPortalCmsPage.page_key,
          section_key: section.section_key,
          source_locale: PORTAL_CMS_SOURCE_LOCALE,
          target_locale: portalCmsLocale,
          apply_mode: "fill_missing",
          target_entry: {
            section_key: section.section_key,
            status: draft.status,
            fields_json: draft.fields_json,
          },
        }),
      });
    }
    await loadPortalCms();
  }

  async function loadPartnerBillingConfig(partnerId: string) {
    if (!partnerId) return;
    const data = await api<{
      portal?: {
        overrides?: {
          portal_base_price_eur?: number | null;
          portal_ortslage_price_eur?: number | null;
          portal_export_ortslage_price_eur?: number | null;
        };
      };
      features?: PartnerBillingFeature[];
      locale_features?: PartnerLocaleBillingFeature[];
    }>(`/api/admin/partners/${partnerId}/billing`);
    const overrides = data.portal?.overrides ?? {};
    setPartnerPortalBillingDraft({
      portal_base_price_eur: overrides.portal_base_price_eur === null || overrides.portal_base_price_eur === undefined ? "" : String(overrides.portal_base_price_eur),
      portal_ortslage_price_eur: overrides.portal_ortslage_price_eur === null || overrides.portal_ortslage_price_eur === undefined ? "" : String(overrides.portal_ortslage_price_eur),
      portal_export_ortslage_price_eur: overrides.portal_export_ortslage_price_eur === null || overrides.portal_export_ortslage_price_eur === undefined ? "" : String(overrides.portal_export_ortslage_price_eur),
    });
    setPartnerFeatureBillingRows((data.features ?? []).map((row) => ({
      ...row,
      enabled: row.enabled === true,
      monthly_price_eur: Number(row.monthly_price_eur ?? 0),
      default_enabled: row.default_enabled === true,
      default_monthly_price_eur: Number(row.default_monthly_price_eur ?? 0),
    })));
    setPartnerLocaleBillingRows((data.locale_features ?? []).map((row) => ({
      ...row,
      feature_exists: row.feature_exists === true,
      feature_is_active: row.feature_is_active === true,
      partner_bookable: row.partner_bookable === true,
      is_active: row.is_active === true,
      default_enabled: row.default_enabled === true,
      default_monthly_price_eur: Number(row.default_monthly_price_eur ?? 0),
      enabled: row.enabled === true,
      monthly_price_eur: Number(row.monthly_price_eur ?? 0),
      sort_order: Number(row.sort_order ?? 100),
    })));
  }

  async function loadLlmGlobalDashboard() {
    await Promise.all([
      loadLlmGlobalConfig(),
      loadLlmAccounts(),
      loadLlmProviders(),
      loadLlmUsage(),
    ]);
  }

  useEffect(() => {
    if (!adminViewStateHydrated || adminBootstrapRef.current) return;
    adminBootstrapRef.current = true;
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const fromMeta = String((user?.user_metadata as { full_name?: string; name?: string } | undefined)?.full_name
          ?? (user?.user_metadata as { full_name?: string; name?: string } | undefined)?.name
          ?? "")
          .trim();
        const label = fromMeta || String(user?.email ?? "Admin").trim() || "Admin";
        setAdminDisplayName(label);
        setLastLogin(String(user?.last_sign_in_at ?? "").trim());
        const restoredActiveView = adminViewState.activeView ?? "home";
        const restoredPartnerId = String(adminViewState.selectedPartnerId ?? "").trim();
        const shouldLoadSelectedPartner =
          Boolean(restoredPartnerId)
          && (restoredActiveView === "partner_edit" || restoredActiveView === "partner_purge");
        await loadPartners(
          shouldLoadSelectedPartner ? restoredPartnerId : undefined,
          { refreshSelectedDetails: shouldLoadSelectedPartner },
        );
        if (restoredActiveView === "audit") {
          await loadAuditLogs();
        }
        setStatus("Admin-Bereich bereit.");
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Fehler beim Laden");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminViewState.activeView, adminViewState.selectedPartnerId, adminViewStateHydrated]);

  useEffect(() => {
    if (activeView !== "audit" || auditLoadedOnce || auditLoading) return;
    void run("Audit-Log laden", async () => {
      await loadAuditLogs();
    }, { showSuccessModal: false });
  }, [activeView, auditLoadedOnce, auditLoading]);

  useEffect(() => {
    if (!areaQuery.trim()) {
      setAreaOptions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const data = await api<{ areas: AreaOption[] }>(
          `/api/admin/areas?q=${encodeURIComponent(areaQuery)}&limit=20`,
        );
        setAreaOptions(data.areas ?? []);
      } catch {
        setAreaOptions([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [areaQuery]);

  useEffect(() => {
    if (!selectedPartnerId || !reviewAreaId) {
      setReviewData(null);
      return;
    }
    void loadAreaReview(reviewAreaId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPartnerId, reviewAreaId]);

  useEffect(() => {
    if (!selectedPartner?.is_system_default) return;
    if (partnerTab === "review" || partnerTab === "integrations" || partnerTab === "billing") {
      setPartnerTab("areas");
    }
  }, [selectedPartner?.is_system_default, partnerTab]);

  useEffect(() => {
    const nextDrafts: Record<string, CrmIntegrationAdminDraft> = {};
    for (const integration of integrations) {
      if (String(integration.kind ?? "").toLowerCase() !== "crm") continue;
      nextDrafts[integration.id] = buildCrmIntegrationAdminDraft(integration);
    }
    setCrmIntegrationDrafts(nextDrafts);
  }, [integrations]);

  function closeSuccessModal() {
    setSuccessModal((v) => ({ ...v, open: false }));
    if (clearReviewOnSuccessClose) {
      setReviewData(null);
      setReviewAreaId("");
      setReviewActionError(null);
      setReviewContentDismissed(true);
      setClearReviewOnSuccessClose(false);
    }
  }

  async function run(
    label: string,
    fn: () => Promise<void>,
    options?: { clearReviewOnClose?: boolean; showSuccessModal?: boolean },
  ) {
    setBusy(true);
    setStatus(label);
    try {
      await fn();
      setClearReviewOnSuccessClose(Boolean(options?.clearReviewOnClose));
      setStatus(`${label} erfolgreich.`);
      if (options?.showSuccessModal === true) {
        const successTitle = label === "Gebiet zuordnen" ? "Gebiet zugeordnet" : "Erfolgreich";
        const successMessage = label === "Gebiet zuordnen"
          ? "Der Partner wird per E-Mail informiert und kann anschließend die Pflichtangaben zur finalen Freigabe machen."
          : `${label} wurde erfolgreich ausgefuehrt.`;
        setSuccessModal({
          open: true,
          title: successTitle,
          message: successMessage,
        });
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : `${label} fehlgeschlagen.`);
    } finally {
      setBusy(false);
    }
  }

  async function syncProviderPricing() {
    setBusy(true);
    setStatus("Provider-Preise synchronisieren");
    try {
      const sync = await api<{
        summary?: { total?: number; observed?: number; applied?: number; failed?: number };
        results?: Array<{ provider?: string; model?: string; status?: string }>;
      }>("/api/admin/llm/pricing-sync", {
        method: "POST",
        body: JSON.stringify({ apply: true }),
      });

      const total = Number(sync.summary?.total ?? 0);
      const applied = Number(sync.summary?.applied ?? 0);
      const failed = Number(sync.summary?.failed ?? 0);
      const failedItems = (sync.results ?? [])
        .filter((r) => String(r.status ?? "") !== "applied")
        .map((r) => `${String(r.provider ?? "").trim()}:${String(r.model ?? "").trim()}`)
        .filter(Boolean)
        .slice(0, 3);

      await loadLlmProviders();

      if (total <= 0) {
        throw new Error("Keine aktiven LLM-Provider für den Preis-Sync gefunden.");
      }
      if (applied <= 0) {
        throw new Error("Es konnten keine Preise automatisch übernommen werden. Bitte Preise manuell eintragen.");
      }
      if (applied < total) {
        setStatus(`Preise teilweise aktualisiert (${applied}/${total}).`);
        return;
      }

      setStatus("Preise erfolgreich aktualisiert.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Preis-Sync fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreatePartnerSubmit() {
    setBusy(true);
    setStatus("Neuen Partner anlegen");
    setCreatePartnerError(null);
    try {
      if (!createPartner.company_name.trim() || !createPartner.contact_email.trim()) {
        throw new Error("Bitte Firmenname, Kontakt-E-Mail, Vorname und Nachname ausfuellen.");
      }
      if (!createPartner.contact_first_name.trim() || !createPartner.contact_last_name.trim()) {
        throw new Error("Bitte Vorname und Nachname ausfuellen.");
      }
      const created = await api<{
        partner: { id: string; company_name?: string | null; contact_email?: string | null };
        delivery?: { sent?: boolean; contact_email?: string | null; link_type?: "invite" | "recovery" };
      }>(
        "/api/admin/partners",
        {
          method: "POST",
          body: JSON.stringify(createPartner),
        },
      );

      const createdId = String(created.partner?.id ?? "").trim();
      if (!createdId) {
        throw new Error("Partner wurde angelegt, aber ohne gueltige ID.");
      }

      setCreatePartner({
        company_name: "",
        contact_email: "",
        contact_first_name: "",
        contact_last_name: "",
        website_url: "",
      });
      await loadPartners(createdId);
      setCreatedPartnerSuccess({
        mode: "created",
        id: createdId,
        company_name: String(created.partner?.company_name ?? "").trim() || createPartner.company_name.trim(),
        contact_email: String(created.partner?.contact_email ?? "").trim() || createPartner.contact_email.trim(),
        delivery_sent: created.delivery?.sent === true,
        delivery_message: created.delivery?.sent === true
          ? `Die Einladungsmail wurde erfolgreich an ${String(created.delivery?.contact_email ?? created.partner?.contact_email ?? createPartner.contact_email).trim() || "die Kontakt-E-Mail"} versendet.`
          : "Der Partner wurde angelegt, aber der Mailversand konnte nicht bestaetigt werden.",
      });
      setActiveView("new_partner_success");
      setStatus(created.delivery?.sent === true ? "Neuer Partner angelegt." : "Partner angelegt, Mailversand unklar.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Partner konnte nicht angelegt werden.";
      const lower = message.toLowerCase();
      const requestedEmail = String(createPartner.contact_email ?? "").trim().toLowerCase();

      if (
        (lower.includes("already exists") || lower.includes("bereits")) &&
        requestedEmail.length > 0
      ) {
        try {
          const data = await api<{ partners: Partner[] }>("/api/admin/partners?include_inactive=1");
          const existing = (data.partners ?? []).find(
            (p) => String(p.contact_email ?? "").trim().toLowerCase() === requestedEmail,
          );
          if (existing?.id) {
            setCreatedPartnerSuccess({
              mode: "existing",
              id: existing.id,
              company_name: String(existing.company_name ?? "").trim() || "Bestehender Partner",
              contact_email: String(existing.contact_email ?? "").trim() || requestedEmail,
            });
            setActiveView("new_partner_success");
            setStatus("Partner existiert bereits.");
            return;
          }
        } catch {
          // Fallback: show inline error below.
        }
      }

      setStatus(message);
      setCreatePartnerError(message);
    } finally {
      setBusy(false);
    }
  }

  async function sendPartnerAccessLink(partnerId: string) {
    if (!partnerId) return;
    setBusy(true);
    setStatus("Zugangslink wird versendet");
    try {
      const response = await api<{
        contact_email?: string | null;
        link_type?: "invite" | "recovery";
      }>(`/api/admin/partners/${partnerId}/invite-user`, {
        method: "POST",
      });
      await loadPartners(partnerId);
      const linkType = String(response.link_type ?? "").trim().toLowerCase();
      const email = String(response.contact_email ?? "").trim();
      setStatus(
        linkType === "invite"
          ? `Einladungslink an ${email || "die Kontakt-E-Mail"} versendet.`
          : `Passwort-Link an ${email || "die Kontakt-E-Mail"} versendet.`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Zugangslink konnte nicht versendet werden.");
    } finally {
      setBusy(false);
    }
  }

  async function selectPartnerView(partnerId: string, view: AdminView) {
    if (!partnerId) return;
    setBusy(true);
    setStatus("Daten werden geladen...");
    try {
      setReviewAreaId("");
      setReviewData(null);
      setReviewActionError(null);
      setReviewContentDismissed(false);
      setSelectedPartnerId(partnerId);
      await loadPartnerDetails(partnerId);
      setActiveView(view);
      setPartnerTab("profile");
      setIntegrationsAdminTab("overview");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Partner konnte nicht geladen werden.");
    } finally {
      setBusy(false);
    }
  }

  async function selectSidebarPartner(partnerId: string) {
    const nextView: AdminView = activeView === "partner_purge" ? "partner_purge" : "partner_edit";
    await selectPartnerView(partnerId, nextView);
  }

  async function openPartnerPurgeModal() {
    if (!selectedPartnerId || !selectedPartner) return;
    setPartnerPurgeModal({
      open: true,
      partnerId: selectedPartnerId,
      partnerName: selectedPartner.company_name ?? selectedPartnerId,
      loading: true,
      deleting: false,
      errorMessage: null,
      canPurge: false,
      blockers: [],
      summary: {
        areaMappingsTotal: 0,
        integrationsActive: 0,
        storageFiles: 0,
      },
      confirmText: "",
    });
    try {
      const data = await api<PartnerPurgeCheckPayload>(`/api/admin/partners/${selectedPartnerId}/purge-check`);
      const blockers = Array.isArray(data.blockers) ? data.blockers.map((v) => String(v)) : [];
      const summary = {
        areaMappingsTotal: Number(data.summary?.areaMappingsTotal ?? 0),
        integrationsActive: Number(data.summary?.integrationsActive ?? 0),
        storageFiles: Number(data.summary?.storageFiles ?? 0),
      };
      const canPurge =
        Boolean(data.can_purge)
        && blockers.length === 0
        && summary.areaMappingsTotal === 0;
      setPartnerPurgeModal((prev) => ({
        ...prev,
        loading: false,
        errorMessage: null,
        canPurge,
        blockers,
        summary,
      }));
    } catch (error) {
      setPartnerPurgeModal((prev) => ({
        ...prev,
        loading: false,
        errorMessage: null,
        canPurge: false,
        blockers: [error instanceof Error ? error.message : "Purge-Check fehlgeschlagen."],
      }));
    }
  }

  async function executePartnerPurge() {
    if (!partnerPurgeModal.partnerId || partnerPurgeModal.deleting) return;
    setPartnerPurgeModal((prev) => ({ ...prev, deleting: true, errorMessage: null }));
    setStatus("Partner wird endgültig entfernt...");
    try {
      const res = await fetch(`/api/admin/partners/${encodeURIComponent(partnerPurgeModal.partnerId)}/purge`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirm_text: partnerPurgeModal.confirmText,
        }),
      });
      const data = await readJsonSafe(res);
      if (!res.ok) {
        const errorText = String(data?.error ?? `HTTP ${res.status}`);
        const blockers = Array.isArray(data?.blockers) ? data.blockers.map((v: unknown) => String(v)).join(" | ") : "";
        throw new Error(blockers ? `${errorText}: ${blockers}` : errorText);
      }
      setPartnerPurgeModal((prev) => ({ ...prev, open: false, deleting: false }));
      setSelectedPartner(null);
      setSelectedPartnerId("");
      setActiveView("partner_purge");
      setPartnerTab("profile");
      await loadPartners();
      const warning = String(data?.warning ?? "").trim();
      setSuccessModal({
        open: true,
        title: warning ? "Teilweise abgeschlossen" : "Erfolgreich",
        message: warning
          ? `${warning}${data?.dump_path ? ` Sicherheitsdump: ${String(data.dump_path)}` : ""}`
          : `Partner wurde endgültig entfernt.${data?.dump_path ? ` Sicherheitsdump: ${String(data.dump_path)}` : ""}`,
      });
      setStatus(warning ? "Partnerdaten wurden weitgehend entfernt, Auth-User blieb bestehen." : "Partner wurde endgültig entfernt.");
    } catch (error) {
      const message = extractErrorMessage(error, "Partner konnte nicht entfernt werden.");
      setPartnerPurgeModal((prev) => ({ ...prev, deleting: false, errorMessage: message }));
      setStatus(message);
    }
  }

  async function executeHandoverWithStatus(input: {
    areaId: string;
    oldPartnerId: string;
    newPartnerId: string;
    transferMode: "base_reset" | "copy_partner_state";
    includeReportCustomization: boolean;
    includeSeoGeo: boolean;
    blogTransferMode: HandoverBlogTransferMode;
    localeModes: Record<string, HandoverLocaleMode>;
    oldPartnerIsSystemDefault: boolean;
  }) {
    setBusy(true);
    setHandoverStatusModal({
      open: true,
      title: "Gebietsübergabe läuft",
      lines: [
        `Kreis: ${handoverConfirmModal.areaId === input.areaId && handoverConfirmModal.areaLabel ? handoverConfirmModal.areaLabel : input.areaId}`,
        "1/4 Übergabe auf Server starten...",
      ],
      done: false,
      hasError: false,
    });
    try {
      const result = await api<HandoverApiResponse>("/api/admin/handovers", {
        method: "POST",
        body: JSON.stringify({
          area_id: input.areaId,
          old_partner_id: input.oldPartnerId,
          new_partner_id: input.newPartnerId,
          transfer_mode: input.transferMode,
          include_report_customization: input.includeReportCustomization,
          include_seo_geo: input.includeSeoGeo,
          blog_transfer_mode: input.blogTransferMode,
          locale_modes: input.localeModes,
        }),
      });
      setHandoverStatusModal((m) => ({
        ...m,
        lines: [
          ...m.lines,
          "2/4 Server-Übergabe abgeschlossen.",
          `Berichtindividualisierung: ${result.handover?.include_report_customization ? "übernommen" : "Basiszustand"}`,
          `SEO & GEO: ${result.handover?.include_seo_geo ? "übernommen" : "nicht übernommen"}`,
          `Blogarchiv: ${formatHandoverBlogTransferModeLabel(result.handover?.blog_transfer_mode ?? input.blogTransferMode)}`,
          input.oldPartnerIsSystemDefault
            ? "Hinweis: Das Gebiet wurde vom Portalpartner auf einen operativen Partner überführt. Der Portalpartner bleibt dauerhaft aktiv."
            : `Alte Integrationen deaktiviert: ${result.handover?.deactivate_old_integrations_applied ? "Ja" : "Nein"}`,
          `Kopiert Bericht: Faktoren ${result.handover?.copied_partner_state?.data_value_settings ?? 0}, Report-Texte ${result.handover?.copied_partner_state?.report_texts ?? 0}, Runtime ${result.handover?.copied_partner_state?.runtime_states ?? 0}, data-driven Texte ${result.handover?.copied_partner_state?.generated_texts ?? 0}, Übersetzungen ${result.handover?.copied_partner_state?.portal_i18n ?? 0}`,
          `Kopiert SEO/GEO: Texte ${result.handover?.copied_partner_state?.marketing_texts ?? 0}, Übersetzungen ${result.handover?.copied_partner_state?.marketing_i18n ?? 0}`,
          `Kopiert Blog: Beiträge ${result.handover?.copied_partner_state?.blog_posts ?? 0}, Übersetzungen ${result.handover?.copied_partner_state?.blog_i18n ?? 0}`,
          `Sprachen: aktiviert ${result.handover?.copied_partner_state?.locales_enabled ?? 0}, deaktiviert ${result.handover?.copied_partner_state?.locales_disabled ?? 0}, übersprungen ${result.handover?.copied_partner_state?.locales_skipped ?? 0}`,
          input.oldPartnerIsSystemDefault
            ? "Hinweis: Der Portalpartner wird nicht über Datenbereinigung entfernt."
            : "Hinweis: Alter Partner bleibt aktiv. Eine vollständige Entfernung erfolgt nur separat über Datenbereinigung.",
          "3/4 Partner- und Gebietsübersicht aktualisieren...",
        ],
      }));

      await loadPartners(input.newPartnerId);
      setHandoverStatusModal((m) => ({
        ...m,
        lines: [...m.lines, "4/4 Audit-Log aktualisieren..."],
      }));
      await loadAuditLogs();
      setHandoverDraft({
        area_id: "",
        new_partner_id: "",
        transfer_mode: "base_reset",
        include_report_customization: true,
        include_seo_geo: true,
        blog_transfer_mode: "copy_as_draft",
        locale_modes: {},
      });

      setHandoverStatusModal((m) => ({
        ...m,
        title: "Gebietsübergabe abgeschlossen",
        lines: [
          ...m.lines,
          `Gebiet ${result.handover?.area_name ? `${result.handover.area_name} (${result.handover.area_id ?? input.areaId})` : (result.handover?.area_id ?? input.areaId)} erfolgreich von ${input.oldPartnerId} an ${input.newPartnerId} übergeben!`,
        ],
        done: true,
      }));
      setStatus("Gebietsübergabe erfolgreich.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unbekannter Fehler";
      setHandoverStatusModal((m) => ({
        ...m,
        title: "Gebietsübergabe fehlgeschlagen",
        lines: [...m.lines, `Fehler: ${message}`],
        done: true,
        hasError: true,
      }));
      setStatus(`Gebietsübergabe fehlgeschlagen: ${message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={wrapStyle}>
      <FullscreenLoader
        show={busy || reviewBusy || status === "Lade Admin-Daten..."}
        label="Daten werden geladen..."
      />
      {successModal.open ? (
        <div
          style={modalOverlayStyle}
          onClick={closeSuccessModal}
          onKeyDown={(e) => {
            if (e.key === "Escape") closeSuccessModal();
          }}
        >
          <div
            style={modalCardStyle}
            ref={successModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="success-modal-title"
            aria-describedby="success-modal-message"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="success-modal-title" style={modalTitleStyle}>{successModal.title}</h3>
            <p id="success-modal-message" style={modalMessageStyle}>{successModal.message}</p>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                style={btnStyle}
                onClick={closeSuccessModal}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {handoverConfirmModal.open ? (
        <div
          style={modalOverlayStyle}
          onClick={() => setHandoverConfirmModal((v) => ({ ...v, open: false }))}
          onKeyDown={(e) => {
            if (e.key === "Escape") setHandoverConfirmModal((v) => ({ ...v, open: false }));
          }}
        >
          <div
            style={modalCardStyle}
            ref={handoverConfirmModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="handover-confirm-title"
            aria-describedby="handover-confirm-message"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="handover-confirm-title" style={modalTitleStyle}>Gebietsübergabe bestätigen</h3>
            <p id="handover-confirm-message" style={modalMessageStyle}>
              Kreis <strong>{handoverConfirmModal.areaLabel || handoverConfirmModal.areaId}</strong> wird von
              {" "}
              <strong>{selectedPartner?.company_name ?? handoverConfirmModal.oldPartnerId}</strong>
              {" "}an{" "}
              <strong>{partners.find((p) => p.id === handoverConfirmModal.newPartnerId)?.company_name ?? handoverConfirmModal.newPartnerId}</strong>
              {" "}übergeben.
            </p>
            <p style={{ ...modalMessageStyle, marginTop: -4 }}>
              Berichtindividualisierung: <strong>{handoverConfirmModal.includeReportCustomization ? "übernehmen" : "Basiszustand"}</strong> · SEO &amp; GEO: <strong>{handoverConfirmModal.includeSeoGeo ? "übernehmen" : "nicht übernehmen"}</strong>
            </p>
            <p style={{ ...modalMessageStyle, marginTop: -4 }}>
              Blogarchiv: <strong>{formatHandoverBlogTransferModeLabel(handoverConfirmModal.blogTransferMode)}</strong>
            </p>
            <p style={{ ...modalMessageStyle, marginTop: -4 }}>
              Sprachen: <strong>{
                Object.keys(handoverConfirmModal.localeModes).length > 0
                  ? Object.entries(handoverConfirmModal.localeModes)
                    .map(([locale, mode]) => `${locale} (${formatHandoverLocaleModeLabel(mode)})`)
                    .join(", ")
                  : "keine zusätzlichen Sprachen"
              }</strong>
            </p>
            <p style={{ ...modalMessageStyle, marginTop: -4 }}>
              {handoverConfirmModal.oldPartnerIsSystemDefault
                ? "Hinweis: Der Portalpartner bleibt dauerhaft aktiv."
                : "Hinweis: Dieser Partner bleibt noch aktiv, seine Integrationen werden deaktiviert bis zur vollständigen Löschung des Accounts."}
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                style={btnGhostStyle}
                onClick={() => setHandoverConfirmModal((v) => ({ ...v, open: false }))}
              >
                Abbrechen
              </button>
              <button
                style={btnDangerStyle}
                onClick={() => {
                  const payload = handoverConfirmModal;
                  setHandoverConfirmModal((v) => ({ ...v, open: false }));
                  executeHandoverWithStatus({
                    areaId: payload.areaId,
                    oldPartnerId: payload.oldPartnerId,
                    newPartnerId: payload.newPartnerId,
                    transferMode: payload.transferMode,
                    includeReportCustomization: payload.includeReportCustomization,
                    includeSeoGeo: payload.includeSeoGeo,
                    blogTransferMode: payload.blogTransferMode,
                    localeModes: payload.localeModes,
                    oldPartnerIsSystemDefault: payload.oldPartnerIsSystemDefault,
                  });
                }}
              >
                Übergabe jetzt ausführen
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {areaDeleteConfirmModal.open ? (
        <div
          style={modalOverlayStyle}
          onClick={() => setAreaDeleteConfirmModal((v) => ({ ...v, open: false }))}
          onKeyDown={(e) => {
            if (e.key === "Escape") setAreaDeleteConfirmModal((v) => ({ ...v, open: false }));
          }}
        >
          <div
            style={modalCardStyle}
            ref={areaDeleteConfirmModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="area-delete-confirm-title"
            aria-describedby="area-delete-confirm-message"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="area-delete-confirm-title" style={modalTitleStyle}>Gebietszuordnung löschen?</h3>
            <p id="area-delete-confirm-message" style={modalMessageStyle}>
              Das Gebiet <strong>{areaDeleteConfirmModal.areaName || areaDeleteConfirmModal.areaId}</strong> wird vom Partner entfernt.
            </p>
            <p style={{ ...modalMessageStyle, marginTop: -4 }}>
              Folge: Der Partner verliert den Zugriff auf dieses Gebiet im Dashboard. Bereits erfasste Eingaben bleiben in der Datenbank erhalten, sind aber nicht mehr über die Zuordnung sichtbar.
            </p>
            {areaDeleteConfirmModal.isActive ? (
              <p style={{ ...modalMessageStyle, marginTop: -4, color: "#991b1b", fontWeight: 700 }}>
                Achtung: Das Gebiet ist aktuell aktiv.
              </p>
            ) : null}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                style={btnGhostStyle}
                onClick={() => setAreaDeleteConfirmModal((v) => ({ ...v, open: false }))}
              >
                Abbrechen
              </button>
              <button
                style={btnDangerStyle}
                onClick={() => {
                  const payload = areaDeleteConfirmModal;
                  setAreaDeleteConfirmModal((v) => ({ ...v, open: false }));
                  void run("Mapping löschen", async () => {
                    await api(`/api/admin/partners/${selectedPartnerId}/areas/${payload.areaId}`, {
                      method: "DELETE",
                    });
                    await loadPartners(selectedPartnerId, { refreshSelectedDetails: false });
                    await loadPartnerDetails(selectedPartnerId);
                  });
                }}
              >
                Löschen bestätigen
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {integrationDeleteConfirmModal.open ? (
        <div
          style={modalOverlayStyle}
          onClick={() => setIntegrationDeleteConfirmModal((v) => ({ ...v, open: false }))}
          onKeyDown={(e) => {
            if (e.key === "Escape") setIntegrationDeleteConfirmModal((v) => ({ ...v, open: false }));
          }}
        >
          <div
            style={modalCardStyle}
            ref={integrationDeleteConfirmModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="integration-delete-confirm-title"
            aria-describedby="integration-delete-confirm-message"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="integration-delete-confirm-title" style={modalTitleStyle}>Integration löschen?</h3>
            <p id="integration-delete-confirm-message" style={modalMessageStyle}>
              Die Integration <strong>{integrationDeleteConfirmModal.kind}</strong> / <strong>{integrationDeleteConfirmModal.provider}</strong> wird endgültig entfernt.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                style={btnGhostStyle}
                onClick={() => setIntegrationDeleteConfirmModal((v) => ({ ...v, open: false }))}
              >
                Abbrechen
              </button>
              <button
                style={btnDangerStyle}
                onClick={() => {
                  const payload = integrationDeleteConfirmModal;
                  setIntegrationDeleteConfirmModal((v) => ({ ...v, open: false }));
                  void run("Integration löschen", async () => {
                    if (!selectedPartnerId || !payload.integrationId) return;
                    await api(`/api/admin/integrations/${payload.integrationId}`, { method: "DELETE" });
                    await loadPartnerDetails(selectedPartnerId);
                  });
                }}
              >
                Löschen bestätigen
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {partnerPurgeModal.open ? (
        <div
          style={modalOverlayStyle}
          onClick={() => {
            if (partnerPurgeModal.deleting) return;
            setPartnerPurgeModal((v) => ({ ...v, open: false }));
          }}
          onKeyDown={(e) => {
            if (e.key !== "Escape" || partnerPurgeModal.deleting) return;
            setPartnerPurgeModal((v) => ({ ...v, open: false }));
          }}
        >
          <div
            style={modalCardStyle}
            ref={partnerPurgeModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="partner-purge-title"
            aria-describedby="partner-purge-message"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="partner-purge-title" style={modalTitleStyle}>Partner endgültig entfernen</h3>
            <p id="partner-purge-message" style={modalMessageStyle}>
              Partner <strong>{partnerPurgeModal.partnerName || partnerPurgeModal.partnerId}</strong> wird vollständig gelöscht (inkl. Auth-User).
            </p>
            {partnerPurgeModal.loading ? (
              <p style={{ ...modalMessageStyle, marginTop: -4 }}>Prüfe Voraussetzungen...</p>
            ) : (
              <>
                <p style={{ ...modalMessageStyle, marginTop: -4 }}>
                  Gebietszuordnungen: {partnerPurgeModal.summary.areaMappingsTotal} | Aktive Integrationen: {partnerPurgeModal.summary.integrationsActive} | Storage-Dateien: {partnerPurgeModal.summary.storageFiles}
                </p>
                {partnerPurgeModal.summary.areaMappingsTotal > 0 ? (
                  <div style={{ marginTop: 6, marginBottom: 10, fontSize: 12, color: "#991b1b", lineHeight: 1.5 }}>
                    Vor dem endgültigen Löschen müssen zuerst alle Gebietszuordnungen entfernt oder übergeben werden.{" "}
                    <button
                      type="button"
                      style={inlineLinkButtonStyle}
                      disabled={partnerPurgeModal.deleting}
                      onClick={() => {
                        setPartnerPurgeModal((v) => ({ ...v, open: false }));
                        setPartnerTab("areas");
                        setStatus("Bitte zuerst die Gebietszuordnungen entfernen oder an einen anderen Partner übergeben.");
                      }}
                    >
                      Zu den Gebieten
                    </button>
                  </div>
                ) : null}
                {partnerPurgeModal.summary.integrationsActive > 0 ? (
                  <p style={{ ...modalMessageStyle, marginTop: -2 }}>
                    Hinweis: Aktive Integrationen werden beim endgültigen Löschen automatisch mit entfernt.
                  </p>
                ) : null}
                {partnerPurgeModal.summary.storageFiles > 0 ? (
                  <p style={{ ...modalMessageStyle, marginTop: -2 }}>
                    Hinweis: Storage-Dateien werden beim endgültigen Löschen automatisch mit entfernt.
                  </p>
                ) : null}
                {partnerPurgeModal.blockers.length > 0 ? (
                  <div style={{ marginTop: 6, marginBottom: 10, fontSize: 12, color: "#991b1b" }}>
                    {partnerPurgeModal.blockers.join(" | ")}
                  </div>
                ) : null}
                {partnerPurgeModal.errorMessage ? (
                  <div style={{ marginTop: 6, marginBottom: 10, fontSize: 12, color: "#991b1b", lineHeight: 1.5 }}>
                    {partnerPurgeModal.errorMessage}
                  </div>
                ) : null}
                {partnerPurgeModal.canPurge ? (
                  <>
                    <p style={{ ...modalMessageStyle, marginTop: 2 }}>
                      Zum endgültigen Löschen bitte <strong>LOESCHEN</strong> eingeben.
                    </p>
                    <input
                      style={inputStyle}
                      placeholder='Bestätigungstext: LOESCHEN'
                      value={partnerPurgeModal.confirmText}
                      onChange={(e) => setPartnerPurgeModal((v) => ({ ...v, confirmText: e.target.value }))}
                      disabled={partnerPurgeModal.deleting}
                    />
                  </>
                ) : null}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
                  <button
                    style={btnGhostStyle}
                    disabled={partnerPurgeModal.deleting}
                    onClick={() => setPartnerPurgeModal((v) => ({ ...v, open: false }))}
                  >
                    Abbrechen
                  </button>
                  {(() => {
                    const purgeDisabled =
                      partnerPurgeModal.loading
                      || partnerPurgeModal.deleting
                      || !partnerPurgeModal.canPurge
                      || partnerPurgeModal.blockers.length > 0
                      || partnerPurgeModal.summary.areaMappingsTotal > 0
                      || String(partnerPurgeModal.confirmText).trim().toUpperCase() !== "LOESCHEN";
                    return (
                      <button
                        style={{
                          ...btnDangerStyle,
                          background: purgeDisabled ? "#f1f5f9" : btnDangerStyle.background,
                          borderColor: purgeDisabled ? "#cbd5e1" : "#ef4444",
                          color: purgeDisabled ? "#94a3b8" : "#b91c1c",
                          cursor: purgeDisabled ? "not-allowed" : "pointer",
                        }}
                        disabled={purgeDisabled}
                        onClick={() => {
                          void executePartnerPurge();
                        }}
                      >
                        {partnerPurgeModal.deleting ? "Lösche..." : "Endgültig löschen"}
                      </button>
                    );
                  })()}
                </div>
              </>)}
          </div>
        </div>
      ) : null}
      {handoverStatusModal.open ? (
        <div
          style={modalOverlayStyle}
          onClick={() => {
            if (!handoverStatusModal.done) return;
            setHandoverStatusModal((m) => ({ ...m, open: false }));
          }}
          onKeyDown={(e) => {
            if (e.key !== "Escape" || !handoverStatusModal.done) return;
            setHandoverStatusModal((m) => ({ ...m, open: false }));
          }}
        >
          <div
            style={modalCardStyle}
            ref={handoverStatusModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="handover-status-title"
            aria-describedby="handover-status-message"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="handover-status-title" style={modalTitleStyle}>{handoverStatusModal.title}</h3>
            <div style={{ display: "grid", gap: 6, marginBottom: 14 }}>
              {handoverStatusModal.lines.map((line, idx) => (
                <div key={`${idx}:${line}`} style={{ fontSize: 13, color: "#334155" }}>
                  {line}
                </div>
              ))}
            </div>
            <span id="handover-status-message" className="visually-hidden">
              Status der Gebietsübergabe
            </span>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                style={handoverStatusModal.done ? (handoverStatusModal.hasError ? btnDangerStyle : btnStyle) : btnGhostStyle}
                disabled={!handoverStatusModal.done}
                onClick={() => setHandoverStatusModal((m) => ({ ...m, open: false }))}
              >
                {handoverStatusModal.done ? "Schließen" : "Läuft..."}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <header style={dashboardHeaderStyle}>
        <div
          className="brand-header"
          style={{ margin: 0, cursor: "pointer" }}
          onClick={() => {
            setActiveView("home");
            setShowHeaderMenu(false);
          }}
          title="Zur Startseite"
        >
          <Image
            alt="Immobilienmarkt & Standortprofile"
            width={48}
            height={48}
            src="/logo/wohnlagencheck24.svg"
            className="brand-icon"
            style={{ display: "block" }}
            priority
          />
          <span className="brand-text">
            <span className="brand-title">
              Wohnlagencheck<span style={{ color: "#ffe000" }}>24</span>
            </span>
            <small>DATA-DRIVEN. EXPERT-LED.</small>
          </span>
        </div>
        <div style={dashboardStatusStyle}>
          <div>{lastLogin ? `Letzter Login: ${new Date(lastLogin).toLocaleString("de-DE")}` : "Letzter Login: –"}</div>
          <button
            type="button"
            style={headerActionButtonStyle}
            onClick={() => {
              setActiveView("home");
              setShowHeaderMenu(false);
            }}
            title="Startseite"
          >
            <span aria-hidden>⌂</span>
            <span>Home</span>
          </button>
          <div className="navbar navbar-light p-0 m-0" style={menuWrapStyle}>
            <button
              className="navbar-toggler"
              style={dashboardBurgerButtonStyle}
              onClick={() => setShowHeaderMenu((v) => !v)}
              title="Admin-Menü"
              aria-label="Admin-Menü öffnen"
            >
              <span className="navbar-toggler-icon" style={dashboardBurgerIconStyle} />
            </button>
            {showHeaderMenu ? (
              <div style={menuDropdownStyle}>
                <button
                  style={menuItemStyle}
                  onClick={() => {
                    setActiveView("audit");
                    setShowHeaderMenu(false);
                  }}
                >
                  Log
                </button>
                <button
                  style={menuItemStyle}
                  onClick={() => {
                    setNavMode("partners");
                    setActiveView("partner_purge");
                    setShowHeaderMenu(false);
                  }}
                >
                  Partner löschen
                </button>
                <button
                  style={menuItemStyle}
                  onClick={async () => {
                    setShowHeaderMenu(false);
                    await supabase.auth.signOut();
                    router.push("/admin/login");
                  }}
                >
                  Ausloggen
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <p style={statusStyle}>{status}</p>

      {activeView === "home" ? (
        <main style={adminWelcomeWrapStyle}>
          <div style={adminWelcomeHeaderStyle}>
            <h1 style={adminWelcomeTitleStyle}>Willkommen {adminDisplayName}</h1>
            <p style={adminWelcomeTextStyle}>
              Von hier aus steuerst du Partner, Gebiete, Freigaben und Systembereiche. Wähle den nächsten Arbeitsbereich direkt über die Startkacheln.
            </p>
          </div>
          <div style={adminWelcomeGridOuterStyle}>
            <div style={adminWelcomeGridStyle}>
              {adminWelcomeActions.map((action) => (
                <button
                  key={action.key}
                  type="button"
                  style={adminWelcomeCardStyle}
                  onClick={action.onClick}
                >
                  <div style={adminWelcomeCardIconStyle}>{renderAdminNavIcon(action.icon, 30)}</div>
                  <div style={adminWelcomeCardTitleRowStyle}>
                    <div style={adminWelcomeCardTitleStyle}>{action.title}</div>
                    {action.badge ? <span style={adminWelcomeBadgeStyle}>{action.badge}</span> : null}
                  </div>
                  <div style={adminWelcomeCardTextStyle}>{action.text}</div>
                </button>
              ))}
            </div>
          </div>
        </main>
      ) : (
      <div
        style={{
          ...adminLayoutStyle,
          gridTemplateColumns: (activeView === "llm_global" || activeView === "billing_defaults" || activeView === "language_admin" || activeView === "system_texts" || activeView === "market_texts" || activeView === "standard_text_refresh" || activeView === "portal_cms")
            ? "50px minmax(0, 1fr)"
            : adminLayoutStyle.gridTemplateColumns,
        }}
      >
        <aside
          ref={adminModeBarRef}
          style={modeBarStyle}
          onMouseLeave={() => {
            setHoveredAdminNavId(null);
            setHoveredAdminNavTop(null);
          }}
        >
          <button
            style={modeButtonStyle(activeView !== "llm_global" && activeView !== "billing_defaults" && activeView !== "language_admin" && activeView !== "system_texts" && activeView !== "market_texts" && activeView !== "standard_text_refresh" && activeView !== "portal_cms" && navMode === "partners")}
            onClick={async () => {
              setNavMode("partners");
              if (selectedPartnerId) {
                await selectPartnerView(selectedPartnerId, "partner_edit");
                return;
              }
              if (portalPartner?.id) {
                await selectPartnerView(portalPartner.id, "partner_edit");
                return;
              }
              setActiveView("partner_edit");
            }}
            title="Partner"
            onMouseEnter={(event) => updateHoveredAdminNav("partners", event.currentTarget)}
            onFocus={(event) => updateHoveredAdminNav("partners", event.currentTarget)}
            onMouseLeave={() => {
              setHoveredAdminNavId(null);
              setHoveredAdminNavTop(null);
            }}
            onBlur={() => {
              setHoveredAdminNavId(null);
              setHoveredAdminNavTop(null);
            }}
          >
            {renderAdminNavIcon("partners")}
          </button>
          <button
            style={modeButtonStyle(activeView !== "llm_global" && activeView !== "billing_defaults" && activeView !== "language_admin" && activeView !== "system_texts" && activeView !== "market_texts" && activeView !== "standard_text_refresh" && activeView !== "portal_cms" && navMode === "areas")}
            onClick={() => {
              setNavMode("areas");
              setActiveView("partner_edit");
            }}
            title="Gebiete"
            onMouseEnter={(event) => updateHoveredAdminNav("areas", event.currentTarget)}
            onFocus={(event) => updateHoveredAdminNav("areas", event.currentTarget)}
            onMouseLeave={() => {
              setHoveredAdminNavId(null);
              setHoveredAdminNavTop(null);
            }}
            onBlur={() => {
              setHoveredAdminNavId(null);
              setHoveredAdminNavTop(null);
            }}
          >
            {renderAdminNavIcon("areas")}
          </button>
          <button
            style={modeButtonStyle(activeView === "llm_global")}
            onClick={() => {
              setActiveView("llm_global");
              void run("Globale LLM-Verwaltung laden", async () => {
                await loadLlmGlobalDashboard();
              });
            }}
            title="Globale LLM-Verwaltung"
            onMouseEnter={(event) => updateHoveredAdminNav("llm", event.currentTarget)}
            onFocus={(event) => updateHoveredAdminNav("llm", event.currentTarget)}
            onMouseLeave={() => {
              setHoveredAdminNavId(null);
              setHoveredAdminNavTop(null);
            }}
            onBlur={() => {
              setHoveredAdminNavId(null);
              setHoveredAdminNavTop(null);
            }}
          >
            {renderAdminNavIcon("llm")}
          </button>
          <button
            style={modeButtonStyle(activeView === "billing_defaults")}
            onClick={() => {
              setActiveView("billing_defaults");
              void run("Billing-Standards laden", async () => {
                await loadBillingDefaults();
              });
            }}
            title="Billing-Standards"
            onMouseEnter={(event) => updateHoveredAdminNav("billing", event.currentTarget)}
            onFocus={(event) => updateHoveredAdminNav("billing", event.currentTarget)}
            onMouseLeave={() => {
              setHoveredAdminNavId(null);
              setHoveredAdminNavTop(null);
            }}
            onBlur={() => {
              setHoveredAdminNavId(null);
              setHoveredAdminNavTop(null);
            }}
          >
            {renderAdminNavIcon("billing")}
          </button>
          <button
            style={modeButtonStyle(activeView === "language_admin")}
            onClick={() => {
              setActiveView("language_admin");
              void run("Sprachverwaltung laden", async () => {
                await loadPortalCms();
              }, { showSuccessModal: false });
            }}
            title="Sprachverwaltung"
            onMouseEnter={(event) => updateHoveredAdminNav("language", event.currentTarget)}
            onFocus={(event) => updateHoveredAdminNav("language", event.currentTarget)}
            onMouseLeave={() => {
              setHoveredAdminNavId(null);
              setHoveredAdminNavTop(null);
            }}
            onBlur={() => {
              setHoveredAdminNavId(null);
              setHoveredAdminNavTop(null);
            }}
          >
            {renderAdminNavIcon("language")}
          </button>
          <button
            style={modeButtonStyle(activeView === "system_texts")}
            onClick={() => {
              setActiveView("system_texts");
              void run("Systemtexte laden", async () => {
                await loadPortalCms();
              }, { showSuccessModal: false });
            }}
            title="Systemtexte"
            onMouseEnter={(event) => updateHoveredAdminNav("texts", event.currentTarget)}
            onFocus={(event) => updateHoveredAdminNav("texts", event.currentTarget)}
            onMouseLeave={() => {
              setHoveredAdminNavId(null);
              setHoveredAdminNavTop(null);
            }}
            onBlur={() => {
              setHoveredAdminNavId(null);
              setHoveredAdminNavTop(null);
            }}
          >
            {renderAdminNavIcon("texts")}
          </button>
          <button
            style={modeButtonStyle(activeView === "market_texts")}
            onClick={() => {
              setActiveView("market_texts");
              void run("Markterklärungstexte laden", async () => {
                await Promise.all([
                  loadMarketExplanationStandardTexts(),
                  loadMarketExplanationStaticTexts(),
                ]);
              }, { showSuccessModal: false });
            }}
            title="Markterklärungstexte"
            onMouseEnter={(event) => updateHoveredAdminNav("market_texts", event.currentTarget)}
            onFocus={(event) => updateHoveredAdminNav("market_texts", event.currentTarget)}
            onMouseLeave={() => {
              setHoveredAdminNavId(null);
              setHoveredAdminNavTop(null);
            }}
            onBlur={() => {
              setHoveredAdminNavId(null);
              setHoveredAdminNavTop(null);
            }}
          >
            {renderAdminNavIcon("market_texts")}
          </button>
          <button
            style={modeButtonStyle(activeView === "standard_text_refresh")}
            onClick={() => {
              setActiveView("standard_text_refresh");
              void run("Standardtext-Refresh laden", async () => {
                await Promise.all([
                  loadMarketExplanationBundeslaender(),
                  loadStandardTextSource(standardTextRefreshSourceScope),
                ]);
              }, { showSuccessModal: false });
            }}
            title="Standardtext-Refresh"
            onMouseEnter={(event) => updateHoveredAdminNav("refresh", event.currentTarget)}
            onFocus={(event) => updateHoveredAdminNav("refresh", event.currentTarget)}
            onMouseLeave={() => {
              setHoveredAdminNavId(null);
              setHoveredAdminNavTop(null);
            }}
            onBlur={() => {
              setHoveredAdminNavId(null);
              setHoveredAdminNavTop(null);
            }}
          >
            {renderAdminNavIcon("refresh")}
          </button>
          <button
            style={modeButtonStyle(activeView === "portal_cms")}
            onClick={() => {
              setActiveView("portal_cms");
              void run("Portal-CMS laden", async () => {
                await loadPortalCms();
              }, { showSuccessModal: false });
            }}
            title="Portal-CMS"
            onMouseEnter={(event) => updateHoveredAdminNav("cms", event.currentTarget)}
            onFocus={(event) => updateHoveredAdminNav("cms", event.currentTarget)}
            onMouseLeave={() => {
              setHoveredAdminNavId(null);
              setHoveredAdminNavTop(null);
            }}
            onBlur={() => {
              setHoveredAdminNavId(null);
              setHoveredAdminNavTop(null);
            }}
          >
            {renderAdminNavIcon("cms")}
          </button>
          <div style={{ flex: 1 }} />
          {hoveredAdminNavLabel && hoveredAdminNavTop !== null ? (
            <div style={adminNavTooltipLayerStyle(hoveredAdminNavTop)}>
              <div style={adminNavTooltipCardStyle}>{hoveredAdminNavLabel}</div>
            </div>
          ) : null}
        </aside>

        {activeView !== "llm_global" && activeView !== "billing_defaults" && activeView !== "language_admin" && activeView !== "system_texts" && activeView !== "market_texts" && activeView !== "standard_text_refresh" && activeView !== "portal_cms" ? (
          <aside style={listPaneStyle}>
            <div style={sidebarControlWrapStyle}>
              <input
                style={inputStyle}
                placeholder={navMode === "partners" ? "Suche: Name, E-Mail oder ID" : "Suche: Kreisname, ID oder Partner"}
                aria-label={navMode === "partners" ? "Partner suchen" : "Gebiet suchen"}
                value={navMode === "partners" ? partnerFilter : areaFilter}
                onChange={(e) => (navMode === "partners" ? setPartnerFilter(e.target.value) : setAreaFilter(e.target.value))}
              />
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#475569" }}>
                <input
                  type="checkbox"
                  checked={onlyActiveList}
                  disabled={navMode === "partners" && pendingAreaAssignmentCount > 0}
                  onChange={(e) => setOnlyActiveList(e.target.checked)}
                />
                nur aktiv
              </label>
            </div>
            {navMode === "partners" ? (
              <div style={adminWorkflowLegendStyle}>
                <span style={adminWorkflowLegendItemStyle}>
                  <span style={adminWorkflowLegendDotStyle("#dc2626")} />
                  Zuweisung offen
                </span>
                <span style={adminWorkflowLegendItemStyle}>
                  <span style={adminWorkflowLegendDotStyle("#f59e0b")} />
                  in Aktivierung
                </span>
                <span style={adminWorkflowLegendItemStyle}>
                  <span style={adminWorkflowLegendDotStyle("#16a34a")} />
                  alle Gebiete live
                </span>
              </div>
            ) : null}
            <div style={sidebarListStyle}>
              {navMode === "partners"
                ? filteredPartners.map((p) => (
                    <button
                      key={p.id}
                      style={listLinkRowStyle(selectedPartnerId === p.id, Boolean(p.is_system_default))}
                      onClick={() => {
                        void selectSidebarPartner(p.id);
                      }}
                    >
                      {workflowSignalColor(partnerWorkflowSignalById.get(p.id) ?? "none") ? (
                        <div
                          aria-hidden="true"
                          style={{
                            position: "absolute",
                            top: 12,
                            right: 12,
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: workflowSignalColor(partnerWorkflowSignalById.get(p.id) ?? "none") ?? "transparent",
                          }}
                        />
                      ) : null}
                      <div style={{ fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                        <span>{formatPartnerName(p)}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>
                        {p.is_active ? "aktiv" : "inaktiv"}
                      </div>
                    </button>
                  ))
                : filteredAreaOverview.map((row) => (
                    <button
                      key={row.key}
                      style={listLinkRowStyle(selectedPartnerId === row.partnerId)}
                      onClick={() => selectPartnerView(row.partnerId, "partner_edit")}
                    >
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{row.kreisName}</div>
                      <div style={{ fontSize: 11, color: "#64748b" }}>{row.kreisId}</div>
                      <div style={{ fontSize: 12, color: "#475569" }}>{row.partnerName}</div>
                    </button>
                  ))}
            </div>
          </aside>
        ) : null}

        <div style={contentPaneStyle}>
      {activeView === "partner_edit" ? (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginTop: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, fontSize: 24, lineHeight: 1.2, color: "#0f172a", fontWeight: 800 }}>Partnerverwaltung</h1>
        <button
          type="button"
          style={btnStyle}
          onClick={() => {
            setActiveView("new_partner");
          }}
        >
          Neuen Partner anlegen
        </button>
      </div>
      ) : null}
      {activeView === "new_partner" ? (
      <section style={cardStyle}>
        <h2 style={h2Style}>Partner anlegen (Invite-Link)</h2>
        <div style={grid2Style}>
          <input
            placeholder="Firmenname"
            aria-label="Firmenname"
            style={inputStyle}
            value={createPartner.company_name}
            onChange={(e) => setCreatePartner((v) => ({ ...v, company_name: e.target.value }))}
          />
          <input
            placeholder="Kontakt-E-Mail"
            aria-label="Kontakt-E-Mail"
            style={inputStyle}
            value={createPartner.contact_email}
            onChange={(e) => setCreatePartner((v) => ({ ...v, contact_email: e.target.value }))}
          />
          <input
            placeholder="Vorname"
            aria-label="Vorname"
            style={inputStyle}
            value={createPartner.contact_first_name}
            onChange={(e) => setCreatePartner((v) => ({ ...v, contact_first_name: e.target.value }))}
          />
          <input
            placeholder="Nachname"
            aria-label="Nachname"
            style={inputStyle}
            value={createPartner.contact_last_name}
            onChange={(e) => setCreatePartner((v) => ({ ...v, contact_last_name: e.target.value }))}
          />
          <input
            placeholder="Website URL"
            aria-label="Website URL"
            style={inputStyle}
            value={createPartner.website_url}
            onChange={(e) => setCreatePartner((v) => ({ ...v, website_url: e.target.value }))}
          />
        </div>
        <div style={{ marginTop: 12 }}>
          <button
            style={btnStyle}
            disabled={busy}
            onClick={() => {
              void handleCreatePartnerSubmit();
            }}
          >
            Einladung senden und Partner anlegen
          </button>
          {createPartnerError ? (
            <p style={{ marginTop: 10, color: "#b91c1c", fontSize: 13, fontWeight: 600 }}>
              {createPartnerError}
            </p>
          ) : null}
        </div>
      </section>
      ) : null}

      {activeView === "new_partner_success" ? (
      <section style={cardStyle}>
        <h2 style={h2Style}>
          {createdPartnerSuccess?.mode === "existing" ? "Partner bereits vorhanden" : "Partner erfolgreich angelegt"}
        </h2>
        <p style={mutedStyle}>
          {createdPartnerSuccess?.mode === "existing"
            ? "Für diese E-Mail existiert bereits ein Partnerkonto. Du kannst direkt in die Partnerdetails springen."
            : createdPartnerSuccess?.delivery_message || "Der Partnerdatensatz wurde erstellt."}
        </p>
        <div style={{ marginTop: 12, border: "1px solid #e2e8f0", borderRadius: 10, padding: 12, background: "#f8fafc" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 8 }}>Angelegt</div>
          <div style={rowStyle}>
            <span style={{ fontWeight: 600, color: "#334155" }}>Firma</span>
            <span>{createdPartnerSuccess?.company_name || "—"}</span>
          </div>
          <div style={rowStyle}>
            <span style={{ fontWeight: 600, color: "#334155" }}>Kontakt-E-Mail</span>
            <span>{createdPartnerSuccess?.contact_email || "—"}</span>
          </div>
          <div style={rowStyle}>
            <span style={{ fontWeight: 600, color: "#334155" }}>Partner-ID</span>
            <span>{createdPartnerSuccess?.id || "—"}</span>
          </div>
        </div>
        <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            style={btnStyle}
            onClick={() => {
              if (!createdPartnerSuccess?.id) return;
              void selectPartnerView(createdPartnerSuccess.id, "partner_edit");
            }}
          >
            Partnerdetails öffnen
          </button>
        </div>
      </section>
      ) : null}

      {activeView === "partner_edit" ? (
      <section style={{ ...cardStyle, background: "#f8fafc" }}>
        <h2 style={h2Style}>Partnerdetails</h2>
        <p style={{ margin: 0, color: "#475569" }}>
          {selectedPartner ? `${formatPartnerName(selectedPartner)} (${selectedPartner.id})` : "Bitte links einen Partner auswählen."}
        </p>
        {selectedPartner ? (
          <div style={adminPartnerSummaryGridStyle}>
            <div style={{ ...adminPartnerSummaryCardStyle, background: "#ffffff" }}>
              <div style={adminPartnerSummaryLabelStyle}>Workflow</div>
              <div style={adminPartnerSummaryValueStyle}>
                {selectedPartner.is_system_default
                  ? "Portalpartner"
                  : selectedPartnerWorkflowSignal === "red"
                    ? "Zuweisung offen"
                    : selectedPartnerWorkflowSignal === "orange"
                      ? "In Aktivierung"
                      : selectedPartnerWorkflowSignal === "green"
                        ? "Alle Gebiete live"
                        : "Ohne Signal"}
              </div>
            </div>
            <div style={{ ...adminPartnerSummaryCardStyle, background: "#ffffff" }}>
              <div style={adminPartnerSummaryLabelStyle}>Gebiete</div>
              <div style={adminPartnerSummaryValueStyle}>{selectedPartnerSummary.totalAreas}</div>
            </div>
            <div style={{ ...adminPartnerSummaryCardStyle, background: "#ffffff" }}>
              <div style={adminPartnerSummaryLabelStyle}>Live</div>
              <div style={adminPartnerSummaryValueStyle}>{selectedPartnerSummary.liveAreas}</div>
            </div>
            <div style={{ ...adminPartnerSummaryCardStyle, background: "#ffffff" }}>
              <div style={adminPartnerSummaryLabelStyle}>Offen</div>
              <div style={adminPartnerSummaryValueStyle}>{selectedPartnerSummary.activationOpen}</div>
            </div>
            <div style={{ ...adminPartnerSummaryCardStyle, background: "#ffffff" }}>
              <div style={adminPartnerSummaryLabelStyle}>Anbindungen aktiv</div>
              <div style={adminPartnerSummaryValueStyle}>{selectedPartnerSummary.activeIntegrationCount}</div>
            </div>
          </div>
        ) : null}
      </section>
      ) : null}

      {activeView === "partner_edit" && selectedPartner ? (
      <div style={{ ...partnerTabBarStyle, marginBottom: 18 }}>
        <button style={partnerTabButtonStyle(partnerTab === "profile")} onClick={() => setPartnerTab("profile")}>Profil</button>
        {selectedPartner.is_system_default ? (
          <button style={partnerTabButtonStyle(partnerTab === "systempartner_default")} onClick={() => setPartnerTab("systempartner_default")}>
            Systempartner-Default
          </button>
        ) : null}
        <button style={partnerTabButtonStyle(partnerTab === "areas")} onClick={() => setPartnerTab("areas")}>
          Gebiete
          {selectedPartnerNeedsAreaAssignment ? (
            <span
              aria-label="Gebiete zuweisen erforderlich"
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#dc2626",
                marginLeft: 8,
                verticalAlign: "middle",
              }}
            />
          ) : null}
        </button>
        {!selectedPartner.is_system_default ? (
          <button style={partnerTabButtonStyle(partnerTab === "review")} onClick={() => setPartnerTab("review")}>
            Freigabeprüfung
            {selectedPartnerWorkflowSignal === "orange" ? (
              <span
                aria-label="Freigabe oder Preview offen"
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#f59e0b",
                  marginLeft: 8,
                  verticalAlign: "middle",
                }}
              />
            ) : null}
          </button>
        ) : null}
        {!selectedPartner.is_system_default ? (
          <button
            style={partnerTabButtonStyle(partnerTab === "integrations")}
            onClick={() => {
              setPartnerTab("integrations");
              setIntegrationsAdminTab("overview");
            }}
          >
            Anbindungen
          </button>
        ) : null}
        {!selectedPartner.is_system_default ? (
          <button style={partnerTabButtonStyle(partnerTab === "billing")} onClick={() => setPartnerTab("billing")}>
            Abrechnung
          </button>
        ) : null}
        <button style={partnerTabButtonStyle(partnerTab === "handover")} onClick={() => setPartnerTab("handover")}>Übergabe</button>
      </div>
      ) : null}

      {activeView === "partner_edit" && partnerTab === "profile" && Boolean(selectedPartner) ? (
      <section style={cardStyle}>
        <h2 style={h2Style}>Partner bearbeiten</h2>
        <p style={mutedStyle}>{selectedPartnerLabel}</p>
        <div style={grid2Style}>
          <input
            placeholder="Firmenname"
            aria-label="Firmenname bearbeiten"
            style={inputStyle}
            value={editPartner.company_name}
            onChange={(e) => setEditPartner((v) => ({ ...v, company_name: e.target.value }))}
            disabled={!selectedPartner}
          />
          <input
            placeholder="Kontakt-E-Mail"
            aria-label="Kontakt-E-Mail bearbeiten"
            style={inputStyle}
            value={editPartner.contact_email}
            onChange={(e) => setEditPartner((v) => ({ ...v, contact_email: e.target.value }))}
            disabled={!selectedPartner}
          />
          <input
            placeholder="Vorname"
            aria-label="Vorname bearbeiten"
            style={inputStyle}
            value={editPartner.contact_first_name}
            onChange={(e) => setEditPartner((v) => ({ ...v, contact_first_name: e.target.value }))}
            disabled={!selectedPartner}
          />
          <input
            placeholder="Nachname"
            aria-label="Nachname bearbeiten"
            style={inputStyle}
            value={editPartner.contact_last_name}
            onChange={(e) => setEditPartner((v) => ({ ...v, contact_last_name: e.target.value }))}
            disabled={!selectedPartner}
          />
          <input
            placeholder="Website URL"
            aria-label="Website URL bearbeiten"
            style={inputStyle}
            value={editPartner.website_url}
            onChange={(e) => setEditPartner((v) => ({ ...v, website_url: e.target.value }))}
            disabled={!selectedPartner}
          />
        </div>
        <label style={{ display: "block", marginTop: 12 }}>
          <input
            type="checkbox"
            checked={editPartner.is_active}
            disabled={!selectedPartner}
            onChange={(e) => setEditPartner((v) => ({ ...v, is_active: e.target.checked }))}
          />
          <span style={{ marginLeft: 8 }}>Partner aktiv</span>
        </label>
        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              style={btnStyle}
              disabled={busy || !selectedPartner}
              onClick={() =>
                run("Partner aktualisieren", async () => {
                  if (!selectedPartnerId) return;
                  await api(`/api/admin/partners/${selectedPartnerId}`, {
                    method: "PATCH",
                    body: JSON.stringify(editPartner),
                  });
                  await loadPartners(selectedPartnerId);
                })
              }
            >
              Speichern
            </button>
            {!selectedPartner?.is_active ? (
              <button
                style={btnGhostStyle}
                disabled={busy || !selectedPartnerId || selectedPartner?.is_system_default === true}
                onClick={() => {
                  if (!selectedPartnerId) return;
                  void sendPartnerAccessLink(selectedPartnerId);
                }}
              >
                Einladung erneut senden
              </button>
            ) : null}
          </div>
        </div>
      </section>
      ) : null}

      {activeView === "partner_edit" && partnerTab === "systempartner_default" && Boolean(selectedPartner?.is_system_default) ? (
      <section style={cardStyle}>
        <h2 style={h2Style}>Systempartner-Default</h2>
        <p style={mutedStyle}>
          Diese Angaben werden als neutraler Default genutzt, solange ein Gebiet noch keinem operativen Partner zugeordnet ist.
        </p>
        <div style={grid2Style}>
          <input
            placeholder="Beratername"
            aria-label="Beratername Standard"
            style={systempartnerDefaultMissingKeys.includes("berater_name") ? requiredInputStyle : inputStyle}
            value={systempartnerDefaultProfile.berater_name}
            onChange={(e) => setSystempartnerDefaultProfile((prev) => ({ ...prev, berater_name: e.target.value }))}
          />
          <input
            placeholder="Berater-E-Mail"
            aria-label="Berater-E-Mail Standard"
            style={systempartnerDefaultMissingKeys.includes("berater_email") ? requiredInputStyle : inputStyle}
            value={systempartnerDefaultProfile.berater_email}
            onChange={(e) => setSystempartnerDefaultProfile((prev) => ({ ...prev, berater_email: e.target.value }))}
          />
          <input
            placeholder="Telefon Festnetz"
            aria-label="Telefon Festnetz Standard"
            style={systempartnerDefaultMissingKeys.includes("berater_telefon_fest") ? requiredInputStyle : inputStyle}
            value={systempartnerDefaultProfile.berater_telefon_fest}
            onChange={(e) => setSystempartnerDefaultProfile((prev) => ({ ...prev, berater_telefon_fest: e.target.value }))}
          />
          <input
            placeholder="Telefon Mobil"
            aria-label="Telefon Mobil Standard"
            style={inputStyle}
            value={systempartnerDefaultProfile.berater_telefon_mobil}
            onChange={(e) => setSystempartnerDefaultProfile((prev) => ({ ...prev, berater_telefon_mobil: e.target.value }))}
          />
        </div>
        {systempartnerDefaultMissingKeys.length > 0 ? (
          <div
            style={{
              marginTop: 12,
              border: "1px solid #f59e0b",
              background: "#fffbeb",
              borderRadius: 10,
              padding: 12,
            }}
          >
            <div style={requiredFieldHintStyle}>Pflichtfelder</div>
            <div style={{ fontSize: 13, color: "#92400e", lineHeight: 1.5 }}>
              Bitte zuerst diese Pflichtfelder ausfüllen: {systempartnerDefaultMissingLabels.join(", ")}.
            </div>
          </div>
        ) : null}
        <div style={{ marginTop: 12 }}>
          <div
            style={{
              border: systempartnerDefaultMissingKeys.includes("media_berater_avatar") ? "1px solid #f59e0b" : "1px solid #e2e8f0",
              borderRadius: 10,
              padding: 14,
              background: systempartnerDefaultMissingKeys.includes("media_berater_avatar") ? "#fffbeb" : "#f8fafc",
              display: "grid",
              gap: 10,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>
              {getMandatoryMediaLabel("media_berater_avatar")}
            </div>
            {systempartnerDefaultProfile.media_berater_avatar ? (
              <Image
                src={systempartnerDefaultProfile.media_berater_avatar}
                alt="Systempartner-Avatar"
                width={220}
                height={220}
                unoptimized
                style={{
                  width: 160,
                  height: 160,
                  objectFit: "cover",
                  borderRadius: 12,
                  border: "1px solid #cbd5e1",
                  background: "#fff",
                }}
              />
            ) : (
              <div
                style={{
                  width: 160,
                  height: 160,
                  borderRadius: 12,
                  border: "1px dashed #cbd5e1",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#64748b",
                  fontSize: 12,
                  background: "#fff",
                }}
              >
                Noch kein Avatar hochgeladen.
              </div>
            )}
            <div style={{ fontSize: 12, color: "#64748b" }}>
              Format: WebP oder PNG · Ziel: 220 × 220 px · max. {Math.round(300000 / 1024)} KB
            </div>
            <label
              htmlFor="systempartner-default-avatar-upload"
              style={{
                ...btnGhostStyle,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "fit-content",
                opacity: systempartnerDefaultAvatarUpload.uploading ? 0.6 : 1,
                cursor: systempartnerDefaultAvatarUpload.uploading ? "not-allowed" : "pointer",
              }}
            >
              {systempartnerDefaultAvatarUpload.uploading ? "Upload läuft..." : "Avatar hochladen"}
              <input
                id="systempartner-default-avatar-upload"
                type="file"
                accept="image/webp,image/png"
                disabled={systempartnerDefaultAvatarUpload.uploading}
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  void run("Systempartner-Avatar hochladen", async () => {
                    await uploadSystempartnerDefaultAvatar(file);
                  }, { showSuccessModal: false });
                  e.currentTarget.value = "";
                }}
              />
            </label>
            <input
              placeholder="Avatar-Quelle / Bildpfad"
              aria-label="Avatar-Quelle Standard"
              style={inputStyle}
              value={systempartnerDefaultProfile.media_berater_avatar}
              onChange={(e) => setSystempartnerDefaultProfile((prev) => ({ ...prev, media_berater_avatar: e.target.value }))}
            />
            {systempartnerDefaultAvatarUpload.error ? (
              <div style={{ fontSize: 12, color: "#b91c1c" }}>{systempartnerDefaultAvatarUpload.error}</div>
            ) : null}
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <button
            style={btnStyle}
            disabled={busy || !systempartnerDefaultCanSave}
            onClick={() =>
              run("Systempartner-Default speichern", async () => {
                await saveSystempartnerDefaultProfile();
              })
            }
          >
            Speichern
          </button>
        </div>
      </section>
      ) : null}

      {activeView === "partner_edit" && partnerTab === "areas" && Boolean(selectedPartner) ? (
      <section style={cardStyle}>
        <h2 style={h2Style}>Gebietszuordnung</h2>
        {selectedPartner?.is_active !== true ? (
          <div
            style={{
              marginTop: 8,
              border: "1px solid #cbd5e1",
              background: "#f8fafc",
              borderRadius: 10,
              padding: 14,
              color: "#334155",
              fontSize: 14,
              lineHeight: 1.5,
            }}
          >
            Gebiete koennen erst zugewiesen werden, wenn der Partner sein Konto aktiviert hat.
          </div>
        ) : (
          <>
            <div style={rowStyle}>
              <input
                placeholder="Kreis suchen (Name oder ID, z. B. Leipzig oder 14)"
                aria-label="Kreis zuordnen"
                style={inputStyle}
                value={assignAreaId}
                onChange={(e) => {
                  setAssignAreaId(e.target.value);
                  setAreaQuery(e.target.value);
                }}
                disabled={!selectedPartner}
              />
              <button
                style={btnStyle}
                disabled={busy || !selectedPartner}
                onClick={() =>
                  run("Gebiet zuordnen", async () => {
                    if (!selectedPartnerId || !assignAreaId.trim()) return;
                    const response = await api<{ notification?: { partner?: { sent?: boolean; reason?: string | null } } }>(`/api/admin/partners/${selectedPartnerId}/areas`, {
                      method: "POST",
                      body: JSON.stringify({ area_id: assignAreaId.trim(), is_active: false }),
                    });
                    setAssignAreaId("");
                    setAreaQuery("");
                    await loadPartners(selectedPartnerId, { refreshSelectedDetails: false });
                    await loadPartnerDetails(selectedPartnerId);
                    if (response?.notification?.partner?.sent === false) {
                      const reason = String(response?.notification?.partner?.reason ?? "unbekannt");
                      setStatus(`Gebiet zugeordnet, Partner-Mail aber nicht versendet (${reason}).`);
                      return;
                    }
                    setStatus("Gebiet erfolgreich zugeordnet.");
                  })
                }
              >
                Zuordnen
              </button>
            </div>
            {areaOptions.length > 0 ? (
              <div style={suggestBoxStyle}>
                {areaOptions.map((a) => (
                  <button
                    key={a.id}
                    style={suggestBtnStyle}
                    onClick={() => {
                      setAssignAreaId(a.id);
                      setAreaQuery("");
                      setAreaOptions([]);
                    }}
                  >
                    {a.name ?? a.id} - {a.id}
                  </button>
                ))}
              </div>
            ) : null}
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Area</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Aktion</th>
                </tr>
              </thead>
              <tbody>
                {displayAreaRows.length === 0 ? (
                  <tr>
                    <td style={tdStyle} colSpan={3}>
                      <div
                        style={{
                          border: "1px solid #ef4444",
                          background: "rgba(239, 68, 68, 0.08)",
                          borderRadius: 10,
                          padding: 12,
                          color: "#7f1d1d",
                          fontSize: 13,
                          fontWeight: 600,
                        }}
                      >
                        Für diesen Partner sind noch keine Gebiete zugeordnet. Bitte jetzt Gebiete zuweisen.
                      </div>
                    </td>
                  </tr>
                ) : null}
                {displayAreaRows.map((row) => (
                  <tr key={row.key}>
                    <td style={tdStyle}>
                      <div>{resolveAreaName(row.mapping, row.displayKreisId)}</div>
                      <small style={mutedStyle}>{row.displayKreisId}</small>
                    </td>
                    <td style={tdStyle}>
                      {formatAreaStateLabel(row.mapping.is_active, row.mapping.activation_status, Boolean(row.mapping.is_public_live))}
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {selectedPartner?.is_system_default && !row.derivedFromOrtslagen ? (
                          Boolean(row.mapping.is_public_live) ? (
                            <button
                              style={btnGhostStyle}
                              disabled={busy || reviewBusy}
                              onClick={() =>
                                run("Gebiet offline nehmen", async () => {
                                  await setAreaPublicationForArea(row.mapping.area_id, false);
                                  await loadPartners(selectedPartnerId, { refreshSelectedDetails: false });
                                  await loadPartnerDetails(selectedPartnerId);
                                }, { showSuccessModal: false })
                              }
                            >
                              Offline nehmen
                            </button>
                          ) : (
                            <button
                              style={btnStyle}
                              disabled={busy || reviewBusy || !systempartnerDefaultCanSave}
                              onClick={() =>
                                run("Gebiet direkt online schalten", async () => {
                                  await setAreaPublicationForArea(row.mapping.area_id, true);
                                  await loadPartners(selectedPartnerId, { refreshSelectedDetails: false });
                                  await loadPartnerDetails(selectedPartnerId);
                                }, { showSuccessModal: false })
                              }
                            >
                              Direkt online (DE)
                            </button>
                          )
                        ) : null}
                        <button
                          style={handoverLinkButtonStyle}
                          disabled={busy || !selectedPartner || row.derivedFromOrtslagen}
                          onClick={() => {
                            setPartnerTab("handover");
                            setHandoverDraft((prev) => ({
                              ...prev,
                              area_id: row.mapping.area_id,
                            }));
                            setStatus(`Übergabe vorbereitet: ${formatAreaLabel(row.mapping, row.displayKreisId)}`);
                          }}
                        >
                          Übergabe
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>)}
      </section>
      ) : null}

      {activeView === "partner_purge" ? (
      <section style={cardStyle}>
        <h2 style={h2Style}>Datenbereinigung</h2>
        <p style={mutedStyle}>
          Hard-Purge ist bewusst aus dem normalen Partner-Flow ausgelagert. Wähle links einen Partner aus und starte die endgültige Löschung nur für Test-, Dubletten- oder Fehlanlagen.
        </p>
        {selectedPartner ? (
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 12, background: "#f8fafc" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 8 }}>Ausgewählter Partner</div>
              <div style={rowStyle}>
                <span style={{ fontWeight: 600, color: "#334155" }}>Partner</span>
                <span>{formatPartnerName(selectedPartner)}</span>
              </div>
              <div style={rowStyle}>
                <span style={{ fontWeight: 600, color: "#334155" }}>Partner-ID</span>
                <span>{selectedPartner.id}</span>
              </div>
              <div style={rowStyle}>
                <span style={{ fontWeight: 600, color: "#334155" }}>Status</span>
                <span>{selectedPartner.is_active ? "aktiv" : "inaktiv"}</span>
              </div>
            </div>
            {selectedPartner.is_system_default ? (
              <div style={{ border: "1px solid #fecaca", background: "#fef2f2", borderRadius: 10, padding: 12, color: "#991b1b", fontSize: 13, lineHeight: 1.5 }}>
                Der Portalpartner ist ein Systempartner. Er kann nicht endgültig gelöscht werden.
              </div>
            ) : (
              <div style={{ border: "1px solid #fecaca", background: "#fff7ed", borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 13, color: "#7f1d1d", fontWeight: 700, marginBottom: 8 }}>
                  Kritischer Vorgang
                </div>
                <div style={{ fontSize: 13, color: "#7c2d12", lineHeight: 1.5, marginBottom: 12 }}>
                  Der Partner wird vollständig entfernt, inklusive Auth-User, Integrationen, Storage-Dateien und aller erfassten Partnerdaten. Gebietszuordnungen müssen vorher entfernt oder übergeben werden.
                </div>
                <button
                  style={btnDangerStyle}
                  disabled={busy}
                  onClick={() => {
                    void openPartnerPurgeModal();
                  }}
                >
                  Partner endgültig entfernen
                </button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ border: "1px solid #cbd5e1", background: "#f8fafc", borderRadius: 10, padding: 14, color: "#334155", fontSize: 14, lineHeight: 1.5 }}>
            Bitte wähle links in der Partnerübersicht einen Partner aus. Die endgültige Löschung ist absichtlich nur in diesem separaten Bereich verfügbar.
          </div>
        )}
      </section>
      ) : null}

      {activeView === "partner_edit" && partnerTab === "review" && Boolean(selectedPartner) ? (
      <section style={cardStyle}>
        <h2 style={h2Style}>Freigabeprüfung</h2>
        {reviewAreaOptions.length > 0 ? (
          <p style={mutedStyle}>Pflichtangaben prüfen und Workflow-Status setzen.</p>
        ) : null}
        {reviewAreaOptions.length === 0 ? (
          <div style={{ marginTop: 12, color: "#475569", fontSize: 14 }}>
            Aktuell liegen keine Freigabeprüfungen vor.
          </div>
        ) : (
          <div style={rowStyle}>
            <select
              style={inputStyle}
              aria-label="Gebiet für Freigabeprüfung"
              value={reviewAreaId}
              onChange={(e) => {
                setReviewAreaId(e.target.value);
                setReviewActionError(null);
                setReviewActionMessage(null);
                setReviewContentDismissed(false);
                setReviewNoteDraft("");
              }}
              disabled={!selectedPartner}
            >
              <option value="">Gebiet wählen</option>
              {reviewAreaOptions.map((row) => (
                <option key={row.mapping.area_id} value={row.mapping.area_id}>
                  {formatAreaLabel(row.mapping, row.mapping.area_id)} ({formatAreaStateLabel(row.mapping.is_active, row.mapping.activation_status, Boolean(row.mapping.is_public_live))})
                </option>
              ))}
            </select>
            <button
              style={btnGhostStyle}
              disabled={reviewBusy || !reviewAreaId}
              onClick={() => {
                setReviewContentDismissed(false);
                void loadAreaReview(reviewAreaId);
              }}
            >
              Prüfdaten laden
            </button>
          </div>
        )}

        {!reviewContentDismissed && reviewAreaOptions.length > 0 && reviewAreaId && reviewData ? (
          <>
            {reviewActionError || reviewActionMessage ? (
              <div style={reviewInlineFeedbackStyle(Boolean(reviewActionError))}>
                {reviewActionError ?? reviewActionMessage}
              </div>
            ) : null}

            <div style={reviewSectionCardStyle}>
              <div style={reviewSectionHeaderStyle}>Status</div>
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={reviewStatusBadgeStyle(currentReviewState)}>
                    {formatAreaStateLabel(Boolean(reviewData.mapping?.is_active), reviewData.mapping?.activation_status, Boolean(reviewData.mapping?.is_public_live))}
                  </span>
                </div>
                {currentReviewState === "approved_preview" ? (
                  <div
                    style={{
                      border: currentReviewPreviewSignoffAt ? "1px solid #cbd5e1" : "1px solid #fdba74",
                      background: currentReviewPreviewSignoffAt ? "#f8fafc" : "#fff7ed",
                      borderRadius: 10,
                      padding: 12,
                      color: currentReviewPreviewSignoffAt ? "#334155" : "#9a3412",
                      fontSize: 13,
                      lineHeight: 1.55,
                    }}
                  >
                    <strong>{currentReviewPreviewSignoffAt ? "Livegang angefragt." : "Previewphase aktiv."}</strong>
                    {" "}
                    {currentReviewAllowsDirectGoLive
                      ? "Dieses Gebiet liegt beim Portalpartner. Es kann nach fachlicher Prüfung direkt mit Standardinhalten online geschaltet werden, auch ohne separate Livegang-Anfrage aus dem Partnerbereich."
                      : currentReviewPreviewSignoffAt
                        ? `Der Partner hat den Previewprozess abgeschlossen und den Livegang am ${formatAdminDateTime(currentReviewPreviewSignoffAt)} angefragt. Bitte die Frontend-Preview jetzt final prüfen und das Gebiet danach bei Bedarf online schalten.`
                        : "Das Gebiet ist fachlich freigegeben und kann jetzt vom Partner intern vorbereitet werden. Bitte Inhalte, Werte sowie SEO-/GEO-Einstellungen vor dem finalen Onlineschalten vollständig prüfen."}
                    {currentReviewPreviewHref ? (
                      <>
                        {" "}
                        Die Frontend-Preview zeigt denselben Seitenstand wie die spätere Live-Seite, ist nur intern für berechtigte Nutzer erreichbar und nach dem Onlinegang nicht mehr verfügbar.
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            <div style={reviewSectionCardStyle}>
              <div style={reviewSectionHeaderStyle}>Pflichtprüfung</div>
              {!reviewData.mandatory?.ok && Array.isArray(reviewData.mandatory?.missing) && reviewData.mandatory?.missing.length > 0 ? (
                <div style={{ marginBottom: 10, fontSize: 12, color: "#991b1b" }}>
                  {reviewData.mandatory.missing
                    .slice(0, 10)
                    .map((entry) => `${formatMandatoryKeyLabel(String(entry.key ?? ""))} (${entry.reason})`)
                    .join(", ")}
                </div>
              ) : (
                <div style={{ marginBottom: 10, fontSize: 12, color: "#166534", fontWeight: 600 }}>
                  Alle Pflichtangaben für dieses Gebiet sind aktuell vollständig.
                </div>
              )}
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Pflichtfeld</th>
                    <th style={thStyle}>Inhalt</th>
                  </tr>
                </thead>
                <tbody>
                  {(reviewData.fields ?? []).map((field) => (
                    <tr key={field.key}>
                      <td style={tdStyle}>
                        {formatMandatoryKeyLabel(field.key)}
                        {" "}
                        <span style={{ color: "#64748b", fontSize: 11 }}>({field.key})</span>
                      </td>
                      <td style={tdStyle}>
                        {isMandatoryMediaKey(field.key) ? (
                          <div style={{ display: "grid", gap: 8 }}>
                            {field.content ? (
                              <Image
                                src={field.content}
                                alt={formatMandatoryKeyLabel(field.key)}
                                width={280}
                                height={180}
                                unoptimized
                                style={{ maxWidth: 280, maxHeight: 180, objectFit: "cover", borderRadius: 8, border: "1px solid #e2e8f0" }}
                              />
                            ) : (
                              <div style={{ fontSize: 12, color: "#64748b" }}>—</div>
                            )}
                            <div style={{ fontSize: 11, color: "#64748b", wordBreak: "break-all" }}>{field.content || "—"}</div>
                          </div>
                        ) : (
                          <div style={{ maxWidth: 560, whiteSpace: "pre-wrap", fontSize: 12, color: "#334155" }}>
                            {field.content || "—"}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={reviewSectionCardStyle}>
              <div style={reviewSectionHeaderStyle}>Aktionen</div>
              {currentReviewState === "ready_for_review" || currentReviewState === "in_review" || currentReviewState === "changes_requested" ? (
                <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>Hinweis für Nachbesserung</div>
                  <textarea
                    style={{ ...inputStyle, minHeight: 110, resize: "vertical" }}
                    value={reviewNoteDraft}
                    onChange={(e) => setReviewNoteDraft(e.target.value)}
                    placeholder="Hier eintragen, was bei Texten, Bildern oder anderen Pflichtangaben verbessert werden muss."
                  />
                </div>
              ) : null}

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {currentReviewState === "ready_for_review" || currentReviewState === "in_review" || currentReviewState === "changes_requested" ? (
                  <>
                    <button
                      style={btnDangerStyle}
                      disabled={busy || reviewBusy || !reviewAreaId || reviewNoteDraft.trim().length === 0}
                      onClick={() =>
                        run("Nachbesserung anfordern", async () => {
                          await applyAreaReviewAction("changes_requested");
                        }, { showSuccessModal: false })
                      }
                    >
                      Nachbesserung anfordern
                    </button>
                    {currentReviewState === "ready_for_review" || currentReviewState === "in_review" ? (
                      <button
                        style={btnStyle}
                        disabled={busy || reviewBusy || !reviewAreaId}
                        onClick={() =>
                          run("Preview freigeben", async () => {
                            await applyAreaReviewAction("approve");
                          }, { clearReviewOnClose: true, showSuccessModal: false })
                        }
                      >
                        Preview freigeben
                      </button>
                    ) : null}
                  </>
                ) : null}
                {currentReviewState === "approved_preview" ? (
                  <>
                    {currentReviewPreviewHref ? (
                      <a
                        href={currentReviewPreviewHref}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          ...btnGhostStyle,
                          textDecoration: "none",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        Frontend-Preview öffnen
                      </a>
                    ) : null}
                    <button
                      style={btnStyle}
                      disabled={busy || reviewBusy || !reviewAreaId || (!currentReviewPreviewSignoffAt && !currentReviewAllowsDirectGoLive)}
                      onClick={() =>
                        run("Onlineschalten", async () => {
                          await setAreaPublication(true);
                        }, { clearReviewOnClose: true, showSuccessModal: false })
                      }
                    >
                      Onlineschalten
                    </button>
                    {!currentReviewPreviewSignoffAt && !currentReviewAllowsDirectGoLive ? (
                      <div style={{ width: "100%", fontSize: 12, color: "#9a3412" }}>
                        Der Partner muss den Livegang zuerst im Preview-Bereich anfragen, bevor das Gebiet online geschaltet werden kann.
                      </div>
                    ) : null}
                  </>
                ) : null}
                {currentReviewState === "live" ? (
                  <button
                    style={btnDangerStyle}
                    disabled={busy || reviewBusy || !reviewAreaId}
                    onClick={() =>
                      run("Offline nehmen", async () => {
                        await setAreaPublication(false);
                      }, { showSuccessModal: false })
                    }
                  >
                    Offline nehmen
                  </button>
                ) : null}
              </div>
            </div>

            <div style={reviewSectionCardStyle}>
              <div style={reviewSectionHeaderStyle}>Wartung</div>
              <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.55 }}>
                <strong>Visibility-Index neu publizieren</strong>
                {" "}
                Der öffentliche Immobilienmarkt liest die Sichtbarkeit nicht direkt aus dem Adminstatus, sondern aus dem publizierten
                {" "}
                <code>visibility_index.json</code>.
                {" "}
                Nach direkten SQL-Änderungen oder Altlasten im Live-/Preview-Workflow kann der Public-Stand deshalb veraltet sein, obwohl ein Gebiet im Admin bereits als online erscheint.
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 10 }}>
                <button
                  style={btnGhostStyle}
                  disabled={busy || reviewBusy || visibilityIndexBusy}
                  onClick={() =>
                    run("Visibility-Index neu publizieren", async () => {
                      await rebuildVisibilityIndex();
                    }, { showSuccessModal: false })
                  }
                >
                  {visibilityIndexBusy ? "Publikation läuft..." : "Visibility-Index neu publizieren"}
                </button>
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  Sinnvoll nach SQL-Korrekturen an <code>partner_area_map</code> oder wenn Public-URLs trotz korrektem Adminstatus noch 404 liefern.
                </span>
              </div>
            </div>
          </>
        ) : (!reviewContentDismissed && reviewAreaOptions.length > 0) ? (
          <p style={{ marginTop: 10, ...mutedStyle }}>
            Kein Gebiet mit Freigabestatus ausgewählt.
          </p>
        ) : null}
      </section>
      ) : null}

      {activeView === "partner_edit" && partnerTab === "handover" && Boolean(selectedPartner) ? (
      <section style={cardStyle}>
        <h2 style={h2Style}>Gebiet übergeben</h2>
        <p style={mutedStyle}>
          Gebiet vom aktuell ausgewählten Partner an einen anderen Partner übertragen.
        </p>
        <div style={grid2Style}>
          <select
            style={inputStyle}
            aria-label="Kreis für Übergabe auswählen"
            value={handoverDraft.area_id}
            disabled={!selectedPartner}
            onChange={(e) => setHandoverDraft((v) => ({ ...v, area_id: e.target.value }))}
          >
            <option value="">Kreis wählen</option>
            {handoverAreaOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.displayLabel}
              </option>
            ))}
          </select>
          <select
            style={inputStyle}
            aria-label="Neuen Partner für Übergabe auswählen"
            value={handoverDraft.new_partner_id}
            disabled={!selectedPartner}
            onChange={(e) => setHandoverDraft((v) => ({ ...v, new_partner_id: e.target.value }))}
          >
            <option value="">Neuen Partner wählen</option>
            {handoverNewPartnerOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {formatPartnerName(p)}
              </option>
            ))}
          </select>
        </div>
        <div style={{ marginTop: 10, border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 10px", background: "#f8fafc" }}>
          <div style={{ fontSize: 12, color: "#334155", marginBottom: 6 }}>
            {selectedPartner?.is_system_default
              ? "Hinweis: Der Portalpartner bleibt dauerhaft aktiv."
              : "Hinweis: Dieser Partner bleibt noch aktiv, seine Integrationen werden deaktiviert bis zur vollständigen Löschung des Accounts."}
          </div>
          <div style={{ display: "grid", gap: 10, marginTop: 8 }}>
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <input
                type="checkbox"
                checked={handoverDraft.include_report_customization}
                onChange={(e) => setHandoverDraft((v) => ({
                  ...v,
                  include_report_customization: e.target.checked,
                  transfer_mode: e.target.checked || v.include_seo_geo ? "copy_partner_state" : "base_reset",
                }))}
              />
              <span style={{ fontSize: 12, color: "#334155" }}>
                <strong>Berichtindividualisierung mitnehmen</strong><br />
                Faktoren, Runtime-Snapshots, data-driven Texte, Report-Overrides und Portal-Übersetzungen.
              </span>
            </label>
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <input
                type="checkbox"
                checked={handoverDraft.include_seo_geo}
                onChange={(e) => setHandoverDraft((v) => ({
                  ...v,
                  include_seo_geo: e.target.checked,
                  transfer_mode: v.include_report_customization || e.target.checked ? "copy_partner_state" : "base_reset",
                }))}
              />
              <span style={{ fontSize: 12, color: "#334155" }}>
                <strong>SEO &amp; GEO Texte mitnehmen</strong><br />
                Marketingtexte und deren Übersetzungen für Title, Description und weitere Metadaten.
              </span>
            </label>
            <div style={{ fontSize: 12, color: "#334155" }}>
              <strong>Lokale Website</strong><br />
              Bleibt unberührt. Der neue Partner startet dort ohne kanalbezogene Local-Site-Texte.
            </div>
            <label style={{ display: "grid", gap: 6, fontSize: 12, color: "#334155" }}>
              <span><strong>Blogarchiv</strong></span>
              <select
                style={inputStyle}
                value={handoverDraft.blog_transfer_mode}
                onChange={(e) => setHandoverDraft((v) => ({ ...v, blog_transfer_mode: e.target.value as HandoverBlogTransferMode }))}
              >
                <option value="keep_old_partner">Beim alten Partner lassen</option>
                <option value="copy_as_draft">Zum neuen Partner als Entwurf kopieren</option>
                <option value="copy_as_is">Zum neuen Partner wie bisher übernehmen</option>
              </select>
            </label>
            {handoverLocaleOptions.length > 0 ? (
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ fontSize: 12, color: "#334155" }}>
                  <strong>Sprachen</strong><br />
                  Für jede bisher freigeschaltete Sprache wird festgelegt, ob Übersetzungen kopiert und beim Zielpartner aktiviert werden.
                </div>
                {handoverLocaleOptions.map((row) => {
                  const locale = String(row.locale ?? "").trim().toLowerCase();
                  const currentMode = handoverDraft.locale_modes[locale] ?? "copy_and_enable";
                  return (
                    <div key={`handover-locale-${locale}`} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 220px", gap: 10, alignItems: "center" }}>
                      <div style={{ fontSize: 12, color: "#334155" }}>
                        <strong>{row.label_de || row.label_native || locale}</strong>
                        <div style={{ color: "#64748b" }}>{locale}{row.bcp47_tag ? ` · ${row.bcp47_tag}` : ""}</div>
                      </div>
                      <select
                        style={inputStyle}
                        value={currentMode}
                        onChange={(e) => setHandoverDraft((v) => ({
                          ...v,
                          locale_modes: {
                            ...v.locale_modes,
                            [locale]: e.target.value as HandoverLocaleMode,
                          },
                        }))}
                      >
                        <option value="skip">Nicht übernehmen</option>
                        <option value="copy_disabled">Übernehmen, deaktiviert</option>
                        <option value="copy_and_enable">Übernehmen und aktivieren</option>
                      </select>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
          <div style={{ fontSize: 12, color: "#334155" }}>
            <strong>Vorschau:</strong>{" "}
            {selectedPartner && handoverDraft.area_id && handoverTargetPartner
              ? `${selectedHandoverAreaOption?.displayLabel ?? handoverDraft.area_id} von ${formatPartnerName(selectedPartner)} zu ${formatPartnerName(handoverTargetPartner)} · Bericht ${handoverDraft.include_report_customization ? "ja" : "nein"} · SEO/GEO ${handoverDraft.include_seo_geo ? "ja" : "nein"} · Blog ${formatHandoverBlogTransferModeLabel(handoverDraft.blog_transfer_mode)}`
              : "Bitte Kreis und Zielpartner auswählen."}
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <button
            style={btnDangerStyle}
            disabled={busy || !selectedPartner || !handoverDraft.area_id || !handoverDraft.new_partner_id}
            onClick={() => {
              if (!selectedPartnerId || !handoverDraft.area_id || !handoverDraft.new_partner_id) return;
              setHandoverConfirmModal({
                open: true,
                areaId: handoverDraft.area_id,
                areaLabel: selectedHandoverAreaOption?.displayLabel ?? handoverDraft.area_id,
                oldPartnerId: selectedPartnerId,
                newPartnerId: handoverDraft.new_partner_id,
                transferMode: handoverDraft.transfer_mode,
                includeReportCustomization: handoverDraft.include_report_customization,
                includeSeoGeo: handoverDraft.include_seo_geo,
                blogTransferMode: handoverDraft.blog_transfer_mode,
                localeModes: handoverDraft.locale_modes,
                oldPartnerIsSystemDefault: Boolean(selectedPartner?.is_system_default),
              });
            }}
          >
            Übergabe ausführen
          </button>
        </div>
      </section>
      ) : null}

      {activeView === "partner_edit" && partnerTab === "integrations" && Boolean(selectedPartner) ? (
      <section style={cardStyle}>
        <h2 style={h2Style}>Anbindungen</h2>
        <div style={partnerTabBarStyle}>
          <button
            style={partnerTabButtonStyle(integrationsAdminTab === "overview")}
            onClick={() => setIntegrationsAdminTab("overview")}
          >
            Übersicht
          </button>
          <button
            style={partnerTabButtonStyle(integrationsAdminTab === "llm_partner")}
            onClick={() => setIntegrationsAdminTab("llm_partner")}
          >
            Partner LLM-Anbindung
          </button>
        </div>

        {integrationsAdminTab === "llm_partner" ? (
          <div style={{ marginTop: 14, marginBottom: 14, padding: 12, border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc" }}>
            <label style={{ display: "block", marginBottom: 8 }}>
              <input
                type="checkbox"
                checked={editPartner.llm_partner_managed_allowed}
                disabled={!selectedPartner}
                onChange={(e) => setEditPartner((v) => ({ ...v, llm_partner_managed_allowed: e.target.checked }))}
              />
              <span style={{ marginLeft: 8 }}>Partner-eigene LLM-Anbindungen erlauben</span>
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                style={btnStyle}
                disabled={busy || !selectedPartner}
                onClick={() =>
                  run("LLM-Freigabe speichern", async () => {
                    if (!selectedPartnerId) return;
                    await api(`/api/admin/partners/${selectedPartnerId}`, {
                      method: "PATCH",
                      body: JSON.stringify({
                        llm_partner_managed_allowed: editPartner.llm_partner_managed_allowed,
                      }),
                    });
                    await loadPartners(selectedPartnerId);
                  })
                }
              >
                Freigabe speichern
              </button>
              <span style={{ fontSize: 12, color: "#475569" }}>
                Ohne Freigabe sieht der Partner den LLM-Anbindungstyp im Dashboard nicht.
              </span>
            </div>
          </div>
        ) : null}

        {integrationsAdminTab === "overview" ? (
        <>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Kind</th>
              <th style={thStyle}>Provider</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Zugang (maskiert)</th>
              <th style={thStyle}>Sync/Test</th>
              <th style={thStyle}>Aktion</th>
            </tr>
          </thead>
          <tbody>
            {integrations.map((integration) => {
              return (
                <tr key={integration.id}>
                  <td style={tdStyle}>{integration.kind}</td>
                  <td style={tdStyle}>{integration.provider}</td>
                  <td style={tdStyle}>{integration.is_active ? "aktiv" : "inaktiv"}</td>
                  <td style={tdStyle}>{getMaskedAuthSummary(integration)}</td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: 12, color: "#334155" }}>{getIntegrationHealthSummary(integration)}</span>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        style={btnGhostStyle}
                        disabled={busy}
                        onClick={() =>
                          run("Integration Status ändern", async () => {
                            await api(
                              `/api/admin/integrations/${integration.id}/${integration.is_active ? "deactivate" : "reactivate"}`,
                              { method: "POST" },
                            );
                            await loadPartnerDetails(selectedPartnerId);
                          })
                        }
                      >
                        {integration.is_active ? "Deaktivieren" : "Aktivieren"}
                      </button>
                      <button
                        style={btnDangerStyle}
                        disabled={busy}
                        onClick={() => {
                          setIntegrationDeleteConfirmModal({
                            open: true,
                            integrationId: integration.id,
                            provider: integration.provider,
                            kind: integration.kind,
                          });
                        }}
                      >
                        Löschen
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ display: "grid", gap: 14, marginTop: 16 }}>
          {integrations
            .filter((integration) => String(integration.kind ?? "").toLowerCase() === "crm")
            .map((integration) => {
              const draft = crmIntegrationDrafts[integration.id] ?? buildCrmIntegrationAdminDraft(integration);
              const globalSyncSummary = readSyncSummaryFromIntegration(integration, "all");
              const resourceKeys: CrmResourceKey[] = ["offers", "references", "requests"];
              return (
                <div
                  key={`crm-admin-${integration.id}`}
                  style={{ border: "1px solid #dbeafe", borderRadius: 10, padding: 14, background: "#f8fbff" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
                        CRM-Steuerung · {integration.provider}
                      </div>
                      <div style={{ ...mutedStyle, marginTop: 4, fontSize: 12 }}>
                        Referenz-Mapping und Testläufe sind hier admin-only. Partner sehen nur noch Status und Ergebnis.
                      </div>
                    </div>
                    <div style={{ ...mutedStyle, fontSize: 12 }}>
                      {getIntegrationHealthSummary(integration)}
                    </div>
                  </div>
                  <div style={{ marginTop: 14, display: "grid", gap: 14 }}>
                    {resourceKeys.map((resourceKey) => {
                      const resourceSyncSummary = readSyncSummaryFromIntegration(integration, resourceKey);
                      const resourcePreviewSummary = readPreviewSummaryFromIntegration(integration, resourceKey);
                      const isRunningThisResource = resourceSyncSummary?.status === "running";
                      const anotherSyncRunning = globalSyncSummary?.status === "running" && !isRunningThisResource;

                      return (
                        <div
                          key={`crm-resource-${integration.id}-${resourceKey}`}
                          style={{ border: "1px solid #dbeafe", borderRadius: 10, padding: 12, background: "#fff" }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                                {formatCrmResourceLabel(resourceKey)}
                              </div>
                              <div style={{ ...mutedStyle, marginTop: 4, fontSize: 12 }}>
                                {resourceKey === "offers"
                                  ? "Häufige Aktualisierung, damit vermarktete Angebote schnell verschwinden."
                                  : resourceKey === "references"
                                    ? "Referenzen mit eigener Filter- und Testlogik."
                                    : "Gesuche mit eigener Freshness- und Lifecycle-Steuerung."}
                              </div>
                            </div>
                            {anotherSyncRunning ? (
                              <div style={{ fontSize: 11, color: "#1d4ed8", fontWeight: 700 }}>
                                Andere Ressource läuft gerade
                              </div>
                            ) : null}
                          </div>

                          <div style={{ marginTop: 12, display: "grid", gap: 12, gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
                            {resourceKey === "offers" ? (
                              <>
                                <label>
                                  Status-IDs für Angebote
                                  <input
                                    style={inputStyle}
                                    value={draft.listingsStatusIds}
                                    onChange={(e) =>
                                      setCrmIntegrationDrafts((prev) => ({
                                        ...prev,
                                        [integration.id]: { ...draft, listingsStatusIds: e.target.value },
                                      }))
                                    }
                                    placeholder="z. B. 274, 276"
                                  />
                                </label>
                                <label>
                                  Guarded target_objects
                                  <input
                                    style={inputStyle}
                                    value={draft.guardedUnitsTargetObjects}
                                    onChange={(e) =>
                                      setCrmIntegrationDrafts((prev) => ({
                                        ...prev,
                                        [integration.id]: { ...draft, guardedUnitsTargetObjects: e.target.value },
                                      }))
                                    }
                                    placeholder="z. B. 100"
                                  />
                                </label>
                              </>
                            ) : null}

                            {resourceKey === "references" ? (
                              <>
                                <label>
                                  Referenz-Archivfilter
                                  <select
                                    style={inputStyle}
                                    value={draft.referencesArchived}
                                    onChange={(e) =>
                                      setCrmIntegrationDrafts((prev) => ({
                                        ...prev,
                                        [integration.id]: { ...draft, referencesArchived: e.target.value },
                                      }))
                                    }
                                  >
                                    <option value="">Provider-Default</option>
                                    <option value="1">Nur archivierte</option>
                                    <option value="-1">Aktive + archivierte</option>
                                    <option value="0">Nur aktive</option>
                                  </select>
                                </label>
                                <label>
                                  Status-IDs für Referenzen
                                  <input
                                    style={inputStyle}
                                    value={draft.referencesStatusIds}
                                    onChange={(e) =>
                                      setCrmIntegrationDrafts((prev) => ({
                                        ...prev,
                                        [integration.id]: { ...draft, referencesStatusIds: e.target.value },
                                      }))
                                    }
                                    placeholder="z. B. 274, 311"
                                  />
                                </label>
                                <label>
                                  Optionales Custom-Field
                                  <input
                                    style={inputStyle}
                                    value={draft.referencesCustomFieldKey}
                                    onChange={(e) =>
                                      setCrmIntegrationDrafts((prev) => ({
                                        ...prev,
                                        [integration.id]: { ...draft, referencesCustomFieldKey: e.target.value },
                                      }))
                                    }
                                    placeholder="z. B. referenz_webseite"
                                  />
                                </label>
                                <label>
                                  Guarded target_objects
                                  <input
                                    style={inputStyle}
                                    value={draft.guardedReferencesTargetObjects}
                                    onChange={(e) =>
                                      setCrmIntegrationDrafts((prev) => ({
                                        ...prev,
                                        [integration.id]: { ...draft, guardedReferencesTargetObjects: e.target.value },
                                      }))
                                    }
                                    placeholder="z. B. 100"
                                  />
                                </label>
                              </>
                            ) : null}

                            {resourceKey === "requests" ? (
                              <>
                                <label>
                                  Guarded target_objects
                                  <input
                                    style={inputStyle}
                                    value={draft.guardedSavedQueriesTargetObjects}
                                    onChange={(e) =>
                                      setCrmIntegrationDrafts((prev) => ({
                                        ...prev,
                                        [integration.id]: { ...draft, guardedSavedQueriesTargetObjects: e.target.value },
                                      }))
                                    }
                                    placeholder="z. B. 50"
                                  />
                                </label>
                                <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 22 }}>
                                  <input
                                    type="checkbox"
                                    checked={draft.requestFreshnessEnabled}
                                    onChange={(e) =>
                                      setCrmIntegrationDrafts((prev) => ({
                                        ...prev,
                                        [integration.id]: { ...draft, requestFreshnessEnabled: e.target.checked },
                                      }))
                                    }
                                  />
                                  <span>Freshness aktiv</span>
                                </label>
                                <label>
                                  Freshness-Basis
                                  <select
                                    style={inputStyle}
                                    value={draft.requestFreshnessBasis}
                                    onChange={(e) =>
                                      setCrmIntegrationDrafts((prev) => ({
                                        ...prev,
                                        [integration.id]: {
                                          ...draft,
                                          requestFreshnessBasis: e.target.value as "source_updated_at" | "last_seen_at",
                                        },
                                      }))
                                    }
                                  >
                                    <option value="source_updated_at">source_updated_at</option>
                                    <option value="last_seen_at">last_seen_at</option>
                                  </select>
                                </label>
                                <label>
                                  Kauf max_age_days
                                  <input
                                    style={inputStyle}
                                    value={draft.requestFreshnessBuyDays}
                                    onChange={(e) =>
                                      setCrmIntegrationDrafts((prev) => ({
                                        ...prev,
                                        [integration.id]: { ...draft, requestFreshnessBuyDays: e.target.value },
                                      }))
                                    }
                                    placeholder="z. B. 180"
                                  />
                                </label>
                                <label>
                                  Miete max_age_days
                                  <input
                                    style={inputStyle}
                                    value={draft.requestFreshnessRentDays}
                                    onChange={(e) =>
                                      setCrmIntegrationDrafts((prev) => ({
                                        ...prev,
                                        [integration.id]: { ...draft, requestFreshnessRentDays: e.target.value },
                                      }))
                                    }
                                    placeholder="z. B. 90"
                                  />
                                </label>
                                <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 22 }}>
                                  <input
                                    type="checkbox"
                                    checked={draft.requestFreshnessFallbackToLastSeen}
                                    onChange={(e) =>
                                      setCrmIntegrationDrafts((prev) => ({
                                        ...prev,
                                        [integration.id]: { ...draft, requestFreshnessFallbackToLastSeen: e.target.checked },
                                      }))
                                    }
                                  />
                                  <span>Fallback auf last_seen_at</span>
                                </label>
                              </>
                            ) : null}
                          </div>

                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
                            <button
                              style={btnStyle}
                              disabled={busy || !selectedPartnerId}
                              onClick={() =>
                                run(`${formatCrmResourceLabel(resourceKey)}-Settings speichern`, async () => {
                                  const settings = applyCrmAdminDraftToSettings(integration, draft);
                                  await api(`/api/admin/integrations/${integration.id}`, {
                                    method: "PATCH",
                                    body: JSON.stringify({ settings }),
                                  });
                                  await loadPartnerDetails(selectedPartnerId);
                                })
                              }
                            >
                              Settings speichern
                            </button>
                            <button
                              style={btnGhostStyle}
                              disabled={busy || !integration.is_active || !selectedPartnerId || anotherSyncRunning}
                              onClick={() =>
                                run(`${formatCrmResourceLabel(resourceKey)}-Abruf testen`, async () => {
                                  await api(`/api/admin/integrations/${integration.id}/preview-sync`, {
                                    method: "POST",
                                    body: JSON.stringify({ resource: resourceKey }),
                                  });
                                  await loadPartnerDetails(selectedPartnerId);
                                })
                              }
                            >
                              Abruf testen
                            </button>
                            <button
                              style={btnGhostStyle}
                              disabled={busy || !integration.is_active || !selectedPartnerId || anotherSyncRunning || isRunningThisResource}
                              onClick={() =>
                                run(`${formatCrmResourceLabel(resourceKey)} Guarded-Sync starten`, async () => {
                                  await api(`/api/admin/integrations/${integration.id}/sync`, {
                                    method: "POST",
                                    body: JSON.stringify({ resource: resourceKey, mode: "guarded" }),
                                  });
                                  await loadPartnerDetails(selectedPartnerId);
                                })
                              }
                            >
                              {isRunningThisResource && resourceSyncSummary?.mode === "guarded" ? "Guarded-Sync läuft..." : "Guarded-Sync"}
                            </button>
                            <button
                              style={btnDangerStyle}
                              disabled={busy || !integration.is_active || !selectedPartnerId || anotherSyncRunning || isRunningThisResource}
                              onClick={() =>
                                run(`${formatCrmResourceLabel(resourceKey)} Vollsync starten`, async () => {
                                  await api(`/api/admin/integrations/${integration.id}/sync`, {
                                    method: "POST",
                                    body: JSON.stringify({ resource: resourceKey, mode: "full" }),
                                  });
                                  await loadPartnerDetails(selectedPartnerId);
                                })
                              }
                            >
                              Vollsync
                            </button>
                            {isRunningThisResource ? (
                              <button
                                style={btnGhostStyle}
                                disabled={busy || !selectedPartnerId}
                                onClick={() =>
                                  run(`${formatCrmResourceLabel(resourceKey)}-Sync abbrechen`, async () => {
                                    await api(`/api/admin/integrations/${integration.id}/sync?resource=${resourceKey}`, {
                                      method: "DELETE",
                                    });
                                    await loadPartnerDetails(selectedPartnerId);
                                  })
                                }
                              >
                                Synchronisierung abbrechen
                              </button>
                            ) : null}
                          </div>

                          <p style={{ marginTop: 8, marginBottom: 0, fontSize: 11, color: "#475569" }}>
                            Vollsync läuft mit Safety-Limits und erlaubt nur dann Stale-Deaktivierung, wenn der Providerlauf nicht an einem Fetch-Limit abgeschnitten wurde.
                          </p>

                          {resourcePreviewSummary ? (
                            <div style={{ marginTop: 12 }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>
                                Letzter {formatCrmResourceLabel(resourceKey)}-Abruf-Test
                              </div>
                              <p
                                style={{
                                  marginTop: 6,
                                  marginBottom: 0,
                                  fontSize: 12,
                                  color:
                                    resourcePreviewSummary.status === "ok"
                                      ? "#15803d"
                                      : resourcePreviewSummary.status === "warning"
                                        ? "#b45309"
                                        : "#b91c1c",
                                }}
                              >
                                {resourcePreviewSummary.message}
                              </p>
                              {resourcePreviewSummary.testedAt ? (
                                <p style={{ marginTop: 4, marginBottom: 0, fontSize: 11, color: "#475569" }}>
                                  Zuletzt getestet: {new Date(resourcePreviewSummary.testedAt).toLocaleString("de-DE")}
                                </p>
                              ) : null}
                              {resourcePreviewSummary.traceId ? (
                                <p style={{ marginTop: 4, marginBottom: 0, fontSize: 11, color: "#475569", wordBreak: "break-all" }}>
                                  Trace-ID: {resourcePreviewSummary.traceId}
                                </p>
                              ) : null}
                            </div>
                          ) : null}

                          {resourceSyncSummary ? (
                            <div style={{ marginTop: 12 }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>
                                Letzter {formatCrmResourceLabel(resourceKey)}-{formatCrmSyncModeLabel(resourceSyncSummary.mode)}
                              </div>
                              <p style={{ marginTop: 6, marginBottom: 0, fontSize: 11, color: "#475569" }}>
                                {resourceSyncSummary.mode === "full"
                                  ? "Vollsync: mit Stale-Deaktivierung, sofern der Fetch nicht an Safety-Limits abgeschnitten wurde."
                                  : "Guarded-Modus: keine Stale-Deaktivierung."}
                              </p>
                              <p
                                style={{
                                  marginTop: 6,
                                  marginBottom: 0,
                                  fontSize: 12,
                                  color:
                                    resourceSyncSummary.status === "ok"
                                      ? "#15803d"
                                      : resourceSyncSummary.status === "warning"
                                        ? "#b45309"
                                        : resourceSyncSummary.status === "running"
                                          ? "#1d4ed8"
                                          : "#b91c1c",
                                }}
                              >
                                {resourceSyncSummary.message}
                              </p>
                              {resourceSyncSummary.step ? (
                                <p style={{ marginTop: 4, marginBottom: 0, fontSize: 11, color: "#475569" }}>
                                  Aktueller Schritt: {resourceSyncSummary.step}
                                  {resourceSyncSummary.cancelRequested ? " · Abbruch angefordert" : ""}
                                </p>
                              ) : null}
                              {resourceSyncSummary.heartbeatAt ? (
                                <p style={{ marginTop: 4, marginBottom: 0, fontSize: 11, color: "#475569" }}>
                                  Letzter Heartbeat: {new Date(resourceSyncSummary.heartbeatAt).toLocaleString("de-DE")}
                                </p>
                              ) : null}
                              {typeof resourceSyncSummary.requestCount === "number" || typeof resourceSyncSummary.pagesFetched === "number" ? (
                                <p style={{ marginTop: 4, marginBottom: 0, fontSize: 11, color: "#475569" }}>
                                  Provider-Last: {typeof resourceSyncSummary.requestCount === "number" ? `${resourceSyncSummary.requestCount} Requests` : "0 Requests"}
                                  {typeof resourceSyncSummary.pagesFetched === "number" ? ` · ${resourceSyncSummary.pagesFetched} Seiten` : ""}
                                </p>
                              ) : null}
                              {resourceSyncSummary.traceId ? (
                                <p style={{ marginTop: 4, marginBottom: 0, fontSize: 11, color: "#475569", wordBreak: "break-all" }}>
                                  Trace-ID: {resourceSyncSummary.traceId}
                                </p>
                              ) : null}
                              {Array.isArray(resourceSyncSummary.result?.notes) && resourceSyncSummary.result.notes.length > 0 ? (
                                <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                                  <p style={{ marginTop: 0, marginBottom: 6, fontSize: 11, fontWeight: 700, color: "#334155" }}>
                                    Sync-Notes
                                  </p>
                                  {resourceSyncSummary.result.notes.slice(0, 5).map((note, index) => (
                                    <p key={`admin-sync-note-${integration.id}-${resourceKey}-${index}`} style={{ marginTop: 0, marginBottom: 4, fontSize: 11, color: "#475569" }}>
                                      {note}
                                    </p>
                                  ))}
                                </div>
                              ) : null}
                              {Array.isArray(resourceSyncSummary.log) && resourceSyncSummary.log.length > 0 ? (
                                <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                                  <p style={{ marginTop: 0, marginBottom: 6, fontSize: 11, fontWeight: 700, color: "#334155" }}>
                                    Sync-Debug
                                  </p>
                                  {resourceSyncSummary.log.slice(-5).map((entry, index) => (
                                    <p key={`${entry.at ?? "log"}-${entry.step ?? "step"}-${resourceKey}-${index}`} style={{ marginTop: 0, marginBottom: 4, fontSize: 11, color: "#475569" }}>
                                      {entry.at ? new Date(entry.at).toLocaleTimeString("de-DE") : "--:--:--"} · {entry.step ?? "step"} · {entry.message ?? ""}
                                    </p>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
        </div>
        </>
        ) : null}
      </section>
      ) : null}

      {activeView === "partner_edit" && partnerTab === "billing" && Boolean(selectedPartner) ? (
      <section style={cardStyle}>
        <h2 style={h2Style}>Abrechnung</h2>
        <p style={mutedStyle}>
          Portalabo/Feature-Freischaltungen und partnerbezogene Abrechnungseinstellungen.
        </p>
        <div style={{ marginTop: 12, padding: 12, border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc" }}>
          <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>Portalabo Override (Partner)</div>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
            <label>
              Grundpreis (EUR/Monat)
              <input
                style={inputStyle}
                value={partnerPortalBillingDraft.portal_base_price_eur}
                onChange={(e) => setPartnerPortalBillingDraft((v) => ({ ...v, portal_base_price_eur: e.target.value }))}
                placeholder="leer = globaler Standard"
              />
            </label>
            <label>
              Preis je Ortslage (EUR)
              <input
                style={inputStyle}
                value={partnerPortalBillingDraft.portal_ortslage_price_eur}
                onChange={(e) => setPartnerPortalBillingDraft((v) => ({ ...v, portal_ortslage_price_eur: e.target.value }))}
                placeholder="leer = globaler Standard"
              />
            </label>
            <label>
              Preis je Export-Ortslage (EUR)
              <input
                style={inputStyle}
                value={partnerPortalBillingDraft.portal_export_ortslage_price_eur}
                onChange={(e) => setPartnerPortalBillingDraft((v) => ({ ...v, portal_export_ortslage_price_eur: e.target.value }))}
                placeholder="leer = globaler Standard"
              />
            </label>
          </div>
          <div style={{ marginTop: 10 }}>
            <button
              style={btnStyle}
              disabled={busy || !selectedPartnerId}
              onClick={() =>
                run("Partner-Portalabo speichern", async () => {
                  if (!selectedPartnerId) return;
                  const parseOverride = (raw: string) => {
                    const v = String(raw ?? "").trim();
                    if (!v) return null;
                    const n = Number(v);
                    if (!Number.isFinite(n) || n < 0) throw new Error("Portalabo-Preise müssen >= 0 sein.");
                    return Number(n.toFixed(2));
                  };
                  await api(`/api/admin/partners/${selectedPartnerId}/billing`, {
                    method: "PATCH",
                    body: JSON.stringify({
                      portal_overrides: {
                        portal_base_price_eur: parseOverride(partnerPortalBillingDraft.portal_base_price_eur),
                        portal_ortslage_price_eur: parseOverride(partnerPortalBillingDraft.portal_ortslage_price_eur),
                        portal_export_ortslage_price_eur: parseOverride(partnerPortalBillingDraft.portal_export_ortslage_price_eur),
                      },
                    }),
                  });
                  await loadPartnerBillingConfig(selectedPartnerId);
                })
              }
            >
              Portalabo speichern
            </button>
          </div>
        </div>

        <div style={{ marginTop: 12, padding: 12, border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff" }}>
          <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>Internationale Sprachen</div>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Sprache</th>
                <th style={thStyle}>Global</th>
                <th style={thStyle}>Partner</th>
                <th style={thStyle}>Partner aktiv</th>
                <th style={thStyle}>Preis EUR/Monat</th>
                <th style={thStyle}>Hinweis</th>
              </tr>
            </thead>
            <tbody>
              {partnerLocaleBillingRows.map((row, idx) => (
                <tr key={row.locale}>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 600 }}>{row.label_de || row.label_native || row.locale}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>
                      {row.locale}{row.bcp47_tag ? ` · ${row.bcp47_tag}` : ""}
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ fontSize: 13, color: "#334155" }}>
                      {row.is_active ? "aktiv" : "inaktiv"} · {row.status}
                    </div>
                    <div style={{ fontSize: 12, color: row.feature_exists ? "#64748b" : "#b45309" }}>
                      {row.feature_exists
                        ? (row.feature_is_active ? "global bepreist" : "global angelegt, aber inaktiv")
                        : "global noch nicht bepreist"}
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ fontSize: 13, color: "#334155" }}>
                      {row.partner_bookable ? "partnerbuchbar" : "nicht partnerbuchbar"}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>
                      {row.feature_code}
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <input
                      type="checkbox"
                      checked={row.enabled}
                      disabled={!row.feature_exists || !row.feature_is_active || !row.partner_bookable || !row.is_active}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setPartnerLocaleBillingRows((prev) => prev.map((item, itemIdx) => (
                          itemIdx === idx ? { ...item, enabled: checked } : item
                        )));
                      }}
                    />
                  </td>
                  <td style={tdStyle}>
                    <input
                      style={{ ...inputStyle, maxWidth: 140 }}
                      value={String(row.monthly_price_eur ?? 0)}
                      disabled={!row.feature_exists}
                      onChange={(e) => {
                        const next = Number(e.target.value);
                        setPartnerLocaleBillingRows((prev) =>
                          prev.map((item, itemIdx) => (
                            itemIdx === idx ? { ...item, monthly_price_eur: Number.isFinite(next) ? next : 0 } : item
                          )),
                        );
                      }}
                    />
                  </td>
                  <td style={tdStyle}>
                    <div style={{ fontSize: 12, color: "#64748b" }}>
                      Default: {row.default_enabled ? "aktiv" : "inaktiv"} · {Number(row.default_monthly_price_eur ?? 0).toFixed(2)} EUR
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 10 }}>
            <button
              style={btnStyle}
              disabled={busy || !selectedPartnerId}
              onClick={() =>
                run("Partner-Sprachfeatures speichern", async () => {
                  if (!selectedPartnerId) return;
                  await api(`/api/admin/partners/${selectedPartnerId}/billing`, {
                    method: "PATCH",
                    body: JSON.stringify({
                      locale_feature_overrides: partnerLocaleBillingRows.map((row) => ({
                        locale: row.locale,
                        is_enabled: row.enabled,
                        monthly_price_eur: Number(Number(row.monthly_price_eur ?? 0).toFixed(2)),
                      })),
                    }),
                  });
                  await loadPartnerBillingConfig(selectedPartnerId);
                })
              }
            >
              Sprachfreigaben speichern
            </button>
          </div>
        </div>

        <div style={{ marginTop: 12, padding: 12, border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff" }}>
          <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>Sonstige Features (Partner-Override)</div>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Feature</th>
                <th style={thStyle}>Aktiv</th>
                <th style={thStyle}>Preis EUR/Monat</th>
                <th style={thStyle}>Default</th>
              </tr>
            </thead>
            <tbody>
              {partnerFeatureBillingRows.map((row, idx) => (
                <tr key={row.code}>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 600 }}>{row.label}</div>
                    {row.note ? <div style={{ fontSize: 12, color: "#64748b" }}>{row.note}</div> : null}
                  </td>
                  <td style={tdStyle}>
                    <input
                      type="checkbox"
                      checked={row.enabled}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setPartnerFeatureBillingRows((prev) => prev.map((item, itemIdx) => (itemIdx === idx ? { ...item, enabled: checked } : item)));
                      }}
                    />
                  </td>
                  <td style={tdStyle}>
                    <input
                      style={{ ...inputStyle, maxWidth: 140 }}
                      value={String(row.monthly_price_eur ?? 0)}
                      onChange={(e) => {
                        const next = Number(e.target.value);
                        setPartnerFeatureBillingRows((prev) =>
                          prev.map((item, itemIdx) => (itemIdx === idx ? { ...item, monthly_price_eur: Number.isFinite(next) ? next : 0 } : item)),
                        );
                      }}
                    />
                  </td>
                  <td style={tdStyle}>
                    {row.default_enabled ? "Aktiv" : "Inaktiv"} · {Number(row.default_monthly_price_eur ?? 0).toFixed(2)} EUR
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 10 }}>
            <button
              style={btnStyle}
              disabled={busy || !selectedPartnerId}
              onClick={() =>
                run("Partner-Features speichern", async () => {
                  if (!selectedPartnerId) return;
                  await api(`/api/admin/partners/${selectedPartnerId}/billing`, {
                    method: "PATCH",
                    body: JSON.stringify({
                      feature_overrides: partnerFeatureBillingRows.map((row) => ({
                        code: row.code,
                        is_enabled: row.enabled,
                        monthly_price_eur: Number(Number(row.monthly_price_eur ?? 0).toFixed(2)),
                      })),
                    }),
                  });
                  await loadPartnerBillingConfig(selectedPartnerId);
                })
              }
            >
              Sonstige Features speichern
            </button>
          </div>
        </div>

        <p style={{ ...mutedStyle, marginTop: 14 }}>
          Token- und Kostenverbrauch aus zentraler LLM-Nutzung.
        </p>
        <div style={{ ...rowStyle, marginTop: 10 }}>
          <input
            type="month"
            style={inputStyle}
            value={partnerBillingMonth}
            onChange={(e) => setPartnerBillingMonth(e.target.value)}
          />
          <button
            style={btnStyle}
            onClick={() =>
              run("Partner-Abrechnung laden", async () => {
                if (!selectedPartnerId) return;
                await loadPartnerBilling(selectedPartnerId, partnerBillingMonth);
              })
            }
          >
            Aktualisieren
          </button>
        </div>
        <div style={{ marginTop: 10, fontSize: 12, color: "#334155" }}>
          Gesamt Tokens: <strong>{partnerBillingTotals.tokens}</strong> · Gesamt Kosten (EUR): <strong>{partnerBillingTotals.cost_eur.toFixed(4)}</strong>
        </div>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Route</th>
              <th style={thStyle}>Provider</th>
              <th style={thStyle}>Modell</th>
              <th style={thStyle}>Tokens</th>
              <th style={thStyle}>Kosten EUR</th>
            </tr>
          </thead>
          <tbody>
            {partnerBillingRows.map((row) => (
              <tr key={`${row.route_name}:${row.provider}:${row.model}`}>
                <td style={tdStyle}>{row.route_name}</td>
                <td style={tdStyle}>{row.provider}</td>
                <td style={tdStyle}>{row.model}</td>
                <td style={tdStyle}>{row.tokens}</td>
                <td style={tdStyle}>{Number(row.cost_eur ?? 0).toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      ) : null}

      {activeView === "language_admin" ? (
      <section style={workspaceSectionStyle}>
        <h1 style={workspaceTitleStyle}>Sprachverwaltung</h1>
        <p style={mutedStyle}>
          Locale-Registry, Freigaben und Partnerbuchbarkeit zentral verwalten.
        </p>

        <div style={{ marginTop: 12, padding: 12, border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc" }}>
          <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>Neue Sprache hinzufügen</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 0.9fr 0.9fr", gap: 10 }}>
            <label>
              Sprache
              <select
                style={{ ...inputStyle, height: 38, padding: "0 10px" }}
                value={newPortalLocaleLanguageKey}
                onChange={(e) => handleNewPortalLocaleLanguageChange(e.target.value)}
              >
                <option value="">Bitte Sprache wählen</option>
                {availableNewPortalLocaleLanguages.map((language) => (
                  <option key={language.language_key} value={language.language_key}>
                    {language.label_de}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Variante
              <select
                style={{ ...inputStyle, height: 38, padding: "0 10px" }}
                value={newPortalLocalePresetKey}
                disabled={!selectedNewPortalLocaleLanguage || selectedNewPortalLocaleLanguage.variants.length <= 1}
                onChange={(e) => {
                  if (!selectedNewPortalLocaleLanguage) return;
                  applyNewPortalLocalePreset(selectedNewPortalLocaleLanguage.language_key, e.target.value);
                }}
              >
                {!selectedNewPortalLocaleLanguage ? (
                  <option value="">Bitte zuerst Sprache wählen</option>
                ) : selectedNewPortalLocaleLanguage.variants.map((variant) => (
                  <option key={variant.locale} value={variant.locale}>
                    {variant.variant_label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Anzeigename nativ
              <input
                style={{ ...inputStyle, height: 38 }}
                value={newPortalLocaleDraft.label_native ?? ""}
                onChange={(e) => setNewPortalLocaleDraft((prev) => ({ ...prev, label_native: e.target.value }))}
                placeholder="Français"
              />
            </label>
            <label>
              Verwaltungsname
              <input
                style={{ ...inputStyle, height: 38 }}
                value={newPortalLocaleDraft.label_de ?? ""}
                onChange={(e) => setNewPortalLocaleDraft((prev) => ({ ...prev, label_de: e.target.value }))}
                placeholder="Französisch"
              />
            </label>
          </div>
          <div style={{ ...rowStyle, marginTop: 10 }}>
            <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#334155" }}>
                <input
                  type="checkbox"
                  checked={newPortalLocaleSetup.syncSystemTexts}
                  onChange={(e) => setNewPortalLocaleSetup((prev) => ({ ...prev, syncSystemTexts: e.target.checked }))}
                />
                Systemtexte aus DE vorbereiten
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#334155" }}>
                <input
                  type="checkbox"
                  checked={newPortalLocaleSetup.syncPortalCms}
                  onChange={(e) => setNewPortalLocaleSetup((prev) => ({ ...prev, syncPortalCms: e.target.checked }))}
                />
                Portal-CMS aus DE vorbereiten
              </label>
            </div>
          </div>
          <div style={{ ...rowStyle, marginTop: 10 }}>
            <div style={{ ...mutedStyle, fontSize: 12 }}>
              Der Setup-Lauf speichert die Locale in der Registry und bereitet optional Systemtexte sowie Portal-CMS aus `de` vor. Öffentlich sichtbar wird sie erst mit `is_active = true` und `status = live`.
            </div>
            <button
              style={btnStyle}
              disabled={busy || !newPortalLocaleDraft.locale}
              onClick={() =>
                run("Neue Portal-Locale anlegen", async () => {
                  await createPortalLocaleWithSetup();
                })
              }
            >
              Sprache anlegen und vorbereiten
            </button>
          </div>
        </div>

        <div style={{ marginTop: 12, padding: 12, border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc" }}>
          <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>Locale Registry</div>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Sprache</th>
                <th style={thStyle}>Code</th>
                <th style={thStyle}>Aktiviert</th>
                <th style={thStyle}>Öffentlich</th>
                <th style={thStyle}>Partner</th>
              </tr>
            </thead>
            <tbody>
              {portalLocaleConfigs.map((row, idx) => (
                <tr key={row.locale}>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 700, color: "#0f172a" }}>
                      {row.label_de || row.label_native || row.locale}
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <code>{row.bcp47_tag || row.locale}</code>
                  </td>
                  <td style={tdStyle}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#334155" }}>
                      <input
                        type="checkbox"
                        checked={row.is_active}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setPortalLocaleConfigs((prev) => prev.map((item, itemIdx) => itemIdx === idx ? { ...item, is_active: checked } : item));
                        }}
                      />
                      Aktiviert
                    </label>
                  </td>
                  <td style={tdStyle}>
                    <select
                      style={{ ...inputStyle, width: 120, minWidth: 120 }}
                      value={row.status}
                      onChange={(e) => {
                        const nextStatus = String(e.target.value) as PortalLocaleStatus;
                        setPortalLocaleConfigs((prev) => prev.map((item, itemIdx) => itemIdx === idx ? { ...item, status: nextStatus } : item));
                      }}
                    >
                      <option value="planned">geplant</option>
                      <option value="internal">intern</option>
                      <option value="live">live</option>
                    </select>
                  </td>
                  <td style={tdStyle}>
                    {row.locale === "de" ? (
                      <span style={{ fontSize: 13, color: "#64748b" }}>Grundsprache</span>
                    ) : (
                      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#334155" }}>
                        <input
                          type="checkbox"
                          checked={row.partner_bookable}
                          disabled={!row.is_active}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setPortalLocaleConfigs((prev) => prev.map((item, itemIdx) => itemIdx === idx ? { ...item, partner_bookable: checked } : item));
                          }}
                        />
                        {row.partner_bookable ? "Partner buchbar - partnerseitig freigegeben" : "Partner buchbar - noch nicht partnerseitig freigegeben"}
                      </label>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
            <button
              style={{ ...btnStyle, width: "auto", minWidth: 0 }}
              disabled={busy}
              onClick={() =>
                run("Portal-Locales speichern", async () => {
                  await savePortalLocaleConfigs(portalLocaleConfigs);
                  await loadPortalCms();
                })
              }
            >
              Sprachen speichern
            </button>
          </div>
        </div>
      </section>
      ) : null}

      {activeView === "system_texts" ? (
      <section style={workspaceSectionStyle}>
        <h1 style={workspaceTitleStyle}>Systemtexte</h1>
        <p style={mutedStyle}>
          Navigation, Footer, Fallbacks und UI-Texte tabweise pro Locale pflegen.
        </p>

        <div style={{ marginTop: 12, padding: 12, border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff" }}>
          <div style={{ ...rowStyle, alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 700, color: "#0f172a" }}>Portalweite Systemtexte</div>
              <div style={{ ...mutedStyle, marginTop: 4 }}>
                UI-Texte sind thematisch in Tabs getrennt, damit Übersetzungen ohne Endloslisten gepflegt werden können.
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap" }}>
              <select
                style={{ ...inputStyle, minWidth: 180 }}
                value={portalSystemTextLocale}
                onChange={(e) => setPortalSystemTextLocale(e.target.value)}
              >
                {(portalLocaleConfigs.length > 0 ? portalLocaleConfigs : [{ locale: "de" } as PortalLocaleConfigRecord]).map((row) => (
                  <option key={row.locale} value={row.locale}>
                    {row.locale}{row.label_native ? ` · ${row.label_native}` : ""}
                  </option>
                ))}
              </select>
              <button
                style={btnStyle}
                disabled={busy}
                onClick={() =>
                  run("Systemtexte speichern", async () => {
                    await savePortalSystemTextLocale(portalSystemTextLocale);
                  })
                }
              >
                Systemtexte speichern
              </button>
            </div>
          </div>

          <div style={{ ...mutedStyle, fontSize: 12, marginTop: 10 }}>
            Für Nicht-DE-Locales markieren Sync-Läufe geänderte Texte bewusst nicht direkt als `live`. Öffentliche Ausspielung erfolgt erst nach manuellem Statuswechsel.
          </div>

          <div style={{ ...partnerTabBarStyle, marginTop: 14 }}>
            {portalSystemTextGroups.map(([groupName, defs]) => (
              <button
                key={groupName}
                style={partnerTabButtonStyle(portalSystemTextActiveGroup === groupName)}
                onClick={() => setPortalSystemTextActiveGroup(groupName)}
              >
                {groupName}
                <span style={{ marginLeft: 8, opacity: 0.75 }}>{defs.length}</span>
              </button>
            ))}
          </div>

          <div style={{ marginTop: 14, display: "grid", gap: 14 }}>
            {activePortalSystemTextGroups.map((def) => {
              const draftKey = buildPortalSystemTextDraftKey(portalSystemTextLocale, def.key);
              const draft = portalSystemTextDrafts[draftKey] ?? {
                status: portalSystemTextLocale === "de" ? "live" as PortalSystemTextEntryStatus : "draft" as PortalSystemTextEntryStatus,
                value_text: getPortalSystemTextDefaultValue(portalSystemTextLocale, def.key),
              };
              const meta = portalSystemTextMetaMap.get(`${portalSystemTextLocale}::${def.key}`) ?? null;
              return (
                <div key={def.key} style={{ border: "1px solid #dbe4ee", borderRadius: 8, padding: 10, background: "#fff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 700, color: "#0f172a" }}>{def.label}</div>
                      <div style={mutedStyle}>
                        <code>{def.key}</code>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ ...mutedStyle, fontSize: 12 }}>Status: <strong>{formatPortalEntryStatus(draft.status as PortalContentEntryStatus)}</strong></span>
                      {portalSystemTextLocale !== "de" && meta ? (
                        <span style={{ fontSize: 12, color: meta.translation_is_stale ? "#991b1b" : "#334155" }}>
                          {formatPortalTranslationOrigin(meta.translation_origin)}
                          {meta.translation_is_stale ? " · DE geändert" : ""}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <textarea
                    style={{ ...inputStyle, minHeight: 96, marginTop: 10, resize: "vertical" }}
                    value={draft.value_text}
                    onChange={(e) => {
                      const nextValue = e.target.value;
                      setPortalSystemTextDrafts((prev) => ({
                        ...prev,
                        [draftKey]: {
                          ...draft,
                          value_text: nextValue,
                        },
                      }));
                    }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
                    <select
                      style={{ ...inputStyle, maxWidth: 180 }}
                      value={draft.status}
                      onChange={(e) => {
                        const nextStatus = String(e.target.value) as PortalSystemTextEntryStatus;
                        setPortalSystemTextDrafts((prev) => ({
                          ...prev,
                          [draftKey]: {
                            ...draft,
                            status: nextStatus,
                          },
                        }));
                      }}
                    >
                      <option value="draft">entwurf</option>
                      <option value="internal">intern</option>
                      <option value="live">live</option>
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      ) : null}

      {activeView === "market_texts" ? (
      <section style={workspaceSectionStyle}>
        <h1 style={workspaceTitleStyle}>Markterklärungstexte</h1>
        <p style={mutedStyle}>
          Fachliche Markttexte sind hier getrennt von UI-Systemtexten organisiert. Standardtexte mit Text-Key werden deutsch als Systempartner-Basis gepflegt, statische Erklärungstexte ohne Key folgen separat.
        </p>

        <div style={{ ...marketExplanationModeBarStyle, marginTop: 14 }}>
          <button
            style={marketExplanationModeButtonStyle(marketExplanationMode === "standard")}
            disabled={busy}
            onClick={() => setMarketExplanationMode("standard")}
          >
            Standardtexte
          </button>
          <button
            style={marketExplanationModeButtonStyle(marketExplanationMode === "static")}
            disabled={busy}
            onClick={() => setMarketExplanationMode("static")}
          >
            Statische Erklärungstexte
          </button>
        </div>

        {marketExplanationMode === "standard" ? (
          <div style={marketExplanationScopeBarStyle}>
            <button
              style={marketExplanationScopeButtonStyle(marketExplanationStandardScope === "kreis")}
              disabled={busy}
              onClick={() => {
                setMarketExplanationStandardScope("kreis");
                setMarketExplanationStandardLocale("de");
                void run("Kreis-Standardtexte laden", async () => {
                  await loadMarketExplanationStandardTexts({ scope: "kreis", locale: "de" });
                }, { showSuccessModal: false });
              }}
            >
              Kreis
            </button>
            <button
              style={marketExplanationScopeButtonStyle(marketExplanationStandardScope === "bundesland")}
              disabled={busy}
              onClick={() => {
                const fallbackBundesland = marketExplanationStandardBundeslandSlug || marketExplanationStandardBundeslaender[0]?.slug || "";
                setMarketExplanationStandardScope("bundesland");
                if (fallbackBundesland) {
                  setMarketExplanationStandardBundeslandSlug(fallbackBundesland);
                  void run("Bundesland-Standardtexte laden", async () => {
                    await loadMarketExplanationStandardTexts({
                      scope: "bundesland",
                      bundeslandSlug: fallbackBundesland,
                      locale: marketExplanationStandardLocale,
                    });
                  }, { showSuccessModal: false });
                }
              }}
            >
              Bundesland
            </button>
          </div>
        ) : null}

        <div style={marketExplanationWorkspaceCardStyle}>
          <div style={marketExplanationActionRowStyle}>
            {marketExplanationMode === "standard" ? (
              <>
                <div style={marketExplanationActionGroupStyle}>
                  {marketExplanationStandardScope === "bundesland" ? (
                    <select
                      style={{ ...inputStyle, minWidth: 180 }}
                      value={marketExplanationStandardLocale}
                      onChange={(e) => setMarketExplanationStandardLocale(e.target.value)}
                    >
                      {(portalLocaleConfigs.length > 0 ? portalLocaleConfigs : [{ locale: "de" } as PortalLocaleConfigRecord]).map((row) => (
                        <option key={row.locale} value={row.locale}>
                          {row.locale}{row.label_native ? ` · ${row.label_native}` : ""}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div style={marketExplanationScopeHintStyle}>Kreis-Standardtexte werden deutsch gepflegt.</div>
                  )}
                </div>
                <div style={marketExplanationActionGroupStyle}>
                  <button
                    style={btnGhostStyle}
                    disabled={busy}
                    onClick={() =>
                      run("Standardtexte neu laden", async () => {
                        await loadMarketExplanationStandardTexts();
                      })
                    }
                  >
                    Neu laden
                  </button>
                  {marketExplanationStandardScope === "kreis" ? (
                    <button
                      style={btnStyle}
                      disabled={busy}
                      onClick={() =>
                        run("Standardtexte speichern", async () => {
                          await saveMarketExplanationStandardTexts();
                        })
                      }
                    >
                      Standardtexte speichern
                    </button>
                  ) : null}
                </div>
              </>
            ) : (
              <>
                <div style={marketExplanationActionGroupStyle}>
                  <select
                    style={{ ...inputStyle, minWidth: 180 }}
                    value={marketExplanationStaticLocale}
                    onChange={(e) => setMarketExplanationStaticLocale(e.target.value)}
                  >
                    {(portalLocaleConfigs.length > 0 ? portalLocaleConfigs : [{ locale: "de" } as PortalLocaleConfigRecord]).map((row) => (
                      <option key={row.locale} value={row.locale}>
                        {row.locale}{row.label_native ? ` · ${row.label_native}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={marketExplanationActionGroupStyle}>
                  <button
                    style={btnSuccessGhostStyle}
                    disabled={busy || marketExplanationStaticLocale === "de"}
                    onClick={() =>
                      run("Statische Erklärungstexte aus DE ergänzen", async () => {
                        await syncMarketExplanationStaticLocaleFromDe(marketExplanationStaticLocale, "fill_missing");
                      })
                    }
                  >
                    Aus DE ergänzen
                  </button>
                  <button
                    style={btnSuccessGhostStyle}
                    disabled={busy || marketExplanationStaticLocale === "de"}
                    onClick={() =>
                      run("Statische Erklärungstexte komplett aus DE übernehmen", async () => {
                        await syncMarketExplanationStaticLocaleFromDe(marketExplanationStaticLocale, "copy_all");
                      })
                    }
                  >
                    DE komplett übernehmen
                  </button>
                  <button
                    style={btnGhostStyle}
                    disabled={busy || marketExplanationStaticLocale === "de" || activeMarketExplanationStaticDefinitions.length === 0}
                    onClick={() =>
                      run("Aktiven Markttext-Tab per KI übersetzen", async () => {
                        await translateMarketExplanationStaticLocaleWithAi(
                          marketExplanationStaticLocale,
                          activeMarketExplanationStaticDefinitions.map((item) => item.key),
                        );
                      })
                    }
                  >
                    Tab per KI übersetzen
                  </button>
                  <button
                    style={btnGhostStyle}
                    disabled={busy || marketExplanationStaticLocale === "de"}
                    onClick={() =>
                      run("Statische Erklärungstext-Locale per KI übersetzen", async () => {
                        await translateMarketExplanationStaticLocaleWithAi(marketExplanationStaticLocale);
                      })
                    }
                  >
                    Locale per KI übersetzen
                  </button>
                  <button
                    style={btnStyle}
                    disabled={busy}
                    onClick={() =>
                      run("Statische Erklärungstexte speichern", async () => {
                        await saveMarketExplanationStaticLocale(marketExplanationStaticLocale);
                      })
                    }
                  >
                    Statische Erklärungstexte speichern
                  </button>
                </div>
              </>
            )}
          </div>

          {marketExplanationMode === "standard" && marketExplanationStandardScope === "bundesland" ? (
            <div style={marketExplanationBundeslandBarStyle}>
              {marketExplanationStandardBundeslaender.map((bundesland) => (
                <button
                  key={bundesland.slug}
                  style={marketExplanationBundeslandButtonStyle(marketExplanationStandardBundeslandSlug === bundesland.slug)}
                  onClick={() => setMarketExplanationStandardBundeslandSlug(bundesland.slug)}
                >
                  {bundesland.name}
                </button>
              ))}
            </div>
          ) : null}

          <div style={marketExplanationThemeTabBarStyle}>
            {marketExplanationVisibleTabs.map((tab) => (
              <button
                key={tab.id}
                style={marketExplanationThemeTabButtonStyle(marketExplanationTab === tab.label)}
                onClick={() => setMarketExplanationTab(tab.label)}
              >
                <span style={marketExplanationThemeTabLabelStyle}>{tab.label}</span>
                <span style={marketExplanationThemeTabCountStyle}>
                  {marketExplanationMode === "standard"
                    ? marketExplanationStandardDefinitions.filter((definition) => definition.tab === tab.id).length
                    : marketExplanationStaticDefinitions.filter((definition) => definition.tab === tab.id).length}
                </span>
              </button>
            ))}
          </div>

          {marketExplanationMode === "standard" ? (
            <div style={{ marginTop: 14, display: "grid", gap: 14 }}>
              {activeMarketExplanationStandardDefinitions.map((definition) => {
                const entry = marketExplanationStandardEntryMap[definition.key] ?? null;
                const draftValue = marketExplanationStandardDrafts[definition.key] ?? "";
                const baseValue = String(entry?.base_value_text ?? "");
                const hasOverride = entry?.has_override === true;
                const isBundesland = marketExplanationStandardScope === "bundesland";
                const isTranslatedBundesland = isBundesland && marketExplanationStandardLocale !== "de";
                const effectiveValue = String(entry?.value_text ?? "");
                const statusDraftKey = buildMarketExplanationStandardStatusDraftKey(marketExplanationStandardLocale, definition.key);
                const statusDraft = marketExplanationStandardStatusDrafts[statusDraftKey] ?? "draft";
                const hasStatusChange = isTranslatedBundesland && statusDraft !== (entry?.override_status ?? "draft");
                const isDirty = draftValue !== effectiveValue || hasStatusChange;
                return (
                  <div key={definition.key} style={{ border: "1px solid #dbe4ee", borderRadius: 8, padding: 10, background: "#fff" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                      <div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <div style={{ fontWeight: 700, color: "#0f172a" }}>
                            {getTextKeyLabel(definition.key, definition.key)}
                          </div>
                          {isBundesland ? (
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                letterSpacing: 0.3,
                                textTransform: "uppercase",
                                borderRadius: 999,
                                padding: "3px 8px",
                                background: definition.type === "individual" ? "#fef3c7" : "#e0f2fe",
                                color: definition.type === "individual" ? "#92400e" : "#075985",
                              }}
                            >
                              {definition.type === "individual" ? "Individual" : "General"}
                            </span>
                          ) : null}
                        </div>
                        <div style={mutedStyle}>
                          <code>{definition.key}</code>
                          {isBundesland
                            ? ` · ${isTranslatedBundesland
                              ? (hasOverride ? "Übersetzung aktiv" : "DE-Quelle aktiv")
                              : (hasOverride ? "Admin-Override aktiv" : "Basistext aktiv")}`
                            : ""}
                        </div>
                      </div>
                      <span style={{ ...mutedStyle, fontSize: 12 }}>
                        {isBundesland
                          ? isTranslatedBundesland
                            ? "Quelle: DE-Override plus Bundesland-i18n"
                            : "Quelle: Reportbasis mit Fallback aus text_standard_bundesland.json"
                          : "Quelle: deutsche Standarddatei für Systempartner"}
                      </span>
                    </div>
                    {isBundesland ? (
                      <div style={{ marginTop: 10, borderRadius: 8, background: "#f8fafc", padding: 10, border: "1px solid #e2e8f0" }}>
                        <div style={{ ...mutedStyle, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                          {isTranslatedBundesland ? "DE-Quelltext" : "Basistext"}
                        </div>
                        <div style={{ whiteSpace: "pre-wrap", color: "#334155", fontSize: 13 }}>
                          {baseValue || "Kein Basistext vorhanden."}
                        </div>
                      </div>
                    ) : null}
                    <textarea
                      style={{ ...inputStyle, minHeight: 120, marginTop: 10, resize: "vertical" }}
                      value={draftValue}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setMarketExplanationStandardDrafts((prev) => ({
                          ...prev,
                          [definition.key]: nextValue,
                        }));
                      }}
                    />
                    {isBundesland ? (
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
                        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                          {isTranslatedBundesland ? (
                            <>
                              <select
                                style={{ ...inputStyle, maxWidth: 180 }}
                                value={statusDraft}
                                onChange={(event) => {
                                  const nextStatus = String(event.target.value) as MarketExplanationStandardTranslationStatus;
                                  setMarketExplanationStandardStatusDrafts((prev) => ({
                                    ...prev,
                                    [statusDraftKey]: nextStatus,
                                  }));
                                }}
                              >
                                <option value="draft">entwurf</option>
                                <option value="internal">intern</option>
                                <option value="live">live</option>
                              </select>
                              <span style={{ ...mutedStyle, fontSize: 12 }}>
                                {entry?.translation_origin
                                  ? `${formatPortalTranslationOrigin(entry.translation_origin)}${entry.translation_is_stale ? " · DE geändert" : ""}`
                                  : "Noch keine Übersetzung gespeichert"}
                              </span>
                            </>
                          ) : (
                            <span style={{ ...mutedStyle, fontSize: 12 }}>
                              {hasOverride
                                ? `Override aktiv${entry?.override_updated_at ? ` · ${new Date(entry.override_updated_at).toLocaleString("de-DE")}` : ""}`
                                : "Noch kein Override gespeichert"}
                            </span>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button
                            style={btnGhostStyle}
                            disabled={busy || !marketExplanationStandardBundeslandSlug || !hasOverride}
                            onClick={() =>
                              run(`Bundesland-Text ${definition.key} zurücksetzen`, async () => {
                                await resetMarketExplanationStandardBundeslandKey(definition.key);
                              })
                            }
                          >
                            {isTranslatedBundesland ? "Auf DE zurücksetzen" : "Auf Standard zurücksetzen"}
                          </button>
                          {isTranslatedBundesland ? (
                            <>
                              <button
                                style={btnGhostStyle}
                                disabled={busy || !marketExplanationStandardBundeslandSlug}
                                onClick={() =>
                                  run(`Bundesland-Text ${definition.key} per KI übersetzen`, async () => {
                                    await translateMarketExplanationStandardBundeslandWithAi(marketExplanationStandardLocale, [definition.key]);
                                  })
                                }
                              >
                                Per KI übersetzen
                              </button>
                              <button
                                style={btnGhostStyle}
                                disabled={busy}
                                onClick={() => {
                                  setMarketExplanationStandardDrafts((prev) => ({
                                    ...prev,
                                    [definition.key]: baseValue,
                                  }));
                                  setMarketExplanationStandardStatusDrafts((prev) => ({
                                    ...prev,
                                    [statusDraftKey]: statusDraft === "live" ? "internal" : statusDraft,
                                  }));
                                }}
                              >
                                DE in Feld übernehmen
                              </button>
                            </>
                          ) : (
                            <button
                              style={btnGhostStyle}
                              disabled={busy || !marketExplanationStandardBundeslandSlug}
                              onClick={() =>
                                run(`Bundesland-Text ${definition.key} per KI überarbeiten`, async () => {
                                  await translateMarketExplanationStandardBundeslandWithAi("de", [definition.key]);
                                })
                              }
                            >
                              Per KI überarbeiten
                            </button>
                          )}
                          <button
                            style={btnStyle}
                            disabled={busy || !marketExplanationStandardBundeslandSlug || !isDirty}
                            onClick={() =>
                              run(`Bundesland-Text ${definition.key} speichern`, async () => {
                                await saveMarketExplanationStandardBundeslandKey(definition.key);
                              })
                            }
                          >
                            Speichern
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
              {activeMarketExplanationStandardDefinitions.length === 0 ? (
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 14, background: "#f8fafc", ...mutedStyle }}>
                  Für diesen Tab sind aktuell noch keine Standardtexte mit Text-Key hinterlegt.
                </div>
              ) : null}
            </div>
          ) : (
            <div style={{ marginTop: 14, display: "grid", gap: 14 }}>
              {activeMarketExplanationStaticDefinitions.map((definition) => {
                const draftKey = buildMarketExplanationStaticDraftKey(marketExplanationStaticLocale, definition.key);
                const draft = marketExplanationStaticDrafts[draftKey] ?? {
                  status: marketExplanationStaticLocale === "de" ? "live" as MarketExplanationStaticTextEntryStatus : "draft" as MarketExplanationStaticTextEntryStatus,
                  value_text: getMarketExplanationStaticTextDefaultValue(marketExplanationStaticLocale, definition.key),
                };
                const meta = marketExplanationStaticMetaMap.get(`${marketExplanationStaticLocale}::${definition.key}`) ?? null;
                return (
                  <div key={definition.key} style={{ border: "1px solid #dbe4ee", borderRadius: 8, padding: 10, background: "#fff" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                      <div>
                        <div style={{ fontWeight: 700, color: "#0f172a" }}>{definition.label}</div>
                        <div style={mutedStyle}>
                          <code>{definition.key}</code> · {definition.kind}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ ...mutedStyle, fontSize: 12 }}>
                          Status: <strong>{formatPortalEntryStatus(draft.status as PortalContentEntryStatus)}</strong>
                        </span>
                        {marketExplanationStaticLocale !== "de" && meta ? (
                          <span style={{ fontSize: 12, color: meta.translation_is_stale ? "#991b1b" : "#334155" }}>
                            {formatPortalTranslationOrigin(meta.translation_origin)}
                            {meta.translation_is_stale ? " · DE geändert" : ""}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <textarea
                      style={{ ...inputStyle, minHeight: 120, marginTop: 10, resize: "vertical" }}
                      value={draft.value_text}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setMarketExplanationStaticDrafts((prev) => ({
                          ...prev,
                          [draftKey]: {
                            ...draft,
                            value_text: nextValue,
                          },
                        }));
                      }}
                    />
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
                      <select
                        style={{ ...inputStyle, maxWidth: 180 }}
                        value={draft.status}
                        onChange={(event) => {
                          const nextStatus = String(event.target.value) as MarketExplanationStaticTextEntryStatus;
                          setMarketExplanationStaticDrafts((prev) => ({
                            ...prev,
                            [draftKey]: {
                              ...draft,
                              status: nextStatus,
                            },
                          }));
                        }}
                      >
                        <option value="draft">entwurf</option>
                        <option value="internal">intern</option>
                        <option value="live">live</option>
                      </select>
                      {marketExplanationStaticLocale !== "de" ? (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button
                            style={btnGhostStyle}
                            disabled={busy}
                            onClick={() =>
                              run(`Statischen Markttext ${definition.label} per KI übersetzen`, async () => {
                                await translateMarketExplanationStaticLocaleWithAi(marketExplanationStaticLocale, [definition.key]);
                              })
                            }
                          >
                            Per KI übersetzen
                          </button>
                          <button
                            style={btnGhostStyle}
                            disabled={busy}
                            onClick={() => {
                              const deDefault = (
                                marketExplanationStaticDrafts[buildMarketExplanationStaticDraftKey("de", definition.key)]?.value_text
                                ?? getMarketExplanationStaticTextDefaultValue("de", definition.key)
                              );
                              setMarketExplanationStaticDrafts((prev) => ({
                                ...prev,
                                [draftKey]: {
                                  status: draft.status === "live" ? "internal" : draft.status,
                                  value_text: deDefault,
                                },
                              }));
                            }}
                          >
                            DE in Feld übernehmen
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
              {activeMarketExplanationStaticDefinitions.length === 0 ? (
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 14, background: "#f8fafc", ...mutedStyle }}>
                  Für diesen Tab sind aktuell noch keine statischen Erklärungstexte ohne Text-Key hinterlegt.
                </div>
              ) : null}
            </div>
          )}
        </div>
      </section>
      ) : null}

      {activeView === "standard_text_refresh" ? (
      <section style={workspaceSectionStyle}>
        <h1 style={workspaceTitleStyle}>Standardtext-Refresh</h1>
        <p style={mutedStyle}>
          Verbesserte Standardtexte werden hier kontrolliert auf die Report-Basis angewendet. Overrides aus Partner- und Admin-Workflows bleiben unberührt, aktualisiert wird nur die Basis im Storage.
        </p>

        <div style={{ ...marketExplanationScopeBarStyle, marginTop: 14 }}>
          <button
            style={marketExplanationScopeButtonStyle(standardTextRefreshScope === "bundesland")}
            disabled={busy}
            onClick={() => setStandardTextRefreshScope("bundesland")}
          >
            Bundesland
          </button>
          <button
            style={marketExplanationScopeButtonStyle(standardTextRefreshScope === "kreis")}
            disabled={busy}
            onClick={() => setStandardTextRefreshScope("kreis")}
          >
            Kreis
          </button>
          <button
            style={marketExplanationScopeButtonStyle(standardTextRefreshScope === "kreis_ortslagen")}
            disabled={busy}
            onClick={() => setStandardTextRefreshScope("kreis_ortslagen")}
          >
            Kreis + Ortslagen
          </button>
          <button
            style={marketExplanationScopeButtonStyle(standardTextRefreshScope === "ortslage")}
            disabled={busy}
            onClick={() => setStandardTextRefreshScope("ortslage")}
          >
            Ortslage
          </button>
        </div>

        <div style={marketExplanationWorkspaceCardStyle}>
          <div style={{ display: "grid", gap: 14 }}>
            <div style={marketExplanationActionRowStyle}>
              <div style={marketExplanationActionGroupStyle}>
                <div style={{ fontWeight: 700, color: "#0f172a" }}>Standardquelle bearbeiten</div>
                <div style={marketExplanationScopeHintStyle}>
                  {standardTextRefreshSourceScope === "bundesland"
                    ? "Bearbeitet wird die Bundesland-Standarddatei im Storage."
                    : "Bearbeitet wird die Kreis-/Ortslagen-Standarddatei im Storage."}
                </div>
              </div>
              <div style={marketExplanationActionGroupStyle}>
                <button
                  style={btnGhostStyle}
                  disabled={busy}
                  onClick={() =>
                    run("Standardquelle neu laden", async () => {
                      await loadStandardTextSource(standardTextRefreshSourceScope);
                    })
                  }
                >
                  Neu laden
                </button>
                <button
                  style={btnStyle}
                  disabled={busy}
                  onClick={() =>
                    run("Standardquelle speichern", async () => {
                      await saveStandardTextSource(standardTextRefreshSourceScope);
                    })
                  }
                >
                  Standardquelle speichern
                </button>
              </div>
            </div>

            <div style={marketExplanationScopeHintStyle}>
              {standardTextRefreshSourceScope === "bundesland"
                ? "Quelle: text-standards/bundesland/text_standard_bundesland.json"
                : "Quelle: text-standards/kreis/text_standard_kreis.json"}
            </div>

            <div style={marketExplanationThemeTabBarStyle}>
              {standardTextSourceVisibleTabs.map((tab) => (
                <button
                  key={`source:${tab.id}`}
                  style={marketExplanationThemeTabButtonStyle(standardTextSourceTab === tab.label)}
                  onClick={() => setStandardTextSourceTab(tab.label)}
                >
                  <span style={marketExplanationThemeTabLabelStyle}>{tab.label}</span>
                  <span style={marketExplanationThemeTabCountStyle}>
                    {standardTextSourceDefinitions.filter((definition) => definition.tab === tab.id).length}
                  </span>
                </button>
              ))}
            </div>

            <div style={{ display: "grid", gap: 14 }}>
              {activeStandardTextSourceDefinitions.map((definition) => (
                <div key={`source:${definition.key}`} style={{ border: "1px solid #dbe4ee", borderRadius: 8, padding: 10, background: "#fff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <div style={{ fontWeight: 700, color: "#0f172a" }}>
                          {getTextKeyLabel(definition.key, definition.key)}
                        </div>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: 0.3,
                            textTransform: "uppercase",
                            borderRadius: 999,
                            padding: "3px 8px",
                            background: definition.type === "individual" ? "#fef3c7" : "#e0f2fe",
                            color: definition.type === "individual" ? "#92400e" : "#075985",
                          }}
                        >
                          {definition.type === "individual" ? "Individual" : "General"}
                        </span>
                      </div>
                      <div style={mutedStyle}>
                        <code>{definition.key}</code>
                      </div>
                    </div>
                  </div>
                  <textarea
                    style={{ ...inputStyle, minHeight: 120, marginTop: 10, resize: "vertical" }}
                    value={standardTextSourceDrafts[definition.key] ?? ""}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setStandardTextSourceDrafts((prev) => ({
                        ...prev,
                        [definition.key]: nextValue,
                      }));
                    }}
                  />
                </div>
              ))}
              {activeStandardTextSourceDefinitions.length === 0 ? (
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 14, background: "#f8fafc", ...mutedStyle }}>
                  Für diesen Tab sind aktuell keine editierbaren Standardtexte in der Quelle hinterlegt.
                </div>
              ) : null}
            </div>
          </div>

          <div style={{ height: 1, background: "#e2e8f0", margin: "18px 0" }} />

          {standardTextRefreshScope === "bundesland" ? (
            <>
              <div style={marketExplanationActionRowStyle}>
                <div style={marketExplanationActionGroupStyle}>
                  <div style={marketExplanationScopeHintStyle}>
                    Quelle: <code>text-standards/bundesland/text_standard_bundesland.json</code>
                  </div>
                  <div style={marketExplanationScopeHintStyle}>
                    Ziel: <code>reports/deutschland/&lt;bundesland&gt;.json</code>
                  </div>
                </div>
                <button
                  style={btnGhostStyle}
                  disabled={busy}
                  onClick={() =>
                    run("Bundesländer neu laden", async () => {
                      await loadMarketExplanationBundeslaender();
                    })
                  }
                >
                  Neu laden
                </button>
              </div>

              <div style={marketExplanationBundeslandBarStyle}>
                {marketExplanationStandardBundeslaender.map((bundesland) => (
                  <button
                    key={bundesland.slug}
                    style={marketExplanationBundeslandButtonStyle(standardTextRefreshBundeslandSlug === bundesland.slug)}
                    onClick={() => setStandardTextRefreshBundeslandSlug(bundesland.slug)}
                  >
                    {bundesland.name}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              <div style={marketExplanationActionRowStyle}>
                <div style={marketExplanationActionGroupStyle}>
                  <div style={marketExplanationScopeHintStyle}>
                    Quelle: <code>text-standards/kreis/text_standard_kreis.json</code>
                  </div>
                  <div style={marketExplanationScopeHintStyle}>
                    Ziel: <code>reports/deutschland/&lt;bundesland&gt;/...json</code>
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gap: 10, maxWidth: 760 }}>
                <input
                  style={inputStyle}
                  value={standardTextRefreshAreaQuery}
                  placeholder={standardTextRefreshScope === "ortslage" ? "Ortslage suchen" : "Kreis oder Gebiet suchen"}
                  onChange={(event) => setStandardTextRefreshAreaQuery(event.target.value)}
                />
                {standardTextRefreshAreaOptions.length > 0 ? (
                  <div style={standardTextRefreshSearchResultsStyle}>
                    {standardTextRefreshAreaOptions.map((area) => {
                      const active = standardTextRefreshSelection?.id === area.id;
                      const isKreis = isKreisAreaOption(area);
                      return (
                        <button
                          key={area.id}
                          type="button"
                          style={standardTextRefreshSearchResultButtonStyle(active)}
                          onClick={() => {
                            setStandardTextRefreshSelection({
                              id: area.id,
                              name: area.name ?? area.id,
                              slug: area.slug ?? null,
                              parent_slug: area.parent_slug ?? null,
                              bundesland_slug: area.bundesland_slug ?? null,
                            });
                            setStandardTextRefreshAreaOptions([]);
                            setStandardTextRefreshAreaQuery(formatAreaOptionLabel(area));
                          }}
                        >
                          <span style={{ fontWeight: 700, color: "#0f172a" }}>{formatAreaOptionLabel(area)}</span>
                          <span style={{ fontSize: 12, color: "#64748b" }}>
                            {isKreis ? "Kreis" : "Ortslage"}{area.slug ? ` · ${area.slug}` : ""}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
                {standardTextRefreshSelection ? (
                  <div style={standardTextRefreshSelectionCardStyle}>
                    <div style={{ fontWeight: 700, color: "#0f172a" }}>{formatAreaOptionLabel(standardTextRefreshSelection)}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>
                      {isKreisAreaOption(standardTextRefreshSelection) ? "Kreis" : "Ortslage"}
                      {standardTextRefreshSelection.slug ? ` · ${standardTextRefreshSelection.slug}` : ""}
                      {standardTextRefreshSelection.bundesland_slug ? ` · ${standardTextRefreshSelection.bundesland_slug}` : ""}
                    </div>
                  </div>
                ) : (
                  <div style={marketExplanationScopeHintStyle}>Noch kein Gebiet ausgewählt.</div>
                )}
              </div>
            </div>
          )}

          <div style={{ ...marketExplanationActionRowStyle, marginTop: 16 }}>
            <div style={marketExplanationScopeHintStyle}>
              {standardTextRefreshScope === "bundesland"
                ? "Bundesland-Refresh überschreibt allgemeine und individuelle Standardtexte in der Basisdatei."
                : standardTextRefreshScope === "ortslage"
                  ? "Ortslagen-Refresh überschreibt nur standardfähige General-Texte."
                  : standardTextRefreshScope === "kreis_ortslagen"
                    ? "Kreis und zugehörige Ortslagen werden gemeinsam aus der Kreis-Standarddatei aktualisiert."
                    : "Kreis-Refresh überschreibt nur standardfähige General-Texte."}
            </div>
            <div style={marketExplanationActionGroupStyle}>
              <button
                style={btnGhostStyle}
                disabled={busy}
                onClick={() =>
                  run("Standardtext-Refresh analysieren", async () => {
                    await runStandardTextRefresh(true);
                  })
                }
              >
                Analyse (Dry-Run)
              </button>
              <button
                style={btnStyle}
                disabled={busy}
                onClick={() =>
                  run("Standardtext-Basis aktualisieren", async () => {
                    await runStandardTextRefresh(false);
                  })
                }
              >
                Standardtexte anwenden
              </button>
            </div>
          </div>

          {standardTextRefreshSummary ? (
            <div style={standardTextRefreshSummaryStyle}>
              <strong>{standardTextRefreshSummary.dryRun ? "Dry-Run" : "Anwendung"}</strong>
              <span>Gesamt: {standardTextRefreshSummary.total}</span>
              <span>Aktualisiert: {standardTextRefreshSummary.updated}</span>
              <span>Übersprungen: {standardTextRefreshSummary.skipped}</span>
              <span>Fehler: {standardTextRefreshSummary.failed}</span>
            </div>
          ) : null}

          {standardTextRefreshResults.length > 0 ? (
            <div style={{ marginTop: 14 }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Gebiet</th>
                    <th style={thStyle}>Report</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Keys</th>
                    <th style={thStyle}>Hinweis</th>
                  </tr>
                </thead>
                <tbody>
                  {standardTextRefreshResults.map((row) => (
                    <tr key={`${row.area_id}:${row.report_path}`}>
                      <td style={tdStyle}>{row.area_id}</td>
                      <td style={tdStyle}><code>{row.report_path}</code></td>
                      <td style={tdStyle}>{row.status}</td>
                      <td style={tdStyle}>{Number(row.changed_keys ?? 0)}</td>
                      <td style={tdStyle}>{formatStandardTextRefreshReason(row.reason)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </section>
      ) : null}

      {activeView === "portal_cms" ? (
      <section style={workspaceSectionStyle}>
        <h1 style={workspaceTitleStyle}>Portal-CMS</h1>
        <p style={mutedStyle}>
          Globale Portalinhalte pro Bereich und Locale pflegen.
        </p>

        <div style={{ marginTop: 12, padding: 12, border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff" }}>
          <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>Statische Portalbereiche</div>
          <div style={partnerTabBarStyle}>
            {portalCmsPages.map((page) => (
              <button
                key={page.page_key}
                style={partnerTabButtonStyle(portalCmsPageKey === page.page_key)}
                onClick={() => setPortalCmsPageKey(page.page_key)}
              >
                {page.label}
              </button>
            ))}
          </div>

          <div style={{ ...grid2Style, marginTop: 14 }}>
            <label>
              Bearbeitungs-Locale
              <select
                style={inputStyle}
                value={portalCmsLocale}
                onChange={(e) => setPortalCmsLocale(e.target.value)}
              >
                {(activePortalLocales.length > 0 ? activePortalLocales : portalLocaleConfigs).map((row) => (
                  <option key={row.locale} value={row.locale}>
                    {row.locale} · {formatPortalLocaleStatus(row.status)}
                  </option>
                ))}
              </select>
            </label>
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 10px", background: "#f8fafc" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>
                {selectedPortalCmsPage?.label ?? "Bereich"}
              </div>
              <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.5 }}>
                {selectedPortalCmsPage?.note ?? "Kein Portalbereich gewaehlt."}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10, alignItems: "center" }}>
            <button
              type="button"
              style={btnSuccessGhostStyle}
              disabled={busy || !selectedPortalCmsPage || !portalCmsLocale || portalCmsLocale === PORTAL_CMS_SOURCE_LOCALE}
              onClick={() =>
                run("Fehlende Portal-Inhalte aus DE ergänzen", async () => {
                  await syncSelectedPortalCmsPageFromDe("fill_missing");
                })
              }
            >
              Aus DE ergänzen
            </button>
            <button
              type="button"
              style={btnSuccessGhostStyle}
              disabled={busy || !selectedPortalCmsPage || !portalCmsLocale || portalCmsLocale === PORTAL_CMS_SOURCE_LOCALE}
              onClick={() =>
                run("Portal-Seite komplett aus DE uebernehmen", async () => {
                  await syncSelectedPortalCmsPageFromDe("copy_all");
                })
              }
            >
              DE komplett übernehmen
            </button>
            <button
              type="button"
              style={btnGhostStyle}
              disabled={busy || !selectedPortalCmsPage || !portalCmsLocale || portalCmsLocale === PORTAL_CMS_SOURCE_LOCALE}
              onClick={() =>
                run("Leere Portal-Felder per KI fuellen", async () => {
                  await translateSelectedPortalCmsPageMissingFromDe();
                })
              }
            >
              Leere Felder per KI
            </button>
            <div style={{ fontSize: 12, color: "#64748b" }}>
              {portalCmsLocale === PORTAL_CMS_SOURCE_LOCALE
                ? "DE ist die Basissprache. Sync- und KI-Uebersetzung laufen nur in Ziel-Locales."
                : "Automatische Sync- und KI-Laeufe setzen geaenderte Inhalte auf Entwurf/Intern zurueck und markieren ihre DE-Quelle."}
            </div>
          </div>

          {selectedPortalCmsPage ? (
            <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
              {selectedPortalCmsPage.sections.map((section) => {
                const draftKey = `${portalCmsLocale}::${selectedPortalCmsPage.page_key}::${section.section_key}`;
                const draft = portalCmsDrafts[draftKey] ?? {
                  status: "draft" as PortalContentEntryStatus,
                  fields_json: buildPortalCmsEmptyFields(section),
                };
                const sectionMeta = portalContentMetaMap.get(`${selectedPortalCmsPage.page_key}::${section.section_key}::${portalCmsLocale}`) ?? null;
                return (
                  <div
                    key={section.section_key}
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: 10,
                      padding: 12,
                      background: "#f8fafc",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", marginBottom: 10 }}>
                      <div>
                        <div style={{ fontWeight: 700, color: "#0f172a" }}>{section.label}</div>
                        <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.5 }}>{section.description}</div>
                        {portalCmsLocale !== PORTAL_CMS_SOURCE_LOCALE ? (
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                            {sectionMeta ? (
                              <span style={{ fontSize: 11, color: "#334155", background: "#e2e8f0", borderRadius: 999, padding: "3px 8px" }}>
                                Herkunft: {formatPortalTranslationOrigin(sectionMeta.translation_origin)}
                              </span>
                            ) : null}
                            {sectionMeta?.source_locale ? (
                              <span style={{ fontSize: 11, color: "#334155", background: "#e2e8f0", borderRadius: 999, padding: "3px 8px" }}>
                                Quelle: {sectionMeta.source_locale.toUpperCase()}
                              </span>
                            ) : null}
                            {sectionMeta?.is_stale ? (
                              <span style={{ fontSize: 11, color: "#991b1b", background: "#fee2e2", borderRadius: 999, padding: "3px 8px" }}>
                                DE seitdem geändert
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                      <div style={{ minWidth: 140, display: "grid", gap: 8 }}>
                        <select
                          style={inputStyle}
                          value={draft.status}
                          onChange={(e) => {
                            const nextStatus = String(e.target.value) as PortalContentEntryStatus;
                            setPortalCmsDrafts((prev) => ({
                              ...prev,
                              [draftKey]: {
                                ...draft,
                                status: nextStatus,
                              },
                            }));
                          }}
                        >
                          <option value="draft">Entwurf</option>
                          <option value="internal">Intern</option>
                          <option value="live">Live</option>
                        </select>
                        <button
                          type="button"
                          style={{ ...btnGhostStyle, padding: "6px 8px", fontSize: 12 }}
                          disabled={busy || portalCmsLocale === PORTAL_CMS_SOURCE_LOCALE}
                          onClick={() =>
                            run("Leere Section-Felder per KI fuellen", async () => {
                              await translatePortalCmsSectionFromDe({
                                section,
                                applyMode: "fill_missing",
                              });
                            })
                          }
                        >
                          Leere Felder per KI
                        </button>
                      </div>
                    </div>

                    <div style={{ display: "grid", gap: 10 }}>
                      {section.fields.map((field) => {
                        if (field.type === "content_wraps") {
                          const draftKey = `${portalCmsLocale}::${selectedPortalCmsPage.page_key}::${section.section_key}`;
                          const draft = portalCmsDrafts[draftKey] ?? {
                            status: "draft" as PortalContentEntryStatus,
                            fields_json: buildPortalCmsEmptyFields(section),
                          };
                          const wraps = parsePortalContentWraps(String(draft.fields_json[field.key] ?? "[]"));
                          const updateWraps = (nextWraps: PortalContentWrap[]) => {
                            setPortalCmsDrafts((prev) => ({
                              ...prev,
                              [draftKey]: {
                                ...(prev[draftKey] ?? draft),
                                fields_json: {
                                  ...((prev[draftKey]?.fields_json ?? draft.fields_json)),
                                  [field.key]: serializePortalContentWraps(nextWraps),
                                },
                              },
                            }));
                          };
                          return (
                            <div key={field.key}>
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>{field.label}</div>
                                <button
                                  type="button"
                                  style={{ ...btnGhostStyle, padding: "6px 8px", fontSize: 12 }}
                                  disabled={busy || portalCmsLocale === PORTAL_CMS_SOURCE_LOCALE}
                                  onClick={() =>
                                    run("Content-Wraps per KI uebersetzen", async () => {
                                      await translatePortalCmsSectionFromDe({
                                        section,
                                        fieldKey: field.key,
                                        applyMode: "overwrite",
                                      });
                                    })
                                  }
                                >
                                  Aus DE via KI
                                </button>
                              </div>
                              {field.help ? (
                                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>{field.help}</div>
                              ) : null}
                              <div style={{ display: "grid", gap: 12 }}>
                                {wraps.length === 0 ? (
                                  <div
                                    style={{
                                      border: "1px dashed #cbd5e1",
                                      borderRadius: 8,
                                      padding: 12,
                                      background: "#fff",
                                      display: "grid",
                                      gap: 10,
                                    }}
                                  >
                                    <div style={{ fontSize: 13, color: "#475569" }}>
                                      Noch keine Content-Wraps angelegt.
                                    </div>
                                    <div>
                                      <button
                                        type="button"
                                        style={btnGhostStyle}
                                        onClick={() => updateWraps([createEmptyPortalWrap()])}
                                      >
                                        Inhaltsbereich anlegen
                                      </button>
                                    </div>
                                  </div>
                                ) : null}

                                {wraps.map((wrap, wrapIdx) => (
                                  <div
                                    key={`${field.key}:${wrap.id}:${wrapIdx}`}
                                    style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: 12, background: "#fff", display: "grid", gap: 10 }}
                                  >
                                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
                                      <div style={{ flex: "1 1 280px" }}>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>Bereichstitel</div>
                                        <input
                                          style={inputStyle}
                                          value={wrap.title}
                                          placeholder="z. B. Einleitung"
                                          onChange={(e) => {
                                            const nextValue = e.target.value;
                                            updateWraps(wraps.map((item, itemIdx) => (
                                              itemIdx === wrapIdx ? { ...item, title: nextValue } : item
                                            )));
                                          }}
                                        />
                                        <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, fontSize: 12, color: "#334155" }}>
                                          <input
                                            type="checkbox"
                                            checked={wrap.show_title === true}
                                            onChange={(e) => {
                                              const checked = e.target.checked;
                                              updateWraps(wraps.map((item, itemIdx) => (
                                                itemIdx === wrapIdx ? { ...item, show_title: checked } : item
                                              )));
                                            }}
                                          />
                                          Bereichstitel einblenden
                                        </label>
                                      </div>
                                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                        <button
                                          type="button"
                                          style={btnGhostStyle}
                                          disabled={wrapIdx === 0}
                                          onClick={() => {
                                            const nextWraps = [...wraps];
                                            [nextWraps[wrapIdx - 1], nextWraps[wrapIdx]] = [nextWraps[wrapIdx], nextWraps[wrapIdx - 1]];
                                            updateWraps(nextWraps);
                                          }}
                                        >
                                          Nach oben
                                        </button>
                                        <button
                                          type="button"
                                          style={btnGhostStyle}
                                          disabled={wrapIdx === wraps.length - 1}
                                          onClick={() => {
                                            const nextWraps = [...wraps];
                                            [nextWraps[wrapIdx + 1], nextWraps[wrapIdx]] = [nextWraps[wrapIdx], nextWraps[wrapIdx + 1]];
                                            updateWraps(nextWraps);
                                          }}
                                        >
                                          Nach unten
                                        </button>
                                        <button
                                          type="button"
                                          style={btnDangerStyle}
                                          onClick={() => updateWraps(wraps.filter((_, itemIdx) => itemIdx !== wrapIdx))}
                                        >
                                          Bereich löschen
                                        </button>
                                      </div>
                                    </div>

                                    <div style={{ display: "grid", gap: 10 }}>
                                      {wrap.blocks.length === 0 ? (
                                        <div style={{ border: "1px dashed #cbd5e1", borderRadius: 8, padding: 10, background: "#f8fafc", display: "grid", gap: 8 }}>
                                          <div style={{ fontSize: 12, color: "#475569" }}>Noch keine Textblöcke angelegt.</div>
                                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                            {(["heading", "paragraph"] as PortalWrapBlockType[]).map((type) => (
                                              <button
                                                key={`${field.key}:${wrap.id}:empty:${type}`}
                                                type="button"
                                                style={btnGhostStyle}
                                                onClick={() => updateWraps(wraps.map((item, itemIdx) => (
                                                  itemIdx === wrapIdx
                                                    ? { ...item, blocks: [createEmptyPortalWrapBlock(type)] }
                                                    : item
                                                )))}
                                              >
                                                {formatPortalWrapBlockTypeLabel(type)} hinzufügen
                                              </button>
                                            ))}
                                          </div>
                                        </div>
                                      ) : null}

                                      {wrap.blocks.map((block, blockIdx) => (
                                        <div
                                          key={`${field.key}:${wrap.id}:block:${blockIdx}`}
                                          style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 10, background: "#f8fafc", display: "grid", gap: 8 }}
                                        >
                                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                              <select
                                                style={{ ...inputStyle, minWidth: 170 }}
                                                value={block.type}
                                                onChange={(e) => {
                                                  const nextType = String(e.target.value) as PortalWrapBlockType;
                                                  updateWraps(wraps.map((item, itemIdx) => (
                                                    itemIdx === wrapIdx
                                                      ? {
                                                          ...item,
                                                          blocks: item.blocks.map((entry, entryIdx) => (
                                                            entryIdx === blockIdx ? createEmptyPortalWrapBlock(nextType) : entry
                                                          )),
                                                        }
                                                      : item
                                                  )));
                                                }}
                                              >
                                                <option value="heading">Überschrift</option>
                                                <option value="paragraph">Absatz</option>
                                              </select>
                                              <span style={{ fontSize: 12, color: "#64748b" }}>{formatPortalWrapBlockTypeLabel(block.type)}</span>
                                            </div>
                                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                              <button
                                                type="button"
                                                style={btnGhostStyle}
                                                disabled={blockIdx === 0}
                                                onClick={() => {
                                                  updateWraps(wraps.map((item, itemIdx) => {
                                                    if (itemIdx !== wrapIdx) return item;
                                                    const nextBlocks = [...item.blocks];
                                                    [nextBlocks[blockIdx - 1], nextBlocks[blockIdx]] = [nextBlocks[blockIdx], nextBlocks[blockIdx - 1]];
                                                    return { ...item, blocks: nextBlocks };
                                                  }));
                                                }}
                                              >
                                                Nach oben
                                              </button>
                                              <button
                                                type="button"
                                                style={btnGhostStyle}
                                                disabled={blockIdx === wrap.blocks.length - 1}
                                                onClick={() => {
                                                  updateWraps(wraps.map((item, itemIdx) => {
                                                    if (itemIdx !== wrapIdx) return item;
                                                    const nextBlocks = [...item.blocks];
                                                    [nextBlocks[blockIdx + 1], nextBlocks[blockIdx]] = [nextBlocks[blockIdx], nextBlocks[blockIdx + 1]];
                                                    return { ...item, blocks: nextBlocks };
                                                  }));
                                                }}
                                              >
                                                Nach unten
                                              </button>
                                              <button
                                                type="button"
                                                style={btnDangerStyle}
                                                onClick={() => {
                                                  updateWraps(wraps.map((item, itemIdx) => (
                                                    itemIdx === wrapIdx
                                                      ? { ...item, blocks: item.blocks.filter((_, entryIdx) => entryIdx !== blockIdx) }
                                                      : item
                                                  )));
                                                }}
                                              >
                                                Block löschen
                                              </button>
                                            </div>
                                          </div>

                                          {block.type === "heading" ? (
                                            <div style={{ display: "grid", gap: 8 }}>
                                              <select
                                                style={{ ...inputStyle, maxWidth: 180 }}
                                                value={String(block.level)}
                                                onChange={(e) => {
                                                  const nextLevel = Number(e.target.value);
                                                  updateWraps(wraps.map((item, itemIdx) => (
                                                    itemIdx === wrapIdx
                                                      ? {
                                                          ...item,
                                                          blocks: item.blocks.map((entry, entryIdx) => (
                                                            entryIdx === blockIdx && entry.type === "heading"
                                                              ? { ...entry, level: nextLevel === 1 || nextLevel === 3 ? nextLevel : 2 }
                                                              : entry
                                                          )),
                                                        }
                                                      : item
                                                  )));
                                                }}
                                              >
                                                <option value="1">H1</option>
                                                <option value="2">H2</option>
                                                <option value="3">H3</option>
                                              </select>
                                              <input
                                                style={inputStyle}
                                                value={block.text}
                                                placeholder="Überschrift"
                                                onChange={(e) => {
                                                  const nextValue = e.target.value;
                                                  updateWraps(wraps.map((item, itemIdx) => (
                                                    itemIdx === wrapIdx
                                                      ? {
                                                          ...item,
                                                          blocks: item.blocks.map((entry, entryIdx) => (
                                                            entryIdx === blockIdx && entry.type === "heading"
                                                              ? { ...entry, text: nextValue }
                                                              : entry
                                                          )),
                                                        }
                                                      : item
                                                  )));
                                                }}
                                              />
                                            </div>
                                          ) : (
                                            <textarea
                                              style={{ ...inputStyle, minHeight: 120, resize: "vertical" }}
                                              value={block.text}
                                              placeholder="Absatztext"
                                              onChange={(e) => {
                                                const nextValue = e.target.value;
                                                updateWraps(wraps.map((item, itemIdx) => (
                                                  itemIdx === wrapIdx
                                                    ? {
                                                        ...item,
                                                        blocks: item.blocks.map((entry, entryIdx) => (
                                                          entryIdx === blockIdx && entry.type === "paragraph"
                                                            ? { ...entry, text: nextValue }
                                                            : entry
                                                        )),
                                                      }
                                                    : item
                                                )));
                                              }}
                                            />
                                          )}
                                        </div>
                                      ))}

                                      {wrap.blocks.length > 0 ? (
                                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                          {(["heading", "paragraph"] as PortalWrapBlockType[]).map((type) => (
                                            <button
                                              key={`${field.key}:${wrap.id}:add:${type}`}
                                              type="button"
                                              style={btnGhostStyle}
                                              onClick={() => updateWraps(wraps.map((item, itemIdx) => (
                                                itemIdx === wrapIdx
                                                  ? { ...item, blocks: [...item.blocks, createEmptyPortalWrapBlock(type)] }
                                                  : item
                                              )))}
                                            >
                                              {formatPortalWrapBlockTypeLabel(type)} hinzufügen
                                            </button>
                                          ))}
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                ))}

                                {wraps.length > 0 ? (
                                  <div>
                                    <button
                                      type="button"
                                      style={btnGhostStyle}
                                      onClick={() => updateWraps([...wraps, createEmptyPortalWrap()])}
                                    >
                                      Weiteren Inhaltsbereich anlegen
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          );
                        }

                        if (field.type === "block_content") {
                          const draftKey = `${portalCmsLocale}::${selectedPortalCmsPage.page_key}::${section.section_key}`;
                          const draft = portalCmsDrafts[draftKey] ?? {
                            status: "draft" as PortalContentEntryStatus,
                            fields_json: buildPortalCmsEmptyFields(section),
                          };
                          const blocks = parsePortalContentBlocks(String(draft.fields_json[field.key] ?? "[]"));
                          const updateBlocks = (nextBlocks: PortalContentBlock[]) => {
                            setPortalCmsDrafts((prev) => ({
                              ...prev,
                              [draftKey]: {
                                ...(prev[draftKey] ?? draft),
                                fields_json: {
                                  ...((prev[draftKey]?.fields_json ?? draft.fields_json)),
                                  [field.key]: serializePortalContentBlocks(nextBlocks),
                                },
                              },
                            }));
                          };
                          return (
                            <div key={field.key}>
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>{field.label}</div>
                                <button
                                  type="button"
                                  style={{ ...btnGhostStyle, padding: "6px 8px", fontSize: 12 }}
                                  disabled={busy || portalCmsLocale === PORTAL_CMS_SOURCE_LOCALE}
                                  onClick={() =>
                                    run("Block-Content per KI uebersetzen", async () => {
                                      await translatePortalCmsSectionFromDe({
                                        section,
                                        fieldKey: field.key,
                                        applyMode: "overwrite",
                                      });
                                    })
                                  }
                                >
                                  Aus DE via KI
                                </button>
                              </div>
                              {field.help ? (
                                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>{field.help}</div>
                              ) : null}
                              <div style={{ display: "grid", gap: 10 }}>
                                {blocks.length === 0 ? (
                                  <div
                                    style={{
                                      border: "1px dashed #cbd5e1",
                                      borderRadius: 8,
                                      padding: 12,
                                      background: "#fff",
                                      display: "grid",
                                      gap: 10,
                                    }}
                                  >
                                    <div style={{ fontSize: 13, color: "#475569" }}>
                                      Noch keine Inhaltsblöcke angelegt.
                                    </div>
                                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                      {(["heading", "paragraph", "list", "link_list", "contact", "note"] as PortalBlockType[]).map((type) => (
                                        <button
                                          key={`${field.key}:empty:add:${type}`}
                                          type="button"
                                          style={btnGhostStyle}
                                          onClick={() => updateBlocks([createEmptyPortalBlock(type)])}
                                        >
                                          {formatPortalBlockTypeLabel(type)} hinzufügen
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                ) : null}
                                {blocks.map((block, blockIdx) => (
                                  <div
                                    key={`${field.key}:${blockIdx}`}
                                    style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: 10, background: "#fff" }}
                                  >
                                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                        <select
                                          style={{ ...inputStyle, minWidth: 170 }}
                                          value={block.type}
                                          onChange={(e) => {
                                            const nextType = String(e.target.value) as PortalBlockType;
                                            updateBlocks(blocks.map((item, itemIdx) => itemIdx === blockIdx ? createEmptyPortalBlock(nextType) : item));
                                          }}
                                        >
                                          <option value="heading">Überschrift</option>
                                          <option value="paragraph">Absatz</option>
                                          <option value="list">Liste</option>
                                          <option value="link_list">Linkliste</option>
                                          <option value="contact">Kontaktblock</option>
                                          <option value="note">Hinweis</option>
                                        </select>
                                        <span style={{ fontSize: 12, color: "#64748b" }}>{formatPortalBlockTypeLabel(block.type)}</span>
                                      </div>
                                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                        <button
                                          type="button"
                                          style={btnGhostStyle}
                                          disabled={blockIdx === 0}
                                          onClick={() => {
                                            const nextBlocks = [...blocks];
                                            [nextBlocks[blockIdx - 1], nextBlocks[blockIdx]] = [nextBlocks[blockIdx], nextBlocks[blockIdx - 1]];
                                            updateBlocks(nextBlocks);
                                          }}
                                        >
                                          Nach oben
                                        </button>
                                        <button
                                          type="button"
                                          style={btnGhostStyle}
                                          disabled={blockIdx === blocks.length - 1}
                                          onClick={() => {
                                            const nextBlocks = [...blocks];
                                            [nextBlocks[blockIdx + 1], nextBlocks[blockIdx]] = [nextBlocks[blockIdx], nextBlocks[blockIdx + 1]];
                                            updateBlocks(nextBlocks);
                                          }}
                                        >
                                          Nach unten
                                        </button>
                                        <button
                                          type="button"
                                          style={btnDangerStyle}
                                          onClick={() => {
                                            updateBlocks(blocks.filter((_, itemIdx) => itemIdx !== blockIdx));
                                          }}
                                        >
                                          Block löschen
                                        </button>
                                      </div>
                                    </div>

                                    {block.type === "heading" ? (
                                      <div style={{ display: "grid", gap: 8 }}>
                                        <select
                                          style={{ ...inputStyle, maxWidth: 180 }}
                                          value={String(block.level)}
                                          onChange={(e) => {
                                            const nextLevel = Number(e.target.value);
                                            updateBlocks(blocks.map((item, itemIdx) => (
                                              itemIdx === blockIdx && item.type === "heading"
                                                ? { ...item, level: nextLevel === 1 || nextLevel === 3 ? nextLevel : 2 }
                                                : item
                                            )));
                                          }}
                                        >
                                          <option value="1">H1</option>
                                          <option value="2">H2</option>
                                          <option value="3">H3</option>
                                        </select>
                                        <input
                                          style={inputStyle}
                                          value={block.text}
                                          placeholder="Überschrift"
                                          onChange={(e) => {
                                            const nextValue = e.target.value;
                                            updateBlocks(blocks.map((item, itemIdx) => (
                                              itemIdx === blockIdx && item.type === "heading"
                                                ? { ...item, text: nextValue }
                                                : item
                                            )));
                                          }}
                                        />
                                      </div>
                                    ) : null}

                                    {block.type === "paragraph" ? (
                                      <textarea
                                        style={{ ...inputStyle, minHeight: 120, resize: "vertical" }}
                                        value={block.text}
                                        placeholder="Absatztext"
                                        onChange={(e) => {
                                          const nextValue = e.target.value;
                                          updateBlocks(blocks.map((item, itemIdx) => (
                                            itemIdx === blockIdx && item.type === "paragraph"
                                              ? { ...item, text: nextValue }
                                              : item
                                          )));
                                        }}
                                      />
                                    ) : null}

                                    {block.type === "list" ? (
                                      <div style={{ display: "grid", gap: 8 }}>
                                        <select
                                          style={{ ...inputStyle, maxWidth: 180 }}
                                          value={block.style}
                                          onChange={(e) => {
                                            const nextStyle = String(e.target.value) === "ordered" ? "ordered" : "unordered";
                                            updateBlocks(blocks.map((item, itemIdx) => (
                                              itemIdx === blockIdx && item.type === "list"
                                                ? { ...item, style: nextStyle }
                                                : item
                                            )));
                                          }}
                                        >
                                          <option value="unordered">Aufzählung</option>
                                          <option value="ordered">Nummeriert</option>
                                        </select>
                                        {block.items.map((item, itemIdx) => (
                                          <div key={`${field.key}:${blockIdx}:item:${itemIdx}`} style={{ display: "flex", gap: 8 }}>
                                            <input
                                              style={inputStyle}
                                              value={item}
                                              placeholder={`Listenpunkt ${itemIdx + 1}`}
                                              onChange={(e) => {
                                                const nextValue = e.target.value;
                                                updateBlocks(blocks.map((entry, entryIdx) => (
                                                  entryIdx === blockIdx && entry.type === "list"
                                                    ? {
                                                      ...entry,
                                                      items: entry.items.map((line, lineIdx) => lineIdx === itemIdx ? nextValue : line),
                                                    }
                                                    : entry
                                                )));
                                              }}
                                            />
                                            <button
                                              type="button"
                                              style={btnDangerStyle}
                                              onClick={() => {
                                                updateBlocks(blocks.map((entry, entryIdx) => (
                                                  entryIdx === blockIdx && entry.type === "list"
                                                    ? { ...entry, items: entry.items.filter((_, lineIdx) => lineIdx !== itemIdx) }
                                                    : entry
                                                )));
                                              }}
                                            >
                                              Entfernen
                                            </button>
                                          </div>
                                        ))}
                                        <button
                                          type="button"
                                          style={btnGhostStyle}
                                          onClick={() => {
                                            updateBlocks(blocks.map((entry, entryIdx) => (
                                              entryIdx === blockIdx && entry.type === "list"
                                                ? { ...entry, items: [...entry.items, ""] }
                                                : entry
                                            )));
                                          }}
                                        >
                                          Listenpunkt hinzufügen
                                        </button>
                                      </div>
                                    ) : null}

                                    {block.type === "link_list" ? (
                                      <div style={{ display: "grid", gap: 8 }}>
                                        {block.items.map((item, itemIdx) => (
                                          <div key={`${field.key}:${blockIdx}:link:${itemIdx}`} style={{ display: "grid", gap: 8, border: "1px solid #e2e8f0", borderRadius: 8, padding: 8 }}>
                                            <input
                                              style={inputStyle}
                                              value={item.label}
                                              placeholder="Linktext"
                                              onChange={(e) => {
                                                const nextValue = e.target.value;
                                                updateBlocks(blocks.map((entry, entryIdx) => (
                                                  entryIdx === blockIdx && entry.type === "link_list"
                                                    ? {
                                                      ...entry,
                                                      items: entry.items.map((linkRow, linkIdx) => linkIdx === itemIdx ? { ...linkRow, label: nextValue } : linkRow),
                                                    }
                                                    : entry
                                                )));
                                              }}
                                            />
                                            <input
                                              style={inputStyle}
                                              value={item.href}
                                              placeholder="https://..."
                                              onChange={(e) => {
                                                const nextValue = e.target.value;
                                                updateBlocks(blocks.map((entry, entryIdx) => (
                                                  entryIdx === blockIdx && entry.type === "link_list"
                                                    ? {
                                                      ...entry,
                                                      items: entry.items.map((linkRow, linkIdx) => linkIdx === itemIdx ? { ...linkRow, href: nextValue } : linkRow),
                                                    }
                                                    : entry
                                                )));
                                              }}
                                            />
                                            <button
                                              type="button"
                                              style={btnDangerStyle}
                                              onClick={() => {
                                                updateBlocks(blocks.map((entry, entryIdx) => (
                                                  entryIdx === blockIdx && entry.type === "link_list"
                                                    ? { ...entry, items: entry.items.filter((_, linkIdx) => linkIdx !== itemIdx) }
                                                    : entry
                                                )));
                                              }}
                                            >
                                              Link entfernen
                                            </button>
                                          </div>
                                        ))}
                                        <button
                                          type="button"
                                          style={btnGhostStyle}
                                          onClick={() => {
                                            updateBlocks(blocks.map((entry, entryIdx) => (
                                              entryIdx === blockIdx && entry.type === "link_list"
                                                ? { ...entry, items: [...entry.items, { label: "", href: "" }] }
                                                : entry
                                            )));
                                          }}
                                        >
                                          Link hinzufügen
                                        </button>
                                      </div>
                                    ) : null}

                                    {block.type === "contact" ? (
                                      <div style={{ display: "grid", gap: 8 }}>
                                        {block.lines.map((line, lineIdx) => (
                                          <div key={`${field.key}:${blockIdx}:line:${lineIdx}`} style={{ display: "flex", gap: 8 }}>
                                            <input
                                              style={inputStyle}
                                              value={line}
                                              placeholder={`Kontaktzeile ${lineIdx + 1}`}
                                              onChange={(e) => {
                                                const nextValue = e.target.value;
                                                updateBlocks(blocks.map((entry, entryIdx) => (
                                                  entryIdx === blockIdx && entry.type === "contact"
                                                    ? {
                                                      ...entry,
                                                      lines: entry.lines.map((row, rowIdx) => rowIdx === lineIdx ? nextValue : row),
                                                    }
                                                    : entry
                                                )));
                                              }}
                                            />
                                            <button
                                              type="button"
                                              style={btnDangerStyle}
                                              onClick={() => {
                                                updateBlocks(blocks.map((entry, entryIdx) => (
                                                  entryIdx === blockIdx && entry.type === "contact"
                                                    ? { ...entry, lines: entry.lines.filter((_, rowIdx) => rowIdx !== lineIdx) }
                                                    : entry
                                                )));
                                              }}
                                            >
                                              Entfernen
                                            </button>
                                          </div>
                                        ))}
                                        <button
                                          type="button"
                                          style={btnGhostStyle}
                                          onClick={() => {
                                            updateBlocks(blocks.map((entry, entryIdx) => (
                                              entryIdx === blockIdx && entry.type === "contact"
                                                ? { ...entry, lines: [...entry.lines, ""] }
                                                : entry
                                            )));
                                          }}
                                        >
                                          Zeile hinzufügen
                                        </button>
                                      </div>
                                    ) : null}

                                    {block.type === "note" ? (
                                      <div style={{ display: "grid", gap: 8 }}>
                                        <select
                                          style={{ ...inputStyle, maxWidth: 180 }}
                                          value={block.variant}
                                          onChange={(e) => {
                                            const nextVariant = String(e.target.value) === "warning" ? "warning" : "info";
                                            updateBlocks(blocks.map((entry, entryIdx) => (
                                              entryIdx === blockIdx && entry.type === "note"
                                                ? { ...entry, variant: nextVariant }
                                                : entry
                                            )));
                                          }}
                                        >
                                          <option value="info">Info</option>
                                          <option value="warning">Warnung</option>
                                        </select>
                                        <textarea
                                          style={{ ...inputStyle, minHeight: 100, resize: "vertical" }}
                                          value={block.text}
                                          placeholder="Hinweistext"
                                          onChange={(e) => {
                                            const nextValue = e.target.value;
                                            updateBlocks(blocks.map((entry, entryIdx) => (
                                              entryIdx === blockIdx && entry.type === "note"
                                                ? { ...entry, text: nextValue }
                                                : entry
                                            )));
                                          }}
                                        />
                                      </div>
                                    ) : null}
                                  </div>
                                ))}

                                {blocks.length > 0 ? (
                                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                    {(["heading", "paragraph", "list", "link_list", "contact", "note"] as PortalBlockType[]).map((type) => (
                                      <button
                                        key={`${field.key}:add:${type}`}
                                        type="button"
                                        style={btnGhostStyle}
                                        onClick={() => updateBlocks([...blocks, createEmptyPortalBlock(type)])}
                                      >
                                        {formatPortalBlockTypeLabel(type)} hinzufügen
                                      </button>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          );
                        }

                        return (
                          <label key={field.key}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>{field.label}</div>
                              <button
                                type="button"
                                style={{ ...btnGhostStyle, padding: "6px 8px", fontSize: 12 }}
                                disabled={busy || portalCmsLocale === PORTAL_CMS_SOURCE_LOCALE}
                                onClick={() =>
                                  run("Feld per KI aus DE uebersetzen", async () => {
                                    await translatePortalCmsSectionFromDe({
                                      section,
                                      fieldKey: field.key,
                                      applyMode: "overwrite",
                                    });
                                  })
                                }
                              >
                                Aus DE via KI
                              </button>
                            </div>
                            {field.type === "textarea" ? (
                              <textarea
                                style={{ ...inputStyle, minHeight: 110, resize: "vertical" }}
                                value={String(draft.fields_json[field.key] ?? "")}
                                placeholder={field.placeholder ?? ""}
                                onChange={(e) => {
                                  const nextValue = e.target.value;
                                  setPortalCmsDrafts((prev) => ({
                                    ...prev,
                                    [draftKey]: {
                                      ...draft,
                                      fields_json: {
                                        ...draft.fields_json,
                                        [field.key]: nextValue,
                                      },
                                    },
                                  }));
                                }}
                              />
                            ) : (
                              <input
                                style={inputStyle}
                                value={String(draft.fields_json[field.key] ?? "")}
                                placeholder={field.placeholder ?? ""}
                                onChange={(e) => {
                                  const nextValue = e.target.value;
                                  setPortalCmsDrafts((prev) => ({
                                    ...prev,
                                    [draftKey]: {
                                      ...draft,
                                      fields_json: {
                                        ...draft.fields_json,
                                        [field.key]: nextValue,
                                      },
                                    },
                                  }));
                                }}
                              />
                            )}
                            {field.help ? (
                              <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>{field.help}</div>
                            ) : null}
                          </label>
                        );
                      })}
                    </div>

                    <div style={{ marginTop: 8, fontSize: 11, color: "#64748b" }}>
                      Status in dieser Locale: <strong>{formatPortalEntryStatus(draft.status)}</strong>
                      {portalCmsLocale !== PORTAL_CMS_SOURCE_LOCALE
                        ? " · Bei Sync/KI wird Live automatisch auf Intern oder Entwurf zurueckgesetzt."
                        : ""}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          <div style={{ ...rowStyle, marginTop: 14 }}>
            <div style={{ ...mutedStyle, fontSize: 12 }}>
              Zunaechst werden hier nur die strukturierten Portal-Grundbereiche gepflegt. Die oeffentlichen Seiten koennen anschliessend schrittweise auf DB-first mit JSX-Fallback umgestellt werden.
            </div>
            <button
              style={btnStyle}
              disabled={busy || !selectedPortalCmsPage || !portalCmsLocale}
              onClick={() =>
                run("Portal-Inhalte speichern", async () => {
                  if (!selectedPortalCmsPage || !portalCmsLocale) return;
                  storeSessionScroll(PORTAL_CMS_SCROLL_STATE_KEY);
                  pendingPortalCmsScrollRestoreRef.current = true;
                  const entries = selectedPortalCmsPage.sections.map((section) => {
                    const draftKey = `${portalCmsLocale}::${selectedPortalCmsPage.page_key}::${section.section_key}`;
                    const draft = portalCmsDrafts[draftKey] ?? {
                      status: "draft" as PortalContentEntryStatus,
                      fields_json: buildPortalCmsEmptyFields(section),
                    };
                    return {
                      page_key: selectedPortalCmsPage.page_key,
                      section_key: section.section_key,
                      locale: portalCmsLocale,
                      status: draft.status,
                      fields_json: draft.fields_json,
                    };
                  });
                  await api("/api/admin/portal-content", {
                    method: "POST",
                    body: JSON.stringify({ entries }),
                  });
                  await loadPortalCms();
                })
              }
            >
              Bereich speichern
            </button>
          </div>
        </div>
      </section>
      ) : null}

      {activeView === "billing_defaults" ? (
      <section style={workspaceSectionStyle}>
        <h1 style={workspaceTitleStyle}>Billing-Standards</h1>
        <p style={mutedStyle}>
          Globale Standarddefinition für Portalabo und Feature-Katalog.
        </p>

        <div style={{ marginTop: 12, padding: 12, border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc" }}>
          <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>Portalabo Standard</div>
          <div style={grid3Style}>
            <label>
              Grundpreis (EUR/Monat)
              <input
                style={inputStyle}
                value={billingDefaultsDraft.portal_base_price_eur}
                onChange={(e) => setBillingDefaultsDraft((v) => ({ ...v, portal_base_price_eur: e.target.value }))}
              />
            </label>
            <label>
              Preis je Ortslage (EUR)
              <input
                style={inputStyle}
                value={billingDefaultsDraft.portal_ortslage_price_eur}
                onChange={(e) => setBillingDefaultsDraft((v) => ({ ...v, portal_ortslage_price_eur: e.target.value }))}
              />
            </label>
            <label>
              Preis je Export-Ortslage (EUR)
              <input
                style={inputStyle}
                value={billingDefaultsDraft.portal_export_ortslage_price_eur}
                onChange={(e) => setBillingDefaultsDraft((v) => ({ ...v, portal_export_ortslage_price_eur: e.target.value }))}
              />
            </label>
          </div>
          <div style={{ marginTop: 10 }}>
            <button
              style={btnStyle}
              disabled={busy}
              onClick={() =>
                run("Billing-Standards speichern", async () => {
                  const parseOrThrow = (raw: string, field: string) => {
                    const n = Number(raw);
                    if (!Number.isFinite(n) || n < 0) throw new Error(`${field} muss >= 0 sein.`);
                    return Number(n.toFixed(2));
                  };
                  await api("/api/admin/billing/defaults", {
                    method: "POST",
                    body: JSON.stringify({
                      defaults: {
                        portal_base_price_eur: parseOrThrow(billingDefaultsDraft.portal_base_price_eur, "Grundpreis"),
                        portal_ortslage_price_eur: parseOrThrow(billingDefaultsDraft.portal_ortslage_price_eur, "Preis je Ortslage"),
                        portal_export_ortslage_price_eur: parseOrThrow(billingDefaultsDraft.portal_export_ortslage_price_eur, "Preis je Export-Ortslage"),
                      },
                    }),
                  });
                  await loadBillingDefaults();
                })
              }
            >
              Standard speichern
            </button>
          </div>
        </div>

        <div style={{ marginTop: 12, padding: 12, border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff" }}>
          <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>Internationale Sprachen</div>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Sprache</th>
                <th style={thStyle}>Portalstatus</th>
                <th style={thStyle}>Feature aktiv</th>
                <th style={thStyle}>Default aktiv</th>
                <th style={thStyle}>Preis (Default)</th>
                <th style={thStyle}>Code</th>
              </tr>
            </thead>
            <tbody>
              {billingLocaleFeatureRows.map((row, idx) => (
                <tr key={row.locale}>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 600 }}>{row.label_de || row.label_native || row.locale}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>
                      {row.locale}{row.bcp47_tag ? ` · ${row.bcp47_tag}` : ""}
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ fontSize: 13, color: "#334155" }}>
                      {row.is_active ? "aktiv" : "inaktiv"} · {row.status}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>
                      {row.partner_bookable ? "partnerbuchbar" : "nicht partnerbuchbar"}
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <input
                      type="checkbox"
                      checked={row.feature_is_active}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setBillingLocaleFeatureRows((prev) => prev.map((item, itemIdx) => (
                          itemIdx === idx ? { ...item, feature_is_active: checked } : item
                        )));
                      }}
                    />
                  </td>
                  <td style={tdStyle}>
                    <input
                      type="checkbox"
                      checked={row.default_enabled}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setBillingLocaleFeatureRows((prev) => prev.map((item, itemIdx) => (
                          itemIdx === idx ? { ...item, default_enabled: checked } : item
                        )));
                      }}
                    />
                  </td>
                  <td style={tdStyle}>
                    <input
                      style={{ ...inputStyle, maxWidth: 140 }}
                      value={String(row.default_monthly_price_eur)}
                      onChange={(e) => {
                        const next = Number(e.target.value);
                        setBillingLocaleFeatureRows((prev) => prev.map((item, itemIdx) => (
                          itemIdx === idx ? { ...item, default_monthly_price_eur: Number.isFinite(next) ? next : 0 } : item
                        )));
                      }}
                    />
                  </td>
                  <td style={tdStyle}>
                    <div style={{ fontSize: 13, color: "#334155" }}>{row.feature_code}</div>
                    <div style={{ fontSize: 12, color: row.feature_exists ? "#64748b" : "#b45309" }}>
                      {row.feature_exists ? "angelegt" : "wird beim Speichern angelegt"}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              style={btnStyle}
              disabled={busy}
              onClick={() =>
                run("Sprachfeatures speichern", async () => {
                  await api("/api/admin/billing/defaults", {
                    method: "POST",
                    body: JSON.stringify({
                      locale_features: billingLocaleFeatureRows.map((row) => ({
                        locale: row.locale,
                        feature_is_active: row.feature_is_active,
                        default_enabled: row.default_enabled,
                        default_monthly_price_eur: Number(Number(row.default_monthly_price_eur ?? 0).toFixed(2)),
                        billing_unit: row.billing_unit,
                        note: row.note,
                      })),
                    }),
                  });
                  await loadBillingDefaults();
                })
              }
            >
              Sprachfeatures speichern
            </button>
          </div>
        </div>

        <div style={{ marginTop: 12, padding: 12, border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff" }}>
          <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>Sonstige Features</div>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Code</th>
                <th style={thStyle}>Label</th>
                <th style={thStyle}>Aktiv (Default)</th>
                <th style={thStyle}>Preis (Default)</th>
                <th style={thStyle}>Einheit</th>
              </tr>
            </thead>
            <tbody>
              {billingFeatureCatalog.map((feature, idx) => (
                <tr key={feature.code}>
                  <td style={tdStyle}>{feature.code}</td>
                  <td style={tdStyle}>
                    <input
                      style={inputStyle}
                      value={feature.label}
                      onChange={(e) => setBillingFeatureCatalog((prev) => prev.map((row, rowIdx) => rowIdx === idx ? { ...row, label: e.target.value } : row))}
                    />
                  </td>
                  <td style={tdStyle}>
                    <input
                      type="checkbox"
                      checked={feature.default_enabled}
                      onChange={(e) => setBillingFeatureCatalog((prev) => prev.map((row, rowIdx) => rowIdx === idx ? { ...row, default_enabled: e.target.checked } : row))}
                    />
                  </td>
                  <td style={tdStyle}>
                    <input
                      style={{ ...inputStyle, maxWidth: 130 }}
                      value={String(feature.default_monthly_price_eur)}
                      onChange={(e) => {
                        const next = Number(e.target.value);
                        setBillingFeatureCatalog((prev) => prev.map((row, rowIdx) => rowIdx === idx ? { ...row, default_monthly_price_eur: Number.isFinite(next) ? next : 0 } : row));
                      }}
                    />
                  </td>
                  <td style={tdStyle}>
                    <input
                      style={inputStyle}
                      value={feature.billing_unit ?? "pro Monat"}
                      onChange={(e) => setBillingFeatureCatalog((prev) => prev.map((row, rowIdx) => rowIdx === idx ? { ...row, billing_unit: e.target.value } : row))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              style={btnStyle}
              disabled={busy}
              onClick={() =>
                run("Feature-Katalog speichern", async () => {
                  await api("/api/admin/billing/defaults", {
                    method: "POST",
                    body: JSON.stringify({ features: billingFeatureCatalog }),
                  });
                  await loadBillingDefaults();
                })
              }
            >
              Katalog speichern
            </button>
          </div>

          <div style={{ marginTop: 12, borderTop: "1px solid #e2e8f0", paddingTop: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Neues Feature</div>
            <div style={grid3Style}>
              <input
                style={inputStyle}
                placeholder="code (z. B. social_media)"
                value={newBillingFeature.code}
                onChange={(e) => setNewBillingFeature((v) => ({ ...v, code: e.target.value }))}
              />
              <input
                style={inputStyle}
                placeholder="Label"
                value={newBillingFeature.label}
                onChange={(e) => setNewBillingFeature((v) => ({ ...v, label: e.target.value }))}
              />
              <input
                style={inputStyle}
                placeholder="Preis EUR"
                value={newBillingFeature.default_monthly_price_eur}
                onChange={(e) => setNewBillingFeature((v) => ({ ...v, default_monthly_price_eur: e.target.value }))}
              />
            </div>
            <div style={{ ...rowStyle, marginTop: 8 }}>
              <input
                style={inputStyle}
                placeholder="Einheit (z. B. pro Monat)"
                value={newBillingFeature.billing_unit}
                onChange={(e) => setNewBillingFeature((v) => ({ ...v, billing_unit: e.target.value }))}
              />
              <input
                style={inputStyle}
                placeholder="Hinweis"
                value={newBillingFeature.note}
                onChange={(e) => setNewBillingFeature((v) => ({ ...v, note: e.target.value }))}
              />
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={newBillingFeature.default_enabled}
                  onChange={(e) => setNewBillingFeature((v) => ({ ...v, default_enabled: e.target.checked }))}
                />
                Default aktiv
              </label>
              <button
                style={btnStyle}
                disabled={busy}
                onClick={() =>
                  run("Neues Feature anlegen", async () => {
                    await api("/api/admin/billing/defaults", {
                      method: "POST",
                      body: JSON.stringify({
                        features: [{
                          ...newBillingFeature,
                          code: newBillingFeature.code.trim().toLowerCase(),
                          sort_order: Number(newBillingFeature.sort_order || "100"),
                          default_monthly_price_eur: Number(newBillingFeature.default_monthly_price_eur || "0"),
                        }],
                      }),
                    });
                    await loadBillingDefaults();
                    setNewBillingFeature({
                      code: "",
                      label: "",
                      note: "",
                      billing_unit: "pro Monat",
                      default_enabled: false,
                      default_monthly_price_eur: "5.00",
                      sort_order: "100",
                      is_active: true,
                    });
                  })
                }
              >
                Feature anlegen
              </button>
            </div>
          </div>
        </div>
      </section>
      ) : null}

      {activeView === "llm_global" ? (
      <section style={workspaceSectionStyle}>
        <h1 style={workspaceTitleStyle}>Globale LLM-Verwaltung</h1>
        <div style={partnerTabBarStyle}>
          <button style={partnerTabButtonStyle(llmGlobalTab === "create")} onClick={() => setLlmGlobalTab("create")}>
            LLM anlegen
          </button>
          <button style={partnerTabButtonStyle(llmGlobalTab === "pricing")} onClick={() => setLlmGlobalTab("pricing")}>
            LLM Preise
          </button>
          <button style={partnerTabButtonStyle(llmGlobalTab === "overview")} onClick={() => setLlmGlobalTab("overview")}>
            LLM Übersicht
          </button>
          <button style={partnerTabButtonStyle(llmGlobalTab === "usage")} onClick={() => setLlmGlobalTab("usage")}>
            Partnerverbrauch Übersicht
          </button>
        </div>

        {llmGlobalTab === "create" ? (
          <>
            <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
              <div style={{ padding: 12, border: "1px solid #e2e8f0", borderRadius: 10, background: "#f8fafc" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>Provider-Account</div>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12, color: "#475569", marginBottom: 6 }}>
                    Hier wählst du, ob ein neuer technischer Zugang angelegt wird oder ob weitere Modelle unter einen bestehenden Zugang gehängt werden.
                  </div>
                  <select
                    style={inputStyle}
                    value={newLlmAccount.existing_account_id}
                    onChange={(e) => {
                      const accountId = e.target.value;
                      const existing = llmAccounts.find((account) => account.id === accountId) ?? null;
                      setLlmCreateTestResult(null);
                      setNewLlmAccount((v) => ({
                        ...v,
                        existing_account_id: accountId,
                        provider: existing?.provider ?? v.provider,
                        display_name: existing?.display_name ?? v.display_name,
                        base_url: existing?.base_url ?? v.base_url,
                        api_version: existing?.api_version ?? v.api_version,
                      }));
                      if (existing) {
                        setNewLlmModels((prev) => prev.map((item, idx) => idx === 0 ? {
                          ...item,
                          model: getSuggestedLatestModel(existing.provider) || item.model,
                          manual_model_input: String(existing.provider).toLowerCase() === "azure_openai",
                        } : item));
                      }
                    }}
                  >
                    <option value="">Neuen Provider-Account anlegen</option>
                    {llmAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.display_name || `${account.provider} · ${account.base_url}`}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={grid2Style}>
                  <select
                    style={inputStyle}
                    value={newLlmAccount.provider}
                    disabled={Boolean(selectedExistingLlmAccount)}
                    onChange={(e) => {
                      const provider = e.target.value;
                      setLlmCreateTestResult(null);
                      setNewLlmAccount((v) => ({
                        ...v,
                        provider,
                        base_url: getDefaultLlmBaseUrl(provider),
                        api_version: provider === "azure_openai" ? (v.api_version || "2024-10-21") : "",
                      }));
                      setNewLlmModels((prev) =>
                        prev.map((item, idx) =>
                          idx === 0
                            ? {
                                ...item,
                                model: getSuggestedLatestModel(provider) || item.model,
                                manual_model_input: String(provider).toLowerCase() === "azure_openai",
                              }
                            : item,
                        ),
                      );
                    }}
                  >
                    {llmProviderSpecs.map((spec) => (
                      <option key={spec.id} value={spec.id}>
                        {spec.label}
                      </option>
                    ))}
                  </select>
                  <input
                    style={inputStyle}
                    placeholder="Anzeigename des Provider-Accounts (optional)"
                    value={newLlmAccount.display_name}
                    disabled={Boolean(selectedExistingLlmAccount)}
                    onChange={(e) => {
                      setLlmCreateTestResult(null);
                      setNewLlmAccount((v) => ({ ...v, display_name: e.target.value }));
                    }}
                  />
                </div>
                <div style={{ marginTop: 10 }}>
                  <input
                    style={inputStyle}
                    placeholder="Base URL"
                    value={newLlmAccount.base_url}
                    disabled={Boolean(selectedExistingLlmAccount)}
                    onChange={(e) => {
                      setLlmCreateTestResult(null);
                      setNewLlmAccount((v) => ({ ...v, base_url: e.target.value }));
                    }}
                  />
                </div>
                {String(newLlmAccount.provider).toLowerCase() === "azure_openai" ? (
                  <div style={{ marginTop: 10 }}>
                    <input
                      style={inputStyle}
                      placeholder="Azure API-Version (z. B. 2024-10-21)"
                      value={newLlmAccount.api_version}
                      disabled={Boolean(selectedExistingLlmAccount)}
                      onChange={(e) => {
                        setLlmCreateTestResult(null);
                        setNewLlmAccount((v) => ({ ...v, api_version: e.target.value }));
                      }}
                    />
                  </div>
                ) : null}
                <div style={{ marginTop: 10 }}>
                  <input
                    type="password"
                    style={inputStyle}
                    placeholder={effectiveExistingLlmAccountHasApiKey && !newLlmAccount.api_key.trim() ? "************" : "API-Key"}
                    value={newLlmAccount.api_key}
                    onChange={(e) => {
                      setLlmCreateTestResult(null);
                      setNewLlmAccount((v) => ({ ...v, api_key: e.target.value }));
                    }}
                  />
                </div>
                {effectiveExistingLlmAccountHasApiKey ? (
                  <div style={{ marginTop: 6, fontSize: 11, color: "#166534" }}>
                    API-Key gespeichert. Wenn du hier einen neuen Wert eingibst, wird der vorhandene Key ersetzt.
                  </div>
                ) : effectiveExistingLlmAccount ? (
                  <div style={{ marginTop: 6, fontSize: 11, color: "#991b1b" }}>
                    Für diesen bestehenden Provider-Account ist noch kein API-Key gespeichert.
                  </div>
                ) : null}
                <div style={{ marginTop: 8, fontSize: 11, color: "#64748b" }}>
                  Bereits angelegte Provider-Accounts: {llmAccounts.length}
                  {effectiveExistingLlmAccount ? " · neue Modelle werden an den gewählten Zugang angehängt" : ""}
                </div>
                <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
                  <button
                    style={btnStyle}
                    disabled={busy}
                    onClick={() =>
                      run("Provider-Account speichern", async () => {
                        setLlmCreateTestResult(null);
                        setLlmCreateSaveResult(null);
                        const result = await ensureLlmAccountReady();
                        setNewLlmAccount((prev) => ({ ...prev, existing_account_id: result.accountId }));
                        setLlmCreateSaveResult({
                          status: "ok",
                          message: "Provider-Account ist gespeichert und bereit. Jetzt kannst du die Modelle darunter anlegen.",
                        });
                      }, { showSuccessModal: false })
                    }
                  >
                    Provider-Account speichern
                  </button>
                  <button
                    style={{
                      ...btnGhostStyle,
                      border: "4px solid #16a34a",
                      color: "#166534",
                      background: "#f0fdf4",
                      fontWeight: 700,
                    }}
                    disabled={busy || llmCreateTestBusy}
                    onClick={() =>
                      run("LLM-Verbindung testen", async () => {
                        setLlmCreateTestBusy(true);
                        setLlmCreateSaveResult(null);
                        setLlmCreateTestResult(null);
                        try {
                          const resp = await api<{ result?: { status?: string; message?: string } }>("/api/admin/llm/providers/test", {
                            method: "POST",
                            body: JSON.stringify({
                              provider_account_id: effectiveExistingLlmAccount?.id ?? null,
                              provider: newLlmAccount.provider,
                              model: newLlmModels[0]?.model ?? "",
                              base_url: newLlmAccount.base_url,
                              api_key: newLlmAccount.api_key.trim() || null,
                              api_version: String(newLlmAccount.api_version || "").trim() || null,
                            }),
                          });
                          const resultStatus = String(resp.result?.status ?? "").toLowerCase();
                          const resultMessage = String(resp.result?.message ?? "Kein Testergebnis.");
                          setLlmCreateTestResult({
                            status: resultStatus === "ok" ? "ok" : "error",
                            message: resultMessage,
                          });
                          setStatus(resultStatus === "ok" ? "Verbindung erfolgreich getestet." : resultMessage);
                          if (resultStatus !== "ok") {
                            throw new Error(resultMessage);
                          }
                        } finally {
                          setLlmCreateTestBusy(false);
                        }
                      }, { showSuccessModal: false })
                    }
                  >
                    {llmCreateTestBusy ? "Teste..." : "Verbindung testen"}
                  </button>
                </div>
              </div>

              <datalist id="llm-model-suggestions">
                {llmModelOptions.map((model) => (
                  <option key={model} value={model} />
                ))}
              </datalist>

              {llmAccountReadyForModels ? (
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>Modelle unter diesem Provider</div>
                  <button
                    style={btnGhostStyle}
                    type="button"
                    onClick={() => {
                      setLlmCreateTestResult(null);
                      const nextDraft = createEmptyLlmModelDraft(newLlmAccount.provider, false);
                      setNewLlmModels((prev) => [...prev, nextDraft]);
                      setExpandedLlmModelKey(nextDraft.key);
                    }}
                  >
                    Modell hinzufügen
                  </button>
                </div>
                {newLlmModels.map((modelDraft, idx) => (
                  <div key={modelDraft.key} style={{ border: "1px solid #e2e8f0", borderRadius: 10, background: "#fff", overflow: "hidden" }}>
                    <div
                      style={{
                        width: "100%",
                        background: expandedLlmModelKey === modelDraft.key ? "#f8fafc" : "#ffffff",
                        padding: "12px 14px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        textAlign: "left",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedLlmModelKey((prev) => (prev === modelDraft.key ? null : modelDraft.key))}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          border: "none",
                          background: "transparent",
                          padding: 0,
                          cursor: "pointer",
                          textAlign: "left",
                          display: "block",
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>
                          {resolveLlmModelDraftTitle(modelDraft, idx)}
                        </div>
                        <div style={{ marginTop: 3, fontSize: 11, color: "#64748b" }}>
                          {modelDraft.model.trim() ? `Modell-ID: ${modelDraft.model.trim()}` : "Bitte Modell-ID als Pflichtfeld setzen"}
                          {modelDraft.recommended ? " · empfohlen" : ""}
                        </div>
                      </button>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                        {newLlmModels.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => {
                              setLlmCreateTestResult(null);
                              setNewLlmModels((prev) => prev.filter((item) => item.key !== modelDraft.key));
                              setExpandedLlmModelKey((prev) => (prev === modelDraft.key ? null : prev));
                            }}
                            style={{
                              ...btnGhostStyle,
                              border: "1px solid #cbd5e1",
                              padding: "6px 8px",
                            }}
                          >
                            Entfernen
                          </button>
                        ) : null}
                        <span style={{ fontSize: 16, color: "#64748b" }}>
                          {expandedLlmModelKey === modelDraft.key ? "−" : "+"}
                        </span>
                      </div>
                    </div>
                    {expandedLlmModelKey === modelDraft.key ? (
                      <div style={{ padding: 14, borderTop: "1px solid #e2e8f0" }}>
                        <div style={grid2Style}>
                          <div>
                            <div style={requiredFieldHintStyle}>Pflichtfeld</div>
                            <div style={{ display: "grid", gap: 6 }}>
                              <div style={{ fontSize: 11, color: "#475569" }}>
                                {String(newLlmAccount.provider).toLowerCase() === "azure_openai"
                                  ? "Azure Deployment-Name"
                                  : "Technische API-Modell-ID"}
                              </div>
                              {String(newLlmAccount.provider).toLowerCase() !== "azure_openai" && !modelDraft.manual_model_input ? (
                                <>
                                  <select
                                    style={requiredInputStyle}
                                    value={modelDraft.model}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      setLlmCreateTestResult(null);
                                      setNewLlmModels((prev) => prev.map((item) => item.key === modelDraft.key ? { ...item, model: value } : item));
                                    }}
                                  >
                                    {llmModelOptions.map((model) => (
                                      <option key={model} value={model}>
                                        {model}
                                      </option>
                                    ))}
                                  </select>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                    <span style={{ fontSize: 11, color: "#64748b" }}>
                                      Bitte die exakte Provider-Modell-ID wählen.
                                    </span>
                                    <button
                                      type="button"
                                      style={{ ...btnGhostStyle, padding: "6px 8px" }}
                                      onClick={() => {
                                        setLlmCreateTestResult(null);
                                        setNewLlmModels((prev) => prev.map((item) => item.key === modelDraft.key ? { ...item, manual_model_input: true } : item));
                                      }}
                                    >
                                      Manuell eingeben
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <input
                                    style={requiredInputStyle}
                                    placeholder={String(newLlmAccount.provider).toLowerCase() === "azure_openai" ? "Deployment-Name" : "Technische Modell-ID"}
                                    value={modelDraft.model}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      setLlmCreateTestResult(null);
                                      setNewLlmModels((prev) => prev.map((item) => item.key === modelDraft.key ? { ...item, model: value } : item));
                                    }}
                                  />
                                  {String(newLlmAccount.provider).toLowerCase() !== "azure_openai" ? (
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                      <span style={{ fontSize: 11, color: "#64748b" }}>
                                        Ausnahmefall: nur nutzen, wenn die exakte Modell-ID nicht in der Vorschlagsliste steht.
                                      </span>
                                      <button
                                        type="button"
                                        style={{ ...btnGhostStyle, padding: "6px 8px" }}
                                        onClick={() => {
                                          setLlmCreateTestResult(null);
                                          setNewLlmModels((prev) => prev.map((item) => item.key === modelDraft.key ? {
                                            ...item,
                                            manual_model_input: false,
                                            model: getSuggestedLatestModel(newLlmAccount.provider) || item.model,
                                          } : item));
                                        }}
                                      >
                                        Zur Auswahlliste
                                      </button>
                                    </div>
                                  ) : (
                                    <div style={{ fontSize: 11, color: "#64748b" }}>
                                      Für Azure muss hier der exakte Deployment-Name hinterlegt werden.
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                          <div style={{ display: "grid", gap: 6 }}>
                            <div style={{ fontSize: 11, color: "#475569" }}>Anzeigename für UI</div>
                            <input
                              style={inputStyle}
                              placeholder="Anzeigename (optional)"
                              value={modelDraft.display_label}
                              onChange={(e) => {
                                setLlmCreateTestResult(null);
                                setNewLlmModels((prev) => prev.map((item) => item.key === modelDraft.key ? { ...item, display_label: e.target.value } : item));
                              }}
                            />
                          </div>
                        </div>
                        <div style={{ marginTop: 10 }}>
                          <input
                            style={inputStyle}
                            placeholder="Hinweis / Stärke des Modells"
                            value={modelDraft.hint}
                            onChange={(e) => {
                              setLlmCreateTestResult(null);
                              setNewLlmModels((prev) => prev.map((item) => item.key === modelDraft.key ? { ...item, hint: e.target.value } : item));
                            }}
                          />
                        </div>
                        <div style={{ marginTop: 10 }}>
                          <input
                            style={inputStyle}
                            placeholder="Badges, kommagetrennt (z. B. Texte, Übersetzung, Qualität)"
                            value={modelDraft.badges}
                            onChange={(e) => {
                              setLlmCreateTestResult(null);
                              setNewLlmModels((prev) => prev.map((item) => item.key === modelDraft.key ? { ...item, badges: e.target.value } : item));
                            }}
                          />
                        </div>
                        <div style={{ ...grid2Style, marginTop: 10 }}>
                          <div>
                            <div style={requiredFieldHintStyle}>Pflichtfeld</div>
                            <input
                              style={requiredInputStyle}
                              placeholder="Input-Kosten USD / 1k Tokens"
                              value={modelDraft.input_cost_usd_per_1k}
                              onChange={(e) => {
                                setLlmCreateTestResult(null);
                                setNewLlmModels((prev) => prev.map((item) => item.key === modelDraft.key ? { ...item, input_cost_usd_per_1k: e.target.value } : item));
                              }}
                            />
                            <div style={{ marginTop: 4, fontSize: 11, color: "#64748b" }}>
                              Format: z. B. <strong>0,0025</strong> oder <strong>0.0025</strong>
                            </div>
                          </div>
                          <div>
                            <div style={requiredFieldHintStyle}>Pflichtfeld</div>
                            <input
                              style={requiredInputStyle}
                              placeholder="Output-Kosten USD / 1k Tokens"
                              value={modelDraft.output_cost_usd_per_1k}
                              onChange={(e) => {
                                setLlmCreateTestResult(null);
                                setNewLlmModels((prev) => prev.map((item) => item.key === modelDraft.key ? { ...item, output_cost_usd_per_1k: e.target.value } : item));
                              }}
                            />
                            <div style={{ marginTop: 4, fontSize: 11, color: "#64748b" }}>
                              Format: z. B. <strong>0,015</strong> oder <strong>0.015</strong>
                            </div>
                          </div>
                        </div>
                        <div style={{ ...grid2Style, marginTop: 10 }}>
                          <input
                            style={inputStyle}
                            placeholder="Reihenfolge (kleiner = weiter oben)"
                            value={modelDraft.sort_order}
                            onChange={(e) => {
                              setLlmCreateTestResult(null);
                              setNewLlmModels((prev) => prev.map((item) => item.key === modelDraft.key ? { ...item, sort_order: e.target.value } : item));
                            }}
                          />
                          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#334155" }}>
                            <input
                              type="checkbox"
                              checked={modelDraft.recommended}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setLlmCreateTestResult(null);
                                setNewLlmModels((prev) => prev.map((item) => ({
                                  ...item,
                                  recommended: item.key === modelDraft.key ? checked : (checked ? false : item.recommended),
                                })));
                              }}
                            />
                            Als Empfehlung markieren
                          </label>
                        </div>
                        <div style={{ marginTop: 8, fontSize: 11, color: "#64748b" }}>
                          Das Feld mit der Standardzahl <strong>10</strong> steuert die Reihenfolge/Priorität dieses Modells. Kleinere Werte stehen weiter oben und werden im zentralen Fallback früher berücksichtigt.
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
              ) : (
              <div style={{ padding: 12, border: "1px dashed #cbd5e1", borderRadius: 10, background: "#f8fafc", fontSize: 12, color: "#475569" }}>
                Schritt 2 wird erst freigeschaltet, wenn der Provider-Account inklusive API-Key gespeichert ist.
              </div>
              )}
              <div style={{ fontSize: 12, color: "#475569" }}>
                Provider-Zugang wird einmalig angelegt. Modelle darunter werden separat gespeichert und bepreist. Die Kosten werden in USD je 1k Tokens gepflegt und für die spätere FX-/Billing-Hochrechnung verwendet.
              </div>
              {llmCreateTestResult ? (
                <div
                  style={{
                    fontSize: 12,
                    color: llmCreateTestResult.status === "ok" ? "#166534" : "#991b1b",
                    background: llmCreateTestResult.status === "ok" ? "#ecfdf5" : "#fef2f2",
                    border: `2px solid ${llmCreateTestResult.status === "ok" ? "#22c55e" : "#ef4444"}`,
                    borderRadius: 10,
                    padding: "10px 12px",
                    boxShadow: llmCreateTestResult.status === "ok"
                      ? "inset 0 0 0 1px rgba(34, 197, 94, 0.08)"
                      : "inset 0 0 0 1px rgba(239, 68, 68, 0.08)",
                  }}
                >
                  <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 4 }}>
                    Verbindungstest
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>
                    {llmCreateTestResult.status === "ok" ? "Verbindung erfolgreich" : "Verbindung fehlgeschlagen"}
                  </div>
                  <div style={{ lineHeight: 1.45 }}>
                    {llmCreateTestResult.status === "ok"
                      ? "Provider, Modell und Zugangsdaten sind in dieser Konfiguration nutzbar."
                      : "Der Test konnte mit der aktuellen Konfiguration nicht erfolgreich ausgeführt werden."}
                  </div>
                  <div
                    style={{
                      marginTop: 8,
                      padding: "8px 10px",
                      borderRadius: 8,
                      background: llmCreateTestResult.status === "ok" ? "#f8fafc" : "#fff7f7",
                      border: `1px solid ${llmCreateTestResult.status === "ok" ? "#dbeafe" : "#fecaca"}`,
                      color: llmCreateTestResult.status === "ok" ? "#1e293b" : "#7f1d1d",
                      fontSize: 11,
                      lineHeight: 1.45,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 3 }}>
                      {llmCreateTestResult.status === "ok" ? "Rückmeldung" : "Fehlerdiagnose"}
                    </div>
                    {llmCreateTestResult.message}
                  </div>
                </div>
              ) : null}
              {llmCreateSaveResult ? (
                <div
                  style={{
                    fontSize: 12,
                    color: llmCreateSaveResult.status === "ok" ? "#166534" : llmCreateSaveResult.status === "info" ? "#075985" : "#991b1b",
                    background: llmCreateSaveResult.status === "ok" ? "#f0fdf4" : llmCreateSaveResult.status === "info" ? "#eff6ff" : "#fef2f2",
                    border: `1px solid ${llmCreateSaveResult.status === "ok" ? "#bbf7d0" : llmCreateSaveResult.status === "info" ? "#bae6fd" : "#fecaca"}`,
                    borderRadius: 8,
                    padding: "8px 10px",
                  }}
                >
                  <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 2 }}>
                    Speichern
                  </div>
                  {llmCreateSaveResult.message}
                </div>
              ) : null}
            </div>
            {llmAccountReadyForModels ? (
            <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
              <button
                style={btnStyle}
                disabled={busy}
                onClick={() =>
                  run("LLM-Modelle speichern", async () => {
                    setLlmCreateTestResult(null);
                    setLlmCreateSaveResult(null);
                    if (!effectiveExistingLlmAccount?.id) {
                      throw new Error("Bitte zuerst den Provider-Account speichern.");
                    }
                    if (!effectiveExistingLlmAccountHasApiKey) {
                      throw new Error("Bitte zuerst den API-Key des Provider-Accounts speichern.");
                    }
                    if (newLlmAccount.api_key.trim()) {
                      throw new Error("Es ist noch ein ungespeicherter API-Key eingetragen. Bitte zuerst Schritt 1 speichern.");
                    }
                    if (newLlmModels.length === 0) {
                      throw new Error("Mindestens ein Modell ist erforderlich.");
                    }
                    const recommendedCount = newLlmModels.filter((item) => item.recommended).length;
                    if (recommendedCount > 1) {
                      throw new Error("Es kann nur ein empfohlenes Modell pro Provider-Account geben.");
                    }
                    for (const modelDraft of newLlmModels) {
                      const modelId = modelDraft.model.trim();
                      const inputCost = parsePositiveNumber(modelDraft.input_cost_usd_per_1k);
                      const outputCost = parsePositiveNumber(modelDraft.output_cost_usd_per_1k);
                      if (!modelId) {
                        throw new Error("Jedes Modell benötigt vor dem Speichern eine Modell-ID.");
                      }
                      if (inputCost === null || outputCost === null) {
                        throw new Error(`Für ${modelId} sind Input- und Output-Kosten in USD Pflichtfelder und müssen größer als 0 sein.`);
                      }
                    }
                    for (const modelDraft of newLlmModels) {
                      const inputCost = parsePositiveNumber(modelDraft.input_cost_usd_per_1k);
                      const outputCost = parsePositiveNumber(modelDraft.output_cost_usd_per_1k);
                      await api("/api/admin/llm/providers", {
                        method: "POST",
                        body: JSON.stringify({
                          provider_account_id: effectiveExistingLlmAccount.id,
                          model: modelDraft.model.trim(),
                          display_label: modelDraft.display_label.trim() || null,
                          hint: modelDraft.hint.trim() || null,
                          badges: parseBadgeInput(modelDraft.badges),
                          recommended: modelDraft.recommended,
                          sort_order: Number(modelDraft.sort_order || "100"),
                          temperature: modelDraft.temperature ? Number(modelDraft.temperature) : null,
                          max_tokens: modelDraft.max_tokens ? Number(modelDraft.max_tokens) : null,
                          input_cost_usd_per_1k: inputCost,
                          output_cost_usd_per_1k: outputCost,
                        }),
                      });
                    }
                    setLlmCreateSaveResult({
                      status: "ok",
                      message: `${newLlmModels.length} Modell(e) wurden unter dem gespeicherten Provider-Account angelegt.`,
                    });
                    const nextDraft = createEmptyLlmModelDraft(newLlmAccount.provider, true);
                    setNewLlmModels([nextDraft]);
                    setExpandedLlmModelKey(nextDraft.key);
                    await loadLlmProviders();
                    setLlmGlobalTab("overview");
                  })
                }
              >
                Modelle speichern
              </button>
            </div>
            ) : null}
          </>
        ) : null}

        {llmGlobalTab === "overview" ? (
          <>
            <div style={{ marginTop: 12, marginBottom: 10, fontSize: 12, color: "#475569" }}>
              Die Übersicht arbeitet modellbezogen. Änderungen an <strong>Base URL</strong> wirken auf den gesamten Provider-Account und damit auf alle Modelle unter diesem Zugang.
            </div>
            <table style={llmCompactTableStyle}>
              <thead>
                <tr>
                  <th style={llmCompactThStyle}>Prio</th>
                  <th style={llmCompactThStyle}>Provider</th>
                  <th style={llmCompactThStyle}>Modell</th>
                  <th style={llmCompactThStyle}>Anzeige</th>
                  <th style={llmCompactThStyle}>Hinweis</th>
                  <th style={llmCompactThStyle}>Badges</th>
                  <th style={llmCompactThStyle}>Base URL</th>
                  <th style={llmCompactThStyle}>Empfohlen</th>
                  <th style={llmCompactThStyle}>Status</th>
                  <th style={llmCompactThStyle}>Aktion</th>
                </tr>
              </thead>
              <tbody>
                {llmProviders.map((p) => (
                  <tr key={p.id}>
                    <td style={llmCompactTdStyle}>
                      <input
                        style={llmCompactInputStyle}
                        value={llmProviderDrafts[p.id]?.priority ?? String(p.priority)}
                        onChange={(e) =>
                          setLlmProviderDrafts((v) => ({
                            ...v,
                            [p.id]: { ...(v[p.id] ?? {}), priority: e.target.value },
                          }))
                        }
                      />
                    </td>
                    <td style={llmCompactTdStyle}>{p.provider}</td>
                    <td style={llmCompactTdStyle}>
                      <input
                        style={llmCompactInputStyle}
                        value={llmProviderDrafts[p.id]?.model ?? p.model}
                        onChange={(e) =>
                          setLlmProviderDrafts((v) => ({
                            ...v,
                            [p.id]: { ...(v[p.id] ?? {}), model: e.target.value },
                          }))
                        }
                      />
                    </td>
                    <td style={llmCompactTdStyle}>
                      <input
                        style={llmCompactInputStyle}
                        value={llmProviderDrafts[p.id]?.display_label ?? String(p.display_label ?? "")}
                        onChange={(e) =>
                          setLlmProviderDrafts((v) => ({
                            ...v,
                            [p.id]: { ...(v[p.id] ?? {}), display_label: e.target.value },
                          }))
                        }
                      />
                    </td>
                    <td style={llmCompactTdStyle}>
                      <input
                        style={llmCompactInputStyle}
                        value={llmProviderDrafts[p.id]?.hint ?? String(p.hint ?? "")}
                        onChange={(e) =>
                          setLlmProviderDrafts((v) => ({
                            ...v,
                            [p.id]: { ...(v[p.id] ?? {}), hint: e.target.value },
                          }))
                        }
                      />
                    </td>
                    <td style={llmCompactTdStyle}>
                      <input
                        style={llmCompactInputStyle}
                        value={llmProviderDrafts[p.id]?.badges ?? formatBadgesInput(p.badges)}
                        onChange={(e) =>
                          setLlmProviderDrafts((v) => ({
                            ...v,
                            [p.id]: { ...(v[p.id] ?? {}), badges: e.target.value },
                          }))
                        }
                      />
                    </td>
                    <td style={llmCompactTdStyle}>
                      <input
                        style={llmCompactInputStyle}
                        value={llmProviderDrafts[p.id]?.base_url ?? p.base_url}
                        onChange={(e) =>
                          setLlmProviderDrafts((v) => ({
                            ...v,
                            [p.id]: { ...(v[p.id] ?? {}), base_url: e.target.value },
                          }))
                        }
                      />
                    </td>
                    <td style={llmCompactTdStyle}>
                      <input
                        type="checkbox"
                        checked={llmProviderDrafts[p.id]?.recommended ?? Boolean(p.recommended)}
                        onChange={(e) =>
                          setLlmProviderDrafts((v) => ({
                            ...v,
                            [p.id]: { ...(v[p.id] ?? {}), recommended: e.target.checked },
                          }))
                        }
                      />
                    </td>
                    <td style={llmCompactTdStyle}>
                      <div style={{ display: "grid", gap: 4 }}>
                        <span>{p.is_active ? "aktiv" : "inaktiv"}</span>
                        {llmOverviewTestResults[p.id] ? (
                          <span title={llmOverviewTestResults[p.id].message} style={llmStatusPillStyle(llmOverviewTestResults[p.id].status)}>
                            {llmOverviewTestResults[p.id].status === "ok" ? "Test ok" : "Testfehler"}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td style={llmCompactTdStyle}>
                      <div style={llmCompactActionRowStyle}>
                        <button
                          style={llmIconButtonStyle("primary")}
                          title="Änderungen speichern"
                          aria-label="Änderungen speichern"
                          onClick={() =>
                            run("Provider speichern", async () => {
                              const draft = llmProviderDrafts[p.id] ?? {};
                              await api(`/api/admin/llm/providers/${p.id}`, {
                                method: "PATCH",
                                body: JSON.stringify({
                                  model: String(draft.model ?? p.model).trim(),
                                  display_label: String(draft.display_label ?? p.display_label ?? "").trim() || null,
                                  hint: String(draft.hint ?? p.hint ?? "").trim() || null,
                                  badges: parseBadgeInput(String(draft.badges ?? formatBadgesInput(p.badges))),
                                  recommended: draft.recommended ?? Boolean(p.recommended),
                                  base_url: String(draft.base_url ?? p.base_url).trim(),
                                  api_version: String(draft.api_version ?? p.api_version ?? "").trim() || null,
                                  priority: Number(draft.priority ?? p.priority),
                                }),
                              });
                              await loadLlmProviders();
                            })
                          }
                        >
                          <AdminIcon name="save" />
                        </button>
                        <button
                          style={llmIconButtonStyle("success")}
                          title={llmOverviewTestBusyId === p.id ? "Verbindung wird getestet" : "Gespeicherten LLM erneut testen"}
                          aria-label="Gespeicherten LLM erneut testen"
                          disabled={llmOverviewTestBusyId === p.id}
                          onClick={() =>
                            run("Gespeicherten LLM testen", async () => {
                              await testSavedLlmProvider(p);
                            }, { showSuccessModal: false })
                          }
                        >
                          <AdminIcon name="test" />
                        </button>
                        <button
                          style={llmIconButtonStyle("ghost")}
                          title="Neuesten Modellvorschlag einsetzen"
                          aria-label="Neuesten Modellvorschlag einsetzen"
                          onClick={() =>
                            setLlmProviderDrafts((v) => ({
                              ...v,
                              [p.id]: {
                                ...(v[p.id] ?? {}),
                                model: getSuggestedLatestModel(p.provider) || (v[p.id]?.model ?? p.model),
                              },
                            }))
                          }
                        >
                          <AdminIcon name="spark" />
                        </button>
                        <button
                          style={llmIconButtonStyle("ghost", p.is_active)}
                          title={p.is_active ? "Modell deaktivieren" : "Modell aktivieren"}
                          aria-label={p.is_active ? "Modell deaktivieren" : "Modell aktivieren"}
                          onClick={() =>
                            run("Provider-Status ändern", async () => {
                              await api(`/api/admin/llm/providers/${p.id}`, {
                                method: "PATCH",
                                body: JSON.stringify({ is_active: !p.is_active }),
                              });
                              await loadLlmProviders();
                            })
                          }
                        >
                          <AdminIcon name="toggle" />
                        </button>
                        <button
                          style={llmIconButtonStyle("danger")}
                          title="Modell löschen"
                          aria-label="Modell löschen"
                          onClick={() =>
                            run("Provider löschen", async () => {
                              await api(`/api/admin/llm/providers/${p.id}`, { method: "DELETE" });
                              await loadLlmProviders();
                            })
                          }
                        >
                          <AdminIcon name="trash" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ ...grid3Style, marginTop: 14 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#334155" }}>
                <input
                  type="checkbox"
                  checked={llmGlobalConfig.central_enabled}
                  onChange={(e) => setLlmGlobalConfig((v) => ({ ...v, central_enabled: e.target.checked }))}
                />
                Zentrale LLM-Nutzung aktiv
              </label>
              <label style={{ display: "grid", gap: 5 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>Globales Monatslimit Tokens</span>
                <input
                  style={inputStyle}
                  placeholder="leer = kein globales Token-Limit"
                  value={llmGlobalConfig.monthly_token_budget ?? ""}
                  onChange={(e) =>
                    setLlmGlobalConfig((v) => ({
                      ...v,
                      monthly_token_budget: e.target.value.trim() ? Number(e.target.value) : null,
                    }))
                  }
                />
                <span style={{ fontSize: 11, color: "#64748b" }}>
                  Ab diesem Monatswert werden weitere zentral gemanagte LLM-Läufe blockiert.
                </span>
              </label>
              <label style={{ display: "grid", gap: 5 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>Globales Monatslimit Kosten (EUR)</span>
                <input
                  style={inputStyle}
                  placeholder="leer = kein globales Kosten-Limit"
                  value={llmGlobalConfig.monthly_cost_budget_eur ?? ""}
                  onChange={(e) =>
                    setLlmGlobalConfig((v) => ({
                      ...v,
                      monthly_cost_budget_eur: e.target.value.trim() ? Number(e.target.value) : null,
                    }))
                  }
                />
                <span style={{ fontSize: 11, color: "#64748b" }}>
                  Ab diesem Monatswert werden weitere zentral gemanagte LLM-Läufe blockiert.
                </span>
              </label>
              <div style={{ gridColumn: "1 / -1", marginTop: 4 }}>
                <button
                  style={btnStyle}
                  onClick={() =>
                    run("Globale LLM-Konfiguration speichern", async () => {
                      await api("/api/admin/llm/global", {
                        method: "PATCH",
                        body: JSON.stringify(llmGlobalConfig),
                      });
                      await loadLlmGlobalConfig();
                    })
                  }
                >
                  Konfiguration speichern
                </button>
              </div>
            </div>
          </>
        ) : null}

        {llmGlobalTab === "pricing" ? (
          <>
            <div style={{ ...rowStyle, marginTop: 12, marginBottom: 8 }}>
              <div style={{ ...mutedStyle, fontSize: 12 }}>
                Regelmäßige Preisaktualisierung pro Provider/Modell. Wenn keine Preise übernommen werden können, bitte manuell eintragen.
              </div>
              <button
                style={btnGhostStyle}
                disabled={busy}
                onClick={() => {
                  void syncProviderPricing();
                }}
              >
                Preise aktualisieren
              </button>
            </div>
            <table style={llmCompactTableStyle}>
              <thead>
                <tr>
                  <th style={llmCompactThStyle}>Provider</th>
                  <th style={llmCompactThStyle}>Modell</th>
                  <th style={llmCompactThStyle}>Preis USD/1k (In/Out)</th>
                  <th style={llmCompactThStyle}>EUR-Hinweis</th>
                  <th style={llmCompactThStyle}>Aktion</th>
                </tr>
              </thead>
              <tbody>
                {llmProviders.map((p) => (
                  <tr key={`price:${p.id}`}>
                    <td style={llmCompactTdStyle}>{p.provider}</td>
                    <td style={llmCompactTdStyle}>{p.model}</td>
                    <td style={llmCompactTdStyle}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <input
                          style={llmCompactInputStyle}
                          placeholder="in"
                          value={llmProviderDrafts[p.id]?.input_cost_usd_per_1k ?? ""}
                          onChange={(e) =>
                            setLlmProviderDrafts((v) => ({
                              ...v,
                              [p.id]: { ...(v[p.id] ?? {}), input_cost_usd_per_1k: e.target.value },
                            }))
                          }
                        />
                        <input
                          style={llmCompactInputStyle}
                          placeholder="out"
                          value={llmProviderDrafts[p.id]?.output_cost_usd_per_1k ?? ""}
                          onChange={(e) =>
                            setLlmProviderDrafts((v) => ({
                              ...v,
                              [p.id]: { ...(v[p.id] ?? {}), output_cost_usd_per_1k: e.target.value },
                            }))
                          }
                        />
                      </div>
                      {!supportsAutomaticPricing(p.provider) ? (
                        <div style={{ marginTop: 6, fontSize: 11, color: "#7c2d12" }}>
                          Kein Auto-Preisabruf: manuelle Pflege
                        </div>
                      ) : null}
                    </td>
                    <td style={llmCompactTdStyle}>
                      {p.fx_rate_usd_to_eur && p.input_cost_eur_per_1k !== null && p.output_cost_eur_per_1k !== null ? (
                        <div style={{ fontSize: 11, color: "#475569" }}>
                          ca. {Number(p.input_cost_eur_per_1k ?? 0).toFixed(6)} / {Number(p.output_cost_eur_per_1k ?? 0).toFixed(6)} EUR
                        </div>
                      ) : (
                        <div style={{ fontSize: 11, color: "#64748b" }}>
                          EUR-Hochrechnung erst mit gepflegter FX-Rate
                        </div>
                      )}
                    </td>
                    <td style={llmCompactTdStyle}>
                      <button
                        style={llmIconButtonStyle("primary")}
                        title="Preise speichern"
                        aria-label="Preise speichern"
                        onClick={() =>
                          run("Preis speichern", async () => {
                            const draft = llmProviderDrafts[p.id] ?? {};
                            const inputCost = parsePositiveNumber(String(draft.input_cost_usd_per_1k ?? p.input_cost_usd_per_1k ?? ""));
                            const outputCost = parsePositiveNumber(String(draft.output_cost_usd_per_1k ?? p.output_cost_usd_per_1k ?? ""));
                            if (inputCost === null || outputCost === null) {
                              throw new Error("Input- und Output-Kosten sind Pflichtfelder und müssen größer als 0 sein.");
                            }
                            await api(`/api/admin/llm/providers/${p.id}`, {
                              method: "PATCH",
                              body: JSON.stringify({
                                input_cost_usd_per_1k: inputCost,
                                output_cost_usd_per_1k: outputCost,
                              }),
                            });
                            await loadLlmProviders();
                          })
                        }
                      >
                        <AdminIcon name="save" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : null}

        {llmGlobalTab === "usage" ? (
          <>
            <div style={{ ...rowStyle, marginTop: 14 }}>
              <input
                type="month"
                style={inputStyle}
                value={llmUsageMonth}
                onChange={(e) => setLlmUsageMonth(e.target.value)}
              />
              <button
                style={btnStyle}
                onClick={() =>
                  run("LLM-Monitoring laden", async () => {
                    await loadLlmUsage(llmUsageMonth);
                  })
                }
              >
                Aktualisieren
              </button>
            </div>
            <div style={{ marginTop: 10, fontSize: 12, color: "#334155" }}>
              Gesamt Tokens: <strong>{llmUsageTotals.tokens}</strong> · Gesamt Kosten (EUR): <strong>{llmUsageTotals.cost_eur.toFixed(4)}</strong>
            </div>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Events</th>
                  <th style={thStyle}>Tokens</th>
                  <th style={thStyle}>Kosten EUR</th>
                </tr>
              </thead>
              <tbody>
                {llmUsageStatusRows.map((row) => (
                  <tr key={`status:${row.status}`}>
                    <td style={tdStyle}>{row.status}</td>
                    <td style={tdStyle}>{row.entries}</td>
                    <td style={tdStyle}>{row.tokens}</td>
                    <td style={tdStyle}>{Number(row.cost_eur ?? 0).toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Partner-ID</th>
                  <th style={thStyle}>Tokens</th>
                  <th style={thStyle}>Kosten EUR</th>
                </tr>
              </thead>
              <tbody>
                {llmUsageRows.map((row) => (
                  <tr key={row.partner_id}>
                    <td style={tdStyle}>{row.partner_id}</td>
                    <td style={tdStyle}>{row.tokens}</td>
                    <td style={tdStyle}>{Number(row.cost_eur ?? 0).toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: 12, fontSize: 12, color: "#334155", fontWeight: 700 }}>
              Aufschlüsselung nach Route/Provider/Modell
            </div>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Route</th>
                  <th style={thStyle}>Provider</th>
                  <th style={thStyle}>Modell</th>
                  <th style={thStyle}>Tokens</th>
                  <th style={thStyle}>Kosten EUR</th>
                </tr>
              </thead>
              <tbody>
                {llmUsageItems.map((row) => (
                  <tr key={`${row.route_name}:${row.provider}:${row.model}`}>
                    <td style={tdStyle}>{row.route_name}</td>
                    <td style={tdStyle}>{row.provider}</td>
                    <td style={tdStyle}>{row.model}</td>
                    <td style={tdStyle}>{row.tokens}</td>
                    <td style={tdStyle}>{Number(row.cost_eur ?? 0).toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : null}
      </section>
      ) : null}

      {activeView === "audit" ? (
      <section style={cardStyle}>
        <h2 style={h2Style}>Security Audit Log</h2>
        <div style={grid3Style}>
          <input
            placeholder="entity_type"
            aria-label="Audit-Filter entity_type"
            style={inputStyle}
            value={auditFilters.entity_type}
            onChange={(e) => setAuditFilters((v) => ({ ...v, entity_type: e.target.value }))}
          />
          <input
            placeholder="event_type"
            aria-label="Audit-Filter event_type"
            style={inputStyle}
            value={auditFilters.event_type}
            onChange={(e) => setAuditFilters((v) => ({ ...v, event_type: e.target.value }))}
          />
          <input
            placeholder="actor_user_id"
            aria-label="Audit-Filter actor_user_id"
            style={inputStyle}
            value={auditFilters.actor_user_id}
            onChange={(e) => setAuditFilters((v) => ({ ...v, actor_user_id: e.target.value }))}
          />
          <input
            type="datetime-local"
            aria-label="Audit-Filter Startzeit"
            style={inputStyle}
            value={auditFilters.created_from}
            onChange={(e) => setAuditFilters((v) => ({ ...v, created_from: e.target.value }))}
          />
          <input
            type="datetime-local"
            aria-label="Audit-Filter Endzeit"
            style={inputStyle}
            value={auditFilters.created_to}
            onChange={(e) => setAuditFilters((v) => ({ ...v, created_to: e.target.value }))}
          />
          <input
            type="number"
            min={1}
            max={500}
            aria-label="Audit-Filter Ergebnislimit"
            style={inputStyle}
            value={auditFilters.limit}
            onChange={(e) =>
              setAuditFilters((v) => ({
                ...v,
                limit: Math.min(500, Math.max(1, Number(e.target.value) || 100)),
              }))
            }
          />
        </div>
        <div style={{ marginTop: 12 }}>
          <button
            style={btnStyle}
            disabled={busy}
            onClick={() =>
              run("Audit-Log laden", async () => {
                await loadAuditLogs();
              })
            }
          >
            Audit-Log aktualisieren
          </button>
        </div>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Zeit</th>
              <th style={thStyle}>Actor</th>
              <th style={thStyle}>Event</th>
              <th style={thStyle}>Entity</th>
              <th style={thStyle}>Payload</th>
            </tr>
          </thead>
          <tbody>
            {auditLogs.map((row) => (
              <tr key={row.id}>
                <td style={tdStyle}>{new Date(row.created_at).toLocaleString("de-DE")}</td>
                <td style={tdStyle}>
                  <div>{row.actor_role}</div>
                  <small style={mutedStyle}>{row.actor_user_id ?? "-"}</small>
                </td>
                <td style={tdStyle}>{row.event_type}</td>
                <td style={tdStyle}>
                  <div>{row.entity_type}</div>
                  <small style={mutedStyle}>{row.entity_id}</small>
                </td>
                <td style={tdStyle}>
                  <pre style={preStyle}>{JSON.stringify(row.payload ?? {}, null, 2)}</pre>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      ) : null}
        </div>
      </div>
      )}
      <footer style={dashboardFooterStyle}>
        <span style={dashboardFooterCopyStyle}>© {new Date().getFullYear()} Wohnlagencheck24</span>
        <div style={dashboardFooterLinksStyle}>
          <Link href="/impressum" style={dashboardFooterLinkStyle}>Impressum</Link>
          <Link href="/datenschutz" style={dashboardFooterLinkStyle}>Datenschutz</Link>
        </div>
      </footer>
    </div>
  );
}

const wrapStyle: React.CSSProperties = {
  width: "100%",
  margin: 0,
  padding: 0,
  color: "#0f172a",
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 10,
};

const dashboardHeaderStyle: React.CSSProperties = {
  minHeight: "72px",
  backgroundColor: "#fff",
  color: "#0f172a",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "10px 20px",
  borderBottom: "1px solid #e2e8f0",
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  zIndex: 40,
};

const dashboardStatusStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  fontSize: "12px",
  color: "#94a3b8",
};

const headerActionButtonStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
  background: "#ffffff",
  color: "#0f172a",
  padding: "6px 10px",
  fontSize: "12px",
  fontWeight: 700,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
};

const dashboardBurgerButtonStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
  background: "#ffffff",
  color: "#0f172a",
  padding: "0 10px",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: "34px",
  lineHeight: 1,
};

const dashboardBurgerIconStyle: React.CSSProperties = {
  width: "16px",
  height: "16px",
  display: "block",
};

const menuWrapStyle: React.CSSProperties = {
  position: "relative",
};

const menuDropdownStyle: React.CSSProperties = {
  position: "absolute",
  right: 0,
  top: "42px",
  minWidth: "180px",
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
  background: "#fff",
  boxShadow: "0 12px 24px rgba(15, 23, 42, 0.15)",
  padding: "6px",
  zIndex: 200,
};

const menuItemStyle: React.CSSProperties = {
  width: "100%",
  textAlign: "left",
  border: "none",
  background: "#fff",
  borderRadius: "8px",
  padding: "10px 10px",
  fontSize: "14px",
  color: "#0f172a",
  cursor: "pointer",
};

const statusStyle: React.CSSProperties = {
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 0,
  padding: "6px 20px",
  margin: 0,
  fontSize: 12,
  color: "#64748b",
  width: "100%",
  boxSizing: "border-box",
  position: "fixed",
  top: "72px",
  left: 0,
  right: 0,
  zIndex: 39,
};

const dashboardFooterStyle: React.CSSProperties = {
  minHeight: "44px",
  borderTop: "1px solid #e2e8f0",
  backgroundColor: "#ffffff",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 20px",
  fontSize: "12px",
  width: "100%",
  position: "fixed",
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 38,
};

const dashboardFooterCopyStyle: React.CSSProperties = {
  color: "#64748b",
};

const dashboardFooterLinksStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
};

const dashboardFooterLinkStyle: React.CSSProperties = {
  color: "#0f766e",
  textDecoration: "none",
  fontWeight: 600,
};

const adminWelcomeWrapStyle: React.CSSProperties = {
  flex: 1,
  width: "100%",
  padding: "151px 36px 88px",
  boxSizing: "border-box",
  background: "#f8fafc",
  overflowY: "auto",
};

const adminWelcomeHeaderStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  marginBottom: 22,
  maxWidth: "820px",
  marginLeft: "auto",
  marginRight: "auto",
};

const adminWelcomeTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "34px",
  lineHeight: 1.1,
  color: "#0f172a",
  fontWeight: 800,
  textAlign: "center",
};

const adminWelcomeTextStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "15px",
  lineHeight: 1.7,
  color: "#475569",
  textAlign: "center",
};

const adminWelcomeGridOuterStyle: React.CSSProperties = {
  maxWidth: "980px",
  margin: "0 auto",
};

const adminWelcomeGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 16,
};

const adminWelcomeCardStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  background: "#ffffff",
  padding: "22px 20px",
  textAlign: "left",
  cursor: "pointer",
  display: "grid",
  gap: 14,
  boxShadow: "0 12px 24px rgba(15, 23, 42, 0.04)",
};

const adminWelcomeCardIconStyle: React.CSSProperties = {
  width: 54,
  height: 54,
  borderRadius: 16,
  background: "#f8fafc",
  color: "#0f172a",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const adminWelcomeCardTitleRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  flexWrap: "wrap",
};

const adminWelcomeCardTitleStyle: React.CSSProperties = {
  fontSize: "17px",
  lineHeight: 1.25,
  fontWeight: 800,
  color: "#0f172a",
};

const adminWelcomeBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 24,
  padding: "0 10px",
  borderRadius: 999,
  background: "#111111",
  color: "#ffffff",
  fontSize: 11,
  fontWeight: 700,
};

const adminWelcomeCardTextStyle: React.CSSProperties = {
  fontSize: "14px",
  lineHeight: 1.7,
  color: "#475569",
};

const adminLayoutStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "50px 260px minmax(0, 1fr)",
  gap: 0,
  alignItems: "stretch",
  width: "100%",
  flex: 1,
  minHeight: 0,
  paddingRight: "16px",
  paddingTop: "111px",
  boxSizing: "border-box",
};

const modeBarStyle: React.CSSProperties = {
  width: "50px",
  minWidth: "50px",
  background: "#111111",
  padding: "8px 0",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 6,
  position: "sticky",
  top: "111px",
  alignSelf: "start",
  height: "calc(100vh - 155px)",
  overflow: "visible",
  zIndex: 50,
};

const modeButtonStyle = (active: boolean): React.CSSProperties => ({
  position: "relative",
  width: "30px",
  height: "30px",
  border: active ? "1px solid #ffe000" : "1px solid rgba(255,255,255,0.92)",
  borderRadius: 9,
  background: active ? "#ffe000" : "#ffffff",
  color: "#111111",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
});

const adminNavTooltipLayerStyle = (top: number): React.CSSProperties => ({
  position: "absolute",
  top: `${top}px`,
  left: "calc(100% + 10px)",
  transform: "translateY(-50%)",
  pointerEvents: "none",
  zIndex: 60,
});

const adminNavTooltipCardStyle: React.CSSProperties = {
  minWidth: "168px",
  maxWidth: "220px",
  borderRadius: "12px",
  background: "#ffe000",
  color: "#111111",
  boxShadow: "0 18px 36px rgba(15,23,42,0.18)",
  padding: "10px 14px",
  fontSize: "13px",
  fontWeight: 700,
};

const listPaneStyle: React.CSSProperties = {
  position: "sticky",
  top: "111px",
  alignSelf: "start",
  width: "260px",
  borderRight: "1px solid #e2e8f0",
  background: "#ffffff",
  display: "flex",
  flexDirection: "column",
  height: "calc(100vh - 155px)",
  maxHeight: "calc(100vh - 155px)",
  overflow: "hidden",
};

const sidebarSectionHeaderStyle: React.CSSProperties = {
  padding: "24px 24px 16px",
  borderBottom: "1px solid #f1f5f9",
  fontSize: 14,
  fontWeight: 800,
  color: "#0f172a",
  margin: 0,
};

const sidebarListStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  flex: 1,
  overflowY: "auto",
  padding: "0 15px 15px",
};

const sidebarControlWrapStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  padding: "15px",
};

const adminWorkflowLegendStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  padding: "0 15px 12px",
  fontSize: 11,
  color: "#475569",
};

const adminWorkflowLegendItemStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontWeight: 600,
};

const adminWorkflowLegendDotStyle = (color: string): React.CSSProperties => ({
  width: 8,
  height: 8,
  borderRadius: "50%",
  background: color,
  flex: "0 0 auto",
});

const contentPaneStyle: React.CSSProperties = {
  minWidth: 0,
  padding: "0 0 72px 14px",
};

const listLinkRowStyle = (active: boolean, isSystemDefault = false): React.CSSProperties => ({
  position: "relative",
  width: "100%",
  textAlign: "left",
  border: `1px solid ${isSystemDefault ? (active ? "#16a34a" : "#86efac") : (active ? "#cbd5e1" : "#e2e8f0")}`,
  borderRadius: 8,
  background: active ? "#f8fafc" : "#ffffff",
  padding: "10px 12px",
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  gap: 2,
  boxShadow: isSystemDefault ? "inset 3px 0 0 #16a34a" : undefined,
});

const cardStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  background: "#ffffff",
  padding: 16,
  marginBottom: 16,
};

const workspaceSectionStyle: React.CSSProperties = {
  background: "#ffffff",
  padding: 16,
  marginBottom: 16,
};

const workspaceTitleStyle: React.CSSProperties = {
  margin: "0 0 12px",
  fontSize: 24,
  lineHeight: 1.2,
  color: "#0f172a",
  fontWeight: 800,
};

const adminPartnerSummaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
  gap: 10,
  marginTop: 14,
};

const adminPartnerSummaryCardStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  background: "#f8fafc",
  padding: "10px 12px",
};

const adminPartnerSummaryLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: 0.3,
};

const adminPartnerSummaryValueStyle: React.CSSProperties = {
  marginTop: 6,
  fontSize: 17,
  fontWeight: 800,
  color: "#0f172a",
  lineHeight: 1.15,
};

const reviewSectionCardStyle: React.CSSProperties = {
  marginTop: 12,
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  background: "#f8fafc",
  padding: 14,
};

const reviewSectionHeaderStyle: React.CSSProperties = {
  marginBottom: 12,
  fontSize: 13,
  fontWeight: 800,
  color: "#0f172a",
  textTransform: "uppercase",
  letterSpacing: 0.3,
};

const reviewInlineFeedbackStyle = (isError: boolean): React.CSSProperties => ({
  marginTop: 12,
  border: `1px solid ${isError ? "#fecaca" : "#bbf7d0"}`,
  background: isError ? "#fef2f2" : "#f0fdf4",
  borderRadius: 10,
  padding: "10px 12px",
  fontSize: 12,
  fontWeight: 600,
  color: isError ? "#991b1b" : "#166534",
});

const partnerTabBarStyle: React.CSSProperties = {
  marginTop: 14,
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const partnerTabButtonStyle = (active: boolean): React.CSSProperties => ({
  border: active ? "1px solid #0f766e" : "1px solid #cbd5e1",
  background: active ? "#ecfdf5" : "#ffffff",
  color: active ? "#065f46" : "#0f172a",
  borderRadius: 999,
  padding: "7px 12px",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
});

const marketExplanationModeBarStyle: React.CSSProperties = {
  marginTop: 14,
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  justifyContent: "flex-start",
};

const marketExplanationModeButtonStyle = (active: boolean): React.CSSProperties => ({
  border: active ? "1px solid #0f766e" : "1px solid #cbd5e1",
  background: active ? "#ecfdf5" : "#ffffff",
  color: active ? "#065f46" : "#0f172a",
  borderRadius: 999,
  padding: "8px 14px",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
});

const marketExplanationScopeBarStyle: React.CSSProperties = {
  marginTop: 12,
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  justifyContent: "flex-start",
};

const marketExplanationScopeButtonStyle = (active: boolean): React.CSSProperties => ({
  border: active ? "1px solid #486b7a" : "1px solid #cbd5e1",
  background: active ? "#f1f5f9" : "#ffffff",
  color: active ? "#486b7a" : "#334155",
  borderRadius: 999,
  padding: "7px 12px",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
});

const marketExplanationWorkspaceCardStyle: React.CSSProperties = {
  marginTop: 12,
  padding: 12,
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  background: "#fff",
};

const marketExplanationActionRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

const marketExplanationActionGroupStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
};

const marketExplanationScopeHintStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "#64748b",
};

const marketExplanationBundeslandBarStyle: React.CSSProperties = {
  marginTop: 14,
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const marketExplanationBundeslandButtonStyle = (active: boolean): React.CSSProperties => ({
  border: active ? "1px solid #0f766e" : "1px solid #cbd5e1",
  background: active ? "#ecfdf5" : "#ffffff",
  color: active ? "#065f46" : "#0f172a",
  borderRadius: 999,
  padding: "7px 12px",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
});

const marketExplanationThemeTabBarStyle: React.CSSProperties = {
  display: "flex",
  backgroundColor: "#fff",
  padding: "8px 8px 0 8px",
  borderRadius: "12px 12px 0 0",
  borderBottom: "1px solid #e2e8f0",
  gap: "6px",
  overflowX: "auto",
  marginTop: "16px",
  marginBottom: "20px",
};

const marketExplanationThemeTabButtonStyle = (active: boolean): React.CSSProperties => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  minWidth: "118px",
  padding: "12px 14px",
  border: "none",
  borderBottom: active ? "3px solid rgb(72, 107, 122)" : "3px solid transparent",
  backgroundColor: active ? "#f1f5f9" : "transparent",
  color: active ? "rgb(72, 107, 122)" : "#64748b",
  fontWeight: active ? "700" : "500",
  fontSize: "13px",
  cursor: "pointer",
  whiteSpace: "nowrap",
  transition: "all 0.2s",
  borderRadius: "8px 8px 0 0",
});

const marketExplanationThemeTabLabelStyle: React.CSSProperties = {
  fontSize: 12,
  lineHeight: 1.2,
  textAlign: "center",
  fontWeight: "inherit",
};

const marketExplanationThemeTabCountStyle: React.CSSProperties = {
  fontSize: 10,
  lineHeight: 1,
  opacity: 0.75,
  fontWeight: 700,
};

const standardTextRefreshSearchResultsStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: 8,
  background: "#f8fafc",
  maxHeight: 260,
  overflowY: "auto",
};

const standardTextRefreshSearchResultButtonStyle = (active: boolean): React.CSSProperties => ({
  width: "100%",
  textAlign: "left",
  border: active ? "1px solid #0f766e" : "1px solid #dbe4ee",
  borderRadius: 8,
  background: active ? "#ecfdf5" : "#ffffff",
  padding: "10px 12px",
  display: "grid",
  gap: 4,
  cursor: "pointer",
});

const standardTextRefreshSelectionCardStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  background: "#fff",
  padding: "10px 12px",
  display: "grid",
  gap: 4,
};

const standardTextRefreshSummaryStyle: React.CSSProperties = {
  marginTop: 14,
  display: "flex",
  flexWrap: "wrap",
  gap: 12,
  alignItems: "center",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  background: "#f8fafc",
  padding: "10px 12px",
  fontSize: 12,
  color: "#334155",
};

const h2Style: React.CSSProperties = {
  marginTop: 0,
  marginBottom: 12,
  fontSize: 18,
};

const rowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: 10,
  alignItems: "center",
};

const grid2Style: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
};

const grid3Style: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr",
  gap: 10,
};

const inputStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  padding: "8px 10px",
  width: "100%",
};

const requiredInputStyle: React.CSSProperties = {
  ...inputStyle,
  border: "1px solid #f59e0b",
  background: "#fffbeb",
  boxShadow: "inset 0 0 0 1px rgba(245, 158, 11, 0.12)",
};

const requiredFieldHintStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "#92400e",
  marginBottom: 4,
  textTransform: "uppercase",
  letterSpacing: 0.2,
};

const btnStyle: React.CSSProperties = {
  border: "1px solid #0f766e",
  background: "#0f766e",
  color: "#fff",
  borderRadius: 8,
  padding: "8px 12px",
  cursor: "pointer",
};

const btnGhostStyle: React.CSSProperties = {
  border: "1px solid #94a3b8",
  background: "#fff",
  color: "#0f172a",
  borderRadius: 8,
  padding: "8px 12px",
  cursor: "pointer",
};

const btnSuccessGhostStyle: React.CSSProperties = {
  ...btnGhostStyle,
  borderColor: "#0f766e",
  color: "#0f766e",
};

const btnDangerStyle: React.CSSProperties = {
  border: "1px solid #ef4444",
  background: "#fff5f5",
  color: "#b91c1c",
  borderRadius: 8,
  padding: "8px 12px",
  cursor: "pointer",
};

const handoverLinkButtonStyle: React.CSSProperties = {
  border: "1px solid #16a34a",
  background: "#ffffff",
  color: "#166534",
  borderRadius: 8,
  padding: "8px 12px",
  cursor: "pointer",
  fontWeight: 700,
};

const inlineLinkButtonStyle: React.CSSProperties = {
  border: "none",
  background: "transparent",
  color: "#0f766e",
  fontWeight: 700,
  padding: 0,
  cursor: "pointer",
  textDecoration: "underline",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  marginTop: 14,
  fontSize: 12,
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  borderBottom: "1px solid #e2e8f0",
  padding: "8px 6px",
  fontSize: 12,
  fontWeight: 700,
  lineHeight: 1.35,
};

const tdStyle: React.CSSProperties = {
  borderBottom: "1px solid #f1f5f9",
  padding: "8px 6px",
  verticalAlign: "top",
  fontSize: 12,
  lineHeight: 1.35,
};

function AdminIcon({ name }: { name: "save" | "spark" | "test" | "toggle" | "trash" }) {
  if (name === "save") {
    return (
      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
        <path d="M3 2h8l2 2v10H3V2zm2 1v3h5V3H5zm1 7h4v3H6v-3z" fill="currentColor" />
      </svg>
    );
  }
  if (name === "spark") {
    return (
      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
        <path d="M8 1l1.4 3.6L13 6 9.4 7.4 8 11 6.6 7.4 3 6l3.6-1.4L8 1zm4 9l.7 1.8L14.5 12l-1.8.7L12 14.5l-.7-1.8L9.5 12l1.8-.7L12 10z" fill="currentColor" />
      </svg>
    );
  }
  if (name === "test") {
    return (
      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
        <path d="M8 2a6 6 0 104.2 10.3l-.9-.9A4.7 4.7 0 118 3.3V2zm4.8 1.4l1.8 1.8-5.5 5.5-2.3.3.3-2.3 5.7-5.3zm-5 5.7L7.5 10l1-.1 4.6-4.6-.9-.9-4.4 4.8z" fill="currentColor" />
      </svg>
    );
  }
  if (name === "toggle") {
    return (
      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
        <path d="M2 5.5A3.5 3.5 0 015.5 2h5A3.5 3.5 0 0114 5.5v5a3.5 3.5 0 01-3.5 3.5h-5A3.5 3.5 0 012 10.5v-5zm3.5-2.2a2.2 2.2 0 100 4.4 2.2 2.2 0 000-4.4zm5 5.1a2.2 2.2 0 100 4.4 2.2 2.2 0 000-4.4z" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <path d="M5 2h6l.5 2H14v1H2V4h2.5L5 2zm-1 4h8l-.6 7.1c0 .5-.4.9-.9.9H5.5c-.5 0-.9-.4-.9-.9L4 6zm2 1v5h1V7H6zm3 0v5h1V7H9z" fill="currentColor" />
    </svg>
  );
}

const llmCompactTableStyle: React.CSSProperties = {
  ...tableStyle,
  fontSize: 11,
  marginTop: 12,
};

const llmCompactThStyle: React.CSSProperties = {
  ...thStyle,
  padding: "5px 4px",
  fontSize: 11,
  lineHeight: 1.2,
};

const llmCompactTdStyle: React.CSSProperties = {
  ...tdStyle,
  padding: "5px 4px",
  fontSize: 11,
  lineHeight: 1.2,
};

const llmCompactInputStyle: React.CSSProperties = {
  ...inputStyle,
  padding: "5px 6px",
  borderRadius: 6,
  fontSize: 11,
};

const llmCompactActionRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 4,
  flexWrap: "nowrap",
  alignItems: "center",
};

const llmIconButtonStyle = (kind: "primary" | "ghost" | "success" | "danger", active = false): React.CSSProperties => ({
  border:
    kind === "primary" ? "1px solid #0f766e"
      : kind === "success" ? "1px solid #16a34a"
      : kind === "danger" ? "1px solid #ef4444"
      : "1px solid #cbd5e1",
  background:
    kind === "primary" ? "#0f766e"
      : kind === "success" ? "#f0fdf4"
      : kind === "danger" ? "#fff5f5"
      : active ? "#ecfeff" : "#ffffff",
  color:
    kind === "primary" ? "#ffffff"
      : kind === "success" ? "#166534"
      : kind === "danger" ? "#b91c1c"
      : active ? "#0f766e" : "#334155",
  borderRadius: 6,
  width: 24,
  height: 24,
  padding: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  flex: "0 0 auto",
});

const llmStatusPillStyle = (status: "ok" | "error"): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  borderRadius: 999,
  padding: "2px 6px",
  fontSize: 10,
  fontWeight: 700,
  background: status === "ok" ? "#f0fdf4" : "#fef2f2",
  color: status === "ok" ? "#166534" : "#991b1b",
  border: `1px solid ${status === "ok" ? "#bbf7d0" : "#fecaca"}`,
});

const reviewStatusBadgeStyle = (state: string): React.CSSProperties => {
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    padding: "5px 10px",
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  };

  if (state === "ready_for_review") {
    return { ...base, background: "#fff7ed", color: "#9a3412", border: "1px solid #fdba74" };
  }
  if (state === "in_review") {
    return { ...base, background: "#eff6ff", color: "#1d4ed8", border: "1px solid #93c5fd" };
  }
  if (state === "changes_requested") {
    return { ...base, background: "#fef2f2", color: "#b91c1c", border: "1px solid #fca5a5" };
  }
  if (state === "approved_preview") {
    return { ...base, background: "#ecfdf5", color: "#166534", border: "1px solid #86efac" };
  }
  if (state === "live") {
    return { ...base, background: "#0f172a", color: "#f8fafc", border: "1px solid #0f172a" };
  }

  return { ...base, background: "#f8fafc", color: "#334155", border: "1px solid #cbd5e1" };
};

const mutedStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 12,
};

const suggestBoxStyle: React.CSSProperties = {
  marginTop: 8,
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  maxHeight: 180,
  overflowY: "auto",
};

const suggestBtnStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  border: 0,
  borderBottom: "1px solid #f1f5f9",
  background: "#fff",
  padding: "8px 10px",
  cursor: "pointer",
};

const preStyle: React.CSSProperties = {
  margin: 0,
  maxWidth: 420,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  fontSize: 11,
  lineHeight: 1.35,
};

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1200,
  padding: 16,
};

const modalCardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 460,
  borderRadius: 12,
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  boxShadow: "0 18px 40px rgba(15, 23, 42, 0.2)",
  padding: 18,
};

const modalTitleStyle: React.CSSProperties = {
  margin: "0 0 8px",
  fontSize: 18,
  color: "#0f172a",
};

const modalMessageStyle: React.CSSProperties = {
  margin: "0 0 14px",
  color: "#334155",
  lineHeight: 1.45,
};
