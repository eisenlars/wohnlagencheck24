import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/security/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";
import { checkAdminApiRateLimit, extractClientIpFromHeaders } from "@/lib/security/rate-limit";
import { writeSecurityAuditLog } from "@/lib/security/audit-log";
import { maskIntegrationForResponse } from "@/lib/security/integration-mask";
import { isMissingTable, listLlmProviderAccounts } from "@/lib/llm/provider-catalog";

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

export async function GET(req: Request) {
  try {
    const adminUser = await requireAdmin(["admin_super", "admin_ops"]);
    const limit = await checkAdminApiRateLimit(req, adminUser.userId);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } });
    }

    const accounts = await listLlmProviderAccounts();
    const masked = accounts.map((row) => maskIntegrationForResponse(row as unknown as Record<string, unknown>));
    return NextResponse.json({ ok: true, accounts: masked, source: "db" });
  } catch (error) {
    if (error instanceof Error && (error.message.includes("llm_provider_accounts") || error.message.includes("lookup failed"))) {
      return NextResponse.json({ ok: true, accounts: [], source: "fallback", warning: "Tabelle `llm_provider_accounts` fehlt." });
    }
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const adminUser = await requireAdmin(["admin_super", "admin_ops"]);
    const limit = await checkAdminApiRateLimit(req, adminUser.userId);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } });
    }

    const body = (await req.json()) as Body;
    const provider = norm(body.provider)?.toLowerCase();
    const baseUrl = norm(body.base_url) ?? "https://api.openai.com/v1";
    const authType = norm(body.auth_type)?.toLowerCase() ?? "api_key";
    if (!provider) {
      return NextResponse.json({ error: "provider ist erforderlich" }, { status: 400 });
    }

    const payload = {
      provider,
      display_name: norm(body.display_name),
      base_url: baseUrl,
      auth_type: authType,
      api_version: norm(body.api_version),
      is_active: body.is_active !== false,
    };

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("llm_provider_accounts")
      .insert(payload)
      .select("id, provider, display_name, base_url, auth_type, auth_config, api_version, is_active, created_at, updated_at")
      .maybeSingle();
    if (error) {
      if (isMissingTable(error, "llm_provider_accounts")) {
        return NextResponse.json({ error: "Tabelle `llm_provider_accounts` fehlt. Bitte Migration ausführen." }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await writeSecurityAuditLog({
      actorUserId: adminUser.userId,
      actorRole: adminUser.role,
      eventType: "create",
      entityType: "other",
      entityId: String(data?.id ?? "llm_provider_account"),
      payload: payload as unknown as Record<string, unknown>,
      ip: extractClientIpFromHeaders(req.headers),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({ ok: true, account: maskIntegrationForResponse(data as Record<string, unknown>) }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
