import { getI18nStandardPrompt } from "@/lib/i18n-prompts";
import {
  estimateCostEur,
  estimateCostUsd,
  loadActiveGlobalLlmProviders,
  loadGlobalLlmConfig,
  writeLlmUsageEvent,
} from "@/lib/llm/global-governance";
import { validateOutboundUrl } from "@/lib/security/outbound-url";
import { readSecretFromAuthConfig } from "@/lib/security/secret-crypto";
import { createAdminClient } from "@/utils/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

type AdminAiProvider = {
  provider: string;
  model: string;
  baseUrl: string;
  apiKey: string;
  apiVersion?: string | null;
  temperature?: number | null;
  maxTokens?: number | null;
  providerAccountId?: string | null;
  providerModelId?: string | null;
  inputCostUsdPer1k?: number | null;
  outputCostUsdPer1k?: number | null;
  inputCostEurPer1k?: number | null;
  outputCostEurPer1k?: number | null;
  fxRateUsdToEur?: number | null;
};

type ChatCompletionResult = {
  content: string;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  requestId: string | null;
};

type TranslateItem = {
  key: string;
  label: string;
  sourceText: string;
};

const I18N_MOCK_TRANSLATION = String(process.env.I18N_MOCK_TRANSLATION ?? "").trim() === "1";

function asText(value: unknown): string {
  return String(value ?? "").trim();
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function monthRangeUtc(d = new Date()) {
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 0, 0, 0, 0));
  return { start: start.toISOString(), end: end.toISOString() };
}

function sumOptional(left: number | null, right: number | null): number | null {
  if (left === null && right === null) return null;
  return (left ?? 0) + (right ?? 0);
}

function usesCompletionTokens(provider: string, model: string): boolean {
  const normalizedProvider = String(provider ?? "").trim().toLowerCase();
  const normalizedModel = String(model ?? "").trim().toLowerCase();
  if (!normalizedModel) return false;
  if (normalizedProvider !== "openai" && normalizedProvider !== "azure_openai") return false;
  return normalizedModel.startsWith("gpt-5");
}

function buildMockTranslation(locale: string, text: string): string {
  const tag = String(locale || "xx").trim().toUpperCase();
  return `[${tag} MOCK] ${String(text ?? "").trim()}`;
}

function buildTranslationPrompt(args: {
  targetLocale: string;
  domainLabel: string;
  itemLabel: string;
  sourceText: string;
}): { system: string; user: string } {
  const standardPrompt = getI18nStandardPrompt("general", args.targetLocale);
  return {
    system: "You are a professional translator for structured portal text.",
    user:
      `${standardPrompt}\n\n` +
      "Uebersetze den folgenden deutschen Portaltext. " +
      "Bewahre Fakten, Zahlen, Namen, Fachbegriffe, Platzhalter wie {regionName}, Abkuerzungen und Interpunktion sinnvoll. " +
      "Fuege keine Erklaerungen hinzu und gib nur den uebersetzten Text zurueck.\n\n" +
      `Bereich: ${args.domainLabel}\n` +
      `Eintrag: ${args.itemLabel}\n\n` +
      `Quelle:\n${args.sourceText}`,
  };
}

async function checkGlobalBudget(admin: AdminClient): Promise<void> {
  const { config } = await loadGlobalLlmConfig();
  if (!config.central_enabled) {
    throw new Error("Zentrale LLM-Nutzung ist deaktiviert.");
  }
  if (config.monthly_token_budget === null && config.monthly_cost_budget_eur === null) return;

  const range = monthRangeUtc();
  const usageRes = await admin
    .from("llm_usage_events")
    .select("total_tokens, estimated_cost_eur")
    .gte("created_at", range.start)
    .lt("created_at", range.end)
    .eq("status", "ok");

  if (usageRes.error) {
    const msg = String(usageRes.error.message ?? "").toLowerCase();
    if (msg.includes("public.llm_usage_events") && msg.includes("does not exist")) return;
    throw new Error(String(usageRes.error.message ?? "LLM usage lookup failed"));
  }

  const usage = (usageRes.data ?? []).reduce((acc, row) => ({
    tokens: acc.tokens + (asFiniteNumber(row.total_tokens) ?? 0),
    cost: acc.cost + (asFiniteNumber(row.estimated_cost_eur) ?? 0),
  }), { tokens: 0, cost: 0 });

  if (config.monthly_token_budget !== null && usage.tokens >= config.monthly_token_budget) {
    throw new Error("Globales LLM-Tokenbudget ist ausgeschoepft.");
  }
  if (config.monthly_cost_budget_eur !== null && usage.cost >= config.monthly_cost_budget_eur) {
    throw new Error("Globales LLM-Kostenbudget ist ausgeschoepft.");
  }
}

async function selectProvider(): Promise<AdminAiProvider> {
  const { config } = await loadGlobalLlmConfig();
  if (!config.central_enabled) {
    throw new Error("Zentrale LLM-Nutzung ist deaktiviert.");
  }
  const { providers } = await loadActiveGlobalLlmProviders();
  const provider = providers[0] ?? null;
  if (!provider) {
    throw new Error("Kein aktiver globaler LLM-Provider fuer KI-Uebersetzungen verfuegbar.");
  }
  const apiKey = readSecretFromAuthConfig(provider.auth_config ?? null, "api_key")
    || readSecretFromAuthConfig(provider.auth_config ?? null, "token")
    || "";
  if (!apiKey || !provider.model) {
    throw new Error("Dem aktiven globalen LLM-Provider fehlen API-Key oder Modell.");
  }
  return {
    provider: provider.provider,
    model: provider.model,
    baseUrl: provider.base_url || "https://api.openai.com/v1",
    apiKey,
    apiVersion: provider.api_version,
    temperature: provider.temperature,
    maxTokens: provider.max_tokens,
    providerAccountId: provider.provider_account_id ?? null,
    providerModelId: provider.provider_model_id ?? provider.id ?? null,
    inputCostUsdPer1k: provider.input_cost_usd_per_1k ?? null,
    outputCostUsdPer1k: provider.output_cost_usd_per_1k ?? null,
    inputCostEurPer1k: provider.input_cost_eur_per_1k ?? null,
    outputCostEurPer1k: provider.output_cost_eur_per_1k ?? null,
    fxRateUsdToEur: provider.fx_rate_usd_to_eur ?? null,
  };
}

async function callOpenAiCompatible(args: AdminAiProvider & { system: string; user: string }): Promise<ChatCompletionResult> {
  const validated = await validateOutboundUrl(args.baseUrl);
  if (!validated.ok) {
    throw new Error("KI-Ziel-URL wurde blockiert.");
  }

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
  if (!res.ok) {
    throw new Error(`KI-Anfrage fehlgeschlagen (${res.status}).`);
  }
  const payload = await res.json().catch(() => null) as Record<string, unknown> | null;
  const choices = Array.isArray(payload?.choices) ? payload.choices as Array<Record<string, unknown>> : [];
  const content = asText((choices[0]?.message as Record<string, unknown> | undefined)?.content);
  if (!content) throw new Error("KI hat keinen Inhalt zurueckgegeben.");
  const usage = (payload?.usage as Record<string, unknown> | null) ?? null;
  return {
    content,
    promptTokens: asFiniteNumber(usage?.prompt_tokens),
    completionTokens: asFiniteNumber(usage?.completion_tokens),
    totalTokens: asFiniteNumber(usage?.total_tokens),
    requestId: String(res.headers.get("x-request-id") ?? payload?.id ?? "").trim() || null,
  };
}

async function writeUsage(args: {
  provider: AdminAiProvider;
  requestId?: string | null;
  status: "ok" | "error";
  errorCode?: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  domain: string;
  targetLocale: string;
  itemKey?: string | null;
}): Promise<void> {
  const totalTokens = args.totalTokens ?? sumOptional(args.promptTokens, args.completionTokens);
  const estimatedCostUsd = estimateCostUsd({
    promptTokens: args.promptTokens,
    completionTokens: args.completionTokens,
    inputCostUsdPer1k: args.provider.inputCostUsdPer1k ?? null,
    outputCostUsdPer1k: args.provider.outputCostUsdPer1k ?? null,
  });
  const directEstimatedCostEur = estimateCostEur({
    promptTokens: args.promptTokens,
    completionTokens: args.completionTokens,
    inputCostEurPer1k: args.provider.inputCostEurPer1k ?? null,
    outputCostEurPer1k: args.provider.outputCostEurPer1k ?? null,
  });
  const estimatedCostEur = directEstimatedCostEur ?? (
    estimatedCostUsd !== null && args.provider.fxRateUsdToEur !== null && args.provider.fxRateUsdToEur !== undefined
      ? Number((estimatedCostUsd * args.provider.fxRateUsdToEur).toFixed(6))
      : null
  );

  await writeLlmUsageEvent({
    partner_id: null,
    route_name: `admin:${args.domain}:translate`,
    mode: "central_managed",
    provider: args.provider.provider,
    model: args.provider.model,
    prompt_tokens: args.promptTokens,
    completion_tokens: args.completionTokens,
    total_tokens: totalTokens,
    provider_account_id: args.provider.providerAccountId ?? null,
    provider_model_id: args.provider.providerModelId ?? null,
    billing_currency: "USD",
    fx_rate_usd_to_eur: args.provider.fxRateUsdToEur ?? null,
    input_cost_usd_per_1k_snapshot: args.provider.inputCostUsdPer1k ?? null,
    output_cost_usd_per_1k_snapshot: args.provider.outputCostUsdPer1k ?? null,
    estimated_cost_usd: estimatedCostUsd,
    estimated_cost_eur: estimatedCostEur,
    status: args.status,
    error_code: args.errorCode ?? null,
    request_id: args.requestId ?? null,
    raw_usage_json: {
      domain: args.domain,
      target_locale: args.targetLocale,
      item_key: args.itemKey ?? null,
    },
  });
}

export async function translateAdminTextItems(args: {
  admin?: AdminClient;
  domain: string;
  domainLabel: string;
  targetLocale: string;
  items: TranslateItem[];
}): Promise<Map<string, string>> {
  const admin = args.admin ?? createAdminClient();
  const targetLocale = asText(args.targetLocale).toLowerCase();
  if (!targetLocale || targetLocale === "de") {
    throw new Error("KI-Uebersetzung benoetigt eine Ziel-Locale ungleich de.");
  }

  const items = args.items.filter((item) => asText(item.sourceText).length > 0);
  if (items.length === 0) return new Map();

  if (I18N_MOCK_TRANSLATION) {
    return new Map(items.map((item) => [item.key, buildMockTranslation(targetLocale, item.sourceText)] as const));
  }

  await checkGlobalBudget(admin);
  const provider = await selectProvider();
  const translated = new Map<string, string>();

  for (const item of items) {
    let promptTokens: number | null = null;
    let completionTokens: number | null = null;
    let totalTokens: number | null = null;
    let requestId: string | null = null;
    try {
      const prompt = buildTranslationPrompt({
        targetLocale,
        domainLabel: args.domainLabel,
        itemLabel: item.label,
        sourceText: item.sourceText,
      });
      const result = await callOpenAiCompatible({
        ...provider,
        system: prompt.system,
        user: prompt.user,
      });
      promptTokens = result.promptTokens;
      completionTokens = result.completionTokens;
      totalTokens = result.totalTokens;
      requestId = result.requestId;
      translated.set(item.key, result.content.trim());
      await writeUsage({
        provider,
        requestId,
        status: "ok",
        promptTokens,
        completionTokens,
        totalTokens,
        domain: args.domain,
        targetLocale,
        itemKey: item.key,
      });
    } catch (error) {
      try {
        await writeUsage({
          provider,
          requestId,
          status: "error",
          errorCode: "ADMIN_TEXT_I18N_FAILED",
          promptTokens,
          completionTokens,
          totalTokens,
          domain: args.domain,
          targetLocale,
          itemKey: item.key,
        });
      } catch {
        // Ein Logging-Fehler darf den eigentlichen Uebersetzungsfehler nicht verdecken.
      }
      throw error;
    }
  }

  return translated;
}
