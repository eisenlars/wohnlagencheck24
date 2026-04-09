import { createAdminClient } from "@/utils/supabase/admin";
import { syncIntegrationResources } from "@/lib/providers";
import type { PartnerIntegration } from "@/lib/providers/types";
import { getIntegrationByIdForNetworkPartner } from "@/lib/network-partners/repositories/integrations";
import type {
  NetworkPartnerPreviewSyncItem,
  NetworkPartnerPreviewSyncMode,
  NetworkPartnerPreviewSyncResource,
  NetworkPartnerPreviewSyncResult,
} from "@/lib/network-partners/types";
import type { NetworkPartnerPreviewBookingScope } from "@/lib/network-partners/sync/resolve-area";
import {
  mapOfferListingToPreviewItem,
  mapReferenceRowToPreviewItem,
  mapRequestRowToPreviewItem,
} from "@/lib/network-partners/sync/map-provider-records";

function asText(value: unknown): string | null {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function withScopedPreviewPayload(
  settings: Record<string, unknown>,
  resource: NetworkPartnerPreviewSyncResource,
  payload: Record<string, unknown>,
) {
  if (resource === "all") return settings;
  const scopedRoot = isRecord(settings.preview_resources) ? settings.preview_resources : {};
  const scopedEntry = isRecord(scopedRoot[resource]) ? scopedRoot[resource] : {};
  return {
    ...settings,
    preview_resources: {
      ...scopedRoot,
      [resource]: {
        ...scopedEntry,
        last_preview_payload: payload,
      },
    },
  };
}

function normalizePreviewResource(value: unknown): NetworkPartnerPreviewSyncResource {
  const resource = String(value ?? "").trim().toLowerCase();
  if (resource === "offers" || resource === "requests") return resource;
  return "all";
}

function normalizePreviewMode(value: unknown): NetworkPartnerPreviewSyncMode {
  return String(value ?? "").trim().toLowerCase() === "full" ? "full" : "guarded";
}

function mapPreviewCounts(items: NetworkPartnerPreviewSyncItem[]) {
  return {
    total: items.length,
    exact_match: items.filter((item) => item.status === "exact_match").length,
    kreis_match: items.filter((item) => item.status === "kreis_match").length,
    unresolved_area: items.filter((item) => item.status === "unresolved_area").length,
    not_booked: items.filter((item) => item.status === "not_booked").length,
    unsupported_type: items.filter((item) => item.status === "unsupported_type").length,
    invalid_record: items.filter((item) => item.status === "invalid_record").length,
  };
}

export type NetworkPartnerPreviewSyncSnapshot = {
  integration_id: string;
  network_partner_id: string;
  provider: string;
  resource: NetworkPartnerPreviewSyncResource;
  mode: NetworkPartnerPreviewSyncMode;
  booking_scope_count: number;
  booking_scopes: NetworkPartnerPreviewBookingScope[];
  counts: ReturnType<typeof mapPreviewCounts>;
  items: NetworkPartnerPreviewSyncItem[];
  notes: string[];
  diagnostics: {
    provider_request_count: number | null;
    provider_pages_fetched: number | null;
    references_fetched: boolean;
    requests_fetched: boolean;
  };
};

export async function loadBookingScopesForNetworkPartner(
  networkPartnerId: string,
): Promise<NetworkPartnerPreviewBookingScope[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("network_partner_bookings")
    .select(`
      id,
      portal_partner_id,
      area_id,
      placement_code,
      status,
      areas (
        id,
        name,
        slug,
        parent_slug,
        bundesland_slug
      )
    `)
    .eq("network_partner_id", networkPartnerId)
    .in("status", ["active", "pending_review", "draft", "paused"]);

  if (error) throw new Error(error.message ?? "BOOKING_SCOPE_LOOKUP_FAILED");

  const rows = Array.isArray(data) ? data : [];
  return rows
    .map((row) => {
      const record = row as Record<string, unknown>;
      const area = isRecord(record.areas) ? record.areas : null;
      const bookingId = asText(record.id);
      const portalPartnerId = asText(record.portal_partner_id);
      const areaId = asText(record.area_id);
      const placementCode = asText(record.placement_code);
      if (!bookingId || !portalPartnerId || !areaId || !placementCode) return null;

      return {
        booking_id: bookingId,
        portal_partner_id: portalPartnerId,
        area_id: areaId,
        placement_code: placementCode as NetworkPartnerPreviewBookingScope["placement_code"],
        area_name: asText(area?.name),
        area_slug: asText(area?.slug),
        parent_slug: asText(area?.parent_slug),
        bundesland_slug: asText(area?.bundesland_slug),
      };
    })
    .filter((row): row is NetworkPartnerPreviewBookingScope => Boolean(row));
}

export function toProviderIntegration(input: {
  integrationId: string;
  networkPartnerId: string;
  integration: Awaited<ReturnType<typeof getIntegrationByIdForNetworkPartner>>;
}): PartnerIntegration {
  const integration = input.integration;
  if (!integration) {
    throw new Error("NOT_FOUND");
  }

  return {
    id: integration.id,
    partner_id: input.networkPartnerId,
    kind: "crm",
    provider: integration.provider as PartnerIntegration["provider"],
    base_url: integration.base_url,
    auth_type: integration.auth_type,
    auth_config: integration.auth_config,
    detail_url_template: integration.detail_url_template,
    is_active: integration.is_active,
    settings: integration.settings,
  };
}

export async function persistPreviewTimestamp(
  integrationId: string,
  networkPartnerId: string,
  resource: NetworkPartnerPreviewSyncResource,
  summary: Record<string, unknown>,
  payload: Record<string, unknown>,
) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("network_partner_integrations")
    .select("settings")
    .eq("id", integrationId)
    .eq("network_partner_id", networkPartnerId)
    .maybeSingle();

  const prevSettings = isRecord(data) && isRecord(data.settings) ? data.settings : {};
  const nextSettings = withScopedPreviewPayload(
    {
      ...prevSettings,
      last_preview_sync_summary: summary,
      last_preview_payload: payload,
    },
    resource,
    payload,
  );
  await admin
    .from("network_partner_integrations")
    .update({
      last_preview_sync_at: new Date().toISOString(),
      settings: nextSettings,
    })
    .eq("id", integrationId)
    .eq("network_partner_id", networkPartnerId);
}

export async function buildNetworkPartnerPreviewSyncSnapshot(input: {
  integrationId: string;
  networkPartnerId: string;
  resource?: unknown;
  mode?: unknown;
}): Promise<NetworkPartnerPreviewSyncSnapshot> {
  const resource = normalizePreviewResource(input.resource);
  const mode = normalizePreviewMode(input.mode);

  const integration = await getIntegrationByIdForNetworkPartner(input.integrationId, input.networkPartnerId);
  if (!integration) {
    throw new Error("NOT_FOUND");
  }
  if (!integration.is_active) {
    throw new Error("INTEGRATION_INACTIVE");
  }

  const bookingScopes = await loadBookingScopesForNetworkPartner(input.networkPartnerId);
  const providerIntegration = toProviderIntegration({
    integrationId: input.integrationId,
    networkPartnerId: input.networkPartnerId,
    integration,
  });
  const providerResult = await syncIntegrationResources(providerIntegration, { resource, mode });

  const items: NetworkPartnerPreviewSyncItem[] = [];

  if (resource === "all" || resource === "offers") {
    for (const listing of providerResult.listings) {
      items.push(await mapOfferListingToPreviewItem(listing, bookingScopes));
    }
  }

  if (resource === "all") {
    for (const reference of providerResult.references) {
      items.push(mapReferenceRowToPreviewItem(reference));
    }
  }

  if (resource === "all" || resource === "requests") {
    for (const request of providerResult.requests) {
      items.push(await mapRequestRowToPreviewItem(request, bookingScopes));
    }
  }

  const counts = mapPreviewCounts(items);
  return {
    integration_id: integration.id,
    network_partner_id: integration.network_partner_id,
    provider: integration.provider,
    resource,
    mode,
    booking_scope_count: bookingScopes.length,
    booking_scopes: bookingScopes,
    counts,
    items,
    notes: providerResult.notes ?? [],
    diagnostics: {
      provider_request_count: providerResult.diagnostics?.provider_request_count ?? null,
      provider_pages_fetched: providerResult.diagnostics?.provider_pages_fetched ?? null,
      references_fetched: providerResult.referencesFetched,
      requests_fetched: providerResult.requestsFetched,
    },
  };
}

export async function runNetworkPartnerPreviewSync(input: {
  integrationId: string;
  networkPartnerId: string;
  resource?: unknown;
  mode?: unknown;
  sampleLimit?: number;
}): Promise<NetworkPartnerPreviewSyncResult> {
  const sampleLimit = Math.max(1, Math.min(Number(input.sampleLimit ?? 25) || 25, 100));
  const snapshot = await buildNetworkPartnerPreviewSyncSnapshot(input);
  const result: NetworkPartnerPreviewSyncResult = {
    integration_id: snapshot.integration_id,
    network_partner_id: snapshot.network_partner_id,
    provider: snapshot.provider,
    resource: snapshot.resource,
    mode: snapshot.mode,
    booking_scope_count: snapshot.booking_scope_count,
    counts: snapshot.counts,
    items: snapshot.items.slice(0, sampleLimit),
    notes: snapshot.notes,
    diagnostics: {
      ...snapshot.diagnostics,
      sample_limit: sampleLimit,
    },
  };

  const payload = {
    generated_at: new Date().toISOString(),
    kind: "preview",
    integration_id: snapshot.integration_id,
    network_partner_id: snapshot.network_partner_id,
    provider: snapshot.provider,
    resource: snapshot.resource,
    mode: snapshot.mode,
    booking_scope_count: snapshot.booking_scope_count,
    booking_scopes: snapshot.booking_scopes,
    counts: snapshot.counts,
    items: snapshot.items,
    notes: snapshot.notes,
    diagnostics: snapshot.diagnostics,
  };

  await persistPreviewTimestamp(
    snapshot.integration_id,
    snapshot.network_partner_id,
    snapshot.resource,
    {
      resource: snapshot.resource,
      mode: snapshot.mode,
      booking_scope_count: snapshot.booking_scope_count,
      counts: snapshot.counts,
      note_count: result.notes.length,
      previewed_at: payload.generated_at,
    },
    payload,
  );

  return result;
}
