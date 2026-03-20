import { NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { checkRateLimitPersistent, extractClientIpFromHeaders } from "@/lib/security/rate-limit";
import { writeSecurityAuditLog } from "@/lib/security/audit-log";
import { runCrmIntegrationSync, type CrmSyncResult } from "@/lib/integrations/crm-sync";
import type { PartnerIntegration } from "@/lib/providers/types";

export const maxDuration = 60;

const SYNC_TIMEOUT_MS = 45_000;
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

type SyncStatusPayload = {
  state: SyncState;
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

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return {};
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

function formatSuccessMessage(result: CrmSyncResult): string {
  if (result.skipped) {
    if (result.reason === "integration inactive") {
      return "Die CRM-Anbindung ist deaktiviert.";
    }
    if (result.reason === "all capabilities disabled") {
      return "Alle CRM-Bereiche sind deaktiviert.";
    }
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
): SyncStatusPayload {
  const settings = asObject(integration.settings);
  const rawState = String(settings.sync_state ?? "").trim().toLowerCase();
  const state: SyncState =
    rawState === "running" || rawState === "success" || rawState === "error"
      ? (rawState as SyncState)
      : "idle";
  const result = (settings.sync_result ?? null) as CrmSyncResult | null;
  const fallbackMessage =
    state === "running"
      ? "CRM-Synchronisierung läuft..."
      : state === "success"
        ? (result ? formatSuccessMessage(result) : "CRM-Synchronisierung erfolgreich abgeschlossen.")
        : state === "error"
          ? "CRM-Synchronisierung fehlgeschlagen."
          : integration.last_sync_at
            ? "Letzte CRM-Synchronisierung erfolgreich abgeschlossen."
            : "Noch keine CRM-Synchronisierung gestartet.";
  return {
    state,
    message: asText(settings.sync_message) ?? fallbackMessage,
    started_at: asText(settings.sync_started_at),
    finished_at: asText(settings.sync_finished_at),
    last_sync_at: asText(integration.last_sync_at),
    error: asText(settings.sync_error),
    error_class: asText(settings.sync_error_class),
    request_count: asNumber(settings.sync_request_count),
    pages_fetched: asNumber(settings.sync_pages_fetched),
    result,
    trace_id: asText(settings.sync_trace_id),
    step: asText(settings.sync_step),
    heartbeat_at: asText(settings.sync_heartbeat_at),
    deadline_at: asText(settings.sync_deadline_at),
    cancel_requested: settings.sync_cancel_requested === true,
    log: asLogEntries(settings.sync_log),
  };
}

function getStaleRunningMessage(settings: Record<string, unknown>): string | null {
  const state = String(settings.sync_state ?? "").trim().toLowerCase();
  if (state !== "running") return null;

  const now = Date.now();
  const deadlineAt = asIsoMs(settings.sync_deadline_at);
  const heartbeatAt = asIsoMs(settings.sync_heartbeat_at);
  const startedAt = asIsoMs(settings.sync_started_at);

  if (deadlineAt && deadlineAt < now) {
    return "CRM-Synchronisierung wegen Zeitlimit automatisch beendet.";
  }
  if (heartbeatAt && heartbeatAt < now - SYNC_STALE_HEARTBEAT_MS) {
    return "CRM-Synchronisierung wegen fehlendem Heartbeat automatisch beendet.";
  }
  if (startedAt && startedAt < now - (SYNC_TIMEOUT_MS + SYNC_STALE_GRACE_MS)) {
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
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function requirePartnerUser(req: Request, mode: "start" | "status" | "cancel"): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) throw new Error("UNAUTHORIZED");

  const ip = extractClientIpFromHeaders(req.headers);
  const max = mode === "status" ? 60 : mode === "cancel" ? 20 : 10;
  const limit = await checkRateLimitPersistent(
    `partner_integration_sync:${mode}:${user.id}:${ip}`,
    { windowMs: 60 * 1000, max },
  );
  if (!limit.allowed) throw new Error(`RATE_LIMIT:${limit.retryAfterSec}`);
  return user.id;
}

async function loadIntegration(
  admin: ReturnType<typeof createAdminClient>,
  integrationId: string,
  partnerId: string,
): Promise<IntegrationRow | null> {
  const { data, error } = await admin
    .from("partner_integrations")
    .select("id, partner_id, kind, provider, base_url, auth_type, auth_config, detail_url_template, is_active, settings, last_sync_at")
    .eq("id", integrationId)
    .eq("partner_id", partnerId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as IntegrationRow | null) ?? null;
}

async function patchSyncSettings(
  admin: ReturnType<typeof createAdminClient>,
  integrationId: string,
  partnerId: string,
  patch: Record<string, unknown>,
  options?: {
    expectedJobId?: string;
    logEntry?: SyncLogEntry | null;
  },
): Promise<SyncStatusPayload | null> {
  const current = await loadIntegration(admin, integrationId, partnerId);
  if (!current) throw new Error("Integration not found");

  const currentSettings = asObject(current.settings);
  if (options?.expectedJobId && String(currentSettings.sync_job_id ?? "") !== options.expectedJobId) {
    return null;
  }

  const nextSettings: Record<string, unknown> = {
    ...currentSettings,
    ...patch,
  };

  if (options?.logEntry) {
    nextSettings.sync_log = appendSyncLog(nextSettings.sync_log, options.logEntry);
  }

  const { error } = await admin
    .from("partner_integrations")
    .update({ settings: nextSettings })
    .eq("id", integrationId)
    .eq("partner_id", partnerId);

  if (error) throw new Error(error.message);
  return buildSyncStatus({ settings: nextSettings, last_sync_at: current.last_sync_at ?? null });
}

async function updateRunningSyncProgress(
  admin: ReturnType<typeof createAdminClient>,
  integrationId: string,
  partnerId: string,
  jobId: string,
  step: string,
  message: string,
) {
  const now = new Date().toISOString();
  return patchSyncSettings(
    admin,
    integrationId,
    partnerId,
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
}

async function finalizeSyncSuccess(
  integrationId: string,
  partnerId: string,
  jobId: string,
  result: CrmSyncResult,
) {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  await patchSyncSettings(
    admin,
    integrationId,
    partnerId,
    {
      sync_state: "success",
      sync_job_id: null,
      sync_step: "completed",
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
}

async function finalizeSyncError(
  integrationId: string,
  partnerId: string,
  jobId: string,
  message: string,
) {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  await patchSyncSettings(
    admin,
    integrationId,
    partnerId,
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
      sync_error_class: classifySyncError(message),
      sync_result: null,
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
    integration.partner_id,
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
}

async function ensureSyncCanContinue(
  admin: ReturnType<typeof createAdminClient>,
  integrationId: string,
  partnerId: string,
  jobId: string,
) {
  const current = await loadIntegration(admin, integrationId, partnerId);
  if (!current) throw new Error("Integration not found");
  const settings = asObject(current.settings);
  if (String(settings.sync_job_id ?? "") !== jobId) {
    throw new Error("CRM-Synchronisierung wurde ersetzt oder zurueckgesetzt.");
  }
  if (settings.sync_cancel_requested === true) {
    throw new Error("CRM-Synchronisierung manuell abgebrochen.");
  }
  const staleMessage = getStaleRunningMessage(settings);
  if (staleMessage) {
    throw new Error(staleMessage);
  }
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ integration_id: string }> },
) {
  try {
    const userId = await requirePartnerUser(req, "status");
    const params = await ctx.params;
    const integrationId = String(params.integration_id ?? "").trim();
    if (!integrationId) {
      return NextResponse.json({ error: "Missing integration id" }, { status: 400 });
    }

    const admin = createAdminClient();
    let integration = await loadIntegration(admin, integrationId, userId);
    if (!integration) return NextResponse.json({ error: "Integration not found" }, { status: 404 });
    if (String(integration.kind ?? "").toLowerCase() !== "crm") {
      return NextResponse.json({ error: "Nur CRM-Anbindungen können synchronisiert werden." }, { status: 400 });
    }

    const staleMessage = getStaleRunningMessage(asObject(integration.settings));
    if (staleMessage) {
      await expireStaleRunningSync(admin, integration, staleMessage);
      integration = await loadIntegration(admin, integrationId, userId);
      if (!integration) return NextResponse.json({ error: "Integration not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, status: buildSyncStatus(integration) });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
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
    const userId = await requirePartnerUser(req, "start");
    const params = await ctx.params;
    const integrationId = String(params.integration_id ?? "").trim();
    if (!integrationId) {
      return NextResponse.json({ error: "Missing integration id" }, { status: 400 });
    }

    const admin = createAdminClient();
    let integration = await loadIntegration(admin, integrationId, userId);
    if (!integration) return NextResponse.json({ error: "Integration not found" }, { status: 404 });
    if (String(integration.kind ?? "").toLowerCase() !== "crm") {
      return NextResponse.json({ error: "Nur CRM-Anbindungen können synchronisiert werden." }, { status: 400 });
    }

    const staleMessage = getStaleRunningMessage(asObject(integration.settings));
    if (staleMessage) {
      await expireStaleRunningSync(admin, integration, staleMessage);
      integration = await loadIntegration(admin, integrationId, userId);
      if (!integration) return NextResponse.json({ error: "Integration not found" }, { status: 404 });
    }

    const currentStatus = buildSyncStatus(integration);
    if (currentStatus.state === "running") {
      return NextResponse.json({ ok: true, status: currentStatus }, { status: 202 });
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
    const now = new Date().toISOString();
    const deadlineAt = new Date(Date.now() + SYNC_TIMEOUT_MS).toISOString();

    await patchSyncSettings(
      admin,
      integrationId,
      userId,
      {
        sync_state: "running",
        sync_job_id: jobId,
        sync_trace_id: traceId,
        sync_step: "started",
        sync_started_at: now,
        sync_finished_at: null,
        sync_message: "CRM-Synchronisierung gestartet.",
        sync_error: null,
        sync_error_class: null,
        sync_request_count: null,
        sync_pages_fetched: null,
        sync_result: null,
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

    await writeSecurityAuditLog({
      actorUserId: userId,
      actorRole: "system",
      eventType: "other",
      entityType: "partner_integration",
      entityId: integration.id,
      payload: {
        action: "partner_sync_integration_started",
        integration_id: integration.id,
        provider: integration.provider,
        sync_job_id: jobId,
        sync_trace_id: traceId,
      },
      ip,
      userAgent,
    });

    let responseStatus: SyncStatusPayload | null = null;
    try {
      await updateRunningSyncProgress(admin, integrationId, userId, jobId, "prepare", "Sync-Lauf wird vorbereitet.");
      const freshIntegration = await loadIntegration(admin, integrationId, userId);
      if (!freshIntegration) {
        throw new Error("Integration not found");
      }

      const result = await withTimeout(
        runCrmIntegrationSync(admin, freshIntegration, {
          onProgress: async (step, message) => {
            await ensureSyncCanContinue(admin, integrationId, userId, jobId);
            await updateRunningSyncProgress(admin, integrationId, userId, jobId, step, message);
          },
          assertCanContinue: async () => {
            await ensureSyncCanContinue(admin, integrationId, userId, jobId);
          },
        }),
        SYNC_TIMEOUT_MS,
        "CRM-Synchronisierung wegen Zeitlimit beendet.",
      );
      await finalizeSyncSuccess(integrationId, userId, jobId, result);
      await writeSecurityAuditLog({
        actorUserId: userId,
        actorRole: "system",
        eventType: "other",
        entityType: "partner_integration",
        entityId: integration.id,
        payload: {
          action: "partner_sync_integration_finished",
          integration_id: integration.id,
          provider: integration.provider,
          sync_job_id: jobId,
          sync_trace_id: traceId,
          result,
        },
        ip,
        userAgent,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "CRM-Synchronisierung fehlgeschlagen.";
      await finalizeSyncError(integrationId, userId, jobId, message);
      await writeSecurityAuditLog({
        actorUserId: userId,
        actorRole: "system",
        eventType: "other",
        entityType: "partner_integration",
        entityId: integration.id,
        payload: {
          action: "partner_sync_integration_failed",
          integration_id: integration.id,
          provider: integration.provider,
          sync_job_id: jobId,
          sync_trace_id: traceId,
          error: message,
        },
        ip,
        userAgent,
      });
    }

    const finalIntegration = await loadIntegration(admin, integrationId, userId);
    if (!finalIntegration) {
      return NextResponse.json({ error: "Integration not found" }, { status: 404 });
    }
    responseStatus = buildSyncStatus(finalIntegration);
    return NextResponse.json({ ok: true, status: responseStatus }, { status: 200 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
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
    const userId = await requirePartnerUser(req, "cancel");
    const params = await ctx.params;
    const integrationId = String(params.integration_id ?? "").trim();
    if (!integrationId) {
      return NextResponse.json({ error: "Missing integration id" }, { status: 400 });
    }

    const admin = createAdminClient();
    let integration = await loadIntegration(admin, integrationId, userId);
    if (!integration) return NextResponse.json({ error: "Integration not found" }, { status: 404 });
    if (String(integration.kind ?? "").toLowerCase() !== "crm") {
      return NextResponse.json({ error: "Nur CRM-Anbindungen können synchronisiert werden." }, { status: 400 });
    }

    const settings = asObject(integration.settings);
    const currentStatus = buildSyncStatus(integration);
    if (currentStatus.state !== "running") {
      return NextResponse.json({ ok: true, status: currentStatus }, { status: 200 });
    }

    const staleMessage = getStaleRunningMessage(settings);
    const now = new Date().toISOString();
    const jobId = asText(settings.sync_job_id);
    let nextStatus: SyncStatusPayload | null;

    if (staleMessage) {
      nextStatus = await patchSyncSettings(
        admin,
        integrationId,
        userId,
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
    } else {
      nextStatus = await patchSyncSettings(
        admin,
        integrationId,
        userId,
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
    }

    await writeSecurityAuditLog({
      actorUserId: userId,
      actorRole: "system",
      eventType: "other",
      entityType: "partner_integration",
      entityId: integration.id,
      payload: {
        action: staleMessage ? "partner_sync_integration_reset" : "partner_sync_integration_cancel_requested",
        integration_id: integration.id,
        provider: integration.provider,
        sync_job_id: jobId,
      },
      ip: extractClientIpFromHeaders(req.headers),
      userAgent: req.headers.get("user-agent"),
    });

    integration = await loadIntegration(admin, integrationId, userId);
    if (!integration) return NextResponse.json({ error: "Integration not found" }, { status: 404 });
    return NextResponse.json(
      { ok: true, status: nextStatus ?? buildSyncStatus(integration) },
      { status: staleMessage ? 200 : 202 },
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
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
