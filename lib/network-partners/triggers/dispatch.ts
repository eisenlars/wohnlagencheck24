import { createHash } from "node:crypto";

import { runNetworkPartnerWriteSync } from "@/lib/network-partners/sync/write-sync";
import {
  createNetworkPartnerSyncRun,
  finishNetworkPartnerSyncRun,
} from "@/lib/network-partners/sync/sync-run-log";
import { createTriggerEventLog, finishTriggerEventLog } from "@/lib/network-partners/triggers/event-log";
import type {
  IntegrationTriggerDispatchResult,
  NormalizedIntegrationTriggerEvent,
} from "@/lib/network-partners/triggers/types";

export function buildTriggerDedupeKey(args: {
  provider: string;
  integrationId: string;
  eventType: string;
  resourceType: string;
  resourceId: string | null;
  rawBody: string;
}): string {
  return createHash("sha256")
    .update([
      args.provider,
      args.integrationId,
      args.eventType,
      args.resourceType,
      args.resourceId ?? "",
      args.rawBody,
    ].join("::"))
    .digest("hex");
}

export async function dispatchNormalizedTriggerEvent(
  event: NormalizedIntegrationTriggerEvent,
): Promise<IntegrationTriggerDispatchResult> {
  const eventLog = await createTriggerEventLog(event);
  if (eventLog.duplicate) {
    return {
      accepted: true,
      status: "duplicate",
      message: "Duplikat-Event ignoriert.",
      resource: event.suggested_resource,
      sync_run_id: null,
    };
  }

  if (event.suggested_resource === "ignored") {
    await finishTriggerEventLog({
      id: eventLog.id,
      status: "ignored",
      summary: {
        event_type: event.event_type,
        resource_type: event.resource_type,
        reason: "unsupported_event",
      },
    });
    return {
      accepted: true,
      status: "ignored",
      message: "Event wurde protokolliert, aber nicht synchronisiert.",
      resource: "ignored",
      sync_run_id: null,
    };
  }

  const run = await createNetworkPartnerSyncRun({
    integrationId: event.integration_id,
    portalPartnerId: event.portal_partner_id,
    networkPartnerId: event.network_partner_id,
    runKind: "sync",
    runMode: event.suggested_mode,
    traceId: event.dedupe_key,
    summary: {
      trigger_source: event.source,
      trigger_event_type: event.event_type,
      trigger_resource_type: event.resource_type,
      trigger_resource_id: event.resource_id,
      changed_fields: event.changed_fields,
      verification: event.verification,
    },
  });

  try {
    const result = await runNetworkPartnerWriteSync({
      integrationId: event.integration_id,
      networkPartnerId: event.network_partner_id,
      resource: event.suggested_resource === "ignored" ? "all" : event.suggested_resource,
      mode: event.suggested_mode,
    });

    const status = result.error_count > 0 ? "warning" : "ok";
    await finishNetworkPartnerSyncRun({
      runId: run.id,
      integrationId: event.integration_id,
      networkPartnerId: event.network_partner_id,
      status,
      summary: {
        trigger_source: event.source,
        trigger_event_type: event.event_type,
        trigger_resource_type: event.resource_type,
        trigger_resource_id: event.resource_id,
        verification: event.verification,
        created_count: result.created_count,
        updated_count: result.updated_count,
        skipped_count: result.skipped_count,
        error_count: result.error_count,
      },
      diagnostics: {
        ...result.diagnostics,
        changed_fields: event.changed_fields,
      },
    });
    await finishTriggerEventLog({
      id: eventLog.id,
      status: "processed",
      syncRunId: run.id,
      summary: {
        sync_status: status,
        created_count: result.created_count,
        updated_count: result.updated_count,
        skipped_count: result.skipped_count,
        error_count: result.error_count,
      },
    });
    return {
      accepted: true,
      status: "processed",
      message: "Trigger verarbeitet und guarded Sync angestoßen.",
      resource: event.suggested_resource,
      sync_run_id: run.id,
    };
  } catch (error) {
    await finishNetworkPartnerSyncRun({
      runId: run.id,
      integrationId: event.integration_id,
      networkPartnerId: event.network_partner_id,
      status: "error",
      summary: {
        trigger_source: event.source,
        trigger_event_type: event.event_type,
        trigger_resource_type: event.resource_type,
        trigger_resource_id: event.resource_id,
        error: error instanceof Error ? error.message : "trigger_dispatch_failed",
      },
      diagnostics: {
        changed_fields: event.changed_fields,
      },
    });
    await finishTriggerEventLog({
      id: eventLog.id,
      status: "error",
      syncRunId: run.id,
      error: error instanceof Error ? error.message : "trigger_dispatch_failed",
    });
    throw error;
  }
}
