import type {
  CrmSyncMode,
  CrmSyncResource,
  PartnerIntegration,
  MappedOffer,
  RawListing,
  RawReference,
  RawRequest,
  ResourceSyncDiagnostics,
} from "@/lib/providers/types";
import { syncPropstackResources } from "@/lib/providers/propstack";
import { syncOnOfficeResources } from "@/lib/providers/onoffice";
import { validateOutboundUrl } from "@/lib/security/outbound-url";
import { readSecretFromAuthConfig } from "@/lib/security/secret-crypto";

export type IntegrationSyncResult = {
  offers: MappedOffer[];
  listings: RawListing[];
  references: RawReference[];
  requests: RawRequest[];
  referencesFetched: boolean;
  requestsFetched: boolean;
  notes?: string[];
  diagnostics?: ResourceSyncDiagnostics;
};

export type IntegrationSyncOptions = {
  resource?: CrmSyncResource;
  mode?: CrmSyncMode;
};

export async function syncIntegrationResources(
  integration: PartnerIntegration,
  options?: IntegrationSyncOptions,
): Promise<IntegrationSyncResult> {
  if (!integration.is_active || integration.kind !== "crm") {
    return {
      offers: [],
      listings: [],
      references: [],
      requests: [],
      referencesFetched: false,
      requestsFetched: false,
    };
  }

  const auth = (integration.auth_config ?? {}) as Record<string, unknown>;
  const apiKey =
    readSecretFromAuthConfig(auth, "api_key")
    ?? readSecretFromAuthConfig(auth, "token");

  if (!apiKey) {
    throw new Error(`API-Key fehlt für Provider ${integration.provider}`);
  }

  const baseUrl = String(integration.base_url ?? "").trim();
  if (!baseUrl) {
    throw new Error(`Base URL fehlt für Provider ${integration.provider}`);
  }
  const outboundCheck = await validateOutboundUrl(baseUrl);
  if (!outboundCheck.ok) {
    throw new Error(`Base URL blockiert (${outboundCheck.reason})`);
  }
  const sanitizedIntegration: PartnerIntegration = {
    ...integration,
    base_url: outboundCheck.url,
  };

  if (integration.provider === "propstack") {
    return syncPropstackResources(sanitizedIntegration, apiKey, options);
  }

  if (integration.provider === "onoffice") {
    const token = readSecretFromAuthConfig(auth, "token");
    const secret = readSecretFromAuthConfig(auth, "secret");

    if (!token || !secret) {
      throw new Error("onOffice token/secret fehlt");
    }

    return syncOnOfficeResources(sanitizedIntegration, token, secret);
  }

  throw new Error(`Provider nicht unterstützt: ${integration.provider}`);
}
