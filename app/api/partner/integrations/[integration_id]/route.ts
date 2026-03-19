import { NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { checkRateLimitPersistent, extractClientIpFromHeaders } from "@/lib/security/rate-limit";
import { writeSecurityAuditLog } from "@/lib/security/audit-log";
import { purgeCrmIntegrationData } from "@/lib/integrations/crm-integration-purge";

async function requirePartnerUser(req: Request): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) throw new Error("UNAUTHORIZED");

  const ip = extractClientIpFromHeaders(req.headers);
  const limit = await checkRateLimitPersistent(
    `partner_integration_delete:${user.id}:${ip}`,
    { windowMs: 60 * 1000, max: 20 },
  );
  if (!limit.allowed) throw new Error(`RATE_LIMIT:${limit.retryAfterSec}`);
  return user.id;
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ integration_id: string }> },
) {
  try {
    const userId = await requirePartnerUser(req);
    const params = await ctx.params;
    const integrationId = String(params.integration_id ?? "").trim();
    if (!integrationId) {
      return NextResponse.json({ error: "Missing integration id" }, { status: 400 });
    }

    const url = new URL(req.url);
    const purgeImportedData = url.searchParams.get("purge_imported_data") === "1";

    const admin = createAdminClient();
    const { data: integration, error: loadError } = await admin
      .from("partner_integrations")
      .select("id, partner_id, kind, provider, is_active")
      .eq("id", integrationId)
      .eq("partner_id", userId)
      .maybeSingle();

    if (loadError) {
      return NextResponse.json({ error: loadError.message }, { status: 500 });
    }
    if (!integration) {
      return NextResponse.json({ error: "Integration not found" }, { status: 404 });
    }

    const kind = String(integration.kind ?? "").trim().toLowerCase();
    const provider = String(integration.provider ?? "").trim().toLowerCase();
    let purgeResult: Awaited<ReturnType<typeof purgeCrmIntegrationData>> | null = null;

    if (kind === "crm" && purgeImportedData) {
      purgeResult = await purgeCrmIntegrationData({
        admin,
        partnerId: userId,
        provider,
      });
    }

    const { error: deleteError } = await admin
      .from("partner_integrations")
      .delete()
      .eq("id", integrationId)
      .eq("partner_id", userId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    await writeSecurityAuditLog({
      actorUserId: userId,
      actorRole: "system",
      eventType: "delete",
      entityType: "partner_integration",
      entityId: integrationId,
      payload: {
        action: "partner_delete_integration",
        integration_id: integrationId,
        kind,
        provider,
        was_active: Boolean(integration.is_active),
        purge_imported_data: purgeImportedData,
        purge_result: purgeResult,
      },
      ip: extractClientIpFromHeaders(req.headers),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({
      ok: true,
      integration_id: integrationId,
      kind,
      provider,
      purge_imported_data: purgeImportedData,
      purge_result: purgeResult,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (error.message.startsWith("RATE_LIMIT:")) {
        const sec = Number(error.message.split(":")[1] ?? "60");
        return NextResponse.json(
          { error: "Too many requests" },
          { status: 429, headers: { "Retry-After": String(sec) } },
        );
      }
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
