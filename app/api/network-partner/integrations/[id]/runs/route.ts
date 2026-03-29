import { NextResponse } from "next/server";

import { requireNetworkPartnerActorContext } from "@/lib/network-partners/auth";
import { requireNetworkPartnerRole } from "@/lib/network-partners/roles";
import { listNetworkPartnerSyncRuns } from "@/lib/network-partners/sync/sync-run-log";

function asText(value: unknown): string {
  return String(value ?? "").trim();
}

function asPositiveInt(value: string | null): number | undefined {
  const parsed = Number(value ?? "");
  if (!Number.isFinite(parsed)) return undefined;
  const normalized = Math.floor(parsed);
  return normalized > 0 ? normalized : undefined;
}

function mapRunError(error: Error) {
  if (error.message === "UNAUTHORIZED") return { status: 401, error: "Unauthorized" };
  if (error.message === "FORBIDDEN") return { status: 403, error: "Forbidden" };
  return { status: 500, error: error.message || "Unexpected error" };
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const actor = requireNetworkPartnerRole(
      await requireNetworkPartnerActorContext(),
      ["network_owner", "network_editor", "network_billing"],
    );
    const params = await ctx.params;
    const integrationId = asText(params.id);
    if (!integrationId) {
      return NextResponse.json({ error: "Missing integration id" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const runs = await listNetworkPartnerSyncRuns({
      integrationId,
      networkPartnerId: actor.networkPartnerId,
      limit: asPositiveInt(searchParams.get("limit")),
    });

    return NextResponse.json({ ok: true, runs });
  } catch (error) {
    const mapped = mapRunError(error as Error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
