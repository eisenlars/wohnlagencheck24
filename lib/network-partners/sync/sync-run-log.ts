import { createAdminClient } from "@/utils/supabase/admin";

import type {
  NetworkPartnerIntegrationSyncRunRecord,
  NetworkPartnerPreviewSyncMode,
} from "@/lib/network-partners/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asText(value: unknown): string | null {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

function mapRunRow(row: Record<string, unknown>): NetworkPartnerIntegrationSyncRunRecord {
  const summary = isRecord(row.summary) ? row.summary : null;
  const diagnostics = isRecord(row.diagnostics) ? row.diagnostics : null;
  const runKind = asText(row.run_kind);
  const runMode = asText(row.run_mode);
  const status = asText(row.status);

  if (
    runKind !== "test"
    && runKind !== "preview"
    && runKind !== "sync"
  ) {
    throw new Error("INVALID_SYNC_RUN_KIND");
  }
  if (runMode !== "guarded" && runMode !== "full") {
    throw new Error("INVALID_SYNC_RUN_MODE");
  }
  if (status !== "running" && status !== "ok" && status !== "warning" && status !== "error") {
    throw new Error("INVALID_SYNC_RUN_STATUS");
  }

  return {
    id: String(row.id ?? ""),
    integration_id: String(row.integration_id ?? ""),
    portal_partner_id: String(row.portal_partner_id ?? ""),
    network_partner_id: String(row.network_partner_id ?? ""),
    run_kind: runKind,
    run_mode: runMode,
    status,
    trace_id: asText(row.trace_id),
    summary,
    diagnostics,
    started_at: String(row.started_at ?? ""),
    finished_at: asText(row.finished_at),
    created_at: String(row.created_at ?? ""),
  };
}

export async function createNetworkPartnerSyncRun(input: {
  integrationId: string;
  portalPartnerId: string;
  networkPartnerId: string;
  runKind: "test" | "preview" | "sync";
  runMode: NetworkPartnerPreviewSyncMode;
  traceId?: string | null;
  summary?: Record<string, unknown> | null;
  diagnostics?: Record<string, unknown> | null;
}): Promise<NetworkPartnerIntegrationSyncRunRecord> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("network_partner_integration_sync_runs")
    .insert({
      integration_id: input.integrationId,
      portal_partner_id: input.portalPartnerId,
      network_partner_id: input.networkPartnerId,
      run_kind: input.runKind,
      run_mode: input.runMode,
      status: "running",
      trace_id: input.traceId ?? null,
      summary: input.summary ?? null,
      diagnostics: input.diagnostics ?? null,
    })
    .select("id, integration_id, portal_partner_id, network_partner_id, run_kind, run_mode, status, trace_id, summary, diagnostics, started_at, finished_at, created_at")
    .maybeSingle();

  if (error) throw new Error(error.message ?? "SYNC_RUN_CREATE_FAILED");
  if (!isRecord(data)) throw new Error("SYNC_RUN_CREATE_FAILED");
  return mapRunRow(data);
}

export async function finishNetworkPartnerSyncRun(input: {
  runId: string;
  integrationId: string;
  networkPartnerId: string;
  status: "ok" | "warning" | "error";
  summary?: Record<string, unknown> | null;
  diagnostics?: Record<string, unknown> | null;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("network_partner_integration_sync_runs")
    .update({
      status: input.status,
      summary: input.summary ?? null,
      diagnostics: input.diagnostics ?? null,
      finished_at: new Date().toISOString(),
    })
    .eq("id", input.runId)
    .eq("integration_id", input.integrationId)
    .eq("network_partner_id", input.networkPartnerId);

  if (error) throw new Error(error.message ?? "SYNC_RUN_UPDATE_FAILED");
}

export async function listNetworkPartnerSyncRuns(input: {
  integrationId: string;
  networkPartnerId: string;
  limit?: number;
}): Promise<NetworkPartnerIntegrationSyncRunRecord[]> {
  const admin = createAdminClient();
  const limit = Math.max(1, Math.min(Number(input.limit ?? 12), 50));
  const { data, error } = await admin
    .from("network_partner_integration_sync_runs")
    .select("id, integration_id, portal_partner_id, network_partner_id, run_kind, run_mode, status, trace_id, summary, diagnostics, started_at, finished_at, created_at")
    .eq("integration_id", input.integrationId)
    .eq("network_partner_id", input.networkPartnerId)
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message ?? "SYNC_RUN_LIST_FAILED");
  return (Array.isArray(data) ? data : []).flatMap((row) => {
    if (!isRecord(row)) return [];
    return [mapRunRow(row)];
  });
}
