import { NextResponse } from "next/server";

import { createAdminClient } from "@/utils/supabase/admin";
import { requireNetworkPartnerActorContext } from "@/lib/network-partners/auth";
import { requirePortalPartnerRole } from "@/lib/network-partners/roles";
import {
  formatNetworkPartnerAccessLinkError,
  generateNetworkPartnerAccessLinkForExistingUser,
  generateNetworkPartnerInviteForNewUser,
  sendNetworkPartnerAccessLinkBySmtp,
} from "@/lib/auth/network-partner-access-link";
import {
  getNetworkPartnerByIdForPortalPartner,
  listNetworkPartnerUsersByPortalPartner,
  upsertNetworkPartnerUserForPortalPartner,
} from "@/lib/network-partners/repositories/network-partners";
import type { NetworkPartnerRole } from "@/lib/network-partners/types";

type InviteBody = {
  email?: string;
  role?: NetworkPartnerRole;
  is_primary?: boolean;
  auth_user_id?: string;
};

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

export async function POST(
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

    const body = (await req.json().catch(() => ({}))) as InviteBody;
    const requestedRole = normalizeRole(body.role);
    const admin = createAdminClient();
    const networkPartner = await getNetworkPartnerByIdForPortalPartner(networkPartnerId, actor.partnerId);
    if (!networkPartner) {
      return NextResponse.json({ error: "Network partner not found" }, { status: 404 });
    }

    const providedAuthUserId = asText(body.auth_user_id);
    let authUserId = providedAuthUserId;
    let contactEmail = asText(body.email).toLowerCase() || networkPartner.contact_email.trim().toLowerCase();
    let linkType: "invite" | "recovery" = "invite";
    let redirectTo = "";
    let actionLink = "";
    const existingUsers = await listNetworkPartnerUsersByPortalPartner(networkPartnerId, actor.partnerId);

    if (providedAuthUserId) {
      const existingUser = existingUsers.find((item) => item.auth_user_id === providedAuthUserId);
      if (!existingUser) {
        return NextResponse.json({ error: "Network partner user not found" }, { status: 404 });
      }

      contactEmail = existingUser.email ?? contactEmail;
      if (!contactEmail) {
        return NextResponse.json({ error: "contact_email is required" }, { status: 400 });
      }

      await upsertNetworkPartnerUserForPortalPartner({
        portal_partner_id: actor.partnerId,
        network_partner_id: networkPartnerId,
        auth_user_id: providedAuthUserId,
        role: requestedRole ?? existingUser.role,
      });

      const delivery = await generateNetworkPartnerAccessLinkForExistingUser({
        admin,
        headers: req.headers,
        authUserId: providedAuthUserId,
        contactEmail,
        companyName: networkPartner.company_name,
        networkPartnerId,
      });
      linkType = delivery.linkType;
      redirectTo = delivery.redirectTo;
      actionLink = delivery.actionLink;
    } else {
      if (existingUsers.length > 0) {
        return NextResponse.json({ error: "Network partner access already exists" }, { status: 409 });
      }
      if (!contactEmail) {
        return NextResponse.json({ error: "email is required" }, { status: 400 });
      }

      const draft = await generateNetworkPartnerInviteForNewUser({
        admin,
        headers: req.headers,
        contactEmail,
        companyName: networkPartner.company_name,
        networkPartnerId,
      });
      authUserId = draft.authUserId;
      linkType = draft.linkType;
      redirectTo = draft.redirectTo;
      actionLink = draft.actionLink;

      await upsertNetworkPartnerUserForPortalPartner({
        portal_partner_id: actor.partnerId,
        network_partner_id: networkPartnerId,
        auth_user_id: authUserId,
        role: requestedRole ?? "network_owner",
      });
    }

    await sendNetworkPartnerAccessLinkBySmtp({
      partnerEmail: contactEmail,
      companyName: networkPartner.company_name,
      inviteLink: actionLink,
    });

    const users = await listNetworkPartnerUsersByPortalPartner(networkPartnerId, actor.partnerId);
    return NextResponse.json({
      ok: true,
      auth_user_id: authUserId,
      contact_email: contactEmail,
      link_type: linkType,
      redirect_to: redirectTo,
      users,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (error.message === "FORBIDDEN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (error.message === "NOT_FOUND") {
        return NextResponse.json({ error: "Network partner not found" }, { status: 404 });
      }
    }
    const formatted = formatNetworkPartnerAccessLinkError(error);
    return NextResponse.json({ error: formatted.message }, { status: formatted.status });
  }
}
