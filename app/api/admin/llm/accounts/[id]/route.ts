import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/security/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";
import { checkAdminApiRateLimit, extractClientIpFromHeaders } from "@/lib/security/rate-limit";
import { writeSecurityAuditLog } from "@/lib/security/audit-log";
import { maskIntegrationForResponse } from "@/lib/security/integration-mask";
import { isMissingTable } from "@/lib/llm/provider-catalog";

type Body = {
  provider?: string;
  display_name?: string | null;
  base_url?: string;
  auth_type?: string;
  api_version?: string | null;
  is_active?: boolean;
};

function norm(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  return raw.length > 0 ? raw : null;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const adminUser = await requireAdmin(["admin_super", "admin_ops"]);
    const limit = await checkAdminApiRateLimit(req, adminUser.userId);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } });
    }

    const { id } = await ctx.params;
    const accountId = String(id ?? "").trim();
    if (!accountId) return NextResponse.json({ error: "Missing account id" }, { status: 400 });

    const body = (await req.json()) as Body;
    const patch: Record<string, unknown> = {};
    if (body.provider !== undefined) patch.provider = norm(body.provider)?.toLowerCase();
    if (body.display_name !== undefined) patch.display_name = norm(body.display_name);
    if (body.base_url !== undefined) patch.base_url = norm(body.base_url);
    if (body.auth_type !== undefined) patch.auth_type = norm(body.auth_type)?.toLowerCase();
    if (body.api_version !== undefined) patch.api_version = norm(body.api_version);
    if (body.is_active !== undefined) patch.is_active = body.is_active === true;
    if (Object.keys(patch).length === 0) return NextResponse.json({ error: "No update fields provided" }, { status: 400 });

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("llm_provider_accounts")
      .update(patch)
      .eq("id", accountId)
      .select("id, provider, display_name, base_url, auth_type, auth_config, api_version, is_active, created_at, updated_at")
      .maybeSingle();
    if (error) {
      if (isMissingTable(error, "llm_provider_accounts")) {
        return NextResponse.json({ error: "Tabelle `llm_provider_accounts` fehlt. Bitte Migration ausführen." }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) return NextResponse.json({ error: "Account not found" }, { status: 404 });

    await writeSecurityAuditLog({
      actorUserId: adminUser.userId,
      actorRole: adminUser.role,
      eventType: "update",
      entityType: "other",
      entityId: accountId,
      payload: patch,
      ip: extractClientIpFromHeaders(req.headers),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({ ok: true, account: maskIntegrationForResponse(data as Record<string, unknown>) });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const adminUser = await requireAdmin(["admin_super", "admin_ops"]);
    const limit = await checkAdminApiRateLimit(req, adminUser.userId);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } });
    }

    const { id } = await ctx.params;
    const accountId = String(id ?? "").trim();
    if (!accountId) return NextResponse.json({ error: "Missing account id" }, { status: 400 });

    const admin = createAdminClient();
    const { error } = await admin
      .from("llm_provider_accounts")
      .delete()
      .eq("id", accountId);
    if (error) {
      if (isMissingTable(error, "llm_provider_accounts")) {
        return NextResponse.json({ error: "Tabelle `llm_provider_accounts` fehlt. Bitte Migration ausführen." }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await writeSecurityAuditLog({
      actorUserId: adminUser.userId,
      actorRole: adminUser.role,
      eventType: "delete",
      entityType: "other",
      entityId: accountId,
      payload: { table: "llm_provider_accounts" },
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
