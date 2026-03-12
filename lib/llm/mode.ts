export type LlmRuntimeMode = "central_managed" | "partner_managed";

export function normalizeLlmRuntimeMode(value: unknown): LlmRuntimeMode {
  const v = String(value ?? "").trim().toLowerCase();
  if (v === "central_managed" || v === "partner_managed") {
    return v;
  }
  return "partner_managed";
}
