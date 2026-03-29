import { NextResponse } from "next/server";

import { buildAICreditPeriodKey } from "@/lib/network-partners/ai-governance";
import { requireNetworkPartnerActorContext } from "@/lib/network-partners/auth";
import { getPartnerAICreditLedger } from "@/lib/network-partners/repositories/ai-credits";
import { requirePortalPartnerRole } from "@/lib/network-partners/roles";

function mapAIError(error: Error) {
  if (error.message === "UNAUTHORIZED") return { status: 401, error: "Unauthorized" };
  if (error.message === "FORBIDDEN") return { status: 403, error: "Forbidden" };
  if (error.message === "INVALID_AI_PERIOD_KEY") {
    return { status: 400, error: "Ungueltiger Periodenschluessel. Erwartet wird YYYY-MM." };
  }
  return { status: 500, error: error.message || "Unexpected error" };
}

export async function GET(request: Request) {
  try {
    const actor = requirePortalPartnerRole(
      await requireNetworkPartnerActorContext(),
      ["partner_owner", "partner_manager", "partner_billing"],
    );

    const { searchParams } = new URL(request.url);
    const periodKey = String(searchParams.get("period_key") ?? "").trim() || buildAICreditPeriodKey(new Date());
    const ledger = await getPartnerAICreditLedger(actor.partnerId, periodKey);

    return NextResponse.json({
      ok: true,
      period_key: periodKey,
      ledger,
    });
  } catch (error) {
    const mapped = mapAIError(error as Error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
