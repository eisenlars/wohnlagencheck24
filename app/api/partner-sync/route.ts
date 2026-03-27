import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

import { createAdminClient } from "@/utils/supabase/admin";
import { runCrmIntegrationSync, type CrmSyncResult } from "@/lib/integrations/crm-sync";
import type { PartnerIntegration } from "@/lib/providers/types";

const SYNC_KIND = "crm";
type SyncResult = CrmSyncResult & { error?: string };

function constantTimeTokenEquals(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function extractToken(req: Request): string {
  const authHeader = req.headers.get("authorization") ?? "";
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }
  const cronHeader = req.headers.get("x-cron-token");
  if (cronHeader) return cronHeader.trim();
  return "";
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }

  const token = extractToken(req);
  if (!token || !constantTimeTokenEquals(token, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: integrations, error } = await supabase
    .from("partner_integrations")
    .select("id, partner_id, kind, provider, base_url, auth_type, auth_config, detail_url_template, is_active, settings")
    .eq("kind", SYNC_KIND)
    .eq("is_active", true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: SyncResult[] = [];

  for (const integration of (integrations ?? []) as PartnerIntegration[]) {
    try {
      results.push(await runCrmIntegrationSync(supabase, integration));
    } catch (integrationError) {
      results.push({
        partner_id: integration.partner_id,
        provider: integration.provider,
        resource: "all",
        mode: "full",
        listings_count: 0,
        references_count: 0,
        requests_count: 0,
        offers_count: 0,
        deactivated_listings: 0,
        deactivated_offers: 0,
        skipped: false,
        error: integrationError instanceof Error ? integrationError.message : "unknown integration error",
      });
    }
  }

  const failedCount = results.filter((row) => typeof row.error === "string").length;
  const status = failedCount > 0 ? 207 : 200;
  return NextResponse.json({ ok: failedCount === 0, failed_count: failedCount, results }, { status });
}
