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
import { syncOpenImmoResources } from "@/lib/providers/openimmo";
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
  if (integration.provider === "propstack") {
    const apiKey =
      readSecretFromAuthConfig(auth, "api_key")
      ?? readSecretFromAuthConfig(auth, "token");
    if (!apiKey) {
      throw new Error("API-Key fehlt für Provider propstack");
    }
    const baseUrl = String(integration.base_url ?? "").trim();
    if (!baseUrl) {
      throw new Error("Base URL fehlt für Provider propstack");
    }
    const outboundCheck = await validateOutboundUrl(baseUrl);
    if (!outboundCheck.ok) {
      throw new Error(`Base URL blockiert (${outboundCheck.reason})`);
    }
    const sanitizedIntegration: PartnerIntegration = {
      ...integration,
      base_url: outboundCheck.url,
    };
    return syncPropstackResources(sanitizedIntegration, apiKey, options);
  }

  if (integration.provider === "onoffice") {
    const baseUrl = String(integration.base_url ?? "").trim();
    if (!baseUrl) {
      throw new Error("Base URL fehlt für Provider onoffice");
    }
    const outboundCheck = await validateOutboundUrl(baseUrl);
    if (!outboundCheck.ok) {
      throw new Error(`Base URL blockiert (${outboundCheck.reason})`);
    }
    const sanitizedIntegration: PartnerIntegration = {
      ...integration,
      base_url: outboundCheck.url,
    };
    const token = readSecretFromAuthConfig(auth, "token");
    const secret = readSecretFromAuthConfig(auth, "secret");

    if (!token || !secret) {
      throw new Error("onOffice token/secret fehlt");
    }

    return syncOnOfficeResources(sanitizedIntegration, token, secret, options);
  }

  if (integration.provider === "openimmo") {
    const feedUrl =
      String(integration.base_url ?? "").trim()
      || String((integration.settings ?? {})["feed_url"] ?? "").trim();
    if (!feedUrl) {
      throw new Error("Feed-URL fehlt für Provider openimmo");
    }
    const outboundCheck = await validateOutboundUrl(feedUrl);
    if (!outboundCheck.ok) {
      throw new Error(`Feed-URL blockiert (${outboundCheck.reason})`);
    }
    const sanitizedIntegration: PartnerIntegration = {
      ...integration,
      base_url: outboundCheck.url,
    };
    return syncOpenImmoResources(sanitizedIntegration, options);
  }

  throw new Error(`Provider nicht unterstützt: ${integration.provider}`);
}
