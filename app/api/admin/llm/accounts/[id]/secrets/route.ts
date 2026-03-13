import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/security/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";
import { checkAdminApiRateLimit, extractClientIpFromHeaders } from "@/lib/security/rate-limit";
import { writeSecurityAuditLog } from "@/lib/security/audit-log";
import { encryptIntegrationSecret } from "@/lib/security/secret-crypto";
import { isMissingTable } from "@/lib/llm/provider-catalog";

type Body = {
  api_key?: string;
  token?: string;
  secret?: string;
};

function nonEmpty(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  return raw.length > 0 ? raw : null;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
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
    const apiKey = nonEmpty(body.api_key);
    const token = nonEmpty(body.token);
    const secret = nonEmpty(body.secret);
    if (!apiKey && !token && !secret) {
      return NextResponse.json({ error: "No secret values provided" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: existing, error: loadError } = await admin
      .from("llm_provider_accounts")
      .select("id, auth_config")
      .eq("id", accountId)
      .maybeSingle();
    if (loadError) {
      if (isMissingTable(loadError, "llm_provider_accounts")) {
        return NextResponse.json({ error: "Tabelle `llm_provider_accounts` fehlt. Bitte Migration ausführen." }, { status: 409 });
      }
      return NextResponse.json({ error: loadError.message }, { status: 500 });
    }
    if (!existing) return NextResponse.json({ error: "Account not found" }, { status: 404 });

    const nextAuth: Record<string, unknown> = {
      ...((existing.auth_config as Record<string, unknown> | null) ?? {}),
    };
    const applyEncrypted = (key: "api_key" | "token" | "secret", value: string | null) => {
      if (!value) return;
      const encrypted = encryptIntegrationSecret(value);
      if (!encrypted) {
        throw new Error("INTEGRATION_SECRETS_ENCRYPTION_KEY fehlt oder ist ungültig.");
      }
      nextAuth[`${key}_encrypted`] = encrypted;
      delete nextAuth[key];
    };
    applyEncrypted("api_key", apiKey);
    applyEncrypted("token", token);
    applyEncrypted("secret", secret);

    const { error: updateError } = await admin
      .from("llm_provider_accounts")
      .update({ auth_config: nextAuth })
      .eq("id", accountId);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    await writeSecurityAuditLog({
      actorUserId: adminUser.userId,
      actorRole: adminUser.role,
      eventType: "update",
      entityType: "other",
      entityId: accountId,
      payload: {
        changed_keys: [apiKey ? "api_key" : null, token ? "token" : null, secret ? "secret" : null].filter(Boolean),
      },
      ip: extractClientIpFromHeaders(req.headers),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({ ok: true, account_id: accountId });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      if (error.message.includes("INTEGRATION_SECRETS_ENCRYPTION_KEY")) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
