import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

import { createAdminClient } from "@/utils/supabase/admin";
import { syncIntegrationResources } from "@/lib/providers";
import type { PartnerIntegration } from "@/lib/providers/types";

const SYNC_KIND = "crm";

type SyncResult = {
  partner_id: string;
  provider: string;
  listings_count: number;
  references_count: number;
  requests_count: number;
  offers_count: number;
  deactivated_listings: number;
  deactivated_offers: number;
  skipped: boolean;
  reason?: string;
  notes?: string[];
  error?: string;
};

function constantTimeTokenEquals(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function extractToken(req: Request): string {
  const authHeader = req.headers.get("authorization") ?? "";
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }
  const cronHeader = req.headers.get("x-cron-token");
  if (cronHeader) return cronHeader.trim();
  const url = new URL(req.url);
  return (url.searchParams.get("token") ?? "").trim();
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function shouldSyncCapability(
  settings: Record<string, unknown> | null,
  capability: "listings" | "references" | "requests",
): boolean {
  const caps = settings?.["capabilities"];
  if (!caps || typeof caps !== "object") return true;
  const value = readBoolean((caps as Record<string, unknown>)[capability]);
  return value ?? true;
}

async function deactivateMissingByExternalId(
  supabase: ReturnType<typeof createAdminClient>,
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
  supabase: ReturnType<typeof createAdminClient>,
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
  supabase: ReturnType<typeof createAdminClient>,
  rows: Array<Record<string, unknown>>,
): Promise<void> {
  if (!rows.length) return;
  const { error } = await supabase.from("partner_property_offers").upsert(rows, {
    onConflict: "partner_id,source,external_id",
  });
  if (error) throw new Error(`partner_property_offers upsert failed: ${error.message}`);
}

async function syncRawResourceLayer(
  supabase: ReturnType<typeof createAdminClient>,
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

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }

  const token = extractToken(req);
  if (!token || !constantTimeTokenEquals(token, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: integrations, error } = await supabase
    .from("partner_integrations")
    .select("id, partner_id, kind, provider, base_url, auth_type, auth_config, detail_url_template, is_active, settings")
    .eq("kind", SYNC_KIND)
    .eq("is_active", true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: SyncResult[] = [];

  for (const integration of (integrations ?? []) as PartnerIntegration[]) {
    const syncListings = shouldSyncCapability(integration.settings, "listings");
    const syncReferences = shouldSyncCapability(integration.settings, "references");
    const syncRequests = shouldSyncCapability(integration.settings, "requests");

    if (!syncListings && !syncReferences && !syncRequests) {
      results.push({
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
      });
      continue;
    }

    try {
      const { offers, listings, references, requests, referencesFetched, requestsFetched, notes } =
        await syncIntegrationResources(integration);

      let listingsCount = 0;
      let deactivatedListings = 0;
      if (syncListings) {
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
        await upsertOffers(supabase, offers as unknown as Array<Record<string, unknown>>);
      }

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

      results.push({
        partner_id: integration.partner_id,
        provider: integration.provider,
        listings_count: listingsCount,
        references_count: referencesCount,
        requests_count: requestsCount,
        offers_count: syncListings ? offers.length : 0,
        deactivated_listings: deactivatedListings,
        deactivated_offers: deactivatedOffers,
        skipped: false,
        notes: mergedNotes.length ? mergedNotes : undefined,
      });
    } catch (integrationError) {
      results.push({
        partner_id: integration.partner_id,
        provider: integration.provider,
        listings_count: 0,
        references_count: 0,
        requests_count: 0,
        offers_count: 0,
        deactivated_listings: 0,
        deactivated_offers: 0,
        skipped: false,
        error: integrationError instanceof Error ? integrationError.message : "unknown integration error",
      });
    }
  }

  const failedCount = results.filter((row) => typeof row.error === "string").length;
  const status = failedCount > 0 ? 207 : 200;
  return NextResponse.json({ ok: failedCount === 0, failed_count: failedCount, results }, { status });
}
