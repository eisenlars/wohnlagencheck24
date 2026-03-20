import { createAdminClient } from "@/utils/supabase/admin";
import { rebuildAllPublicAssetEntriesForPartner } from "@/lib/public-asset-projections";
import { syncIntegrationResources } from "@/lib/providers";
import type { PartnerIntegration } from "@/lib/providers/types";

type AdminClient = ReturnType<typeof createAdminClient>;

type CrmSyncHooks = {
  onProgress?: (step: string, message: string) => Promise<void>;
  assertCanContinue?: () => Promise<void>;
};

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

async function deactivateMissingByExternalId(
  supabase: AdminClient,
  table: "partner_listings" | "partner_references" | "partner_requests" | "partner_property_offers",
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
    table === "partner_listings" || table === "partner_references" || table === "partner_requests"
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
  table: "partner_listings" | "partner_references" | "partner_requests",
  rows: Array<Record<string, unknown>>,
): Promise<void> {
  if (!rows.length) return;
  const { error } = await supabase.from(table).upsert(rows, {
    onConflict: "partner_id,provider,external_id",
  });
  if (error) throw new Error(`${table} upsert failed: ${error.message}`);
}

async function upsertOffers(
  supabase: AdminClient,
  rows: Array<Record<string, unknown>>,
): Promise<void> {
  if (!rows.length) return;
  const { error } = await supabase.from("partner_property_offers").upsert(rows, {
    onConflict: "partner_id,source,external_id",
  });
  if (error) throw new Error(`partner_property_offers upsert failed: ${error.message}`);
}

async function syncRawResourceLayer(
  supabase: AdminClient,
  table: "partner_listings" | "partner_references" | "partner_requests",
  partnerId: string,
  provider: string,
  rows: Array<Record<string, unknown>>,
): Promise<{ count: number; deactivated: number }> {
  await upsertRawResource(supabase, table, rows);
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
    await syncIntegrationResources(integration);
  await hooks?.assertCanContinue?.();
  await hooks?.onProgress?.(
    "resources_fetched",
    `CRM-Daten geladen: Angebote=${offers.length}, Rohobjekte=${listings.length}, Referenzen=${references.length}, Gesuche=${requests.length}.`,
  );

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
    );
    listingsCount = layer.count;
    deactivatedListings = layer.deactivated;
  }

  let referencesCount = 0;
  if (syncReferences) {
    await hooks?.assertCanContinue?.();
    await hooks?.onProgress?.("upsert_references", "Referenzen werden gespeichert.");
    const layer = await syncRawResourceLayer(
      supabase,
      "partner_references",
      integration.partner_id,
      integration.provider,
      references as unknown as Array<Record<string, unknown>>,
    );
    referencesCount = layer.count;
  }

  let requestsCount = 0;
  if (syncRequests) {
    await hooks?.assertCanContinue?.();
    await hooks?.onProgress?.("upsert_requests", "Gesuche werden gespeichert.");
    const layer = await syncRawResourceLayer(
      supabase,
      "partner_requests",
      integration.partner_id,
      integration.provider,
      requests as unknown as Array<Record<string, unknown>>,
    );
    requestsCount = layer.count;
  }

  if (syncListings) {
    await hooks?.assertCanContinue?.();
    await hooks?.onProgress?.("upsert_offers", "Angebote werden gespeichert.");
    await upsertOffers(supabase, offers as unknown as Array<Record<string, unknown>>);
  }

  await hooks?.assertCanContinue?.();
  await hooks?.onProgress?.("deactivate_stale", "Veraltete CRM-Eintraege werden abgeglichen.");
  const activeOfferExternalIds = offers.map((row) => row.external_id);
  const deactivatedOffers = syncListings
    ? await deactivateMissingByExternalId(
        supabase,
        "partner_property_offers",
        "source",
        integration.partner_id,
        integration.provider,
        activeOfferExternalIds,
      )
    : 0;

  const mergedNotes: string[] = [];
  if (notes?.length) mergedNotes.push(...notes);
  if (syncReferences && !referencesFetched) {
    mergedNotes.push("references capability enabled, provider mapping pending");
  }
  if (syncRequests && !requestsFetched) {
    mergedNotes.push("requests capability enabled, provider mapping pending");
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
