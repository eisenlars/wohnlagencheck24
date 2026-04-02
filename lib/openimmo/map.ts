import type { PartnerIntegration, MappedOffer, RawListing } from "@/lib/providers/types";
import type { OpenImmoListing } from "@/lib/openimmo/types";

function toIsoNow(): string {
  return new Date().toISOString();
}

function buildDetailUrl(template: string | null, listing: OpenImmoListing): string | null {
  if (!template) return null;
  return template
    .replaceAll("{id}", listing.external_id)
    .replaceAll("{external_id}", listing.external_id);
}

export function mapOpenImmoListingToOffer(
  partnerId: string,
  integration: PartnerIntegration,
  listing: OpenImmoListing,
): MappedOffer {
  return {
    partner_id: partnerId,
    source: "openimmo",
    external_id: listing.external_id,
    offer_type: listing.offer_type,
    object_type: listing.object_type,
    title: listing.title,
    price: listing.price,
    rent: listing.rent,
    area_sqm: listing.area_sqm,
    rooms: listing.rooms,
    address: listing.address,
    image_url: listing.image_url,
    detail_url: buildDetailUrl(integration.detail_url_template, listing),
    is_top: false,
    updated_at: listing.updated_at,
    raw: {
      description: listing.description,
      location_note: listing.location_note,
      furnishing_note: listing.furnishing_note,
      attachments: listing.attachments,
      ...listing.raw,
    },
    source_payload: {
      ...listing.raw,
      description: listing.description,
      location_note: listing.location_note,
      furnishing_note: listing.furnishing_note,
      attachments: listing.attachments,
    },
  };
}

export function mapOpenImmoListingToRawListing(
  partnerId: string,
  listing: OpenImmoListing,
): RawListing {
  const now = toIsoNow();
  return {
    partner_id: partnerId,
    provider: "openimmo",
    external_id: listing.external_id,
    title: listing.title,
    status: null,
    source_updated_at: listing.updated_at,
    normalized_payload: {
      title: listing.title,
      description: listing.description,
      location_note: listing.location_note,
      furnishing_note: listing.furnishing_note,
      offer_type: listing.offer_type,
      object_type: listing.object_type,
      area_sqm: listing.area_sqm,
      rooms: listing.rooms,
      address: listing.address,
      image_url: listing.image_url,
      attachments: listing.attachments,
      ...listing.raw,
    },
    source_payload: {
      ...listing.raw,
      description: listing.description,
      location_note: listing.location_note,
      furnishing_note: listing.furnishing_note,
      attachments: listing.attachments,
    },
    is_active: true,
    sync_status: "ok",
    last_seen_at: now,
    updated_at: now,
  };
}
