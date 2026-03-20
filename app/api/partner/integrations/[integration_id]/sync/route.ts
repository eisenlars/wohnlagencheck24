import { after, NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { checkRateLimitPersistent, extractClientIpFromHeaders } from "@/lib/security/rate-limit";
import { writeSecurityAuditLog } from "@/lib/security/audit-log";
import { runCrmIntegrationSync, type CrmSyncResult } from "@/lib/integrations/crm-sync";
import type { PartnerIntegration } from "@/lib/providers/types";

export const maxDuration = 60;

type IntegrationRow = PartnerIntegration & {
  last_sync_at?: string | null;
};

type SyncState = "idle" | "running" | "success" | "error";

type SyncStatusPayload = {
  state: SyncState;
  message: string;
  started_at: string | null;
  finished_at: string | null;
  last_sync_at: string | null;
  error: string | null;
  result: CrmSyncResult | null;
};

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return {};
  return value as Record<string, unknown>;
}

function asText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
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
    result,
  };
}

async function requirePartnerUser(req: Request, mode: "start" | "status"): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) throw new Error("UNAUTHORIZED");

  const ip = extractClientIpFromHeaders(req.headers);
  const limit = await checkRateLimitPersistent(
    `partner_integration_sync:${mode}:${user.id}:${ip}`,
    { windowMs: 60 * 1000, max: mode === "status" ? 60 : 10 },
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
  expectedJobId?: string,
): Promise<SyncStatusPayload | null> {
  const current = await loadIntegration(admin, integrationId, partnerId);
  if (!current) throw new Error("Integration not found");

  const currentSettings = asObject(current.settings);
  if (expectedJobId && String(currentSettings.sync_job_id ?? "") !== expectedJobId) {
    return null;
  }

  const nextSettings = {
    ...currentSettings,
    ...patch,
  };

  const { error } = await admin
    .from("partner_integrations")
    .update({ settings: nextSettings })
    .eq("id", integrationId)
    .eq("partner_id", partnerId);

  if (error) throw new Error(error.message);
  return buildSyncStatus({ settings: nextSettings, last_sync_at: current.last_sync_at ?? null });
}

async function finalizeSyncSuccess(
  integrationId: string,
  partnerId: string,
  jobId: string,
  result: CrmSyncResult,
) {
  const admin = createAdminClient();
  await patchSyncSettings(
    admin,
    integrationId,
    partnerId,
    {
      sync_state: "success",
      sync_job_id: null,
      sync_finished_at: new Date().toISOString(),
      sync_message: formatSuccessMessage(result),
      sync_error: null,
      sync_result: result,
    },
    jobId,
  );
}

async function finalizeSyncError(
  integrationId: string,
  partnerId: string,
  jobId: string,
  message: string,
) {
  const admin = createAdminClient();
  await patchSyncSettings(
    admin,
    integrationId,
    partnerId,
    {
      sync_state: "error",
      sync_job_id: null,
      sync_finished_at: new Date().toISOString(),
      sync_message: message,
      sync_error: message,
      sync_result: null,
    },
    jobId,
  );
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
    const integration = await loadIntegration(admin, integrationId, userId);
    if (!integration) return NextResponse.json({ error: "Integration not found" }, { status: 404 });
    if (String(integration.kind ?? "").toLowerCase() !== "crm") {
      return NextResponse.json({ error: "Nur CRM-Anbindungen können synchronisiert werden." }, { status: 400 });
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
    const integration = await loadIntegration(admin, integrationId, userId);
    if (!integration) return NextResponse.json({ error: "Integration not found" }, { status: 404 });
    if (String(integration.kind ?? "").toLowerCase() !== "crm") {
      return NextResponse.json({ error: "Nur CRM-Anbindungen können synchronisiert werden." }, { status: 400 });
    }

    const currentStatus = buildSyncStatus(integration);
    if (currentStatus.state === "running") {
      return NextResponse.json({ ok: true, status: currentStatus }, { status: 202 });
    }

    const ip = extractClientIpFromHeaders(req.headers);
    const userAgent = req.headers.get("user-agent");
    const jobId = crypto.randomUUID();
    const startedStatus = await patchSyncSettings(admin, integrationId, userId, {
      sync_state: "running",
      sync_job_id: jobId,
      sync_started_at: new Date().toISOString(),
      sync_finished_at: null,
      sync_message: "CRM-Synchronisierung gestartet.",
      sync_error: null,
      sync_result: null,
    });

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
      },
      ip,
      userAgent,
    });

    after(async () => {
      try {
        const freshAdmin = createAdminClient();
        const freshIntegration = await loadIntegration(freshAdmin, integrationId, userId);
        if (!freshIntegration) {
          throw new Error("Integration not found");
        }

        const result = await runCrmIntegrationSync(freshAdmin, freshIntegration);
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
            error: message,
          },
          ip,
          userAgent,
        });
      }
    });

    return NextResponse.json(
      {
        ok: true,
        status: startedStatus,
      },
      { status: 202 },
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
