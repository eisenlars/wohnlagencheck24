import { buildKreisSectionSignatures, buildOrtslageSectionSignatures, generateKreisPriceTexts, generateOrtslagePriceTexts } from "@/lib/text-core";
import { createSeededRng } from "@/lib/text-core/core";

type AnyRecord = Record<string, unknown>;

type OrtslageNameMap = Record<string, string>;

function mapOrtslageName(value: unknown, nameMap?: OrtslageNameMap): string {
  const raw = String(value ?? "").trim();
  if (!raw) return raw;
  if (!nameMap) return raw;
  const direct = nameMap[raw];
  if (direct) return direct;
  const normalized = raw.replace(/^ortslage_/, "");
  return nameMap[normalized] ?? raw;
}

function applyOrtslageNameMapping<T extends AnyRecord>(report: T, nameMap?: OrtslageNameMap): T {
  if (!nameMap || !Object.keys(nameMap).length) return report;
  if (!report || typeof report !== "object") return report;
  const data = (report as AnyRecord).data as AnyRecord | undefined;
  if (!data || typeof data !== "object") return report;

  const textgen = (data.textgen_inputs ?? {}) as AnyRecord;
  const kreisInputs = textgen.kreis as AnyRecord | undefined;
  const ortslagenValues = (kreisInputs?.ortslagenValues_dict ?? {}) as AnyRecord;
  if (kreisInputs && typeof kreisInputs === "object" && ortslagenValues && typeof ortslagenValues === "object") {
    const mapped = { ...ortslagenValues };
    const keys = [
      "guenstigster_immobilienpreis_ortslage",
      "teuerster_immobilienpreis_ortslage",
      "guenstigster_grundstueckspreis_ortslage",
      "teuerster_grundstueckspreis_ortslage",
      "guenstigster_mietpreis_ortslage",
      "teuerster_mietpreis_ortslage",
    ];
    for (const key of keys) {
      if (key in mapped) {
        mapped[key] = mapOrtslageName(mapped[key], nameMap);
      }
    }
    textgen.kreis = {
      ...kreisInputs,
      ortslagenValues_dict: mapped,
    };
  }

  const mapPreisgrenzen = (key: string, nameKey: string) => {
    const list = data[key];
    if (!Array.isArray(list) || !list.length) return;
    const first = list[0];
    if (!first || typeof first !== "object") return;
    const updated = {
      ...first,
      [nameKey]: mapOrtslageName((first as AnyRecord)[nameKey], nameMap),
    };
    data[key] = [updated];
  };

  mapPreisgrenzen("ortslagen_preisgrenzen_immobilie", "guenstigste_ortslage_immobilie");
  mapPreisgrenzen("ortslagen_preisgrenzen_immobilie", "teuerste_ortslage_immobilie");
  mapPreisgrenzen("ortslagen_preisgrenzen_grundstueck", "guenstigste_ortslage_grundstueck");
  mapPreisgrenzen("ortslagen_preisgrenzen_grundstueck", "teuerste_ortslage_grundstueck");
  mapPreisgrenzen("ortslagen_preisgrenzen_miete", "guenstigste_ortslage_miete");
  mapPreisgrenzen("ortslagen_preisgrenzen_miete", "teuerste_ortslage_miete");

  return {
    ...(report as AnyRecord),
    data: {
      ...data,
      textgen_inputs: textgen,
    },
  } as T;
}

export function applyDataDrivenTexts<T extends AnyRecord>(report: T, areaId?: string, ortslageNameMap?: OrtslageNameMap): T {
  if (!report || typeof report !== "object") return report;
  const mappedReport = applyOrtslageNameMapping(report, ortslageNameMap);
  if (!mappedReport || typeof mappedReport !== "object") return mappedReport;
  const data = (mappedReport as AnyRecord).data as AnyRecord | undefined;
  if (!data || typeof data !== "object") return mappedReport;
  const textgenInputs = data.textgen_inputs as AnyRecord | undefined;
  if (!textgenInputs || typeof textgenInputs !== "object") return mappedReport;

  const scope = textgenInputs.ortslage ? "ortslage" : textgenInputs.kreis ? "kreis" : null;
  if (!scope) return mappedReport;

  const inputs = textgenInputs[scope] as AnyRecord | undefined;
  if (!inputs || typeof inputs !== "object") return mappedReport;

  const baseText = ((mappedReport as AnyRecord).text ?? data.text ?? {}) as AnyRecord;
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
    ...(mappedReport as AnyRecord),
    text: updatedText,
    data: {
      ...data,
      text: updatedText,
    },
  } as T;
}
