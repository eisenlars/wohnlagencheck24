import { NextResponse } from "next/server";

import { createAdminClient } from "@/utils/supabase/admin";
import { syncIntegrationOffers } from "@/lib/providers";
import type { PartnerIntegration } from "@/lib/providers/types";

const SYNC_KIND = "crm";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (token !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = createAdminClient();

  const { data: integrations, error } = await supabase
    .from("partner_integrations")
    .select("*")
    .eq("kind", SYNC_KIND)
    .eq("is_active", true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: Array<{ partner_id: string; provider: string; count: number }> = [];

  for (const integration of (integrations ?? []) as PartnerIntegration[]) {
    const offers = await syncIntegrationOffers(integration);

    if (offers.length === 0) {
      results.push({ partner_id: integration.partner_id, provider: integration.provider, count: 0 });
      continue;
    }

    const { error: upsertError } = await supabase
      .from("partner_property_offers")
      .upsert(offers, {
        onConflict: "partner_id,source,external_id",
      });

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    results.push({
      partner_id: integration.partner_id,
      provider: integration.provider,
      count: offers.length,
    });
  }

  return NextResponse.json({ ok: true, results });
}
