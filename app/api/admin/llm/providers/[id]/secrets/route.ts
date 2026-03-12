import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/security/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";
import { checkAdminApiRateLimit, extractClientIpFromHeaders } from "@/lib/security/rate-limit";
import { writeSecurityAuditLog } from "@/lib/security/audit-log";
import { encryptIntegrationSecret } from "@/lib/security/secret-crypto";

type Body = {
  api_key?: string;
  token?: string;
  secret?: string;
};

function nonEmpty(value: unknown): string | null {
  const v = String(value ?? "").trim();
  return v.length > 0 ? v : null;
}

function isMissingTable(error: unknown): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return msg.includes("public.llm_global_providers") && msg.includes("does not exist");
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const adminUser = await requireAdmin(["admin_super", "admin_ops"]);
    const limit = await checkAdminApiRateLimit(req, adminUser.userId);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } });
    }
    const params = await ctx.params;
    const id = String(params.id ?? "").trim();
    if (!id) return NextResponse.json({ error: "Missing provider id" }, { status: 400 });

    const body = (await req.json()) as Body;
    const apiKey = nonEmpty(body.api_key);
    const token = nonEmpty(body.token);
    const secret = nonEmpty(body.secret);
    if (!apiKey && !token && !secret) {
      return NextResponse.json({ error: "No secret values provided" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: existing, error: loadError } = await admin
      .from("llm_global_providers")
      .select("id, auth_config")
      .eq("id", id)
      .maybeSingle();
    if (loadError) {
      if (isMissingTable(loadError)) {
        return NextResponse.json({ error: "Tabelle `llm_global_providers` fehlt. Bitte Migration `docs/sql/llm_global_management.sql` ausführen." }, { status: 409 });
      }
      return NextResponse.json({ error: loadError.message }, { status: 500 });
    }
    if (!existing) return NextResponse.json({ error: "Provider not found" }, { status: 404 });

    const nextAuth: Record<string, unknown> = {
      ...((existing.auth_config as Record<string, unknown> | null) ?? {}),
    };
    if (apiKey) {
      const encryptedApiKey = encryptIntegrationSecret(apiKey);
      if (!encryptedApiKey) {
        return NextResponse.json(
          { error: "INTEGRATION_SECRETS_ENCRYPTION_KEY fehlt oder ist ungültig." },
          { status: 500 },
        );
      }
      nextAuth.api_key_encrypted = encryptedApiKey;
      delete nextAuth.api_key;
    }
    if (token) {
      const encryptedToken = encryptIntegrationSecret(token);
      if (!encryptedToken) {
        return NextResponse.json(
          { error: "INTEGRATION_SECRETS_ENCRYPTION_KEY fehlt oder ist ungültig." },
          { status: 500 },
        );
      }
      nextAuth.token_encrypted = encryptedToken;
      delete nextAuth.token;
    }
    if (secret) {
      const encryptedSecret = encryptIntegrationSecret(secret);
      if (!encryptedSecret) {
        return NextResponse.json(
          { error: "INTEGRATION_SECRETS_ENCRYPTION_KEY fehlt oder ist ungültig." },
          { status: 500 },
        );
      }
      nextAuth.secret_encrypted = encryptedSecret;
      delete nextAuth.secret;
    }

    const { error: updateError } = await admin
      .from("llm_global_providers")
      .update({ auth_config: nextAuth })
      .eq("id", id);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    await writeSecurityAuditLog({
      actorUserId: adminUser.userId,
      actorRole: adminUser.role,
      eventType: "update",
      entityType: "other",
      entityId: id,
      payload: {
        changed_keys: [apiKey ? "api_key" : null, token ? "token" : null, secret ? "secret" : null].filter(Boolean),
      },
      ip: extractClientIpFromHeaders(req.headers),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({ ok: true, provider_id: id });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
