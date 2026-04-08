import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/security/admin-auth";
import { checkAdminApiRateLimit } from "@/lib/security/rate-limit";
import { validateIntegrationConfig } from "@/lib/integrations/providers";
import { normalizeCrmIntegrationSettings } from "@/lib/integrations/settings";
import {
  deleteIntegrationForNetworkPartner,
  getIntegrationById,
  updateIntegrationForNetworkPartner,
} from "@/lib/network-partners/repositories/integrations";
import { maskIntegrationForResponse } from "@/lib/security/integration-mask";

type UpdateIntegrationBody = {
  provider?: string;
  base_url?: string | null;
  auth_type?: string | null;
  detail_url_template?: string | null;
  is_active?: boolean;
  settings?: Record<string, unknown> | null;
};

function norm(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const v = String(value).trim();
  return v.length > 0 ? v : null;
}

function enrichStoredSecretFlags(row: Record<string, unknown>) {
  const auth =
    row.auth_config && typeof row.auth_config === "object" && !Array.isArray(row.auth_config)
      ? (row.auth_config as Record<string, unknown>)
      : {};
  const settings =
    row.settings && typeof row.settings === "object" && !Array.isArray(row.settings)
      ? (row.settings as Record<string, unknown>)
      : {};
  const trigger =
    settings.trigger && typeof settings.trigger === "object" && !Array.isArray(settings.trigger)
      ? (settings.trigger as Record<string, unknown>)
      : {};
  return {
    ...row,
    has_api_key: Boolean(String(auth.api_key ?? auth.api_key_encrypted ?? "").trim()),
    has_token: Boolean(String(auth.token ?? auth.token_encrypted ?? "").trim()),
    has_secret: Boolean(String(auth.secret ?? auth.secret_encrypted ?? "").trim()),
    has_trigger_token: Boolean(String(trigger.token ?? settings.webhook_token ?? "").trim()),
    has_trigger_secret: Boolean(
      String(auth.webhook_secret ?? auth.webhook_secret_encrypted ?? "").trim(),
    ),
  };
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ integration_id: string }> },
) {
  try {
    const adminUser = await requireAdmin(["admin_super", "admin_ops"]);
    const adminRate = await checkAdminApiRateLimit(req, adminUser.userId);
    if (!adminRate.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(adminRate.retryAfterSec) } },
      );
    }

    const params = await ctx.params;
    const integrationId = String(params.integration_id ?? "").trim();
    if (!integrationId) {
      return NextResponse.json({ error: "Missing integration id" }, { status: 400 });
    }

    const integration = await getIntegrationById(integrationId);
    if (!integration) {
      return NextResponse.json({ error: "Integration not found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      integration: maskIntegrationForResponse(enrichStoredSecretFlags(integration as unknown as Record<string, unknown>)),
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ integration_id: string }> },
) {
  try {
    const adminUser = await requireAdmin(["admin_super", "admin_ops"]);
    const adminRate = await checkAdminApiRateLimit(req, adminUser.userId);
    if (!adminRate.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(adminRate.retryAfterSec) } },
      );
    }

    const params = await ctx.params;
    const integrationId = String(params.integration_id ?? "").trim();
    if (!integrationId) {
      return NextResponse.json({ error: "Missing integration id" }, { status: 400 });
    }

    const current = await getIntegrationById(integrationId);
    if (!current) {
      return NextResponse.json({ error: "Integration not found" }, { status: 404 });
    }

    const body = (await req.json()) as UpdateIntegrationBody;
    const provider = body.provider !== undefined ? String(body.provider ?? "").trim().toLowerCase() : current.provider;
    const validation = validateIntegrationConfig({
      kind: "crm",
      provider,
      authType: body.auth_type ?? current.auth_type,
      baseUrl: body.base_url ?? current.base_url,
    });
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const normalizedSettings =
      body.settings !== undefined
        ? normalizeCrmIntegrationSettings(body.settings ?? null)
        : { ok: true as const, value: undefined };
    if (!normalizedSettings.ok) {
      return NextResponse.json({ error: normalizedSettings.error }, { status: 400 });
    }

    const integration = await updateIntegrationForNetworkPartner({
      id: integrationId,
      network_partner_id: current.network_partner_id,
      provider: validation.provider as "propstack" | "onoffice",
      base_url: body.base_url !== undefined ? validation.baseUrl : undefined,
      auth_type: body.auth_type !== undefined ? validation.authType : undefined,
      detail_url_template: body.detail_url_template !== undefined ? norm(body.detail_url_template) : undefined,
      is_active: body.is_active,
      settings: normalizedSettings.value,
    });

    return NextResponse.json({
      ok: true,
      integration: maskIntegrationForResponse(enrichStoredSecretFlags(integration as unknown as Record<string, unknown>)),
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      if (error.message === "NOT_FOUND") return NextResponse.json({ error: "Integration not found" }, { status: 404 });
      if (error.message === "NO_UPDATE_FIELDS") return NextResponse.json({ error: "No update fields provided" }, { status: 400 });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ integration_id: string }> },
) {
  try {
    const adminUser = await requireAdmin(["admin_super", "admin_ops"]);
    const adminRate = await checkAdminApiRateLimit(req, adminUser.userId);
    if (!adminRate.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(adminRate.retryAfterSec) } },
      );
    }

    const params = await ctx.params;
    const integrationId = String(params.integration_id ?? "").trim();
    if (!integrationId) {
      return NextResponse.json({ error: "Missing integration id" }, { status: 400 });
    }

    const current = await getIntegrationById(integrationId);
    if (!current) {
      return NextResponse.json({ error: "Integration not found" }, { status: 404 });
    }

    await deleteIntegrationForNetworkPartner(integrationId, current.network_partner_id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      if (error.message === "NOT_FOUND") return NextResponse.json({ error: "Integration not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
