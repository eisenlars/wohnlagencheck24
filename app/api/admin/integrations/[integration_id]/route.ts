import { NextResponse } from "next/server";

import { createAdminClient } from "@/utils/supabase/admin";
import { requireAdmin } from "@/lib/security/admin-auth";
import { writeSecurityAuditLog } from "@/lib/security/audit-log";
import { checkAdminApiRateLimit, extractClientIpFromHeaders } from "@/lib/security/rate-limit";
import { maskIntegrationForResponse } from "@/lib/security/integration-mask";
import { validateIntegrationConfig } from "@/lib/integrations/providers";

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

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ integration_id: string }> },
) {
  try {
    const adminUser = await requireAdmin(["admin_super", "admin_ops"]);
    const adminRate = await checkAdminApiRateLimit(_req, adminUser.userId);
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

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("partner_integrations")
      .select("id, partner_id, kind, provider, base_url, auth_type, auth_config, detail_url_template, is_active, settings, last_sync_at")
      .eq("id", integrationId)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Integration not found" }, { status: 404 });

    return NextResponse.json({
      ok: true,
      integration: maskIntegrationForResponse(data as Record<string, unknown>),
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

    const body = (await req.json()) as UpdateIntegrationBody;
    const patch: Record<string, unknown> = {};
    if (body.provider !== undefined) patch.provider = norm(body.provider)?.toLowerCase() ?? null;
    if (body.base_url !== undefined) patch.base_url = norm(body.base_url);
    if (body.auth_type !== undefined) patch.auth_type = norm(body.auth_type)?.toLowerCase() ?? null;
    if (body.detail_url_template !== undefined) patch.detail_url_template = norm(body.detail_url_template);
    if (body.is_active !== undefined) patch.is_active = Boolean(body.is_active);
    if (body.settings !== undefined) patch.settings = body.settings ?? null;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No update fields provided" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: existing, error: existingError } = await admin
      .from("partner_integrations")
      .select("id, kind, provider, base_url, auth_type")
      .eq("id", integrationId)
      .maybeSingle();
    if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
    if (!existing) return NextResponse.json({ error: "Integration not found" }, { status: 404 });

    const nextKind = String(existing.kind ?? "").trim().toLowerCase();
    const nextProvider = String(
      patch.provider !== undefined ? patch.provider : existing.provider,
    ).trim().toLowerCase();
    const nextAuthType = String(
      patch.auth_type !== undefined ? patch.auth_type : existing.auth_type,
    ).trim().toLowerCase() || null;
    const nextBaseUrl = String(
      patch.base_url !== undefined ? patch.base_url : existing.base_url,
    ).trim() || null;

    const validation = validateIntegrationConfig({
      kind: nextKind,
      provider: nextProvider,
      authType: nextAuthType,
      baseUrl: nextBaseUrl,
    });
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    patch.provider = validation.provider;
    patch.auth_type = validation.authType;
    patch.base_url = validation.baseUrl;

    const { data, error } = await admin
      .from("partner_integrations")
      .update(patch)
      .eq("id", integrationId)
      .select("id, partner_id, kind, provider, base_url, auth_type, auth_config, detail_url_template, is_active, settings, last_sync_at")
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Integration not found" }, { status: 404 });

    await writeSecurityAuditLog({
      actorUserId: adminUser.userId,
      actorRole: adminUser.role,
      eventType: "update",
      entityType: "partner_integration",
      entityId: integrationId,
      payload: patch,
      ip: extractClientIpFromHeaders(req.headers),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({
      ok: true,
      integration: maskIntegrationForResponse(data as Record<string, unknown>),
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

    const admin = createAdminClient();
    const { data: existing, error: existingError } = await admin
      .from("partner_integrations")
      .select("id, partner_id, kind, provider, is_active")
      .eq("id", integrationId)
      .maybeSingle();
    if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
    if (!existing) return NextResponse.json({ error: "Integration not found" }, { status: 404 });

    const { error: deleteError } = await admin
      .from("partner_integrations")
      .delete()
      .eq("id", integrationId);
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

    await writeSecurityAuditLog({
      actorUserId: adminUser.userId,
      actorRole: adminUser.role,
      eventType: "delete",
      entityType: "partner_integration",
      entityId: integrationId,
      payload: {
        partner_id: String(existing.partner_id ?? ""),
        kind: String(existing.kind ?? ""),
        provider: String(existing.provider ?? ""),
        is_active: Boolean(existing.is_active),
      },
      ip: extractClientIpFromHeaders(req.headers),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
