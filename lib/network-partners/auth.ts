import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import type {
  ActorContext,
  AdminRole,
  NetworkPartnerRole,
  PortalPartnerRole,
} from "@/lib/network-partners/types";

type SingleRowResponse = {
  data?: Record<string, unknown> | null;
  error?: { message?: string } | null;
};

function asNonEmpty(value: unknown): string | null {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

async function maybeLoadAdminRole(userId: string): Promise<AdminRole | null> {
  const admin = createAdminClient();
  const res = await admin
    .from("admin_users")
    .select("role")
    .eq("auth_user_id", userId)
    .maybeSingle() as SingleRowResponse;

  const role = asNonEmpty(res.data?.role);
  if (role === "admin_super" || role === "admin_ops" || role === "admin_billing") {
    return role;
  }
  return null;
}

async function maybeLoadPortalPartnerRole(
  userId: string,
): Promise<{ partnerId: string; role: PortalPartnerRole } | null> {
  const admin = createAdminClient();
  const res = await admin
    .from("partner_users")
    .select("partner_id, role")
    .eq("auth_user_id", userId)
    .maybeSingle() as SingleRowResponse;

  const partnerId = asNonEmpty(res.data?.partner_id);
  const role = asNonEmpty(res.data?.role);
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
  const res = await admin
    .from("network_partner_users")
    .select("network_partner_id, role")
    .eq("auth_user_id", userId)
    .maybeSingle() as SingleRowResponse;

  const networkPartnerId = asNonEmpty(res.data?.network_partner_id);
  const role = asNonEmpty(res.data?.role);
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
