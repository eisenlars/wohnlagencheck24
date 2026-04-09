import { NextResponse } from "next/server";

import { requireNetworkPartnerActorContext } from "@/lib/network-partners/auth";
import { requireNetworkPartnerRole } from "@/lib/network-partners/roles";
import {
  deleteIntegrationForNetworkPartner,
  getIntegrationByIdForNetworkPartner,
  updateIntegrationForNetworkPartner,
} from "@/lib/network-partners/repositories/integrations";
import { maskIntegrationForResponse } from "@/lib/security/integration-mask";
import { validateIntegrationConfig } from "@/lib/integrations/providers";
import { normalizeCrmIntegrationSettings } from "@/lib/integrations/settings";
import { normalizeLlmRuntimeMode } from "@/lib/llm/mode";
import { getNetworkPartnerById } from "@/lib/network-partners/repositories/network-partners";

type IntegrationPatchBody = {
  provider?: string;
  base_url?: string | null;
  auth_type?: string | null;
  detail_url_template?: string | null;
  is_active?: boolean;
  settings?: Record<string, unknown> | null;
};

function asText(value: unknown): string {
  return String(value ?? "").trim();
}

function asNullableText(value: unknown): string | null {
  const normalized = asText(value);
  return normalized.length > 0 ? normalized : null;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeSettings(kind: string, provider: string, settings: Record<string, unknown> | null | undefined) {
  if (!settings || typeof settings !== "object") return null;
  if (kind === "crm") {
    const normalized = normalizeCrmIntegrationSettings(settings);
    return normalized.ok ? normalized.value : normalized;
  }
  if (kind !== "llm") return settings;

  const model = asNullableText(settings.model) ?? asNullableText(settings.model_name);
  const baseUrl = asNullableText(settings.base_url);
  const apiVersion = asNullableText(settings.api_version);
  const temperature = asFiniteNumber(settings.temperature);
  const maxTokens = asFiniteNumber(settings.max_tokens);
  const llmMode = normalizeLlmRuntimeMode(settings.llm_mode);
  const normalizedProvider = asText(provider).toLowerCase();

  if (!model) {
    return { error: "Für LLM-Integrationen ist settings.model erforderlich." } as const;
  }
  if (normalizedProvider === "azure_openai" && !apiVersion) {
    return { error: "Für Azure OpenAI ist settings.api_version erforderlich." } as const;
  }

  const out: Record<string, unknown> = { llm_mode: llmMode, model };
  if (baseUrl) out.base_url = baseUrl;
  if (apiVersion) out.api_version = apiVersion;
  if (temperature !== null) out.temperature = temperature;
  if (maxTokens !== null) out.max_tokens = Math.max(1, Math.floor(maxTokens));
  return out;
}

function enrichStoredSecretFlags(row: Record<string, unknown>) {
  const auth = (row.auth_config ?? {}) as Record<string, unknown>;
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

function mapIntegrationError(error: Error) {
  if (error.message === "UNAUTHORIZED") return { status: 401, error: "Unauthorized" };
  if (error.message === "FORBIDDEN") return { status: 403, error: "Forbidden" };
  if (error.message === "NOT_FOUND") return { status: 404, error: "Integration not found" };
  if (error.message === "INVALID_PROVIDER") return { status: 400, error: "Unsupported integration provider" };
  if (error.message === "INVALID_KIND") return { status: 400, error: "Only CRM and LLM integrations are supported" };
  if (error.message === "NO_UPDATE_FIELDS") return { status: 400, error: "No update fields provided" };
  return { status: 500, error: error.message || "Unexpected error" };
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const actor = requireNetworkPartnerRole(
      await requireNetworkPartnerActorContext(),
      ["network_owner", "network_editor", "network_billing"],
    );
    const params = await ctx.params;
    const integrationId = asText(params.id);
    if (!integrationId) {
      return NextResponse.json({ error: "Missing integration id" }, { status: 400 });
    }

    const integration = await getIntegrationByIdForNetworkPartner(integrationId, actor.networkPartnerId);
    if (!integration) {
      return NextResponse.json({ error: "Integration not found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      integration: maskIntegrationForResponse(enrichStoredSecretFlags(integration)),
    });
  } catch (error) {
    const mapped = mapIntegrationError(error as Error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

export async function PATCH(
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

    const current = await getIntegrationByIdForNetworkPartner(integrationId, actor.networkPartnerId);
    if (!current) {
      return NextResponse.json({ error: "Integration not found" }, { status: 404 });
    }
    const networkPartner = await getNetworkPartnerById(actor.networkPartnerId);
    if (!networkPartner) {
      return NextResponse.json({ error: "Network partner not found" }, { status: 404 });
    }
    if (current.kind === "llm" && !networkPartner.llm_partner_managed_allowed) {
      return NextResponse.json({ error: "LLM-Anbindungen sind für diesen Netzwerkpartner nicht freigeschaltet." }, { status: 403 });
    }

    const body = (await req.json()) as IntegrationPatchBody;
    const provider = body.provider !== undefined ? asText(body.provider).toLowerCase() : current.provider;
    const validation = validateIntegrationConfig({
      kind: current.kind,
      provider,
      authType: body.auth_type ?? current.auth_type,
      baseUrl: body.base_url ?? current.base_url,
    });
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const normalizedSettings =
      body.settings !== undefined
        ? normalizeSettings(current.kind, validation.provider, asObject(body.settings))
        : undefined;
    if (normalizedSettings && "error" in normalizedSettings) {
      return NextResponse.json({ error: normalizedSettings.error }, { status: 400 });
    }

    const integration = await updateIntegrationForNetworkPartner({
      id: integrationId,
      network_partner_id: actor.networkPartnerId,
      provider: validation.provider,
      base_url: body.base_url !== undefined ? validation.baseUrl : undefined,
      auth_type: body.auth_type !== undefined ? validation.authType : undefined,
      detail_url_template:
        body.detail_url_template !== undefined ? asNullableText(body.detail_url_template) : undefined,
      is_active: body.is_active,
      settings: normalizedSettings,
    });

    return NextResponse.json({
      ok: true,
      integration: maskIntegrationForResponse(enrichStoredSecretFlags(integration)),
    });
  } catch (error) {
    const mapped = mapIntegrationError(error as Error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

export async function DELETE(
  _req: Request,
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

    await deleteIntegrationForNetworkPartner(integrationId, actor.networkPartnerId);
    return NextResponse.json({ ok: true, integration_id: integrationId });
  } catch (error) {
    const mapped = mapIntegrationError(error as Error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
