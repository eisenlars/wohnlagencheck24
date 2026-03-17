import type {
  LeadAreaOption,
  LeadGeneratorAudience,
  LeadGeneratorPlacementKey,
  LeadGeneratorScopeMode,
  ResolvedLeadGeneratorConfig,
} from "./types";
import { normalizeLeadGeneratorLocale } from "./types";

type ResolveLeadGeneratorArgs = {
  generatorType: ResolvedLeadGeneratorConfig["generatorType"];
  flowKey: string;
  variantKey?: string;
  locale?: string | null;
  audience?: LeadGeneratorAudience;
  placementKey: LeadGeneratorPlacementKey;
  routeLevel: "deutschland" | "bundesland" | "kreis" | "ort";
  sourceAreaId: string | null;
  partnerId: string | null;
  regionLabel: string;
  leadRecipientLabel: string;
  allowPartnerWideAreaSelection?: boolean;
  partnerAreaOptions?: LeadAreaOption[];
  canSubmit?: boolean;
};

export function resolveLeadGeneratorConfig(
  args: ResolveLeadGeneratorArgs,
): ResolvedLeadGeneratorConfig | null {
  if (args.routeLevel !== "kreis" && args.routeLevel !== "ort") {
    return null;
  }

  const sourceAreaId = String(args.sourceAreaId ?? "").trim();
  const partnerId = String(args.partnerId ?? "").trim();
  if (!sourceAreaId || !partnerId) {
    return null;
  }

  const normalizedLocale = normalizeLeadGeneratorLocale(args.locale);
  const partnerAreaOptions = Array.isArray(args.partnerAreaOptions)
    ? args.partnerAreaOptions.filter((entry) => entry.areaId.trim().length > 0 && entry.label.trim().length > 0)
    : [];

  const allowPartnerWideAreaSelection = Boolean(args.allowPartnerWideAreaSelection) && partnerAreaOptions.length > 1;
  const scopeMode: LeadGeneratorScopeMode = allowPartnerWideAreaSelection
    ? "partner_areas_only"
    : "current_area_only";

  const allowedAreaOptions =
    scopeMode === "partner_areas_only"
      ? partnerAreaOptions
      : [{ areaId: sourceAreaId, label: args.regionLabel }];

  return {
    generatorType: args.generatorType,
    flowKey: args.flowKey,
    variantKey: String(args.variantKey ?? "default"),
    locale: normalizedLocale,
    audience: args.audience ?? "public",
    placementKey: args.placementKey,
    scopeMode,
    sourceAreaId,
    partnerId,
    leadRecipientLabel: args.leadRecipientLabel,
    regionLabel: args.regionLabel,
    allowedAreaOptions,
    canSubmit: args.canSubmit ?? true,
  };
}
