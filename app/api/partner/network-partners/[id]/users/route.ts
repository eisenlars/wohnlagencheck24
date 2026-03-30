import { NextResponse } from "next/server";

import { requireNetworkPartnerActorContext } from "@/lib/network-partners/auth";
import { requirePortalPartnerRole } from "@/lib/network-partners/roles";
import {
  listNetworkPartnerUsersByPortalPartner,
  upsertNetworkPartnerUserForPortalPartner,
} from "@/lib/network-partners/repositories/network-partners";
import type { NetworkPartnerRole } from "@/lib/network-partners/types";

function asText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeRole(value: unknown): NetworkPartnerRole | null {
  const normalized = asText(value);
  if (normalized === "network_owner" || normalized === "network_editor" || normalized === "network_billing") {
    return normalized;
  }
  return null;
}

function mapRepositoryError(error: Error) {
  if (error.message === "UNAUTHORIZED") return { status: 401, error: "Unauthorized" };
  if (error.message === "FORBIDDEN") return { status: 403, error: "Forbidden" };
  if (error.message === "NOT_FOUND") return { status: 404, error: "Network partner not found" };
  return { status: 500, error: error.message || "Unexpected error" };
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const actor = requirePortalPartnerRole(
      await requireNetworkPartnerActorContext(),
      ["partner_owner", "partner_manager", "partner_billing"],
    );
    const params = await ctx.params;
    const networkPartnerId = asText(params.id);
    if (!networkPartnerId) {
      return NextResponse.json({ error: "Missing network partner id" }, { status: 400 });
    }

    const users = await listNetworkPartnerUsersByPortalPartner(networkPartnerId, actor.partnerId);
    return NextResponse.json({ ok: true, users });
  } catch (error) {
    const mapped = mapRepositoryError(error as Error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const actor = requirePortalPartnerRole(
      await requireNetworkPartnerActorContext(),
      ["partner_owner", "partner_manager"],
    );
    const params = await ctx.params;
    const networkPartnerId = asText(params.id);
    if (!networkPartnerId) {
      return NextResponse.json({ error: "Missing network partner id" }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      auth_user_id?: string;
      role?: NetworkPartnerRole;
    };
    const authUserId = asText(body.auth_user_id);
    const role = normalizeRole(body.role);

    if (!authUserId) {
      return NextResponse.json({ error: "auth_user_id is required" }, { status: 400 });
    }
    if (!role) {
      return NextResponse.json({ error: "role is required" }, { status: 400 });
    }

    const users = await listNetworkPartnerUsersByPortalPartner(networkPartnerId, actor.partnerId);
    const existingUser = users.find((item) => item.auth_user_id === authUserId);
    if (!existingUser) {
      return NextResponse.json({ error: "Network partner user not found" }, { status: 404 });
    }

    await upsertNetworkPartnerUserForPortalPartner({
      portal_partner_id: actor.partnerId,
      network_partner_id: networkPartnerId,
      auth_user_id: authUserId,
      role,
      is_primary: existingUser.is_primary,
    });

    const refreshedUsers = await listNetworkPartnerUsersByPortalPartner(networkPartnerId, actor.partnerId);
    return NextResponse.json({ ok: true, users: refreshedUsers });
  } catch (error) {
    const mapped = mapRepositoryError(error as Error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
