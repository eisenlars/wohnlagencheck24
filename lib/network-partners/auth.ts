import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import type {
  ActorContext,
  AdminRole,
  NetworkPartnerRole,
  PortalPartnerRole,
} from "@/lib/network-partners/types";

function asNonEmpty(value: unknown): string | null {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function maybeLoadAdminRole(userId: string): Promise<AdminRole | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("admin_users")
    .select("role")
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message ?? "ADMIN_ROLE_LOOKUP_FAILED");
  const role = asNonEmpty(isRecord(data) ? data.role : null);
  if (role === "admin_super" || role === "admin_ops" || role === "admin_billing") {
    return role;
  }
  return null;
}

async function maybeLoadPortalPartnerRole(
  userId: string,
): Promise<{ partnerId: string; role: PortalPartnerRole } | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("partner_users")
    .select("partner_id, role")
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message ?? "PARTNER_ROLE_LOOKUP_FAILED");
  const partnerId = asNonEmpty(isRecord(data) ? data.partner_id : null);
  const role = asNonEmpty(isRecord(data) ? data.role : null);
  if (
    partnerId
    && (role === "partner_owner" || role === "partner_manager" || role === "partner_billing")
  ) {
    return { partnerId, role };
  }
  return null;
}

async function maybeLoadNetworkPartnerRole(
  userId: string,
): Promise<{ networkPartnerId: string; role: NetworkPartnerRole } | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("network_partner_users")
    .select("network_partner_id, role")
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message ?? "NETWORK_PARTNER_ROLE_LOOKUP_FAILED");
  const networkPartnerId = asNonEmpty(isRecord(data) ? data.network_partner_id : null);
  const role = asNonEmpty(isRecord(data) ? data.role : null);
  if (
    networkPartnerId
    && (role === "network_owner" || role === "network_editor" || role === "network_billing")
  ) {
    return { networkPartnerId, role };
  }
  return null;
}

export async function getNetworkPartnerActorContext(): Promise<ActorContext | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userId = asNonEmpty(user?.id);
  if (!userId) return null;

  const adminRole = await maybeLoadAdminRole(userId);
  if (adminRole) {
    return { kind: "admin", userId, role: adminRole };
  }

  const portalPartnerRole = await maybeLoadPortalPartnerRole(userId);
  if (portalPartnerRole) {
    return {
      kind: "portal_partner",
      userId,
      partnerId: portalPartnerRole.partnerId,
      role: portalPartnerRole.role,
    };
  }

  const networkPartnerRole = await maybeLoadNetworkPartnerRole(userId);
  if (networkPartnerRole) {
    return {
      kind: "network_partner",
      userId,
      networkPartnerId: networkPartnerRole.networkPartnerId,
      role: networkPartnerRole.role,
    };
  }

  return null;
}

export async function requireNetworkPartnerActorContext(): Promise<ActorContext> {
  const actor = await getNetworkPartnerActorContext();
  if (!actor) {
    throw new Error("UNAUTHORIZED");
  }
  return actor;
}
