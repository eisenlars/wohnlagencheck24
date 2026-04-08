import { NextResponse } from "next/server";

import { createAdminClient } from "@/utils/supabase/admin";
import { requireNetworkPartnerActorContext } from "@/lib/network-partners/auth";
import { requirePortalPartnerRole } from "@/lib/network-partners/roles";
import {
  formatNetworkPartnerAccessLinkError,
  generateNetworkPartnerInviteForNewUser,
  sendNetworkPartnerAccessLinkBySmtp,
} from "@/lib/auth/network-partner-access-link";
import {
  createNetworkPartner,
  listNetworkPartnersByPortalPartner,
  upsertNetworkPartnerUserForPortalPartner,
} from "@/lib/network-partners/repositories/network-partners";
import type { NetworkPartnerStatus } from "@/lib/network-partners/types";

type NetworkPartnerBody = {
  company_name?: string;
  legal_name?: string | null;
  contact_email?: string;
  contact_phone?: string | null;
  website_url?: string | null;
  status?: NetworkPartnerStatus;
  managed_editing_enabled?: boolean;
  llm_partner_managed_allowed?: boolean;
  send_invite?: boolean;
};

function normalizeRequiredText(value: unknown): string | null {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeOptionalText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeStatus(value: unknown): NetworkPartnerStatus | null {
  const normalized = String(value ?? "").trim();
  if (normalized === "active" || normalized === "paused" || normalized === "inactive") {
    return normalized;
  }
  return null;
}

function mapRepositoryError(error: Error) {
  if (error.message === "UNAUTHORIZED") return { status: 401, error: "Unauthorized" };
  if (error.message === "FORBIDDEN") return { status: 403, error: "Forbidden" };
  if (error.message === "INVALID_COMPANY_NAME") return { status: 400, error: "company_name is required" };
  if (error.message === "INVALID_CONTACT_EMAIL") return { status: 400, error: "contact_email is required" };
  return { status: 500, error: error.message || "Unexpected error" };
}

export async function GET() {
  try {
    const actor = requirePortalPartnerRole(
      await requireNetworkPartnerActorContext(),
      ["partner_owner", "partner_manager", "partner_billing"],
    );

    const networkPartners = await listNetworkPartnersByPortalPartner(actor.partnerId);
    return NextResponse.json({ ok: true, network_partners: networkPartners });
  } catch (error) {
    const mapped = mapRepositoryError(error as Error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

export async function POST(req: Request) {
  try {
    const actor = requirePortalPartnerRole(
      await requireNetworkPartnerActorContext(),
      ["partner_owner", "partner_manager"],
    );

    const body = (await req.json()) as NetworkPartnerBody;
    const companyName = normalizeRequiredText(body.company_name);
    const contactEmail = normalizeRequiredText(body.contact_email);
    const status = body.status !== undefined ? normalizeStatus(body.status) : "active";

    if (!companyName) {
      return NextResponse.json({ error: "company_name is required" }, { status: 400 });
    }
    if (!contactEmail) {
      return NextResponse.json({ error: "contact_email is required" }, { status: 400 });
    }
    if (!status) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const networkPartner = await createNetworkPartner({
      portal_partner_id: actor.partnerId,
      company_name: companyName,
      legal_name: normalizeOptionalText(body.legal_name),
      contact_email: contactEmail,
      contact_phone: normalizeOptionalText(body.contact_phone),
      website_url: normalizeOptionalText(body.website_url),
      status,
      managed_editing_enabled: body.managed_editing_enabled === true,
      llm_partner_managed_allowed: body.llm_partner_managed_allowed === true,
    });

    if (body.send_invite === true) {
      try {
        const admin = createAdminClient();
        const delivery = await generateNetworkPartnerInviteForNewUser({
          admin,
          headers: req.headers,
          contactEmail,
          companyName: networkPartner.company_name,
          networkPartnerId: networkPartner.id,
        });

        await upsertNetworkPartnerUserForPortalPartner({
          portal_partner_id: actor.partnerId,
          network_partner_id: networkPartner.id,
          auth_user_id: delivery.authUserId,
          role: "network_owner",
        });

        await sendNetworkPartnerAccessLinkBySmtp({
          partnerEmail: contactEmail,
          companyName: networkPartner.company_name,
          inviteLink: delivery.actionLink,
        });

        return NextResponse.json({
          ok: true,
          network_partner: networkPartner,
          invite_sent: true,
          contact_email: contactEmail,
          link_type: delivery.linkType,
          redirect_to: delivery.redirectTo,
        }, { status: 201 });
      } catch (error) {
        const formatted = formatNetworkPartnerAccessLinkError(error);
        return NextResponse.json({
          ok: true,
          network_partner: networkPartner,
          invite_sent: false,
          invite_error: formatted.message,
        }, { status: 201 });
      }
    }

    return NextResponse.json({ ok: true, network_partner: networkPartner, invite_sent: false }, { status: 201 });
  } catch (error) {
    const mapped = mapRepositoryError(error as Error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
