import { NextResponse } from "next/server";

import { assertAIBudgetBeforeRun, estimateAICost } from "@/lib/network-partners/ai-governance";
import { requireNetworkPartnerActorContext } from "@/lib/network-partners/auth";
import { requirePortalPartnerRole } from "@/lib/network-partners/roles";
import type { AIBillingMode, PartnerAIUsageFeature } from "@/lib/network-partners/types";

type EstimateBody = {
  feature?: PartnerAIUsageFeature;
  model?: string | null;
  prompt_tokens?: number;
  completion_tokens?: number;
  billing_mode?: AIBillingMode;
  period_key?: string;
  prompt_price_per_1k_eur?: number;
  completion_price_per_1k_eur?: number;
  low_balance_threshold_eur?: number;
};

function asFeature(value: unknown): PartnerAIUsageFeature | null {
  const normalized = String(value ?? "").trim();
  if (
    normalized === "content_optimize"
    || normalized === "content_translate"
    || normalized === "seo_meta_generate"
  ) {
    return normalized;
  }
  return null;
}

function asAIBillingMode(value: unknown): AIBillingMode | null {
  const normalized = String(value ?? "").trim();
  if (normalized === "included" || normalized === "credit_based" || normalized === "blocked") {
    return normalized;
  }
  return null;
}

function asNumber(value: unknown): number | null {
  const numeric =
    typeof value === "number" ? value
      : typeof value === "string" && value.trim().length > 0 ? Number(value)
        : NaN;
  if (!Number.isFinite(numeric)) return null;
  return numeric;
}

function mapAIError(error: Error) {
  if (error.message === "UNAUTHORIZED") return { status: 401, error: "Unauthorized" };
  if (error.message === "FORBIDDEN") return { status: 403, error: "Forbidden" };
  if (error.message === "INVALID_AI_PERIOD_KEY") {
    return { status: 400, error: "Ungueltiger Periodenschluessel. Erwartet wird YYYY-MM." };
  }
  return { status: 500, error: error.message || "Unexpected error" };
}

export async function POST(request: Request) {
  try {
    const actor = requirePortalPartnerRole(
      await requireNetworkPartnerActorContext(),
      ["partner_owner", "partner_manager", "partner_billing"],
    );

    const body = (await request.json().catch(() => null)) as EstimateBody | null;
    const feature = asFeature(body?.feature);
    const promptTokens = asNumber(body?.prompt_tokens);
    const completionTokens = asNumber(body?.completion_tokens);
    const billingMode = body?.billing_mode !== undefined ? asAIBillingMode(body.billing_mode) : "included";

    if (!feature) {
      return NextResponse.json({ error: "Invalid feature" }, { status: 400 });
    }
    if (promptTokens === null || promptTokens < 0) {
      return NextResponse.json({ error: "prompt_tokens must be >= 0" }, { status: 400 });
    }
    if (completionTokens === null || completionTokens < 0) {
      return NextResponse.json({ error: "completion_tokens must be >= 0" }, { status: 400 });
    }
    if (!billingMode) {
      return NextResponse.json({ error: "Invalid billing_mode" }, { status: 400 });
    }

    const estimate = estimateAICost({
      feature,
      model: body?.model ?? null,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      prompt_price_per_1k_eur: body?.prompt_price_per_1k_eur,
      completion_price_per_1k_eur: body?.completion_price_per_1k_eur,
    });

    const budgetCheck = await assertAIBudgetBeforeRun({
      partnerId: actor.partnerId,
      periodKey: typeof body?.period_key === "string" ? body.period_key : undefined,
      billingMode,
      estimatedCostEur: estimate.estimated_cost_eur,
      lowBalanceThresholdEur: body?.low_balance_threshold_eur,
    });

    return NextResponse.json({
      ok: true,
      estimate,
      budget_check: budgetCheck,
    });
  } catch (error) {
    const mapped = mapAIError(error as Error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
