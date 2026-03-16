// lib/angebote.ts

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { toNumberOrNull } from "@/utils/toNumberOrNull";
import { loadPublicVisiblePartnerIdsForAreaIds } from "@/lib/public-partner-mappings";
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

type OfferTranslationRow = {
  offer_id?: string | null;
  translated_seo_title?: string | null;
  translated_seo_h1?: string | null;
  status?: string | null;
};

function resolveLocalizedOfferTitle(
  originalTitle: string,
  override: OfferOverrides | undefined,
  translation: OfferTranslationRow | undefined,
): string {
  const translatedTitle =
    String(translation?.translated_seo_h1 ?? "").trim()
    || String(translation?.translated_seo_title ?? "").trim();
  if (translatedTitle) return translatedTitle;
  return (override?.seo_h1 ?? originalTitle) || originalTitle;
}

async function loadOfferTranslations(
  offerIds: string[],
  locale: string,
): Promise<Map<string, OfferTranslationRow>> {
  const normalizedLocale = normalizePublicLocale(locale);
  if (normalizedLocale === "de" || offerIds.length === 0) return new Map();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("partner_property_offer_i18n")
    .select("offer_id, translated_seo_title, translated_seo_h1, status")
    .in("offer_id", offerIds)
    .eq("target_locale", normalizedLocale)
    .eq("status", "approved");

  if (error) {
    console.warn("partner_property_offer_i18n fetch failed:", error.message);
    return new Map();
  }

  const out = new Map<string, OfferTranslationRow>();
  for (const row of (data ?? []) as OfferTranslationRow[]) {
    const offerId = String(row.offer_id ?? "").trim();
    if (!offerId) continue;
    out.set(offerId, row);
  }
  return out;
}

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

async function getPublicVisiblePartnerIdsForAreas(
  supabase: ReturnType<typeof createClient>,
  areaIds: string[],
): Promise<string[]> {
  if (areaIds.length === 0) return [];
  try {
    return await loadPublicVisiblePartnerIdsForAreaIds(supabase, areaIds);
  } catch (error) {
    console.warn("partner_area_map public visibility lookup failed:", error);
    return [];
  }
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
  const normalizedLocale = normalizePublicLocale(args.locale);
  const areaId = await getKreisAreaId(supabase, args.bundeslandSlug, args.kreisSlug);
  const areaIds = await getAreaIdsForKreis(supabase, args.bundeslandSlug, args.kreisSlug);

  if (!areaId) {
    return { offers: [], topOffers: [], areaId: null, total: 0, totalWithTop: 0, page: 1, pageSize: 12 };
  }

  const partnerIds = await getPublicVisiblePartnerIdsForAreas(
    supabase,
    areaIds.length > 0 ? areaIds : [areaId],
  );
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
    .select(selectFields, { count: normalizedLocale === "de" ? "exact" : "exact" })
    .in("area_id", areaIds.length > 0 ? areaIds : [areaId])
    .eq("offer_type", args.mode)
    .neq("is_top", true)
    .order("updated_at", { ascending: false });

  if (partnerIds.length > 0) {
    query = query.in("partner_id", partnerIds);
  }

  if (normalizedLocale === "de") {
    query = query.range(rangeFrom, rangeTo);
  } else {
    query = query.limit(200);
  }

  const { data, error, count } = await query;

  if (error) {
    console.warn("partner_property_offers fetch failed:", error.message);
    return { offers: [], topOffers: [], areaId, total: 0, totalWithTop: 0, page, pageSize };
  }

  const offers = (data ?? []).map((row) => {
    const record = row as unknown as Record<string, unknown>;
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

  const overridesMap = new Map<string, OfferOverrides>();
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
        const record = row as unknown as Record<string, unknown>;
        const key = `${String(record["partner_id"] ?? "")}::${String(record["source"] ?? "")}::${String(
          record["external_id"] ?? "",
        )}`;
        if (key.includes("::")) {
          overridesMap.set(key, row as unknown as OfferOverrides);
        }
      });
    }
  }

  const translationsMap = await loadOfferTranslations(
    offers.map((offer) => offer.id),
    normalizedLocale,
  );

  const offersWithOverrides = offers.map((offer) => {
    const effectiveSource = (offer.source ?? "").trim() || "manual";
    const effectiveExternalId = (offer.externalId ?? "").trim() || offer.id;
    const key = `${offer.partnerId}::${effectiveSource}::${effectiveExternalId}`;
    const override = overridesMap.get(key);
    const translation = translationsMap.get(offer.id);
    const title = resolveLocalizedOfferTitle(offer.title, override, translation);
    return { ...offer, title };
  });
  const localizedOffers = normalizedLocale === "de"
    ? offersWithOverrides
    : offersWithOverrides.filter((offer) => translationsMap.has(offer.id));

  let topOffers: Offer[] = localizedOffers.filter((offer) => offer.isTop);
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
      .limit(normalizedLocale === "de" ? 6 : 60);

    if (partnerIds.length > 0) {
      topQuery = topQuery.in("partner_id", partnerIds);
    }

    const { data: topData, error: topError } = await topQuery;
    if (topError) {
      console.warn("partner_property_offers top fetch failed:", topError.message);
    } else {
      const topMapped = (topData ?? []).map((row) => {
        const record = row as unknown as Record<string, unknown>;
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

      const missingTopIds = topMapped
        .map((offer) => offer.id)
        .filter((offerId) => offerId && !translationsMap.has(offerId));
      if (missingTopIds.length > 0) {
        const topTranslations = await loadOfferTranslations(missingTopIds, normalizedLocale);
        topTranslations.forEach((value, key) => translationsMap.set(key, value));
      }

      topOffers = topMapped.map((offer) => {
        const effectiveSource = (offer.source ?? "").trim() || "manual";
        const effectiveExternalId = (offer.externalId ?? "").trim() || offer.id;
        const key = `${offer.partnerId}::${effectiveSource}::${effectiveExternalId}`;
        const override = overridesMap.get(key);
        const translation = translationsMap.get(offer.id);
        const title = resolveLocalizedOfferTitle(offer.title, override, translation);
        return { ...offer, title };
      }).filter((offer) => normalizedLocale === "de" || translationsMap.has(offer.id))
        .slice(0, 6);
      topCount = topOffers.length;
      topOffers.forEach((offer) => topIds.add(offer.id));
    }
  }

  if (topIds.size > 0 && normalizedLocale === "de") {
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

  const pagedOffers = normalizedLocale === "de"
    ? localizedOffers
    : localizedOffers.slice(rangeFrom, rangeTo + 1);

  return {
    offers: pagedOffers,
    topOffers,
    areaId,
    total: normalizedLocale === "de" ? (count ?? localizedOffers.length) : localizedOffers.length,
    totalWithTop: (normalizedLocale === "de" ? (count ?? localizedOffers.length) : localizedOffers.length) + topCount,
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
