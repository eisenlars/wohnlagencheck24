// lib/angebote.ts

import { createClient } from "@/utils/supabase/server";
import { toNumberOrNull } from "@/utils/toNumberOrNull";

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
};

async function getKreisAreaId(
  supabase: ReturnType<typeof createClient>,
  bundeslandSlug: string,
  kreisSlug: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("areas")
    .select("id")
    .eq("slug", kreisSlug)
    .eq("bundesland_slug", bundeslandSlug)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("areas lookup failed:", error.message);
    return null;
  }
  return data?.id ?? null;
}

async function getAreaIdsForKreis(
  supabase: ReturnType<typeof createClient>,
  bundeslandSlug: string,
  kreisSlug: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("areas")
    .select("id, parent_slug")
    .eq("bundesland_slug", bundeslandSlug)
    .or(`slug.eq.${kreisSlug},parent_slug.eq.${kreisSlug}`);

  if (error) {
    console.warn("areas lookup (kreis + ort) failed:", error.message);
    return [];
  }

  return (data ?? [])
    .map((row) => String((row as { id?: string }).id ?? ""))
    .filter(Boolean);
}

async function getActivePartnerIds(
  supabase: ReturnType<typeof createClient>,
  areaId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("partner_area_map")
    .select("auth_user_id")
    .eq("area_id", areaId)
    .eq("is_active", true);

  if (error) {
    console.warn("partner_area_map lookup failed:", error.message);
    return [];
  }
  return (data ?? [])
    .map((row) => String((row as { auth_user_id?: string }).auth_user_id ?? ""))
    .filter(Boolean);
}

async function getActivePartnerIdsForAreas(
  supabase: ReturnType<typeof createClient>,
  areaIds: string[],
): Promise<string[]> {
  if (areaIds.length === 0) return [];
  const { data, error } = await supabase
    .from("partner_area_map")
    .select("auth_user_id")
    .in("area_id", areaIds)
    .eq("is_active", true);

  if (error) {
    console.warn("partner_area_map lookup (multi) failed:", error.message);
    return [];
  }
  return (data ?? [])
    .map((row) => String((row as { auth_user_id?: string }).auth_user_id ?? ""))
    .filter(Boolean);
}

export async function getOffers(args: GetOffersArgs): Promise<{
  offers: Offer[];
  topOffers: Offer[];
  areaId: string | null;
  total: number;
  totalWithTop: number;
  page: number;
  pageSize: number;
}> {
  const supabase = createClient();
  const areaId = await getKreisAreaId(supabase, args.bundeslandSlug, args.kreisSlug);
  const areaIds = await getAreaIdsForKreis(supabase, args.bundeslandSlug, args.kreisSlug);

  if (!areaId) {
    return { offers: [], topOffers: [], areaId: null, total: 0, totalWithTop: 0, page: 1, pageSize: 12 };
  }

  const partnerIds =
    areaIds.length > 0
      ? await getActivePartnerIdsForAreas(supabase, areaIds)
      : await getActivePartnerIds(supabase, areaId);
  const pageSize = Math.max(1, Math.min(args.pageSize ?? 12, 48));
  const page = Math.max(1, args.page ?? 1);
  const rangeFrom = (page - 1) * pageSize;
  const rangeTo = rangeFrom + pageSize - 1;

  const selectFields = [
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
  ].join(",");

  let query = supabase
    .from("partner_property_offers")
    .select(selectFields, { count: "exact" })
    .in("area_id", areaIds.length > 0 ? areaIds : [areaId])
    .eq("offer_type", args.mode)
    .neq("is_top", true)
    .order("updated_at", { ascending: false })
    .range(rangeFrom, rangeTo);

  if (partnerIds.length > 0) {
    query = query.in("partner_id", partnerIds);
  }

  const { data, error, count } = await query;

  if (error) {
    console.warn("partner_property_offers fetch failed:", error.message);
    return { offers: [], topOffers: [], areaId, total: 0, page, pageSize };
  }

  const offers = (data ?? []).map((row) => {
    const record = row as Record<string, unknown>;
    return {
      id: String(record["id"] ?? ""),
      partnerId: String(record["partner_id"] ?? ""),
      areaId: String(record["area_id"] ?? ""),
      offerType: (record["offer_type"] as OfferMode) ?? args.mode,
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
    } satisfies Offer;
  });

  const overrideKeys = offers
    .map((offer) => {
      const effectiveSource = (offer.source ?? "").trim() || "manual";
      const effectiveExternalId = (offer.externalId ?? "").trim() || offer.id;
      return `${offer.partnerId}::${effectiveSource}::${effectiveExternalId}`;
    })
    .filter(Boolean);

  let overridesMap = new Map<string, OfferOverrides>();
  if (overrideKeys.length > 0) {
    const { data: overridesData, error: overridesError } = await supabase
      .from("partner_property_overrides")
      .select(
        [
          "partner_id",
          "source",
          "external_id",
          "seo_title",
          "seo_h1",
        ].join(","),
      )
      .in(
        "partner_id",
        offers.map((offer) => offer.partnerId),
      );

    if (overridesError) {
      console.warn("partner_property_overrides fetch failed:", overridesError.message);
    } else {
      (overridesData ?? []).forEach((row) => {
        const record = row as Record<string, unknown>;
        const key = `${String(record["partner_id"] ?? "")}::${String(record["source"] ?? "")}::${String(
          record["external_id"] ?? "",
        )}`;
        if (key.includes("::")) {
          overridesMap.set(key, row as OfferOverrides);
        }
      });
    }
  }

  const offersWithOverrides = offers.map((offer) => {
    const effectiveSource = (offer.source ?? "").trim() || "manual";
    const effectiveExternalId = (offer.externalId ?? "").trim() || offer.id;
    const key = `${offer.partnerId}::${effectiveSource}::${effectiveExternalId}`;
    const override = overridesMap.get(key);
    const title = (override?.seo_h1 ?? offer.title) || offer.title;
    return { ...offer, title };
  });

  let topOffers: Offer[] = offersWithOverrides.filter((offer) => offer.isTop);
  const topIds = new Set<string>(topOffers.map((offer) => offer.id));
  let topCount = topOffers.length;
  {
    let topQuery = supabase
      .from("partner_property_offers")
      .select(selectFields)
      .in("area_id", areaIds.length > 0 ? areaIds : [areaId])
      .eq("offer_type", args.mode)
      .eq("is_top", true)
      .order("updated_at", { ascending: false })
      .limit(6);

    if (partnerIds.length > 0) {
      topQuery = topQuery.in("partner_id", partnerIds);
    }

    const { data: topData, error: topError } = await topQuery;
    if (topError) {
      console.warn("partner_property_offers top fetch failed:", topError.message);
    } else {
      const topMapped = (topData ?? []).map((row) => {
        const record = row as Record<string, unknown>;
        return {
          id: String(record["id"] ?? ""),
          partnerId: String(record["partner_id"] ?? ""),
          areaId: String(record["area_id"] ?? ""),
          offerType: (record["offer_type"] as OfferMode) ?? args.mode,
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
        } satisfies Offer;
      });

      topOffers = topMapped.map((offer) => {
        const effectiveSource = (offer.source ?? "").trim() || "manual";
        const effectiveExternalId = (offer.externalId ?? "").trim() || offer.id;
        const key = `${offer.partnerId}::${effectiveSource}::${effectiveExternalId}`;
        const override = overridesMap.get(key);
        const title = (override?.seo_h1 ?? offer.title) || offer.title;
        return { ...offer, title };
      });
      topCount = topOffers.length;
      topOffers.forEach((offer) => topIds.add(offer.id));
    }
  }

  if (topIds.size > 0) {
    let countQuery = supabase
      .from("partner_property_offers")
      .select("id", { count: "exact", head: true })
      .in("area_id", areaIds.length > 0 ? areaIds : [areaId])
      .eq("offer_type", args.mode)
      .eq("is_top", true);

    if (partnerIds.length > 0) {
      countQuery = countQuery.in("partner_id", partnerIds);
    }

    const { count: explicitTopCount, error: countError } = await countQuery;
    if (countError) {
      console.warn("partner_property_offers top count failed:", countError.message);
    } else if (explicitTopCount !== null) {
      topCount = explicitTopCount;
    }
  }

  return {
    offers: offersWithOverrides,
    topOffers,
    areaId,
    total: count ?? offersWithOverrides.length,
    totalWithTop: (count ?? offersWithOverrides.length) + topCount,
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

  const record = data as Record<string, unknown>;
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
  return (data as OfferOverrides) ?? null;
}
