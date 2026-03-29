import { createAdminClient } from "@/utils/supabase/admin";
import type {
  NetworkPartnerPreviewSyncItem,
  NetworkPartnerWriteSyncLine,
  NetworkPartnerWriteSyncResult,
} from "@/lib/network-partners/types";
import { buildNetworkPartnerPreviewSyncSnapshot } from "@/lib/network-partners/sync/preview-sync";
import { upsertImportedPreviewItem } from "@/lib/network-partners/sync/upsert-content";

function isWritablePreviewItem(
  item: NetworkPartnerPreviewSyncItem,
): item is NetworkPartnerPreviewSyncItem & { content_type: "property_offer" | "property_request" } {
  return (
    (item.status === "exact_match" || item.status === "kreis_match")
    && (item.content_type === "property_offer" || item.content_type === "property_request")
    && Boolean(item.booking_id)
  );
}

async function persistSyncTimestamp(
  integrationId: string,
  networkPartnerId: string,
  summary: Record<string, unknown>,
) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("network_partner_integrations")
    .select("settings")
    .eq("id", integrationId)
    .eq("network_partner_id", networkPartnerId)
    .maybeSingle();

  const prevSettings =
    data && typeof data === "object" && !Array.isArray(data) && typeof (data as Record<string, unknown>).settings === "object"
      ? ((data as Record<string, unknown>).settings as Record<string, unknown>)
      : {};

  await admin
    .from("network_partner_integrations")
    .update({
      last_sync_at: new Date().toISOString(),
      settings: {
        ...prevSettings,
        last_sync_summary: summary,
      },
    })
    .eq("id", integrationId)
    .eq("network_partner_id", networkPartnerId);
}

export async function runNetworkPartnerWriteSync(input: {
  integrationId: string;
  networkPartnerId: string;
  resource?: unknown;
  mode?: unknown;
}): Promise<NetworkPartnerWriteSyncResult> {
  const snapshot = await buildNetworkPartnerPreviewSyncSnapshot(input);
  const bookingScopesById = new Map(snapshot.booking_scopes.map((scope) => [scope.booking_id, scope]));
  const lines: NetworkPartnerWriteSyncLine[] = [];
  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const item of snapshot.items) {
    if (!isWritablePreviewItem(item)) {
      skippedCount += 1;
      lines.push({
        external_id: item.external_id,
        content_type: item.content_type,
        booking_id: item.booking_id,
        content_item_id: null,
        status: "skipped",
        reason: item.reason ?? item.status,
      });
      continue;
    }

    const bookingId = item.booking_id;
    if (!bookingId) {
      skippedCount += 1;
      lines.push({
        external_id: item.external_id,
        content_type: item.content_type,
        booking_id: item.booking_id,
        content_item_id: null,
        status: "skipped",
        reason: "booking_scope_missing",
      });
      continue;
    }

    const bookingScope = bookingScopesById.get(bookingId);
    if (!bookingScope) {
      skippedCount += 1;
      lines.push({
        external_id: item.external_id,
        content_type: item.content_type,
        booking_id: item.booking_id,
        content_item_id: null,
        status: "skipped",
        reason: "booking_scope_missing",
      });
      continue;
    }

    try {
      const upserted = await upsertImportedPreviewItem({
        networkPartnerId: snapshot.network_partner_id,
        bookingScope,
        item,
      });
      if (upserted.action === "created") createdCount += 1;
      if (upserted.action === "updated") updatedCount += 1;
      lines.push({
        external_id: item.external_id,
        content_type: item.content_type,
        booking_id: bookingScope.booking_id,
        content_item_id: upserted.content.id,
        status: upserted.action,
        reason: null,
      });
    } catch (error) {
      errorCount += 1;
      lines.push({
        external_id: item.external_id,
        content_type: item.content_type,
        booking_id: bookingScope.booking_id,
        content_item_id: null,
        status: "error",
        reason: error instanceof Error ? error.message : "write_sync_failed",
      });
    }
  }

  const result: NetworkPartnerWriteSyncResult = {
    integration_id: snapshot.integration_id,
    network_partner_id: snapshot.network_partner_id,
    provider: snapshot.provider,
    resource: snapshot.resource,
    mode: snapshot.mode,
    preview_counts: snapshot.counts,
    created_count: createdCount,
    updated_count: updatedCount,
    skipped_count: skippedCount,
    error_count: errorCount,
    lines,
    notes: snapshot.notes,
    diagnostics: snapshot.diagnostics,
  };

  await persistSyncTimestamp(snapshot.integration_id, snapshot.network_partner_id, {
    resource: snapshot.resource,
    mode: snapshot.mode,
    preview_counts: snapshot.counts,
    created_count: createdCount,
    updated_count: updatedCount,
    skipped_count: skippedCount,
    error_count: errorCount,
    synced_at: new Date().toISOString(),
  });

  return result;
}
