import type {
  CrmSyncMode,
  CrmSyncResource,
  CrmSyncTrigger,
  JsonObject,
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
  triggeredBy?: CrmSyncTrigger;
};

type DebugPayloadResourceBlock = {
  source_records: JsonObject[];
  raw_rows: JsonObject[];
  canonical_rows: JsonObject[];
  fetched: boolean;
};

function asJsonObjectArray(rows: Array<Record<string, unknown>>): JsonObject[] {
  return rows.map((row) => row as JsonObject);
}

export function buildStructuredDebugPayload(
  integration: Pick<PartnerIntegration, "provider" | "partner_id" | "id">,
  resource: CrmSyncResource,
  mode: CrmSyncMode,
  generatedAt: string,
  result: IntegrationSyncResult,
  extra?: {
    trace_id?: string;
  },
): JsonObject {
  const offerSourceRecords = result.offers.map((offer) => offer.source_payload);
  const offerCanonicalRows = result.offers.map((offer) => ({
    partner_id: offer.partner_id,
    source: offer.source,
    external_id: offer.external_id,
    offer_type: offer.offer_type,
    object_type: offer.object_type,
    title: offer.title,
    price: offer.price,
    rent: offer.rent,
    area_sqm: offer.area_sqm,
    rooms: offer.rooms,
    address: offer.address,
    image_url: offer.image_url,
    detail_url: offer.detail_url,
    is_top: offer.is_top,
    updated_at: offer.updated_at,
    raw: offer.raw,
  }));
  const referenceSourceRecords = result.references.map((reference) => reference.source_payload);
  const requestSourceRecords = result.requests.map((request) => request.source_payload);

  return {
    provider: integration.provider,
    partner_id: integration.partner_id,
    integration_id: integration.id,
    resource,
    mode,
    trace_id: extra?.trace_id ?? null,
    generated_at: generatedAt,
    resources: {
      offers: {
        source_records: asJsonObjectArray(offerSourceRecords),
        raw_rows: asJsonObjectArray(result.listings),
        canonical_rows: asJsonObjectArray(offerCanonicalRows),
        fetched: true,
      } satisfies DebugPayloadResourceBlock,
      references: {
        source_records: asJsonObjectArray(referenceSourceRecords),
        raw_rows: asJsonObjectArray(result.references),
        canonical_rows: asJsonObjectArray(result.references),
        fetched: result.referencesFetched,
      } satisfies DebugPayloadResourceBlock,
      requests: {
        source_records: asJsonObjectArray(requestSourceRecords),
        raw_rows: asJsonObjectArray(result.requests),
        canonical_rows: asJsonObjectArray(result.requests),
        fetched: result.requestsFetched,
      } satisfies DebugPayloadResourceBlock,
    },
    offers: result.offers,
    listings: result.listings,
    references: result.references,
    requests: result.requests,
    references_fetched: result.referencesFetched,
    requests_fetched: result.requestsFetched,
    diagnostics: result.diagnostics ?? null,
    notes: result.notes ?? [],
  };
}

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
