import { NextResponse } from "next/server";

import { requireNetworkPartnerActorContext } from "@/lib/network-partners/auth";
import { requireNetworkPartnerRole } from "@/lib/network-partners/roles";
import { loadNetworkBillingOverviewByNetworkPartner } from "@/lib/network-partners/repositories/billing";

function mapRepositoryError(error: Error) {
  if (error.message === "UNAUTHORIZED") return { status: 401, error: "Unauthorized" };
  if (error.message === "FORBIDDEN") return { status: 403, error: "Forbidden" };
  return { status: 500, error: error.message || "Unexpected error" };
}

export async function GET() {
  try {
    const actor = requireNetworkPartnerRole(
      await requireNetworkPartnerActorContext(),
      ["network_owner", "network_editor", "network_billing"],
    );

    const overview = await loadNetworkBillingOverviewByNetworkPartner(actor.networkPartnerId);
    return NextResponse.json({ ok: true, ...overview });
  } catch (error) {
    const mapped = mapRepositoryError(error as Error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
