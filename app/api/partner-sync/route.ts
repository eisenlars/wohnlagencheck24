import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

import { createAdminClient } from "@/utils/supabase/admin";
import {
  readCrmResourceLimits,
  readCrmResourceSettings,
} from "@/lib/integrations/settings";
import {
  markIntegrationSyncRunError,
  markIntegrationSyncRunSuccess,
  startIntegrationSyncRun,
  updateIntegrationSyncRun,
  type SyncRunLogEntry,
} from "@/lib/integrations/sync-run-log";
import { runCrmIntegrationSync, type CrmSyncResult } from "@/lib/integrations/crm-sync";
import type { CrmSyncMode, PartnerIntegration } from "@/lib/providers/types";

export const maxDuration = 300;

const SYNC_KIND = "crm";
const DEFAULT_SYNC_TIMEOUT_MS = 300_000;
const MIN_SYNC_TIMEOUT_MS = 15_000;
const MAX_SYNC_TIMEOUT_MS = 300_000;
const SYNC_STALE_HEARTBEAT_MS = 20_000;
const SYNC_STALE_GRACE_MS = 15_000;
const SYNC_LOG_LIMIT = 20;
const DEFAULT_MAX_JOBS_PER_RUN = 1;
const MAX_JOBS_PER_RUN = 12;
const BERLIN_TIMEZONE = "Europe/Berlin";

type IntegrationRow = PartnerIntegration & {
  last_sync_at?: string | null;
};

type ScopedSyncResource = "offers" | "references" | "requests";

type SyncLogEntry = {
  at: string;
  step: string;
  status: "running" | "ok" | "warning" | "error";
  message: string;
};

type ScheduledSyncJob = {
  integration: IntegrationRow;
  resource: ScopedSyncResource;
  mode: CrmSyncMode;
  timeoutMs: number;
  intervalMinutes: number;
  nightOnly: boolean;
};

type SyncResult = CrmSyncResult & {
  error?: string;
  skipped_reason?: string;
};

class SyncControlError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "SyncControlError";
    this.code = code;
  }
}

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
  return "";
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function asIsoMs(value: unknown): number | null {
  const text = asText(value);
  if (!text) return null;
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function appendSyncLog(value: unknown, entry: SyncLogEntry, limit = SYNC_LOG_LIMIT): SyncLogEntry[] {
  const current = Array.isArray(value)
    ? value.filter((item): item is SyncLogEntry => Boolean(item) && typeof item === "object")
    : [];
  return [...current, entry].slice(-limit);
}

function asRunLogEntries(value: unknown): SyncRunLogEntry[] {
  const current = Array.isArray(value)
    ? value.filter((item): item is SyncRunLogEntry => Boolean(item) && typeof item === "object")
    : [];
  return current;
}

function readSyncRuntime(settings: Record<string, unknown>, resource: ScopedSyncResource | "all"): Record<string, unknown> {
  if (resource === "all") return settings;
  const runtimes = asObject(settings.sync_resources);
  return asObject(runtimes[resource]);
}

function writeSyncRuntime(
  settings: Record<string, unknown>,
  resource: ScopedSyncResource | "all",
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

function clampSyncTimeoutMs(value: number | null | undefined): number {
  if (!Number.isFinite(value ?? NaN)) return DEFAULT_SYNC_TIMEOUT_MS;
  const normalized = Math.floor(Number(value));
  if (normalized <= 0) return DEFAULT_SYNC_TIMEOUT_MS;
  return Math.max(MIN_SYNC_TIMEOUT_MS, Math.min(MAX_SYNC_TIMEOUT_MS, normalized));
}

function resolveSyncTimeoutMs(
  settings: Record<string, unknown>,
  resource: ScopedSyncResource,
  mode: CrmSyncMode,
): number {
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
  if (result.deactivated_listings > 0) extras.push(`${result.deactivated_listings} Rohobjekte deaktiviert`);
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

function getStaleRunningMessage(settings: Record<string, unknown>): string | null {
  const state = String(settings.sync_state ?? "").trim().toLowerCase();
  if (state !== "running") return null;

  const now = Date.now();
  const timeoutMs = clampSyncTimeoutMs(asNumber(settings.sync_timeout_ms));
  const deadlineAt = asIsoMs(settings.sync_deadline_at);
  const heartbeatAt = asIsoMs(settings.sync_heartbeat_at);
  const startedAt = asIsoMs(settings.sync_started_at);

  if (deadlineAt && deadlineAt < now) return "CRM-Synchronisierung wegen Zeitlimit automatisch beendet.";
  if (heartbeatAt && heartbeatAt < now - SYNC_STALE_HEARTBEAT_MS) {
    return "CRM-Synchronisierung wegen fehlendem Heartbeat automatisch beendet.";
  }
  if (startedAt && startedAt < now - (timeoutMs + SYNC_STALE_GRACE_MS)) {
    return "CRM-Synchronisierung wegen veraltetem Lauf automatisch beendet.";
  }
  return null;
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

async function loadIntegration(
  admin: ReturnType<typeof createAdminClient>,
  integrationId: string,
): Promise<IntegrationRow | null> {
  const { data, error } = await admin
    .from("partner_integrations")
    .select("id, partner_id, kind, provider, base_url, auth_type, auth_config, detail_url_template, is_active, settings, last_sync_at")
    .eq("id", integrationId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as IntegrationRow | null) ?? null;
}

async function patchSyncSettings(
  admin: ReturnType<typeof createAdminClient>,
  integrationId: string,
  resource: ScopedSyncResource | "all",
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
  admin: ReturnType<typeof createAdminClient>,
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
  admin: ReturnType<typeof createAdminClient>,
  integrationId: string,
  resource: ScopedSyncResource,
  jobId: string,
  result: CrmSyncResult,
  startedAtMs: number,
) {
  const now = new Date().toISOString();
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
      sync_message: formatSuccessMessage(result),
      sync_error: null,
      sync_error_class: null,
      sync_request_count: result.provider_request_count ?? null,
      sync_pages_fetched: result.provider_pages_fetched ?? null,
      sync_result: result,
      sync_timeout_ms: null,
    },
    {
      expectedJobId: jobId,
      logEntry: {
        at: now,
        step: "completed",
        status: "ok",
        message: formatSuccessMessage(result),
      },
    },
  );
  const current = await loadIntegration(admin, integrationId);
  const runtime = current ? readSyncRuntime(asObject(current.settings), resource) : {};
  await markIntegrationSyncRunSuccess(admin, integrationId, jobId, result, {
    finishedAt: now,
    durationMs: Math.max(0, Date.now() - startedAtMs),
    message: formatSuccessMessage(result),
    step: "completed",
    heartbeatAt: now,
    log: asRunLogEntries(runtime.sync_log),
  });
}

async function finalizeSyncError(
  admin: ReturnType<typeof createAdminClient>,
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

async function expireStaleRunningSync(
  admin: ReturnType<typeof createAdminClient>,
  integration: IntegrationRow,
  message: string,
) {
  const settings = asObject(integration.settings);
  const jobId = asText(settings.sync_job_id);
  const now = new Date().toISOString();
  await patchSyncSettings(
    admin,
    integration.id,
    "all",
    {
      sync_state: "error",
      sync_job_id: null,
      sync_step: "expired",
      sync_heartbeat_at: now,
      sync_deadline_at: null,
      sync_cancel_requested: false,
      sync_cancel_requested_at: null,
      sync_finished_at: now,
      sync_message: message,
      sync_error: message,
      sync_error_class: "stale_run",
      sync_result: null,
      sync_timeout_ms: null,
    },
    {
      expectedJobId: jobId ?? undefined,
      logEntry: {
        at: now,
        step: "expired",
        status: "error",
        message,
      },
    },
  );
  if (jobId) {
    await markIntegrationSyncRunError(admin, integration.id, jobId, {
      status: "expired",
      finishedAt: now,
      step: "expired",
      message,
      errorClass: "stale_run",
      heartbeatAt: now,
    });
  }
}

async function ensureSyncCanContinue(
  admin: ReturnType<typeof createAdminClient>,
  integrationId: string,
  jobId: string,
) {
  const current = await loadIntegration(admin, integrationId);
  if (!current) throw new Error("Integration not found");
  const settings = asObject(current.settings);
  if (String(settings.sync_job_id ?? "") !== jobId) {
    throw new SyncControlError("CRM-Synchronisierung wurde ersetzt oder zurueckgesetzt.", "stale_run");
  }
  const staleMessage = getStaleRunningMessage(settings);
  if (staleMessage) throw new SyncControlError(staleMessage, classifySyncError(staleMessage));
}

function isBerlinNight(now = new Date()): boolean {
  const hourText = new Intl.DateTimeFormat("en-GB", {
    timeZone: BERLIN_TIMEZONE,
    hour: "2-digit",
    hour12: false,
  }).format(now);
  const hour = Number(hourText);
  return Number.isFinite(hour) && (hour >= 22 || hour < 6);
}

function parseRequestedLimit(req: Request): number {
  const { searchParams } = new URL(req.url);
  const raw = Number(searchParams.get("limit") ?? "");
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_MAX_JOBS_PER_RUN;
  return Math.max(1, Math.min(MAX_JOBS_PER_RUN, Math.floor(raw)));
}

function collectDueJobs(integration: IntegrationRow, nowMs: number): ScheduledSyncJob[] {
  const settings = asObject(integration.settings);
  if (String(settings.sync_state ?? "").trim().toLowerCase() === "running") return [];

  const jobs: ScheduledSyncJob[] = [];
  for (const resource of ["offers", "references", "requests"] as const) {
    const resourceSettings = readCrmResourceSettings(settings, resource);
    const autoSync = resourceSettings.auto_sync;
    if (!resourceSettings.enabled || !autoSync?.enabled || autoSync.interval_minutes === null) continue;
    if (autoSync.night_only && !isBerlinNight()) continue;

    const runtime = readSyncRuntime(settings, resource);
    const lastFinishedAt =
      asIsoMs(runtime.sync_finished_at)
      ?? asIsoMs(runtime.sync_started_at)
      ?? asIsoMs(integration.last_sync_at);
    const intervalMs = autoSync.interval_minutes * 60_000;
    const isDue = lastFinishedAt === null || lastFinishedAt <= nowMs - intervalMs;
    if (!isDue) continue;

    jobs.push({
      integration,
      resource,
      mode: "full",
      timeoutMs: resolveSyncTimeoutMs(settings, resource, "full"),
      intervalMinutes: autoSync.interval_minutes,
      nightOnly: autoSync.night_only,
    });
  }

  return jobs;
}

async function runScheduledSyncJob(
  admin: ReturnType<typeof createAdminClient>,
  job: ScheduledSyncJob,
): Promise<SyncResult> {
  let integration = await loadIntegration(admin, job.integration.id);
  if (!integration) {
    return {
      partner_id: job.integration.partner_id,
      provider: job.integration.provider,
      resource: job.resource,
      mode: job.mode,
      listings_count: 0,
      references_count: 0,
      requests_count: 0,
      offers_count: 0,
      deactivated_listings: 0,
      deactivated_offers: 0,
      skipped: false,
      error: "Integration not found",
    };
  }

  const staleMessage = getStaleRunningMessage(asObject(integration.settings));
  if (staleMessage) {
    await expireStaleRunningSync(admin, integration, staleMessage);
    integration = await loadIntegration(admin, job.integration.id);
    if (!integration) {
      return {
        partner_id: job.integration.partner_id,
        provider: job.integration.provider,
        resource: job.resource,
        mode: job.mode,
        listings_count: 0,
        references_count: 0,
        requests_count: 0,
        offers_count: 0,
        deactivated_listings: 0,
        deactivated_offers: 0,
        skipped: false,
        error: "Integration not found",
      };
    }
  }

  const currentState = String(asObject(integration.settings).sync_state ?? "").trim().toLowerCase();
  if (currentState === "running") {
    return {
      partner_id: integration.partner_id,
      provider: integration.provider,
      resource: job.resource,
      mode: job.mode,
      listings_count: 0,
      references_count: 0,
      requests_count: 0,
      offers_count: 0,
      deactivated_listings: 0,
      deactivated_offers: 0,
      skipped: true,
      skipped_reason: "integration already running",
    };
  }

  const jobId = crypto.randomUUID();
  const traceId = crypto.randomUUID();
  const startedAtMs = Date.now();
  const now = new Date().toISOString();
  const deadlineAt = new Date(Date.now() + job.timeoutMs).toISOString();

  await patchSyncSettings(
    admin,
    integration.id,
    job.resource,
    {
      sync_state: "running",
      sync_job_id: jobId,
      sync_trace_id: traceId,
      sync_resource: job.resource,
      sync_mode: job.mode,
      sync_step: "started",
      sync_started_at: now,
      sync_finished_at: null,
      sync_message: "Automatische CRM-Synchronisierung gestartet.",
      sync_error: null,
      sync_error_class: null,
      sync_request_count: null,
      sync_pages_fetched: null,
      sync_result: null,
      sync_timeout_ms: job.timeoutMs,
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
        message: "Automatische CRM-Synchronisierung gestartet.",
      },
    },
  );

  await startIntegrationSyncRun(admin, {
    integration,
    resource: job.resource,
    mode: job.mode,
    triggeredBy: "auto_scheduler",
    syncJobId: jobId,
    traceId,
    startedAt: now,
    heartbeatAt: now,
    deadlineAt,
    message: "Automatische CRM-Synchronisierung gestartet.",
    step: "started",
    timeoutMs: job.timeoutMs,
    metadata: {
      trigger: "auto",
      interval_minutes: job.intervalMinutes,
      night_only: job.nightOnly,
    },
  });

  try {
    await updateRunningSyncProgress(admin, integration.id, job.resource, jobId, "prepare", "Automatischer Sync-Lauf wird vorbereitet.");
    const freshIntegration = await loadIntegration(admin, integration.id);
    if (!freshIntegration) throw new Error("Integration not found");

    const result = await withTimeout(
      runCrmIntegrationSync(
        admin,
        freshIntegration,
        { resource: job.resource, mode: job.mode },
        {
          onProgress: async (step, message) => {
            await ensureSyncCanContinue(admin, integration.id, jobId);
            await updateRunningSyncProgress(admin, integration.id, job.resource, jobId, step, message);
          },
          assertCanContinue: async () => {
            await ensureSyncCanContinue(admin, integration.id, jobId);
          },
        },
      ),
      job.timeoutMs,
      "CRM-Auto-Synchronisierung wegen Zeitlimit beendet.",
    );
    await finalizeSyncSuccess(admin, integration.id, job.resource, jobId, result, startedAtMs);
    return result;
  } catch (error) {
    const normalized = normalizeSyncError(error);
    await finalizeSyncError(admin, integration.id, job.resource, jobId, normalized.message, startedAtMs, normalized.errorClass);
    return {
      partner_id: integration.partner_id,
      provider: integration.provider,
      resource: job.resource,
      mode: job.mode,
      listings_count: 0,
      references_count: 0,
      requests_count: 0,
      offers_count: 0,
      deactivated_listings: 0,
      deactivated_offers: 0,
      skipped: false,
      error: normalized.message,
    };
  }
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
  const nowMs = Date.now();
  const maxJobs = parseRequestedLimit(req);

  const { data: integrations, error } = await supabase
    .from("partner_integrations")
    .select("id, partner_id, kind, provider, base_url, auth_type, auth_config, detail_url_template, is_active, settings, last_sync_at")
    .eq("kind", SYNC_KIND)
    .eq("is_active", true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const dueJobs = ((integrations ?? []) as IntegrationRow[])
    .flatMap((integration) => collectDueJobs(integration, nowMs))
    .slice(0, maxJobs);

  const results: SyncResult[] = [];

  for (const job of dueJobs) {
    results.push(await runScheduledSyncJob(supabase, job));
  }

  const failedCount = results.filter((row) => typeof row.error === "string").length;
  const status = failedCount > 0 ? 207 : 200;
  return NextResponse.json(
    {
      ok: failedCount === 0,
      failed_count: failedCount,
      due_jobs: dueJobs.length,
      processed_jobs: results.length,
      max_jobs: maxJobs,
      night_window_active: isBerlinNight(),
      timezone: BERLIN_TIMEZONE,
      results,
    },
    { status },
  );
}
