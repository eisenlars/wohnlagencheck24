import { NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { checkRateLimitPersistent, extractClientIpFromHeaders } from "@/lib/security/rate-limit";

async function requirePartnerUser(req: Request): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) throw new Error("UNAUTHORIZED");

  const ip = extractClientIpFromHeaders(req.headers);
  const limit = await checkRateLimitPersistent(
    `partner_offers_workspace:${user.id}:${ip}`,
    { windowMs: 60 * 1000, max: 60 },
  );
  if (!limit.allowed) throw new Error(`RATE_LIMIT:${limit.retryAfterSec}`);

  return user.id;
}

export async function GET(req: Request) {
  try {
    const userId = await requirePartnerUser(req);
    const admin = createAdminClient();

    const [offersRes, overridesRes] = await Promise.all([
      admin
        .from("partner_property_offers")
        .select("id, partner_id, source, external_id, offer_type, object_type, title, address, price, rent, area_sqm, rooms, image_url, raw, updated_at")
        .eq("partner_id", userId)
        .order("updated_at", { ascending: false }),
      admin
        .from("partner_property_overrides")
        .select("*")
        .eq("partner_id", userId),
    ]);

    if (offersRes.error) {
      return NextResponse.json({ error: offersRes.error.message }, { status: 500 });
    }
    if (overridesRes.error) {
      return NextResponse.json({ error: overridesRes.error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      offers: offersRes.data ?? [],
      overrides: overridesRes.data ?? [],
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
