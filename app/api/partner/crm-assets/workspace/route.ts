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
    `partner_crm_assets_workspace:${user.id}:${ip}`,
    { windowMs: 60 * 1000, max: 60 },
  );
  if (!limit.allowed) throw new Error(`RATE_LIMIT:${limit.retryAfterSec}`);

  return user.id;
}

export async function GET(req: Request) {
  try {
    const userId = await requirePartnerUser(req);
    const { searchParams } = new URL(req.url);
    const kind = String(searchParams.get("kind") ?? "").trim().toLowerCase();

    const isReference = kind === "references";
    const isRequest = kind === "requests";
    if (!isReference && !isRequest) {
      return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
    }

    const rawTable = isReference ? "partner_references" : "partner_requests";
    const overrideTable = isReference ? "partner_reference_overrides" : "partner_request_overrides";
    const admin = createAdminClient();

    const [rowsRes, overridesRes] = await Promise.all([
      admin
        .from(rawTable)
        .select("id, partner_id, provider, external_id, title, normalized_payload, source_payload, source_updated_at, last_seen_at, updated_at, is_active")
        .eq("partner_id", userId)
        .eq("is_active", true)
        .order("updated_at", { ascending: false }),
      admin
        .from(overrideTable)
        .select("*")
        .eq("partner_id", userId),
    ]);

    if (rowsRes.error) {
      return NextResponse.json({ error: rowsRes.error.message }, { status: 500 });
    }
    if (overridesRes.error) {
      return NextResponse.json({ error: overridesRes.error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      rows: rowsRes.data ?? [],
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
