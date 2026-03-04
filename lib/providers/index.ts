import type {
  PartnerIntegration,
  MappedOffer,
  RawListing,
  RawReference,
  RawRequest,
} from "@/lib/providers/types";
import { syncPropstackResources } from "@/lib/providers/propstack";
import { syncOnOfficeResources } from "@/lib/providers/onoffice";
import { validateOutboundUrl } from "@/lib/security/outbound-url";

export type IntegrationSyncResult = {
  offers: MappedOffer[];
  listings: RawListing[];
  references: RawReference[];
  requests: RawRequest[];
  referencesFetched: boolean;
  requestsFetched: boolean;
  notes?: string[];
};

export async function syncIntegrationResources(
  integration: PartnerIntegration,
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

  const auth = integration.auth_config ?? {};
  const apiKey =
    typeof auth["api_key"] === "string"
      ? auth["api_key"]
      : typeof auth["token"] === "string"
        ? auth["token"]
        : null;

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
    return syncPropstackResources(sanitizedIntegration, apiKey);
  }

  if (integration.provider === "onoffice") {
    const auth = integration.auth_config ?? {};
    const token =
      typeof auth["token"] === "string"
        ? auth["token"]
        : null;
    const secret =
      typeof auth["secret"] === "string"
        ? auth["secret"]
        : null;

    if (!token || !secret) {
      throw new Error("onOffice token/secret fehlt");
    }

    return syncOnOfficeResources(sanitizedIntegration, token, secret);
  }

  throw new Error(`Provider nicht unterstützt: ${integration.provider}`);
}
