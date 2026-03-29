import { createAdminClient } from "@/utils/supabase/admin";
import { resolveNextNetworkContentStatus, resolveReviewStatusForAction } from "@/lib/network-partners/content-workflow";
import {
  assertNetworkContentRequiredLocalesSatisfied,
  hashNetworkContentSource,
  markNetworkContentTranslationsStaleIfSourceChanged,
} from "@/lib/network-partners/i18n";
import { getBookingByIdForPortalPartner } from "@/lib/network-partners/repositories/bookings";
import type {
  NetworkCompanyProfileDetails,
  NetworkContentCreateInput,
  NetworkContentRecord,
  NetworkContentReviewAction,
  NetworkContentReviewRecord,
  NetworkContentStatus,
  NetworkContentUpdateInput,
  NetworkPropertyOfferDetails,
  NetworkPropertyRequestDetails,
} from "@/lib/network-partners/types";

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

function asRowArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord);
}

function normalizePrimaryLocale(value: unknown): string {
  const locale = asText(value).toLowerCase();
  return locale || "de";
}

function normalizeContentStatus(value: unknown): NetworkContentStatus {
  const status = asText(value);
  if (
    status === "in_review"
    || status === "approved"
    || status === "live"
    || status === "paused"
    || status === "rejected"
    || status === "expired"
  ) {
    return status;
  }
  return "draft";
}

function mapReviewRow(row: Record<string, unknown>): NetworkContentReviewRecord {
  return {
    id: asText(row.id),
    content_item_id: asText(row.content_item_id),
    review_status: (asText(row.review_status) || "pending") as NetworkContentReviewRecord["review_status"],
    reviewed_by_user_id: asNullableText(row.reviewed_by_user_id),
    review_note: asNullableText(row.review_note),
    reviewed_at: asNullableText(row.reviewed_at),
  };
}

function normalizeCompanyProfileDetails(
  value: Partial<NetworkCompanyProfileDetails> | null | undefined,
): NetworkCompanyProfileDetails {
  return {
    company_name: asText(value?.company_name),
    industry_type: asNullableText(value?.industry_type),
    service_region: asNullableText(value?.service_region),
  };
}

function normalizePropertyOfferDetails(
  value: Partial<NetworkPropertyOfferDetails> | null | undefined,
): NetworkPropertyOfferDetails {
  return {
    external_id: asNullableText(value?.external_id),
    marketing_type: asNullableText(value?.marketing_type),
    property_type: asNullableText(value?.property_type),
    location_label: asNullableText(value?.location_label),
    price: asFiniteNumberOrNull(value?.price),
    living_area: asFiniteNumberOrNull(value?.living_area),
    plot_area: asFiniteNumberOrNull(value?.plot_area),
    rooms: asFiniteNumberOrNull(value?.rooms),
  };
}

function normalizePropertyRequestDetails(
  value: Partial<NetworkPropertyRequestDetails> | null | undefined,
): NetworkPropertyRequestDetails {
  return {
    external_id: asNullableText(value?.external_id),
    request_type: asNullableText(value?.request_type),
    search_region: asNullableText(value?.search_region),
    budget_min: asFiniteNumberOrNull(value?.budget_min),
    budget_max: asFiniteNumberOrNull(value?.budget_max),
    area_min: asFiniteNumberOrNull(value?.area_min),
    area_max: asFiniteNumberOrNull(value?.area_max),
  };
}

function mapContentRow(
  row: Record<string, unknown>,
  reviewsByContentId: Map<string, NetworkContentReviewRecord>,
): NetworkContentRecord {
  const contentId = asText(row.id);
  const companyProfileValue = Array.isArray(row.network_company_profiles)
    ? row.network_company_profiles[0]
    : row.network_company_profiles;
  const propertyOfferValue = Array.isArray(row.network_property_offers)
    ? row.network_property_offers[0]
    : row.network_property_offers;
  const propertyRequestValue = Array.isArray(row.network_property_requests)
    ? row.network_property_requests[0]
    : row.network_property_requests;
  return {
    id: contentId,
    portal_partner_id: asText(row.portal_partner_id),
    network_partner_id: asText(row.network_partner_id),
    booking_id: asText(row.booking_id),
    area_id: asText(row.area_id),
    content_type: (asText(row.content_type) || "company_profile") as NetworkContentRecord["content_type"],
    source_type: (asText(row.source_type) || "manual") as NetworkContentRecord["source_type"],
    status: normalizeContentStatus(row.status),
    slug: asText(row.slug),
    title: asText(row.title),
    summary: asNullableText(row.summary),
    body_md: asNullableText(row.body_md),
    cta_label: asNullableText(row.cta_label),
    cta_url: asNullableText(row.cta_url),
    primary_locale: normalizePrimaryLocale(row.primary_locale),
    published_at: asNullableText(row.published_at),
    expires_at: asNullableText(row.expires_at),
    created_at: asText(row.created_at),
    updated_at: asText(row.updated_at),
    company_profile: companyProfileValue && typeof companyProfileValue === "object"
      ? normalizeCompanyProfileDetails(companyProfileValue as Partial<NetworkCompanyProfileDetails>)
      : null,
    property_offer: propertyOfferValue && typeof propertyOfferValue === "object"
      ? normalizePropertyOfferDetails(propertyOfferValue as Partial<NetworkPropertyOfferDetails>)
      : null,
    property_request: propertyRequestValue && typeof propertyRequestValue === "object"
      ? normalizePropertyRequestDetails(propertyRequestValue as Partial<NetworkPropertyRequestDetails>)
      : null,
    latest_review: reviewsByContentId.get(contentId) ?? null,
  };
}

async function loadReviewsByContentIds(contentIds: string[]): Promise<Map<string, NetworkContentReviewRecord>> {
  if (contentIds.length === 0) return new Map();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("network_content_reviews")
    .select("id, content_item_id, review_status, reviewed_by_user_id, review_note, reviewed_at")
    .in("content_item_id", contentIds)
    .order("reviewed_at", { ascending: false, nullsFirst: false });

  if (error) throw new Error(error.message ?? "NETWORK_CONTENT_REVIEWS_LIST_FAILED");

  const mapped = new Map<string, NetworkContentReviewRecord>();
  for (const row of data ?? []) {
    const record = mapReviewRow(row as Record<string, unknown>);
    if (!mapped.has(record.content_item_id)) {
      mapped.set(record.content_item_id, record);
    }
  }
  return mapped;
}

function assertRequiredText(value: string, field: string) {
  if (!value) throw new Error(`INVALID_${field.toUpperCase()}`);
}

function assertBookingAllowsContent(status: string) {
  if (status === "cancelled" || status === "expired") {
    throw new Error("BOOKING_NOT_CONTENT_EDITABLE");
  }
}

async function upsertSubtypeDetails(args: {
  contentId: string;
  contentType: NetworkContentRecord["content_type"];
  company_profile?: Partial<NetworkCompanyProfileDetails> | null;
  property_offer?: Partial<NetworkPropertyOfferDetails> | null;
  property_request?: Partial<NetworkPropertyRequestDetails> | null;
}) {
  const admin = createAdminClient();

  if (args.contentType === "company_profile") {
    const payload = normalizeCompanyProfileDetails(args.company_profile);
    assertRequiredText(payload.company_name, "company_profile_name");
    const { error } = await admin
      .from("network_company_profiles")
      .upsert({
        content_item_id: args.contentId,
        company_name: payload.company_name,
        industry_type: payload.industry_type,
        service_region: payload.service_region,
      }, { onConflict: "content_item_id" });
    if (error) throw new Error(error.message ?? "NETWORK_COMPANY_PROFILE_UPSERT_FAILED");
    return;
  }

  if (args.contentType === "property_offer") {
    const payload = normalizePropertyOfferDetails(args.property_offer);
    const { error } = await admin
      .from("network_property_offers")
      .upsert({
        content_item_id: args.contentId,
        external_id: payload.external_id,
        marketing_type: payload.marketing_type,
        property_type: payload.property_type,
        location_label: payload.location_label,
        price: payload.price,
        living_area: payload.living_area,
        plot_area: payload.plot_area,
        rooms: payload.rooms,
      }, { onConflict: "content_item_id" });
    if (error) throw new Error(error.message ?? "NETWORK_PROPERTY_OFFER_UPSERT_FAILED");
    return;
  }

  const payload = normalizePropertyRequestDetails(args.property_request);
  const { error } = await admin
    .from("network_property_requests")
    .upsert({
      content_item_id: args.contentId,
      external_id: payload.external_id,
      request_type: payload.request_type,
      search_region: payload.search_region,
      budget_min: payload.budget_min,
      budget_max: payload.budget_max,
      area_min: payload.area_min,
      area_max: payload.area_max,
    }, { onConflict: "content_item_id" });
  if (error) throw new Error(error.message ?? "NETWORK_PROPERTY_REQUEST_UPSERT_FAILED");
}

async function fetchContentRowsByPortalPartner(partnerId: string, id?: string) {
  const admin = createAdminClient();
  let query = admin
    .from("network_content_items")
    .select([
      "id",
      "portal_partner_id",
      "network_partner_id",
      "booking_id",
      "area_id",
      "content_type",
      "source_type",
      "status",
      "slug",
      "title",
      "summary",
      "body_md",
      "cta_label",
      "cta_url",
      "primary_locale",
      "published_at",
      "expires_at",
      "created_at",
      "updated_at",
      "network_company_profiles(*)",
      "network_property_offers(*)",
      "network_property_requests(*)",
    ].join(", "))
    .eq("portal_partner_id", partnerId);

  if (id) {
    query = query.eq("id", id);
    const { data, error } = await query.maybeSingle();
    if (error) throw new Error(error.message ?? "NETWORK_CONTENT_LOOKUP_FAILED");
    return isRecord(data) ? [data] : [];
  }

  const { data, error } = await query.order("updated_at", { ascending: false });
  if (error) throw new Error(error.message ?? "NETWORK_CONTENT_LIST_FAILED");
  return asRowArray(data);
}

export async function listContentByPortalPartner(
  partnerId: string,
): Promise<NetworkContentRecord[]> {
  const rows = await fetchContentRowsByPortalPartner(partnerId);
  const reviewMap = await loadReviewsByContentIds(rows.map((row) => asText(row.id)).filter(Boolean));
  return rows.map((row) => mapContentRow(row, reviewMap));
}

export async function getContentByIdForPortalPartner(
  id: string,
  partnerId: string,
): Promise<NetworkContentRecord | null> {
  const rows = await fetchContentRowsByPortalPartner(partnerId, id);
  if (rows.length === 0) return null;
  const reviewMap = await loadReviewsByContentIds([id]);
  return mapContentRow(rows[0], reviewMap);
}

export async function createContent(
  input: NetworkContentCreateInput,
): Promise<NetworkContentRecord> {
  assertRequiredText(asText(input.portal_partner_id), "portal_partner_id");
  assertRequiredText(asText(input.booking_id), "booking_id");
  assertRequiredText(asText(input.slug), "slug");
  assertRequiredText(asText(input.title), "title");

  const booking = await getBookingByIdForPortalPartner(input.booking_id, input.portal_partner_id);
  if (!booking) throw new Error("BOOKING_NOT_FOUND");
  assertBookingAllowsContent(booking.status);

  const contentType = booking.placement_code;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("network_content_items")
    .insert({
      portal_partner_id: input.portal_partner_id,
      network_partner_id: booking.network_partner_id,
      booking_id: booking.id,
      area_id: booking.area_id,
      content_type: contentType,
      source_type: "manual",
      status: "draft",
      slug: asText(input.slug),
      title: asText(input.title),
      summary: asNullableText(input.summary),
      body_md: asNullableText(input.body_md),
      cta_label: asNullableText(input.cta_label),
      cta_url: asNullableText(input.cta_url),
      primary_locale: normalizePrimaryLocale(input.primary_locale),
    })
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message ?? "NETWORK_CONTENT_CREATE_FAILED");
  const contentId = asText(data?.id);
  if (!contentId) throw new Error("NETWORK_CONTENT_CREATE_FAILED");

  await upsertSubtypeDetails({
    contentId,
    contentType,
    company_profile: input.company_profile,
    property_offer: input.property_offer,
    property_request: input.property_request,
  });

  const created = await getContentByIdForPortalPartner(contentId, input.portal_partner_id);
  if (!created) throw new Error("NETWORK_CONTENT_CREATE_FAILED");
  return created;
}

export async function updateContent(
  input: NetworkContentUpdateInput,
): Promise<NetworkContentRecord> {
  const current = await getContentByIdForPortalPartner(input.id, input.portal_partner_id);
  if (!current) throw new Error("NOT_FOUND");
  const previousSourceHash = hashNetworkContentSource(current);

  const patch: Record<string, unknown> = {};
  if (input.slug !== undefined) patch.slug = asText(input.slug);
  if (input.title !== undefined) patch.title = asText(input.title);
  if (input.summary !== undefined) patch.summary = asNullableText(input.summary);
  if (input.body_md !== undefined) patch.body_md = asNullableText(input.body_md);
  if (input.cta_label !== undefined) patch.cta_label = asNullableText(input.cta_label);
  if (input.cta_url !== undefined) patch.cta_url = asNullableText(input.cta_url);
  if (input.primary_locale !== undefined) patch.primary_locale = normalizePrimaryLocale(input.primary_locale);

  if (Object.keys(patch).length > 0) {
    if (patch.slug !== undefined) assertRequiredText(asText(patch.slug), "slug");
    if (patch.title !== undefined) assertRequiredText(asText(patch.title), "title");

    const admin = createAdminClient();
    const { error } = await admin
      .from("network_content_items")
      .update(patch)
      .eq("id", input.id)
      .eq("portal_partner_id", input.portal_partner_id);

    if (error) throw new Error(error.message ?? "NETWORK_CONTENT_UPDATE_FAILED");
  }

  await upsertSubtypeDetails({
    contentId: input.id,
    contentType: current.content_type,
    company_profile: input.company_profile ?? current.company_profile,
    property_offer: input.property_offer ?? current.property_offer,
    property_request: input.property_request ?? current.property_request,
  });

  const updated = await getContentByIdForPortalPartner(input.id, input.portal_partner_id);
  if (!updated) throw new Error("NETWORK_CONTENT_UPDATE_FAILED");
  await markNetworkContentTranslationsStaleIfSourceChanged({
    content: updated,
    previousSourceHash,
  });
  return updated;
}

export async function applyContentReviewAction(input: {
  id: string;
  portal_partner_id: string;
  reviewer_user_id: string;
  action: NetworkContentReviewAction;
  review_note?: string | null;
}): Promise<NetworkContentRecord> {
  const current = await getContentByIdForPortalPartner(input.id, input.portal_partner_id);
  if (!current) throw new Error("NOT_FOUND");

  const nextStatus = resolveNextNetworkContentStatus(current.status, input.action);
  const nextReviewStatus = resolveReviewStatusForAction(input.action);
  if (input.action === "publish") {
    await assertNetworkContentRequiredLocalesSatisfied({
      contentItemId: current.id,
      portalPartnerId: input.portal_partner_id,
    });
  }
  const admin = createAdminClient();
  const patch: Record<string, unknown> = { status: nextStatus };
  if (nextStatus === "live" && !current.published_at) {
    patch.published_at = new Date().toISOString();
  }

  const { error } = await admin
    .from("network_content_items")
    .update(patch)
    .eq("id", input.id)
    .eq("portal_partner_id", input.portal_partner_id);
  if (error) throw new Error(error.message ?? "NETWORK_CONTENT_REVIEW_ACTION_FAILED");

  if (nextReviewStatus) {
    const { error: reviewError } = await admin
      .from("network_content_reviews")
      .insert({
        content_item_id: input.id,
        review_status: nextReviewStatus,
        reviewed_by_user_id: input.reviewer_user_id,
        review_note: asNullableText(input.review_note),
        reviewed_at: new Date().toISOString(),
      });
    if (reviewError) throw new Error(reviewError.message ?? "NETWORK_CONTENT_REVIEW_LOG_FAILED");
  }

  const updated = await getContentByIdForPortalPartner(input.id, input.portal_partner_id);
  if (!updated) throw new Error("NETWORK_CONTENT_REVIEW_ACTION_FAILED");
  return updated;
}
