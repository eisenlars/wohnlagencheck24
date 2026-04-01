import { NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { getI18nStandardPrompt } from "@/lib/i18n-prompts";
import { buildMarketingDefaults } from "@/lib/marketing-defaults";
import { resolveMarketingContextForArea } from "@/lib/areas/marketing-context";
import { checkRateLimitPersistent, extractClientIpFromHeaders } from "@/lib/security/rate-limit";
import { validateOutboundUrl } from "@/lib/security/outbound-url";
import { readSecretFromAuthConfig } from "@/lib/security/secret-crypto";
import { loadActiveGlobalLlmProviders, loadGlobalLlmConfig, estimateCostEur, estimateCostUsd, writeLlmUsageEvent } from "@/lib/llm/global-governance";
import type { DisplayTextClass } from "@/lib/text-display-class";

type TextSourceRow = {
  area_id?: string | null;
  section_key?: string | null;
  optimized_content?: string | null;
  status?: string | null;
  last_updated?: string | null;
};

type TranslationRow = {
  area_id?: string | null;
  section_key?: string | null;
  translated_content?: string | null;
  status?: string | null;
  updated_at?: string | null;
  source_snapshot_hash?: string | null;
  source_last_updated?: string | null;
};

type UpsertInputRow = {
  section_key?: string;
  translated_content?: string | null;
  status?: "draft" | "approved" | "needs_review";
};

type UpsertBody = {
  area_id?: string;
  locale?: string;
  channel?: "portal" | "local_site" | "marketing";
  rows?: UpsertInputRow[];
};

type TranslationPricingPreview = {
  provider: string | null;
  model: string | null;
  input_cost_usd_per_1k: number | null;
  output_cost_usd_per_1k: number | null;
  fx_rate_usd_to_eur: number | null;
};

type BillingFeatureCatalogRow = {
  code?: string | null;
  default_enabled?: boolean | null;
};

type PartnerFeatureOverrideRow = {
  feature_code?: string | null;
  is_enabled?: boolean | null;
};

type SourceEntry = {
  content: string;
  status: string;
  updated_at: string | null;
};

type AreaResponseRow = {
  section_key: string;
  source_content_de: string;
  source_status: string;
  source_updated_at: string | null;
  source_snapshot_hash: string;
  translated_content: string | null;
  translated_status: string | null;
  translated_updated_at: string | null;
  translated_source_snapshot_hash: string | null;
  translated_source_last_updated: string | null;
  translation_is_stale: boolean;
  effective_content: string;
  effective_source: "translation" | "de_fallback";
};

type AreaSummary = {
  total: number;
  translated_approved: number;
  fallback_de: number;
  auto_synced: number;
  auto_sync_failed: number;
  mock_mode: boolean;
  pricing_preview: TranslationPricingPreview | null;
};

type AutoSyncContext = {
  pricingPreview: TranslationPricingPreview | null;
  provider:
    | {
        provider: string;
        model: string;
        base_url: string;
        api_version?: string | null;
        temperature?: number | null;
        max_tokens?: number | null;
        input_cost_eur_per_1k: number | null;
        output_cost_eur_per_1k: number | null;
        input_cost_usd_per_1k: number | null;
        output_cost_usd_per_1k: number | null;
        provider_account_id?: string | null;
        provider_model_id?: string | null;
        fx_rate_usd_to_eur?: number | null;
        auth_config?: Record<string, unknown> | null;
      }
    | null;
  apiKey: string | null;
  providerSupported: boolean;
};

const RATE_LIMIT = { windowMs: 60 * 1000, max: 120 };
const SUPABASE_BUCKET = "immobilienmarkt";
const AUTO_SYNC_MAX_ROWS = 12;
const I18N_MOCK_TRANSLATION = String(process.env.I18N_MOCK_TRANSLATION ?? "").trim() === "1";

function isMissingTable(error: unknown, table: string): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return msg.includes(`public.${table}`) && msg.includes("does not exist");
}

function isI18nChannelConstraintError(error: unknown): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return (
    msg.includes("partner_texts_i18n")
    && msg.includes("channel")
    && (msg.includes("check constraint") || msg.includes("violates"))
  );
}

function asText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeLocale(input: string): string | null {
  const raw = asText(input).toLowerCase().replace("_", "-");
  if (!raw) return null;
  if (!/^[a-z]{2}(-[a-z]{2})?$/.test(raw)) return null;
  return raw;
}

function parseSectionKeys(input: string | null): string[] {
  const raw = asText(input);
  if (!raw) return [];
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((part) => asText(part))
        .filter(Boolean),
    ),
  );
}

function parseAreaIds(input: string | null): string[] {
  const raw = asText(input);
  if (!raw) return [];
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((part) => asText(part))
        .filter(Boolean),
    ),
  );
}

function normalizeIso(value: string | null): string | null {
  const raw = asText(value);
  if (!raw) return null;
  const ts = Date.parse(raw);
  if (!Number.isFinite(ts)) return null;
  return new Date(ts).toISOString();
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function usesCompletionTokens(provider: string, model: string | null): boolean {
  const normalizedProvider = String(provider ?? "").trim().toLowerCase();
  const normalizedModel = String(model ?? "").trim().toLowerCase();
  if (!normalizedModel) return false;
  if (normalizedProvider !== "openai" && normalizedProvider !== "azure_openai") return false;
  return normalizedModel.startsWith("gpt-5");
}

function hashText(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return `fnv1a32_${(hash >>> 0).toString(16)}`;
}

function isAutoManagedSectionKey(sectionKey: string): boolean {
  const key = asText(sectionKey).toLowerCase();
  if (!key) return false;
  if (
    key.endsWith("_name")
    || key.endsWith("_email")
    || key.includes("telefon")
    || key.includes("adresse_")
    || key.endsWith("_plz")
    || key.endsWith("_hnr")
    || key.includes("logo")
    || key.includes("avatar")
    || key.includes("bild")
    || key.includes("image")
  ) return false;
  return true;
}

function normalizeDisplayTextClass(value: string): DisplayTextClass {
  if (value === "data_driven") return "data_driven";
  if (value === "profile") return "profile";
  if (value === "marketing") return "marketing";
  if (value === "market_expert") return "market_expert";
  return "general";
}

function buildAutoTranslationPrompt(
  locale: string,
  sourceText: string,
  displayClass: DisplayTextClass,
  promptTemplate?: string | null,
) {
  const target = locale.toUpperCase();
  const baseInstructions = asText(promptTemplate) || getI18nStandardPrompt(displayClass, locale);
  return {
    system: "You are a professional translator for real-estate and location market reports.",
    user:
      `${baseInstructions}\n\nTranslate from German to ${target}. Preserve all facts, numbers, structure and meaning exactly. ` +
      `Do not invent details. Keep style clear and neutral.\n\nSource:\n${sourceText}`,
  };
}

function buildMockTranslation(locale: string, sourceText: string): string {
  const text = asText(sourceText);
  if (!text) return "";
  const tag = normalizeLocale(locale)?.toUpperCase() ?? "XX";
  return `[${tag} MOCK] ${text}`;
}

function roundTiming(value: number): number {
  return Number(value.toFixed(2));
}

async function callOpenAiCompatible(args: {
  provider: string;
  model: string;
  baseUrl: string;
  apiKey: string;
  apiVersion?: string | null;
  system: string;
  user: string;
  temperature?: number | null;
  maxTokens?: number | null;
}) {
  const validated = await validateOutboundUrl(args.baseUrl);
  if (!validated.ok) throw new Error("AUTO_SYNC_URL_BLOCKED");

  const provider = args.provider.toLowerCase();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${args.apiKey}`,
  };

  let endpoint = `${validated.url.replace(/\/+$/, "")}/chat/completions`;
  if (provider === "azure_openai") {
    const version = asText(args.apiVersion) || "2024-10-21";
    endpoint = `${validated.url.replace(/\/+$/, "")}/chat/completions?api-version=${encodeURIComponent(version)}`;
    headers["api-key"] = args.apiKey;
    delete headers.Authorization;
  }

  const body = {
    model: args.model,
    temperature: args.temperature ?? 0.2,
    ...(usesCompletionTokens(provider, args.model)
      ? { max_completion_tokens: args.maxTokens ?? 1200 }
      : { max_tokens: args.maxTokens ?? 1200 }),
    messages: [
      { role: "system", content: args.system },
      { role: "user", content: args.user },
    ],
  };

  const res = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`AUTO_SYNC_HTTP_${res.status}`);
  const payload = await res.json().catch(() => null) as Record<string, unknown> | null;
  const choices = Array.isArray(payload?.choices) ? payload?.choices as Array<Record<string, unknown>> : [];
  const content = asText((choices[0]?.message as Record<string, unknown> | undefined)?.content);
  if (!content) throw new Error("AUTO_SYNC_EMPTY");
  const usage = (payload?.usage ?? {}) as Record<string, unknown>;
  return {
    content,
    promptTokens: asFiniteNumber(usage.prompt_tokens),
    completionTokens: asFiniteNumber(usage.completion_tokens),
    totalTokens: asFiniteNumber(usage.total_tokens),
  };
}

async function requirePartnerUser(req: Request): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) throw new Error("UNAUTHORIZED");

  const ip = extractClientIpFromHeaders(req.headers);
  const limit = await checkRateLimitPersistent(
    `partner_i18n_texts:${user.id}:${ip}`,
    RATE_LIMIT,
  );
  if (!limit.allowed) throw new Error(`RATE_LIMIT:${limit.retryAfterSec}`);
  return user.id;
}

async function requireInternationalFeatureEnabled(
  admin: ReturnType<typeof createAdminClient>,
  partnerId: string,
): Promise<void> {
  const [catalogRes, overridesRes] = await Promise.all([
    admin
      .from("billing_feature_catalog")
      .select("code, default_enabled")
      .eq("is_active", true)
      .ilike("code", "international%"),
    admin
      .from("partner_feature_overrides")
      .select("feature_code, is_enabled")
      .eq("partner_id", partnerId)
      .ilike("feature_code", "international%"),
  ]);

  if (catalogRes.error) throw catalogRes.error;
  if (overridesRes.error) throw overridesRes.error;

  const catalogRows = (catalogRes.data ?? []) as BillingFeatureCatalogRow[];
  const overrideByCode = new Map(
    ((overridesRes.data ?? []) as PartnerFeatureOverrideRow[])
      .map((row) => [asText(row.feature_code).toLowerCase(), row] as const)
      .filter(([code]) => code.length > 0),
  );

  const hasInternationalEnabled = catalogRows.some((row) => {
    const code = asText(row.code).toLowerCase();
    if (!code.startsWith("international")) return false;
    const override = overrideByCode.get(code);
    return override?.is_enabled ?? row.default_enabled ?? false;
  });

  if (!hasInternationalEnabled) throw new Error("INTERNATIONAL_FEATURE_DISABLED");
}

function selectLatestSource(rows: TextSourceRow[]): Map<string, { content: string; status: string; updated_at: string | null }> {
  const byKey = new Map<string, TextSourceRow[]>();
  for (const row of rows) {
    const key = asText(row.section_key);
    const content = asText(row.optimized_content);
    if (!key || !content) continue;
    const list = byKey.get(key) ?? [];
    list.push(row);
    byKey.set(key, list);
  }

  const out = new Map<string, { content: string; status: string; updated_at: string | null }>();
  for (const [key, group] of byKey) {
    const pickFrom = group.filter((r) => asText(r.optimized_content).length > 0);
    pickFrom.sort((a, b) => {
      const aTs = Date.parse(asText(a.last_updated));
      const bTs = Date.parse(asText(b.last_updated));
      return (Number.isFinite(bTs) ? bTs : 0) - (Number.isFinite(aTs) ? aTs : 0);
    });
    const picked = pickFrom[0] ?? group[0];
    out.set(key, {
      content: asText(picked.optimized_content),
      status: asText(picked.status).toLowerCase() || "draft",
      updated_at: normalizeIso(asText(picked.last_updated) || null),
    });
  }
  return out;
}

type AreaMetaRow = {
  id?: string | null;
  slug?: string | null;
  parent_slug?: string | null;
  bundesland_slug?: string | null;
};

function flattenRawTextObject(rawText: unknown): Map<string, string> {
  const out = new Map<string, string>();
  if (!rawText || typeof rawText !== "object") return out;
  for (const group of Object.values(rawText as Record<string, unknown>)) {
    if (!group || typeof group !== "object") continue;
    for (const [sectionKey, value] of Object.entries(group as Record<string, unknown>)) {
      const text = asText(value);
      if (!sectionKey || !text) continue;
      out.set(sectionKey, text);
    }
  }
  return out;
}

async function loadAreaMetaMany(
  admin: ReturnType<typeof createAdminClient>,
  areaIds: string[],
): Promise<Map<string, AreaMetaRow>> {
  const ids = Array.from(new Set(areaIds.map((id) => asText(id)).filter(Boolean)));
  if (ids.length === 0) return new Map();
  const { data, error } = await admin
    .from("areas")
    .select("id, slug, parent_slug, bundesland_slug")
    .in("id", ids);
  if (error) throw error;
  return new Map(
    ((data ?? []) as AreaMetaRow[])
      .map((row) => [asText(row.id), row] as const)
      .filter(([id]) => Boolean(id)) as Array<[string, AreaMetaRow]>,
  );
}

async function loadRawSourceByMeta(
  admin: ReturnType<typeof createAdminClient>,
  areaId: string,
  meta: AreaMetaRow | null | undefined,
): Promise<Map<string, SourceEntry>> {
  if (!meta) return new Map();

  const slug = asText(meta.slug);
  const parentSlug = asText(meta.parent_slug);
  const bundeslandSlug = asText(meta.bundesland_slug);
  if (!slug || !bundeslandSlug) return new Map();

  const isDistrict = areaId.split("-").length <= 3;
  const path = isDistrict
    ? ["reports", "deutschland", bundeslandSlug, `${slug}.json`].join("/")
    : ["reports", "deutschland", bundeslandSlug, parentSlug, `${slug}.json`].join("/");

  const { data, error } = await admin.storage.from(SUPABASE_BUCKET).download(path);
  if (error || !data) return new Map();
  try {
    const text = await data.text();
    const parsed = JSON.parse(text) as { text?: unknown };
    const flat = flattenRawTextObject(parsed?.text);
    const out = new Map<string, { content: string; status: string; updated_at: string | null }>();
    for (const [sectionKey, content] of flat) {
      out.set(sectionKey, { content, status: "raw", updated_at: null });
    }
    return out;
  } catch {
    return new Map();
  }
}

async function loadPortalSourceRows(
  admin: ReturnType<typeof createAdminClient>,
  partnerId: string,
  areaIds: string[],
) {
  if (areaIds.length === 0) return [] as TextSourceRow[];
  const { data, error } = await admin
    .from("report_texts")
    .select("area_id, section_key, optimized_content, status, last_updated")
    .eq("partner_id", partnerId)
    .in("area_id", areaIds);
  if (error) throw error;
  return (data ?? []) as TextSourceRow[];
}

async function loadLocalSiteSourceRows(
  admin: ReturnType<typeof createAdminClient>,
  partnerId: string,
  areaIds: string[],
) {
  if (areaIds.length === 0) {
    return { local: [] as TextSourceRow[], report: [] as TextSourceRow[] };
  }
  const [localRes, reportRes] = await Promise.all([
    admin
      .from("partner_local_site_texts")
      .select("area_id, section_key, optimized_content, status, last_updated")
      .eq("partner_id", partnerId)
      .in("area_id", areaIds),
    admin
      .from("report_texts")
      .select("area_id, section_key, optimized_content, status, last_updated")
      .eq("partner_id", partnerId)
      .in("area_id", areaIds),
  ]);

  if (localRes.error && !isMissingTable(localRes.error, "partner_local_site_texts")) throw localRes.error;
  if (reportRes.error) throw reportRes.error;

  return {
    local: (localRes.data ?? []) as TextSourceRow[],
    report: (reportRes.data ?? []) as TextSourceRow[],
  };
}

function flattenMarketingDefaults(marketing: Record<string, Record<string, unknown>>): Map<string, { content: string; status: string; updated_at: string | null }> {
  const out = new Map<string, { content: string; status: string; updated_at: string | null }>();
  for (const [section, fields] of Object.entries(marketing ?? {})) {
    if (!fields || typeof fields !== "object") continue;
    for (const [field, value] of Object.entries(fields)) {
      const content = asText(value);
      if (!content) continue;
      out.set(`marketing.${section}.${field}`, {
        content,
        status: "raw",
        updated_at: null,
      });
    }
  }
  return out;
}

async function loadMarketingSourceByArea(
  admin: ReturnType<typeof createAdminClient>,
  areaId: string,
  baseRows: TextSourceRow[],
): Promise<Map<string, { content: string; status: string; updated_at: string | null }>> {
  const out = new Map<string, { content: string; status: string; updated_at: string | null }>();
  const context = await resolveMarketingContextForArea({ admin, areaId });
  if (context) {
    const defaults = buildMarketingDefaults(context);
    const defaultsMap = flattenMarketingDefaults(defaults as unknown as Record<string, Record<string, unknown>>);
    for (const [key, value] of defaultsMap.entries()) out.set(key, value);
  }
  const byKey = selectLatestSource(baseRows);
  for (const [key, value] of byKey.entries()) out.set(key, value);
  return out;
}

async function loadMarketingSourceRowsMany(
  admin: ReturnType<typeof createAdminClient>,
  partnerId: string,
  areaIds: string[],
) {
  if (areaIds.length === 0) return [] as TextSourceRow[];
  const { data, error } = await admin
    .from("partner_marketing_texts")
    .select("area_id, section_key, optimized_content, status, last_updated")
    .eq("partner_id", partnerId)
    .in("area_id", areaIds);
  if (error && !isMissingTable(error, "partner_marketing_texts")) throw error;
  return (data ?? []) as TextSourceRow[];
}

async function buildMarketingSourceMapsByArea(
  admin: ReturnType<typeof createAdminClient>,
  partnerId: string,
  areaIds: string[],
): Promise<Map<string, Map<string, SourceEntry>>> {
  const marketingRows = await loadMarketingSourceRowsMany(admin, partnerId, areaIds);
  const marketingRowsByArea = groupRowsByArea(marketingRows);
  const entries = await Promise.all(areaIds.map(async (areaId) => (
    [areaId, await loadMarketingSourceByArea(admin, areaId, marketingRowsByArea.get(areaId) ?? [])] as const
  )));
  return new Map(entries);
}

function groupRowsByArea<T extends { area_id?: string | null }>(rows: T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const areaId = asText(row.area_id);
    if (!areaId) continue;
    const list = grouped.get(areaId) ?? [];
    list.push(row);
    grouped.set(areaId, list);
  }
  return grouped;
}

async function buildAutoSyncContext(autoSyncEnabled: boolean): Promise<AutoSyncContext> {
  let provider:
    | {
        provider: string;
        model: string;
        base_url: string;
        api_version?: string | null;
        temperature?: number | null;
        max_tokens?: number | null;
        input_cost_eur_per_1k: number | null;
        output_cost_eur_per_1k: number | null;
        input_cost_usd_per_1k: number | null;
        output_cost_usd_per_1k: number | null;
        provider_account_id?: string | null;
        provider_model_id?: string | null;
        fx_rate_usd_to_eur?: number | null;
        auth_config?: Record<string, unknown> | null;
      }
    | null = null;
  let pricingPreview: TranslationPricingPreview | null = null;
  let apiKey: string | null = null;
  let providerSupported = false;

  try {
    const globalProviders = await loadActiveGlobalLlmProviders();
    provider = globalProviders.providers[0] ?? null;
    pricingPreview = provider
      ? {
          provider: provider.provider,
          model: provider.model,
          input_cost_usd_per_1k: provider.input_cost_usd_per_1k,
          output_cost_usd_per_1k: provider.output_cost_usd_per_1k,
          fx_rate_usd_to_eur: provider.fx_rate_usd_to_eur ?? null,
        }
      : null;
    apiKey = provider ? readSecretFromAuthConfig(provider.auth_config ?? null, "api_key") : null;
    providerSupported = provider
      ? ["openai", "mistral", "azure_openai", "generic_llm"].includes(String(provider.provider ?? "").toLowerCase())
      : false;
  } catch {
    pricingPreview = null;
    provider = null;
    apiKey = null;
    providerSupported = false;
  }

  if (autoSyncEnabled && !I18N_MOCK_TRANSLATION) {
    const globalCfg = await loadGlobalLlmConfig();
    if (!globalCfg.config.central_enabled) {
      return {
        pricingPreview,
        provider: null,
        apiKey: null,
        providerSupported: false,
      };
    }
  }

  return {
    pricingPreview,
    provider,
    apiKey,
    providerSupported,
  };
}

async function buildAreaPayload(args: {
  admin: ReturnType<typeof createAdminClient>;
  partnerId: string;
  areaId: string;
  channel: "portal" | "local_site" | "marketing";
  locale: string;
  sectionKeysFilter: Set<string>;
  workflowClass: DisplayTextClass;
  promptTemplate: string;
  autoSyncEnabled: boolean;
  autoSyncContext: AutoSyncContext;
  sourceByKey: Map<string, SourceEntry>;
  translations: TranslationRow[];
}): Promise<{ area_id: string; rows: AreaResponseRow[]; summary: AreaSummary }> {
  const {
    admin,
    partnerId,
    areaId,
    channel,
    locale,
    sectionKeysFilter,
    workflowClass,
    promptTemplate,
    autoSyncEnabled,
    autoSyncContext,
    sourceByKey,
    translations,
  } = args;
  const transByKey = new Map<string, TranslationRow>();
  for (const row of translations) {
    const key = asText(row.section_key);
    if (key) transByKey.set(key, row);
  }

  let autoSynced = 0;
  let autoSyncFailed = 0;

  if (autoSyncEnabled) {
    const provider = autoSyncContext.provider;
    if (
      I18N_MOCK_TRANSLATION
      || (provider && autoSyncContext.apiKey && autoSyncContext.providerSupported)
    ) {
      const keys = Array.from(sourceByKey.keys()).filter((sectionKey) => (
        sectionKeysFilter.size === 0 || sectionKeysFilter.has(sectionKey)
      ));
      const candidates = keys.filter((sectionKey) => {
        if (!isAutoManagedSectionKey(sectionKey)) return false;
        const source = sourceByKey.get(sectionKey);
        if (!source || !asText(source.content)) return false;
        const existing = transByKey.get(sectionKey);
        const translated = asText(existing?.translated_content);
        const currentHash = hashText(source.content);
        const storedHash = asText(existing?.source_snapshot_hash);
        if (!translated) return true;
        return !storedHash || storedHash !== currentHash;
      }).slice(0, AUTO_SYNC_MAX_ROWS);

      for (const sectionKey of candidates) {
        const source = sourceByKey.get(sectionKey);
        if (!source) continue;
        try {
          const result = I18N_MOCK_TRANSLATION
            ? {
                content: buildMockTranslation(locale, source.content),
                promptTokens: null,
                completionTokens: null,
                totalTokens: null,
              }
            : await (async () => {
                const prompt = buildAutoTranslationPrompt(locale, source.content, workflowClass, promptTemplate);
                return callOpenAiCompatible({
                  provider: provider!.provider,
                  model: provider!.model,
                  baseUrl: provider!.base_url,
                  apiKey: autoSyncContext.apiKey!,
                  apiVersion: provider!.api_version,
                  system: prompt.system,
                  user: prompt.user,
                  temperature: provider!.temperature,
                  maxTokens: provider!.max_tokens,
                });
              })();
          const sourceHash = hashText(source.content);
          const upsertRow = {
            partner_id: partnerId,
            area_id: areaId,
            section_key: sectionKey,
            channel,
            target_locale: locale,
            translated_content: result.content,
            status: "approved",
            source_snapshot_hash: sourceHash,
            source_last_updated: normalizeIso(source.updated_at ?? null),
            updated_at: new Date().toISOString(),
          };
          const { error: upsertError } = await admin
            .from("partner_texts_i18n")
            .upsert(upsertRow, { onConflict: "partner_id,area_id,section_key,channel,target_locale" });
          if (upsertError) throw upsertError;

          transByKey.set(sectionKey, {
            area_id: areaId,
            section_key: sectionKey,
            translated_content: result.content,
            status: "approved",
            updated_at: upsertRow.updated_at,
            source_snapshot_hash: sourceHash,
            source_last_updated: upsertRow.source_last_updated,
          });

          const estimated = estimateCostEur({
            promptTokens: result.promptTokens,
            completionTokens: result.completionTokens,
            inputCostEurPer1k: provider?.input_cost_eur_per_1k ?? null,
            outputCostEurPer1k: provider?.output_cost_eur_per_1k ?? null,
          });
          const estimatedUsd = estimateCostUsd({
            promptTokens: result.promptTokens,
            completionTokens: result.completionTokens,
            inputCostUsdPer1k: provider?.input_cost_usd_per_1k ?? null,
            outputCostUsdPer1k: provider?.output_cost_usd_per_1k ?? null,
          });
          await writeLlmUsageEvent({
            partner_id: partnerId,
            route_name: "partner-i18n-auto-sync",
            mode: "central_managed",
            provider: I18N_MOCK_TRANSLATION ? "mock" : provider!.provider,
            model: I18N_MOCK_TRANSLATION ? "mock-i18n" : provider!.model,
            prompt_tokens: result.promptTokens,
            completion_tokens: result.completionTokens,
            total_tokens: result.totalTokens,
            provider_account_id: I18N_MOCK_TRANSLATION ? null : (provider?.provider_account_id ?? null),
            provider_model_id: I18N_MOCK_TRANSLATION ? null : (provider?.provider_model_id ?? null),
            fx_rate_usd_to_eur: I18N_MOCK_TRANSLATION ? null : (provider?.fx_rate_usd_to_eur ?? null),
            input_cost_usd_per_1k_snapshot: I18N_MOCK_TRANSLATION ? null : (provider?.input_cost_usd_per_1k ?? null),
            output_cost_usd_per_1k_snapshot: I18N_MOCK_TRANSLATION ? null : (provider?.output_cost_usd_per_1k ?? null),
            estimated_cost_usd: estimatedUsd,
            estimated_cost_eur: estimated,
            status: "ok",
            error_code: null,
          });
          autoSynced += 1;
        } catch {
          autoSyncFailed += 1;
          await writeLlmUsageEvent({
            partner_id: partnerId,
            route_name: "partner-i18n-auto-sync",
            mode: "central_managed",
            provider: I18N_MOCK_TRANSLATION ? "mock" : (autoSyncContext.provider?.provider ?? "unknown"),
            model: I18N_MOCK_TRANSLATION ? "mock-i18n" : (autoSyncContext.provider?.model ?? "unknown"),
            prompt_tokens: null,
            completion_tokens: null,
            total_tokens: null,
            provider_account_id: I18N_MOCK_TRANSLATION ? null : (autoSyncContext.provider?.provider_account_id ?? null),
            provider_model_id: I18N_MOCK_TRANSLATION ? null : (autoSyncContext.provider?.provider_model_id ?? null),
            fx_rate_usd_to_eur: I18N_MOCK_TRANSLATION ? null : (autoSyncContext.provider?.fx_rate_usd_to_eur ?? null),
            input_cost_usd_per_1k_snapshot: I18N_MOCK_TRANSLATION ? null : (autoSyncContext.provider?.input_cost_usd_per_1k ?? null),
            output_cost_usd_per_1k_snapshot: I18N_MOCK_TRANSLATION ? null : (autoSyncContext.provider?.output_cost_usd_per_1k ?? null),
            estimated_cost_usd: null,
            estimated_cost_eur: null,
            status: "error",
            error_code: "AUTO_SYNC_FAILED",
          });
        }
      }
    }
  }

  const keys = channel === "marketing"
    ? new Set(Array.from(sourceByKey.keys()).filter((sectionKey) => sectionKey.startsWith("marketing.")))
    : new Set([...sourceByKey.keys(), ...transByKey.keys()]);
  const rows = Array.from(keys)
    .sort((a, b) => a.localeCompare(b, "de"))
    .map((sectionKey) => {
      const source = sourceByKey.get(sectionKey);
      const trans = transByKey.get(sectionKey);
      const translatedContent = asText(trans?.translated_content);
      const translatedStatus = asText(trans?.status).toLowerCase();
      const useTranslation = translatedStatus === "approved" && translatedContent.length > 0;
      const currentHash = hashText(source?.content ?? "");
      const storedHash = asText(trans?.source_snapshot_hash);
      const isStale = Boolean(storedHash) && storedHash !== currentHash;
      return {
        section_key: sectionKey,
        source_content_de: source?.content ?? "",
        source_status: source?.status ?? "raw",
        source_updated_at: source?.updated_at ?? null,
        source_snapshot_hash: currentHash,
        translated_content: translatedContent || null,
        translated_status: translatedStatus || null,
        translated_updated_at: asText(trans?.updated_at) || null,
        translated_source_snapshot_hash: storedHash || null,
        translated_source_last_updated: normalizeIso(asText(trans?.source_last_updated) || null),
        translation_is_stale: isStale,
        effective_content: useTranslation ? translatedContent : (source?.content ?? ""),
        effective_source: useTranslation ? "translation" : "de_fallback",
      } satisfies AreaResponseRow;
    });

  return {
    area_id: areaId,
    rows,
    summary: {
      total: rows.length,
      translated_approved: rows.filter((row) => row.effective_source === "translation").length,
      fallback_de: rows.filter((row) => row.effective_source === "de_fallback").length,
      auto_synced: autoSynced,
      auto_sync_failed: autoSyncFailed,
      mock_mode: I18N_MOCK_TRANSLATION,
      pricing_preview: autoSyncContext.pricingPreview,
    },
  };
}

export async function GET(req: Request) {
  try {
    const requestStartedAt = performance.now();
    const url = new URL(req.url);
    const debugTiming = url.searchParams.get("debug_timing") === "1";
    const timings: Record<string, number> = {};
    const timed = async <T,>(key: string, fn: () => Promise<T>): Promise<T> => {
      const startedAt = performance.now();
      const result = await fn();
      if (debugTiming) {
        timings[key] = roundTiming(performance.now() - startedAt);
      }
      return result;
    };
    const withDebugTimings = <T extends Record<string, unknown>>(payload: T): T | (T & { debug_timings: Record<string, number> }) => {
      if (!debugTiming) return payload;
      return {
        ...payload,
        debug_timings: {
          ...timings,
          total_ms: roundTiming(performance.now() - requestStartedAt),
        },
      };
    };

    const partnerId = await requirePartnerUser(req);
    if (debugTiming) {
      timings.auth_ms = roundTiming(performance.now() - requestStartedAt);
    }
    const singleAreaId = asText(url.searchParams.get("area_id"));
    const requestedAreaIds = parseAreaIds(url.searchParams.get("area_ids"));
    const areaIds = requestedAreaIds.length > 0
      ? requestedAreaIds
      : (singleAreaId ? [singleAreaId] : []);
    const locale = normalizeLocale(asText(url.searchParams.get("locale")) || "en");
    const channel = (asText(url.searchParams.get("channel")) || "portal").toLowerCase();
    const autoSyncEnabled = asText(url.searchParams.get("auto_sync")) !== "0";
    const sectionKeysFilter = new Set(parseSectionKeys(url.searchParams.get("section_keys")));
    const workflowClass = normalizeDisplayTextClass(asText(url.searchParams.get("workflow_class")));
    const promptTemplate = asText(url.searchParams.get("prompt_template"));

    if (areaIds.length === 0) return NextResponse.json({ error: "Missing area_id" }, { status: 400 });
    if (!locale) return NextResponse.json({ error: "Invalid locale" }, { status: 400 });
    if (channel !== "portal" && channel !== "local_site" && channel !== "marketing") {
      return NextResponse.json({ error: "Invalid channel" }, { status: 400 });
    }

    const admin = createAdminClient();
    await timed("feature_gate_ms", () => requireInternationalFeatureEnabled(admin, partnerId));

    const areaMetaById = channel === "marketing"
      ? new Map<string, AreaMetaRow>()
      : await timed("area_meta_ms", () => loadAreaMetaMany(admin, areaIds));
    const rawSourceByArea = new Map<string, Map<string, SourceEntry>>();
    if (channel === "portal" || channel === "local_site") {
      const rawSources = await timed("raw_sources_ms", () => Promise.all(areaIds.map(async (areaId) => (
        [areaId, await loadRawSourceByMeta(admin, areaId, areaMetaById.get(areaId) ?? null)] as const
      ))));
      for (const [areaId, sourceMap] of rawSources) rawSourceByArea.set(areaId, sourceMap);
    }

    const portalRows = channel === "portal"
      ? await timed("portal_source_rows_ms", () => loadPortalSourceRows(admin, partnerId, areaIds))
      : [];
    const localRows = channel === "local_site"
      ? await timed("local_source_rows_ms", () => loadLocalSiteSourceRows(admin, partnerId, areaIds))
      : { local: [], report: [] };
    const portalRowsByArea = groupRowsByArea(portalRows);
    const localOnlyRowsByArea = groupRowsByArea(localRows.local);
    const localReportRowsByArea = groupRowsByArea(localRows.report);
    const marketingSourceByArea = channel === "marketing"
      ? await timed("marketing_source_rows_ms", () => buildMarketingSourceMapsByArea(admin, partnerId, areaIds))
      : new Map<string, Map<string, SourceEntry>>();

    const translationResult = await timed<{
      data: TranslationRow[] | null;
      error: unknown;
    }>("translations_ms", async () => {
      const result = await admin
        .from("partner_texts_i18n")
        .select("area_id, section_key, translated_content, status, updated_at, source_snapshot_hash, source_last_updated")
        .eq("partner_id", partnerId)
        .in("area_id", areaIds)
        .eq("channel", channel)
        .eq("target_locale", locale);
      return {
        data: (result.data ?? null) as TranslationRow[] | null,
        error: result.error,
      };
    });
    const translations = translationResult.data;
    const translationsError = translationResult.error;
    if (translationsError) throw translationsError;
    const translationsByArea = groupRowsByArea((translations ?? []) as TranslationRow[]);
    const autoSyncContext = await timed("auto_sync_context_ms", () => buildAutoSyncContext(autoSyncEnabled));

    const areas = await timed("area_build_ms", () => Promise.all(areaIds.map(async (areaId) => {
      const sourceByKey = new Map<string, SourceEntry>();
      if (channel === "portal") {
        const rawByKey = rawSourceByArea.get(areaId) ?? new Map<string, SourceEntry>();
        for (const [key, value] of rawByKey.entries()) sourceByKey.set(key, value);
        const reportByKey = selectLatestSource(portalRowsByArea.get(areaId) ?? []);
        for (const [key, value] of reportByKey.entries()) sourceByKey.set(key, value);
      } else if (channel === "local_site") {
        const rawByKey = rawSourceByArea.get(areaId) ?? new Map<string, SourceEntry>();
        for (const [key, value] of rawByKey.entries()) sourceByKey.set(key, value);
        const reportByKey = selectLatestSource(localReportRowsByArea.get(areaId) ?? []);
        const localByKey = selectLatestSource(localOnlyRowsByArea.get(areaId) ?? []);
        for (const [key, value] of reportByKey.entries()) sourceByKey.set(key, value);
        for (const [key, value] of localByKey.entries()) sourceByKey.set(key, value);
      } else {
        const marketingByKey = marketingSourceByArea.get(areaId) ?? new Map<string, SourceEntry>();
        for (const [key, value] of marketingByKey.entries()) sourceByKey.set(key, value);
      }

      return buildAreaPayload({
        admin,
        partnerId,
        areaId,
        channel,
        locale,
        sectionKeysFilter,
        workflowClass,
        promptTemplate,
        autoSyncEnabled,
        autoSyncContext,
        sourceByKey,
        translations: translationsByArea.get(areaId) ?? [],
      });
    })));

    const summary = {
      total_areas: areas.length,
      total_rows: areas.reduce((sum, area) => sum + area.summary.total, 0),
      total: areas.reduce((sum, area) => sum + area.summary.total, 0),
      translated_approved: areas.reduce((sum, area) => sum + area.summary.translated_approved, 0),
      fallback_de: areas.reduce((sum, area) => sum + area.summary.fallback_de, 0),
      auto_synced: areas.reduce((sum, area) => sum + area.summary.auto_synced, 0),
      auto_sync_failed: areas.reduce((sum, area) => sum + area.summary.auto_sync_failed, 0),
      mock_mode: areas.some((area) => area.summary.mock_mode),
      pricing_preview: areas.find((area) => area.summary.pricing_preview)?.summary.pricing_preview ?? autoSyncContext.pricingPreview,
    };
    const firstArea = areas[0] ?? null;

    return NextResponse.json(withDebugTimings({
      ok: true,
      area_id: firstArea?.area_id ?? areaIds[0],
      area_ids: areaIds,
      locale,
      channel,
      rows: firstArea?.rows ?? [],
      areas,
      summary,
      info: "Automatische Aktualisierungen wurden anhand der Texttyp-Regeln berücksichtigt.",
    }));
  } catch (error) {
    if (isMissingTable(error, "partner_texts_i18n")) {
      return NextResponse.json({ error: "Tabelle `partner_texts_i18n` fehlt. Bitte Migration ausführen." }, { status: 409 });
    }
    if (isMissingTable(error, "billing_feature_catalog") || isMissingTable(error, "partner_feature_overrides")) {
      return NextResponse.json({
        error: "Billing-Feature-Tabellen fehlen. Bitte die Billing-Migrationen ausfuehren.",
      }, { status: 409 });
    }
    if (isI18nChannelConstraintError(error)) {
      return NextResponse.json({
        error: "Channel-Konfiguration in `partner_texts_i18n` ist veraltet. Bitte Migration für `marketing`-Channel ausführen.",
      }, { status: 409 });
    }
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message === "INTERNATIONAL_FEATURE_DISABLED") {
        return NextResponse.json({ error: "Internationalisierung ist fuer diesen Partner nicht freigeschaltet." }, { status: 403 });
      }
      if (error.message.startsWith("RATE_LIMIT:")) {
        const sec = Number(error.message.split(":")[1] ?? "60");
        return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(sec) } });
      }
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const partnerId = await requirePartnerUser(req);
    const body = (await req.json()) as UpsertBody;
    const areaId = asText(body.area_id);
    const locale = normalizeLocale(asText(body.locale));
    const channel = asText(body.channel).toLowerCase();
    const rows = Array.isArray(body.rows) ? body.rows : [];

    if (!areaId) return NextResponse.json({ error: "Missing area_id" }, { status: 400 });
    if (!locale) return NextResponse.json({ error: "Invalid locale" }, { status: 400 });
    if (channel !== "portal" && channel !== "local_site" && channel !== "marketing") {
      return NextResponse.json({ error: "Invalid channel" }, { status: 400 });
    }
    if (rows.length === 0) return NextResponse.json({ error: "Missing rows" }, { status: 400 });

    const nowIso = new Date().toISOString();
    const admin = createAdminClient();
    await requireInternationalFeatureEnabled(admin, partnerId);
    const sourceByKey = new Map<string, { content: string; status: string; updated_at: string | null }>();
    const areaMetaById = channel === "marketing"
      ? new Map<string, AreaMetaRow>()
      : await loadAreaMetaMany(admin, [areaId]);
    if (channel === "portal") {
      const rawByKey = await loadRawSourceByMeta(admin, areaId, areaMetaById.get(areaId) ?? null);
      for (const [key, value] of rawByKey.entries()) sourceByKey.set(key, value);
      const reportByKey = selectLatestSource(await loadPortalSourceRows(admin, partnerId, [areaId]));
      for (const [key, value] of reportByKey.entries()) sourceByKey.set(key, value);
    } else if (channel === "local_site") {
      const rawByKey = await loadRawSourceByMeta(admin, areaId, areaMetaById.get(areaId) ?? null);
      for (const [key, value] of rawByKey.entries()) sourceByKey.set(key, value);
      const rowsFromDb = await loadLocalSiteSourceRows(admin, partnerId, [areaId]);
      const reportByKey = selectLatestSource(rowsFromDb.report);
      const localByKey = selectLatestSource(rowsFromDb.local);
      for (const [key, value] of reportByKey.entries()) sourceByKey.set(key, value);
      for (const [key, value] of localByKey.entries()) sourceByKey.set(key, value);
    } else {
      const marketingRows = await loadMarketingSourceRowsMany(admin, partnerId, [areaId]);
      const marketingByKey = await loadMarketingSourceByArea(admin, areaId, marketingRows);
      for (const [key, value] of marketingByKey.entries()) sourceByKey.set(key, value);
    }

    const upsertRows: Array<Record<string, unknown>> = [];
    for (const row of rows) {
      const sectionKey = asText(row.section_key);
      if (!sectionKey) return NextResponse.json({ error: "section_key fehlt." }, { status: 400 });
      if (channel === "marketing" && !sectionKey.startsWith("marketing.")) {
        return NextResponse.json({ error: `Ungültiger SEO&Geo section_key: ${sectionKey}` }, { status: 400 });
      }
      const status = asText(row.status || "draft").toLowerCase();
      if (!["draft", "approved", "needs_review"].includes(status)) {
        return NextResponse.json({ error: `Ungültiger status für ${sectionKey}` }, { status: 400 });
      }
      const translated = asText(row.translated_content);
      const source = sourceByKey.get(sectionKey);
      upsertRows.push({
        partner_id: partnerId,
        area_id: areaId,
        section_key: sectionKey,
        channel,
        target_locale: locale,
        translated_content: translated || null,
        status,
        source_snapshot_hash: hashText(source?.content ?? ""),
        source_last_updated: normalizeIso(source?.updated_at ?? null),
        updated_at: nowIso,
      });
    }

    const { error } = await admin
      .from("partner_texts_i18n")
      .upsert(upsertRows, { onConflict: "partner_id,area_id,section_key,channel,target_locale" });
    if (error) throw error;

    return NextResponse.json({ ok: true, updated: upsertRows.length });
  } catch (error) {
    if (isMissingTable(error, "partner_texts_i18n")) {
      return NextResponse.json({ error: "Tabelle `partner_texts_i18n` fehlt. Bitte Migration ausführen." }, { status: 409 });
    }
    if (isMissingTable(error, "billing_feature_catalog") || isMissingTable(error, "partner_feature_overrides")) {
      return NextResponse.json({
        error: "Billing-Feature-Tabellen fehlen. Bitte die Billing-Migrationen ausfuehren.",
      }, { status: 409 });
    }
    if (isI18nChannelConstraintError(error)) {
      return NextResponse.json({
        error: "Channel-Konfiguration in `partner_texts_i18n` ist veraltet. Bitte Migration für `marketing`-Channel ausführen.",
      }, { status: 409 });
    }
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message === "INTERNATIONAL_FEATURE_DISABLED") {
        return NextResponse.json({ error: "Internationalisierung ist fuer diesen Partner nicht freigeschaltet." }, { status: 403 });
      }
      if (error.message.startsWith("RATE_LIMIT:")) {
        const sec = Number(error.message.split(":")[1] ?? "60");
        return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(sec) } });
      }
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
