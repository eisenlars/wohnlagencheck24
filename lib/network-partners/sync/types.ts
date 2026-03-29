export const NETWORK_PARTNER_INTEGRATION_KIND = "crm" as const;

export type NetworkPartnerIntegrationKind = typeof NETWORK_PARTNER_INTEGRATION_KIND;

export const NETWORK_PARTNER_CRM_PROVIDERS = ["propstack", "onoffice"] as const;

export type NetworkPartnerCrmProvider = (typeof NETWORK_PARTNER_CRM_PROVIDERS)[number];

export function isNetworkPartnerIntegrationKind(
  value: string | null | undefined,
): value is NetworkPartnerIntegrationKind {
  return String(value ?? "").trim().toLowerCase() === NETWORK_PARTNER_INTEGRATION_KIND;
}

export function isNetworkPartnerCrmProvider(
  value: string | null | undefined,
): value is NetworkPartnerCrmProvider {
  const normalized = String(value ?? "").trim().toLowerCase();
  return NETWORK_PARTNER_CRM_PROVIDERS.some((provider) => provider === normalized);
}
