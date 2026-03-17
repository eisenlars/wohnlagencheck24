// lib/angebote.ts
import { createClient } from "@/utils/supabase/server";
import { toNumberOrNull } from "@/utils/toNumberOrNull";
import { normalizePublicLocale } from "@/lib/public-locale-routing";

export type OfferMode = "kauf" | "miete";
export type OfferObjectType = "haus" | "wohnung";

export type Offer = {
  id: string;
  partnerId: string;
  areaId: string;
  offerType: OfferMode;
  objectType: OfferObjectType | string;
  title: string;
  price: number | null;
  rent: number | null;
  areaSqm: number | null;
  rooms: number | null;
  address: string | null;
  imageUrl: string | null;
  detailUrl: string | null;
  isTop: boolean;
  updatedAt: string | null;
  raw?: Record<string, unknown> | null;
  externalId?: string | null;
  source?: string | null;
};

export type OfferOverrides = {
  partner_id: string;
  source: string;
  external_id: string;
  is_active_override?: boolean | null;
  is_top_override?: boolean | null;
  seo_title?: string | null;
  seo_description?: string | null;
  seo_h1?: string | null;
  short_description?: string | null;
  long_description?: string | null;
  location_text?: string | null;
  features_text?: string | null;
  highlights?: string[] | null;
  image_alt_texts?: string[] | null;
  status?: string | null;
};

type GetOffersArgs = {
  bundeslandSlug: string;
  kreisSlug: string;
  mode: OfferMode;
  page?: number;
  pageSize?: number;
  locale?: string;
};

async function getAreaIdsForKreis(
  supabase: ReturnType<typeof createClient>,
  bundeslandSlug: string,
  kreisSlug: string,
): Promise<{ areaId: string | null; areaIds: string[] }> {
  const { data, error } = await supabase
    .from("areas")
    .select("id, slug, parent_slug")
    .eq("bundesland_slug", bundeslandSlug)
    .or(`slug.eq.${kreisSlug},parent_slug.eq.${kreisSlug}`);

  if (error) {
    console.warn("areas lookup (kreis + ort) failed:", error.message);
    return { areaId: null, areaIds: [] };
  }

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const areaIds = rows
    .map((row) => String((row as { id?: string }).id ?? ""))
    .filter(Boolean);
  const kreisAreaId =
    rows.find((row) => String(row.slug ?? "") === kreisSlug)?.id ?? null;
  return { areaId: typeof kreisAreaId === "string" ? kreisAreaId : null, areaIds };
}

type PublicOfferProjectionRow = {
  id?: string | null;
  partner_id?: string | null;
  visible_area_id?: string | null;
  offer_type?: string | null;
  object_type?: string | null;
  title?: string | null;
  price?: number | string | null;
  rent?: number | string | null;
  area_sqm?: number | string | null;
  rooms?: number | string | null;
  address?: string | null;
  image_url?: string | null;
  detail_url?: string | null;
  is_top?: boolean | null;
  source_updated_at?: string | null;
  external_id?: string | null;
  source?: string | null;
  offer_id?: string | null;
};

function mapProjectionRowToOffer(row: PublicOfferProjectionRow, fallbackMode: OfferMode): Offer {
  return {
    id: String(row.offer_id ?? row.id ?? ""),
    partnerId: String(row.partner_id ?? ""),
    areaId: String(row.visible_area_id ?? ""),
    offerType: (row.offer_type as OfferMode) ?? fallbackMode,
    objectType: (row.object_type as OfferObjectType) ?? "wohnung",
    title: String(row.title ?? ""),
    price: toNumberOrNull(row.price),
    rent: toNumberOrNull(row.rent),
    areaSqm: toNumberOrNull(row.area_sqm),
    rooms: toNumberOrNull(row.rooms),
    address: row.address ?? null,
    imageUrl: row.image_url ?? null,
    detailUrl: row.detail_url ?? null,
    isTop: Boolean(row.is_top),
    updatedAt: row.source_updated_at ?? null,
    externalId: row.external_id ?? null,
    source: row.source ?? null,
    raw: null,
  };
}

export async function getOffers(args: GetOffersArgs): Promise<{
  offers: Offer[];
  topOffers: Offer[];
  areaId: string | null;
  total: number;
  totalWithTop: number;
  sourceTotal: number;
  page: number;
  pageSize: number;
}> {
  const supabase = createClient();
  const normalizedLocale = normalizePublicLocale(args.locale);
  const { areaId, areaIds } = await getAreaIdsForKreis(
    supabase,
    args.bundeslandSlug,
    args.kreisSlug,
  );

  if (!areaId) {
    return { offers: [], topOffers: [], areaId: null, total: 0, totalWithTop: 0, sourceTotal: 0, page: 1, pageSize: 12 };
  }

  const pageSize = Math.max(1, Math.min(args.pageSize ?? 12, 48));
  const page = Math.max(1, args.page ?? 1);
  const rangeFrom = (page - 1) * pageSize;
  const rangeTo = rangeFrom + pageSize - 1;

  const projectionFields = [
    "id",
    "partner_id",
    "visible_area_id",
    "offer_id",
    "source",
    "external_id",
    "offer_type",
    "object_type",
    "title",
    "price",
    "rent",
    "area_sqm",
    "rooms",
    "address",
    "image_url",
    "detail_url",
    "is_top",
    "source_updated_at",
  ].join(",");

  const nonTopQuery = await supabase
    .from("public_offer_entries")
    .select(projectionFields, { count: "exact" })
    .in("visible_area_id", areaIds.length > 0 ? areaIds : [areaId])
    .eq("locale", normalizedLocale)
    .eq("offer_type", args.mode)
    .neq("is_top", true)
    .order("source_updated_at", { ascending: false })
    .range(rangeFrom, rangeTo);

  const { data, error, count } = nonTopQuery;
  if (error) {
    console.warn("public_offer_entries fetch failed:", error.message);
    return { offers: [], topOffers: [], areaId, total: 0, totalWithTop: 0, sourceTotal: 0, page, pageSize };
  }

  const offers = ((data ?? []) as PublicOfferProjectionRow[]).map((row) =>
    mapProjectionRowToOffer(row, args.mode),
  );

  const { data: topData, error: topError } = await supabase
    .from("public_offer_entries")
    .select(projectionFields)
    .in("visible_area_id", areaIds.length > 0 ? areaIds : [areaId])
    .eq("locale", normalizedLocale)
    .eq("offer_type", args.mode)
    .eq("is_top", true)
    .order("source_updated_at", { ascending: false })
    .limit(6);

  if (topError) {
    console.warn("public_offer_entries top fetch failed:", topError.message);
  }

  const topOffers = ((topData ?? []) as PublicOfferProjectionRow[]).map((row) =>
    mapProjectionRowToOffer(row, args.mode),
  );

  const { count: topCount, error: topCountError } = await supabase
    .from("public_offer_entries")
    .select("id", { count: "exact", head: true })
    .in("visible_area_id", areaIds.length > 0 ? areaIds : [areaId])
    .eq("locale", normalizedLocale)
    .eq("offer_type", args.mode)
    .eq("is_top", true);

  if (topCountError) {
    console.warn("public_offer_entries top count failed:", topCountError.message);
  }

  let sourceTotal = count ?? offers.length;
  if (normalizedLocale !== "de") {
    const { count: germanSourceCount, error: sourceError } = await supabase
      .from("public_offer_entries")
      .select("id", { count: "exact", head: true })
      .in("visible_area_id", areaIds.length > 0 ? areaIds : [areaId])
      .eq("locale", "de")
      .eq("offer_type", args.mode)
      .neq("is_top", true);
    if (sourceError) {
      console.warn("public_offer_entries source count failed:", sourceError.message);
      sourceTotal = 0;
    } else if (germanSourceCount !== null) {
      sourceTotal = germanSourceCount;
    }
  }

  return {
    offers,
    topOffers,
    areaId,
    total: count ?? offers.length,
    totalWithTop: (count ?? offers.length) + (topCount ?? topOffers.length),
    sourceTotal,
    page,
    pageSize,
  };
}

export async function getOfferById(offerId: string): Promise<Offer | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("partner_property_offers")
    .select(
      [
        "id",
        "partner_id",
        "area_id",
        "offer_type",
        "object_type",
        "title",
        "price",
        "rent",
        "area_sqm",
        "rooms",
        "address",
        "image_url",
        "detail_url",
        "is_top",
        "updated_at",
        "external_id",
        "source",
        "raw",
      ].join(","),
    )
    .eq("id", offerId)
    .maybeSingle();

  if (error) {
    console.warn("partner_property_offers by id failed:", error.message);
    return null;
  }
  if (!data) return null;

  const record = data as unknown as Record<string, unknown>;
  return {
    id: String(record["id"] ?? ""),
    partnerId: String(record["partner_id"] ?? ""),
    areaId: String(record["area_id"] ?? ""),
    offerType: (record["offer_type"] as OfferMode) ?? "kauf",
    objectType: (record["object_type"] as OfferObjectType) ?? "wohnung",
    title: String(record["title"] ?? ""),
    price: toNumberOrNull(record["price"]),
    rent: toNumberOrNull(record["rent"]),
    areaSqm: toNumberOrNull(record["area_sqm"]),
    rooms: toNumberOrNull(record["rooms"]),
    address: (record["address"] as string | null) ?? null,
    imageUrl: (record["image_url"] as string | null) ?? null,
    detailUrl: (record["detail_url"] as string | null) ?? null,
    isTop: Boolean(record["is_top"]),
    updatedAt: (record["updated_at"] as string | null) ?? null,
    externalId: (record["external_id"] as string | null) ?? null,
    source: (record["source"] as string | null) ?? null,
    raw: (record["raw"] as Record<string, unknown> | null) ?? null,
  };
}

export async function getOfferOverrides(
  partnerId: string,
  source: string,
  externalId: string,
): Promise<OfferOverrides | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("partner_property_overrides")
    .select(
      [
        "partner_id",
        "source",
        "external_id",
        "is_active_override",
        "is_top_override",
        "seo_title",
        "seo_description",
        "seo_h1",
        "short_description",
        "long_description",
        "location_text",
        "features_text",
        "highlights",
        "image_alt_texts",
        "status",
      ].join(","),
    )
    .eq("partner_id", partnerId)
    .eq("source", source)
    .eq("external_id", externalId)
    .maybeSingle();

  if (error) {
    console.warn("partner_property_overrides fetch failed:", error.message);
    return null;
  }
  return (data as unknown as OfferOverrides) ?? null;
}
