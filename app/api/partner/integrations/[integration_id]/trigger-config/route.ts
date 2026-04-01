import { randomBytes, randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { checkRateLimitPersistent, extractClientIpFromHeaders } from "@/lib/security/rate-limit";
import { resolveAppBaseUrl } from "@/lib/auth/resolve-app-base-url";
import { encryptIntegrationSecret } from "@/lib/security/secret-crypto";
import { writeSecurityAuditLog } from "@/lib/security/audit-log";

function asText(value: unknown): string {
  return String(value ?? "").trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asObject(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function readTriggerToken(settings: Record<string, unknown>): string | null {
  const trigger = asObject(settings.trigger);
  const token = asText(trigger.token ?? settings.webhook_token);
  return token || null;
}

function hasTriggerSecret(authConfig: Record<string, unknown>): boolean {
  return Boolean(asText(authConfig.webhook_secret ?? authConfig.webhook_secret_encrypted));
}

function isMissingTableError(error: unknown): boolean {
  const message = String((isRecord(error) ? error.message : error) ?? "").toLowerCase();
  return message.includes("partner_integration_trigger_events") && message.includes("does not exist");
}

async function requirePartnerUser(req: Request): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) throw new Error("UNAUTHORIZED");

  const ip = extractClientIpFromHeaders(req.headers);
  const limit = await checkRateLimitPersistent(
    `partner_trigger_config:${user.id}:${ip}`,
    { windowMs: 60 * 1000, max: 40 },
  );
  if (!limit.allowed) throw new Error(`RATE_LIMIT:${limit.retryAfterSec}`);
  return user.id;
}

async function loadTriggerStats(integrationId: string) {
  const admin = createAdminClient();
  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const { data: latest, error: latestError } = await admin
      .from("partner_integration_trigger_events")
      .select("received_at, processed_at, status")
      .eq("integration_id", integrationId)
      .order("received_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestError && !isMissingTableError(latestError)) {
      throw new Error(latestError.message ?? "TRIGGER_STATS_LATEST_FAILED");
    }
    const { count, error: countError } = await admin
      .from("partner_integration_trigger_events")
      .select("id", { count: "exact", head: true })
      .eq("integration_id", integrationId)
      .gte("received_at", startOfDay);
    if (countError && !isMissingTableError(countError)) {
      throw new Error(countError.message ?? "TRIGGER_STATS_COUNT_FAILED");
    }
    return {
      last_received_at: isRecord(latest) ? asText(latest.received_at) || null : null,
      last_processed_at: isRecord(latest) ? asText(latest.processed_at) || null : null,
      last_status: isRecord(latest) ? asText(latest.status) || null : null,
      events_today: typeof count === "number" ? count : null,
    };
  } catch {
    return {
      last_received_at: null,
      last_processed_at: null,
      last_status: null,
      events_today: null,
    };
  }
}

function mapError(error: Error) {
  if (error.message === "UNAUTHORIZED") return { status: 401, error: "Unauthorized" };
  if (error.message.startsWith("RATE_LIMIT:")) {
    const sec = Number(error.message.split(":")[1] ?? "60");
    return { status: 429, error: "Too many requests", retryAfterSec: sec };
  }
  return { status: 500, error: error.message || "Unexpected error" };
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ integration_id: string }> },
) {
  try {
    const userId = await requirePartnerUser(req);
    const params = await ctx.params;
    const integrationId = asText(params.integration_id);
    if (!integrationId) {
      return NextResponse.json({ error: "Missing integration id" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("partner_integrations")
      .select("id, partner_id, provider, settings, auth_config")
      .eq("id", integrationId)
      .eq("partner_id", userId)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!isRecord(data)) {
      return NextResponse.json({ error: "Integration not found" }, { status: 404 });
    }

    const settings = asObject(data.settings);
    const authConfig = asObject(data.auth_config);
    const token = readTriggerToken(settings);
    const provider = asText(data.provider).toLowerCase();
    const webhookUrl = token
      ? `${resolveAppBaseUrl(req.headers)}/api/integrations/triggers/partner/${encodeURIComponent(provider)}/${encodeURIComponent(token)}`
      : null;
    const stats = await loadTriggerStats(integrationId);

    return NextResponse.json({
      ok: true,
      config: {
        provider,
        token,
        webhook_url: webhookUrl,
        has_secret: hasTriggerSecret(authConfig),
        is_configured: Boolean(token) && hasTriggerSecret(authConfig),
        ...stats,
      },
    });
  } catch (error) {
    const mapped = mapError(error as Error);
    const headers =
      "retryAfterSec" in mapped && typeof mapped.retryAfterSec === "number"
        ? { "Retry-After": String(mapped.retryAfterSec) }
        : undefined;
    return NextResponse.json({ error: mapped.error }, { status: mapped.status, headers });
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ integration_id: string }> },
) {
  try {
    const userId = await requirePartnerUser(req);
    const params = await ctx.params;
    const integrationId = asText(params.integration_id);
    if (!integrationId) {
      return NextResponse.json({ error: "Missing integration id" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("partner_integrations")
      .select("id, partner_id, provider, settings, auth_config")
      .eq("id", integrationId)
      .eq("partner_id", userId)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!isRecord(data)) {
      return NextResponse.json({ error: "Integration not found" }, { status: 404 });
    }

    const settings = asObject(data.settings);
    const trigger = asObject(settings.trigger);
    const authConfig = asObject(data.auth_config);
    const token = readTriggerToken(settings) ?? randomUUID();
    const secretPlain = randomBytes(24).toString("base64url");
    const secretEncrypted = encryptIntegrationSecret(secretPlain);
    if (!secretEncrypted) {
      return NextResponse.json(
        { error: "INTEGRATION_SECRETS_ENCRYPTION_KEY fehlt oder ist ungültig." },
        { status: 500 },
      );
    }

    const nextSettings = {
      ...settings,
      trigger: {
        ...trigger,
        token,
      },
    };
    const nextAuthConfig = {
      ...authConfig,
      webhook_secret_encrypted: secretEncrypted,
    };

    const { error: updateError } = await admin
      .from("partner_integrations")
      .update({
        settings: nextSettings,
        auth_config: nextAuthConfig,
      })
      .eq("id", integrationId)
      .eq("partner_id", userId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await writeSecurityAuditLog({
      actorUserId: userId,
      actorRole: "system",
      eventType: "update",
      entityType: "partner_integration",
      entityId: integrationId,
      payload: {
        action: "partner_update_trigger_config",
        integration_id: integrationId,
        changed_keys: ["trigger_token", "trigger_secret"],
      },
      ip: extractClientIpFromHeaders(req.headers),
      userAgent: req.headers.get("user-agent"),
    });

    const provider = asText(data.provider).toLowerCase();
    const webhookUrl = `${resolveAppBaseUrl(req.headers)}/api/integrations/triggers/partner/${encodeURIComponent(provider)}/${encodeURIComponent(token)}`;
    const stats = await loadTriggerStats(integrationId);

    return NextResponse.json({
      ok: true,
      config: {
        provider,
        token,
        webhook_url: webhookUrl,
        has_secret: true,
        is_configured: true,
        ...stats,
      },
      generated_secret: secretPlain,
    });
  } catch (error) {
    const mapped = mapError(error as Error);
    const headers =
      "retryAfterSec" in mapped && typeof mapped.retryAfterSec === "number"
        ? { "Retry-After": String(mapped.retryAfterSec) }
        : undefined;
    return NextResponse.json({ error: mapped.error }, { status: mapped.status, headers });
  }
}
