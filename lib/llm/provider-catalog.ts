import { createAdminClient } from "@/utils/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

type ProviderAccountRow = {
  id?: string | null;
  provider?: string | null;
  display_name?: string | null;
  base_url?: string | null;
  auth_type?: string | null;
  auth_config?: Record<string, unknown> | null;
  api_version?: string | null;
  is_active?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ProviderModelRow = {
  id?: string | null;
  provider_account_id?: string | null;
  model?: string | null;
  display_label?: string | null;
  hint?: string | null;
  badges?: unknown;
  recommended?: boolean | null;
  sort_order?: number | null;
  temperature?: number | null;
  max_tokens?: number | null;
  input_cost_usd_per_1k?: number | null;
  output_cost_usd_per_1k?: number | null;
  cache_read_cost_usd_per_1k?: number | null;
  cache_write_cost_usd_per_1k?: number | null;
  reasoning_cost_usd_per_1k?: number | null;
  is_active?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
  account?: ProviderAccountRow | null;
};

type FxRow = {
  rate?: number | null;
};

export type LlmProviderAccountRecord = {
  id: string;
  provider: string;
  display_name: string | null;
  base_url: string;
  auth_type: string;
  auth_config: Record<string, unknown> | null;
  api_version: string | null;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type LlmProviderModelRecord = {
  id: string;
  provider_account_id: string;
  model: string;
  display_label: string | null;
  hint: string | null;
  badges: string[];
  recommended: boolean;
  sort_order: number;
  temperature: number | null;
  max_tokens: number | null;
  input_cost_usd_per_1k: number | null;
  output_cost_usd_per_1k: number | null;
  cache_read_cost_usd_per_1k: number | null;
  cache_write_cost_usd_per_1k: number | null;
  reasoning_cost_usd_per_1k: number | null;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type FlattenedLlmProviderModel = LlmProviderModelRecord & {
  provider: string;
  provider_display_name: string | null;
  base_url: string;
  auth_type: string;
  auth_config: Record<string, unknown> | null;
  api_version: string | null;
  provider_account_active: boolean;
  priority: number;
  input_cost_eur_per_1k: number | null;
  output_cost_eur_per_1k: number | null;
  price_source: string | null;
  price_source_url: string | null;
  price_source_url_override: string | null;
  fx_rate_usd_to_eur: number | null;
};

function asText(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  return raw.length > 0 ? raw : null;
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeBadges(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    const badge = asText(item);
    if (!badge) continue;
    const key = badge.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(badge);
  }
  return out;
}

function currentMonthStartIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0)).toISOString().slice(0, 10);
}

export function isMissingTable(error: unknown, table: string): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return msg.includes(`public.${table}`) && msg.includes("does not exist");
}

export async function loadUsdToEurRate(admin: AdminClient, monthStart = currentMonthStartIso()): Promise<number | null> {
  const { data, error } = await admin
    .from("llm_fx_monthly_rates")
    .select("rate")
    .eq("from_currency", "USD")
    .eq("to_currency", "EUR")
    .eq("month_start", monthStart)
    .maybeSingle();
  if (error) {
    if (isMissingTable(error, "llm_fx_monthly_rates")) return null;
    throw new Error(String(error.message ?? "USD/EUR FX lookup failed"));
  }
  return asFiniteNumber((data as FxRow | null)?.rate);
}

function normalizeAccount(row: ProviderAccountRow): LlmProviderAccountRecord {
  return {
    id: asText(row.id) ?? "",
    provider: (asText(row.provider) ?? "openai").toLowerCase(),
    display_name: asText(row.display_name),
    base_url: asText(row.base_url) ?? "https://api.openai.com/v1",
    auth_type: (asText(row.auth_type) ?? "api_key").toLowerCase(),
    auth_config: (row.auth_config as Record<string, unknown> | null) ?? null,
    api_version: asText(row.api_version),
    is_active: row.is_active !== false,
    created_at: asText(row.created_at),
    updated_at: asText(row.updated_at),
  };
}

function normalizeModel(row: ProviderModelRow): LlmProviderModelRecord {
  return {
    id: asText(row.id) ?? "",
    provider_account_id: asText(row.provider_account_id) ?? "",
    model: asText(row.model) ?? "",
    display_label: asText(row.display_label),
    hint: asText(row.hint),
    badges: normalizeBadges(row.badges),
    recommended: row.recommended === true,
    sort_order: Math.max(1, Math.floor(asFiniteNumber(row.sort_order) ?? 100)),
    temperature: asFiniteNumber(row.temperature),
    max_tokens: asFiniteNumber(row.max_tokens),
    input_cost_usd_per_1k: asFiniteNumber(row.input_cost_usd_per_1k),
    output_cost_usd_per_1k: asFiniteNumber(row.output_cost_usd_per_1k),
    cache_read_cost_usd_per_1k: asFiniteNumber(row.cache_read_cost_usd_per_1k),
    cache_write_cost_usd_per_1k: asFiniteNumber(row.cache_write_cost_usd_per_1k),
    reasoning_cost_usd_per_1k: asFiniteNumber(row.reasoning_cost_usd_per_1k),
    is_active: row.is_active !== false,
    created_at: asText(row.created_at),
    updated_at: asText(row.updated_at),
  };
}

export async function listLlmProviderAccounts(admin = createAdminClient()): Promise<LlmProviderAccountRecord[]> {
  const { data, error } = await admin
    .from("llm_provider_accounts")
    .select("id, provider, display_name, base_url, auth_type, auth_config, api_version, is_active, created_at, updated_at")
    .order("provider", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    if (isMissingTable(error, "llm_provider_accounts")) return [];
    throw new Error(String(error.message ?? "LLM provider accounts lookup failed"));
  }
  return ((data ?? []) as ProviderAccountRow[]).map(normalizeAccount);
}

export async function listFlattenedLlmProviderModels(args?: {
  admin?: AdminClient;
  activeOnly?: boolean;
}): Promise<{ models: FlattenedLlmProviderModel[]; fxRateUsdToEur: number | null; source: "db" | "fallback" }> {
  const admin = args?.admin ?? createAdminClient();
  let query = admin
    .from("llm_provider_models")
    .select(`
      id,
      provider_account_id,
      model,
      display_label,
      hint,
      badges,
      recommended,
      sort_order,
      temperature,
      max_tokens,
      input_cost_usd_per_1k,
      output_cost_usd_per_1k,
      cache_read_cost_usd_per_1k,
      cache_write_cost_usd_per_1k,
      reasoning_cost_usd_per_1k,
      is_active,
      created_at,
      updated_at,
      account:llm_provider_accounts!inner(
        id,
        provider,
        display_name,
        base_url,
        auth_type,
        auth_config,
        api_version,
        is_active,
        created_at,
        updated_at
      )
    `)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (args?.activeOnly !== false) {
    query = query.eq("is_active", true);
  }
  const { data, error } = await query;
  if (error) {
    if (isMissingTable(error, "llm_provider_models") || isMissingTable(error, "llm_provider_accounts")) {
      return { models: [], fxRateUsdToEur: null, source: "fallback" };
    }
    throw new Error(String(error.message ?? "LLM provider models lookup failed"));
  }

  const fxRateUsdToEur = await loadUsdToEurRate(admin).catch(() => null);
  const models = ((data ?? []) as ProviderModelRow[]).map((row) => {
    const account = normalizeAccount(row.account ?? {});
    const model = normalizeModel(row);
    const inputEur = fxRateUsdToEur && model.input_cost_usd_per_1k !== null
      ? Number((model.input_cost_usd_per_1k * fxRateUsdToEur).toFixed(6))
      : null;
    const outputEur = fxRateUsdToEur && model.output_cost_usd_per_1k !== null
      ? Number((model.output_cost_usd_per_1k * fxRateUsdToEur).toFixed(6))
      : null;
    return {
      ...model,
      provider: account.provider,
      provider_display_name: account.display_name,
      base_url: account.base_url,
      auth_type: account.auth_type,
      auth_config: account.auth_config,
      api_version: account.api_version,
      provider_account_active: account.is_active,
      priority: model.sort_order,
      input_cost_eur_per_1k: inputEur,
      output_cost_eur_per_1k: outputEur,
      price_source: null,
      price_source_url: null,
      price_source_url_override: null,
      fx_rate_usd_to_eur: fxRateUsdToEur,
    };
  }).filter((row) => row.provider_account_active || args?.activeOnly === false);

  return { models, fxRateUsdToEur, source: "db" };
}
