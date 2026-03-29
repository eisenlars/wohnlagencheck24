import { NextResponse } from "next/server";

import { requireNetworkPartnerActorContext } from "@/lib/network-partners/auth";
import { runBillingForPortalPartner } from "@/lib/network-partners/repositories/billing";
import { requirePortalPartnerRole } from "@/lib/network-partners/roles";

type BillingRunBody = {
  period_key?: string;
};

function mapBillingError(error: Error) {
  if (error.message === "UNAUTHORIZED") return { status: 401, error: "Unauthorized" };
  if (error.message === "FORBIDDEN") return { status: 403, error: "Forbidden" };
  if (error.message === "INVALID_BILLING_PERIOD_KEY") {
    return { status: 400, error: "Ungueltiger Periodenschluessel. Erwartet wird YYYY-MM." };
  }
  return { status: 500, error: error.message || "Unexpected error" };
}

export async function POST(request: Request) {
  try {
    const actor = requirePortalPartnerRole(
      await requireNetworkPartnerActorContext(),
      ["partner_owner", "partner_manager"],
    );

    const body = (await request.json().catch(() => null)) as BillingRunBody | null;
    const periodKey = String(body?.period_key ?? "").trim();
    if (!periodKey) {
      return NextResponse.json(
        { error: "Periode fehlt. Erwartet wird YYYY-MM." },
        { status: 400 },
      );
    }

    const result = await runBillingForPortalPartner(actor.partnerId, periodKey);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const mapped = mapBillingError(error as Error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
