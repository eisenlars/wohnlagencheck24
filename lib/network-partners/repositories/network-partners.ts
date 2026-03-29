import { createAdminClient } from "@/utils/supabase/admin";
import type {
  NetworkPartnerCreateInput,
  NetworkPartnerRecord,
  NetworkPartnerStatus,
  NetworkPartnerUpdateInput,
} from "@/lib/network-partners/types";

type QueryError = { message?: string } | null;

function asText(value: unknown): string {
  return String(value ?? "").trim();
}

function asNullableText(value: unknown): string | null {
  const normalized = asText(value);
  return normalized.length > 0 ? normalized : null;
}

function normalizeStatus(value: unknown): NetworkPartnerStatus {
  const status = asText(value);
  if (status === "paused" || status === "inactive") return status;
  return "active";
}

function mapNetworkPartnerRow(row: Record<string, unknown>): NetworkPartnerRecord {
  return {
    id: asText(row.id),
    portal_partner_id: asText(row.portal_partner_id),
    company_name: asText(row.company_name),
    legal_name: asNullableText(row.legal_name),
    contact_email: asText(row.contact_email),
    contact_phone: asNullableText(row.contact_phone),
    website_url: asNullableText(row.website_url),
    status: normalizeStatus(row.status),
    managed_editing_enabled: row.managed_editing_enabled === true,
    created_at: asText(row.created_at),
    updated_at: asText(row.updated_at),
  };
}

function normalizeCreatePayload(input: NetworkPartnerCreateInput): Record<string, unknown> {
  return {
    portal_partner_id: input.portal_partner_id,
    company_name: asText(input.company_name),
    legal_name: asNullableText(input.legal_name),
    contact_email: asText(input.contact_email),
    contact_phone: asNullableText(input.contact_phone),
    website_url: asNullableText(input.website_url),
    status: input.status ?? "active",
    managed_editing_enabled: input.managed_editing_enabled === true,
  };
}

function normalizeUpdatePayload(input: NetworkPartnerUpdateInput): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (input.company_name !== undefined) patch.company_name = asText(input.company_name);
  if (input.legal_name !== undefined) patch.legal_name = asNullableText(input.legal_name);
  if (input.contact_email !== undefined) patch.contact_email = asText(input.contact_email);
  if (input.contact_phone !== undefined) patch.contact_phone = asNullableText(input.contact_phone);
  if (input.website_url !== undefined) patch.website_url = asNullableText(input.website_url);
  if (input.status !== undefined) patch.status = input.status;
  if (input.managed_editing_enabled !== undefined) {
    patch.managed_editing_enabled = input.managed_editing_enabled === true;
  }
  return patch;
}

function assertRequiredText(value: string, field: string) {
  if (!value) {
    throw new Error(`INVALID_${field.toUpperCase()}`);
  }
}

async function maybeSinglePartnerQuery(
  query: Promise<{ data?: Record<string, unknown> | null; error?: QueryError }>,
) {
  const { data, error } = await query;
  if (error) throw new Error(error.message ?? "NETWORK_PARTNER_QUERY_FAILED");
  return data ? mapNetworkPartnerRow(data) : null;
}

export async function listNetworkPartnersByPortalPartner(
  partnerId: string,
): Promise<NetworkPartnerRecord[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("network_partners")
    .select("id, portal_partner_id, company_name, legal_name, contact_email, contact_phone, website_url, status, managed_editing_enabled, created_at, updated_at")
    .eq("portal_partner_id", partnerId)
    .order("company_name", { ascending: true });

  if (error) throw new Error(error.message ?? "NETWORK_PARTNERS_LIST_FAILED");
  return (data ?? []).map((row) => mapNetworkPartnerRow(row as Record<string, unknown>));
}

export async function getNetworkPartnerById(id: string): Promise<NetworkPartnerRecord | null> {
  const admin = createAdminClient();
  return maybeSinglePartnerQuery(
    admin
      .from("network_partners")
      .select("id, portal_partner_id, company_name, legal_name, contact_email, contact_phone, website_url, status, managed_editing_enabled, created_at, updated_at")
      .eq("id", id)
      .maybeSingle(),
  );
}

export async function getNetworkPartnerByIdForPortalPartner(
  id: string,
  partnerId: string,
): Promise<NetworkPartnerRecord | null> {
  const admin = createAdminClient();
  return maybeSinglePartnerQuery(
    admin
      .from("network_partners")
      .select("id, portal_partner_id, company_name, legal_name, contact_email, contact_phone, website_url, status, managed_editing_enabled, created_at, updated_at")
      .eq("id", id)
      .eq("portal_partner_id", partnerId)
      .maybeSingle(),
  );
}

export async function createNetworkPartner(
  input: NetworkPartnerCreateInput,
): Promise<NetworkPartnerRecord> {
  const payload = normalizeCreatePayload(input);
  assertRequiredText(asText(payload.portal_partner_id), "portal_partner_id");
  assertRequiredText(asText(payload.company_name), "company_name");
  assertRequiredText(asText(payload.contact_email), "contact_email");

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("network_partners")
    .insert(payload)
    .select("id, portal_partner_id, company_name, legal_name, contact_email, contact_phone, website_url, status, managed_editing_enabled, created_at, updated_at")
    .maybeSingle();

  if (error) throw new Error(error.message ?? "NETWORK_PARTNER_CREATE_FAILED");
  if (!data) throw new Error("NETWORK_PARTNER_CREATE_FAILED");
  return mapNetworkPartnerRow(data as Record<string, unknown>);
}

export async function updateNetworkPartner(
  input: NetworkPartnerUpdateInput,
): Promise<NetworkPartnerRecord> {
  assertRequiredText(asText(input.id), "id");
  assertRequiredText(asText(input.portal_partner_id), "portal_partner_id");
  const patch = normalizeUpdatePayload(input);
  if (Object.keys(patch).length === 0) {
    throw new Error("NO_UPDATE_FIELDS");
  }

  if (patch.company_name !== undefined) {
    assertRequiredText(asText(patch.company_name), "company_name");
  }
  if (patch.contact_email !== undefined) {
    assertRequiredText(asText(patch.contact_email), "contact_email");
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("network_partners")
    .update(patch)
    .eq("id", input.id)
    .eq("portal_partner_id", input.portal_partner_id)
    .select("id, portal_partner_id, company_name, legal_name, contact_email, contact_phone, website_url, status, managed_editing_enabled, created_at, updated_at")
    .maybeSingle();

  if (error) throw new Error(error.message ?? "NETWORK_PARTNER_UPDATE_FAILED");
  if (!data) throw new Error("NOT_FOUND");
  return mapNetworkPartnerRow(data as Record<string, unknown>);
}
