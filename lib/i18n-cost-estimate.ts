export type I18nEstimatePricing = {
  provider: string | null;
  model: string | null;
  input_cost_usd_per_1k: number | null;
  output_cost_usd_per_1k: number | null;
  fx_rate_usd_to_eur: number | null;
};

export type I18nEstimateTotals = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number | null;
  estimated_cost_eur: number | null;
};

function round6(value: number): number {
  return Number(value.toFixed(6));
}

export function estimateTokensFromText(text: string): {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
} {
  const source = String(text ?? "").trim();
  if (!source) {
    return {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    };
  }

  const chars = source.length;
  const words = source.split(/\s+/).filter(Boolean).length;

  // Conservative translation heuristic: prompt carries source text and system framing,
  // completion is typically slightly shorter or similar in size to the source.
  const promptTokens = Math.max(16, Math.ceil(chars / 4) + Math.ceil(words / 6));
  const completionTokens = Math.max(12, Math.ceil(chars / 4.5) + Math.ceil(words / 7));

  return {
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: promptTokens + completionTokens,
  };
}

export function estimateTranslationTotals(
  texts: string[],
  pricing: I18nEstimatePricing | null,
): I18nEstimateTotals {
  const totals = texts.reduce(
    (acc, text) => {
      const estimate = estimateTokensFromText(text);
      acc.prompt_tokens += estimate.prompt_tokens;
      acc.completion_tokens += estimate.completion_tokens;
      acc.total_tokens += estimate.total_tokens;
      return acc;
    },
    {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    },
  );

  if (!pricing || pricing.input_cost_usd_per_1k === null || pricing.output_cost_usd_per_1k === null) {
    return {
      ...totals,
      estimated_cost_usd: null,
      estimated_cost_eur: null,
    };
  }

  const estimatedUsd = round6(
    (totals.prompt_tokens / 1000) * pricing.input_cost_usd_per_1k
    + (totals.completion_tokens / 1000) * pricing.output_cost_usd_per_1k,
  );

  const estimatedEur = pricing.fx_rate_usd_to_eur && pricing.fx_rate_usd_to_eur > 0
    ? round6(estimatedUsd * pricing.fx_rate_usd_to_eur)
    : null;

  return {
    ...totals,
    estimated_cost_usd: estimatedUsd,
    estimated_cost_eur: estimatedEur,
  };
}
