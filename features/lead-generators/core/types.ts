import { normalizePublicLocale } from "@/lib/public-locale-routing";

export type LeadGeneratorType =
  | "immobilienbewertung"
  | "suchauftrag"
  | "objekt_inserieren"
  | "finanzierung";

export type LeadGeneratorScopeMode =
  | "current_area_only"
  | "partner_areas_only"
  | "global";

export type LeadGeneratorAudience = "public" | "preview";

export type LeadGeneratorPlacementKey = "immobilienmarkt_page_inline";

export type LeadAreaOption = {
  areaId: string;
  label: string;
};

export type ResolvedLeadGeneratorConfig = {
  generatorType: LeadGeneratorType;
  flowKey: string;
  variantKey: string;
  locale: string;
  audience: LeadGeneratorAudience;
  placementKey: LeadGeneratorPlacementKey;
  scopeMode: LeadGeneratorScopeMode;
  sourceAreaId: string;
  partnerId: string;
  leadRecipientLabel: string;
  regionLabel: string;
  allowedAreaOptions: LeadAreaOption[];
  canSubmit: boolean;
};

export type LeadGeneratorContact = {
  name: string;
  email: string;
  phone?: string | null;
};

export type LeadGeneratorSubmissionPayload = {
  generatorType: LeadGeneratorType;
  flowKey: string;
  variantKey: string;
  locale: string;
  audience: LeadGeneratorAudience;
  placementKey: LeadGeneratorPlacementKey;
  scopeMode: LeadGeneratorScopeMode;
  sourceAreaId: string;
  targetAreaId: string;
  partnerId: string;
  pagePath: string;
  regionLabel: string;
  leadRecipientLabel: string;
  contact: LeadGeneratorContact;
  answers: Record<string, unknown>;
  derivedData?: Record<string, unknown> | null;
};

export function normalizeLeadGeneratorLocale(value: unknown): string {
  return normalizePublicLocale(value);
}
