import { buildKreisSectionSignatures, buildOrtslageSectionSignatures, generateKreisPriceTexts, generateOrtslagePriceTexts } from "@/lib/text-core";
import { createSeededRng } from "@/lib/text-core/core";

type AnyRecord = Record<string, unknown>;

export function applyDataDrivenTexts<T extends AnyRecord>(report: T, areaId?: string): T {
  if (!report || typeof report !== "object") return report;
  const data = (report.data ?? {}) as AnyRecord;
  const textgenInputs = data.textgen_inputs as AnyRecord | undefined;
  if (!textgenInputs || typeof textgenInputs !== "object") return report;

  const scope = textgenInputs.ortslage ? "ortslage" : textgenInputs.kreis ? "kreis" : null;
  if (!scope) return report;

  const inputs = textgenInputs[scope] as AnyRecord | undefined;
  if (!inputs || typeof inputs !== "object") return report;

  const baseText = (report.text ?? data.text ?? {}) as AnyRecord;
  const signatures =
    scope === "ortslage"
      ? buildOrtslageSectionSignatures(inputs)
      : buildKreisSectionSignatures(inputs);

  const rngByKey = (key: string) =>
    createSeededRng(`${areaId ?? "unknown"}|${scope}|${key}|${signatures[key] ?? ""}`);

  const updatedText =
    scope === "ortslage"
      ? generateOrtslagePriceTexts(baseText, inputs, undefined, rngByKey)
      : generateKreisPriceTexts(baseText, inputs, undefined, rngByKey);

  return {
    ...report,
    text: updatedText,
    data: {
      ...data,
      text: updatedText,
    },
  } as T;
}
