import { createAdminClient } from "@/utils/supabase/admin";
import { isMissingTable, listFlattenedLlmProviderModels } from "@/lib/llm/provider-catalog";

const GLOBAL_LLM_CACHE_TTL_MS = 60 * 1000;

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

let globalConfigCache: CacheEntry<{ config: GlobalLlmConfig; source: "db" | "fallback" }> | null = null;
let activeProvidersCache: CacheEntry<{ providers: GlobalLlmProvider[]; source: "db" | "fallback" }> | null = null;

export type GlobalLlmConfig = {
  central_enabled: boolean;
  monthly_token_budget: number | null;
  monthly_cost_budget_eur: number | null;
};

export type GlobalLlmProvider = {
  id: string;
  provider_account_id?: string | null;
  provider_model_id?: string | null;
  provider: string;
  model: string;
  base_url: string;
  auth_type: string;
  auth_config: Record<string, unknown> | null;
  api_version?: string | null;
  priority: number;
  is_active: boolean;
  max_tokens: number | null;
  temperature: number | null;
  input_cost_usd_per_1k: number | null;
  output_cost_usd_per_1k: number | null;
  input_cost_eur_per_1k: number | null;
  output_cost_eur_per_1k: number | null;
  fx_rate_usd_to_eur?: number | null;
};

type LlmUsageInsert = {
  partner_id: string | null;
  route_name: string;
  mode: "central_managed" | "partner_managed";
  provider: string;
  model: string;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  provider_account_id?: string | null;
  provider_model_id?: string | null;
  billing_currency?: string | null;
  fx_rate_usd_to_eur?: number | null;
  input_cost_usd_per_1k_snapshot?: number | null;
  output_cost_usd_per_1k_snapshot?: number | null;
  cache_read_cost_usd_per_1k_snapshot?: number | null;
  cache_write_cost_usd_per_1k_snapshot?: number | null;
  reasoning_cost_usd_per_1k_snapshot?: number | null;
  estimated_cost_usd?: number | null;
  estimated_cost_eur: number | null;
  cached_tokens?: number | null;
  cache_read_tokens?: number | null;
  cache_write_tokens?: number | null;
  reasoning_tokens?: number | null;
  status: "ok" | "error";
  error_code: string | null;
  request_id?: string | null;
  raw_usage_json?: Record<string, unknown> | null;
};

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function getCachedValue<T>(entry: CacheEntry<T> | null): T | null {
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) return null;
  return entry.value;
}

function setCachedValue<T>(value: T): CacheEntry<T> {
  return {
    value,
    expiresAt: Date.now() + GLOBAL_LLM_CACHE_TTL_MS,
  };
}

export async function loadGlobalLlmConfig(): Promise<{ config: GlobalLlmConfig; source: "db" | "fallback" }> {
  const cached = getCachedValue(globalConfigCache);
  if (cached) return cached;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("llm_global_config")
    .select("central_enabled, monthly_token_budget, monthly_cost_budget_eur")
    .eq("id", true)
    .maybeSingle();

  if (!error && data) {
    const next = {
      source: "db",
      config: {
        central_enabled: data.central_enabled !== false,
        monthly_token_budget: asFiniteNumber(data.monthly_token_budget),
        monthly_cost_budget_eur: asFiniteNumber(data.monthly_cost_budget_eur),
      },
    };
    globalConfigCache = setCachedValue(next);
    return next;
  }

  if (error && isMissingTable(error, "llm_global_config")) {
    const next = {
      source: "fallback",
      config: {
        central_enabled: true,
        monthly_token_budget: null,
        monthly_cost_budget_eur: null,
      },
    };
    globalConfigCache = setCachedValue(next);
    return next;
  }

  if (error) throw new Error(String(error.message ?? "Global LLM config lookup failed"));
  const next = {
    source: "db",
    config: {
      central_enabled: true,
      monthly_token_budget: null,
      monthly_cost_budget_eur: null,
    },
  };
  globalConfigCache = setCachedValue(next);
  return next;
}

export async function loadActiveGlobalLlmProviders(): Promise<{ providers: GlobalLlmProvider[]; source: "db" | "fallback" }> {
  const cached = getCachedValue(activeProvidersCache);
  if (cached) return cached;
  const admin = createAdminClient();
  const next = await listFlattenedLlmProviderModels({ admin, activeOnly: true });
  if (next.source === "db" && next.models.length > 0) {
    const result = {
      source: "db",
      providers: next.models
        .filter((row) =>
          row.input_cost_usd_per_1k !== null
          && row.output_cost_usd_per_1k !== null
          && row.input_cost_usd_per_1k > 0
          && row.output_cost_usd_per_1k > 0,
        )
        .map((row) => ({
          id: row.id,
          provider_account_id: row.provider_account_id,
          provider_model_id: row.id,
          provider: row.provider,
          model: row.model,
          base_url: row.base_url,
          auth_type: row.auth_type,
          auth_config: row.auth_config,
          api_version: row.api_version,
          priority: row.priority,
          is_active: row.is_active,
          max_tokens: row.max_tokens,
          temperature: row.temperature,
          input_cost_usd_per_1k: row.input_cost_usd_per_1k,
          output_cost_usd_per_1k: row.output_cost_usd_per_1k,
          input_cost_eur_per_1k: row.input_cost_eur_per_1k,
          output_cost_eur_per_1k: row.output_cost_eur_per_1k,
          fx_rate_usd_to_eur: row.fx_rate_usd_to_eur,
        })),
    };
    activeProvidersCache = setCachedValue(result);
    return result;
  }

  const { data, error } = await admin
    .from("llm_global_providers")
    .select("id, provider, model, base_url, auth_type, auth_config, priority, is_active, max_tokens, temperature, input_cost_eur_per_1k, output_cost_eur_per_1k")
    .eq("is_active", true)
    .order("priority", { ascending: true });

  if (error) {
    if (isMissingTable(error, "llm_global_providers")) {
      const result = { source: "fallback", providers: [] };
      activeProvidersCache = setCachedValue(result);
      return result;
    }
    throw new Error(String(error.message ?? "Global LLM providers lookup failed"));
  }

  const result = {
    source: "db",
    providers: (data ?? []).map((row) => ({
      id: String(row.id ?? ""),
      provider_account_id: null,
      provider_model_id: String(row.id ?? ""),
      provider: String(row.provider ?? "").toLowerCase(),
      model: String(row.model ?? ""),
      base_url: String(row.base_url ?? "https://api.openai.com/v1"),
      auth_type: String(row.auth_type ?? "api_key"),
      auth_config: (row.auth_config as Record<string, unknown> | null) ?? null,
      api_version: null,
      priority: Number(row.priority ?? 100),
      is_active: Boolean(row.is_active),
      max_tokens: asFiniteNumber(row.max_tokens),
      temperature: asFiniteNumber(row.temperature),
      input_cost_usd_per_1k: null,
      output_cost_usd_per_1k: null,
      input_cost_eur_per_1k: asFiniteNumber(row.input_cost_eur_per_1k),
      output_cost_eur_per_1k: asFiniteNumber(row.output_cost_eur_per_1k),
      fx_rate_usd_to_eur: null,
    })).filter((row) =>
      row.input_cost_eur_per_1k !== null
      && row.output_cost_eur_per_1k !== null
      && row.input_cost_eur_per_1k > 0
      && row.output_cost_eur_per_1k > 0,
    ),
  };
  activeProvidersCache = setCachedValue(result);
  return result;
}

function monthRangeUtc(d = new Date()) {
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 0, 0, 0, 0));
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function checkGlobalAndPartnerBudget(partnerId: string) {
  const admin = createAdminClient();
  const { config } = await loadGlobalLlmConfig();
  const range = monthRangeUtc();

  const [globalUsage, partnerUsage, partnerLimit] = await Promise.all([
    admin
      .from("llm_usage_events")
      .select("total_tokens, estimated_cost_eur")
      .gte("created_at", range.start)
      .lt("created_at", range.end)
      .eq("status", "ok"),
    admin
      .from("llm_usage_events")
      .select("total_tokens, estimated_cost_eur")
      .eq("partner_id", partnerId)
      .gte("created_at", range.start)
      .lt("created_at", range.end)
      .eq("status", "ok"),
    admin
      .from("llm_partner_budget_overrides")
      .select("monthly_token_budget, monthly_cost_budget_eur, is_active")
      .eq("partner_id", partnerId)
      .maybeSingle(),
  ]);

  const tablesMissing =
    (globalUsage.error && isMissingTable(globalUsage.error, "llm_usage_events"))
    || (partnerUsage.error && isMissingTable(partnerUsage.error, "llm_usage_events"))
    || (partnerLimit.error && isMissingTable(partnerLimit.error, "llm_partner_budget_overrides"));
  if (tablesMissing) return { allowed: true as const, reason: null, usage: null };

  if (globalUsage.error) throw new Error(String(globalUsage.error.message ?? "LLM usage lookup failed"));
  if (partnerUsage.error) throw new Error(String(partnerUsage.error.message ?? "Partner LLM usage lookup failed"));
  if (partnerLimit.error) throw new Error(String(partnerLimit.error.message ?? "Partner LLM budget lookup failed"));

  const sumUsage = (rows: Array<{ total_tokens?: unknown; estimated_cost_eur?: unknown }> | null | undefined) =>
    (rows ?? []).reduce(
      (acc, row) => ({
        tokens: acc.tokens + (asFiniteNumber(row.total_tokens) ?? 0),
        cost: acc.cost + (asFiniteNumber(row.estimated_cost_eur) ?? 0),
      }),
      { tokens: 0, cost: 0 },
    );

  const global = sumUsage(globalUsage.data as Array<{ total_tokens?: unknown; estimated_cost_eur?: unknown }>);
  const partner = sumUsage(partnerUsage.data as Array<{ total_tokens?: unknown; estimated_cost_eur?: unknown }>);

  if (config.monthly_token_budget !== null && global.tokens >= config.monthly_token_budget) {
    return { allowed: false as const, reason: "GLOBAL_TOKEN_BUDGET_EXCEEDED", usage: { global, partner } };
  }
  if (config.monthly_cost_budget_eur !== null && global.cost >= config.monthly_cost_budget_eur) {
    return { allowed: false as const, reason: "GLOBAL_COST_BUDGET_EXCEEDED", usage: { global, partner } };
  }

  const partnerBudgetActive = partnerLimit.data?.is_active !== false;
  const partnerTokenLimit = partnerBudgetActive ? asFiniteNumber(partnerLimit.data?.monthly_token_budget) : null;
  const partnerCostLimit = partnerBudgetActive ? asFiniteNumber(partnerLimit.data?.monthly_cost_budget_eur) : null;
  if (partnerTokenLimit !== null && partner.tokens >= partnerTokenLimit) {
    return { allowed: false as const, reason: "PARTNER_TOKEN_BUDGET_EXCEEDED", usage: { global, partner } };
  }
  if (partnerCostLimit !== null && partner.cost >= partnerCostLimit) {
    return { allowed: false as const, reason: "PARTNER_COST_BUDGET_EXCEEDED", usage: { global, partner } };
  }

  return { allowed: true as const, reason: null, usage: { global, partner } };
}

export function estimateCostEur(args: {
  promptTokens: number | null;
  completionTokens: number | null;
  inputCostEurPer1k: number | null;
  outputCostEurPer1k: number | null;
}): number | null {
  const pt = args.promptTokens ?? 0;
  const ct = args.completionTokens ?? 0;
  if (!Number.isFinite(pt) || !Number.isFinite(ct)) return null;
  if (args.inputCostEurPer1k === null || args.outputCostEurPer1k === null) return null;
  const inCost = args.inputCostEurPer1k;
  const outCost = args.outputCostEurPer1k;
  if (!Number.isFinite(inCost) || !Number.isFinite(outCost)) return null;
  const value = (pt / 1000) * inCost + (ct / 1000) * outCost;
  return Number.isFinite(value) ? Number(value.toFixed(6)) : null;
}

export function estimateCostUsd(args: {
  promptTokens: number | null;
  completionTokens: number | null;
  inputCostUsdPer1k: number | null;
  outputCostUsdPer1k: number | null;
}): number | null {
  const pt = args.promptTokens ?? 0;
  const ct = args.completionTokens ?? 0;
  if (!Number.isFinite(pt) || !Number.isFinite(ct)) return null;
  if (args.inputCostUsdPer1k === null || args.outputCostUsdPer1k === null) return null;
  const inCost = args.inputCostUsdPer1k;
  const outCost = args.outputCostUsdPer1k;
  if (!Number.isFinite(inCost) || !Number.isFinite(outCost)) return null;
  const value = (pt / 1000) * inCost + (ct / 1000) * outCost;
  return Number.isFinite(value) ? Number(value.toFixed(6)) : null;
}

export async function writeLlmUsageEvent(row: LlmUsageInsert): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("llm_usage_events")
    .insert({
      partner_id: row.partner_id,
      route_name: row.route_name,
      mode: row.mode,
      provider: row.provider,
      model: row.model,
      prompt_tokens: row.prompt_tokens,
      completion_tokens: row.completion_tokens,
      total_tokens: row.total_tokens,
      provider_account_id: row.provider_account_id ?? null,
      provider_model_id: row.provider_model_id ?? null,
      billing_currency: row.billing_currency ?? "USD",
      fx_rate_usd_to_eur: row.fx_rate_usd_to_eur ?? null,
      input_cost_usd_per_1k_snapshot: row.input_cost_usd_per_1k_snapshot ?? null,
      output_cost_usd_per_1k_snapshot: row.output_cost_usd_per_1k_snapshot ?? null,
      cache_read_cost_usd_per_1k_snapshot: row.cache_read_cost_usd_per_1k_snapshot ?? null,
      cache_write_cost_usd_per_1k_snapshot: row.cache_write_cost_usd_per_1k_snapshot ?? null,
      reasoning_cost_usd_per_1k_snapshot: row.reasoning_cost_usd_per_1k_snapshot ?? null,
      estimated_cost_usd: row.estimated_cost_usd ?? null,
      estimated_cost_eur: row.estimated_cost_eur,
      cached_tokens: row.cached_tokens ?? null,
      cache_read_tokens: row.cache_read_tokens ?? null,
      cache_write_tokens: row.cache_write_tokens ?? null,
      reasoning_tokens: row.reasoning_tokens ?? null,
      status: row.status,
      error_code: row.error_code,
      request_id: row.request_id ?? null,
      raw_usage_json: row.raw_usage_json ?? null,
    });
  if (error && !isMissingTable(error, "llm_usage_events")) {
    throw new Error(String(error.message ?? "LLM usage insert failed"));
  }
}
