import { NextResponse } from "next/server";

import { createAdminClient } from "@/utils/supabase/admin";
import { requireNetworkPartnerActorContext } from "@/lib/network-partners/auth";
import { requireNetworkPartnerRole } from "@/lib/network-partners/roles";
import { assertNetworkPartnerOwnsIntegration } from "@/lib/network-partners/access";
import { encryptIntegrationSecret } from "@/lib/security/secret-crypto";
import { writeSecurityAuditLog } from "@/lib/security/audit-log";

type SecretsBody = {
  api_key?: string;
  token?: string;
  secret?: string;
};

function asText(value: unknown): string {
  return String(value ?? "").trim();
}

function nonEmpty(value: unknown): string | null {
  const normalized = asText(value);
  return normalized.length > 0 ? normalized : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mapSecretsError(error: Error) {
  if (error.message === "UNAUTHORIZED") return { status: 401, error: "Unauthorized" };
  if (error.message === "FORBIDDEN") return { status: 403, error: "Forbidden" };
  if (error.message === "NOT_FOUND") return { status: 404, error: "Integration not found" };
  return { status: 500, error: error.message || "Unexpected error" };
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const actor = requireNetworkPartnerRole(
      await requireNetworkPartnerActorContext(),
      ["network_owner", "network_editor"],
    );
    const params = await ctx.params;
    const integrationId = asText(params.id);
    if (!integrationId) {
      return NextResponse.json({ error: "Missing integration id" }, { status: 400 });
    }

    await assertNetworkPartnerOwnsIntegration(actor.networkPartnerId, integrationId);

    const body = (await req.json()) as SecretsBody;
    const apiKey = nonEmpty(body.api_key);
    const token = nonEmpty(body.token);
    const secret = nonEmpty(body.secret);
    if (!apiKey && !token && !secret) {
      return NextResponse.json({ error: "No secret values provided" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("network_partner_integrations")
      .select("id, auth_config")
      .eq("id", integrationId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!isRecord(data)) {
      return NextResponse.json({ error: "Integration not found" }, { status: 404 });
    }

    const nextAuthConfig: Record<string, unknown> = {
      ...(((isRecord(data.auth_config) ? data.auth_config : null) ?? {}) as Record<string, unknown>),
    };

    if (apiKey) {
      const encrypted = encryptIntegrationSecret(apiKey);
      if (!encrypted) {
        return NextResponse.json(
          { error: "INTEGRATION_SECRETS_ENCRYPTION_KEY fehlt oder ist ungültig." },
          { status: 500 },
        );
      }
      nextAuthConfig.api_key_encrypted = encrypted;
      delete nextAuthConfig.api_key;
    }
    if (token) {
      const encrypted = encryptIntegrationSecret(token);
      if (!encrypted) {
        return NextResponse.json(
          { error: "INTEGRATION_SECRETS_ENCRYPTION_KEY fehlt oder ist ungültig." },
          { status: 500 },
        );
      }
      nextAuthConfig.token_encrypted = encrypted;
      delete nextAuthConfig.token;
    }
    if (secret) {
      const encrypted = encryptIntegrationSecret(secret);
      if (!encrypted) {
        return NextResponse.json(
          { error: "INTEGRATION_SECRETS_ENCRYPTION_KEY fehlt oder ist ungültig." },
          { status: 500 },
        );
      }
      nextAuthConfig.secret_encrypted = encrypted;
      delete nextAuthConfig.secret;
    }

    const { error: updateError } = await admin
      .from("network_partner_integrations")
      .update({ auth_config: nextAuthConfig })
      .eq("id", integrationId)
      .eq("network_partner_id", actor.networkPartnerId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await writeSecurityAuditLog({
      actorUserId: actor.userId,
      actorRole: "system",
      eventType: "update",
      entityType: "other",
      entityId: integrationId,
      payload: {
        integration_id: integrationId,
        changed_keys: [
          apiKey ? "api_key" : null,
          token ? "token" : null,
          secret ? "secret" : null,
        ].filter(Boolean),
      },
      ip: req.headers.get("x-forwarded-for"),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({ ok: true, integration_id: integrationId });
  } catch (error) {
    const mapped = mapSecretsError(error as Error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
