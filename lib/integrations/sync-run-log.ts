import type { CrmSyncResult } from "@/lib/integrations/crm-sync";
import type { CrmSyncMode, CrmSyncResource, PartnerIntegration } from "@/lib/providers/types";
import { createAdminClient } from "@/utils/supabase/admin";

const TABLE_NAME = "integration_sync_runs";

type AdminClient = ReturnType<typeof createAdminClient>;

export type SyncRunLogEntry = {
  at: string;
  step: string;
  status: "running" | "ok" | "warning" | "error";
  message: string;
};

export type IntegrationSyncRunTrigger = "admin_manual" | "auto_scheduler";
export type IntegrationSyncRunStatus =
  | "running"
  | "success"
  | "error"
  | "cancel_requested"
  | "cancelled"
  | "expired";

type IntegrationIdentity = Pick<PartnerIntegration, "id" | "partner_id" | "kind" | "provider">;

type StartRunInput = {
  integration: IntegrationIdentity;
  resource: CrmSyncResource;
  mode: CrmSyncMode | null;
  triggeredBy: IntegrationSyncRunTrigger;
  triggerUserId?: string | null;
  syncJobId: string;
  traceId?: string | null;
  startedAt: string;
  heartbeatAt?: string | null;
  deadlineAt?: string | null;
  message?: string | null;
  step?: string | null;
  timeoutMs?: number | null;
  metadata?: Record<string, unknown> | null;
};

type UpdateRunInput = {
  integrationId: string;
  syncJobId: string;
  status?: IntegrationSyncRunStatus;
  step?: string | null;
  message?: string | null;
  error?: string | null;
  errorClass?: string | null;
  heartbeatAt?: string | null;
  deadlineAt?: string | null;
  cancelRequested?: boolean;
  finishedAt?: string | null;
  durationMs?: number | null;
  requestCount?: number | null;
  pagesFetched?: number | null;
  rawOffersCount?: number | null;
  offersCount?: number | null;
  referencesCount?: number | null;
  requestsCount?: number | null;
  deactivatedRawOffers?: number | null;
  deactivatedOffers?: number | null;
  safetyLimited?: boolean;
  log?: SyncRunLogEntry[] | null;
  notes?: string[] | null;
  resultJson?: CrmSyncResult | Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function pickDefinedEntries(source: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

function hasMissingTableMessage(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : isObject(error) && typeof error.message === "string"
        ? error.message
        : "";
  const lower = message.toLowerCase();
  return lower.includes("relation") && lower.includes(TABLE_NAME);
}

function hasSafetyLimit(result: CrmSyncResult | Record<string, unknown> | null | undefined): boolean {
  if (!result || !("notes" in result)) return false;
  const notes = Array.isArray(result.notes) ? result.notes : [];
  return notes.some((note) => typeof note === "string" && note.toLowerCase().includes("full sync safety:"));
}

async function safeLogOperation<T>(operation: () => Promise<T>): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    const label = hasMissingTableMessage(error) ? "missing table" : "write failed";
    console.error(`[integration-sync-runs] ${label}:`, error);
    return null;
  }
}

export async function startIntegrationSyncRun(
  admin: AdminClient,
  input: StartRunInput,
): Promise<void> {
  await safeLogOperation(async () => {
    const metadata =
      input.timeoutMs !== null && input.timeoutMs !== undefined
        ? {
            ...(input.metadata ?? {}),
            timeout_ms: input.timeoutMs,
          }
        : (input.metadata ?? null);
    const row = pickDefinedEntries({
      integration_id: input.integration.id,
      partner_id: input.integration.partner_id,
      kind: input.integration.kind,
      provider: input.integration.provider,
      resource: input.resource,
      mode: input.mode,
      triggered_by: input.triggeredBy,
      trigger_user_id: input.triggerUserId ?? null,
      sync_job_id: input.syncJobId,
      trace_id: input.traceId ?? null,
      status: "running",
      step: input.step ?? "started",
      message: input.message ?? "CRM-Synchronisierung gestartet.",
      started_at: input.startedAt,
      heartbeat_at: input.heartbeatAt ?? input.startedAt,
      deadline_at: input.deadlineAt ?? null,
      metadata,
    });

    const { error } = await admin.from(TABLE_NAME).insert(row);
    if (error) throw new Error(error.message);
  });
}

export async function updateIntegrationSyncRun(
  admin: AdminClient,
  input: UpdateRunInput,
): Promise<void> {
  await safeLogOperation(async () => {
    const row = pickDefinedEntries({
      status: input.status,
      step: input.step,
      message: input.message,
      error: input.error,
      error_class: input.errorClass,
      heartbeat_at: input.heartbeatAt,
      deadline_at: input.deadlineAt,
      cancel_requested: input.cancelRequested,
      finished_at: input.finishedAt,
      duration_ms: input.durationMs,
      request_count: input.requestCount,
      pages_fetched: input.pagesFetched,
      raw_offers_count: input.rawOffersCount,
      offers_count: input.offersCount,
      references_count: input.referencesCount,
      requests_count: input.requestsCount,
      deactivated_raw_offers: input.deactivatedRawOffers,
      deactivated_offers: input.deactivatedOffers,
      safety_limited: input.safetyLimited,
      log: input.log,
      notes: input.notes,
      result_json: input.resultJson,
      metadata: input.metadata,
      updated_at: new Date().toISOString(),
    });

    const { error } = await admin
      .from(TABLE_NAME)
      .update(row)
      .eq("integration_id", input.integrationId)
      .eq("sync_job_id", input.syncJobId);

    if (error) throw new Error(error.message);
  });
}

export async function markIntegrationSyncRunSuccess(
  admin: AdminClient,
  integrationId: string,
  syncJobId: string,
  result: CrmSyncResult,
  options: {
    finishedAt: string;
    durationMs: number;
    message: string;
    step: string;
    heartbeatAt?: string | null;
    log?: SyncRunLogEntry[] | null;
  },
): Promise<void> {
  await updateIntegrationSyncRun(admin, {
    integrationId,
    syncJobId,
    status: "success",
    step: options.step,
    message: options.message,
    heartbeatAt: options.heartbeatAt ?? options.finishedAt,
    cancelRequested: false,
    finishedAt: options.finishedAt,
    durationMs: options.durationMs,
    requestCount: result.provider_request_count ?? null,
    pagesFetched: result.provider_pages_fetched ?? null,
    rawOffersCount: result.raw_offers_count,
    offersCount: result.offers_count,
    referencesCount: result.references_count,
    requestsCount: result.requests_count,
    deactivatedRawOffers: result.deactivated_raw_offers,
    deactivatedOffers: result.deactivated_offers,
    safetyLimited: hasSafetyLimit(result),
    log: options.log ?? null,
    notes: result.notes ?? null,
    resultJson: result,
  });
}

export async function markIntegrationSyncRunError(
  admin: AdminClient,
  integrationId: string,
  syncJobId: string,
  options: {
    status?: IntegrationSyncRunStatus;
    finishedAt: string;
    durationMs?: number | null;
    step: string;
    message: string;
    errorClass?: string | null;
    heartbeatAt?: string | null;
    cancelRequested?: boolean;
    requestCount?: number | null;
    pagesFetched?: number | null;
    log?: SyncRunLogEntry[] | null;
    metadata?: Record<string, unknown> | null;
  },
): Promise<void> {
  await updateIntegrationSyncRun(admin, {
    integrationId,
    syncJobId,
    status: options.status ?? "error",
    step: options.step,
    message: options.message,
    error: options.message,
    errorClass: options.errorClass ?? null,
    heartbeatAt: options.heartbeatAt ?? options.finishedAt,
    cancelRequested: options.cancelRequested ?? false,
    finishedAt: options.finishedAt,
    durationMs: options.durationMs ?? null,
    requestCount: options.requestCount ?? null,
    pagesFetched: options.pagesFetched ?? null,
    log: options.log ?? null,
    metadata: options.metadata ?? null,
  });
}
