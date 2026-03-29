import { createAdminClient } from "@/utils/supabase/admin";
import type {
  AdminRole,
  ActorContext,
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

export function isAdminActor(
  actor: ActorContext | null,
): actor is Extract<ActorContext, { kind: "admin" }> {
  return actor?.kind === "admin";
}

export function isPortalPartnerActor(
  actor: ActorContext | null,
): actor is Extract<ActorContext, { kind: "portal_partner" }> {
  return actor?.kind === "portal_partner";
}

export function isNetworkPartnerActor(
  actor: ActorContext | null,
): actor is Extract<ActorContext, { kind: "network_partner" }> {
  return actor?.kind === "network_partner";
}

export function requirePortalPartnerRole(
  actor: ActorContext | null,
  allowed: PortalPartnerRole[],
): Extract<ActorContext, { kind: "portal_partner" }> {
  if (!isPortalPartnerActor(actor)) {
    throw new Error("FORBIDDEN");
  }
  if (!allowed.includes(actor.role)) {
    throw new Error("FORBIDDEN");
  }
  return actor;
}

export function requireAdminRole(
  actor: ActorContext | null,
  allowed: AdminRole[] = ["admin_super", "admin_ops", "admin_billing"],
): Extract<ActorContext, { kind: "admin" }> {
  if (!isAdminActor(actor)) {
    throw new Error("FORBIDDEN");
  }
  if (!allowed.includes(actor.role)) {
    throw new Error("FORBIDDEN");
  }
  return actor;
}

export function requireNetworkPartnerRole(
  actor: ActorContext | null,
  allowed: NetworkPartnerRole[],
): Extract<ActorContext, { kind: "network_partner" }> {
  if (!isNetworkPartnerActor(actor)) {
    throw new Error("FORBIDDEN");
  }
  if (!allowed.includes(actor.role)) {
    throw new Error("FORBIDDEN");
  }
  return actor;
}

export async function assertPortalPartnerOwnsNetworkPartner(
  partnerId: string,
  networkPartnerId: string,
): Promise<void> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("network_partners")
    .select("id, portal_partner_id")
    .eq("id", networkPartnerId)
    .maybeSingle();

  if (error) throw new Error(error.message ?? "NETWORK_PARTNER_LOOKUP_FAILED");
  if (!isRecord(data)) throw new Error("NOT_FOUND");

  const ownerPartnerId = asNonEmpty(data.portal_partner_id);
  if (!ownerPartnerId || ownerPartnerId !== partnerId) {
    throw new Error("FORBIDDEN");
  }
}

export async function assertPortalPartnerOwnsArea(
  partnerId: string,
  areaId: string,
): Promise<void> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("partner_area_map")
    .select("id")
    .eq("auth_user_id", partnerId)
    .eq("area_id", areaId)
    .maybeSingle();

  if (error) throw new Error(error.message ?? "PARTNER_AREA_LOOKUP_FAILED");
  if (!data) throw new Error("FORBIDDEN");
}
