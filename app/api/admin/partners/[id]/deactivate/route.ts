import { NextResponse } from "next/server";

import { createAdminClient } from "@/utils/supabase/admin";
import { requireAdmin } from "@/lib/security/admin-auth";
import { writeSecurityAuditLog } from "@/lib/security/audit-log";
import { checkAdminApiRateLimit, extractClientIpFromHeaders } from "@/lib/security/rate-limit";
import { publishVisibilityIndex } from "@/lib/visibility-index";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
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
    if (!partnerId) {
      return NextResponse.json({ error: "Missing partner id" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { error: mappingError } = await admin
      .from("partner_area_map")
      .update({ is_active: false, is_public_live: false })
      .eq("auth_user_id", partnerId);
    if (mappingError) {
      const message = String(mappingError.message ?? "").toLowerCase();
      const missingPublicLive = message.includes("partner_area_map.is_public_live") && message.includes("does not exist");
      if (!missingPublicLive) {
        return NextResponse.json({ error: mappingError.message }, { status: 500 });
      }
      const fallback = await admin
        .from("partner_area_map")
        .update({ is_active: false })
        .eq("auth_user_id", partnerId);
      if (fallback.error) {
        return NextResponse.json({ error: fallback.error.message }, { status: 500 });
      }
    }

    const { data, error } = await admin
      .from("partners")
      .update({ is_active: false })
      .eq("id", partnerId)
      .select("id, is_active")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Partner not found" }, { status: 404 });
    }

    await writeSecurityAuditLog({
      actorUserId: adminUser.userId,
      actorRole: adminUser.role,
      eventType: "deactivate",
      entityType: "partner",
      entityId: partnerId,
      payload: { is_active: false },
      ip: extractClientIpFromHeaders(req.headers),
      userAgent: req.headers.get("user-agent"),
    });

    try {
      await publishVisibilityIndex(admin as never);
    } catch (publishErr) {
      console.warn("visibility index publish failed after partner deactivate:", publishErr);
    }

    return NextResponse.json({ ok: true, partner: data });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (error.message === "FORBIDDEN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
