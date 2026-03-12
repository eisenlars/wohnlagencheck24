import { createAdminClient } from "@/utils/supabase/admin";

export type GlobalLlmConfig = {
  central_enabled: boolean;
  monthly_token_budget: number | null;
  monthly_cost_budget_eur: number | null;
};

export type GlobalLlmProvider = {
  id: string;
  provider: string;
  model: string;
  base_url: string;
  auth_type: string;
  auth_config: Record<string, unknown> | null;
  priority: number;
  is_active: boolean;
  max_tokens: number | null;
  temperature: number | null;
  input_cost_eur_per_1k: number | null;
  output_cost_eur_per_1k: number | null;
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
  estimated_cost_eur: number | null;
  status: "ok" | "error";
  error_code: string | null;
};

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isMissingTable(error: unknown, table: string): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return msg.includes(`public.${table}`) && msg.includes("does not exist");
}

export async function loadGlobalLlmConfig(): Promise<{ config: GlobalLlmConfig; source: "db" | "fallback" }> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("llm_global_config")
    .select("central_enabled, monthly_token_budget, monthly_cost_budget_eur")
    .eq("id", true)
    .maybeSingle();

  if (!error && data) {
    return {
      source: "db",
      config: {
        central_enabled: data.central_enabled !== false,
        monthly_token_budget: asFiniteNumber(data.monthly_token_budget),
        monthly_cost_budget_eur: asFiniteNumber(data.monthly_cost_budget_eur),
      },
    };
  }

  if (error && isMissingTable(error, "llm_global_config")) {
    return {
      source: "fallback",
      config: {
        central_enabled: true,
        monthly_token_budget: null,
        monthly_cost_budget_eur: null,
      },
    };
  }

  if (error) throw new Error(String(error.message ?? "Global LLM config lookup failed"));
  return {
    source: "db",
    config: {
      central_enabled: true,
      monthly_token_budget: null,
      monthly_cost_budget_eur: null,
    },
  };
}

export async function loadActiveGlobalLlmProviders(): Promise<{ providers: GlobalLlmProvider[]; source: "db" | "fallback" }> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("llm_global_providers")
    .select("id, provider, model, base_url, auth_type, auth_config, priority, is_active, max_tokens, temperature, input_cost_eur_per_1k, output_cost_eur_per_1k")
    .eq("is_active", true)
    .order("priority", { ascending: true });

  if (!error) {
    const normalized = (data ?? []).map((row) => ({
      id: String(row.id ?? ""),
      provider: String(row.provider ?? "").toLowerCase(),
      model: String(row.model ?? ""),
      base_url: String(row.base_url ?? "https://api.openai.com/v1"),
      auth_type: String(row.auth_type ?? "api_key"),
      auth_config: (row.auth_config as Record<string, unknown> | null) ?? null,
      priority: Number(row.priority ?? 100),
      is_active: Boolean(row.is_active),
      max_tokens: asFiniteNumber(row.max_tokens),
      temperature: asFiniteNumber(row.temperature),
      input_cost_eur_per_1k: asFiniteNumber(row.input_cost_eur_per_1k),
      output_cost_eur_per_1k: asFiniteNumber(row.output_cost_eur_per_1k),
    }));
    return {
      source: "db",
      providers: normalized.filter((row) =>
        row.input_cost_eur_per_1k !== null
        && row.output_cost_eur_per_1k !== null
        && row.input_cost_eur_per_1k > 0
        && row.output_cost_eur_per_1k > 0,
      ),
    };
  }

  if (isMissingTable(error, "llm_global_providers")) {
    return { source: "fallback", providers: [] };
  }
  throw new Error(String(error.message ?? "Global LLM providers lookup failed"));
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
  const inCost = args.inputCostEurPer1k ?? 0;
  const outCost = args.outputCostEurPer1k ?? 0;
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
      estimated_cost_eur: row.estimated_cost_eur,
      status: row.status,
      error_code: row.error_code,
    });
  if (error && !isMissingTable(error, "llm_usage_events")) {
    throw new Error(String(error.message ?? "LLM usage insert failed"));
  }
}
