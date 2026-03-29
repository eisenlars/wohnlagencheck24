import { NextResponse } from "next/server";

import { requireNetworkPartnerActorContext } from "@/lib/network-partners/auth";
import { requireNetworkPartnerRole } from "@/lib/network-partners/roles";
import { runNetworkPartnerPreviewSync } from "@/lib/network-partners/sync/preview-sync";
import { getIntegrationByIdForNetworkPartner } from "@/lib/network-partners/repositories/integrations";
import {
  createNetworkPartnerSyncRun,
  finishNetworkPartnerSyncRun,
} from "@/lib/network-partners/sync/sync-run-log";

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
  let runId: string | null = null;
  let integrationId = "";
  let networkPartnerId = "";
  let traceId: string | null = null;

  try {
    const actor = requireNetworkPartnerRole(
      await requireNetworkPartnerActorContext(),
      ["network_owner", "network_editor"],
    );
    networkPartnerId = actor.networkPartnerId;
    const params = await ctx.params;
    integrationId = asText(params.id);
    if (!integrationId) {
      return NextResponse.json({ error: "Missing integration id" }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as PreviewSyncBody;
    const integration = await getIntegrationByIdForNetworkPartner(integrationId, actor.networkPartnerId);
    if (!integration) {
      return NextResponse.json({ error: "Integration not found" }, { status: 404 });
    }

    traceId = crypto.randomUUID();
    const run = await createNetworkPartnerSyncRun({
      integrationId,
      portalPartnerId: integration.portal_partner_id,
      networkPartnerId: actor.networkPartnerId,
      runKind: "preview",
      runMode: body.mode === "full" ? "full" : "guarded",
      traceId,
      summary: {
        resource: body.resource ?? "all",
      },
    });
    runId = run.id;

    const result = await runNetworkPartnerPreviewSync({
      integrationId,
      networkPartnerId: actor.networkPartnerId,
      resource: body.resource,
      mode: body.mode,
      sampleLimit: body.sample_limit,
    });

    await finishNetworkPartnerSyncRun({
      runId: run.id,
      integrationId,
      networkPartnerId: actor.networkPartnerId,
      status: "ok",
      summary: {
        resource: result.resource,
        counts: result.counts,
        booking_scope_count: result.booking_scope_count,
        notes: result.notes,
      },
      diagnostics: result.diagnostics,
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    if (runId && integrationId && networkPartnerId) {
      try {
        await finishNetworkPartnerSyncRun({
          runId,
          integrationId,
          networkPartnerId,
          status: "error",
          summary: {
            error: (error as Error).message || "Unexpected error",
          },
          diagnostics: {
            trace_id: traceId,
          },
        });
      } catch {}
    }

    const mapped = mapPreviewError(error as Error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
