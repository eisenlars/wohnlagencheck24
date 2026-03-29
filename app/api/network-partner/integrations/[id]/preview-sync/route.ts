import { NextResponse } from "next/server";

import { requireNetworkPartnerActorContext } from "@/lib/network-partners/auth";
import { requireNetworkPartnerRole } from "@/lib/network-partners/roles";
import { runNetworkPartnerPreviewSync } from "@/lib/network-partners/sync/preview-sync";

type PreviewSyncBody = {
  resource?: "offers" | "requests" | "all";
  mode?: "guarded" | "full";
  sample_limit?: number;
};

function asText(value: unknown): string {
  return String(value ?? "").trim();
}

function mapPreviewError(error: Error) {
  if (error.message === "UNAUTHORIZED") return { status: 401, error: "Unauthorized" };
  if (error.message === "FORBIDDEN") return { status: 403, error: "Forbidden" };
  if (error.message === "NOT_FOUND") return { status: 404, error: "Integration not found" };
  if (error.message === "INTEGRATION_INACTIVE") return { status: 400, error: "Integration is inactive" };
  return { status: 500, error: error.message || "Unexpected error" };
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const actor = requireNetworkPartnerRole(
      await requireNetworkPartnerActorContext(),
      ["network_owner", "network_editor"],
    );
    const params = await ctx.params;
    const integrationId = asText(params.id);
    if (!integrationId) {
      return NextResponse.json({ error: "Missing integration id" }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as PreviewSyncBody;
    const result = await runNetworkPartnerPreviewSync({
      integrationId,
      networkPartnerId: actor.networkPartnerId,
      resource: body.resource,
      mode: body.mode,
      sampleLimit: body.sample_limit,
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const mapped = mapPreviewError(error as Error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
