type PricingSourceSpec = {
  provider: string;
  sourceUrl: string;
  sourceKind: "provider_web";
};

export type ProviderPricingFetchResult =
  | {
      ok: true;
      provider: string;
      model: string;
      sourceUrl: string;
      sourceKind: "provider_web";
      inputCostEurPer1k: number;
      outputCostEurPer1k: number;
      parseConfidence: number;
      parseMessage: string;
      rawExcerpt: string;
    }
  | {
      ok: false;
      provider: string;
      model: string;
      sourceUrl: string | null;
      sourceKind: "provider_web";
      parseConfidence: number;
      parseMessage: string;
      rawExcerpt: string;
    };

const PRICING_SOURCES: Record<string, PricingSourceSpec> = {
  openai: {
    provider: "openai",
    sourceUrl: "https://openai.com/api/pricing/",
    sourceKind: "provider_web",
  },
  anthropic: {
    provider: "anthropic",
    sourceUrl: "https://docs.anthropic.com/en/docs/about-claude/pricing",
    sourceKind: "provider_web",
  },
  google_gemini: {
    provider: "google_gemini",
    sourceUrl: "https://ai.google.dev/pricing",
    sourceKind: "provider_web",
  },
  mistral: {
    provider: "mistral",
    sourceUrl: "https://docs.mistral.ai/getting-started/models/models_overview/",
    sourceKind: "provider_web",
  },
};

function toLowerClean(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function modelAliases(provider: string, model: string): string[] {
  const raw = String(model ?? "").trim();
  const cleaned = raw.replace(/[_]+/g, "-");
  const generic = [raw, cleaned, cleaned.replace(/[-_.]/g, " "), cleaned.replace(/\./g, ""), cleaned.toLowerCase()];
  const p = String(provider ?? "").trim().toLowerCase();

  if (p === "openai" && cleaned.startsWith("gpt-5.2-mini")) generic.push("gpt-5 mini");
  if (p === "openai" && cleaned.startsWith("gpt-5.2-nano")) generic.push("gpt-5 nano");
  if (p === "openai" && cleaned.startsWith("gpt-5.2")) generic.push("gpt-5");
  if (p === "anthropic" && cleaned.includes("opus")) generic.push("claude opus 4.1");
  if (p === "anthropic" && cleaned.includes("sonnet")) generic.push("claude sonnet 4");
  if (p === "google_gemini" && cleaned.includes("2.5-pro")) generic.push("gemini 2.5 pro");
  if (p === "google_gemini" && cleaned.includes("2.5-flash")) generic.push("gemini 2.5 flash");
  if (p === "mistral" && cleaned.includes("small")) generic.push("mistral small");
  if (p === "mistral" && cleaned.includes("large")) generic.push("mistral large");

  return Array.from(new Set(generic.map((v) => toLowerClean(v)).filter(Boolean)));
}

function stripHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unitDivisor(context: string): number {
  const c = toLowerClean(context);
  if (c.includes("/1k") || c.includes("per 1k") || c.includes("1k tokens")) return 1;
  if (c.includes("/1m") || c.includes("per 1m") || c.includes("1m tokens") || c.includes("million tokens")) return 1000;
  return 1000;
}

function extractDollarPairs(segment: string): Array<{ value: number; divisor: number; raw: string }> {
  const out: Array<{ value: number; divisor: number; raw: string }> = [];
  const rx = /\$ ?([0-9]+(?:\.[0-9]+)?)/g;
  let match: RegExpExecArray | null;
  while ((match = rx.exec(segment)) !== null) {
    const value = Number(match[1]);
    if (!Number.isFinite(value)) continue;
    const ctxStart = Math.max(0, match.index - 30);
    const ctxEnd = Math.min(segment.length, rx.lastIndex + 40);
    const ctx = segment.slice(ctxStart, ctxEnd);
    out.push({ value, divisor: unitDivisor(ctx), raw: ctx });
  }
  return out;
}

function findByAlias(pageText: string, aliases: string[]): ProviderPricingFetchResult | null {
  const lower = toLowerClean(pageText);
  for (const alias of aliases) {
    if (!alias) continue;
    const idx = lower.indexOf(alias);
    if (idx < 0) continue;
    const start = Math.max(0, idx - 260);
    const end = Math.min(lower.length, idx + 540);
    const snippet = lower.slice(start, end);
    const dollars = extractDollarPairs(snippet);
    if (dollars.length < 2) continue;
    const inCost = dollars[0].value / dollars[0].divisor;
    const outCost = dollars[1].value / dollars[1].divisor;
    if (!(inCost > 0 && outCost > 0)) continue;
    const confidence = Math.min(0.95, 0.6 + (dollars[0].divisor > 0 ? 0.1 : 0) + (dollars[1].divisor > 0 ? 0.1 : 0) + 0.1);
    return {
      ok: true,
      provider: "",
      model: "",
      sourceUrl: "",
      sourceKind: "provider_web",
      inputCostEurPer1k: Number(inCost.toFixed(6)),
      outputCostEurPer1k: Number(outCost.toFixed(6)),
      parseConfidence: confidence,
      parseMessage: "Preise aus Provider-Seite extrahiert.",
      rawExcerpt: snippet.slice(0, 500),
    };
  }
  return null;
}

export async function fetchProviderPricingFromWeb(
  provider: string,
  model: string,
  sourceUrlOverride?: string | null,
): Promise<ProviderPricingFetchResult> {
  const p = String(provider ?? "").trim().toLowerCase();
  const m = String(model ?? "").trim();
  const source = PRICING_SOURCES[p];
  const overrideUrl = String(sourceUrlOverride ?? "").trim();
  if (!source) {
    return {
      ok: false,
      provider: p,
      model: m,
      sourceUrl: null,
      sourceKind: "provider_web",
      parseConfidence: 0,
      parseMessage: "Kein Pricing-Crawler für diesen Provider konfiguriert.",
      rawExcerpt: "",
    };
  }

  try {
    const sourceUrl = overrideUrl || source.sourceUrl;
    const res = await fetch(sourceUrl, {
      method: "GET",
      headers: {
        "user-agent": "WC24-Pricing-Bot/1.0 (+admin sync)",
        accept: "text/html,application/xhtml+xml",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      return {
        ok: false,
        provider: p,
        model: m,
        sourceUrl,
        sourceKind: source.sourceKind,
        parseConfidence: 0.2,
        parseMessage: `Provider-Seite nicht erreichbar (HTTP ${res.status}).`,
        rawExcerpt: "",
      };
    }
    const html = await res.text();
    const text = stripHtml(html);
    const extracted = findByAlias(text, modelAliases(p, m));
    if (!extracted) {
      return {
        ok: false,
        provider: p,
        model: m,
        sourceUrl,
        sourceKind: source.sourceKind,
        parseConfidence: 0.35,
        parseMessage: "Preis konnte aus der Provider-Seite nicht zuverlässig extrahiert werden.",
        rawExcerpt: text.slice(0, 500),
      };
    }
    return {
      ...extracted,
      provider: p,
      model: m,
        sourceUrl,
      sourceKind: source.sourceKind,
    };
  } catch (error) {
    return {
      ok: false,
      provider: p,
      model: m,
      sourceUrl: overrideUrl || source.sourceUrl,
      sourceKind: source.sourceKind,
      parseConfidence: 0.1,
      parseMessage: `Crawler-Fehler: ${error instanceof Error ? error.message : "unknown"}`,
      rawExcerpt: "",
    };
  }
}
