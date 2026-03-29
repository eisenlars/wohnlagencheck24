import {
  getPartnerAICreditLedger,
  recordPartnerAIUsageEvent,
} from "@/lib/network-partners/repositories/ai-credits";
import type {
  AIBillingMode,
  PartnerAIBudgetCheckResult,
  PartnerAICostEstimate,
  PartnerAICostEstimateInput,
  PartnerAIUsageEventCreateInput,
  PartnerAIUsageEventRecord,
} from "@/lib/network-partners/types";

const DEFAULT_PRICING_BY_FEATURE: Record<
  PartnerAICostEstimateInput["feature"],
  { prompt_price_per_1k_eur: number; completion_price_per_1k_eur: number }
> = {
  content_optimize: { prompt_price_per_1k_eur: 0.002, completion_price_per_1k_eur: 0.008 },
  content_translate: { prompt_price_per_1k_eur: 0.0015, completion_price_per_1k_eur: 0.006 },
  seo_meta_generate: { prompt_price_per_1k_eur: 0.001, completion_price_per_1k_eur: 0.004 },
};

function padMonth(value: number): string {
  return String(value).padStart(2, "0");
}

export function buildAICreditPeriodKey(date: Date): string {
  return `${date.getUTCFullYear()}-${padMonth(date.getUTCMonth() + 1)}`;
}

export function estimateAICost(input: PartnerAICostEstimateInput): PartnerAICostEstimate {
  const defaults = DEFAULT_PRICING_BY_FEATURE[input.feature];
  const promptPrice = input.prompt_price_per_1k_eur ?? defaults.prompt_price_per_1k_eur;
  const completionPrice = input.completion_price_per_1k_eur ?? defaults.completion_price_per_1k_eur;
  const promptTokens = Math.max(0, Math.floor(input.prompt_tokens));
  const completionTokens = Math.max(0, Math.floor(input.completion_tokens));

  const estimatedCost = Number(
    (
      (promptTokens / 1000) * promptPrice
      + (completionTokens / 1000) * completionPrice
    ).toFixed(4),
  );

  return {
    feature: input.feature,
    model: input.model ?? null,
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    prompt_price_per_1k_eur: promptPrice,
    completion_price_per_1k_eur: completionPrice,
    estimated_cost_eur: estimatedCost,
  };
}

export async function assertAIBudgetBeforeRun(input: {
  partnerId: string;
  periodKey?: string;
  billingMode: AIBillingMode;
  estimatedCostEur: number;
  lowBalanceThresholdEur?: number;
}): Promise<PartnerAIBudgetCheckResult> {
  const periodKey = input.periodKey ?? buildAICreditPeriodKey(new Date());
  const estimatedCost = Number(Math.max(0, input.estimatedCostEur).toFixed(4));

  if (input.billingMode === "blocked") {
    return {
      ok: false,
      warning: true,
      reason: "blocked",
      billing_mode: input.billingMode,
      period_key: periodKey,
      estimated_cost_eur: estimatedCost,
      available_credit_eur: null,
      remaining_after_run_eur: null,
    };
  }

  if (input.billingMode === "included") {
    return {
      ok: true,
      warning: false,
      reason: "ok",
      billing_mode: input.billingMode,
      period_key: periodKey,
      estimated_cost_eur: estimatedCost,
      available_credit_eur: null,
      remaining_after_run_eur: null,
    };
  }

  const ledger = await getPartnerAICreditLedger(input.partnerId, periodKey);
  if (!ledger) {
    return {
      ok: false,
      warning: true,
      reason: "missing_ledger",
      billing_mode: input.billingMode,
      period_key: periodKey,
      estimated_cost_eur: estimatedCost,
      available_credit_eur: null,
      remaining_after_run_eur: null,
    };
  }

  const availableCredit = Number(ledger.closing_balance_eur.toFixed(4));
  const remaining = Number((availableCredit - estimatedCost).toFixed(4));
  if (remaining < 0) {
    return {
      ok: false,
      warning: true,
      reason: "exceeds_budget",
      billing_mode: input.billingMode,
      period_key: periodKey,
      estimated_cost_eur: estimatedCost,
      available_credit_eur: availableCredit,
      remaining_after_run_eur: remaining,
    };
  }

  const lowBalanceThreshold = Number((input.lowBalanceThresholdEur ?? 10).toFixed(4));
  return {
    ok: true,
    warning: remaining <= lowBalanceThreshold,
    reason: remaining <= lowBalanceThreshold ? "low_balance" : "ok",
    billing_mode: input.billingMode,
    period_key: periodKey,
    estimated_cost_eur: estimatedCost,
    available_credit_eur: availableCredit,
    remaining_after_run_eur: remaining,
  };
}

export async function recordGovernedPartnerAIUsageEvent(input: {
  event: PartnerAIUsageEventCreateInput;
}): Promise<PartnerAIUsageEventRecord> {
  return recordPartnerAIUsageEvent({
    ...input.event,
    estimated_cost_eur: Number(input.event.estimated_cost_eur.toFixed(4)),
    credit_delta_eur: Number(input.event.credit_delta_eur.toFixed(4)),
  });
}
