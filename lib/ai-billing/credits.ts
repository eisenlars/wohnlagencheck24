import type { AiBillingContext, AiUsageFeature } from "@/lib/ai-billing/types";

export const CREDITS_PER_EUR = 100;
export const CREDIT_CURRENCY = "EUR";

function roundCreditValue(value: number): number {
  return Number(value.toFixed(4));
}

export function eurToCredits(eur: number | null): number | null {
  if (eur === null || !Number.isFinite(eur)) return null;
  return roundCreditValue(eur * CREDITS_PER_EUR);
}

export function creditsToEur(credits: number | null): number | null {
  if (credits === null || !Number.isFinite(credits)) return null;
  return roundCreditValue(credits / CREDITS_PER_EUR);
}

export function buildPortalPartnerIncludedBillingContext(
  partnerId: string,
  feature: AiUsageFeature,
): AiBillingContext {
  return {
    billing_scope: "portal_partner",
    billing_mode: "included",
    billing_owner_partner_id: partnerId,
    billing_subject_partner_id: partnerId,
    network_partner_id: null,
    feature,
  };
}
