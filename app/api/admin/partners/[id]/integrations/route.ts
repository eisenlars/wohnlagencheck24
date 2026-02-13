import { NextResponse } from "next/server";

import { createAdminClient } from "@/utils/supabase/admin";
import { requireAdmin } from "@/lib/security/admin-auth";
import { writeSecurityAuditLog } from "@/lib/security/audit-log";
import { checkAdminApiRateLimit, extractClientIpFromHeaders } from "@/lib/security/rate-limit";
import { maskIntegrationForResponse } from "@/lib/security/integration-mask";
import { validateIntegrationConfig } from "@/lib/integrations/providers";

type IntegrationBody = {
  kind?: string;
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

const ALLOWED_KINDS = new Set(["crm", "llm", "local_site", "other"]);

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
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
    const partnerId = String(params.id ?? "").trim();
    if (!partnerId) {
      return NextResponse.json({ error: "Missing partner id" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("partner_integrations")
      .select("id, partner_id, kind, provider, base_url, auth_type, auth_config, detail_url_template, is_active, settings, last_sync_at")
      .eq("partner_id", partnerId)
      .order("kind", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      integrations: (data ?? []).map((row) => maskIntegrationForResponse(row as Record<string, unknown>)),
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
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
    const partnerId = String(params.id ?? "").trim();
    if (!partnerId) {
      return NextResponse.json({ error: "Missing partner id" }, { status: 400 });
    }

    const body = (await req.json()) as IntegrationBody;
    const kind = norm(body.kind)?.toLowerCase() ?? null;
    const provider = norm(body.provider);
    if (!kind || !provider) {
      return NextResponse.json({ error: "Missing required fields: kind, provider" }, { status: 400 });
    }
    if (!ALLOWED_KINDS.has(kind)) {
      return NextResponse.json({ error: "Invalid integration kind" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: partnerExists, error: partnerError } = await admin
      .from("partners")
      .select("id")
      .eq("id", partnerId)
      .maybeSingle();
    if (partnerError) return NextResponse.json({ error: partnerError.message }, { status: 500 });
    if (!partnerExists) return NextResponse.json({ error: "Partner not found" }, { status: 404 });

    const validation = validateIntegrationConfig({
      kind,
      provider,
      authType: body.auth_type,
      baseUrl: body.base_url,
    });
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const payload = {
      partner_id: partnerId,
      kind,
      provider: validation.provider,
      base_url: validation.baseUrl,
      auth_type: validation.authType,
      detail_url_template: norm(body.detail_url_template),
      is_active: body.is_active === false ? false : true,
      settings: body.settings ?? null,
    };

    const { data, error } = await admin
      .from("partner_integrations")
      .upsert(payload, { onConflict: "partner_id,kind" })
      .select("id, partner_id, kind, provider, base_url, auth_type, auth_config, detail_url_template, is_active, settings, last_sync_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await writeSecurityAuditLog({
      actorUserId: adminUser.userId,
      actorRole: adminUser.role,
      eventType: "create",
      entityType: "partner_integration",
      entityId: String(data.id),
      payload: { partner_id: partnerId, kind, provider, is_active: payload.is_active },
      ip: extractClientIpFromHeaders(req.headers),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json(
      { ok: true, integration: maskIntegrationForResponse(data as Record<string, unknown>) },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
