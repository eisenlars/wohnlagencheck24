import { createHash, randomUUID } from "node:crypto";

import { createAdminClient } from "@/utils/supabase/admin";
import { readCrmResourceLimits } from "@/lib/integrations/settings";
import { runCrmIntegrationSync, type CrmSyncResult } from "@/lib/integrations/crm-sync";
import {
  createPartnerTriggerEventLog,
  finishPartnerTriggerEventLog,
} from "@/lib/integrations/triggers/event-log";
import type {
  NormalizedPartnerTriggerEvent,
  PartnerIntegrationTriggerDispatchResult,
  ResolvedPartnerTriggerIntegration,
} from "@/lib/integrations/triggers/types";
import {
  markIntegrationSyncRunError,
  markIntegrationSyncRunSuccess,
  startIntegrationSyncRun,
  updateIntegrationSyncRun,
  type SyncRunLogEntry,
} from "@/lib/integrations/sync-run-log";
import type { CrmSyncMode, CrmSyncResource, PartnerIntegration } from "@/lib/providers/types";

const DEFAULT_SYNC_TIMEOUT_MS = 300_000;
const MIN_SYNC_TIMEOUT_MS = 15_000;
const MAX_SYNC_TIMEOUT_MS = 300_000;
const SYNC_LOG_LIMIT = 20;

type AdminClient = ReturnType<typeof createAdminClient>;
type ScopedSyncResource = Exclude<CrmSyncResource, "all"> | "all";
type IntegrationRow = PartnerIntegration & {
  last_sync_at?: string | null;
};
type SyncLogEntry = {
  at: string;
  step: string;
  status: "running" | "ok" | "warning" | "error";
  message: string;
};

class SyncControlError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "SyncControlError";
    this.code = code;
  }
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asLogEntries(value: unknown): SyncLogEntry[] {
  return Array.isArray(value)
    ? value.filter((item): item is SyncLogEntry => Boolean(item) && typeof item === "object")
    : [];
}

function appendSyncLog(value: unknown, entry: SyncLogEntry, limit = SYNC_LOG_LIMIT): SyncLogEntry[] {
  return [...asLogEntries(value), entry].slice(-limit);
}

function asRunLogEntries(value: unknown): SyncRunLogEntry[] {
  return asLogEntries(value);
}

function clampSyncTimeoutMs(value: number | null | undefined): number {
  if (!Number.isFinite(value ?? Number.NaN)) return DEFAULT_SYNC_TIMEOUT_MS;
  const normalized = Math.floor(Number(value));
  if (normalized <= 0) return DEFAULT_SYNC_TIMEOUT_MS;
  return Math.max(MIN_SYNC_TIMEOUT_MS, Math.min(MAX_SYNC_TIMEOUT_MS, normalized));
}

function readSyncRuntime(settings: Record<string, unknown>, resource: ScopedSyncResource): Record<string, unknown> {
  if (resource === "all") return settings;
  const runtimes = asObject(settings.sync_resources);
  return asObject(runtimes[resource]);
}

function writeSyncRuntime(
  settings: Record<string, unknown>,
  resource: ScopedSyncResource,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const nextSettings: Record<string, unknown> = {
    ...settings,
    ...patch,
  };
  if (resource !== "all") {
    const runtimes = { ...asObject(settings.sync_resources) };
    const current = asObject(runtimes[resource]);
    runtimes[resource] = {
      ...current,
      ...patch,
    };
    nextSettings.sync_resources = runtimes;
  }
  return nextSettings;
}

function resolveSyncTimeoutMs(
  settings: Record<string, unknown>,
  resource: ScopedSyncResource,
  mode: CrmSyncMode,
): number {
  if (resource === "all") return DEFAULT_SYNC_TIMEOUT_MS;
  const limits = readCrmResourceLimits(settings, resource, mode);
  return clampSyncTimeoutMs(limits.max_runtime_ms);
}

function formatSuccessMessage(result: CrmSyncResult): string {
  if (result.skipped) {
    if (result.reason === "integration inactive") return "Die CRM-Anbindung ist deaktiviert.";
    if (result.reason === "all capabilities disabled") return "Alle CRM-Bereiche sind deaktiviert.";
    return "CRM-Synchronisierung wurde übersprungen.";
  }
  const parts = [
    `${result.offers_count} Angebote`,
    `${result.references_count} Referenzen`,
    `${result.requests_count} Gesuche`,
  ];
  const extras: string[] = [];
  if (result.deactivated_offers > 0) extras.push(`${result.deactivated_offers} Angebote deaktiviert`);
  if (result.deactivated_raw_offers > 0) extras.push(`${result.deactivated_raw_offers} Rohangebote deaktiviert`);
  return `${parts.join(" · ")} synchronisiert${extras.length ? ` · ${extras.join(" · ")}` : ""}`;
}

function classifySyncError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("zeitlimit")) return "timeout";
  if (lower.includes("fehlendem heartbeat")) return "heartbeat_timeout";
  if (lower.includes("veraltetem lauf")) return "stale_run";
  if (lower.includes("upsert failed") || lower.includes("partner_property_offers")) return "db_write_error";
  if (lower.includes("projection")) return "projection_error";
  if (lower.includes("rate limit") || lower.includes("(429)")) return "crm_rate_limited";
  if (lower.includes("api-key fehlt") || lower.includes("base url fehlt") || lower.includes("blockiert")) return "config_error";
  if (lower.includes("fetch failed") || lower.includes("timed out")) return "crm_network_error";
  return "sync_error";
}

function normalizeSyncError(error: unknown): { message: string; errorClass: string } {
  if (error instanceof SyncControlError) {
    return {
      message: error.message,
      errorClass: error.code,
    };
  }
  if (error instanceof Error) {
    return {
      message: error.message,
      errorClass: classifySyncError(error.message),
    };
  }
  return {
    message: "CRM-Synchronisierung fehlgeschlagen.",
    errorClass: "sync_error",
  };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new SyncControlError(message, "timeout")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function loadIntegration(admin: AdminClient, integrationId: string): Promise<IntegrationRow | null> {
  const { data, error } = await admin
    .from("partner_integrations")
    .select("id, partner_id, kind, provider, base_url, auth_type, auth_config, detail_url_template, is_active, settings, last_sync_at")
    .eq("id", integrationId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as IntegrationRow | null) ?? null;
}

async function patchSyncSettings(
  admin: AdminClient,
  integrationId: string,
  resource: ScopedSyncResource,
  patch: Record<string, unknown>,
  options?: {
    expectedJobId?: string;
    logEntry?: SyncLogEntry | null;
  },
): Promise<void> {
  const current = await loadIntegration(admin, integrationId);
  if (!current) throw new Error("Integration not found");

  const currentSettings = asObject(current.settings);
  if (options?.expectedJobId && String(currentSettings.sync_job_id ?? "") !== options.expectedJobId) {
    return;
  }

  const nextSettings = writeSyncRuntime(currentSettings, resource, patch);

  if (options?.logEntry) {
    nextSettings.sync_log = appendSyncLog(nextSettings.sync_log, options.logEntry);
    if (resource !== "all") {
      const runtimes = { ...asObject(nextSettings.sync_resources) };
      const runtime = asObject(runtimes[resource]);
      runtime.sync_log = appendSyncLog(runtime.sync_log, options.logEntry);
      runtimes[resource] = runtime;
      nextSettings.sync_resources = runtimes;
    }
  }

  const { error } = await admin
    .from("partner_integrations")
    .update({ settings: nextSettings })
    .eq("id", integrationId);

  if (error) throw new Error(error.message);
}

async function updateRunningSyncProgress(
  admin: AdminClient,
  integrationId: string,
  resource: ScopedSyncResource,
  jobId: string,
  step: string,
  message: string,
) {
  const now = new Date().toISOString();
  await patchSyncSettings(
    admin,
    integrationId,
    resource,
    {
      sync_step: step,
      sync_message: message,
      sync_heartbeat_at: now,
    },
    {
      expectedJobId: jobId,
      logEntry: {
        at: now,
        step,
        status: "running",
        message,
      },
    },
  );
  await updateIntegrationSyncRun(admin, {
    integrationId,
    syncJobId: jobId,
    status: "running",
    step,
    message,
    heartbeatAt: now,
  });
}

async function finalizeSyncSuccess(
  admin: AdminClient,
  integrationId: string,
  resource: ScopedSyncResource,
  jobId: string,
  result: CrmSyncResult,
  startedAtMs: number,
) {
  const now = new Date().toISOString();
  const message = formatSuccessMessage(result);
  const onOfficeDeltaSuccessPatch =
    result.provider === "onoffice" && (resource === "offers" || resource === "references")
      ? { onoffice_delta_last_success_at: now }
      : {};
  await patchSyncSettings(
    admin,
    integrationId,
    resource,
    {
      sync_state: "success",
      sync_job_id: null,
      sync_step: "completed",
      sync_mode: result.mode,
      sync_resource: result.resource,
      sync_heartbeat_at: now,
      sync_deadline_at: null,
      sync_cancel_requested: false,
      sync_cancel_requested_at: null,
      sync_finished_at: now,
      sync_message: message,
      sync_error: null,
      sync_error_class: null,
      sync_request_count: result.provider_request_count ?? null,
      sync_pages_fetched: result.provider_pages_fetched ?? null,
      sync_result: result,
      sync_timeout_ms: null,
      last_sync_at: now,
      ...onOfficeDeltaSuccessPatch,
    },
    {
      expectedJobId: jobId,
      logEntry: {
        at: now,
        step: "completed",
        status: "ok",
        message,
      },
    },
  );
  const current = await loadIntegration(admin, integrationId);
  const runtime = current ? readSyncRuntime(asObject(current.settings), resource) : {};
  await markIntegrationSyncRunSuccess(admin, integrationId, jobId, result, {
    finishedAt: now,
    durationMs: Math.max(0, Date.now() - startedAtMs),
    message,
    step: "completed",
    heartbeatAt: now,
    log: asRunLogEntries(runtime.sync_log),
  });
}

async function finalizeSyncError(
  admin: AdminClient,
  integrationId: string,
  resource: ScopedSyncResource,
  jobId: string,
  message: string,
  startedAtMs: number,
  errorClass?: string,
) {
  const now = new Date().toISOString();
  await patchSyncSettings(
    admin,
    integrationId,
    resource,
    {
      sync_state: "error",
      sync_job_id: null,
      sync_step: "failed",
      sync_heartbeat_at: now,
      sync_deadline_at: null,
      sync_cancel_requested: false,
      sync_cancel_requested_at: null,
      sync_finished_at: now,
      sync_message: message,
      sync_error: message,
      sync_error_class: errorClass ?? classifySyncError(message),
      sync_result: null,
      sync_timeout_ms: null,
    },
    {
      expectedJobId: jobId,
      logEntry: {
        at: now,
        step: "failed",
        status: "error",
        message,
      },
    },
  );
  const current = await loadIntegration(admin, integrationId);
  const runtime = current ? readSyncRuntime(asObject(current.settings), resource) : {};
  await markIntegrationSyncRunError(admin, integrationId, jobId, {
    finishedAt: now,
    durationMs: Math.max(0, Date.now() - startedAtMs),
    step: "failed",
    message,
    errorClass: errorClass ?? classifySyncError(message),
    heartbeatAt: now,
    log: asRunLogEntries(runtime.sync_log),
  });
}

async function ensureSyncCanContinue(admin: AdminClient, integrationId: string, jobId: string) {
  const current = await loadIntegration(admin, integrationId);
  if (!current) throw new Error("Integration not found");
  const settings = asObject(current.settings);
  if (String(settings.sync_job_id ?? "") !== jobId) {
    throw new SyncControlError("CRM-Synchronisierung wurde ersetzt oder zurückgesetzt.", "stale_run");
  }
}

export function buildPartnerTriggerDedupeKey(args: {
  provider: string;
  integrationId: string;
  eventType: string;
  resourceType: string;
  resourceId: string | null;
  rawBody: string;
}): string {
  return createHash("sha256")
    .update(
      [
        args.provider,
        args.integrationId,
        args.eventType,
        args.resourceType,
        args.resourceId ?? "",
        args.rawBody,
      ].join("::"),
    )
    .digest("hex");
}

export async function dispatchPartnerTriggerEvent(
  event: NormalizedPartnerTriggerEvent,
): Promise<PartnerIntegrationTriggerDispatchResult> {
  const eventLog = await createPartnerTriggerEventLog(event);
  if (eventLog.duplicate) {
    return {
      accepted: true,
      status: "duplicate",
      message: "Duplikat-Event ignoriert.",
      resource: event.suggested_resource,
      sync_job_id: null,
    };
  }

  if (event.suggested_resource === "ignored") {
    await finishPartnerTriggerEventLog({
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
      sync_job_id: null,
    };
  }

  const admin = createAdminClient();
  const currentIntegration = await loadIntegration(admin, event.integration_id);
  if (!currentIntegration) {
    await finishPartnerTriggerEventLog({
      id: eventLog.id,
      status: "error",
      error: "Integration nicht gefunden.",
    });
    throw new Error("NOT_FOUND");
  }

  const currentSettings = asObject(currentIntegration.settings);
  if (String(currentSettings.sync_state ?? "").trim().toLowerCase() === "running") {
    await finishPartnerTriggerEventLog({
      id: eventLog.id,
      status: "ignored",
      summary: {
        event_type: event.event_type,
        resource_type: event.resource_type,
        reason: "sync_already_running",
      },
    });
    return {
      accepted: true,
      status: "ignored",
      message: "Ein CRM-Sync läuft bereits. Das Trigger-Signal wurde protokolliert.",
      resource: event.suggested_resource,
      sync_job_id: null,
    };
  }

  const resource = event.suggested_resource;
  const jobId = randomUUID();
  const traceId = event.dedupe_key;
  const startedAtMs = Date.now();
  const now = new Date().toISOString();
  const syncTimeoutMs = resolveSyncTimeoutMs(currentSettings, resource, event.suggested_mode);
  const deadlineAt = new Date(Date.now() + syncTimeoutMs).toISOString();

  await patchSyncSettings(
    admin,
    event.integration_id,
    resource,
    {
      sync_state: "running",
      sync_job_id: jobId,
      sync_trace_id: traceId,
      sync_resource: resource,
      sync_mode: event.suggested_mode,
      sync_step: "started",
      sync_started_at: now,
      sync_finished_at: null,
      sync_message: "Automatische CRM-Aktualisierung gestartet.",
      sync_error: null,
      sync_error_class: null,
      sync_request_count: null,
      sync_pages_fetched: null,
      sync_result: null,
      sync_timeout_ms: syncTimeoutMs,
      sync_heartbeat_at: now,
      sync_deadline_at: deadlineAt,
      sync_cancel_requested: false,
      sync_cancel_requested_at: null,
      sync_log: [],
    },
    {
      logEntry: {
        at: now,
        step: "started",
        status: "running",
        message: "Automatische CRM-Aktualisierung gestartet.",
      },
    },
  );

  await startIntegrationSyncRun(admin, {
    integration: currentIntegration as ResolvedPartnerTriggerIntegration,
    resource,
    mode: event.suggested_mode,
    triggeredBy: "auto_scheduler",
    syncJobId: jobId,
    traceId,
    startedAt: now,
    heartbeatAt: now,
    deadlineAt,
    message: "Automatische CRM-Aktualisierung gestartet.",
    step: "started",
    timeoutMs: syncTimeoutMs,
    metadata: {
      trigger: "webhook",
      trigger_event_type: event.event_type,
      trigger_resource_type: event.resource_type,
      trigger_resource_id: event.resource_id,
      trigger_received_at: event.received_at,
      verification: event.verification,
      changed_fields: event.changed_fields,
    },
  });

  try {
    await updateRunningSyncProgress(
      admin,
      event.integration_id,
      resource,
      jobId,
      "prepare",
      "Trigger-Signal empfangen. Aktualisierung wird vorbereitet.",
    );
    const freshIntegration = await loadIntegration(admin, event.integration_id);
    if (!freshIntegration) throw new Error("Integration not found");

    const result = await withTimeout(
      runCrmIntegrationSync(
        admin,
        freshIntegration,
        { resource, mode: event.suggested_mode, triggeredBy: "auto_scheduler" },
        {
          onProgress: async (step, message) => {
            await ensureSyncCanContinue(admin, event.integration_id, jobId);
            await updateRunningSyncProgress(admin, event.integration_id, resource, jobId, step, message);
          },
          assertCanContinue: async () => {
            await ensureSyncCanContinue(admin, event.integration_id, jobId);
          },
        },
      ),
      syncTimeoutMs,
      "CRM-Aktualisierung wegen Zeitlimit beendet.",
    );

    await finalizeSyncSuccess(admin, event.integration_id, resource, jobId, result, startedAtMs);
    await finishPartnerTriggerEventLog({
      id: eventLog.id,
      status: "processed",
      syncJobId: jobId,
      summary: {
        sync_status: result.skipped ? "skipped" : "success",
        offers_count: result.offers_count,
        references_count: result.references_count,
        requests_count: result.requests_count,
        provider_request_count: result.provider_request_count ?? null,
      },
    });
    return {
      accepted: true,
      status: "processed",
      message: "Trigger verarbeitet und CRM-Aktualisierung angestoßen.",
      resource,
      sync_job_id: jobId,
    };
  } catch (error) {
    const normalized = normalizeSyncError(error);
    await finalizeSyncError(
      admin,
      event.integration_id,
      resource,
      jobId,
      normalized.message,
      startedAtMs,
      normalized.errorClass,
    );
    await finishPartnerTriggerEventLog({
      id: eventLog.id,
      status: "error",
      syncJobId: jobId,
      error: normalized.message,
      summary: {
        error_class: normalized.errorClass,
      },
    });
    throw error;
  }
}
