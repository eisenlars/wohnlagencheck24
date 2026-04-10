import type {
  RawListing,
  RawReference,
  RawRequest,
} from "@/lib/providers/types";
import type {
  NetworkPartnerPreviewSyncItem,
  NetworkPartnerPreviewSyncItemStatus,
} from "@/lib/network-partners/types";
import {
  resolveAreaForNetworkPartnerPreview,
  type NetworkPartnerPreviewBookingScope,
} from "@/lib/network-partners/sync/resolve-area";

function asText(value: unknown): string | null {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asRegionTargets(
  value: unknown,
): Array<{ city?: string | null; district?: string | null; label?: string | null }> {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry) => Boolean(entry) && typeof entry === "object")
    .map((entry) => {
      const row = entry as Record<string, unknown>;
      return {
        city: asText(row.city),
        district: asText(row.district),
        label: asText(row.label),
      };
    });
}

function buildBasePreviewItem(args: {
  sourceResource: "offers" | "references" | "requests";
  contentType: "property_offer" | "property_request" | null;
  externalId: string;
  title: string | null;
  provider: string;
  normalizedPayload: Record<string, unknown>;
  sourcePayload: Record<string, unknown>;
  locationLabel: string | null;
}): Omit<
  NetworkPartnerPreviewSyncItem,
  "status" | "area_id" | "booking_id" | "matched_area_name" | "matched_area_slug" | "reason"
> {
  return {
    source_resource: args.sourceResource,
    content_type: args.contentType,
    external_id: args.externalId,
    title: args.title,
    provider: args.provider,
    location_label: args.locationLabel,
    normalized_payload: args.normalizedPayload,
    source_payload: args.sourcePayload,
  };
}

function finalizePreviewItem(
  base: Omit<
    NetworkPartnerPreviewSyncItem,
    "status" | "area_id" | "booking_id" | "matched_area_name" | "matched_area_slug" | "reason"
  >,
  status: NetworkPartnerPreviewSyncItemStatus,
  patch?: Partial<Pick<
    NetworkPartnerPreviewSyncItem,
    "area_id" | "booking_id" | "matched_area_name" | "matched_area_slug" | "reason" | "area_debug"
  >>,
): NetworkPartnerPreviewSyncItem {
  return {
    ...base,
    status,
    area_id: patch?.area_id ?? null,
    booking_id: patch?.booking_id ?? null,
    matched_area_name: patch?.matched_area_name ?? null,
    matched_area_slug: patch?.matched_area_slug ?? null,
    reason: patch?.reason ?? null,
    area_debug: patch?.area_debug ?? null,
  };
}

export async function mapOfferListingToPreviewItem(
  listing: RawListing,
  bookingScopes: NetworkPartnerPreviewBookingScope[],
): Promise<NetworkPartnerPreviewSyncItem> {
  const normalized = asObject(listing.normalized_payload);
  const externalId = asText(listing.external_id);
  const base = buildBasePreviewItem({
    sourceResource: "offers",
    contentType: "property_offer",
    externalId: externalId ?? "",
    title: asText(listing.title) ?? asText(normalized.source_title) ?? asText(normalized.title),
    provider: asText(listing.provider) ?? "",
    normalizedPayload: normalized,
    sourcePayload: asObject(listing.source_payload),
    locationLabel:
      asText(normalized.location)
      ?? asText(normalized.region)
      ?? [asText(normalized.city), asText(normalized.district)].filter(Boolean).join(" ")
      ?? null,
  });

  if (!externalId) {
    return finalizePreviewItem(base, "invalid_record", { reason: "missing_external_id" });
  }

  const resolution = await resolveAreaForNetworkPartnerPreview({
    placementCode: "property_offer",
    bookingScopes,
    zipCode: asText(normalized.zip_code),
    city: asText(normalized.city),
    district: asText(normalized.district),
    region: asText(normalized.region),
    location: asText(normalized.location),
  });

  return finalizePreviewItem(base, resolution.status, resolution);
}

export async function mapRequestRowToPreviewItem(
  request: RawRequest,
  bookingScopes: NetworkPartnerPreviewBookingScope[],
): Promise<NetworkPartnerPreviewSyncItem> {
  const normalized = asObject(request.normalized_payload);
  const externalId = asText(request.external_id);
  const base = buildBasePreviewItem({
    sourceResource: "requests",
    contentType: "property_request",
    externalId: externalId ?? "",
    title: asText(request.title) ?? asText(normalized.title) ?? "Suchprofil",
    provider: asText(request.provider) ?? "",
    normalizedPayload: normalized,
    sourcePayload: asObject(request.source_payload),
    locationLabel:
      asText(normalized.location)
      ?? [asText(normalized.city), asText(normalized.district)].filter(Boolean).join(" ")
      ?? null,
  });

  if (!externalId) {
    return finalizePreviewItem(base, "invalid_record", { reason: "missing_external_id" });
  }

  const resolution = await resolveAreaForNetworkPartnerPreview({
    placementCode: "property_request",
    bookingScopes,
    city: asText(normalized.city),
    district: asText(normalized.district),
    location: asText(normalized.location),
    regionTargets: asRegionTargets(normalized.region_targets),
  });

  return finalizePreviewItem(base, resolution.status, resolution);
}

export function mapReferenceRowToPreviewItem(reference: RawReference): NetworkPartnerPreviewSyncItem {
  const normalized = asObject(reference.normalized_payload);
  const externalId = asText(reference.external_id) ?? "";
  const base = buildBasePreviewItem({
    sourceResource: "references",
    contentType: null,
    externalId,
    title: asText(reference.title) ?? asText(normalized.title),
    provider: asText(reference.provider) ?? "",
    normalizedPayload: normalized,
    sourcePayload: asObject(reference.source_payload),
    locationLabel:
      asText(normalized.location)
      ?? [asText(normalized.city), asText(normalized.district)].filter(Boolean).join(" ")
      ?? null,
  });

  if (!externalId) {
    return finalizePreviewItem(base, "invalid_record", { reason: "missing_external_id" });
  }

  return finalizePreviewItem(base, "unsupported_type", { reason: "references_not_supported_in_network_partner_sync" });
}
