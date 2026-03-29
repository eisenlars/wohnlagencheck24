import { createAdminClient } from "@/utils/supabase/admin";
import type {
  NetworkCompanyProfileDetails,
  NetworkContentMediaRecord,
  NetworkPropertyOfferDetails,
  NetworkPropertyRequestDetails,
  NetworkContentType,
  NetworkContentTranslationRecord,
  PublicNetworkContentCollection,
  PublicNetworkContentItem,
} from "@/lib/network-partners/types";

type PublicRouteLevel = "bundesland" | "kreis" | "ort";

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

function normalizeLocale(locale: string | null | undefined): string {
  const normalized = asText(locale).toLowerCase();
  return normalized || "de";
}

function normalizeContentType(value: unknown): NetworkContentType {
  const normalized = asText(value);
  if (normalized === "property_offer" || normalized === "property_request") {
    return normalized;
  }
  return "company_profile";
}

function normalizeTranslationStatus(value: unknown): NetworkContentTranslationRecord["status"] {
  const normalized = asText(value);
  if (normalized === "reviewed" || normalized === "edited" || normalized === "stale") {
    return normalized;
  }
  return "machine_generated";
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

function mapMediaRow(row: Record<string, unknown>): NetworkContentMediaRecord {
  const kind = asText(row.kind);
  return {
    id: asText(row.id),
    content_item_id: asText(row.content_item_id),
    kind: kind === "hero" || kind === "gallery" || kind === "document" ? kind : "logo",
    url: asText(row.url),
    sort_order: Math.max(0, Math.floor(Number(row.sort_order ?? 0))),
    created_at: asText(row.created_at),
  };
}

function mapTranslationRow(row: Record<string, unknown>): NetworkContentTranslationRecord {
  return {
    id: asText(row.id),
    content_item_id: asText(row.content_item_id),
    locale: normalizeLocale(asText(row.locale)),
    status: normalizeTranslationStatus(row.status),
    translated_title: asNullableText(row.translated_title),
    translated_summary: asNullableText(row.translated_summary),
    translated_body_md: asNullableText(row.translated_body_md),
    source_snapshot_hash: asNullableText(row.source_snapshot_hash),
    updated_at: asText(row.updated_at),
  };
}

type PublicContentRow = {
  id: string;
  booking_id: string;
  area_id: string;
  network_partner_id: string;
  network_partner_name: string | null;
  content_type: NetworkContentType;
  slug: string;
  title: string;
  summary: string | null;
  body_md: string | null;
  cta_label: string | null;
  cta_url: string | null;
  primary_locale: string;
  published_at: string | null;
  expires_at: string | null;
  booking_status: string | null;
  company_profile: NetworkCompanyProfileDetails | null;
  property_offer: NetworkPropertyOfferDetails | null;
  property_request: NetworkPropertyRequestDetails | null;
};

function mapPublicContentRow(row: Record<string, unknown>): PublicContentRow {
  const companyProfileValue = Array.isArray(row.network_company_profiles)
    ? row.network_company_profiles[0]
    : row.network_company_profiles;
  const propertyOfferValue = Array.isArray(row.network_property_offers)
    ? row.network_property_offers[0]
    : row.network_property_offers;
  const propertyRequestValue = Array.isArray(row.network_property_requests)
    ? row.network_property_requests[0]
    : row.network_property_requests;
  const networkPartnerValue = Array.isArray(row.network_partners)
    ? row.network_partners[0]
    : row.network_partners;
  const bookingValue = Array.isArray(row.network_partner_bookings)
    ? row.network_partner_bookings[0]
    : row.network_partner_bookings;

  return {
    id: asText(row.id),
    booking_id: asText(row.booking_id),
    area_id: asText(row.area_id),
    network_partner_id: asText(row.network_partner_id),
    network_partner_name: isRecord(networkPartnerValue) ? asNullableText(networkPartnerValue.company_name) : null,
    content_type: normalizeContentType(row.content_type),
    slug: asText(row.slug),
    title: asText(row.title),
    summary: asNullableText(row.summary),
    body_md: asNullableText(row.body_md),
    cta_label: asNullableText(row.cta_label),
    cta_url: asNullableText(row.cta_url),
    primary_locale: normalizeLocale(asText(row.primary_locale)),
    published_at: asNullableText(row.published_at),
    expires_at: asNullableText(row.expires_at),
    booking_status: isRecord(bookingValue) ? asNullableText(bookingValue.status) : null,
    company_profile: isRecord(companyProfileValue)
      ? normalizeCompanyProfileDetails(companyProfileValue as Partial<NetworkCompanyProfileDetails>)
      : null,
    property_offer: isRecord(propertyOfferValue)
      ? normalizePropertyOfferDetails(propertyOfferValue as Partial<NetworkPropertyOfferDetails>)
      : null,
    property_request: isRecord(propertyRequestValue)
      ? normalizePropertyRequestDetails(propertyRequestValue as Partial<NetworkPropertyRequestDetails>)
      : null,
  };
}

function getAllowedContentTypesForLevel(routeLevel: PublicRouteLevel): NetworkContentType[] {
  if (routeLevel === "bundesland") return [];
  if (routeLevel === "ort") return ["property_offer", "property_request"];
  return ["company_profile", "property_offer", "property_request"];
}

async function listPublicContentRows(areaId: string): Promise<PublicContentRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("network_content_items")
    .select([
      "id",
      "booking_id",
      "area_id",
      "network_partner_id",
      "content_type",
      "slug",
      "title",
      "summary",
      "body_md",
      "cta_label",
      "cta_url",
      "primary_locale",
      "published_at",
      "expires_at",
      "network_company_profiles(*)",
      "network_property_offers(*)",
      "network_property_requests(*)",
      "network_partners(company_name)",
      "network_partner_bookings(status)",
    ].join(", "))
    .eq("area_id", areaId)
    .eq("status", "live")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message ?? "PUBLIC_NETWORK_CONTENT_LIST_FAILED");
  return asRowArray(data).map((row) => mapPublicContentRow(row));
}

async function listTranslationsForLocale(
  contentIds: string[],
  locale: string,
): Promise<Map<string, NetworkContentTranslationRecord>> {
  if (contentIds.length === 0) return new Map();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("network_content_i18n")
    .select("id, content_item_id, locale, status, translated_title, translated_summary, translated_body_md, source_snapshot_hash, updated_at")
    .in("content_item_id", contentIds)
    .eq("locale", locale);

  if (error) throw new Error(error.message ?? "PUBLIC_NETWORK_CONTENT_TRANSLATIONS_LIST_FAILED");

  const rows = asRowArray(data).map((row) => mapTranslationRow(row));
  return new Map(rows.map((row) => [row.content_item_id, row]));
}

async function listMediaForContent(contentIds: string[]): Promise<Map<string, NetworkContentMediaRecord[]>> {
  if (contentIds.length === 0) return new Map();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("network_content_media")
    .select("id, content_item_id, kind, url, sort_order, created_at")
    .in("content_item_id", contentIds)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message ?? "PUBLIC_NETWORK_CONTENT_MEDIA_LIST_FAILED");

  const grouped = new Map<string, NetworkContentMediaRecord[]>();
  for (const row of asRowArray(data)) {
    const media = mapMediaRow(row);
    const bucket = grouped.get(media.content_item_id) ?? [];
    bucket.push(media);
    grouped.set(media.content_item_id, bucket);
  }
  return grouped;
}

export async function loadPublicNetworkContentForArea(args: {
  areaId: string;
  locale?: string | null;
  routeLevel: PublicRouteLevel;
}): Promise<PublicNetworkContentCollection> {
  const locale = normalizeLocale(args.locale);
  const allowedContentTypes = getAllowedContentTypesForLevel(args.routeLevel);

  if (allowedContentTypes.length === 0) {
    return {
      area_id: args.areaId,
      locale,
      items: [],
      company_profiles: [],
      property_offers: [],
      property_requests: [],
    };
  }

  const nowIso = new Date().toISOString();
  const baseRows = (await listPublicContentRows(args.areaId))
    .filter((row) => allowedContentTypes.includes(row.content_type))
    .filter((row) => row.booking_status === "active")
    .filter((row) => !row.expires_at || row.expires_at > nowIso);

  const contentIds = baseRows.map((row) => row.id);
  const [translationsByContentId, mediaByContentId] = await Promise.all([
    listTranslationsForLocale(contentIds, locale),
    listMediaForContent(contentIds),
  ]);

  const items: PublicNetworkContentItem[] = [];
  for (const row of baseRows) {
    const translation = translationsByContentId.get(row.id);
    const usePrimaryLocale = row.primary_locale === locale;

    if (!usePrimaryLocale) {
      if (!translation || translation.status === "stale") {
        continue;
      }
    }

    items.push({
      id: row.id,
      booking_id: row.booking_id,
      area_id: row.area_id,
      network_partner_id: row.network_partner_id,
      network_partner_name: row.network_partner_name,
      content_type: row.content_type,
      slug: row.slug,
      title: usePrimaryLocale ? row.title : (translation?.translated_title ?? row.title),
      summary: usePrimaryLocale ? row.summary : (translation?.translated_summary ?? row.summary),
      body_md: usePrimaryLocale ? row.body_md : (translation?.translated_body_md ?? row.body_md),
      cta_label: row.cta_label,
      cta_url: row.cta_url,
      locale,
      locale_source: usePrimaryLocale ? "primary" : "translation",
      primary_locale: row.primary_locale,
      media: mediaByContentId.get(row.id) ?? [],
      company_profile: row.company_profile,
      property_offer: row.property_offer,
      property_request: row.property_request,
    });
  }

  const companyProfiles = items.filter((item) => item.content_type === "company_profile");
  const propertyOffers = items.filter((item) => item.content_type === "property_offer");
  const propertyRequests = items.filter((item) => item.content_type === "property_request");

  return {
    area_id: args.areaId,
    locale,
    items,
    company_profiles: companyProfiles,
    property_offers: propertyOffers,
    property_requests: propertyRequests,
  };
}
