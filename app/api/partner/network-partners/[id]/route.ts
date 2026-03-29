import { NextResponse } from "next/server";

import { requireNetworkPartnerActorContext } from "@/lib/network-partners/auth";
import {
  assertPortalPartnerOwnsNetworkPartner,
  requirePortalPartnerRole,
} from "@/lib/network-partners/roles";
import {
  getNetworkPartnerByIdForPortalPartner,
  updateNetworkPartner,
} from "@/lib/network-partners/repositories/network-partners";
import type { NetworkPartnerStatus } from "@/lib/network-partners/types";

type NetworkPartnerPatchBody = {
  company_name?: string;
  legal_name?: string | null;
  contact_email?: string;
  contact_phone?: string | null;
  website_url?: string | null;
  status?: NetworkPartnerStatus;
  managed_editing_enabled?: boolean;
};

function normalizeOptionalText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeRequiredText(value: unknown): string | null {
  const normalized = String(value ?? "").trim();
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
  if (error.message === "NOT_FOUND") return { status: 404, error: "Network partner not found" };
  if (error.message === "NO_UPDATE_FIELDS") return { status: 400, error: "No update fields provided" };
  if (error.message === "INVALID_COMPANY_NAME") return { status: 400, error: "company_name cannot be empty" };
  if (error.message === "INVALID_CONTACT_EMAIL") return { status: 400, error: "contact_email cannot be empty" };
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
    const networkPartnerId = normalizeRequiredText(params.id);
    if (!networkPartnerId) {
      return NextResponse.json({ error: "Missing network partner id" }, { status: 400 });
    }

    const networkPartner = await getNetworkPartnerByIdForPortalPartner(networkPartnerId, actor.partnerId);
    if (!networkPartner) {
      return NextResponse.json({ error: "Network partner not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, network_partner: networkPartner });
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
    const networkPartnerId = normalizeRequiredText(params.id);
    if (!networkPartnerId) {
      return NextResponse.json({ error: "Missing network partner id" }, { status: 400 });
    }

    await assertPortalPartnerOwnsNetworkPartner(actor.partnerId, networkPartnerId);

    const body = (await req.json()) as NetworkPartnerPatchBody;
    const patch: {
      id: string;
      portal_partner_id: string;
      company_name?: string;
      legal_name?: string | null;
      contact_email?: string;
      contact_phone?: string | null;
      website_url?: string | null;
      status?: NetworkPartnerStatus;
      managed_editing_enabled?: boolean;
    } = {
      id: networkPartnerId,
      portal_partner_id: actor.partnerId,
    };

    if (body.company_name !== undefined) {
      const companyName = normalizeRequiredText(body.company_name);
      if (!companyName) {
        return NextResponse.json({ error: "company_name cannot be empty" }, { status: 400 });
      }
      patch.company_name = companyName;
    }
    if (body.legal_name !== undefined) patch.legal_name = normalizeOptionalText(body.legal_name);
    if (body.contact_email !== undefined) {
      const contactEmail = normalizeRequiredText(body.contact_email);
      if (!contactEmail) {
        return NextResponse.json({ error: "contact_email cannot be empty" }, { status: 400 });
      }
      patch.contact_email = contactEmail;
    }
    if (body.contact_phone !== undefined) patch.contact_phone = normalizeOptionalText(body.contact_phone);
    if (body.website_url !== undefined) patch.website_url = normalizeOptionalText(body.website_url);
    if (body.status !== undefined) {
      const status = normalizeStatus(body.status);
      if (!status) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      patch.status = status;
    }
    if (body.managed_editing_enabled !== undefined) {
      patch.managed_editing_enabled = body.managed_editing_enabled === true;
    }

    const networkPartner = await updateNetworkPartner(patch);
    return NextResponse.json({ ok: true, network_partner: networkPartner });
  } catch (error) {
    const mapped = mapRepositoryError(error as Error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
