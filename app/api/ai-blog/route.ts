import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';
import { checkRateLimitPersistent, extractClientIpFromHeaders } from '@/lib/security/rate-limit';
import { validateOutboundUrl } from '@/lib/security/outbound-url';
import { normalizeLlmRuntimeMode } from '@/lib/llm/mode';
import { loadPartnerLlmPolicy } from '@/lib/llm/partner-policy';
import { readSecretFromAuthConfig } from '@/lib/security/secret-crypto';
import {
  checkGlobalAndPartnerBudget,
  estimateCostEur,
  estimateCostUsd,
  loadActiveGlobalLlmProviders,
  loadGlobalLlmConfig,
  writeLlmUsageEvent,
} from '@/lib/llm/global-governance';

type LlmConfig = {
  provider: string;
  base_url?: string | null;
  auth_config?: Record<string, unknown> | null;
  settings?: Record<string, unknown> | null;
};

type OpenAiCallResult = {
  content: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  errorCode: string | null;
};

const DEFAULT_PROVIDER = process.env.DEFAULT_LLM_PROVIDER ?? '';
const DEFAULT_API_KEY = process.env.DEFAULT_LLM_API_KEY ?? '';
const DEFAULT_MODEL = process.env.DEFAULT_LLM_MODEL ?? '';
const DEFAULT_BASE_URL = process.env.DEFAULT_LLM_BASE_URL ?? '';
const DEFAULT_TEMPERATURE = process.env.DEFAULT_LLM_TEMPERATURE ?? '';
const DEFAULT_MAX_TOKENS = process.env.DEFAULT_LLM_MAX_TOKENS ?? '';

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function usesCompletionTokens(provider: string | undefined, model: string): boolean {
  const normalizedProvider = String(provider ?? '').trim().toLowerCase();
  const normalizedModel = String(model ?? '').trim().toLowerCase();
  if (!normalizedModel) return false;
  if (normalizedProvider !== 'openai' && normalizedProvider !== 'azure_openai') return false;
  return normalizedModel.startsWith('gpt-5');
}

async function callOpenAICompatible({
  provider,
  apiKey,
  baseUrl,
  model,
  apiVersion,
  temperature,
  maxTokens,
  system,
  user,
}: {
  provider?: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  apiVersion?: string | null;
  temperature?: number | null;
  maxTokens?: number | null;
  system: string;
  user: string;
}): Promise<OpenAiCallResult> {
  if (!apiKey || !model) {
    return { content: null, promptTokens: null, completionTokens: null, totalTokens: null, errorCode: 'MISSING_API_KEY_OR_MODEL' };
  }
  const normalizedProvider = String(provider ?? '').trim().toLowerCase();
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
  const resolvedApiVersion = String(apiVersion ?? '').trim() || '2024-10-21';
  const url = normalizedProvider === 'azure_openai'
    ? `${normalizedBaseUrl}/openai/deployments/${encodeURIComponent(model)}/chat/completions?api-version=${encodeURIComponent(resolvedApiVersion)}`
    : `${normalizedBaseUrl}/chat/completions`;
  const outboundCheck = await validateOutboundUrl(url);
  if (!outboundCheck.ok) {
    console.error('LLM URL blocked:', outboundCheck.reason);
    return { content: null, promptTokens: null, completionTokens: null, totalTokens: null, errorCode: 'URL_BLOCKED' };
  }
  const payload: Record<string, unknown> = {
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: typeof temperature === 'number' ? temperature : 0.5,
  };
  const resolvedMaxTokens = typeof maxTokens === 'number' ? maxTokens : 900;
  if (usesCompletionTokens(provider, model)) {
    payload.max_completion_tokens = resolvedMaxTokens;
  } else {
    payload.max_tokens = resolvedMaxTokens;
  }
  if (normalizedProvider !== 'azure_openai') {
    payload.model = model;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...(normalizedProvider === 'azure_openai'
        ? { 'api-key': apiKey }
        : { Authorization: `Bearer ${apiKey}` }),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('LLM error:', res.status, text);
    return { content: null, promptTokens: null, completionTokens: null, totalTokens: null, errorCode: `HTTP_${res.status}` };
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  return {
    content: typeof content === 'string' ? content.trim() : null,
    promptTokens: asNumber(data?.usage?.prompt_tokens),
    completionTokens: asNumber(data?.usage?.completion_tokens),
    totalTokens: asNumber(data?.usage?.total_tokens),
    errorCode: typeof content === 'string' ? null : 'EMPTY_CONTENT',
  };
}

async function loadPartnerLlmConfig(partnerId: string): Promise<LlmConfig | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('partner_integrations')
    .select('provider, base_url, auth_config, settings, is_active')
    .eq('partner_id', partnerId)
    .eq('kind', 'llm')
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('partner_integrations llm lookup failed:', error.message);
    return null;
  }
  if (!data) return null;
  return {
    provider: String(data.provider ?? ''),
    base_url: data.base_url ?? null,
    auth_config: (data.auth_config as Record<string, unknown> | null) ?? null,
    settings: (data.settings as Record<string, unknown> | null) ?? null,
  };
}

function buildPrompt(args: {
  areaName: string;
  authorName?: string | null;
  source: { individual01: string; individual02: string; zitat: string };
  customPrompt?: string | null;
}) {
  const { areaName, authorName, source, customPrompt } = args;
  const system =
    'Du bist ein deutscher Immobilienmarkt-Redakteur. ' +
    'Erstelle einen kurzen, sachlichen Blogartikel ohne neue Fakten. ' +
    'Nutze ausschließlich die gelieferten Quellen.';

  const baseUser =
    `Region: ${areaName}\n` +
    (authorName ? `Autor: ${authorName}\n` : '') +
    '\nQuellen:\n' +
    `- Experteneinschätzung Text 01:\n${source.individual01}\n\n` +
    `- Experteneinschätzung Text 02:\n${source.individual02}\n\n` +
    `- Zitat:\n${source.zitat}\n\n` +
    'Aufgaben:\n' +
    '- Erstelle Headline, Subline und einen Blogartikel (Markdown).\n' +
    '- Keine neuen Fakten oder Zahlen hinzufügen.\n' +
    '- 2 bis 4 Abschnitte, klare Struktur.\n' +
    '- Ausgabe als JSON mit den Feldern: headline, subline, body_md.\n';

  const extra = customPrompt ? `\nZusatzvorgaben:\n${customPrompt}\n` : '';
  return { system, user: baseUser + extra };
}

function extractJson(text: string): Record<string, unknown> | null {
  const cleaned = text
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ip = extractClientIpFromHeaders(req.headers);
    const limit = await checkRateLimitPersistent(`ai-blog:${user.id}:${ip}`, { windowMs: 60_000, max: 10 });
    if (!limit.allowed) {
      return NextResponse.json(
        { error: `Rate limit exceeded. Retry in ${limit.retryAfterSec}s.` },
        { status: 429 },
      );
    }

    const body = await req.json();
    const { areaName, authorName, source, customPrompt } = body ?? {};

    if (!areaName || !source?.individual01 || !source?.individual02 || !source?.zitat) {
      return NextResponse.json({ error: 'Missing inputs' }, { status: 400 });
    }

    const prompt = buildPrompt({
      areaName,
      authorName: asString(authorName),
      source,
      customPrompt: asString(customPrompt),
    });

    let raw: string | null = null;
    let usagePromptTokens: number | null = null;
    let usageCompletionTokens: number | null = null;
    let usageTotalTokens: number | null = null;
    let usageEstimatedCostEur: number | null = null;
    let usageProvider = '';
    let usageModel = '';
    let usageMode: 'central_managed' | 'partner_managed' = 'central_managed';
    let usageErrorCode: string | null = null;
    let usageGlobalProvider: (Awaited<ReturnType<typeof loadActiveGlobalLlmProviders>>['providers'][number]) | null = null;
    let usageEstimatedCostUsd: number | null = null;

    const admin = createAdminClient();
    const partnerPolicy = await loadPartnerLlmPolicy(admin, user.id);
    const partnerConfig = await loadPartnerLlmConfig(user.id);
    const llmMode = normalizeLlmRuntimeMode(partnerConfig?.settings?.llm_mode ?? partnerPolicy.llm_mode_default);
    const hasOwnLlmConfig = llmMode === 'partner_managed' && Boolean(partnerConfig?.provider);
    const budget = await checkGlobalAndPartnerBudget(user.id);
    if (!budget.allowed) {
      return NextResponse.json({ error: `LLM-Budgetgrenze erreicht (${budget.reason}).` }, { status: 429 });
    }

    if (hasOwnLlmConfig && partnerPolicy.llm_partner_managed_allowed && partnerConfig?.provider) {
      const apiKey = readSecretFromAuthConfig(partnerConfig.auth_config ?? null, 'api_key');
      const model =
        asString(partnerConfig.settings?.model) ||
        asString(partnerConfig.settings?.model_name) ||
        '';
      const baseUrl =
        asString(partnerConfig.base_url) ||
        asString(partnerConfig.settings?.base_url) ||
        'https://api.openai.com/v1';
      const temperature = asNumber(partnerConfig.settings?.temperature);
      const maxTokens = asNumber(partnerConfig.settings?.max_tokens);

      if (partnerConfig.provider === 'openai' || partnerConfig.provider === 'mistral' || partnerConfig.provider === 'azure_openai' || partnerConfig.provider === 'generic_llm') {
        const result = await callOpenAICompatible({
          provider: partnerConfig.provider,
          apiKey: apiKey ?? '',
          baseUrl,
          model,
          apiVersion: asString(partnerConfig.settings?.api_version),
          temperature,
          maxTokens,
          system: prompt.system,
          user: prompt.user,
        });
        raw = result.content;
        usagePromptTokens = result.promptTokens;
        usageCompletionTokens = result.completionTokens;
        usageTotalTokens = result.totalTokens;
        usageProvider = String(partnerConfig.provider);
        usageModel = model;
        usageMode = 'partner_managed';
        usageErrorCode = result.errorCode;
      }
    }

    if (!raw) {
      const globalConfig = await loadGlobalLlmConfig();
      if (globalConfig.config.central_enabled) {
        const globalProviders = await loadActiveGlobalLlmProviders();
        for (const p of globalProviders.providers) {
          const provider = String(p.provider ?? '').toLowerCase();
          if (provider !== 'openai' && provider !== 'mistral' && provider !== 'azure_openai' && provider !== 'generic_llm') continue;
          const apiKey = readSecretFromAuthConfig(p.auth_config ?? null, 'api_key') || readSecretFromAuthConfig(p.auth_config ?? null, 'token') || '';
          if (!apiKey || !p.model) continue;
          const result = await callOpenAICompatible({
            provider: p.provider,
            apiKey,
            baseUrl: p.base_url || 'https://api.openai.com/v1',
            model: p.model,
            apiVersion: asString(p.api_version),
            temperature: p.temperature,
            maxTokens: p.max_tokens,
            system: prompt.system,
            user: prompt.user,
          });
          if (result.content) {
            raw = result.content;
            usagePromptTokens = result.promptTokens;
            usageCompletionTokens = result.completionTokens;
            usageTotalTokens = result.totalTokens;
            usageProvider = p.provider;
            usageModel = p.model;
            usageMode = 'central_managed';
            usageGlobalProvider = p;
            usageErrorCode = null;
            usageEstimatedCostUsd = estimateCostUsd({
              promptTokens: result.promptTokens,
              completionTokens: result.completionTokens,
              inputCostUsdPer1k: p.input_cost_usd_per_1k,
              outputCostUsdPer1k: p.output_cost_usd_per_1k,
            });
            usageEstimatedCostEur = estimateCostEur({
              promptTokens: result.promptTokens,
              completionTokens: result.completionTokens,
              inputCostEurPer1k: p.input_cost_eur_per_1k,
              outputCostEurPer1k: p.output_cost_eur_per_1k,
            });
            break;
          }
          usageErrorCode = result.errorCode;
        }
      }
    }

    const defaultProvider = String(DEFAULT_PROVIDER || 'openai').toLowerCase();
    const defaultOpenAiCompatibleProviders = new Set(['openai', 'mistral', 'azure_openai', 'generic_llm']);
    if (!raw && defaultOpenAiCompatibleProviders.has(defaultProvider) && DEFAULT_API_KEY && DEFAULT_MODEL) {
      const result = await callOpenAICompatible({
        provider: defaultProvider,
        apiKey: DEFAULT_API_KEY,
        baseUrl: DEFAULT_BASE_URL || 'https://api.openai.com/v1',
        model: DEFAULT_MODEL,
        temperature: asNumber(DEFAULT_TEMPERATURE),
        maxTokens: asNumber(DEFAULT_MAX_TOKENS),
        system: prompt.system,
        user: prompt.user,
      });
      raw = result.content;
      usagePromptTokens = result.promptTokens;
      usageCompletionTokens = result.completionTokens;
      usageTotalTokens = result.totalTokens;
      usageProvider = defaultProvider;
      usageModel = DEFAULT_MODEL;
      usageMode = 'central_managed';
      usageErrorCode = result.errorCode;
    }

    const fallback = {
      headline: `Immobilienmarkt-Update ${areaName}`,
      subline: 'Ein kompakter Blick auf den aktuellen Marktüberblick.',
      body_md: `${source.individual01}\n\n${source.individual02}\n\n> ${source.zitat}`,
    };

    if (!raw) {
      try {
        await writeLlmUsageEvent({
          partner_id: user.id,
          route_name: 'ai-blog',
          mode: usageMode,
          provider: usageProvider || 'fallback',
          model: usageModel || 'fallback',
          prompt_tokens: usagePromptTokens,
          completion_tokens: usageCompletionTokens,
          total_tokens: usageTotalTokens,
          provider_account_id: usageGlobalProvider?.provider_account_id ?? null,
          provider_model_id: usageGlobalProvider?.provider_model_id ?? null,
          fx_rate_usd_to_eur: usageGlobalProvider?.fx_rate_usd_to_eur ?? null,
          input_cost_usd_per_1k_snapshot: usageGlobalProvider?.input_cost_usd_per_1k ?? null,
          output_cost_usd_per_1k_snapshot: usageGlobalProvider?.output_cost_usd_per_1k ?? null,
          estimated_cost_usd: usageEstimatedCostUsd,
          estimated_cost_eur: usageEstimatedCostEur,
          status: 'error',
          error_code: usageErrorCode ?? 'FALLBACK_USED',
        });
      } catch (usageError) {
        console.error('llm usage logging failed (ai-blog fallback):', usageError);
      }
      return NextResponse.json(fallback);
    }

    try {
      await writeLlmUsageEvent({
        partner_id: user.id,
        route_name: 'ai-blog',
        mode: usageMode,
        provider: usageProvider || 'fallback',
        model: usageModel || 'fallback',
        prompt_tokens: usagePromptTokens,
        completion_tokens: usageCompletionTokens,
        total_tokens: usageTotalTokens,
        provider_account_id: usageGlobalProvider?.provider_account_id ?? null,
        provider_model_id: usageGlobalProvider?.provider_model_id ?? null,
        fx_rate_usd_to_eur: usageGlobalProvider?.fx_rate_usd_to_eur ?? null,
        input_cost_usd_per_1k_snapshot: usageGlobalProvider?.input_cost_usd_per_1k ?? null,
        output_cost_usd_per_1k_snapshot: usageGlobalProvider?.output_cost_usd_per_1k ?? null,
        estimated_cost_usd: usageEstimatedCostUsd,
        estimated_cost_eur: usageEstimatedCostEur,
        status: 'ok',
        error_code: null,
      });
    } catch (usageError) {
      console.error('llm usage logging failed (ai-blog):', usageError);
    }

    const parsed = extractJson(raw) ?? fallback;
    return NextResponse.json({
      headline: String(parsed.headline || fallback.headline),
      subline: String(parsed.subline || fallback.subline),
      body_md: String(parsed.body_md || fallback.body_md),
    });
  } catch (error: unknown) {
    console.error('AI Blog Route Error:', error);
    return NextResponse.json({ error: 'Fehler in der KI-Schnittstelle' }, { status: 500 });
  }
}
