// app/api/ai-rewrite/route.ts


import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';
import { checkRateLimitPersistent, extractClientIpFromHeaders } from '@/lib/security/rate-limit';

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
  temperature: number | null;
  maxTokens: number | null;
  system: string;
  user: string;
}): Promise<string | null> {
  if (!apiKey || !model) return null;
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
  const messages = [];
  if (system.trim().length > 0) {
    messages.push({ role: 'system', content: system });
  }
  messages.push({ role: 'user', content: user });
  const payload: Record<string, unknown> = {
    model,
    messages,
  };
  if (temperature !== null) payload.temperature = temperature;
  if (maxTokens !== null) payload.max_tokens = maxTokens;

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

    const custom = asString(customPrompt);
    const basePrompt = buildPrompt({ text, areaName, type, sectionLabel });
    const prompt = custom
      ? {
          system: basePrompt.system,
          user: `${basePrompt.user}\n\nZusaetzliche Nutzeranweisung:\n${custom}`,
        }
      : basePrompt;

    let optimizedText: string | null = null;

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
        optimizedText = await callOpenAICompatible({
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

    // Nur authentifizierte Partner duerfen auf den systemweiten Fallback zugreifen.
    if (!optimizedText && DEFAULT_PROVIDER === 'openai' && DEFAULT_API_KEY && DEFAULT_MODEL) {
      optimizedText = await callOpenAICompatible({
        apiKey: DEFAULT_API_KEY,
        baseUrl: DEFAULT_BASE_URL || 'https://api.openai.com/v1',
        model: DEFAULT_MODEL,
        temperature: asNumber(DEFAULT_TEMPERATURE),
        maxTokens: asNumber(DEFAULT_MAX_TOKENS),
        system: prompt.system,
        user: prompt.user,
      });
    }

    if (!optimizedText) {
      // Fallback (wie bisher)
      await new Promise((resolve) => setTimeout(resolve, 600));
      optimizedText = `[KI-FALLBACK]\nOptimierte Fassung für ${areaName}: ${text}`;
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
