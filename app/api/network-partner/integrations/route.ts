import { NextResponse } from "next/server";

import { requireNetworkPartnerActorContext } from "@/lib/network-partners/auth";
import { requireNetworkPartnerRole } from "@/lib/network-partners/roles";
import {
  createIntegrationForNetworkPartner,
  listIntegrationsByNetworkPartner,
} from "@/lib/network-partners/repositories/integrations";
import { getNetworkPartnerById } from "@/lib/network-partners/repositories/network-partners";
import { maskIntegrationForResponse } from "@/lib/security/integration-mask";
import { validateIntegrationConfig } from "@/lib/integrations/providers";
import { normalizeCrmIntegrationSettings } from "@/lib/integrations/settings";

type IntegrationBody = {
  kind?: string;
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
  if (error.message === "INVALID_PORTAL_PARTNER_ID") return { status: 400, error: "portal_partner_id is required" };
  if (error.message === "INVALID_NETWORK_PARTNER_ID") return { status: 400, error: "network_partner_id is required" };
  if (error.message === "INVALID_PROVIDER") return { status: 400, error: "Unsupported CRM provider" };
  if (error.message === "INVALID_KIND") return { status: 400, error: "Only CRM integrations are supported" };
  return { status: 500, error: error.message || "Unexpected error" };
}

export async function GET() {
  try {
    const actor = requireNetworkPartnerRole(
      await requireNetworkPartnerActorContext(),
      ["network_owner", "network_editor", "network_billing"],
    );

    const integrations = await listIntegrationsByNetworkPartner(actor.networkPartnerId);
    return NextResponse.json({
      ok: true,
      integrations: integrations.map((integration) =>
        maskIntegrationForResponse(enrichStoredSecretFlags(integration)),
      ),
    });
  } catch (error) {
    const mapped = mapIntegrationError(error as Error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

export async function POST(req: Request) {
  try {
    const actor = requireNetworkPartnerRole(
      await requireNetworkPartnerActorContext(),
      ["network_owner", "network_editor"],
    );
    const body = (await req.json()) as IntegrationBody;

    const kind = asText(body.kind || "crm").toLowerCase();
    if (kind !== "crm") {
      return NextResponse.json({ error: "Only CRM integrations are supported" }, { status: 400 });
    }

    const provider = asText(body.provider).toLowerCase();
    if (!provider) {
      return NextResponse.json({ error: "provider is required" }, { status: 400 });
    }

    const validation = validateIntegrationConfig({
      kind,
      provider,
      authType: body.auth_type,
      baseUrl: body.base_url,
    });
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const normalizedSettings = normalizeCrmIntegrationSettings(asObject(body.settings));
    if (!normalizedSettings.ok) {
      return NextResponse.json({ error: normalizedSettings.error }, { status: 400 });
    }

    const networkPartner = await getNetworkPartnerById(actor.networkPartnerId);
    if (!networkPartner) {
      return NextResponse.json({ error: "Network partner not found" }, { status: 404 });
    }

    const integration = await createIntegrationForNetworkPartner({
      portal_partner_id: networkPartner.portal_partner_id,
      network_partner_id: actor.networkPartnerId,
      kind: "crm",
      provider: validation.provider as "propstack" | "onoffice",
      base_url: validation.baseUrl,
      auth_type: validation.authType,
      detail_url_template: asNullableText(body.detail_url_template),
      is_active: body.is_active !== false,
      settings: normalizedSettings.value,
    });

    return NextResponse.json(
      { ok: true, integration: maskIntegrationForResponse(enrichStoredSecretFlags(integration)) },
      { status: 201 },
    );
  } catch (error) {
    const mapped = mapIntegrationError(error as Error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
