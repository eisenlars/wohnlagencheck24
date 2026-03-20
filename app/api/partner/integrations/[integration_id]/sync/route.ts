import { NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { checkRateLimitPersistent, extractClientIpFromHeaders } from "@/lib/security/rate-limit";
import { writeSecurityAuditLog } from "@/lib/security/audit-log";
import { runCrmIntegrationSync } from "@/lib/integrations/crm-sync";
import type { PartnerIntegration } from "@/lib/providers/types";

async function requirePartnerUser(req: Request): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) throw new Error("UNAUTHORIZED");

  const ip = extractClientIpFromHeaders(req.headers);
  const limit = await checkRateLimitPersistent(
    `partner_integration_sync:${user.id}:${ip}`,
    { windowMs: 60 * 1000, max: 10 },
  );
  if (!limit.allowed) throw new Error(`RATE_LIMIT:${limit.retryAfterSec}`);
  return user.id;
}

export async function POST(
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

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("partner_integrations")
      .select("id, partner_id, kind, provider, base_url, auth_type, auth_config, detail_url_template, is_active, settings")
      .eq("id", integrationId)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Integration not found" }, { status: 404 });

    const integration = data as PartnerIntegration;
    if (String(integration.partner_id) !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (String(integration.kind ?? "").toLowerCase() !== "crm") {
      return NextResponse.json({ error: "Nur CRM-Anbindungen können synchronisiert werden." }, { status: 400 });
    }

    const result = await runCrmIntegrationSync(admin, integration);

    await writeSecurityAuditLog({
      actorUserId: userId,
      actorRole: "system",
      eventType: "other",
      entityType: "partner_integration",
      entityId: integration.id,
      payload: {
        action: "partner_sync_integration",
        integration_id: integration.id,
        provider: integration.provider,
        result,
      },
      ip: extractClientIpFromHeaders(req.headers),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({ ok: true, result });
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
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
