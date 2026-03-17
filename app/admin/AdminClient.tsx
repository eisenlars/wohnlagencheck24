"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/utils/supabase/client";
import { getProvidersForKind } from "@/lib/integrations/providers";
import { getMandatoryMediaLabel, isMandatoryMediaKey } from "@/lib/mandatory-media";
import { getTextKeyLabel } from "@/lib/text-key-labels";
import {
  buildPortalCmsEmptyFields,
  getPortalCmsPages,
  type PortalContentEntryRecord,
  type PortalContentEntryStatus,
  type PortalContentPageDefinition,
  type PortalLocaleConfigRecord,
  type PortalLocaleStatus,
} from "@/lib/portal-cms";
import {
  restoreSessionScroll,
  storeSessionScroll,
  useSessionViewState,
} from "@/lib/ui/session-view-state";
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

type AreaOption = {
  id: string;
  name?: string | null;
  slug?: string | null;
  parent_slug?: string | null;
  bundesland_slug?: string | null;
};

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

type AdminView = "home" | "new_partner" | "new_partner_success" | "partner_edit" | "partner_integrations" | "partner_purge" | "audit" | "llm_global" | "billing_defaults" | "portal_cms";
type AdminNavMode = "partners" | "areas";
type PartnerPanelTab = "profile" | "areas" | "review" | "handover" | "integrations" | "billing";

type HandoverApiResponse = {
  ok?: boolean;
  handover?: {
    area_id?: string;
    area_name?: string;
    old_partner?: { id?: string; company_name?: string };
    new_partner?: { id?: string; company_name?: string };
    deactivate_old_integrations_applied?: boolean;
    old_partner_remains_active?: boolean;
  };
};

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

function extractErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function formatPortalLocaleStatus(status: PortalLocaleStatus): string {
  if (status === "internal") return "intern";
  if (status === "live") return "live";
  return "geplant";
}

function formatPortalEntryStatus(status: PortalContentEntryStatus): string {
  if (status === "internal") return "intern";
  if (status === "live") return "live";
  return "entwurf";
}

type PersistedPortalCmsViewState = {
  pageKey?: string;
  locale?: string;
};

const PORTAL_CMS_VIEW_STATE_KEY = "admin_portal_cms_view_state_v1";
const PORTAL_CMS_SCROLL_STATE_KEY = "admin_portal_cms_scroll_v1";

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
  const [partners, setPartners] = useState<Partner[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>("");
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [areaMappings, setAreaMappings] = useState<AreaMapping[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [status, setStatus] = useState<string>("Lade Admin-Daten...");
  const [adminDisplayName, setAdminDisplayName] = useState<string>("Admin");
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

  const [assignAreaId, setAssignAreaId] = useState("");
  const [handoverDraft, setHandoverDraft] = useState({
    area_id: "",
    new_partner_id: "",
  });

  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([]);
  const [areaOverview, setAreaOverview] = useState<AreaOverviewRow[]>([]);
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
    oldPartnerId: string;
    newPartnerId: string;
    oldPartnerIsSystemDefault: boolean;
  }>({
    open: false,
    areaId: "",
    oldPartnerId: "",
    newPartnerId: "",
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
  const portalCmsPages = useMemo<PortalContentPageDefinition[]>(() => getPortalCmsPages(), []);
  const [portalLocaleConfigs, setPortalLocaleConfigs] = useState<PortalLocaleConfigRecord[]>([]);
  const [portalContentEntries, setPortalContentEntries] = useState<PortalContentEntryRecord[]>([]);
  const portalCmsInitialViewState = useMemo<PersistedPortalCmsViewState>(() => ({
    pageKey: "home",
    locale: "de",
  }), []);
  const [portalCmsViewState, setPortalCmsViewState] = useSessionViewState<PersistedPortalCmsViewState>(
    PORTAL_CMS_VIEW_STATE_KEY,
    portalCmsInitialViewState,
  );
  const portalCmsPageKey = String(portalCmsViewState.pageKey ?? "home");
  const portalCmsLocale = String(portalCmsViewState.locale ?? "de");
  const [portalCmsDrafts, setPortalCmsDrafts] = useState<Record<string, {
    status: PortalContentEntryStatus;
    fields_json: Record<string, string>;
  }>>({});
  const pendingPortalCmsScrollRestoreRef = useRef(false);
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
      for (const section of selectedPortalCmsPage.sections) {
        const key = `${portalCmsLocale}::${selectedPortalCmsPage.page_key}::${section.section_key}`;
        const existingEntry = portalContentEntries.find((entry) =>
          entry.locale === portalCmsLocale
          && entry.page_key === selectedPortalCmsPage.page_key
          && entry.section_key === section.section_key,
        );
        const emptyFields = buildPortalCmsEmptyFields(section);
        const nextDraft = {
          status: existingEntry?.status ?? next[key]?.status ?? "draft",
          fields_json: existingEntry
            ? {
                ...emptyFields,
                ...existingEntry.fields_json,
              }
            : {
                ...emptyFields,
                ...(next[key]?.fields_json ?? {}),
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

  const formatPartnerName = (partner: Pick<Partner, "company_name" | "is_system_default">) =>
    partner.is_system_default ? `${partner.company_name} (Portalpartner)` : partner.company_name;

  const selectedPartnerLabel = selectedPartner
    ? `${formatPartnerName(selectedPartner)} (${selectedPartner.id})`
    : "Kein Partner ausgewählt";

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
        const aPending = partnerNeedsAssignment.has(a.id) ? 1 : 0;
        const bPending = partnerNeedsAssignment.has(b.id) ? 1 : 0;
        if (aPending !== bPending) return bPending - aPending;
        const aInactive = a.is_active ? 0 : 1;
        const bInactive = b.is_active ? 0 : 1;
        if (aInactive !== bInactive) return bInactive - aInactive;
        return String(a.company_name ?? "").localeCompare(String(b.company_name ?? ""), "de");
      });
  }, [partners, partnerFilter, onlyActiveList, partnerNeedsAssignment]);

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

  async function loadAreaOverview(partnerList?: Partner[]) {
    const source = partnerList ?? partners;
    if (!source.length) {
      setAreaOverview([]);
      return;
    }

    const details = await Promise.all(
      source.map(async (partner) => {
        try {
          const data = await api<{ area_mappings: AreaMapping[] }>(`/api/admin/partners/${partner.id}`);
          return { partner, mappings: data.area_mappings ?? [] };
        } catch {
          return { partner, mappings: [] as AreaMapping[] };
        }
      }),
    );

    const rows = new Map<string, AreaOverviewRow>();
    for (const detail of details) {
      for (const mapping of detail.mappings) {
        const kreisId = String(mapping.area_id ?? "").split("-").slice(0, 3).join("-");
        if (kreisId.split("-").length !== 3) continue;
        const key = `${detail.partner.id}:${kreisId}`;
        if (rows.has(key)) continue;
        rows.set(key, {
          key,
          kreisId,
          kreisName: String(mapping.areas?.name ?? kreisId),
          partnerId: detail.partner.id,
          partnerName: detail.partner.company_name,
          isActive: Boolean(mapping.is_active),
          activationStatus: normalizeActivationStatus(
            mapping.activation_status,
            Boolean(mapping.is_active),
            Boolean(mapping.is_public_live),
          ),
        });
      }
    }

    setAreaOverview(
      Array.from(rows.values()).sort((a, b) => {
        const byKreis = a.kreisId.localeCompare(b.kreisId, "de");
        if (byKreis !== 0) return byKreis;
        return a.partnerName.localeCompare(b.partnerName, "de");
      }),
    );
  }

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

  const handoverAreaOptions = useMemo(
    () => displayAreaRows.map((row) => ({ id: row.displayKreisId, label: row.mapping.areas?.name ?? row.displayKreisId })),
    [displayAreaRows],
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

  async function loadPartners(selectId?: string, options?: { refreshSelectedDetails?: boolean }) {
    const data = await api<{ partners: Partner[] }>("/api/admin/partners?include_inactive=1");
    setPartners(data.partners ?? []);
    await loadAreaOverview(data.partners ?? []);

    const existingSelected = selectedPartnerId
      ? (data.partners ?? []).find((p) => p.id === selectedPartnerId)?.id ?? ""
      : "";
    const nextId = selectId ?? existingSelected;
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
      await loadPartnerDetails(selectedPartnerId);
      await loadAreaOverview();
      await loadAreaReview(reviewAreaId);
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
    setReviewBusy(true);
    try {
      await api<AreaReviewPayload>(
        `/api/admin/partners/${selectedPartnerId}/areas/${encodeURIComponent(reviewAreaId)}/publish`,
        {
          method: live ? "POST" : "DELETE",
        },
      );
      await loadPartnerDetails(selectedPartnerId);
      await loadAreaOverview();
      await loadAreaReview(reviewAreaId);
      setReviewActionError(null);
      setReviewActionMessage(live ? "Gebiet erfolgreich online geschaltet." : "Gebiet erfolgreich offline genommen.");
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
    const params = new URLSearchParams();
    if (auditFilters.entity_type.trim()) params.set("entity_type", auditFilters.entity_type.trim());
    if (auditFilters.event_type.trim()) params.set("event_type", auditFilters.event_type.trim());
    if (auditFilters.actor_user_id.trim()) params.set("actor_user_id", auditFilters.actor_user_id.trim());
    if (auditFilters.created_from.trim()) params.set("created_from", auditFilters.created_from.trim());
    if (auditFilters.created_to.trim()) params.set("created_to", auditFilters.created_to.trim());
    params.set("limit", String(auditFilters.limit));

    const data = await api<{ logs: AuditLogRow[] }>(`/api/admin/audit-log?${params.toString()}`);
    setAuditLogs(data.logs ?? []);
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
  }

  async function loadPortalCms() {
    const data = await api<{
      locales?: PortalLocaleConfigRecord[];
      pages?: PortalContentPageDefinition[];
      entries?: PortalContentEntryRecord[];
    }>("/api/admin/portal-content");
    setPortalLocaleConfigs(data.locales ?? []);
    setPortalContentEntries(data.entries ?? []);
    const fallbackLocale = (data.locales ?? []).find((row) => row.is_active)?.locale ?? data.locales?.[0]?.locale ?? "de";
    setPortalCmsViewState((prev) => {
      const nextLocale = (data.locales ?? []).some((row) => row.locale === prev.locale)
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
        await loadPartners();
        await loadAuditLogs();
        setStatus("Admin-Bereich bereit.");
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Fehler beim Laden");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      if (options?.showSuccessModal !== false) {
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
        setSuccessModal({
          open: true,
          title: "Teilweise aktualisiert",
          message: failedItems.length > 0
            ? `Aktualisiert: ${applied}/${total}. Manuell prüfen: ${failedItems.join(", ")}`
            : `Aktualisiert: ${applied}/${total}. ${failed} Einträge konnten nicht automatisch übernommen werden.`,
        });
        return;
      }

      setStatus("Preise erfolgreich aktualisiert.");
      setSuccessModal({
        open: true,
        title: "Erfolgreich",
        message: `Preise wurden für alle ${total} Einträge aktualisiert.`,
      });
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
      setSuccessModal({
        open: true,
        title: "Zugangslink versendet",
        message:
          linkType === "invite"
            ? `Ein neuer Einladungslink wurde an ${email || "die Kontakt-E-Mail"} gesendet.`
            : `Ein neuer Passwort-Link wurde an ${email || "die Kontakt-E-Mail"} gesendet.`,
      });
      setStatus("Zugangslink versendet.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Zugangslink konnte nicht versendet werden.");
    } finally {
      setBusy(false);
    }
  }

  async function selectPartnerView(partnerId: string, view: AdminView) {
    if (!partnerId) return;
    setBusy(true);
    setStatus("Partner wird geladen...");
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
      setStatus("Partner geladen.");
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
      await loadAreaOverview();
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
    oldPartnerIsSystemDefault: boolean;
  }) {
    setBusy(true);
    setHandoverStatusModal({
      open: true,
      title: "Gebietsübergabe läuft",
      lines: [
        `Kreis: ${input.areaId}`,
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
        }),
      });
      setHandoverStatusModal((m) => ({
        ...m,
        lines: [
          ...m.lines,
          "2/4 Server-Übergabe abgeschlossen.",
          input.oldPartnerIsSystemDefault
            ? "Hinweis: Das Gebiet wurde vom Portalpartner auf einen operativen Partner überführt. Der Portalpartner bleibt dauerhaft aktiv."
            : `Alte Integrationen deaktiviert: ${result.handover?.deactivate_old_integrations_applied ? "Ja" : "Nein"}`,
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
      });

      setHandoverStatusModal((m) => ({
        ...m,
        title: "Gebietsübergabe abgeschlossen",
        lines: [
          ...m.lines,
          `Gebiet ${result.handover?.area_id ?? input.areaId} erfolgreich von ${input.oldPartnerId} an ${input.newPartnerId} übergeben!`,
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
        label={busy ? status : reviewBusy ? "Freigabeprüfung wird geladen..." : "Daten werden geladen..."}
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
              Kreis <strong>{handoverConfirmModal.areaId}</strong> wird von
              {" "}
              <strong>{selectedPartner?.company_name ?? handoverConfirmModal.oldPartnerId}</strong>
              {" "}an{" "}
              <strong>{partners.find((p) => p.id === handoverConfirmModal.newPartnerId)?.company_name ?? handoverConfirmModal.newPartnerId}</strong>
              {" "}übergeben.
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
                    await loadPartnerDetails(selectedPartnerId);
                    await loadAreaOverview();
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
              </>
            )}
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
      <header style={headerStyle}>
        <h1 style={{ margin: 0, fontSize: 24 }}>Admin Konsole</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            style={btnStyle}
            onClick={() => setActiveView("new_partner")}
          >
            Neuen Partner
          </button>
        </div>
      </header>

      <p style={statusStyle}>{status}</p>

      <div
        style={{
          ...adminLayoutStyle,
          gridTemplateColumns: (activeView === "llm_global" || activeView === "billing_defaults" || activeView === "portal_cms")
            ? "56px minmax(0, 1fr)"
            : adminLayoutStyle.gridTemplateColumns,
        }}
      >
        <aside style={modeBarStyle}>
          <button
            style={modeButtonStyle(activeView !== "llm_global" && activeView !== "billing_defaults" && activeView !== "portal_cms" && navMode === "partners")}
            onClick={() => {
              setNavMode("partners");
              if (activeView === "audit" || activeView === "llm_global" || activeView === "billing_defaults" || activeView === "portal_cms" || activeView === "partner_purge") setActiveView("home");
            }}
            title="Partner"
          >
            👥
            {pendingAreaAssignmentCount > 0 ? (
              <span
                aria-label={`${pendingAreaAssignmentCount} Partner ohne Gebietszuordnung`}
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#dc2626",
                }}
              />
            ) : null}
          </button>
          <button
            style={modeButtonStyle(activeView !== "llm_global" && activeView !== "billing_defaults" && activeView !== "portal_cms" && navMode === "areas")}
            onClick={() => {
              setNavMode("areas");
              if (activeView === "audit" || activeView === "llm_global" || activeView === "billing_defaults" || activeView === "portal_cms" || activeView === "partner_purge") setActiveView("home");
            }}
            title="Gebiete"
          >
            🗺
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
          >
            AI
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
          >
            €
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
          >
            🌐
          </button>
          <div style={{ flex: 1 }} />
          <button
            style={modeButtonStyle(activeView === "partner_purge")}
            onClick={() => {
              setNavMode("partners");
              setActiveView("partner_purge");
            }}
            title="Datenbereinigung"
          >
            🗑
          </button>
          <button
            style={modeButtonStyle(activeView === "audit")}
            onClick={() => setActiveView("audit")}
            title="Audit-Log"
          >
            🧾
          </button>
          <button
            style={modeButtonStyle(false)}
            onClick={async () => {
              await supabase.auth.signOut();
              router.push("/admin/login");
            }}
            title="Abmelden"
          >
            ⎋
          </button>
        </aside>

        {activeView !== "llm_global" && activeView !== "billing_defaults" && activeView !== "portal_cms" ? (
          <aside style={listPaneStyle}>
            <div style={sidebarSectionHeaderStyle}>{navMode === "partners" ? "Partnerübersicht" : "Gebietsübersicht"}</div>
            <div style={{ display: "grid", gap: 8, marginBottom: 10 }}>
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
            <div style={sidebarListStyle}>
              {navMode === "partners"
                ? filteredPartners.map((p) => (
                    <button
                      key={p.id}
                      style={listLinkRowStyle(selectedPartnerId === p.id)}
                      onClick={() => {
                        void selectSidebarPartner(p.id);
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                        <span>{formatPartnerName(p)}</span>
                        {partnerNeedsAssignment.has(p.id) ? (
                          <span
                            aria-label="Gebietszuordnung fehlt"
                            style={{
                              display: "inline-block",
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              background: "#dc2626",
                            }}
                          />
                        ) : null}
                      </div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>
                        {p.is_active ? "aktiv" : "inaktiv"}
                        {p.is_system_default ? " · Systempartner" : ""}
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
      {activeView === "home" ? (
      <section style={cardStyle}>
        <h2 style={h2Style}>Willkommen {adminDisplayName} in der Admin-Konsole</h2>
        <p style={mutedStyle}>
          Wähle links einen Partner oder ein Gebiet, um konkrete Verwaltungsaufgaben zu öffnen.
        </p>
      </section>
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
      <section style={cardStyle}>
        <h2 style={h2Style}>Partnerdetails</h2>
        <p style={{ margin: 0, color: "#475569" }}>
          {selectedPartner ? `${formatPartnerName(selectedPartner)} (${selectedPartner.id})` : "Bitte links einen Partner auswählen."}
        </p>
        {selectedPartner ? (
          <div style={partnerTabBarStyle}>
            <button style={partnerTabButtonStyle(partnerTab === "profile")} onClick={() => setPartnerTab("profile")}>Profil</button>
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
            <button style={partnerTabButtonStyle(partnerTab === "review")} onClick={() => setPartnerTab("review")}>
              Freigabeprüfung
              {pendingReviewCount > 0 ? (
                <span
                  aria-label={`${pendingReviewCount} neue Freigabeprüfung${pendingReviewCount === 1 ? "" : "en"}`}
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
            <button
              style={partnerTabButtonStyle(partnerTab === "integrations")}
              onClick={() => {
                setPartnerTab("integrations");
                setIntegrationsAdminTab("llm_partner");
              }}
            >
              Anbindungen
            </button>
            <button style={partnerTabButtonStyle(partnerTab === "billing")} onClick={() => setPartnerTab("billing")}>
              Abrechnung
            </button>
            <button style={partnerTabButtonStyle(partnerTab === "handover")} onClick={() => setPartnerTab("handover")}>Übergabe</button>
          </div>
        ) : null}
      </section>
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
                    await api(`/api/admin/partners/${selectedPartnerId}/areas`, {
                      method: "POST",
                      body: JSON.stringify({ area_id: assignAreaId.trim(), is_active: false }),
                    });
                    setAssignAreaId("");
                    setAreaQuery("");
                    await loadPartnerDetails(selectedPartnerId);
                    await loadAreaOverview();
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
                      <div>{row.mapping.areas?.name ?? row.displayKreisId}</div>
                      <small style={mutedStyle}>{row.displayKreisId}</small>
                    </td>
                    <td style={tdStyle}>
                      {formatAreaStateLabel(row.mapping.is_active, row.mapping.activation_status, Boolean(row.mapping.is_public_live))}
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          style={handoverLinkButtonStyle}
                          disabled={busy || !selectedPartner || row.derivedFromOrtslagen}
                          onClick={() => {
                            setPartnerTab("handover");
                            setHandoverDraft((prev) => ({
                              ...prev,
                              area_id: row.mapping.area_id,
                            }));
                            setStatus(`Übergabe vorbereitet: ${row.mapping.areas?.name ?? row.mapping.area_id}`);
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
          </>
        )}
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
                  {row.mapping.areas?.name ?? row.mapping.area_id} ({formatAreaStateLabel(row.mapping.is_active, row.mapping.activation_status, Boolean(row.mapping.is_public_live))})
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

        <div
          style={{
            marginTop: 12,
            border: "1px solid #cbd5e1",
            background: "#f8fafc",
            borderRadius: 10,
            padding: 12,
            display: "grid",
            gap: 10,
          }}
        >
          <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.55 }}>
            <strong>Visibility-Index neu publizieren</strong>
            {" "}
            Der öffentliche Immobilienmarkt liest die Sichtbarkeit nicht direkt aus dem Adminstatus, sondern aus dem publizierten
            {" "}
            <code>visibility_index.json</code>.
            {" "}
            Nach direkten SQL-Änderungen oder Altlasten im Live-/Preview-Workflow kann der Public-Stand deshalb veraltet sein, obwohl ein Gebiet im Admin bereits als online erscheint.
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button
              style={btnGhostStyle}
              disabled={busy || reviewBusy || visibilityIndexBusy}
              onClick={() =>
                run("Visibility-Index neu publizieren", async () => {
                  await rebuildVisibilityIndex();
                })
              }
            >
              {visibilityIndexBusy ? "Publikation läuft..." : "Visibility-Index neu publizieren"}
            </button>
            <span style={{ fontSize: 12, color: "#64748b" }}>
              Sinnvoll nach SQL-Korrekturen an <code>partner_area_map</code> oder wenn Public-URLs trotz korrektem Adminstatus noch 404 liefern.
            </span>
          </div>
        </div>

        {!reviewContentDismissed && reviewAreaOptions.length > 0 && reviewAreaId && reviewData ? (
          <>
            <div style={{ marginTop: 10, marginBottom: 10, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={reviewStatusBadgeStyle(currentReviewState)}>
                {formatAreaStateLabel(Boolean(reviewData.mapping?.is_active), reviewData.mapping?.activation_status, Boolean(reviewData.mapping?.is_public_live))}
              </span>
            </div>

            {!reviewData.mandatory?.ok && Array.isArray(reviewData.mandatory?.missing) && reviewData.mandatory?.missing.length > 0 ? (
              <div style={{ marginBottom: 10, fontSize: 12, color: "#991b1b" }}>
                {reviewData.mandatory.missing
                  .slice(0, 10)
                  .map((entry) => `${formatMandatoryKeyLabel(String(entry.key ?? ""))} (${entry.reason})`)
                  .join(", ")}
              </div>
            ) : null}

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

            {currentReviewState === "ready_for_review" || currentReviewState === "in_review" || currentReviewState === "changes_requested" ? (
              <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>Hinweis für Nachbesserung</div>
                <textarea
                  style={{ ...inputStyle, minHeight: 110, resize: "vertical" }}
                  value={reviewNoteDraft}
                  onChange={(e) => setReviewNoteDraft(e.target.value)}
                  placeholder="Hier eintragen, was bei Texten, Bildern oder anderen Pflichtangaben verbessert werden muss."
                />
              </div>
            ) : null}

            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {currentReviewState === "ready_for_review" || currentReviewState === "in_review" || currentReviewState === "changes_requested" ? (
                <>
                  <button
                    style={btnDangerStyle}
                    disabled={busy || reviewBusy || !reviewAreaId || reviewNoteDraft.trim().length === 0}
                    onClick={() =>
                      run("Nachbesserung anfordern", async () => {
                        await applyAreaReviewAction("changes_requested");
                      })
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
                        }, { clearReviewOnClose: true })
                      }
                    >
                      Preview freigeben
                    </button>
                  ) : null}
                </>
              ) : null}
              {currentReviewState === "approved_preview" ? (
                <>
                  <div
                    style={{
                      width: "100%",
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
                      }, { clearReviewOnClose: true })
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
                    })
                  }
                >
                  Offline nehmen
                </button>
              ) : null}
            </div>
            {reviewActionError ? (
              <div style={{ marginTop: 8, fontSize: 12, color: "#991b1b" }}>
                {reviewActionError}
              </div>
            ) : null}
            {reviewActionMessage ? (
              <div style={{ marginTop: 8, fontSize: 12, color: "#166534" }}>
                {reviewActionMessage}
              </div>
            ) : null}
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
                {opt.label} ({opt.id})
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
          <div style={{ fontSize: 12, color: "#334155" }}>
            <strong>Vorschau:</strong>{" "}
            {selectedPartner && handoverDraft.area_id && handoverTargetPartner
              ? `${handoverDraft.area_id} von ${formatPartnerName(selectedPartner)} zu ${formatPartnerName(handoverTargetPartner)}`
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
                oldPartnerId: selectedPartnerId,
                newPartnerId: handoverDraft.new_partner_id,
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
          <div style={grid3Style}>
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
          <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>Features (Partner-Override)</div>
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
              Features speichern
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

      {activeView === "portal_cms" ? (
      <section style={cardStyle}>
        <h2 style={h2Style}>Portal-CMS</h2>
        <p style={mutedStyle}>
          Globale Sprachen, statische Portalinhalte und die zentrale Freigabe portalweiter Locales. Partner koennen spaeter nur Sprachen nutzen, die hier global gepflegt und freigegeben sind.
        </p>

        <div style={{ marginTop: 12, padding: 12, border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc" }}>
          <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>Globale Sprachfreigabe</div>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Locale</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Aktiv</th>
                <th style={thStyle}>Partner buchbar</th>
              </tr>
            </thead>
            <tbody>
              {portalLocaleConfigs.map((row, idx) => (
                <tr key={row.locale}>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 700, color: "#0f172a" }}>{row.locale}</div>
                    <div style={mutedStyle}>{formatPortalLocaleStatus(row.status)}</div>
                  </td>
                  <td style={tdStyle}>
                    <select
                      style={inputStyle}
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
                    <input
                      type="checkbox"
                      checked={row.is_active}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setPortalLocaleConfigs((prev) => prev.map((item, itemIdx) => itemIdx === idx ? { ...item, is_active: checked } : item));
                      }}
                    />
                  </td>
                  <td style={tdStyle}>
                    <input
                      type="checkbox"
                      checked={row.partner_bookable}
                      disabled={row.status !== "live"}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setPortalLocaleConfigs((prev) => prev.map((item, itemIdx) => itemIdx === idx ? { ...item, partner_bookable: checked } : item));
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ ...rowStyle, marginTop: 10 }}>
            <div style={{ ...mutedStyle, fontSize: 12 }}>
              Nur `live`-Locales sollten partnerbuchbar werden. `internal` ist fuer QA und inhaltliche Pruefung gedacht.
            </div>
            <button
              style={btnStyle}
              disabled={busy}
              onClick={() =>
                run("Portal-Locales speichern", async () => {
                  await api("/api/admin/portal-content", {
                    method: "POST",
                    body: JSON.stringify({ locale_configs: portalLocaleConfigs }),
                  });
                  await loadPortalCms();
                })
              }
            >
              Sprachen speichern
            </button>
          </div>
        </div>

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

          {selectedPortalCmsPage ? (
            <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
              {selectedPortalCmsPage.sections.map((section) => {
                const draftKey = `${portalCmsLocale}::${selectedPortalCmsPage.page_key}::${section.section_key}`;
                const draft = portalCmsDrafts[draftKey] ?? {
                  status: "draft" as PortalContentEntryStatus,
                  fields_json: buildPortalCmsEmptyFields(section),
                };
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
                      </div>
                      <div style={{ minWidth: 140 }}>
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
                      </div>
                    </div>

                    <div style={{ display: "grid", gap: 10 }}>
                      {section.fields.map((field) => (
                        <label key={field.key}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>{field.label}</div>
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
                      ))}
                    </div>

                    <div style={{ marginTop: 8, fontSize: 11, color: "#64748b" }}>
                      Status in dieser Locale: <strong>{formatPortalEntryStatus(draft.status)}</strong>
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
      <section style={cardStyle}>
        <h2 style={h2Style}>Billing-Standards</h2>
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
          <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>Feature-Katalog</div>
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
      <section style={cardStyle}>
        <h2 style={h2Style}>Globale LLM-Verwaltung</h2>
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
    </div>
  );
}

const wrapStyle: React.CSSProperties = {
  width: "100%",
  margin: 0,
  padding: "16px 16px 32px 0",
  color: "#0f172a",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 10,
};

const statusStyle: React.CSSProperties = {
  background: "#f1f5f9",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: "10px 12px",
  marginBottom: 16,
};

const adminLayoutStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "56px 320px minmax(0, 1fr)",
  gap: 0,
  alignItems: "stretch",
  minHeight: "calc(100vh - 120px)",
};

const modeBarStyle: React.CSSProperties = {
  background: "rgb(72, 107, 122)",
  padding: 6,
  display: "flex",
  flexDirection: "column",
  gap: 6,
  position: "sticky",
  top: 0,
  minHeight: "calc(100vh - 120px)",
};

const modeButtonStyle = (active: boolean): React.CSSProperties => ({
  position: "relative",
  width: "100%",
  height: 44,
  border: `1px solid ${active ? "#facc15" : "rgba(255,255,255,0.25)"}`,
  borderRadius: 8,
  background: active ? "rgba(15, 23, 42, 0.35)" : "rgba(255,255,255,0.08)",
  color: "#ffffff",
  cursor: "pointer",
  fontSize: 16,
  fontWeight: 700,
});

const listPaneStyle: React.CSSProperties = {
  position: "sticky",
  top: 0,
  alignSelf: "start",
  borderRight: "1px solid #e2e8f0",
  borderTop: "1px solid #e2e8f0",
  borderBottom: "1px solid #e2e8f0",
  background: "#ffffff",
  padding: 12,
  maxHeight: "calc(100vh - 80px)",
  overflowY: "auto",
};

const sidebarSectionHeaderStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 0.2,
  textTransform: "uppercase",
  color: "#475569",
  marginBottom: 8,
};

const sidebarListStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const contentPaneStyle: React.CSSProperties = {
  minWidth: 0,
  padding: "0 0 0 14px",
};

const listLinkRowStyle = (active: boolean): React.CSSProperties => ({
  width: "100%",
  textAlign: "left",
  border: `1px solid ${active ? "#0f766e" : "#e2e8f0"}`,
  borderRadius: 8,
  background: active ? "#f0fdfa" : "#ffffff",
  padding: "10px 12px",
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  gap: 2,
});

const cardStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  background: "#ffffff",
  padding: 16,
  marginBottom: 16,
};

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
