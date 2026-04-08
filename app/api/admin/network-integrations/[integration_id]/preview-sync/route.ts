import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/security/admin-auth";
import { checkAdminApiRateLimit } from "@/lib/security/rate-limit";
import { getIntegrationById } from "@/lib/network-partners/repositories/integrations";
import { runNetworkPartnerPreviewSync } from "@/lib/network-partners/sync/preview-sync";
import {
  createNetworkPartnerSyncRun,
  finishNetworkPartnerSyncRun,
} from "@/lib/network-partners/sync/sync-run-log";

type PreviewSyncBody = {
  resource?: "offers" | "requests" | "all";
  mode?: "guarded" | "full";
  sample_limit?: number;
};

export async function POST(
  req: Request,
  ctx: { params: Promise<{ integration_id: string }> },
) {
  let runId: string | null = null;
  let integrationId = "";
  let networkPartnerId = "";
  let traceId: string | null = null;

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
    integrationId = String(params.integration_id ?? "").trim();
    if (!integrationId) {
      return NextResponse.json({ error: "Missing integration id" }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as PreviewSyncBody;
    const integration = await getIntegrationById(integrationId);
    if (!integration) {
      return NextResponse.json({ error: "Integration not found" }, { status: 404 });
    }

    networkPartnerId = integration.network_partner_id;
    traceId = crypto.randomUUID();
    const run = await createNetworkPartnerSyncRun({
      integrationId,
      portalPartnerId: integration.portal_partner_id,
      networkPartnerId,
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
      networkPartnerId,
      resource: body.resource,
      mode: body.mode,
      sampleLimit: body.sample_limit,
    });

    await finishNetworkPartnerSyncRun({
      runId: run.id,
      integrationId,
      networkPartnerId,
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

    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      if (error.message === "NOT_FOUND") return NextResponse.json({ error: "Integration not found" }, { status: 404 });
      if (error.message === "INTEGRATION_INACTIVE") return NextResponse.json({ error: "Integration is inactive" }, { status: 400 });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
