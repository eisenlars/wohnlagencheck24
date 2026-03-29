import { createAdminClient } from "@/utils/supabase/admin";
import { slugifyOfferTitle } from "@/utils/slug";
import {
  getContentByIdForPortalPartner,
} from "@/lib/network-partners/repositories/content";
import {
  hashNetworkContentSource,
  markNetworkContentTranslationsStaleIfSourceChanged,
} from "@/lib/network-partners/i18n";
import type {
  NetworkContentRecord,
  NetworkContentStatus,
  NetworkPartnerPreviewSyncItem,
  NetworkPropertyOfferDetails,
  NetworkPropertyRequestDetails,
} from "@/lib/network-partners/types";
import type { NetworkPartnerPreviewBookingScope } from "@/lib/network-partners/sync/resolve-area";

function asText(value: unknown): string {
  return String(value ?? "").trim();
}

function asNullableText(value: unknown): string | null {
  const normalized = asText(value);
  return normalized.length > 0 ? normalized : null;
}

function asFiniteNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function buildImportedSlug(title: string, externalId: string): string {
  const base = slugifyOfferTitle(title || "objekt");
  const suffix = String(externalId ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(-48);
  return suffix ? `${base}-${suffix}` : base;
}

function resolveImportedStatus(currentStatus: NetworkContentStatus | null): NetworkContentStatus {
  if (!currentStatus) return "draft";
  if (currentStatus === "live" || currentStatus === "approved") return "in_review";
  if (currentStatus === "expired" || currentStatus === "rejected") return "draft";
  return currentStatus;
}

function buildOfferDetails(item: NetworkPartnerPreviewSyncItem): NetworkPropertyOfferDetails {
  const normalized = item.normalized_payload;
  return {
    external_id: item.external_id,
    marketing_type: asNullableText(normalized.offer_type),
    property_type: asNullableText(normalized.object_type ?? normalized.legacy_object_type),
    location_label:
      asNullableText(normalized.location)
      ?? item.location_label
      ?? asNullableText(normalized.city),
    price: asFiniteNumberOrNull(normalized.price ?? normalized.rent),
    living_area: asFiniteNumberOrNull(normalized.area_sqm ?? normalized.living_space),
    plot_area: asFiniteNumberOrNull(normalized.plot_area ?? normalized.property_space_value),
    rooms: asFiniteNumberOrNull(normalized.rooms),
  };
}

function buildRequestDetails(item: NetworkPartnerPreviewSyncItem): NetworkPropertyRequestDetails {
  const normalized = item.normalized_payload;
  return {
    external_id: item.external_id,
    request_type: asNullableText(normalized.request_type),
    search_region:
      item.location_label
      ?? asNullableText(normalized.region)
      ?? asNullableText(normalized.location),
    budget_min: asFiniteNumberOrNull(normalized.min_price),
    budget_max: asFiniteNumberOrNull(normalized.max_price),
    area_min: asFiniteNumberOrNull(normalized.min_living_area_sqm ?? normalized.area_sqm),
    area_max: asFiniteNumberOrNull(normalized.max_living_area_sqm),
  };
}

function buildImportedSummary(item: NetworkPartnerPreviewSyncItem): string | null {
  const normalized = item.normalized_payload;
  return (
    asNullableText(normalized.description)
    ?? asNullableText(normalized.note)
    ?? asNullableText(normalized.reference_text_seed)
  );
}

function buildImportedBody(item: NetworkPartnerPreviewSyncItem): string | null {
  const normalized = item.normalized_payload;
  const parts = [
    asNullableText(normalized.long_description),
    asNullableText(normalized.description),
    asNullableText(normalized.location),
    asNullableText(normalized.features_note),
    asNullableText(normalized.note),
  ].filter((value): value is string => Boolean(value));

  if (parts.length === 0) return null;
  return parts.join("\n\n");
}

async function findExistingContentIdByExternalId(args: {
  networkPartnerId: string;
  contentType: "property_offer" | "property_request";
  externalId: string;
}): Promise<string | null> {
  const admin = createAdminClient();
  const table = args.contentType === "property_offer"
    ? "network_property_offers"
    : "network_property_requests";

  const { data, error } = await admin
    .from(table)
    .select("content_item_id")
    .eq("external_id", args.externalId);

  if (error) throw new Error(error.message ?? "NETWORK_IMPORTED_CONTENT_LOOKUP_FAILED");

  const contentIds = (Array.isArray(data) ? data : [])
    .map((row) => asText((row as Record<string, unknown>).content_item_id))
    .filter(Boolean);
  if (contentIds.length === 0) return null;

  const { data: contentRows, error: contentError } = await admin
    .from("network_content_items")
    .select("id")
    .in("id", contentIds)
    .eq("network_partner_id", args.networkPartnerId)
    .eq("content_type", args.contentType)
    .limit(1)
    .maybeSingle();

  if (contentError) throw new Error(contentError.message ?? "NETWORK_IMPORTED_CONTENT_LOOKUP_FAILED");
  return isRecord(contentRows) ? asNullableText(contentRows.id) : null;
}

async function upsertSubtypeByContentType(args: {
  contentId: string;
  item: NetworkPartnerPreviewSyncItem;
}) {
  const admin = createAdminClient();
  if (args.item.content_type === "property_offer") {
    const details = buildOfferDetails(args.item);
    const { error } = await admin
      .from("network_property_offers")
      .upsert({
        content_item_id: args.contentId,
        external_id: details.external_id,
        marketing_type: details.marketing_type,
        property_type: details.property_type,
        location_label: details.location_label,
        price: details.price,
        living_area: details.living_area,
        plot_area: details.plot_area,
        rooms: details.rooms,
      }, { onConflict: "content_item_id" });
    if (error) throw new Error(error.message ?? "NETWORK_PROPERTY_OFFER_UPSERT_FAILED");
    return;
  }

  const details = buildRequestDetails(args.item);
  const { error } = await admin
    .from("network_property_requests")
    .upsert({
      content_item_id: args.contentId,
      external_id: details.external_id,
      request_type: details.request_type,
      search_region: details.search_region,
      budget_min: details.budget_min,
      budget_max: details.budget_max,
      area_min: details.area_min,
      area_max: details.area_max,
    }, { onConflict: "content_item_id" });
  if (error) throw new Error(error.message ?? "NETWORK_PROPERTY_REQUEST_UPSERT_FAILED");
}

export async function upsertImportedPreviewItem(args: {
  networkPartnerId: string;
  bookingScope: NetworkPartnerPreviewBookingScope;
  item: NetworkPartnerPreviewSyncItem;
}): Promise<{ action: "created" | "updated"; content: NetworkContentRecord }> {
  if (args.item.content_type !== "property_offer" && args.item.content_type !== "property_request") {
    throw new Error("INVALID_IMPORTED_CONTENT_TYPE");
  }

  const admin = createAdminClient();
  const existingContentId = await findExistingContentIdByExternalId({
    networkPartnerId: args.networkPartnerId,
    contentType: args.item.content_type,
    externalId: args.item.external_id,
  });

  const title = asText(args.item.title) || `${args.item.content_type}-${args.item.external_id}`;
  const slug = buildImportedSlug(title, args.item.external_id);
  const summary = buildImportedSummary(args.item);
  const bodyMd = buildImportedBody(args.item);
  const ctaUrl = asNullableText(args.item.normalized_payload.detail_url);
  const ctaLabel = args.item.content_type === "property_offer" && ctaUrl ? "Zum Angebot" : null;

  if (!existingContentId) {
    const { data, error } = await admin
      .from("network_content_items")
      .insert({
        portal_partner_id: args.bookingScope.portal_partner_id,
        network_partner_id: args.networkPartnerId,
        booking_id: args.bookingScope.booking_id,
        area_id: args.bookingScope.area_id,
        content_type: args.item.content_type,
        source_type: "api",
        status: "draft",
        slug,
        title,
        summary,
        body_md: bodyMd,
        cta_label: ctaLabel,
        cta_url: ctaUrl,
        primary_locale: "de",
      })
      .select("id")
      .maybeSingle();

    if (error) throw new Error(error.message ?? "NETWORK_IMPORTED_CONTENT_CREATE_FAILED");
    const contentId = asText(data?.id);
    if (!contentId) throw new Error("NETWORK_IMPORTED_CONTENT_CREATE_FAILED");

    await upsertSubtypeByContentType({ contentId, item: args.item });

    const created = await getContentByIdForPortalPartner(contentId, args.bookingScope.portal_partner_id);
    if (!created) throw new Error("NETWORK_IMPORTED_CONTENT_CREATE_FAILED");
    return { action: "created", content: created };
  }

  const current = await getContentByIdForPortalPartner(existingContentId, args.bookingScope.portal_partner_id);
  if (!current) throw new Error("NETWORK_IMPORTED_CONTENT_LOOKUP_FAILED");
  const previousSourceHash = hashNetworkContentSource(current);

  const nextStatus = resolveImportedStatus(current.status);
  const patch: Record<string, unknown> = {
    booking_id: args.bookingScope.booking_id,
    area_id: args.bookingScope.area_id,
    source_type: "api",
    status: nextStatus,
    slug,
    title,
    summary,
    body_md: bodyMd,
    cta_label: ctaLabel,
    cta_url: ctaUrl,
    primary_locale: "de",
  };
  if (current.status === "live" && nextStatus !== "live") {
    patch.published_at = current.published_at;
  }

  const { error } = await admin
    .from("network_content_items")
    .update(patch)
    .eq("id", existingContentId)
    .eq("portal_partner_id", args.bookingScope.portal_partner_id);

  if (error) throw new Error(error.message ?? "NETWORK_IMPORTED_CONTENT_UPDATE_FAILED");

  await upsertSubtypeByContentType({ contentId: existingContentId, item: args.item });

  const updated = await getContentByIdForPortalPartner(existingContentId, args.bookingScope.portal_partner_id);
  if (!updated) throw new Error("NETWORK_IMPORTED_CONTENT_UPDATE_FAILED");
  await markNetworkContentTranslationsStaleIfSourceChanged({
    content: updated,
    previousSourceHash,
  });
  return { action: "updated", content: updated };
}
