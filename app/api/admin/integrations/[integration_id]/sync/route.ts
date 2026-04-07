import { NextResponse } from "next/server";

import { createAdminClient } from "@/utils/supabase/admin";
import { normalizeCrmSyncSelection, readCrmResourceLimits } from "@/lib/integrations/settings";
import {
  markIntegrationSyncRunError,
  markIntegrationSyncRunSuccess,
  startIntegrationSyncRun,
  type SyncRunLogEntry,
  updateIntegrationSyncRun,
} from "@/lib/integrations/sync-run-log";
import { requireAdmin } from "@/lib/security/admin-auth";
import { checkAdminApiRateLimit, extractClientIpFromHeaders } from "@/lib/security/rate-limit";
import { writeSecurityAuditLog } from "@/lib/security/audit-log";
import { runCrmIntegrationSync, type CrmSyncResult } from "@/lib/integrations/crm-sync";
import type { CrmSyncMode, CrmSyncResource, PartnerIntegration } from "@/lib/providers/types";

export const maxDuration = 300;

const DEFAULT_SYNC_TIMEOUT_MS = 300_000;
const MIN_SYNC_TIMEOUT_MS = 15_000;
const MAX_SYNC_TIMEOUT_MS = 300_000;
const SYNC_STALE_HEARTBEAT_MS = 20_000;
const SYNC_STALE_GRACE_MS = 15_000;
const SYNC_ERROR_COOLDOWN_MS = 60_000;
const SYNC_LOG_LIMIT = 20;

type IntegrationRow = PartnerIntegration & {
  last_sync_at?: string | null;
};

type SyncState = "idle" | "running" | "success" | "error";

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

type SyncStatusPayload = {
  state: SyncState;
  resource: CrmSyncResource;
  mode: CrmSyncMode | null;
  message: string;
  started_at: string | null;
  finished_at: string | null;
  last_sync_at: string | null;
  error: string | null;
  error_class: string | null;
  request_count: number | null;
  pages_fetched: number | null;
  result: CrmSyncResult | null;
  trace_id: string | null;
  step: string | null;
  heartbeat_at: string | null;
  deadline_at: string | null;
  cancel_requested: boolean;
  log: SyncLogEntry[];
};

type ScopedSyncResource = Exclude<CrmSyncResource, "all"> | "all";

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return {};
  return value as Record<string, unknown>;
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

function readSyncMode(value: unknown): CrmSyncMode | null {
  return value === "full" || value === "guarded" ? value : null;
}

function formatResourceLabel(resource: ScopedSyncResource): string {
  if (resource === "offers") return "Angebote";
  if (resource === "references") return "Referenzen";
  if (resource === "requests") return "Gesuche";
  return "CRM";
}

function formatModeLabel(mode: CrmSyncMode | null): string {
  return mode === "full" ? "Vollsync" : mode === "guarded" ? "Guarded-Sync" : "Sync";
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

function asLogEntries(value: unknown): SyncLogEntry[] {
  return Array.isArray(value)
    ? value.filter((item): item is SyncLogEntry => Boolean(item) && typeof item === "object")
    : [];
}

function appendSyncLog(value: unknown, entry: SyncLogEntry, limit = SYNC_LOG_LIMIT): SyncLogEntry[] {
  return [...asLogEntries(value), entry].slice(-limit);
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asRunLogEntries(value: unknown): SyncRunLogEntry[] {
  return asLogEntries(value);
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
  if (resource === "all") return DEFAULT_SYNC_TIMEOUT_MS;
  const limits = readCrmResourceLimits(settings, resource, mode);
  return clampSyncTimeoutMs(limits.max_runtime_ms);
}

function classifySyncError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("zeitlimit")) return "timeout";
  if (lower.includes("manuell abgebrochen")) return "cancelled";
  if (lower.includes("cooldown")) return "cooldown";
  if (lower.includes("fehlendem heartbeat")) return "heartbeat_timeout";
  if (lower.includes("veraltetem lauf")) return "stale_run";
  if (lower.includes("zurueckgesetzt")) return "manual_reset";
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

function buildSyncStatus(
  integration: Pick<IntegrationRow, "settings" | "last_sync_at">,
  resource: ScopedSyncResource = "all",
): SyncStatusPayload {
  const settings = asObject(integration.settings);
  const runtime = readSyncRuntime(settings, resource);
  const rawState = String(runtime.sync_state ?? "").trim().toLowerCase();
  const rawMessage = asText(runtime.sync_message);
  const errorClass = asText(runtime.sync_error_class);
  const mode = readSyncMode(runtime.sync_mode);
  const isLegacyOperatorMessage =
    rawState !== "running"
    && ((rawMessage?.toLowerCase().includes("manuell zurückgesetzt") ?? false) || (rawMessage?.toLowerCase().includes("manuell abgebrochen") ?? false));
  const isHistoricalOperatorNotice =
    (rawState === "error" && (errorClass === "manual_reset" || errorClass === "cancelled"))
    || isLegacyOperatorMessage;
  const state: SyncState =
    isHistoricalOperatorNotice
      ? "idle"
      : rawState === "running" || rawState === "success" || rawState === "error"
        ? (rawState as SyncState)
        : "idle";
  const result = (runtime.sync_result ?? null) as CrmSyncResult | null;
  const fallbackMessage =
    state === "running"
      ? `${formatResourceLabel(resource)} ${formatModeLabel(mode)} läuft...`
      : state === "success"
        ? (result ? formatSuccessMessage(result) : "CRM-Synchronisierung erfolgreich abgeschlossen.")
        : state === "error"
          ? "CRM-Synchronisierung fehlgeschlagen."
          : integration.last_sync_at
            ? "Letzte CRM-Synchronisierung erfolgreich abgeschlossen."
            : "Noch keine CRM-Synchronisierung gestartet.";
  return {
    state,
    resource,
    mode,
    message: isHistoricalOperatorNotice ? fallbackMessage : (rawMessage ?? fallbackMessage),
    started_at: asText(runtime.sync_started_at),
    finished_at: asText(runtime.sync_finished_at),
    last_sync_at: asText(integration.last_sync_at),
    error: isHistoricalOperatorNotice ? null : asText(runtime.sync_error),
    error_class: isHistoricalOperatorNotice ? null : errorClass,
    request_count: asNumber(runtime.sync_request_count),
    pages_fetched: asNumber(runtime.sync_pages_fetched),
    result,
    trace_id: asText(runtime.sync_trace_id),
    step: asText(runtime.sync_step),
    heartbeat_at: asText(runtime.sync_heartbeat_at),
    deadline_at: asText(runtime.sync_deadline_at),
    cancel_requested: runtime.sync_cancel_requested === true,
    log: asLogEntries(runtime.sync_log),
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

function getErrorCooldownRetryAfterSec(settings: Record<string, unknown>): number {
  const state = String(settings.sync_state ?? "").trim().toLowerCase();
  if (state !== "error") return 0;
  const finishedAt = asIsoMs(settings.sync_finished_at);
  if (!finishedAt) return 0;
  const remaining = SYNC_ERROR_COOLDOWN_MS - (Date.now() - finishedAt);
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
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
  resource: ScopedSyncResource,
  patch: Record<string, unknown>,
  options?: {
    expectedJobId?: string;
    logEntry?: SyncLogEntry | null;
  },
): Promise<SyncStatusPayload | null> {
  const current = await loadIntegration(admin, integrationId);
  if (!current) throw new Error("Integration not found");

  const currentSettings = asObject(current.settings);
  if (options?.expectedJobId && String(currentSettings.sync_job_id ?? "") !== options.expectedJobId) {
    return null;
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
  return buildSyncStatus({ settings: nextSettings, last_sync_at: current.last_sync_at ?? null }, resource);
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
  const status = await patchSyncSettings(
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
    log: status?.log ? asRunLogEntries(status.log) : undefined,
  });
  return status;
}

async function finalizeSyncSuccess(
  integrationId: string,
  resource: ScopedSyncResource,
  jobId: string,
  result: CrmSyncResult,
  startedAtMs: number,
) {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { debug_payload, ...persistedResult } = result;
  const onOfficeDeltaSuccessPatch =
    result.provider === "onoffice" && (resource === "offers" || resource === "references")
      ? { onoffice_delta_last_success_at: now }
      : {};
  const status = await patchSyncSettings(
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
      sync_result: persistedResult,
      sync_debug_payload: debug_payload ?? null,
      sync_timeout_ms: null,
      ...onOfficeDeltaSuccessPatch,
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
  await markIntegrationSyncRunSuccess(admin, integrationId, jobId, result, {
    finishedAt: now,
    durationMs: Math.max(0, Date.now() - startedAtMs),
    message: formatSuccessMessage(result),
    step: "completed",
    heartbeatAt: now,
    log: status?.log ? asRunLogEntries(status.log) : null,
  });
}

async function finalizeSyncError(
  integrationId: string,
  resource: ScopedSyncResource,
  jobId: string,
  message: string,
  startedAtMs: number,
  errorClass?: string,
) {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const status = await patchSyncSettings(
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
      sync_debug_payload: null,
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
  await markIntegrationSyncRunError(admin, integrationId, jobId, {
    finishedAt: now,
    durationMs: Math.max(0, Date.now() - startedAtMs),
    step: "failed",
    message,
    errorClass: errorClass ?? classifySyncError(message),
    heartbeatAt: now,
    log: status?.log ? asRunLogEntries(status.log) : null,
  });
}

async function expireStaleRunningSync(
  admin: ReturnType<typeof createAdminClient>,
  integration: IntegrationRow,
  resource: ScopedSyncResource,
  message: string,
) {
  const settings = asObject(integration.settings);
  const jobId = asText(settings.sync_job_id);
  const now = new Date().toISOString();
  await patchSyncSettings(
    admin,
    integration.id,
    resource,
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
      sync_debug_payload: null,
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
  if (settings.sync_cancel_requested === true) {
    throw new SyncControlError("CRM-Synchronisierung manuell abgebrochen.", "cancelled");
  }
  const staleMessage = getStaleRunningMessage(settings);
  if (staleMessage) throw new SyncControlError(staleMessage, classifySyncError(staleMessage));
}

async function requireAdminAccess(req: Request) {
  const adminUser = await requireAdmin(["admin_super", "admin_ops"]);
  const adminRate = await checkAdminApiRateLimit(req, adminUser.userId);
  if (!adminRate.allowed) {
    throw new SyncControlError(`RATE_LIMIT:${adminRate.retryAfterSec}`, "rate_limit");
  }
  return adminUser;
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ integration_id: string }> },
) {
  try {
    await requireAdminAccess(req);
    const { searchParams } = new URL(req.url);
    const resource = normalizeCrmSyncSelection({ resource: searchParams.get("resource") }).resource;
    const params = await ctx.params;
    const integrationId = String(params.integration_id ?? "").trim();
    if (!integrationId) return NextResponse.json({ error: "Missing integration id" }, { status: 400 });

    const admin = createAdminClient();
    let integration = await loadIntegration(admin, integrationId);
    if (!integration) return NextResponse.json({ error: "Integration not found" }, { status: 404 });
    if (String(integration.kind ?? "").toLowerCase() !== "crm") {
      return NextResponse.json({ error: "Nur CRM-Anbindungen können synchronisiert werden." }, { status: 400 });
    }

    const staleMessage = getStaleRunningMessage(asObject(integration.settings));
    if (staleMessage) {
      await expireStaleRunningSync(admin, integration, "all", staleMessage);
      integration = await loadIntegration(admin, integrationId);
      if (!integration) return NextResponse.json({ error: "Integration not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, status: buildSyncStatus(integration, resource) });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      if (error.message.startsWith("RATE_LIMIT:")) {
        const sec = Number(error.message.split(":")[1] ?? "60");
        return NextResponse.json(
          { error: "Too many requests" },
          { status: 429, headers: { "Retry-After": String(sec) } },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ integration_id: string }> },
) {
  try {
    const adminUser = await requireAdminAccess(req);
    const body = await req.json().catch(() => null);
    const selection = normalizeCrmSyncSelection(body);
    const resource = selection.resource;
    const mode = selection.mode;
    const params = await ctx.params;
    const integrationId = String(params.integration_id ?? "").trim();
    if (!integrationId) return NextResponse.json({ error: "Missing integration id" }, { status: 400 });

    const admin = createAdminClient();
    let integration = await loadIntegration(admin, integrationId);
    if (!integration) return NextResponse.json({ error: "Integration not found" }, { status: 404 });
    if (String(integration.kind ?? "").toLowerCase() !== "crm") {
      return NextResponse.json({ error: "Nur CRM-Anbindungen können synchronisiert werden." }, { status: 400 });
    }

    const staleMessage = getStaleRunningMessage(asObject(integration.settings));
    if (staleMessage) {
      await expireStaleRunningSync(admin, integration, "all", staleMessage);
      integration = await loadIntegration(admin, integrationId);
      if (!integration) return NextResponse.json({ error: "Integration not found" }, { status: 404 });
    }

    const currentStatus = buildSyncStatus(integration, "all");
    if (currentStatus.state === "running") {
      return NextResponse.json({ ok: true, status: buildSyncStatus(integration, resource) }, { status: 202 });
    }

    const retryAfterSec = getErrorCooldownRetryAfterSec(asObject(integration.settings));
    if (retryAfterSec > 0) {
      return NextResponse.json(
        { error: "CRM-Synchronisierung ist kurzzeitig im Cooldown." },
        { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
      );
    }

    const ip = extractClientIpFromHeaders(req.headers);
    const userAgent = req.headers.get("user-agent");
    const jobId = crypto.randomUUID();
    const traceId = crypto.randomUUID();
    const startedAtMs = Date.now();
    const now = new Date().toISOString();
    const syncTimeoutMs = resolveSyncTimeoutMs(asObject(integration.settings), resource, mode);
    const deadlineAt = new Date(Date.now() + syncTimeoutMs).toISOString();

    await patchSyncSettings(
      admin,
      integrationId,
      resource,
      {
        sync_state: "running",
        sync_job_id: jobId,
        sync_trace_id: traceId,
        sync_resource: resource,
        sync_mode: mode,
        sync_step: "started",
        sync_started_at: now,
        sync_finished_at: null,
        sync_message: "CRM-Synchronisierung gestartet.",
        sync_error: null,
        sync_error_class: null,
        sync_request_count: null,
        sync_pages_fetched: null,
        sync_result: null,
        sync_debug_payload: null,
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
          message: "CRM-Synchronisierung gestartet.",
        },
      },
    );

    await startIntegrationSyncRun(admin, {
      integration,
      resource,
      mode,
      triggeredBy: "admin_manual",
      triggerUserId: adminUser.userId,
      syncJobId: jobId,
      traceId,
      startedAt: now,
      heartbeatAt: now,
      deadlineAt,
      message: "CRM-Synchronisierung gestartet.",
      step: "started",
      timeoutMs: syncTimeoutMs,
      metadata: {
        trigger: "admin",
        ip,
        user_agent: userAgent,
      },
    });

    await writeSecurityAuditLog({
      actorUserId: adminUser.userId,
      actorRole: adminUser.role,
      eventType: "other",
      entityType: "partner_integration",
      entityId: integration.id,
      payload: {
        action: "admin_sync_integration_started",
        integration_id: integration.id,
        partner_id: integration.partner_id,
        provider: integration.provider,
        sync_job_id: jobId,
        sync_trace_id: traceId,
        sync_resource: resource,
        sync_mode: mode,
      },
      ip,
      userAgent,
    });

    try {
      await updateRunningSyncProgress(admin, integrationId, resource, jobId, "prepare", "Sync-Lauf wird vorbereitet.");
      const freshIntegration = await loadIntegration(admin, integrationId);
      if (!freshIntegration) throw new Error("Integration not found");

      const result = await withTimeout(
        runCrmIntegrationSync(admin, freshIntegration, {
          resource,
          mode,
          triggeredBy: "admin_manual",
        }, {
          onProgress: async (step, message) => {
            await ensureSyncCanContinue(admin, integrationId, jobId);
            await updateRunningSyncProgress(admin, integrationId, resource, jobId, step, message);
          },
          assertCanContinue: async () => {
            await ensureSyncCanContinue(admin, integrationId, jobId);
          },
        }),
        syncTimeoutMs,
        "CRM-Synchronisierung wegen Zeitlimit beendet.",
      );
      await finalizeSyncSuccess(integrationId, resource, jobId, result, startedAtMs);
      await writeSecurityAuditLog({
        actorUserId: adminUser.userId,
        actorRole: adminUser.role,
        eventType: "other",
        entityType: "partner_integration",
        entityId: integration.id,
        payload: {
          action: "admin_sync_integration_finished",
          integration_id: integration.id,
          partner_id: integration.partner_id,
          provider: integration.provider,
          sync_job_id: jobId,
          sync_trace_id: traceId,
          sync_resource: resource,
          sync_mode: mode,
          result,
        },
        ip,
        userAgent,
      });
    } catch (error) {
      const normalizedError = normalizeSyncError(error);
      await finalizeSyncError(integrationId, resource, jobId, normalizedError.message, startedAtMs, normalizedError.errorClass);
      await writeSecurityAuditLog({
        actorUserId: adminUser.userId,
        actorRole: adminUser.role,
        eventType: "other",
        entityType: "partner_integration",
        entityId: integration.id,
        payload: {
          action: "admin_sync_integration_failed",
          integration_id: integration.id,
          partner_id: integration.partner_id,
          provider: integration.provider,
          sync_job_id: jobId,
          sync_trace_id: traceId,
          sync_resource: resource,
          sync_mode: mode,
          error: normalizedError.message,
          error_class: normalizedError.errorClass,
        },
        ip,
        userAgent,
      });
    }

    const finalIntegration = await loadIntegration(admin, integrationId);
    if (!finalIntegration) return NextResponse.json({ error: "Integration not found" }, { status: 404 });
    return NextResponse.json({ ok: true, status: buildSyncStatus(finalIntegration, resource) }, { status: 200 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      if (error.message.startsWith("RATE_LIMIT:")) {
        const sec = Number(error.message.split(":")[1] ?? "60");
        return NextResponse.json(
          { error: "Too many requests" },
          { status: 429, headers: { "Retry-After": String(sec) } },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ integration_id: string }> },
) {
  try {
    const adminUser = await requireAdminAccess(req);
    const { searchParams } = new URL(req.url);
    const resource = normalizeCrmSyncSelection({ resource: searchParams.get("resource") }).resource;
    const params = await ctx.params;
    const integrationId = String(params.integration_id ?? "").trim();
    if (!integrationId) return NextResponse.json({ error: "Missing integration id" }, { status: 400 });

    const admin = createAdminClient();
    let integration = await loadIntegration(admin, integrationId);
    if (!integration) return NextResponse.json({ error: "Integration not found" }, { status: 404 });
    if (String(integration.kind ?? "").toLowerCase() !== "crm") {
      return NextResponse.json({ error: "Nur CRM-Anbindungen können synchronisiert werden." }, { status: 400 });
    }

    const settings = asObject(integration.settings);
    const currentStatus = buildSyncStatus(integration, "all");
    if (currentStatus.state !== "running") {
      return NextResponse.json({ ok: true, status: buildSyncStatus(integration, resource) }, { status: 200 });
    }

    const staleMessage = getStaleRunningMessage(settings);
    const now = new Date().toISOString();
    const jobId = asText(settings.sync_job_id);
    let nextStatus: SyncStatusPayload | null;

    if (staleMessage) {
      nextStatus = await patchSyncSettings(
        admin,
        integrationId,
        resource,
        {
          sync_state: "error",
          sync_job_id: null,
          sync_step: "cancelled",
          sync_heartbeat_at: now,
          sync_deadline_at: null,
          sync_cancel_requested: false,
          sync_cancel_requested_at: now,
          sync_finished_at: now,
          sync_message: "CRM-Synchronisierung manuell zurückgesetzt.",
          sync_error: "CRM-Synchronisierung manuell zurückgesetzt.",
          sync_error_class: "manual_reset",
          sync_result: null,
          sync_debug_payload: null,
        },
        {
          expectedJobId: jobId ?? undefined,
          logEntry: {
            at: now,
            step: "cancelled",
            status: "warning",
            message: "CRM-Synchronisierung manuell zurückgesetzt.",
          },
        },
      );
      if (jobId) {
        await markIntegrationSyncRunError(admin, integrationId, jobId, {
          status: "cancelled",
          finishedAt: now,
          step: "cancelled",
          message: "CRM-Synchronisierung manuell zurückgesetzt.",
          errorClass: "manual_reset",
          heartbeatAt: now,
          log: nextStatus?.log ? asRunLogEntries(nextStatus.log) : null,
        });
      }
    } else {
      nextStatus = await patchSyncSettings(
        admin,
        integrationId,
        resource,
        {
          sync_cancel_requested: true,
          sync_cancel_requested_at: now,
          sync_message: "Abbruch der CRM-Synchronisierung angefordert.",
          sync_heartbeat_at: now,
        },
        {
          expectedJobId: jobId ?? undefined,
          logEntry: {
            at: now,
            step: "cancel_requested",
            status: "warning",
            message: "Abbruch der CRM-Synchronisierung angefordert.",
          },
        },
      );
      if (jobId) {
        await updateIntegrationSyncRun(admin, {
          integrationId,
          syncJobId: jobId,
          status: "cancel_requested",
          step: "cancel_requested",
          message: "Abbruch der CRM-Synchronisierung angefordert.",
          heartbeatAt: now,
          cancelRequested: true,
          log: nextStatus?.log ? asRunLogEntries(nextStatus.log) : null,
        });
      }
    }

    await writeSecurityAuditLog({
      actorUserId: adminUser.userId,
      actorRole: adminUser.role,
      eventType: "other",
      entityType: "partner_integration",
      entityId: integration.id,
      payload: {
        action: staleMessage ? "admin_sync_integration_reset" : "admin_sync_integration_cancel_requested",
        integration_id: integration.id,
        partner_id: integration.partner_id,
        provider: integration.provider,
        sync_job_id: jobId,
      },
      ip: extractClientIpFromHeaders(req.headers),
      userAgent: req.headers.get("user-agent"),
    });

    integration = await loadIntegration(admin, integrationId);
    if (!integration) return NextResponse.json({ error: "Integration not found" }, { status: 404 });
    return NextResponse.json(
      { ok: true, status: nextStatus ?? buildSyncStatus(integration, resource) },
      { status: staleMessage ? 200 : 202 },
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      if (error.message.startsWith("RATE_LIMIT:")) {
        const sec = Number(error.message.split(":")[1] ?? "60");
        return NextResponse.json(
          { error: "Too many requests" },
          { status: 429, headers: { "Retry-After": String(sec) } },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
