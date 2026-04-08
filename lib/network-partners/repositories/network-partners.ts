import { createAdminClient } from "@/utils/supabase/admin";
import type {
  NetworkPartnerCreateInput,
  NetworkPartnerRecord,
  NetworkPartnerStatus,
  NetworkPartnerUpdateInput,
  NetworkPartnerUserRecord,
  NetworkPartnerRole,
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
    llm_partner_managed_allowed: row.llm_partner_managed_allowed !== false,
    created_at: asText(row.created_at),
    updated_at: asText(row.updated_at),
  };
}

function mapNetworkPartnerUserRow(
  row: Record<string, unknown>,
  authInfo: {
    email: string | null;
    activation_pending: boolean;
    last_sign_in_at: string | null;
  },
): NetworkPartnerUserRecord {
  const role = asText(row.role);
  if (role !== "network_owner" && role !== "network_editor" && role !== "network_billing") {
    throw new Error("INVALID_NETWORK_PARTNER_ROLE");
  }

  return {
    id: asText(row.id),
    network_partner_id: asText(row.network_partner_id),
    auth_user_id: asText(row.auth_user_id),
    role,
    is_primary: row.is_primary === true,
    email: authInfo.email,
    activation_pending: authInfo.activation_pending,
    last_sign_in_at: authInfo.last_sign_in_at,
    created_at: asText(row.created_at),
  };
}

function isPendingActivation(value: unknown): boolean {
  if (value === true) return true;
  return String(value ?? "").trim().toLowerCase() === "true";
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
    llm_partner_managed_allowed: input.llm_partner_managed_allowed !== false,
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
  if (input.llm_partner_managed_allowed !== undefined) {
    patch.llm_partner_managed_allowed = input.llm_partner_managed_allowed !== false;
  }
  return patch;
}

function assertRequiredText(value: string, field: string) {
  if (!value) {
    throw new Error(`INVALID_${field.toUpperCase()}`);
  }
}

export async function listNetworkPartnersByPortalPartner(
  partnerId: string,
): Promise<NetworkPartnerRecord[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("network_partners")
    .select("id, portal_partner_id, company_name, legal_name, contact_email, contact_phone, website_url, status, managed_editing_enabled, llm_partner_managed_allowed, created_at, updated_at")
    .eq("portal_partner_id", partnerId)
    .order("company_name", { ascending: true });

  if (error) throw new Error(error.message ?? "NETWORK_PARTNERS_LIST_FAILED");
  return asRowArray(data).map((row) => mapNetworkPartnerRow(row));
}

export async function getNetworkPartnerById(id: string): Promise<NetworkPartnerRecord | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("network_partners")
    .select("id, portal_partner_id, company_name, legal_name, contact_email, contact_phone, website_url, status, managed_editing_enabled, llm_partner_managed_allowed, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message ?? "NETWORK_PARTNER_QUERY_FAILED");
  return isRecord(data) ? mapNetworkPartnerRow(data) : null;
}

export async function getNetworkPartnerByIdForPortalPartner(
  id: string,
  partnerId: string,
): Promise<NetworkPartnerRecord | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("network_partners")
    .select("id, portal_partner_id, company_name, legal_name, contact_email, contact_phone, website_url, status, managed_editing_enabled, llm_partner_managed_allowed, created_at, updated_at")
    .eq("id", id)
    .eq("portal_partner_id", partnerId)
    .maybeSingle();

  if (error) throw new Error(error.message ?? "NETWORK_PARTNER_QUERY_FAILED");
  return isRecord(data) ? mapNetworkPartnerRow(data) : null;
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
    .select("id, portal_partner_id, company_name, legal_name, contact_email, contact_phone, website_url, status, managed_editing_enabled, llm_partner_managed_allowed, created_at, updated_at")
    .maybeSingle();

  if (error) throw new Error(error.message ?? "NETWORK_PARTNER_CREATE_FAILED");
  if (!isRecord(data)) throw new Error("NETWORK_PARTNER_CREATE_FAILED");
  return mapNetworkPartnerRow(data);
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
    .select("id, portal_partner_id, company_name, legal_name, contact_email, contact_phone, website_url, status, managed_editing_enabled, llm_partner_managed_allowed, created_at, updated_at")
    .maybeSingle();

  if (error) throw new Error(error.message ?? "NETWORK_PARTNER_UPDATE_FAILED");
  if (!isRecord(data)) throw new Error("NOT_FOUND");
  return mapNetworkPartnerRow(data);
}

export async function listNetworkPartnerUsersByPortalPartner(
  networkPartnerId: string,
  portalPartnerId: string,
): Promise<NetworkPartnerUserRecord[]> {
  const networkPartner = await getNetworkPartnerByIdForPortalPartner(networkPartnerId, portalPartnerId);
  if (!networkPartner) {
    throw new Error("NOT_FOUND");
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("network_partner_users")
    .select("id, network_partner_id, auth_user_id, role, is_primary, created_at")
    .eq("network_partner_id", networkPartnerId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message ?? "NETWORK_PARTNER_USERS_LIST_FAILED");
  const rows = asRowArray(data);

  const authUsers = await Promise.all(rows.map(async (row) => {
    const authUserId = asText(row.auth_user_id);
    if (!authUserId) {
      return {
        authUserId,
        email: null,
        activation_pending: false,
        last_sign_in_at: null,
      };
    }
    const userResult = await admin.auth.admin.getUserById(authUserId);
    const user = userResult.data.user;
    const email = String(user?.email ?? "").trim().toLowerCase() || null;
    return {
      authUserId,
      email,
      activation_pending: isPendingActivation((user?.user_metadata as Record<string, unknown> | undefined)?.activation_pending),
      last_sign_in_at: String(user?.last_sign_in_at ?? "").trim() || null,
    };
  }));
  const authInfoByAuthUserId = new Map(authUsers.map((item) => [item.authUserId, item] as const));

  return rows.map((row) => mapNetworkPartnerUserRow(row, authInfoByAuthUserId.get(asText(row.auth_user_id)) ?? {
    email: null,
    activation_pending: false,
    last_sign_in_at: null,
  }));
}

export async function upsertNetworkPartnerUserForPortalPartner(input: {
  portal_partner_id: string;
  network_partner_id: string;
  auth_user_id: string;
  role: NetworkPartnerRole;
  is_primary?: boolean;
}): Promise<NetworkPartnerUserRecord> {
  const networkPartner = await getNetworkPartnerByIdForPortalPartner(input.network_partner_id, input.portal_partner_id);
  if (!networkPartner) {
    throw new Error("NOT_FOUND");
  }

  const admin = createAdminClient();
  const memberships = await listNetworkPartnerUsersByPortalPartner(input.network_partner_id, input.portal_partner_id);
  const shouldBePrimary = input.is_primary === true || memberships.length === 0;

  if (shouldBePrimary) {
    const { error: clearError } = await admin
      .from("network_partner_users")
      .update({ is_primary: false })
      .eq("network_partner_id", input.network_partner_id);

    if (clearError) {
      throw new Error(clearError.message ?? "NETWORK_PARTNER_USERS_CLEAR_PRIMARY_FAILED");
    }
  }

  const { data, error } = await admin
    .from("network_partner_users")
    .upsert({
      network_partner_id: input.network_partner_id,
      auth_user_id: input.auth_user_id,
      role: input.role,
      is_primary: shouldBePrimary,
    }, {
      onConflict: "network_partner_id,auth_user_id",
    })
    .select("id, network_partner_id, auth_user_id, role, is_primary, created_at")
    .maybeSingle();

  if (error) throw new Error(error.message ?? "NETWORK_PARTNER_USER_UPSERT_FAILED");
  if (!isRecord(data)) throw new Error("NETWORK_PARTNER_USER_UPSERT_FAILED");

  const authUser = await admin.auth.admin.getUserById(input.auth_user_id);
  const user = authUser.data.user;
  return mapNetworkPartnerUserRow(data, {
    email: String(user?.email ?? "").trim().toLowerCase() || null,
    activation_pending: isPendingActivation((user?.user_metadata as Record<string, unknown> | undefined)?.activation_pending),
    last_sign_in_at: String(user?.last_sign_in_at ?? "").trim() || null,
  });
}
