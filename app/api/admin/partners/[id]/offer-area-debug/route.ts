import { NextResponse } from "next/server";

import { createAdminClient } from "@/utils/supabase/admin";
import { requireAdmin } from "@/lib/security/admin-auth";
import { checkAdminApiRateLimit } from "@/lib/security/rate-limit";

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const adminUser = await requireAdmin(["admin_super", "admin_ops", "admin_billing"]);
    const adminRate = await checkAdminApiRateLimit(req, adminUser.userId);
    if (!adminRate.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(adminRate.retryAfterSec) } },
      );
    }

    const params = await ctx.params;
    const partnerId = asText(params.id);
    if (!partnerId) {
      return NextResponse.json({ error: "Missing partner id" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("partner_offer_area_targets")
      .select(`
        offer_id,
        area_id,
        is_primary,
        match_source,
        match_confidence,
        score,
        matched_zip_code,
        matched_city,
        matched_region,
        updated_at,
        areas(name),
        partner_property_offers(title, address, external_id, source)
      `)
      .eq("partner_id", partnerId)
      .order("updated_at", { ascending: false })
      .limit(8);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = Array.isArray(data)
      ? data.map((row) => {
          const record = row as Record<string, unknown>;
          const area = (record.areas ?? null) as Record<string, unknown> | null;
          const offer = (record.partner_property_offers ?? null) as Record<string, unknown> | null;
          const scoreValue = typeof record.score === "number" ? record.score : Number(record.score ?? NaN);
          return {
            offer_id: asText(record.offer_id),
            area_id: asText(record.area_id),
            area_name: area ? asText(area.name) : "",
            is_primary: record.is_primary === true,
            match_source: asText(record.match_source),
            match_confidence: asText(record.match_confidence),
            score: Number.isFinite(scoreValue) ? scoreValue : null,
            matched_zip_code: asText(record.matched_zip_code),
            matched_city: asText(record.matched_city),
            matched_region: asText(record.matched_region),
            updated_at: asText(record.updated_at),
            title: offer ? asText(offer.title) : "",
            address: offer ? asText(offer.address) : "",
            external_id: offer ? asText(offer.external_id) : "",
            source: offer ? asText(offer.source) : "",
          };
        })
      : [];

    return NextResponse.json({ ok: true, rows });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
