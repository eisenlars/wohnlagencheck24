import { NextResponse } from "next/server";

import { requireNetworkPartnerActorContext } from "@/lib/network-partners/auth";
import {
  assertPortalPartnerOwnsNetworkPartner,
  requirePortalPartnerRole,
} from "@/lib/network-partners/roles";
import { loadNetworkBillingOverviewByPortalPartner } from "@/lib/network-partners/repositories/billing";

function mapBillingError(error: Error) {
  if (error.message === "UNAUTHORIZED") return { status: 401, error: "Unauthorized" };
  if (error.message === "FORBIDDEN") return { status: 403, error: "Forbidden" };
  return { status: 500, error: error.message || "Unexpected error" };
}

export async function GET(request: Request) {
  try {
    const actor = requirePortalPartnerRole(
      await requireNetworkPartnerActorContext(),
      ["partner_owner", "partner_manager", "partner_billing"],
    );
    const { searchParams } = new URL(request.url);
    const networkPartnerId = String(searchParams.get("network_partner_id") ?? "").trim() || null;
    if (networkPartnerId) {
      await assertPortalPartnerOwnsNetworkPartner(actor.partnerId, networkPartnerId);
    }
    const overview = await loadNetworkBillingOverviewByPortalPartner(actor.partnerId, networkPartnerId ?? undefined);
    return NextResponse.json({ ok: true, ...overview });
  } catch (error) {
    const mapped = mapBillingError(error as Error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
