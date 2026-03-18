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
  section_key?: string | null;
  optimized_content?: string | null;
  status?: string | null;
  last_updated?: string | null;
};

type TranslationRow = {
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

async function loadAreaMeta(
  admin: ReturnType<typeof createAdminClient>,
  areaId: string,
): Promise<AreaMetaRow | null> {
  const { data, error } = await admin
    .from("areas")
    .select("id, slug, parent_slug, bundesland_slug")
    .eq("id", areaId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as AreaMetaRow | null;
}

async function loadRawSourceByArea(
  admin: ReturnType<typeof createAdminClient>,
  areaId: string,
): Promise<Map<string, { content: string; status: string; updated_at: string | null }>> {
  const meta = await loadAreaMeta(admin, areaId);
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
  areaId: string,
) {
  const { data, error } = await admin
    .from("report_texts")
    .select("section_key, optimized_content, status, last_updated")
    .eq("partner_id", partnerId)
    .eq("area_id", areaId);
  if (error) throw error;
  return (data ?? []) as TextSourceRow[];
}

async function loadLocalSiteSourceRows(
  admin: ReturnType<typeof createAdminClient>,
  partnerId: string,
  areaId: string,
) {
  const [localRes, reportRes] = await Promise.all([
    admin
      .from("partner_local_site_texts")
      .select("section_key, optimized_content, status, last_updated")
      .eq("partner_id", partnerId)
      .eq("area_id", areaId),
    admin
      .from("report_texts")
      .select("section_key, optimized_content, status, last_updated")
      .eq("partner_id", partnerId)
      .eq("area_id", areaId),
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
  partnerId: string,
  areaId: string,
): Promise<Map<string, { content: string; status: string; updated_at: string | null }>> {
  const out = new Map<string, { content: string; status: string; updated_at: string | null }>();
  const context = await resolveMarketingContextForArea({ admin, areaId });
  if (context) {
    const defaults = buildMarketingDefaults(context);
    const defaultsMap = flattenMarketingDefaults(defaults as unknown as Record<string, Record<string, unknown>>);
    for (const [key, value] of defaultsMap.entries()) out.set(key, value);
  }
  const { data, error } = await admin
    .from("partner_marketing_texts")
    .select("section_key, optimized_content, status, last_updated")
    .eq("partner_id", partnerId)
    .eq("area_id", areaId);
  if (error && !isMissingTable(error, "partner_marketing_texts")) throw error;
  const byKey = selectLatestSource((data ?? []) as TextSourceRow[]);
  for (const [key, value] of byKey.entries()) out.set(key, value);
  return out;
}

export async function GET(req: Request) {
  try {
    const partnerId = await requirePartnerUser(req);
    const url = new URL(req.url);
    const areaId = asText(url.searchParams.get("area_id"));
    const locale = normalizeLocale(asText(url.searchParams.get("locale")) || "en");
    const channel = (asText(url.searchParams.get("channel")) || "portal").toLowerCase();
    const autoSyncEnabled = asText(url.searchParams.get("auto_sync")) !== "0";
    const sectionKeysFilter = new Set(parseSectionKeys(url.searchParams.get("section_keys")));
    const workflowClass = normalizeDisplayTextClass(asText(url.searchParams.get("workflow_class")));
    const promptTemplate = asText(url.searchParams.get("prompt_template"));

    if (!areaId) return NextResponse.json({ error: "Missing area_id" }, { status: 400 });
    if (!locale) return NextResponse.json({ error: "Invalid locale" }, { status: 400 });
    if (channel !== "portal" && channel !== "local_site" && channel !== "marketing") {
      return NextResponse.json({ error: "Invalid channel" }, { status: 400 });
    }

    const admin = createAdminClient();
    await requireInternationalFeatureEnabled(admin, partnerId);

    const sourceByKey = new Map<string, { content: string; status: string; updated_at: string | null }>();
    if (channel === "portal") {
      const rawByKey = await loadRawSourceByArea(admin, areaId);
      for (const [key, value] of rawByKey.entries()) sourceByKey.set(key, value);
      const reportByKey = selectLatestSource(await loadPortalSourceRows(admin, partnerId, areaId));
      for (const [key, value] of reportByKey.entries()) sourceByKey.set(key, value);
    } else if (channel === "local_site") {
      const rawByKey = await loadRawSourceByArea(admin, areaId);
      for (const [key, value] of rawByKey.entries()) sourceByKey.set(key, value);
      const rows = await loadLocalSiteSourceRows(admin, partnerId, areaId);
      const reportByKey = selectLatestSource(rows.report);
      const localByKey = selectLatestSource(rows.local);
      for (const [key, value] of reportByKey.entries()) sourceByKey.set(key, value);
      for (const [key, value] of localByKey.entries()) sourceByKey.set(key, value);
    } else {
      const marketingByKey = await loadMarketingSourceByArea(admin, partnerId, areaId);
      for (const [key, value] of marketingByKey.entries()) sourceByKey.set(key, value);
    }

    const { data: translations, error: translationsError } = await admin
      .from("partner_texts_i18n")
      .select("section_key, translated_content, status, updated_at, source_snapshot_hash, source_last_updated")
      .eq("partner_id", partnerId)
      .eq("area_id", areaId)
      .eq("channel", channel)
      .eq("target_locale", locale);
    if (translationsError) throw translationsError;

    const transByKey = new Map<string, TranslationRow>();
    for (const row of (translations ?? []) as TranslationRow[]) {
      const key = asText(row.section_key);
      if (key) transByKey.set(key, row);
    }

    let autoSynced = 0;
    let autoSyncFailed = 0;
    let pricingPreview: TranslationPricingPreview | null = null;
    if (autoSyncEnabled) {
      const globalCfg = await loadGlobalLlmConfig();
      if (I18N_MOCK_TRANSLATION || globalCfg.config.central_enabled) {
        const globalProviders = await loadActiveGlobalLlmProviders();
        const provider = globalProviders.providers[0] ?? null;
        pricingPreview = provider
          ? {
              provider: provider.provider,
              model: provider.model,
              input_cost_usd_per_1k: provider.input_cost_usd_per_1k,
              output_cost_usd_per_1k: provider.output_cost_usd_per_1k,
              fx_rate_usd_to_eur: provider.fx_rate_usd_to_eur ?? null,
            }
          : null;
        const apiKey = provider ? readSecretFromAuthConfig(provider.auth_config ?? null, "api_key") : null;
        const providerSupported = provider ? ["openai", "mistral", "azure_openai", "generic_llm"].includes(String(provider.provider ?? "").toLowerCase()) : false;
        if (I18N_MOCK_TRANSLATION || (provider && apiKey && providerSupported)) {
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
            if (!translated) return true; // first run
            return !storedHash || storedHash !== currentHash; // source changed
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
                      apiKey: apiKey!,
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
                inputCostEurPer1k: provider.input_cost_eur_per_1k,
                outputCostEurPer1k: provider.output_cost_eur_per_1k,
              });
              const estimatedUsd = estimateCostUsd({
                promptTokens: result.promptTokens,
                completionTokens: result.completionTokens,
                inputCostUsdPer1k: provider.input_cost_usd_per_1k,
                outputCostUsdPer1k: provider.output_cost_usd_per_1k,
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
                provider: I18N_MOCK_TRANSLATION ? "mock" : (provider?.provider ?? "unknown"),
                model: I18N_MOCK_TRANSLATION ? "mock-i18n" : (provider?.model ?? "unknown"),
                prompt_tokens: null,
                completion_tokens: null,
                total_tokens: null,
                provider_account_id: I18N_MOCK_TRANSLATION ? null : (provider?.provider_account_id ?? null),
                provider_model_id: I18N_MOCK_TRANSLATION ? null : (provider?.provider_model_id ?? null),
                fx_rate_usd_to_eur: I18N_MOCK_TRANSLATION ? null : (provider?.fx_rate_usd_to_eur ?? null),
                input_cost_usd_per_1k_snapshot: I18N_MOCK_TRANSLATION ? null : (provider?.input_cost_usd_per_1k ?? null),
                output_cost_usd_per_1k_snapshot: I18N_MOCK_TRANSLATION ? null : (provider?.output_cost_usd_per_1k ?? null),
                estimated_cost_usd: null,
                estimated_cost_eur: null,
                status: "error",
                error_code: "AUTO_SYNC_FAILED",
              });
            }
          }
        }
      }
    } else {
      try {
        const globalProviders = await loadActiveGlobalLlmProviders();
        const provider = globalProviders.providers[0] ?? null;
        pricingPreview = provider
          ? {
              provider: provider.provider,
              model: provider.model,
              input_cost_usd_per_1k: provider.input_cost_usd_per_1k,
              output_cost_usd_per_1k: provider.output_cost_usd_per_1k,
              fx_rate_usd_to_eur: provider.fx_rate_usd_to_eur ?? null,
            }
          : null;
      } catch {
        pricingPreview = null;
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
        };
      });

    return NextResponse.json({
      ok: true,
      area_id: areaId,
      locale,
      channel,
      rows,
      summary: {
        total: rows.length,
        translated_approved: rows.filter((r) => r.effective_source === "translation").length,
        fallback_de: rows.filter((r) => r.effective_source === "de_fallback").length,
        auto_synced: autoSynced,
        auto_sync_failed: autoSyncFailed,
        mock_mode: I18N_MOCK_TRANSLATION,
        pricing_preview: pricingPreview,
      },
      info: "Automatische Aktualisierungen wurden anhand der Texttyp-Regeln berücksichtigt.",
    });
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
    if (channel === "portal") {
      const rawByKey = await loadRawSourceByArea(admin, areaId);
      for (const [key, value] of rawByKey.entries()) sourceByKey.set(key, value);
      const reportByKey = selectLatestSource(await loadPortalSourceRows(admin, partnerId, areaId));
      for (const [key, value] of reportByKey.entries()) sourceByKey.set(key, value);
    } else if (channel === "local_site") {
      const rawByKey = await loadRawSourceByArea(admin, areaId);
      for (const [key, value] of rawByKey.entries()) sourceByKey.set(key, value);
      const rowsFromDb = await loadLocalSiteSourceRows(admin, partnerId, areaId);
      const reportByKey = selectLatestSource(rowsFromDb.report);
      const localByKey = selectLatestSource(rowsFromDb.local);
      for (const [key, value] of reportByKey.entries()) sourceByKey.set(key, value);
      for (const [key, value] of localByKey.entries()) sourceByKey.set(key, value);
    } else {
      const marketingByKey = await loadMarketingSourceByArea(admin, partnerId, areaId);
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
