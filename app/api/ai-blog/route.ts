import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';

type LlmConfig = {
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

async function callOpenAICompatible({
  apiKey,
  baseUrl,
  model,
  temperature,
  maxTokens,
  system,
  user,
}: {
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature?: number | null;
  maxTokens?: number | null;
  system: string;
  user: string;
}) {
  const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const payload = {
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: typeof temperature === 'number' ? temperature : 0.5,
    max_tokens: typeof maxTokens === 'number' ? maxTokens : 900,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('LLM error:', res.status, text);
    return null;
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  return typeof content === 'string' ? content.trim() : null;
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
    `- Individueller Text 01:\n${source.individual01}\n\n` +
    `- Individueller Text 02:\n${source.individual02}\n\n` +
    `- Zitat:\n${source.zitat}\n\n` +
    'Aufgaben:\n' +
    '- Erstelle Headline, Subline und einen Blogartikel (Markdown).\n' +
    '- Keine neuen Fakten oder Zahlen hinzufügen.\n' +
    '- 2 bis 4 Abschnitte, klare Struktur.\n' +
    '- Ausgabe als JSON mit den Feldern: headline, subline, body_md.\n';

  const extra = customPrompt ? `\nZusatzvorgaben:\n${customPrompt}\n` : '';
  return { system, user: baseUser + extra };
}

function extractJson(text: string): Record<string, any> | null {
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

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    let raw: string | null = null;

    if (user?.id) {
      const partnerConfig = await loadPartnerLlmConfig(user.id);
      if (partnerConfig?.provider) {
        const apiKey = asString(partnerConfig.auth_config?.api_key);
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

        if (partnerConfig.provider === 'openai') {
          raw = await callOpenAICompatible({
            apiKey: apiKey ?? '',
            baseUrl,
            model,
            temperature,
            maxTokens,
            system: prompt.system,
            user: prompt.user,
          });
        }
      }
    }

    if (!raw && DEFAULT_PROVIDER === 'openai' && DEFAULT_API_KEY && DEFAULT_MODEL) {
      raw = await callOpenAICompatible({
        apiKey: DEFAULT_API_KEY,
        baseUrl: DEFAULT_BASE_URL || 'https://api.openai.com/v1',
        model: DEFAULT_MODEL,
        temperature: asNumber(DEFAULT_TEMPERATURE),
        maxTokens: asNumber(DEFAULT_MAX_TOKENS),
        system: prompt.system,
        user: prompt.user,
      });
    }

    const fallback = {
      headline: `Immobilienmarkt-Update ${areaName}`,
      subline: 'Ein kompakter Blick auf den aktuellen Marktüberblick.',
      body_md: `${source.individual01}\n\n${source.individual02}\n\n> ${source.zitat}`,
    };

    if (!raw) {
      return NextResponse.json(fallback);
    }

    const parsed = extractJson(raw) ?? fallback;
    return NextResponse.json({
      headline: String(parsed.headline || fallback.headline),
      subline: String(parsed.subline || fallback.subline),
      body_md: String(parsed.body_md || fallback.body_md),
    });
  } catch (error: any) {
    console.error('AI Blog Route Error:', error);
    return NextResponse.json({ error: 'Fehler in der KI-Schnittstelle' }, { status: 500 });
  }
}
