import { createAdminClient } from "@/utils/supabase/admin";
import { rebuildAllPublicAssetEntriesForPartner } from "@/lib/public-asset-projections";
import { syncIntegrationResources } from "@/lib/providers";
import type {
  CanonicalReference,
  CanonicalRequest,
  MappedOffer,
  PartnerIntegration,
  RawReference,
  RawRequest,
} from "@/lib/providers/types";

type AdminClient = ReturnType<typeof createAdminClient>;

type CrmSyncHooks = {
  onProgress?: (step: string, message: string) => Promise<void>;
  assertCanContinue?: () => Promise<void>;
};

const FETCH_RESOURCES_HEARTBEAT_MS = 5_000;

export type CrmSyncResult = {
  partner_id: string;
  provider: string;
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
};

function readBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function shouldSyncCapability(
  settings: Record<string, unknown> | null,
  capability: "listings" | "references" | "requests",
): boolean {
  const caps = settings?.capabilities;
  if (!caps || typeof caps !== "object") return true;
  const value = readBoolean((caps as Record<string, unknown>)[capability]);
  return value ?? true;
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
  const { data, error } = await supabase
    .from(table)
    .select("external_id")
    .eq("partner_id", partnerId)
    .eq(providerField, provider)
    .eq("is_active", true);

  if (error) throw new Error(error.message);

  const activeSet = new Set(activeExternalIds);
  const stale = (data ?? [])
    .map((row) => String((row as { external_id?: unknown }).external_id ?? ""))
    .filter((externalId) => externalId.length > 0 && !activeSet.has(externalId));

  if (stale.length === 0) return 0;

  const now = new Date().toISOString();
  const patch =
    table === "partner_references" || table === "partner_requests"
      ? {
          is_active: false,
          sync_status: "stale",
          updated_at: now,
          lifecycle_status: "stale",
          is_live: false,
        }
      : table === "partner_listings" || table === "crm_raw_references" || table === "crm_raw_requests"
        ? { is_active: false, sync_status: "stale", updated_at: now }
        : { is_active: false, updated_at: now };

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
  hooks?: CrmSyncHooks,
): Promise<CrmSyncResult> {
  if (integration.kind !== "crm") {
    return {
      partner_id: integration.partner_id,
      provider: integration.provider,
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

  const syncListings = shouldSyncCapability(integration.settings, "listings");
  const syncReferences = shouldSyncCapability(integration.settings, "references");
  const syncRequests = shouldSyncCapability(integration.settings, "requests");

  if (!syncListings && !syncReferences && !syncRequests) {
    return {
      partner_id: integration.partner_id,
      provider: integration.provider,
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
      () => syncIntegrationResources(integration),
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
  const allowDeactivate = diagnostics?.stale_deactivation_allowed !== false;

  let listingsCount = 0;
  let deactivatedListings = 0;
  if (syncListings) {
    await hooks?.assertCanContinue?.();
    await hooks?.onProgress?.("upsert_listings", "Rohobjekte werden gespeichert.");
    const layer = await syncRawResourceLayer(
      supabase,
      "partner_listings",
      integration.partner_id,
      integration.provider,
      listings as unknown as Array<Record<string, unknown>>,
      { allowDeactivate },
    );
    listingsCount = layer.count;
    deactivatedListings = layer.deactivated;
  }

  let referencesCount = 0;
  if (syncReferences && (referencesFetched || references.length > 0)) {
    await hooks?.assertCanContinue?.();
    await hooks?.onProgress?.("upsert_references_raw", "Referenz-Rohdaten werden gespeichert.");
    await syncRawResourceLayer(
      supabase,
      "crm_raw_references",
      integration.partner_id,
      integration.provider,
      references as unknown as Array<Record<string, unknown>>,
      { allowDeactivate },
    );
    await hooks?.assertCanContinue?.();
    await hooks?.onProgress?.("upsert_references", "Referenzen werden kanonisch gespeichert.");
    const layer = await syncCanonicalReferenceLayer(
      supabase,
      integration.partner_id,
      integration.provider,
      references.map(toCanonicalReference),
      { allowDeactivate },
    );
    referencesCount = layer.count;
  }

  let requestsCount = 0;
  if (syncRequests && (requestsFetched || requests.length > 0)) {
    await hooks?.assertCanContinue?.();
    await hooks?.onProgress?.("upsert_requests_raw", "Gesuch-Rohdaten werden gespeichert.");
    await syncRawResourceLayer(
      supabase,
      "crm_raw_requests",
      integration.partner_id,
      integration.provider,
      requests as unknown as Array<Record<string, unknown>>,
      { allowDeactivate },
    );
    await hooks?.assertCanContinue?.();
    await hooks?.onProgress?.("upsert_requests", "Gesuche werden kanonisch gespeichert.");
    const layer = await syncCanonicalRequestLayer(
      supabase,
      integration.partner_id,
      integration.provider,
      requests.map(toCanonicalRequest),
      { allowDeactivate },
    );
    requestsCount = layer.count;
  }

  if (syncListings) {
    await hooks?.assertCanContinue?.();
    await hooks?.onProgress?.("upsert_offers", "Angebote werden gespeichert.");
    await upsertOffers(supabase, offers);
  }

  const activeOfferExternalIds = offers.map((row) => row.external_id);
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

  await hooks?.assertCanContinue?.();
  await hooks?.onProgress?.("rebuild_projections", "Oeffentliche Projektionen werden aktualisiert.");
  const projectionCounts = await rebuildAllPublicAssetEntriesForPartner(
    integration.partner_id,
    supabase,
  );
  mergedNotes.push(
    `public projections reconciled: offers=${projectionCounts.offers}, requests=${projectionCounts.requests}, references=${projectionCounts.references}`,
  );

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
  };
}
