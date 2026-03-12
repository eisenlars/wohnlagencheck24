import { NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { checkRateLimitPersistent, extractClientIpFromHeaders } from "@/lib/security/rate-limit";
import { buildLocalSiteTokenHash } from "@/lib/security/local-site-auth";
import { encryptIntegrationSecret, encryptLocalSiteToken } from "@/lib/security/secret-crypto";
import { writeSecurityAuditLog } from "@/lib/security/audit-log";
import { loadPartnerLlmPolicy } from "@/lib/llm/partner-policy";

type SecretsBody = {
  api_key?: string;
  token?: string;
  secret?: string;
};

function nonEmpty(value: unknown): string | null {
  const v = String(value ?? "").trim();
  return v.length > 0 ? v : null;
}

async function requirePartnerUser(req: Request): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) throw new Error("UNAUTHORIZED");

  const ip = extractClientIpFromHeaders(req.headers);
  const limit = await checkRateLimitPersistent(
    `partner_secrets:${user.id}:${ip}`,
    { windowMs: 60 * 1000, max: 40 },
  );
  if (!limit.allowed) throw new Error(`RATE_LIMIT:${limit.retryAfterSec}`);
  return user.id;
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ integration_id: string }> },
) {
  try {
    const userId = await requirePartnerUser(req);
    const params = await ctx.params;
    const integrationId = String(params.integration_id ?? "").trim();
    if (!integrationId) return NextResponse.json({ error: "Missing integration id" }, { status: 400 });

    const body = (await req.json()) as SecretsBody;
    const apiKey = nonEmpty(body.api_key);
    const token = nonEmpty(body.token);
    const secret = nonEmpty(body.secret);
    if (!apiKey && !token && !secret) {
      return NextResponse.json({ error: "No secret values provided" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: integration, error: loadError } = await admin
      .from("partner_integrations")
      .select("id, partner_id, kind, auth_config")
      .eq("id", integrationId)
      .maybeSingle();
    if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 });
    if (!integration) return NextResponse.json({ error: "Integration not found" }, { status: 404 });
    if (String(integration.partner_id) !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (String(integration.kind ?? "").toLowerCase() === "llm") {
      const policy = await loadPartnerLlmPolicy(admin, userId);
      if (!policy.llm_partner_managed_allowed) {
        return NextResponse.json(
          { error: "LLM-Anbindungen sind für diesen Partner nicht freigeschaltet." },
          { status: 403 },
        );
      }
    }

    const nextAuthConfig: Record<string, unknown> = {
      ...((integration.auth_config as Record<string, unknown> | null) ?? {}),
    };
    if (apiKey) {
      const encryptedApiKey = encryptIntegrationSecret(apiKey);
      if (!encryptedApiKey) {
        return NextResponse.json(
          { error: "INTEGRATION_SECRETS_ENCRYPTION_KEY fehlt oder ist ungültig." },
          { status: 500 },
        );
      }
      nextAuthConfig.api_key_encrypted = encryptedApiKey;
      delete nextAuthConfig.api_key;
    }
    if (token) {
      if (integration.kind === "local_site") {
        const encryptedToken = encryptLocalSiteToken(token);
        if (!encryptedToken) {
          return NextResponse.json(
            { error: "LOCAL_SITE_TOKEN_ENCRYPTION_KEY fehlt oder ist ungültig." },
            { status: 500 },
          );
        }
        nextAuthConfig.token_hash = buildLocalSiteTokenHash(token);
        nextAuthConfig.token_encrypted = encryptedToken;
        delete nextAuthConfig.token;
      } else {
        const encryptedToken = encryptIntegrationSecret(token);
        if (!encryptedToken) {
          return NextResponse.json(
            { error: "INTEGRATION_SECRETS_ENCRYPTION_KEY fehlt oder ist ungültig." },
            { status: 500 },
          );
        }
        nextAuthConfig.token_encrypted = encryptedToken;
        delete nextAuthConfig.token;
      }
    }
    if (secret) {
      const encryptedSecret = encryptIntegrationSecret(secret);
      if (!encryptedSecret) {
        return NextResponse.json(
          { error: "INTEGRATION_SECRETS_ENCRYPTION_KEY fehlt oder ist ungültig." },
          { status: 500 },
        );
      }
      nextAuthConfig.secret_encrypted = encryptedSecret;
      delete nextAuthConfig.secret;
    }

    const { error: updateError } = await admin
      .from("partner_integrations")
      .update({ auth_config: nextAuthConfig })
      .eq("id", integrationId)
      .eq("partner_id", userId);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    await writeSecurityAuditLog({
      actorUserId: userId,
      actorRole: "system",
      eventType: "update",
      entityType: "partner_secret",
      entityId: integrationId,
      payload: {
        integration_id: integrationId,
        changed_keys: [
          apiKey ? "api_key" : null,
          token && integration.kind === "local_site" ? "token_hash" : token ? "token" : null,
          token && integration.kind === "local_site" ? "token_encrypted" : null,
          secret ? "secret" : null,
        ].filter(Boolean),
      },
      ip: extractClientIpFromHeaders(req.headers),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({ ok: true, integration_id: integrationId });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message.startsWith("RATE_LIMIT:")) {
        const sec = Number(error.message.split(":")[1] ?? "60");
        return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(sec) } });
      }
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
