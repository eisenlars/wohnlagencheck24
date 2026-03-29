import { createAdminClient } from "@/utils/supabase/admin";
import {
  isNetworkPartnerCrmProvider,
  isNetworkPartnerIntegrationKind,
  type NetworkPartnerCrmProvider,
} from "@/lib/network-partners/sync/types";
import type {
  NetworkPartnerIntegrationCreateInput,
  NetworkPartnerIntegrationKind,
  NetworkPartnerIntegrationRecord,
  NetworkPartnerIntegrationUpdateInput,
} from "@/lib/network-partners/types";

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

function asRowArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord);
}

function asJsonObject(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function normalizeKind(value: unknown): NetworkPartnerIntegrationKind {
  const kind = asText(value).toLowerCase();
  if (!isNetworkPartnerIntegrationKind(kind)) {
    throw new Error("INVALID_KIND");
  }
  return kind;
}

function normalizeProvider(value: unknown): NetworkPartnerCrmProvider {
  const provider = asText(value).toLowerCase();
  if (!isNetworkPartnerCrmProvider(provider)) {
    throw new Error("INVALID_PROVIDER");
  }
  return provider;
}

function mapNetworkPartnerIntegrationRow(
  row: Record<string, unknown>,
): NetworkPartnerIntegrationRecord {
  return {
    id: asText(row.id),
    portal_partner_id: asText(row.portal_partner_id),
    network_partner_id: asText(row.network_partner_id),
    kind: normalizeKind(row.kind),
    provider: asText(row.provider).toLowerCase(),
    base_url: asNullableText(row.base_url),
    auth_type: asNullableText(row.auth_type),
    auth_config: asJsonObject(row.auth_config),
    detail_url_template: asNullableText(row.detail_url_template),
    is_active: row.is_active !== false,
    settings: asJsonObject(row.settings),
    last_test_at: asNullableText(row.last_test_at),
    last_preview_sync_at: asNullableText(row.last_preview_sync_at),
    last_sync_at: asNullableText(row.last_sync_at),
    created_at: asNullableText(row.created_at),
    updated_at: asNullableText(row.updated_at),
  };
}

function normalizeCreatePayload(
  input: NetworkPartnerIntegrationCreateInput,
): Record<string, unknown> {
  return {
    portal_partner_id: asText(input.portal_partner_id),
    network_partner_id: asText(input.network_partner_id),
    kind: input.kind ?? "crm",
    provider: normalizeProvider(input.provider),
    base_url: asNullableText(input.base_url),
    auth_type: asNullableText(input.auth_type),
    auth_config: asJsonObject(input.auth_config),
    detail_url_template: asNullableText(input.detail_url_template),
    is_active: input.is_active !== false,
    settings: asJsonObject(input.settings),
  };
}

function normalizeUpdatePayload(
  input: NetworkPartnerIntegrationUpdateInput,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (input.provider !== undefined) patch.provider = normalizeProvider(input.provider);
  if (input.base_url !== undefined) patch.base_url = asNullableText(input.base_url);
  if (input.auth_type !== undefined) patch.auth_type = asNullableText(input.auth_type);
  if (input.auth_config !== undefined) patch.auth_config = asJsonObject(input.auth_config);
  if (input.detail_url_template !== undefined) {
    patch.detail_url_template = asNullableText(input.detail_url_template);
  }
  if (input.is_active !== undefined) patch.is_active = input.is_active === true;
  if (input.settings !== undefined) patch.settings = asJsonObject(input.settings);
  return patch;
}

function assertRequiredText(value: string, field: string) {
  if (!value) {
    throw new Error(`INVALID_${field.toUpperCase()}`);
  }
}

const SELECT_COLUMNS = [
  "id",
  "portal_partner_id",
  "network_partner_id",
  "kind",
  "provider",
  "base_url",
  "auth_type",
  "auth_config",
  "detail_url_template",
  "is_active",
  "settings",
  "last_test_at",
  "last_preview_sync_at",
  "last_sync_at",
  "created_at",
  "updated_at",
].join(", ");

export async function listIntegrationsByNetworkPartner(
  networkPartnerId: string,
): Promise<NetworkPartnerIntegrationRecord[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("network_partner_integrations")
    .select(SELECT_COLUMNS)
    .eq("network_partner_id", networkPartnerId)
    .order("provider", { ascending: true });

  if (error) throw new Error(error.message ?? "NETWORK_PARTNER_INTEGRATIONS_LIST_FAILED");
  return asRowArray(data).map((row) => mapNetworkPartnerIntegrationRow(row));
}

export async function getIntegrationById(
  id: string,
): Promise<NetworkPartnerIntegrationRecord | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("network_partner_integrations")
    .select(SELECT_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message ?? "NETWORK_PARTNER_INTEGRATION_QUERY_FAILED");
  return isRecord(data) ? mapNetworkPartnerIntegrationRow(data) : null;
}

export async function getIntegrationByIdForNetworkPartner(
  id: string,
  networkPartnerId: string,
): Promise<NetworkPartnerIntegrationRecord | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("network_partner_integrations")
    .select(SELECT_COLUMNS)
    .eq("id", id)
    .eq("network_partner_id", networkPartnerId)
    .maybeSingle();

  if (error) throw new Error(error.message ?? "NETWORK_PARTNER_INTEGRATION_QUERY_FAILED");
  return isRecord(data) ? mapNetworkPartnerIntegrationRow(data) : null;
}

export async function createIntegrationForNetworkPartner(
  input: NetworkPartnerIntegrationCreateInput,
): Promise<NetworkPartnerIntegrationRecord> {
  const payload = normalizeCreatePayload(input);
  assertRequiredText(asText(payload.portal_partner_id), "portal_partner_id");
  assertRequiredText(asText(payload.network_partner_id), "network_partner_id");
  assertRequiredText(asText(payload.provider), "provider");

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("network_partner_integrations")
    .insert(payload)
    .select(SELECT_COLUMNS)
    .maybeSingle();

  if (error) throw new Error(error.message ?? "NETWORK_PARTNER_INTEGRATION_CREATE_FAILED");
  if (!isRecord(data)) throw new Error("NETWORK_PARTNER_INTEGRATION_CREATE_FAILED");
  return mapNetworkPartnerIntegrationRow(data);
}

export async function updateIntegrationForNetworkPartner(
  input: NetworkPartnerIntegrationUpdateInput,
): Promise<NetworkPartnerIntegrationRecord> {
  assertRequiredText(asText(input.id), "id");
  assertRequiredText(asText(input.network_partner_id), "network_partner_id");

  const patch = normalizeUpdatePayload(input);
  if (Object.keys(patch).length === 0) {
    throw new Error("NO_UPDATE_FIELDS");
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("network_partner_integrations")
    .update(patch)
    .eq("id", input.id)
    .eq("network_partner_id", input.network_partner_id)
    .select(SELECT_COLUMNS)
    .maybeSingle();

  if (error) throw new Error(error.message ?? "NETWORK_PARTNER_INTEGRATION_UPDATE_FAILED");
  if (!isRecord(data)) throw new Error("NOT_FOUND");
  return mapNetworkPartnerIntegrationRow(data);
}

export async function deleteIntegrationForNetworkPartner(
  id: string,
  networkPartnerId: string,
): Promise<void> {
  assertRequiredText(asText(id), "id");
  assertRequiredText(asText(networkPartnerId), "network_partner_id");

  const admin = createAdminClient();
  const { error } = await admin
    .from("network_partner_integrations")
    .delete()
    .eq("id", id)
    .eq("network_partner_id", networkPartnerId);

  if (error) throw new Error(error.message ?? "NETWORK_PARTNER_INTEGRATION_DELETE_FAILED");
}
