import { NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { checkRateLimitPersistent, extractClientIpFromHeaders } from "@/lib/security/rate-limit";
import { syncIntegrationResources } from "@/lib/providers";
import type { PartnerIntegration } from "@/lib/providers/types";

async function requirePartnerUser(req: Request): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) throw new Error("UNAUTHORIZED");

  const ip = extractClientIpFromHeaders(req.headers);
  const limit = await checkRateLimitPersistent(
    `partner_integration_preview_sync:${user.id}:${ip}`,
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
      .eq("partner_id", userId)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Integration not found" }, { status: 404 });

    const integration = data as PartnerIntegration;
    if (String(integration.kind ?? "").toLowerCase() !== "crm") {
      return NextResponse.json({ error: "Nur CRM-Anbindungen können geprüft werden." }, { status: 400 });
    }
    if (!integration.is_active) {
      return NextResponse.json(
        {
          ok: true,
          preview: {
            skipped: true,
            reason: "integration inactive",
          },
        },
        { status: 200 },
      );
    }

    const result = await syncIntegrationResources(integration);

    return NextResponse.json({
      ok: true,
      preview: {
        skipped: false,
        provider: integration.provider,
        offers_count: result.offers.length,
        listings_count: result.listings.length,
        references_count: result.references.length,
        requests_count: result.requests.length,
        references_fetched: result.referencesFetched,
        requests_fetched: result.requestsFetched,
        notes: result.notes ?? [],
        offers_preview: result.offers.slice(0, 5).map((offer) => ({
          external_id: offer.external_id,
          title: offer.title,
          offer_type: offer.offer_type,
          object_type: offer.object_type,
          address: offer.address,
        })),
        listings_preview: result.listings.slice(0, 5).map((listing) => ({
          external_id: listing.external_id,
          title: listing.title,
          source_updated_at: listing.source_updated_at,
          status: listing.status,
        })),
      },
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
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
