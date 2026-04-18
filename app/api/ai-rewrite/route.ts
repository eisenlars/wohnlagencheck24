// app/api/ai-rewrite/route.ts


import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';
import { checkRateLimitPersistent, extractClientIpFromHeaders } from '@/lib/security/rate-limit';
import { validateOutboundUrl } from '@/lib/security/outbound-url';
import { normalizeLlmRuntimeMode } from '@/lib/llm/mode';
import { loadPartnerLlmPolicy } from '@/lib/llm/partner-policy';
import { readSecretFromAuthConfig } from '@/lib/security/secret-crypto';
import {
  CREDIT_CURRENCY,
  CREDITS_PER_EUR,
  buildPortalPartnerIncludedBillingContext,
  estimateEurFromUsd,
  eurToCredits,
} from '@/lib/ai-billing/credits';
import type { AiUsageFeature } from '@/lib/ai-billing/types';
import {
  checkGlobalAndPartnerBudget,
  estimateCostEur,
  estimateCostUsd,
  type GlobalLlmProvider,
  loadActiveGlobalLlmProviders,
  loadGlobalLlmConfig,
  writeLlmUsageEvent,
} from '@/lib/llm/global-governance';
import { loadUsdToEurRate } from '@/lib/llm/provider-catalog';

type LlmConfig = {
  id?: string;
  provider: string;
  base_url?: string | null;
  auth_config?: Record<string, unknown> | null;
  settings?: Record<string, unknown> | null;
};

const DEFAULT_PROVIDER = process.env.DEFAULT_LLM_PROVIDER ?? '';
const DEFAULT_API_KEY = process.env.DEFAULT_LLM_API_KEY ?? '';
const DEFAULT_MODEL = process.env.DEFAULT_LLM_MODEL ?? '';
const DEFAULT_BASE_URL = process.env.DEFAULT_LLM_BASE_URL ?? '';
const DEFAULT_TEMPERATURE = process.env.DEFAULT_LLM_TEMPERATURE ?? '';
const DEFAULT_MAX_TOKENS = process.env.DEFAULT_LLM_MAX_TOKENS ?? '';
const I18N_MOCK_TRANSLATION = String(process.env.I18N_MOCK_TRANSLATION ?? '').trim() === '1';

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

function buildMockTranslation(locale: string | null, text: string): string {
  const tag = (locale && locale.trim() ? locale : 'xx').toUpperCase();
  return `[${tag} MOCK] ${String(text ?? '').trim()}`;
}

function normalizeNumericToken(token: string): string {
  const trimmed = String(token ?? '').trim();
  if (!trimmed) return '';
  const hasPercent = trimmed.endsWith('%');
  const coreRaw = hasPercent ? trimmed.slice(0, -1) : trimmed;
  const coreNoSpaces = coreRaw.replace(/\s+/g, '');

  let normalized = coreNoSpaces;
  if (coreNoSpaces.includes(',') && coreNoSpaces.includes('.')) {
    normalized = coreNoSpaces.replace(/\./g, '').replace(',', '.');
  } else if (coreNoSpaces.includes(',')) {
    normalized = coreNoSpaces.replace(',', '.');
  }

  const parsed = Number(normalized);
  const canonical = Number.isFinite(parsed) ? String(parsed) : coreNoSpaces;
  return hasPercent ? `${canonical}%` : canonical;
}

function extractNumericTokens(text: string): string[] {
  return (String(text ?? '').match(/[-+]?\d+(?:[.,]\d+)?%?/g) ?? [])
    .map((token) => normalizeNumericToken(token))
    .filter((token) => token.length > 0)
    .sort();
}

function hasSameNumericTokens(source: string, rewritten: string): boolean {
  const sourceTokens = extractNumericTokens(source);
  const rewrittenTokens = extractNumericTokens(rewritten);
  if (sourceTokens.length !== rewrittenTokens.length) return false;
  for (let i = 0; i < sourceTokens.length; i += 1) {
    if (sourceTokens[i] !== rewrittenTokens[i]) return false;
  }
  return true;
}

function buildPrompt(args: { text: string; areaName: string; type?: string; sectionLabel?: string }) {
  const { text, areaName, type, sectionLabel } = args;
  const label = (sectionLabel ?? '').toLowerCase();

  if (label.includes('primary keyword')) {
    return {
      system: 'Du bist ein deutscher SEO-Redakteur. Formuliere prägnante Keywords.',
      user:
        `Gib ein prägnantes Haupt-Keyword für die Themenseite in ${areaName}. ` +
        `Keine Zahlen, keine neuen Fakten.\n\nOriginal:\n${text}`,
    };
  }

  if (label.includes('secondary keywords')) {
    return {
      system: 'Du bist ein deutscher SEO-Redakteur. Erstelle relevante Keyword-Listen.',
      user:
        `Gib 3–6 sekundäre Keywords als CSV für ${areaName}. ` +
        `Keine Zahlen, keine neuen Fakten.\n\nOriginal:\n${text}`,
    };
  }

  if (label.includes('entities')) {
    return {
      system: 'Du bist ein deutscher SEO-Redakteur. Erstelle Entitäten-Listen.',
      user:
        `Gib relevante Entitäten als CSV (Ort, Kreis, Bundesland, Thema) für ${areaName}. ` +
        `Keine neuen Fakten.\n\nOriginal:\n${text}`,
    };
  }

  if (label.includes('summary')) {
    return {
      system: 'Du bist ein deutscher Redakteur. Schreibe kurze, sachliche Zusammenfassungen.',
      user:
        `Schreibe eine 2–3 Sätze Zusammenfassung zur Themenseite in ${areaName}. ` +
        `Keine Zahlen, keine neuen Fakten.\n\nOriginal:\n${text}`,
    };
  }

  if (label.includes('cta')) {
    return {
      system: 'Du bist ein deutscher Marketing-Redakteur. Schreibe kurze, neutrale CTAs.',
      user:
        `Formuliere eine kurze, neutrale Handlungsaufforderung für ${areaName}. ` +
        `Keine übertriebenen Versprechen.\n\nOriginal:\n${text}`,
    };
  }

  if (label.includes('description') && !label.includes('seo')) {
    return {
      system: 'Du bist ein deutscher SEO-Redakteur. Schreibe prägnante Meta-Descriptions.',
      user:
        `Schreibe eine Meta-Description (140–160 Zeichen) mit lokalem Bezug für ${areaName}. ` +
        `Keine Zahlen, keine neuen Fakten.\n\nOriginal:\n${text}`,
    };
  }

  if (label.includes('title') && !label.includes('seo')) {
    return {
      system: 'Du bist ein deutscher SEO-Redakteur. Schreibe prägnante Titles.',
      user:
        `Schreibe einen SEO-Title (max. 60 Zeichen) für die Themenseite in ${areaName}. ` +
        `Keine Zahlen, keine neuen Fakten.\n\nOriginal:\n${text}`,
    };
  }

  if (label.includes('objekt-titel') || label.includes('h1') || (label.includes('titel') && !label.includes('seo'))) {
    return {
      system: 'Du bist ein deutscher Immobilien-SEO-Redakteur. Schreibe klare, prägnante Objekt-Titel ohne erfundene Fakten.',
      user:
        `Formuliere einen prägnanten Objekt-Titel (max. 60 Zeichen) für das Objekt in ${areaName}. ` +
        `Keine Fantasieangaben, keine Superlative ohne Beleg.\n\nOriginal:\n${text}`,
    };
  }

  if (label.includes('seo-title')) {
    return {
      system: 'Du bist ein deutscher Immobilien-SEO-Redakteur. Schreibe SEO-Titel mit Fokus auf Relevanz und Kürze.',
      user:
        `Schreibe einen SEO-Title (max. 60 Zeichen) für ein Immobilienangebot in ${areaName}. ` +
        `Fakten beibehalten.\n\nOriginal:\n${text}`,
    };
  }

  if (label.includes('seo-description')) {
    return {
      system: 'Du bist ein deutscher Immobilien-SEO-Redakteur. Schreibe Meta-Descriptions kurz, klar und werthaltig.',
      user:
        `Schreibe eine SEO-Description (140–160 Zeichen) für ein Immobilienangebot in ${areaName}. ` +
        `Fakten beibehalten.\n\nOriginal:\n${text}`,
    };
  }

  if (label.includes('teaser') || label.includes('kurztext')) {
    return {
      system: 'Du bist ein deutscher Immobilien-Redakteur. Schreibe kurze, klare Teaser ohne neue Fakten.',
      user:
        `Formuliere einen kurzen Teaser (1–2 Sätze) zum Objekt in ${areaName}. ` +
        `Keine neuen Fakten hinzufügen.\n\nOriginal:\n${text}`,
    };
  }

  if (label.includes('langtext')) {
    return {
      system: 'Du bist ein deutscher Immobilien-Redakteur. Optimiere Texte ohne neue Fakten.',
      user:
        `Optimiere den Langtext für bessere Lesbarkeit und Struktur. ` +
        `Keine neuen Fakten hinzufügen.\n\nKontext: ${areaName}\n\nOriginal:\n${text}`,
    };
  }

  if (label.includes('lage')) {
    return {
      system: 'Du bist ein deutscher Immobilien-Redakteur. Schreibe sachliche Lage-Texte ohne Übertreibungen.',
      user:
        `Formuliere den Lage-Text klar und informativ. Keine erfundenen Fakten, keine Übertreibungen. ` +
        `Kontext: ${areaName}\n\nOriginal:\n${text}`,
    };
  }

  if (label.includes('ausstatt')) {
    return {
      system: 'Du bist ein deutscher Immobilien-Redakteur. Füge keine neuen Ausstattungsmerkmale hinzu.',
      user:
        `Formuliere den Ausstattungstext klar und strukturiert. ` +
        `Keine neuen Features hinzufügen.\n\nOriginal:\n${text}`,
    };
  }

  if (label.includes('highlights')) {
    return {
      system: 'Du bist ein deutscher Immobilien-Redakteur. Schreibe kurze, konkrete Highlights ohne neue Fakten.',
      user:
        `Schreibe max. 6 Highlights (je 1 Zeile), kurz und konkret. ` +
        `Nur belegte Fakten verwenden.\n\nOriginal:\n${text}`,
    };
  }

  if (label.includes('alt-texte') || label.includes('alttexte')) {
    return {
      system: 'Du bist ein deutscher Immobilien-Redakteur. Schreibe sachliche Bildbeschreibungen.',
      user:
        `Erstelle kurze, sachliche Alt-Texte (1 Zeile je Bild). ` +
        `Keine erfundenen Details.\n\nOriginal:\n${text}`,
    };
  }

  if (type === 'data_driven') {
    return {
      system: 'Du bist ein deutscher Redakteur. Fakten und Zahlen dürfen NICHT verändert werden.',
      user:
        `Formuliere den folgenden datengetriebenen Text flüssiger. ` +
        `Alle Zahlen und Fakten müssen exakt gleich bleiben.\n\nOriginal:\n${text}`,
    };
  }

  if (label.includes('überschrift') || label.includes('headline')) {
    return {
      system: 'Du bist ein deutscher Redakteur. Schreibe prägnante Überschriften.',
      user:
        `Formuliere eine prägnante Überschrift (40–60 Zeichen) passend zum Inhalt, ` +
        `ohne neue Fakten.\n\nOriginal:\n${text}`,
    };
  }

  return {
    system: 'Du bist ein deutscher Immobilien-Redakteur. Schreibe klar, prägnant und ohne neue Fakten.',
    user:
        `Optimiere den folgenden Text für bessere Lesbarkeit und SEO. ` +
        `Keine neuen Fakten hinzufügen.\n\nKontext: ${areaName}\n\nOriginal:\n${text}`,
  };
}

function resolveRewriteUsageFeature(args: {
  targetLocale: string | null;
  type: string | null;
  sectionLabel?: string | null;
}): AiUsageFeature {
  if (args.targetLocale) return 'content_translate';
  const normalizedType = String(args.type ?? '').trim().toLowerCase();
  const normalizedLabel = String(args.sectionLabel ?? '').trim().toLowerCase();
  if (
    normalizedType === 'marketing'
    || normalizedLabel.includes('seo')
    || normalizedLabel.includes('title')
    || normalizedLabel.includes('description')
    || normalizedLabel.includes('keyword')
  ) {
    return 'seo_meta_generate';
  }
  return 'content_optimize';
}

type OpenAiCallResult = {
  content: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  errorCode: string | null;
};

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
  temperature: number | null;
  maxTokens: number | null;
  system: string;
  user: string;
}): Promise<OpenAiCallResult> {
  if (!apiKey || !model) return { content: null, promptTokens: null, completionTokens: null, totalTokens: null, errorCode: 'MISSING_API_KEY_OR_MODEL' };
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
  const messages = [];
  if (system.trim().length > 0) {
    messages.push({ role: 'system', content: system });
  }
  messages.push({ role: 'user', content: user });
  const payload: Record<string, unknown> = {
    messages,
  };
  if (normalizedProvider !== 'azure_openai') {
    payload.model = model;
  }
  if (temperature !== null) payload.temperature = temperature;
  if (maxTokens !== null) {
    if (usesCompletionTokens(provider, model)) {
      payload.max_completion_tokens = maxTokens;
    } else {
      payload.max_tokens = maxTokens;
    }
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
  const promptTokens = asNumber(data?.usage?.prompt_tokens);
  const completionTokens = asNumber(data?.usage?.completion_tokens);
  const totalTokens = asNumber(data?.usage?.total_tokens);
  return {
    content: typeof content === 'string' ? content.trim() : null,
    promptTokens,
    completionTokens,
    totalTokens,
    errorCode: typeof content === 'string' ? null : 'EMPTY_CONTENT',
  };
}

async function loadPartnerLlmConfig(partnerId: string, integrationId?: string | null): Promise<LlmConfig | null> {
  const admin = createAdminClient();
  let query = admin
    .from('partner_integrations')
    .select('id, provider, base_url, auth_config, settings, is_active')
    .eq('partner_id', partnerId)
    .eq('kind', 'llm')
    .eq('is_active', true);

  if (integrationId) {
    query = query.eq('id', integrationId).limit(1);
  } else {
    query = query.order('id', { ascending: true }).limit(1);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error('partner_integrations llm lookup failed:', error.message);
    return null;
  }
  if (!data) return null;
  return {
    id: String(data.id ?? ''),
    provider: String(data.provider ?? ''),
    base_url: data.base_url ?? null,
    auth_config: (data.auth_config as Record<string, unknown> | null) ?? null,
    settings: (data.settings as Record<string, unknown> | null) ?? null,
  };
}

async function loadGlobalLlmProviderById(providerId?: string | null): Promise<GlobalLlmProvider | null> {
  const id = asString(providerId);
  if (!id) return null;
  const list = await loadActiveGlobalLlmProviders();
  return list.providers.find((p) => String(p.id ?? "") === id) ?? null;
}

/**
 * KI-Veredelungs-Schnittstelle
 * Verarbeitet verschiedene Text-Typen mit spezifischen (simulierten) Prompts.
 */
export async function POST(req: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ip = extractClientIpFromHeaders(req.headers);
    const limit = await checkRateLimitPersistent(`ai-rewrite:${user.id}:${ip}`, { windowMs: 60_000, max: 20 });
    if (!limit.allowed) {
      return NextResponse.json(
        { error: `Rate limit exceeded. Retry in ${limit.retryAfterSec}s.` },
        { status: 429 },
      );
    }

    const body = await req.json();
    const { text, areaName, type, sectionLabel, customPrompt } = body;
    const mockContext = asString(body?.mock_context);
    const targetLocale = asString(body?.target_locale);
    const areaId = asString(body?.area_id);
    const selectedLlmIntegrationId = asString(body?.llm_integration_id);
    const selectedGlobalProviderId = asString(body?.llm_global_provider_id);
    const debugPrompt = body?.debug_prompt === true || String(body?.debug_prompt ?? '').trim() === '1';

    if (I18N_MOCK_TRANSLATION && mockContext === 'i18n') {
      return NextResponse.json({ optimizedText: buildMockTranslation(targetLocale, String(text ?? '')) });
    }

    if (areaId) {
      const admin = createAdminClient();
      const { data: assignment, error: assignmentError } = await admin
        .from('partner_area_map')
        .select('id')
        .eq('auth_user_id', user.id)
        .eq('area_id', areaId)
        .limit(1)
        .maybeSingle();
      if (assignmentError) {
        return NextResponse.json({ error: 'Area entitlement check failed.' }, { status: 500 });
      }
      if (!assignment) {
        return NextResponse.json({ error: 'Forbidden: area not assigned to user.' }, { status: 403 });
      }
    }

    const custom = asString(customPrompt);
    const basePrompt = buildPrompt({ text, areaName, type, sectionLabel });
    const prompt = custom
      ? {
          system: basePrompt.system,
          user: `${custom}\n\nKontext: ${areaName}\n\nAusgangsdaten:\n${text}`,
        }
      : basePrompt;

    if (debugPrompt) {
      return NextResponse.json({
        prompt: {
          system: prompt.system,
          user: prompt.user,
          usesCustomPrompt: Boolean(custom),
          basePrompt,
          customPrompt: custom,
        },
      });
    }

    let optimizedText: string | null = null;
    let usagePromptTokens: number | null = null;
    let usageCompletionTokens: number | null = null;
    let usageTotalTokens: number | null = null;
    let usageEstimatedCostEur: number | null = null;
    let usageProvider = '';
    let usageModel = '';
    let usageMode: 'central_managed' | 'partner_managed' = 'central_managed';
    let usageErrorCode: string | null = null;
    let usageGlobalProvider: GlobalLlmProvider | null = null;
    let usageEstimatedCostUsd: number | null = null;
    let usageFxRateUsdToEur: number | null = null;

    const admin = createAdminClient();
    const partnerPolicy = await loadPartnerLlmPolicy(admin, user.id);
    const partnerConfig = await loadPartnerLlmConfig(user.id, selectedLlmIntegrationId);
    const selectedGlobalProvider = await loadGlobalLlmProviderById(selectedGlobalProviderId);
    const llmMode = normalizeLlmRuntimeMode(partnerConfig?.settings?.llm_mode ?? partnerPolicy.llm_mode_default);
    const hasOwnLlmConfig = llmMode === 'partner_managed'
      && partnerPolicy.llm_partner_managed_allowed
      && Boolean(partnerConfig?.provider);
    if (selectedLlmIntegrationId && !partnerConfig) {
      return NextResponse.json(
        { error: 'Ausgewaehlte LLM-Integration nicht gefunden oder inaktiv.' },
        { status: 400 },
      );
    }
    if (selectedLlmIntegrationId && !partnerPolicy.llm_partner_managed_allowed) {
      return NextResponse.json(
        { error: 'Partnerverwaltete LLM-Anbindungen sind administrativ nicht freigeschaltet.' },
        { status: 403 },
      );
    }
    if (selectedGlobalProviderId && !selectedGlobalProvider) {
      return NextResponse.json(
        { error: 'Ausgewaehlter globaler LLM-Provider nicht gefunden oder inaktiv.' },
        { status: 400 },
      );
    }

    const budget = await checkGlobalAndPartnerBudget(user.id);
    if (!budget.allowed) {
      return NextResponse.json(
        { error: `LLM-Budgetgrenze erreicht (${budget.reason}).` },
        { status: 429 },
      );
    }

    if (hasOwnLlmConfig && partnerConfig?.provider) {
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
      const provider = String(partnerConfig.provider).toLowerCase();
      const openAiCompatibleProviders = new Set(['openai', 'mistral', 'azure_openai', 'generic_llm']);
      if (openAiCompatibleProviders.has(provider)) {
        const result = await callOpenAICompatible({
          provider,
          apiKey: apiKey ?? '',
          baseUrl,
          model,
          apiVersion: asString(partnerConfig.settings?.api_version),
          temperature,
          maxTokens,
          system: prompt.system,
          user: prompt.user,
        });
        optimizedText = result.content;
        usagePromptTokens = result.promptTokens;
        usageCompletionTokens = result.completionTokens;
        usageTotalTokens = result.totalTokens;
        usageProvider = provider;
        usageModel = model;
        usageMode = 'partner_managed';
        usageErrorCode = result.errorCode;
      }
    }

    if (!optimizedText && selectedGlobalProvider) {
      const provider = String(selectedGlobalProvider.provider ?? '').toLowerCase();
      const openAiCompatibleProviders = new Set(['openai', 'mistral', 'azure_openai', 'generic_llm']);
      if (openAiCompatibleProviders.has(provider)) {
        const apiKey =
          readSecretFromAuthConfig(selectedGlobalProvider.auth_config ?? null, 'api_key')
          || readSecretFromAuthConfig(selectedGlobalProvider.auth_config ?? null, 'token')
          || '';
        if (apiKey && selectedGlobalProvider.model) {
          const result = await callOpenAICompatible({
            provider: selectedGlobalProvider.provider,
            apiKey,
            baseUrl: selectedGlobalProvider.base_url || 'https://api.openai.com/v1',
            model: selectedGlobalProvider.model,
            apiVersion: asString(selectedGlobalProvider.api_version),
            temperature: selectedGlobalProvider.temperature,
            maxTokens: selectedGlobalProvider.max_tokens,
            system: prompt.system,
            user: prompt.user,
          });
          optimizedText = result.content;
          usagePromptTokens = result.promptTokens;
          usageCompletionTokens = result.completionTokens;
          usageTotalTokens = result.totalTokens;
          usageProvider = selectedGlobalProvider.provider;
          usageModel = selectedGlobalProvider.model;
          usageMode = 'central_managed';
          usageGlobalProvider = selectedGlobalProvider;
          usageErrorCode = result.errorCode;
          usageEstimatedCostUsd = estimateCostUsd({
            promptTokens: result.promptTokens,
            completionTokens: result.completionTokens,
            inputCostUsdPer1k: selectedGlobalProvider.input_cost_usd_per_1k,
            outputCostUsdPer1k: selectedGlobalProvider.output_cost_usd_per_1k,
          });
          usageFxRateUsdToEur = selectedGlobalProvider.fx_rate_usd_to_eur ?? await loadUsdToEurRate(admin).catch(() => null);
          usageEstimatedCostEur = estimateCostEur({
            promptTokens: result.promptTokens,
            completionTokens: result.completionTokens,
            inputCostEurPer1k: selectedGlobalProvider.input_cost_eur_per_1k,
            outputCostEurPer1k: selectedGlobalProvider.output_cost_eur_per_1k,
          }) ?? estimateEurFromUsd(usageEstimatedCostUsd, usageFxRateUsdToEur);
        }
      }
    }

    // Zentral verwaltete Provider mit Fallback-Reihenfolge (priority ASC).
    if (!optimizedText && (areaId || llmMode === 'central_managed')) {
      const globalConfig = await loadGlobalLlmConfig();
      if (globalConfig.config.central_enabled) {
        const globalProviders = await loadActiveGlobalLlmProviders();
        const openAiCompatibleProviders = new Set(['openai', 'mistral', 'azure_openai', 'generic_llm']);
        for (const p of globalProviders.providers) {
          if (!openAiCompatibleProviders.has(String(p.provider ?? '').toLowerCase())) continue;
          const apiKey =
            readSecretFromAuthConfig(p.auth_config ?? null, 'api_key')
            || readSecretFromAuthConfig(p.auth_config ?? null, 'token')
            || '';
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
            optimizedText = result.content;
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
            usageFxRateUsdToEur = p.fx_rate_usd_to_eur ?? await loadUsdToEurRate(admin).catch(() => null);
            usageEstimatedCostEur = estimateCostEur({
              promptTokens: result.promptTokens,
              completionTokens: result.completionTokens,
              inputCostEurPer1k: p.input_cost_eur_per_1k,
              outputCostEurPer1k: p.output_cost_eur_per_1k,
            }) ?? estimateEurFromUsd(usageEstimatedCostUsd, usageFxRateUsdToEur);
            break;
          }
          usageErrorCode = result.errorCode;
        }
      }
    }

    // ENV-Fallback als letzte Sicherheitsstufe.
    const defaultProvider = String(DEFAULT_PROVIDER || 'openai').toLowerCase();
    const defaultOpenAiCompatibleProviders = new Set(['openai', 'mistral', 'azure_openai', 'generic_llm']);
    if (!optimizedText && (areaId || llmMode === 'central_managed') && defaultOpenAiCompatibleProviders.has(defaultProvider) && DEFAULT_API_KEY && DEFAULT_MODEL) {
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
      optimizedText = result.content;
      usagePromptTokens = result.promptTokens;
      usageCompletionTokens = result.completionTokens;
      usageTotalTokens = result.totalTokens;
      usageProvider = defaultProvider;
      usageModel = DEFAULT_MODEL;
      usageMode = 'central_managed';
      usageErrorCode = result.errorCode;
    }

    if (!optimizedText && !areaId && !hasOwnLlmConfig && llmMode !== 'central_managed') {
      return NextResponse.json(
        { error: 'No partner LLM integration configured for non-area rewrite.' },
        { status: 403 },
      );
    }

    if (!optimizedText) {
      // Fallback (wie bisher)
      await new Promise((resolve) => setTimeout(resolve, 600));
      optimizedText = `[KI-FALLBACK]\nOptimierte Fassung für ${areaName}: ${text}`;
      if (!usageErrorCode) usageErrorCode = 'FALLBACK_USED';
    }

    try {
      const billingContext = buildPortalPartnerIncludedBillingContext(
        user.id,
        resolveRewriteUsageFeature({ targetLocale, type, sectionLabel }),
      );
      await writeLlmUsageEvent({
        partner_id: user.id,
        route_name: 'ai-rewrite',
        mode: usageMode,
        provider: usageErrorCode ? 'fallback' : (usageProvider || 'fallback'),
        model: usageErrorCode ? 'fallback' : (usageModel || 'fallback'),
        prompt_tokens: usagePromptTokens,
        completion_tokens: usageCompletionTokens,
        total_tokens: usageTotalTokens,
        provider_account_id: usageGlobalProvider?.provider_account_id ?? null,
        provider_model_id: usageGlobalProvider?.provider_model_id ?? null,
        fx_rate_usd_to_eur: usageFxRateUsdToEur,
        input_cost_usd_per_1k_snapshot: usageGlobalProvider?.input_cost_usd_per_1k ?? null,
        output_cost_usd_per_1k_snapshot: usageGlobalProvider?.output_cost_usd_per_1k ?? null,
        estimated_cost_usd: usageEstimatedCostUsd,
        estimated_cost_eur: usageEstimatedCostEur,
        billing_scope: billingContext.billing_scope,
        billing_mode: billingContext.billing_mode,
        billing_owner_partner_id: billingContext.billing_owner_partner_id,
        billing_subject_partner_id: billingContext.billing_subject_partner_id,
        network_partner_id: billingContext.network_partner_id,
        feature: billingContext.feature,
        estimated_credit_delta: eurToCredits(usageEstimatedCostEur),
        billed_credit_delta: null,
        credit_rate_snapshot: CREDITS_PER_EUR,
        credit_currency_snapshot: CREDIT_CURRENCY,
        status: usageErrorCode ? 'error' : 'ok',
        error_code: usageErrorCode ?? null,
      });
    } catch (usageError) {
      console.error('llm usage logging failed (ai-rewrite):', usageError);
    }

    if (type === 'data_driven' && optimizedText && !hasSameNumericTokens(String(text ?? ''), optimizedText)) {
      return NextResponse.json(
        { error: 'Data-driven guard: Zahlen/Fakten wurden veraendert.' },
        { status: 422 },
      );
    }

    return NextResponse.json({ optimizedText });

  } catch (error: unknown) {
    console.error('AI Route Error:', error);
    return NextResponse.json({ error: 'Fehler in der KI-Schnittstelle' }, { status: 500 });
  }
}
