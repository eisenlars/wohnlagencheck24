import { NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { buildMarketingDefaults } from "@/lib/marketing-defaults";
import { resolveMarketingContextForArea } from "@/lib/areas/marketing-context";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const areaId = String(url.searchParams.get("area_id") ?? "").trim();
  if (!areaId) {
    return NextResponse.json({ error: "Missing area_id" }, { status: 400 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: hasAccess, error: accessError } = await supabase
    .from("partner_area_map")
    .select("id")
    .eq("auth_user_id", user.id)
    .eq("area_id", areaId)
    .maybeSingle();
  if (accessError) {
    return NextResponse.json({ error: accessError.message }, { status: 500 });
  }
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const context = await resolveMarketingContextForArea({ admin, areaId });
  if (!context) {
    return NextResponse.json({ error: "Area not found" }, { status: 404 });
  }

  const marketing = buildMarketingDefaults(context);
  return NextResponse.json({ ok: true, area_id: areaId, marketing });
}
