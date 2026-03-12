import { normalizeLlmRuntimeMode, type LlmRuntimeMode } from "@/lib/llm/mode";

type QueryResult = {
  data?: Record<string, unknown> | null;
  error?: { message?: string } | null;
};

export type PartnerLlmPolicy = {
  llm_partner_managed_allowed: boolean;
  llm_mode_default: LlmRuntimeMode;
  source: "db" | "fallback";
};

function normBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  return fallback;
}

function isMissingPartnerLlmPolicyColumns(error: unknown): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  if (!msg.includes("does not exist")) return false;
  return (
    msg.includes("partners.llm_partner_managed_allowed")
    || msg.includes("partners.llm_mode_default")
  );
}

export async function loadPartnerLlmPolicy(
  admin: any,
  partnerId: string,
): Promise<PartnerLlmPolicy> {
  const policySelect = [
    "llm_partner_managed_allowed",
    "llm_mode_default",
  ].join(", ");

  const primary = await admin
    .from("partners")
    .select(policySelect)
    .eq("id", partnerId)
    .maybeSingle();

  if (!primary.error && primary.data) {
    const partnerManaged = normBool(primary.data.llm_partner_managed_allowed, false);
    const defaultMode = normalizeLlmRuntimeMode(primary.data.llm_mode_default);
    return {
      llm_partner_managed_allowed: partnerManaged,
      llm_mode_default: defaultMode,
      source: "db",
    };
  }

  if (primary.error && isMissingPartnerLlmPolicyColumns(primary.error)) {
    // Legacy fallback for environments without migrated partner policy columns.
    return {
      llm_partner_managed_allowed: false,
      llm_mode_default: "central_managed",
      source: "fallback",
    };
  }

  if (primary.error) {
    throw new Error(String(primary.error.message ?? "Partner LLM policy lookup failed"));
  }

  return {
    llm_partner_managed_allowed: false,
    llm_mode_default: "central_managed",
    source: "db",
  };
}
