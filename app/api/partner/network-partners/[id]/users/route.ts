import { NextResponse } from "next/server";

import { requireNetworkPartnerActorContext } from "@/lib/network-partners/auth";
import { requirePortalPartnerRole } from "@/lib/network-partners/roles";
import { listNetworkPartnerUsersByPortalPartner } from "@/lib/network-partners/repositories/network-partners";

function asText(value: unknown): string {
  return String(value ?? "").trim();
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
