import { createAdminClient } from "@/utils/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

type ProjectionCounts = {
  offers: number;
  requests: number;
  references: number;
};

type PartnerAreaMapRow = {
  area_id?: string | null;
};

type OfferRow = {
  id?: string | null;
  partner_id?: string | null;
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
  updated_at?: string | null;
  source?: string | null;
  external_id?: string | null;
};

type OfferOverrideRow = {
  partner_id?: string | null;
  source?: string | null;
  external_id?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  seo_h1?: string | null;
  short_description?: string | null;
  long_description?: string | null;
  location_text?: string | null;
  features_text?: string | null;
  highlights?: unknown;
  image_alt_texts?: unknown;
};

type OfferI18nRow = {
  offer_id?: string | null;
  target_locale?: string | null;
  translated_seo_title?: string | null;
  translated_seo_description?: string | null;
  translated_seo_h1?: string | null;
  translated_short_description?: string | null;
  translated_long_description?: string | null;
  translated_location_text?: string | null;
  translated_features_text?: string | null;
  translated_highlights?: unknown;
  translated_image_alt_texts?: unknown;
};

type RequestRow = {
  id?: string | null;
  partner_id?: string | null;
  provider?: string | null;
  external_id?: string | null;
  title?: string | null;
  source_updated_at?: string | null;
  updated_at?: string | null;
  normalized_payload?: Record<string, unknown> | null;
};

type RequestOverrideRow = {
  partner_id?: string | null;
  source?: string | null;
  external_id?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  seo_h1?: string | null;
  short_description?: string | null;
  long_description?: string | null;
  location_text?: string | null;
  features_text?: string | null;
  highlights?: unknown;
  image_alt_texts?: unknown;
};

type RequestI18nRow = {
  request_id?: string | null;
  target_locale?: string | null;
  translated_seo_title?: string | null;
  translated_seo_description?: string | null;
  translated_seo_h1?: string | null;
  translated_short_description?: string | null;
  translated_long_description?: string | null;
  translated_location_text?: string | null;
  translated_features_text?: string | null;
  translated_highlights?: unknown;
  translated_image_alt_texts?: unknown;
};

type ReferenceRow = {
  id?: string | null;
  partner_id?: string | null;
  provider?: string | null;
  external_id?: string | null;
  title?: string | null;
  source_updated_at?: string | null;
  updated_at?: string | null;
  normalized_payload?: Record<string, unknown> | null;
};

type ReferenceOverrideRow = {
  partner_id?: string | null;
  source?: string | null;
  external_id?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  seo_h1?: string | null;
  short_description?: string | null;
  long_description?: string | null;
  location_text?: string | null;
  features_text?: string | null;
  highlights?: unknown;
  image_alt_texts?: unknown;
};

type ReferenceI18nRow = {
  reference_id?: string | null;
  target_locale?: string | null;
  translated_seo_title?: string | null;
  translated_seo_description?: string | null;
  translated_seo_h1?: string | null;
  translated_short_description?: string | null;
  translated_long_description?: string | null;
  translated_location_text?: string | null;
  translated_features_text?: string | null;
  translated_highlights?: unknown;
  translated_image_alt_texts?: unknown;
};

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNullableText(value: unknown): string | null {
  const text = asText(value);
  return text.length > 0 ? text : null;
}

function asNumberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asArrayJson(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  return [];
}

function parseRegionTargets(payload: Record<string, unknown>): Array<{ city: string; district: string | null; label: string }> {
  const raw = payload["region_targets"];
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => {
      const obj = entry as Record<string, unknown>;
      const city = asText(obj["city"]);
      const district = asNullableText(obj["district"]);
      const label = asText(obj["label"]) || [city, district].filter(Boolean).join(" ");
      return { city, district, label };
    })
    .filter((entry) => entry.city.length > 0 || entry.label.length > 0);
}

function parseRegionTargetKeys(payload: Record<string, unknown>): string[] {
  const raw = payload["region_target_keys"];
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => asText(entry).toLowerCase()).filter(Boolean);
}

function groupByKey<T>(rows: T[], buildKey: (row: T) => string): Map<string, T> {
  const map = new Map<string, T>();
  for (const row of rows) {
    const key = buildKey(row);
    if (!key) continue;
    map.set(key, row);
  }
  return map;
}

function groupTranslationsByEntityId<T>(
  rows: T[],
  getEntityId: (row: T) => string,
  getLocale: (row: T) => string,
): Map<string, Array<{ locale: string; row: T }>> {
  const map = new Map<string, Array<{ locale: string; row: T }>>();
  for (const row of rows) {
    const entityId = getEntityId(row);
    const locale = getLocale(row);
    if (!entityId || !locale) continue;
    const bucket = map.get(entityId) ?? [];
    bucket.push({ locale, row });
    map.set(entityId, bucket);
  }
  return map;
}

function buildCompositeKey(row: Record<string, unknown>, columns: string[]): string {
  return columns.map((column) => String(row[column] ?? "")).join("::");
}

function normalizeComparableValue(value: unknown): unknown {
  if (value === undefined) return null;
  if (Array.isArray(value)) return value.map((entry) => normalizeComparableValue(entry));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, normalizeComparableValue(entry)]),
    );
  }
  return value;
}

function buildComparableSnapshot(row: Record<string, unknown>, columns: string[]): string {
  const payload = Object.fromEntries(
    columns.map((column) => [column, normalizeComparableValue(row[column])]),
  );
  return JSON.stringify(payload);
}

function chunkRows<T>(rows: T[], size = 250): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) {
    out.push(rows.slice(i, i + size));
  }
  return out;
}

async function reconcileProjectionRows(args: {
  admin: AdminClient;
  table: "public_offer_entries" | "public_request_entries" | "public_reference_entries";
  partnerId: string;
  rows: Array<Record<string, unknown>>;
  uniqueColumns: string[];
  compareColumns: string[];
}): Promise<number> {
  const { admin, table, partnerId, rows, uniqueColumns, compareColumns } = args;
  const selectColumns = Array.from(new Set(["id", ...uniqueColumns, ...compareColumns]));
  const { data, error } = await admin
    .from(table)
    .select(selectColumns.join(","))
    .eq("partner_id", partnerId);

  if (error) throw new Error(`${table} existing lookup failed: ${error.message}`);

  const existingRows = (Array.isArray(data) ? data : []) as unknown as Array<Record<string, unknown>>;
  const existingByKey = new Map<string, Record<string, unknown>>();
  for (const row of existingRows) {
    existingByKey.set(buildCompositeKey(row, uniqueColumns), row);
  }

  const desiredByKey = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    desiredByKey.set(buildCompositeKey(row, uniqueColumns), row);
  }

  const writeRows: Array<Record<string, unknown>> = [];
  for (const [key, row] of desiredByKey.entries()) {
    const existing = existingByKey.get(key);
    if (!existing) {
      writeRows.push(row);
      continue;
    }

    const existingSnapshot = buildComparableSnapshot(existing, compareColumns);
    const desiredSnapshot = buildComparableSnapshot(row, compareColumns);
    if (existingSnapshot !== desiredSnapshot) {
      writeRows.push(row);
    }
  }

  const staleIds = existingRows
    .filter((row) => !desiredByKey.has(buildCompositeKey(row, uniqueColumns)))
    .map((row) => asText(row.id))
    .filter(Boolean);

  for (const chunk of chunkRows(staleIds)) {
    const { error: deleteError } = await admin.from(table).delete().in("id", chunk);
    if (deleteError) throw new Error(`${table} stale delete failed: ${deleteError.message}`);
  }

  for (const chunk of chunkRows(writeRows)) {
    const { error: upsertError } = await admin.from(table).upsert(chunk, {
      onConflict: uniqueColumns.join(","),
    });
    if (upsertError) throw new Error(`${table} upsert failed: ${upsertError.message}`);
  }

  return desiredByKey.size;
}

async function loadPublicLiveAreaIdsForPartner(admin: AdminClient, partnerId: string): Promise<string[]> {
  const { data, error } = await admin
    .from("partner_area_map")
    .select("area_id")
    .eq("auth_user_id", partnerId)
    .eq("is_public_live", true);

  if (error) throw new Error(`partner_area_map lookup failed: ${error.message}`);
  return Array.from(
    new Set(((data ?? []) as PartnerAreaMapRow[]).map((row) => asText(row.area_id)).filter(Boolean)),
  );
}

export async function rebuildPublicOfferEntriesForPartner(
  partnerId: string,
  admin = createAdminClient(),
): Promise<number> {
  const visibleAreaIds = await loadPublicLiveAreaIdsForPartner(admin, partnerId);
  if (visibleAreaIds.length === 0) {
    return reconcileProjectionRows({
      admin,
      table: "public_offer_entries",
      partnerId,
      rows: [],
      uniqueColumns: ["partner_id", "offer_id", "visible_area_id", "locale"],
      compareColumns: [
        "source",
        "external_id",
        "offer_type",
        "object_type",
        "title",
        "seo_title",
        "seo_description",
        "seo_h1",
        "short_description",
        "long_description",
        "location_text",
        "features_text",
        "highlights",
        "image_alt_texts",
        "price",
        "rent",
        "area_sqm",
        "rooms",
        "address",
        "image_url",
        "detail_url",
        "is_top",
        "is_live",
        "source_updated_at",
      ],
    });
  }

  const [offersRes, overridesRes, i18nRes] = await Promise.all([
    admin
      .from("partner_property_offers")
      .select("id, partner_id, offer_type, object_type, title, price, rent, area_sqm, rooms, address, image_url, detail_url, is_top, updated_at, source, external_id")
      .eq("partner_id", partnerId),
    admin
      .from("partner_property_overrides")
      .select("partner_id, source, external_id, seo_title, seo_description, seo_h1, short_description, long_description, location_text, features_text, highlights, image_alt_texts")
      .eq("partner_id", partnerId),
    admin
      .from("partner_property_offer_i18n")
      .select("offer_id, target_locale, translated_seo_title, translated_seo_description, translated_seo_h1, translated_short_description, translated_long_description, translated_location_text, translated_features_text, translated_highlights, translated_image_alt_texts")
      .eq("partner_id", partnerId)
      .eq("status", "approved"),
  ]);

  if (offersRes.error) throw new Error(`partner_property_offers lookup failed: ${offersRes.error.message}`);
  if (overridesRes.error) throw new Error(`partner_property_overrides lookup failed: ${overridesRes.error.message}`);
  if (i18nRes.error) throw new Error(`partner_property_offer_i18n lookup failed: ${i18nRes.error.message}`);

  const offers = (offersRes.data ?? []) as OfferRow[];
  const overridesByKey = groupByKey(
    (overridesRes.data ?? []) as OfferOverrideRow[],
    (row) => `${asText(row.partner_id)}::${asText(row.source)}::${asText(row.external_id)}`,
  );
  const translationsByEntityId = groupTranslationsByEntityId(
    (i18nRes.data ?? []) as OfferI18nRow[],
    (row) => asText(row.offer_id),
    (row) => asText(row.target_locale).toLowerCase(),
  );

  const projectionRows: Array<Record<string, unknown>> = [];
  const rebuildTimestamp = new Date().toISOString();
  for (const offer of offers) {
    const offerId = asText(offer.id);
    const source = asText(offer.source) || "manual";
    const externalId = asText(offer.external_id) || offerId;
    if (!offerId) continue;

    const override = overridesByKey.get(`${partnerId}::${source}::${externalId}`);
    for (const visibleAreaId of visibleAreaIds) {
      projectionRows.push({
        partner_id: partnerId,
        visible_area_id: visibleAreaId,
        locale: "de",
        offer_id: offerId,
        source,
        external_id: externalId,
        offer_type: asText(offer.offer_type),
        object_type: asNullableText(offer.object_type),
        title: asNullableText(override?.seo_h1) ?? asNullableText(offer.title),
        seo_title: asNullableText(override?.seo_title),
        seo_description: asNullableText(override?.seo_description),
        seo_h1: asNullableText(override?.seo_h1),
        short_description: asNullableText(override?.short_description),
        long_description: asNullableText(override?.long_description),
        location_text: asNullableText(override?.location_text),
        features_text: asNullableText(override?.features_text),
        highlights: asArrayJson(override?.highlights),
        image_alt_texts: asArrayJson(override?.image_alt_texts),
        price: asNumberOrNull(offer.price),
        rent: asNumberOrNull(offer.rent),
        area_sqm: asNumberOrNull(offer.area_sqm),
        rooms: asNumberOrNull(offer.rooms),
        address: asNullableText(offer.address),
        image_url: asNullableText(offer.image_url),
        detail_url: asNullableText(offer.detail_url),
        is_top: Boolean(offer.is_top),
        is_live: true,
        source_updated_at: asNullableText(offer.updated_at),
        updated_at: rebuildTimestamp,
      });

      for (const translationEntry of translationsByEntityId.get(offerId) ?? []) {
        const { locale, row: translation } = translationEntry;
        const translatedTitle =
          asNullableText(translation.translated_seo_h1) ?? asNullableText(translation.translated_seo_title);
        if (!translatedTitle) continue;
        projectionRows.push({
          partner_id: partnerId,
          visible_area_id: visibleAreaId,
          locale,
          offer_id: offerId,
          source,
          external_id: externalId,
          offer_type: asText(offer.offer_type),
          object_type: asNullableText(offer.object_type),
          title: translatedTitle,
          seo_title: asNullableText(translation.translated_seo_title),
          seo_description: asNullableText(translation.translated_seo_description),
          seo_h1: asNullableText(translation.translated_seo_h1),
          short_description: asNullableText(translation.translated_short_description),
          long_description: asNullableText(translation.translated_long_description),
          location_text: asNullableText(translation.translated_location_text),
          features_text: asNullableText(translation.translated_features_text),
          highlights: asArrayJson(translation.translated_highlights),
          image_alt_texts: asArrayJson(translation.translated_image_alt_texts),
          price: asNumberOrNull(offer.price),
          rent: asNumberOrNull(offer.rent),
          area_sqm: asNumberOrNull(offer.area_sqm),
          rooms: asNumberOrNull(offer.rooms),
          address: asNullableText(offer.address),
          image_url: asNullableText(offer.image_url),
          detail_url: asNullableText(offer.detail_url),
          is_top: Boolean(offer.is_top),
          is_live: true,
          source_updated_at: asNullableText(offer.updated_at),
          updated_at: rebuildTimestamp,
        });
      }
    }
  }

  return reconcileProjectionRows({
    admin,
    table: "public_offer_entries",
    partnerId,
    rows: projectionRows,
    uniqueColumns: ["partner_id", "offer_id", "visible_area_id", "locale"],
    compareColumns: [
      "source",
      "external_id",
      "offer_type",
      "object_type",
      "title",
      "seo_title",
      "seo_description",
      "seo_h1",
      "short_description",
      "long_description",
      "location_text",
      "features_text",
      "highlights",
      "image_alt_texts",
      "price",
      "rent",
      "area_sqm",
      "rooms",
      "address",
      "image_url",
      "detail_url",
      "is_top",
      "is_live",
      "source_updated_at",
    ],
  });
}

export async function rebuildPublicRequestEntriesForPartner(
  partnerId: string,
  admin = createAdminClient(),
): Promise<number> {
  const visibleAreaIds = await loadPublicLiveAreaIdsForPartner(admin, partnerId);
  if (visibleAreaIds.length === 0) {
    return reconcileProjectionRows({
      admin,
      table: "public_request_entries",
      partnerId,
      rows: [],
      uniqueColumns: ["partner_id", "request_id", "visible_area_id", "locale"],
      compareColumns: [
        "provider",
        "external_id",
        "request_type",
        "object_type",
        "title",
        "seo_title",
        "seo_description",
        "seo_h1",
        "short_description",
        "long_description",
        "location_text",
        "features_text",
        "highlights",
        "image_alt_texts",
        "min_rooms",
        "max_price",
        "region_targets",
        "region_target_keys",
        "is_live",
        "source_updated_at",
      ],
    });
  }

  const [requestsRes, overridesRes, i18nRes] = await Promise.all([
    admin
      .from("partner_requests")
      .select("id, partner_id, provider, external_id, title, source_updated_at, updated_at, normalized_payload")
      .eq("partner_id", partnerId)
      .eq("is_active", true),
    admin
      .from("partner_request_overrides")
      .select("partner_id, source, external_id, seo_title, seo_description, seo_h1, short_description, long_description, location_text, features_text, highlights, image_alt_texts")
      .eq("partner_id", partnerId),
    admin
      .from("partner_request_i18n")
      .select("request_id, target_locale, translated_seo_title, translated_seo_description, translated_seo_h1, translated_short_description, translated_long_description, translated_location_text, translated_features_text, translated_highlights, translated_image_alt_texts")
      .eq("partner_id", partnerId)
      .eq("status", "approved"),
  ]);

  if (requestsRes.error) throw new Error(`partner_requests lookup failed: ${requestsRes.error.message}`);
  if (overridesRes.error) throw new Error(`partner_request_overrides lookup failed: ${overridesRes.error.message}`);
  if (i18nRes.error) throw new Error(`partner_request_i18n lookup failed: ${i18nRes.error.message}`);

  const requests = (requestsRes.data ?? []) as RequestRow[];
  const overridesByKey = groupByKey(
    (overridesRes.data ?? []) as RequestOverrideRow[],
    (row) => `${asText(row.partner_id)}::${asText(row.source)}::${asText(row.external_id)}`,
  );
  const translationsByEntityId = groupTranslationsByEntityId(
    (i18nRes.data ?? []) as RequestI18nRow[],
    (row) => asText(row.request_id),
    (row) => asText(row.target_locale).toLowerCase(),
  );

  const projectionRows: Array<Record<string, unknown>> = [];
  const rebuildTimestamp = new Date().toISOString();
  for (const request of requests) {
    const requestId = asText(request.id);
    const provider = asText(request.provider);
    const externalId = asText(request.external_id);
    if (!requestId || !provider || !externalId) continue;
    const payload = (request.normalized_payload ?? {}) as Record<string, unknown>;
    const override = overridesByKey.get(`${partnerId}::${provider}::${externalId}`);
    const requestType = asText(payload["request_type"]) || "kauf";
    const objectType = asNullableText(payload["object_type"]);
    const minRooms = asNumberOrNull(payload["min_rooms"]);
    const maxPrice = asNumberOrNull(payload["max_price"]);
    const regionTargets = parseRegionTargets(payload);
    const regionTargetKeys = parseRegionTargetKeys(payload);

    for (const visibleAreaId of visibleAreaIds) {
      projectionRows.push({
        partner_id: partnerId,
        visible_area_id: visibleAreaId,
        locale: "de",
        request_id: requestId,
        provider,
        external_id: externalId,
        request_type: requestType,
        object_type: objectType,
        title: asNullableText(override?.seo_h1) ?? asNullableText(override?.seo_title) ?? asNullableText(request.title),
        seo_title: asNullableText(override?.seo_title),
        seo_description: asNullableText(override?.seo_description),
        seo_h1: asNullableText(override?.seo_h1),
        short_description: asNullableText(override?.short_description),
        long_description: asNullableText(override?.long_description),
        location_text: asNullableText(override?.location_text),
        features_text: asNullableText(override?.features_text),
        highlights: asArrayJson(override?.highlights),
        image_alt_texts: asArrayJson(override?.image_alt_texts),
        min_rooms: minRooms,
        max_price: maxPrice,
        region_targets: regionTargets,
        region_target_keys: regionTargetKeys,
        is_live: true,
        source_updated_at: asNullableText(request.source_updated_at) ?? asNullableText(request.updated_at),
        updated_at: rebuildTimestamp,
      });

      for (const translationEntry of translationsByEntityId.get(requestId) ?? []) {
        const { locale, row: translation } = translationEntry;
        const translatedTitle =
          asNullableText(translation.translated_seo_h1) ?? asNullableText(translation.translated_seo_title);
        if (!translatedTitle) continue;
        projectionRows.push({
          partner_id: partnerId,
          visible_area_id: visibleAreaId,
          locale,
          request_id: requestId,
          provider,
          external_id: externalId,
          request_type: requestType,
          object_type: objectType,
          title: translatedTitle,
          seo_title: asNullableText(translation.translated_seo_title),
          seo_description: asNullableText(translation.translated_seo_description),
          seo_h1: asNullableText(translation.translated_seo_h1),
          short_description: asNullableText(translation.translated_short_description),
          long_description: asNullableText(translation.translated_long_description),
          location_text: asNullableText(translation.translated_location_text),
          features_text: asNullableText(translation.translated_features_text),
          highlights: asArrayJson(translation.translated_highlights),
          image_alt_texts: asArrayJson(translation.translated_image_alt_texts),
          min_rooms: minRooms,
          max_price: maxPrice,
          region_targets: regionTargets,
          region_target_keys: regionTargetKeys,
          is_live: true,
          source_updated_at: asNullableText(request.source_updated_at) ?? asNullableText(request.updated_at),
          updated_at: rebuildTimestamp,
        });
      }
    }
  }

  return reconcileProjectionRows({
    admin,
    table: "public_request_entries",
    partnerId,
    rows: projectionRows,
    uniqueColumns: ["partner_id", "request_id", "visible_area_id", "locale"],
    compareColumns: [
      "provider",
      "external_id",
      "request_type",
      "object_type",
      "title",
      "seo_title",
      "seo_description",
      "seo_h1",
      "short_description",
      "long_description",
      "location_text",
      "features_text",
      "highlights",
      "image_alt_texts",
      "min_rooms",
      "max_price",
      "region_targets",
      "region_target_keys",
      "is_live",
      "source_updated_at",
    ],
  });
}

export async function rebuildPublicReferenceEntriesForPartner(
  partnerId: string,
  admin = createAdminClient(),
): Promise<number> {
  const visibleAreaIds = await loadPublicLiveAreaIdsForPartner(admin, partnerId);
  if (visibleAreaIds.length === 0) {
    return reconcileProjectionRows({
      admin,
      table: "public_reference_entries",
      partnerId,
      rows: [],
      uniqueColumns: ["partner_id", "reference_id", "visible_area_id", "locale"],
      compareColumns: [
        "provider",
        "external_id",
        "title",
        "seo_title",
        "seo_description",
        "seo_h1",
        "short_description",
        "long_description",
        "location_text",
        "features_text",
        "highlights",
        "image_alt_texts",
        "description",
        "image_url",
        "city",
        "district",
        "is_live",
        "source_updated_at",
      ],
    });
  }

  const [referencesRes, overridesRes, i18nRes] = await Promise.all([
    admin
      .from("partner_references")
      .select("id, partner_id, provider, external_id, title, source_updated_at, updated_at, normalized_payload")
      .eq("partner_id", partnerId)
      .eq("is_active", true),
    admin
      .from("partner_reference_overrides")
      .select("partner_id, source, external_id, seo_title, seo_description, seo_h1, short_description, long_description, location_text, features_text, highlights, image_alt_texts")
      .eq("partner_id", partnerId),
    admin
      .from("partner_reference_i18n")
      .select("reference_id, target_locale, translated_seo_title, translated_seo_description, translated_seo_h1, translated_short_description, translated_long_description, translated_location_text, translated_features_text, translated_highlights, translated_image_alt_texts")
      .eq("partner_id", partnerId)
      .eq("status", "approved"),
  ]);

  if (referencesRes.error) throw new Error(`partner_references lookup failed: ${referencesRes.error.message}`);
  if (overridesRes.error) throw new Error(`partner_reference_overrides lookup failed: ${overridesRes.error.message}`);
  if (i18nRes.error) throw new Error(`partner_reference_i18n lookup failed: ${i18nRes.error.message}`);

  const references = (referencesRes.data ?? []) as ReferenceRow[];
  const overridesByKey = groupByKey(
    (overridesRes.data ?? []) as ReferenceOverrideRow[],
    (row) => `${asText(row.partner_id)}::${asText(row.source)}::${asText(row.external_id)}`,
  );
  const translationsByEntityId = groupTranslationsByEntityId(
    (i18nRes.data ?? []) as ReferenceI18nRow[],
    (row) => asText(row.reference_id),
    (row) => asText(row.target_locale).toLowerCase(),
  );

  const projectionRows: Array<Record<string, unknown>> = [];
  const rebuildTimestamp = new Date().toISOString();
  for (const reference of references) {
    const referenceId = asText(reference.id);
    const provider = asText(reference.provider);
    const externalId = asText(reference.external_id);
    if (!referenceId || !provider || !externalId) continue;
    const payload = (reference.normalized_payload ?? {}) as Record<string, unknown>;
    const override = overridesByKey.get(`${partnerId}::${provider}::${externalId}`);
    const city = asNullableText(payload["city"]);
    const district = asNullableText(payload["district"]);
    const imageUrl = asNullableText(payload["image_url"]);
    const description =
      asNullableText(override?.short_description)
      ?? asNullableText(override?.long_description)
      ?? asNullableText(override?.seo_description)
      ?? asNullableText(payload["description"])
      ?? asNullableText(payload["reference_text_seed"]);

    for (const visibleAreaId of visibleAreaIds) {
      projectionRows.push({
        partner_id: partnerId,
        visible_area_id: visibleAreaId,
        locale: "de",
        reference_id: referenceId,
        provider,
        external_id: externalId,
        title: asNullableText(override?.seo_h1) ?? asNullableText(reference.title) ?? "Erfolgreich vermittelt",
        seo_title: asNullableText(override?.seo_title),
        seo_description: asNullableText(override?.seo_description),
        seo_h1: asNullableText(override?.seo_h1),
        short_description: asNullableText(override?.short_description),
        long_description: asNullableText(override?.long_description),
        location_text: asNullableText(override?.location_text),
        features_text: asNullableText(override?.features_text),
        highlights: asArrayJson(override?.highlights),
        image_alt_texts: asArrayJson(override?.image_alt_texts),
        description,
        image_url: imageUrl,
        city,
        district,
        is_live: true,
        source_updated_at: asNullableText(reference.source_updated_at) ?? asNullableText(reference.updated_at),
        updated_at: rebuildTimestamp,
      });

      for (const translationEntry of translationsByEntityId.get(referenceId) ?? []) {
        const { locale, row: translation } = translationEntry;
        const translatedTitle =
          asNullableText(translation.translated_seo_h1) ?? asNullableText(translation.translated_seo_title);
        if (!translatedTitle) continue;
        projectionRows.push({
          partner_id: partnerId,
          visible_area_id: visibleAreaId,
          locale,
          reference_id: referenceId,
          provider,
          external_id: externalId,
          title: translatedTitle,
          seo_title: asNullableText(translation.translated_seo_title),
          seo_description: asNullableText(translation.translated_seo_description),
          seo_h1: asNullableText(translation.translated_seo_h1),
          short_description: asNullableText(translation.translated_short_description),
          long_description: asNullableText(translation.translated_long_description),
          location_text: asNullableText(translation.translated_location_text),
          features_text: asNullableText(translation.translated_features_text),
          highlights: asArrayJson(translation.translated_highlights),
          image_alt_texts: asArrayJson(translation.translated_image_alt_texts),
          description: asNullableText(translation.translated_short_description)
            ?? asNullableText(translation.translated_long_description)
            ?? asNullableText(translation.translated_seo_description),
          image_url: imageUrl,
          city,
          district,
          is_live: true,
          source_updated_at: asNullableText(reference.source_updated_at) ?? asNullableText(reference.updated_at),
          updated_at: rebuildTimestamp,
        });
      }
    }
  }

  return reconcileProjectionRows({
    admin,
    table: "public_reference_entries",
    partnerId,
    rows: projectionRows,
    uniqueColumns: ["partner_id", "reference_id", "visible_area_id", "locale"],
    compareColumns: [
      "provider",
      "external_id",
      "title",
      "seo_title",
      "seo_description",
      "seo_h1",
      "short_description",
      "long_description",
      "location_text",
      "features_text",
      "highlights",
      "image_alt_texts",
      "description",
      "image_url",
      "city",
      "district",
      "is_live",
      "source_updated_at",
    ],
  });
}

export async function rebuildAllPublicAssetEntriesForPartner(
  partnerId: string,
  admin = createAdminClient(),
): Promise<ProjectionCounts> {
  const [offers, requests, references] = await Promise.all([
    rebuildPublicOfferEntriesForPartner(partnerId, admin),
    rebuildPublicRequestEntriesForPartner(partnerId, admin),
    rebuildPublicReferenceEntriesForPartner(partnerId, admin),
  ]);

  return { offers, requests, references };
}
