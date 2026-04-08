import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/security/admin-auth";
import { checkAdminApiRateLimit } from "@/lib/security/rate-limit";
import {
  getNetworkPartnerByIdForPortalPartner,
  updateNetworkPartner,
} from "@/lib/network-partners/repositories/network-partners";

type NetworkPartnerPatchBody = {
  llm_partner_managed_allowed?: boolean;
};

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string; network_partner_id: string }> },
) {
  try {
    const adminUser = await requireAdmin(["admin_super", "admin_ops"]);
    const adminRate = await checkAdminApiRateLimit(req, adminUser.userId);
    if (!adminRate.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(adminRate.retryAfterSec) } },
      );
    }

    const params = await ctx.params;
    const partnerId = String(params.id ?? "").trim();
    const networkPartnerId = String(params.network_partner_id ?? "").trim();
    if (!partnerId || !networkPartnerId) {
      return NextResponse.json({ error: "Missing partner id or network partner id" }, { status: 400 });
    }

    const existing = await getNetworkPartnerByIdForPortalPartner(networkPartnerId, partnerId);
    if (!existing) {
      return NextResponse.json({ error: "Network partner not found" }, { status: 404 });
    }

    const body = (await req.json()) as NetworkPartnerPatchBody;
    if (body.llm_partner_managed_allowed === undefined) {
      return NextResponse.json({ error: "No update fields provided" }, { status: 400 });
    }

    const networkPartner = await updateNetworkPartner({
      id: networkPartnerId,
      portal_partner_id: partnerId,
      llm_partner_managed_allowed: body.llm_partner_managed_allowed === true,
    });

    return NextResponse.json({ ok: true, network_partner: networkPartner });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      if (error.message === "NOT_FOUND") return NextResponse.json({ error: "Network partner not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
