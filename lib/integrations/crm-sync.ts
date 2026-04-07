import { createAdminClient } from "@/utils/supabase/admin";
import { readCrmResourceSettings } from "@/lib/integrations/settings";
import {
  rebuildPublicOfferEntriesForPartner,
  rebuildPublicReferenceEntriesForPartner,
  rebuildPublicRequestEntriesForPartner,
} from "@/lib/public-asset-projections";
import { syncIntegrationResources, type IntegrationSyncOptions } from "@/lib/providers";
import type {
  CanonicalReference,
  CanonicalRequest,
  CrmSyncMode,
  CrmSyncResource,
  CrmSyncTrigger,
  MappedOffer,
  PartnerIntegration,
  RawListing,
  RawReference,
  RawRequest,
} from "@/lib/providers/types";

type AdminClient = ReturnType<typeof createAdminClient>;

type CrmSyncHooks = {
  onProgress?: (step: string, message: string) => Promise<void>;
  assertCanContinue?: () => Promise<void>;
};

export type CrmSyncScope = {
  resource?: CrmSyncResource;
  mode?: CrmSyncMode;
  triggeredBy?: CrmSyncTrigger;
};

const FETCH_RESOURCES_HEARTBEAT_MS = 5_000;

export type CrmSyncResult = {
  partner_id: string;
  provider: string;
  resource: CrmSyncResource;
  mode: CrmSyncMode;
  listings_count: number;
  references_count: number;
  requests_count: number;
  offers_count: number;
  deactivated_listings: number;
  deactivated_offers: number;
  provider_request_count?: number;
  provider_pages_fetched?: number;
  provider_breakdown?: Record<string, { requests: number; pages_fetched: number }>;
  skipped: boolean;
  reason?: string;
  notes?: string[];
  debug_payload?: Record<string, unknown>;
};

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseTimestampScore(value: unknown): number {
  if (typeof value !== "string" || value.trim().length === 0) return Number.NEGATIVE_INFINITY;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function chooseMoreRecentRow<T extends Record<string, unknown>>(current: T, incoming: T): T {
  const currentScore = Math.max(
    parseTimestampScore(current.source_updated_at),
    parseTimestampScore(current.updated_at),
    parseTimestampScore(current.last_seen_at),
  );
  const incomingScore = Math.max(
    parseTimestampScore(incoming.source_updated_at),
    parseTimestampScore(incoming.updated_at),
    parseTimestampScore(incoming.last_seen_at),
  );
  return incomingScore >= currentScore ? incoming : current;
}

function dedupeRowsByConflictKey<T extends Record<string, unknown>>(
  rows: T[],
  buildKey: (row: T) => string,
): { rows: T[]; removed: number } {
  const deduped = new Map<string, T>();
  let removed = 0;

  for (const row of rows) {
    const key = buildKey(row);
    if (!key) continue;
    const current = deduped.get(key);
    if (!current) {
      deduped.set(key, row);
      continue;
    }
    deduped.set(key, chooseMoreRecentRow(current, row));
    removed += 1;
  }

  return {
    rows: Array.from(deduped.values()),
    removed,
  };
}

function dedupeRawRows<T extends RawListing | RawReference | RawRequest>(
  rows: T[],
): { rows: T[]; removed: number } {
  return dedupeRowsByConflictKey(rows, (row) =>
    [row.partner_id, row.provider, row.external_id].map((value) => String(value ?? "").trim()).join("::"),
  );
}

function dedupeCanonicalRows<T extends CanonicalReference | CanonicalRequest>(
  rows: T[],
): { rows: T[]; removed: number } {
  return dedupeRowsByConflictKey(rows, (row) =>
    [row.partner_id, row.source ?? row.provider, row.external_id]
      .map((value) => String(value ?? "").trim())
      .join("::"),
  );
}

function dedupeOffers(
  offers: MappedOffer[],
): { rows: MappedOffer[]; removed: number } {
  return dedupeRowsByConflictKey(offers as Array<MappedOffer & Record<string, unknown>>, (offer) =>
    [offer.partner_id, offer.source, offer.external_id].map((value) => String(value ?? "").trim()).join("::"),
  );
}

function shouldSyncCapability(
  settings: Record<string, unknown> | null,
  capability: "listings" | "references" | "requests",
): boolean {
  const resource = capability === "listings" ? "offers" : capability;
  return readCrmResourceSettings(settings, resource).enabled;
}

async function withProgressKeepalive<T>(
  run: () => Promise<T>,
  intervalMs: number,
  onTick?: () => Promise<void>,
): Promise<T> {
  if (!onTick) return run();

  let timer: ReturnType<typeof setInterval> | null = null;
  let tickRunning = false;
  let finished = false;
  let rejectHeartbeat: ((reason?: unknown) => void) | null = null;

  const heartbeatFailure = new Promise<never>((_, reject) => {
    rejectHeartbeat = reject;
  });

  const tick = async () => {
    if (finished || tickRunning) return;
    tickRunning = true;
    try {
      await onTick();
    } catch (error) {
      if (!finished) {
        finished = true;
        if (timer) clearInterval(timer);
        rejectHeartbeat?.(error);
      }
    } finally {
      tickRunning = false;
    }
  };

  timer = setInterval(() => {
    void tick();
  }, intervalMs);

  try {
    return await Promise.race([run(), heartbeatFailure]);
  } finally {
    finished = true;
    if (timer) clearInterval(timer);
  }
}

async function deactivateMissingByExternalId(
  supabase: AdminClient,
  table:
    | "partner_listings"
    | "crm_raw_references"
    | "crm_raw_requests"
    | "partner_references"
    | "partner_requests"
    | "partner_property_offers",
  providerField: "provider" | "source",
  partnerId: string,
  provider: string,
  activeExternalIds: string[],
): Promise<number> {
  const baseQuery = supabase
    .from(table)
    .select("external_id")
    .eq("partner_id", partnerId)
    .eq(providerField, provider);

  const { data, error } =
    table === "partner_property_offers"
      ? await baseQuery
      : await baseQuery.eq("is_active", true);

  if (error) throw new Error(error.message);

  const activeSet = new Set(activeExternalIds);
  const stale = (data ?? [])
    .map((row) => String((row as { external_id?: unknown }).external_id ?? ""))
    .filter((externalId) => externalId.length > 0 && !activeSet.has(externalId));

  if (stale.length === 0) return 0;

  const now = new Date().toISOString();
  if (table === "partner_property_offers") {
    const { error: deleteError } = await supabase
      .from(table)
      .delete()
      .eq("partner_id", partnerId)
      .eq(providerField, provider)
      .in("external_id", stale);

    if (deleteError) throw new Error(deleteError.message);
    return stale.length;
  }

  const patch =
    table === "partner_references" || table === "partner_requests"
      ? {
          is_active: false,
          sync_status: "stale",
          updated_at: now,
          lifecycle_status: "stale",
          is_live: false,
        }
      : { is_active: false, sync_status: "stale", updated_at: now };

  const { error: updateError } = await supabase
    .from(table)
    .update(patch)
    .eq("partner_id", partnerId)
    .eq(providerField, provider)
    .in("external_id", stale);

  if (updateError) throw new Error(updateError.message);
  return stale.length;
}

async function upsertRawResource(
  supabase: AdminClient,
  table: "partner_listings" | "crm_raw_references" | "crm_raw_requests",
  rows: Array<Record<string, unknown>>,
): Promise<void> {
  if (!rows.length) return;
  const { error } = await supabase.from(table).upsert(rows, {
    onConflict: "partner_id,provider,external_id",
  });
  if (error) throw new Error(`${table} upsert failed: ${error.message}`);
}

function sanitizeCanonicalRequestPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...payload };
  delete sanitized.note;
  return sanitized;
}

function getRequestFreshnessType(row: RawRequest): "kauf" | "miete" {
  const payload = asObject(row.normalized_payload);
  return asText(payload.request_type).toLowerCase() === "miete" ? "miete" : "kauf";
}

function parseIsoTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function filterFreshRequests(
  requests: RawRequest[],
  settings: Record<string, unknown> | null,
): { rows: RawRequest[]; filtered: number; basis: "source_updated_at" | "last_seen_at" | null } {
  const freshness = readCrmResourceSettings(settings, "requests").freshness;
  if (!freshness?.enabled) {
    return { rows: requests, filtered: 0, basis: null };
  }

  const nowMs = Date.now();
  const filteredRows = requests.filter((row) => {
    const requestType = getRequestFreshnessType(row);
    const maxAgeDays =
      requestType === "miete" ? freshness.max_age_days_rent : freshness.max_age_days_buy;
    if (maxAgeDays === null) return true;

    const primaryTimestamp =
      freshness.basis === "last_seen_at"
        ? parseIsoTimestamp(row.last_seen_at)
        : parseIsoTimestamp(row.source_updated_at);
    const fallbackTimestamp =
      freshness.fallback_to_last_seen && freshness.basis === "source_updated_at"
        ? parseIsoTimestamp(row.last_seen_at)
        : null;
    const effectiveTimestamp = primaryTimestamp ?? fallbackTimestamp;
    if (effectiveTimestamp === null) return true;

    const ageMs = nowMs - effectiveTimestamp;
    return ageMs <= maxAgeDays * 24 * 60 * 60 * 1000;
  });

  return {
    rows: filteredRows,
    filtered: Math.max(0, requests.length - filteredRows.length),
    basis: freshness.basis,
  };
}

function toCanonicalReference(raw: RawReference): CanonicalReference {
  return {
    partner_id: raw.partner_id,
    provider: raw.provider,
    source: raw.provider,
    external_id: raw.external_id,
    title: raw.title,
    status: raw.status,
    source_updated_at: raw.source_updated_at,
    normalized_payload: raw.normalized_payload,
    source_payload: raw.source_payload,
    is_active: raw.is_active,
    sync_status: raw.sync_status,
    last_seen_at: raw.last_seen_at,
    updated_at: raw.updated_at,
    lifecycle_status: raw.is_active ? "active" : "stale",
    is_live: raw.is_active,
    canonical_payload: raw.normalized_payload,
    owner_account_id: raw.partner_id,
    publisher_account_id: raw.partner_id,
  };
}

function toCanonicalRequest(raw: RawRequest): CanonicalRequest {
  const sanitizedPayload = sanitizeCanonicalRequestPayload(asObject(raw.normalized_payload));
  return {
    partner_id: raw.partner_id,
    provider: raw.provider,
    source: raw.provider,
    external_id: raw.external_id,
    title: raw.title,
    status: raw.status,
    source_updated_at: raw.source_updated_at,
    normalized_payload: sanitizedPayload,
    source_payload: raw.source_payload,
    is_active: raw.is_active,
    sync_status: raw.sync_status,
    last_seen_at: raw.last_seen_at,
    updated_at: raw.updated_at,
    lifecycle_status: raw.is_active ? "active" : "stale",
    is_live: raw.is_active,
    canonical_payload: sanitizedPayload,
    owner_account_id: raw.partner_id,
    publisher_account_id: raw.partner_id,
  };
}

async function upsertCanonicalReferences(
  supabase: AdminClient,
  rows: CanonicalReference[],
): Promise<void> {
  if (!rows.length) return;
  const { error } = await supabase.from("partner_references").upsert(rows, {
    onConflict: "partner_id,provider,external_id",
  });
  if (error) throw new Error(`partner_references upsert failed: ${error.message}`);
}

async function upsertCanonicalRequests(
  supabase: AdminClient,
  rows: CanonicalRequest[],
): Promise<void> {
  if (!rows.length) return;
  const { error } = await supabase.from("partner_requests").upsert(rows, {
    onConflict: "partner_id,provider,external_id",
  });
  if (error) throw new Error(`partner_requests upsert failed: ${error.message}`);
}

async function upsertOffers(
  supabase: AdminClient,
  offers: MappedOffer[],
): Promise<void> {
  if (!offers.length) return;
  const rows = offers.map((offer) => ({
    partner_id: offer.partner_id,
    source: offer.source,
    external_id: offer.external_id,
    offer_type: offer.offer_type,
    object_type: offer.object_type,
    title: offer.title,
    price: offer.price,
    rent: offer.rent,
    area_sqm: offer.area_sqm,
    rooms: offer.rooms,
    address: offer.address,
    image_url: offer.image_url,
    detail_url: offer.detail_url,
    is_top: offer.is_top,
    updated_at: offer.updated_at ?? new Date().toISOString(),
    raw: offer.raw,
  }));
  const { error } = await supabase.from("partner_property_offers").upsert(rows, {
    onConflict: "partner_id,source,external_id",
  });
  if (error) throw new Error(`partner_property_offers upsert failed: ${error.message}`);
}

async function syncRawResourceLayer(
  supabase: AdminClient,
  table: "partner_listings" | "crm_raw_references" | "crm_raw_requests",
  partnerId: string,
  provider: string,
  rows: Array<Record<string, unknown>>,
  options?: { allowDeactivate?: boolean },
): Promise<{ count: number; deactivated: number }> {
  await upsertRawResource(supabase, table, rows);
  if (options?.allowDeactivate === false) {
    return { count: rows.length, deactivated: 0 };
  }
  const activeExternalIds = rows.map((row) => String(row.external_id ?? "")).filter(Boolean);
  const deactivated = await deactivateMissingByExternalId(
    supabase,
    table,
    "provider",
    partnerId,
    provider,
    activeExternalIds,
  );
  return { count: rows.length, deactivated };
}

async function syncCanonicalReferenceLayer(
  supabase: AdminClient,
  partnerId: string,
  provider: string,
  rows: CanonicalReference[],
  options?: { allowDeactivate?: boolean },
): Promise<{ count: number; deactivated: number }> {
  await upsertCanonicalReferences(supabase, rows);
  if (options?.allowDeactivate === false) {
    return { count: rows.length, deactivated: 0 };
  }
  const activeExternalIds = rows.map((row) => String(row.external_id ?? "")).filter(Boolean);
  const deactivated = await deactivateMissingByExternalId(
    supabase,
    "partner_references",
    "source",
    partnerId,
    provider,
    activeExternalIds,
  );
  return { count: rows.length, deactivated };
}

async function syncCanonicalRequestLayer(
  supabase: AdminClient,
  partnerId: string,
  provider: string,
  rows: CanonicalRequest[],
  options?: { allowDeactivate?: boolean },
): Promise<{ count: number; deactivated: number }> {
  await upsertCanonicalRequests(supabase, rows);
  if (options?.allowDeactivate === false) {
    return { count: rows.length, deactivated: 0 };
  }
  const activeExternalIds = rows.map((row) => String(row.external_id ?? "")).filter(Boolean);
  const deactivated = await deactivateMissingByExternalId(
    supabase,
    "partner_requests",
    "source",
    partnerId,
    provider,
    activeExternalIds,
  );
  return { count: rows.length, deactivated };
}

export async function runCrmIntegrationSync(
  supabase: AdminClient,
  integration: PartnerIntegration,
  scope?: CrmSyncScope,
  hooks?: CrmSyncHooks,
): Promise<CrmSyncResult> {
  const resource = scope?.resource ?? "all";
  const mode = scope?.mode ?? "full";
  const triggeredBy = scope?.triggeredBy ?? "admin_manual";
  const providerOptions: IntegrationSyncOptions = { resource, mode, triggeredBy };

  if (integration.kind !== "crm") {
    return {
      partner_id: integration.partner_id,
      provider: integration.provider,
      resource,
      mode,
      listings_count: 0,
      references_count: 0,
      requests_count: 0,
      offers_count: 0,
      deactivated_listings: 0,
      deactivated_offers: 0,
      skipped: true,
      reason: "unsupported kind",
    };
  }

  if (!integration.is_active) {
    return {
      partner_id: integration.partner_id,
      provider: integration.provider,
      resource,
      mode,
      listings_count: 0,
      references_count: 0,
      requests_count: 0,
      offers_count: 0,
      deactivated_listings: 0,
      deactivated_offers: 0,
      skipped: true,
      reason: "integration inactive",
    };
  }

  const syncListings =
    (resource === "all" || resource === "offers") && shouldSyncCapability(integration.settings, "listings");
  const syncReferences =
    (resource === "all" || resource === "references") && shouldSyncCapability(integration.settings, "references");
  const syncRequests =
    (resource === "all" || resource === "requests") && shouldSyncCapability(integration.settings, "requests");

  if (!syncListings && !syncReferences && !syncRequests) {
    return {
      partner_id: integration.partner_id,
      provider: integration.provider,
      resource,
      mode,
      listings_count: 0,
      references_count: 0,
      requests_count: 0,
      offers_count: 0,
      deactivated_listings: 0,
      deactivated_offers: 0,
      skipped: true,
      reason: "all capabilities disabled",
    };
  }

  await hooks?.assertCanContinue?.();
  await hooks?.onProgress?.("fetch_resources", "CRM-Daten werden vom Anbieter geladen.");
  const { offers, listings, references, requests, referencesFetched, requestsFetched, notes, diagnostics } =
    await withProgressKeepalive(
      () => syncIntegrationResources(integration, providerOptions),
      FETCH_RESOURCES_HEARTBEAT_MS,
      hooks?.onProgress
        ? async () => {
            await hooks.onProgress?.("fetch_resources", "CRM-Daten werden vom Anbieter geladen.");
          }
        : undefined,
    );
  await hooks?.assertCanContinue?.();
  await hooks?.onProgress?.(
    "resources_fetched",
    `CRM-Daten geladen: Angebote=${offers.length}, Rohobjekte=${listings.length}, Referenzen=${references.length}, Gesuche=${requests.length}.`,
  );
  const partialSyncMode = diagnostics?.partial_sync_mode === true;
  const allowDeactivate = mode === "full" && diagnostics?.stale_deactivation_allowed !== false;
  const mergedNotes: string[] = [];
  if (notes?.length) mergedNotes.push(...notes);
  if (partialSyncMode) {
    mergedNotes.push("guarded partial sync active: stale deactivation skipped");
  }
  if (syncReferences && !referencesFetched) {
    mergedNotes.push("references capability enabled, but live reference data unavailable");
  }
  if (syncRequests && !requestsFetched) {
    mergedNotes.push("requests capability enabled, but live request data unavailable");
  }

  let listingsCount = 0;
  let deactivatedListings = 0;
  if (syncListings) {
    const dedupedListings = dedupeRawRows(listings);
    if (dedupedListings.removed > 0) {
      mergedNotes.push(`listings dedupe: ${dedupedListings.removed} Duplikate vor dem Upsert entfernt`);
    }
    await hooks?.assertCanContinue?.();
    await hooks?.onProgress?.("upsert_listings", "Rohobjekte werden gespeichert.");
    const layer = await syncRawResourceLayer(
      supabase,
      "partner_listings",
      integration.partner_id,
      integration.provider,
      dedupedListings.rows as unknown as Array<Record<string, unknown>>,
      { allowDeactivate },
    );
    listingsCount = layer.count;
    deactivatedListings = layer.deactivated;
  }

  let referencesCount = 0;
  let deactivatedReferences = 0;
  if (syncReferences && (referencesFetched || references.length > 0)) {
    const dedupedReferences = dedupeRawRows(references);
    if (dedupedReferences.removed > 0) {
      mergedNotes.push(`references dedupe: ${dedupedReferences.removed} Duplikate vor dem Upsert entfernt`);
    }
    const canonicalReferences = dedupeCanonicalRows(dedupedReferences.rows.map(toCanonicalReference));
    await hooks?.assertCanContinue?.();
    await hooks?.onProgress?.("upsert_references_raw", "Referenz-Rohdaten werden gespeichert.");
    await syncRawResourceLayer(
      supabase,
      "crm_raw_references",
      integration.partner_id,
      integration.provider,
      dedupedReferences.rows as unknown as Array<Record<string, unknown>>,
      { allowDeactivate },
    );
    await hooks?.assertCanContinue?.();
    await hooks?.onProgress?.("upsert_references", "Referenzen werden kanonisch gespeichert.");
    const layer = await syncCanonicalReferenceLayer(
      supabase,
      integration.partner_id,
      integration.provider,
      canonicalReferences.rows,
      { allowDeactivate },
    );
    referencesCount = layer.count;
    deactivatedReferences = layer.deactivated;
  }

  let requestsCount = 0;
  let deactivatedRequests = 0;
  if (syncRequests && (requestsFetched || requests.length > 0)) {
    const freshness = filterFreshRequests(requests, integration.settings);
    const activeRequests = dedupeRawRows(freshness.rows);
    if (freshness.filtered > 0) {
      mergedNotes.push(
        `request freshness filter: ${freshness.filtered} Gesuche via ${freshness.basis ?? "source_updated_at"} ausgeschlossen`,
      );
    }
    if (activeRequests.removed > 0) {
      mergedNotes.push(`requests dedupe: ${activeRequests.removed} Duplikate vor dem Upsert entfernt`);
    }
    const canonicalRequests = dedupeCanonicalRows(activeRequests.rows.map(toCanonicalRequest));
    await hooks?.assertCanContinue?.();
    await hooks?.onProgress?.("upsert_requests_raw", "Gesuch-Rohdaten werden gespeichert.");
    await syncRawResourceLayer(
      supabase,
      "crm_raw_requests",
      integration.partner_id,
      integration.provider,
      activeRequests.rows as unknown as Array<Record<string, unknown>>,
      { allowDeactivate },
    );
    await hooks?.assertCanContinue?.();
    await hooks?.onProgress?.("upsert_requests", "Gesuche werden kanonisch gespeichert.");
    const layer = await syncCanonicalRequestLayer(
      supabase,
      integration.partner_id,
      integration.provider,
      canonicalRequests.rows,
      { allowDeactivate },
    );
    requestsCount = layer.count;
    deactivatedRequests = layer.deactivated;
  }

  if (syncListings) {
    const dedupedOffers = dedupeOffers(offers);
    if (dedupedOffers.removed > 0) {
      mergedNotes.push(`offers dedupe: ${dedupedOffers.removed} Duplikate vor dem Upsert entfernt`);
    }
    await hooks?.assertCanContinue?.();
    await hooks?.onProgress?.("upsert_offers", "Angebote werden gespeichert.");
    await upsertOffers(supabase, dedupedOffers.rows);
  }

  const activeOfferExternalIds = dedupeOffers(offers).rows.map((row) => row.external_id);
  let deactivatedOffers = 0;
  await hooks?.assertCanContinue?.();
  if (syncListings && allowDeactivate) {
    await hooks?.onProgress?.("deactivate_stale", "Veraltete CRM-Eintraege werden abgeglichen.");
    deactivatedOffers = await deactivateMissingByExternalId(
      supabase,
      "partner_property_offers",
      "source",
      integration.partner_id,
      integration.provider,
      activeOfferExternalIds,
    );
  } else if (syncListings) {
    await hooks?.onProgress?.("skip_stale_deactivation", "Stale-Deaktivierung im Guarded-Modus uebersprungen.");
  }

  await hooks?.assertCanContinue?.();
  await hooks?.onProgress?.("rebuild_projections", "Oeffentliche Projektionen werden aktualisiert.");
  const projectionCounts = { offers: 0, requests: 0, references: 0 };
  if (syncListings) {
    projectionCounts.offers = await rebuildPublicOfferEntriesForPartner(integration.partner_id, supabase);
  }
  if (syncRequests) {
    projectionCounts.requests = await rebuildPublicRequestEntriesForPartner(integration.partner_id, supabase);
  }
  if (syncReferences) {
    projectionCounts.references = await rebuildPublicReferenceEntriesForPartner(integration.partner_id, supabase);
  }
  mergedNotes.push(`public projections reconciled: offers=${projectionCounts.offers}, requests=${projectionCounts.requests}, references=${projectionCounts.references}`);
  if (deactivatedReferences > 0) mergedNotes.push(`${deactivatedReferences} Referenzen deaktiviert`);
  if (deactivatedRequests > 0) mergedNotes.push(`${deactivatedRequests} Gesuche deaktiviert`);

  await hooks?.assertCanContinue?.();
  await hooks?.onProgress?.("finalize", "Sync-Lauf wird abgeschlossen.");
  const lastSyncAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("partner_integrations")
    .update({ last_sync_at: lastSyncAt })
    .eq("id", integration.id)
    .eq("partner_id", integration.partner_id);

  if (updateError) throw new Error(updateError.message);

  return {
    partner_id: integration.partner_id,
    provider: integration.provider,
    resource,
    mode,
    listings_count: listingsCount,
    references_count: referencesCount,
    requests_count: requestsCount,
    offers_count: syncListings ? offers.length : 0,
    deactivated_listings: deactivatedListings,
    deactivated_offers: deactivatedOffers,
    provider_request_count: diagnostics?.provider_request_count,
    provider_pages_fetched: diagnostics?.provider_pages_fetched,
    provider_breakdown: diagnostics?.provider_breakdown,
    skipped: false,
    notes: mergedNotes.length ? mergedNotes : undefined,
    debug_payload: {
      partner_id: integration.partner_id,
      provider: integration.provider,
      resource,
      mode,
      generated_at: lastSyncAt,
      offers,
      listings,
      references,
      requests,
      references_fetched: referencesFetched,
      requests_fetched: requestsFetched,
      diagnostics: diagnostics ?? null,
      notes: mergedNotes,
    },
  };
}
