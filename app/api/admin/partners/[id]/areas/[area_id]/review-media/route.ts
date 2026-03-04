import { NextResponse } from "next/server";

import { createAdminClient } from "@/utils/supabase/admin";
import { requireAdmin } from "@/lib/security/admin-auth";
import { checkAdminApiRateLimit } from "@/lib/security/rate-limit";
import { isMandatoryMediaKey } from "@/lib/mandatory-media";

type Body = {
  section_key?: string;
  status?: "approved" | "draft";
};

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string; area_id: string }> },
) {
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
    const partnerId = String(params.id ?? "").trim();
    const areaId = String(params.area_id ?? "").trim();
    if (!partnerId || !areaId) {
      return NextResponse.json({ error: "Missing partner id or area id" }, { status: 400 });
    }

    const body = (await req.json()) as Body;
    const sectionKey = String(body.section_key ?? "").trim();
    const nextStatus = body.status === "approved" ? "approved" : body.status === "draft" ? "draft" : null;
    if (!isMandatoryMediaKey(sectionKey) || !nextStatus) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: existing, error: existingError } = await admin
      .from("report_texts")
      .select("partner_id, area_id, section_key, optimized_content")
      .eq("partner_id", partnerId)
      .eq("area_id", areaId)
      .eq("section_key", sectionKey)
      .maybeSingle();
    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: "Media entry not found" }, { status: 404 });
    }

    const { error: updateError } = await admin
      .from("report_texts")
      .upsert(
        {
          partner_id: partnerId,
          area_id: areaId,
          section_key: sectionKey,
          text_type: "individual",
          raw_content: "",
          optimized_content: String(existing.optimized_content ?? ""),
          status: nextStatus,
          last_updated: new Date().toISOString(),
        },
        { onConflict: "partner_id,area_id,section_key" },
      );
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, section_key: sectionKey, status: nextStatus });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
