import { NextResponse } from "next/server";

import { requireNetworkPartnerActorContext } from "@/lib/network-partners/auth";
import { requireNetworkPartnerRole } from "@/lib/network-partners/roles";
import { getNetworkPartnerById } from "@/lib/network-partners/repositories/network-partners";

function mapRepositoryError(error: Error) {
  if (error.message === "UNAUTHORIZED") return { status: 401, error: "Unauthorized" };
  if (error.message === "FORBIDDEN") return { status: 403, error: "Forbidden" };
  if (error.message === "NOT_FOUND") return { status: 404, error: "Network partner not found" };
  return { status: 500, error: error.message || "Unexpected error" };
}

export async function GET() {
  try {
    const actor = requireNetworkPartnerRole(
      await requireNetworkPartnerActorContext(),
      ["network_owner", "network_editor", "network_billing"],
    );
    const networkPartner = await getNetworkPartnerById(actor.networkPartnerId);
    if (!networkPartner) {
      return NextResponse.json({ error: "Network partner not found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      actor: {
        kind: actor.kind,
        role: actor.role,
        user_id: actor.userId,
        network_partner_id: actor.networkPartnerId,
      },
      network_partner: networkPartner,
    });
  } catch (error) {
    const mapped = mapRepositoryError(error as Error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
