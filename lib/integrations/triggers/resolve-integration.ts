import { createAdminClient } from "@/utils/supabase/admin";
import { decryptIntegrationSecret } from "@/lib/security/secret-crypto";
import type { ProviderKey } from "@/lib/providers/types";
import type { ResolvedPartnerTriggerIntegration } from "@/lib/integrations/triggers/types";

function asText(value: unknown): string {
  return String(value ?? "").trim();
}

function asNullableText(value: unknown): string | null {
  const normalized = asText(value);
  return normalized.length > 0 ? normalized : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asJsonObject(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function readSettingsToken(settings: Record<string, unknown> | null | undefined): string | null {
  const trigger = isRecord(settings?.trigger) ? (settings.trigger as Record<string, unknown>) : null;
  return (
    asNullableText(trigger?.token)
    ?? asNullableText(settings?.webhook_token)
    ?? asNullableText(settings?.incoming_webhook_token)
  );
}

function readSecretValue(source: Record<string, unknown> | null | undefined, key: string): string | null {
  const encrypted = decryptIntegrationSecret(source?.[`${key}_encrypted`]);
  if (encrypted) return encrypted;
  return asNullableText(source?.[key]);
}

function mapIntegrationRow(row: Record<string, unknown>): ResolvedPartnerTriggerIntegration {
  return {
    id: asText(row.id),
    partner_id: asText(row.partner_id),
    kind: "crm",
    provider: asText(row.provider).toLowerCase() as ProviderKey,
    base_url: asNullableText(row.base_url),
    auth_type: asNullableText(row.auth_type),
    auth_config: asJsonObject(row.auth_config),
    detail_url_template: asNullableText(row.detail_url_template),
    is_active: row.is_active !== false,
    settings: asJsonObject(row.settings),
    last_sync_at: asNullableText(row.last_sync_at),
  };
}

export function readPartnerIntegrationTriggerSecret(
  integration: ResolvedPartnerTriggerIntegration,
): string | null {
  const trigger = isRecord(integration.settings?.trigger)
    ? (integration.settings?.trigger as Record<string, unknown>)
    : null;
  return (
    readSecretValue(trigger, "secret")
    ?? readSecretValue(integration.settings ?? null, "webhook_secret")
    ?? readSecretValue(integration.auth_config ?? null, "webhook_secret")
  );
}

export async function resolvePartnerIntegrationByTriggerToken(input: {
  provider: ProviderKey;
  token: string;
}): Promise<ResolvedPartnerTriggerIntegration | null> {
  const token = asText(input.token);
  if (!token) return null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("partner_integrations")
    .select("id, partner_id, kind, provider, base_url, auth_type, auth_config, detail_url_template, is_active, settings, last_sync_at")
    .eq("provider", input.provider)
    .eq("kind", "crm")
    .eq("is_active", true);

  if (error) throw new Error(error.message ?? "PARTNER_TRIGGER_INTEGRATION_LOOKUP_FAILED");

  const rows = Array.isArray(data) ? data.filter(isRecord).map(mapIntegrationRow) : [];
  const bySettingsToken = rows.find((row) => readSettingsToken(row.settings) === token);
  if (bySettingsToken) return bySettingsToken;

  return rows.find((row) => row.id === token) ?? null;
}
