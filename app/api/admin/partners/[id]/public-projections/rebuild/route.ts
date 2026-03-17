import { NextResponse } from "next/server";

import { createAdminClient } from "@/utils/supabase/admin";
import { rebuildAllPublicAssetEntriesForPartner } from "@/lib/public-asset-projections";
import { requireAdmin } from "@/lib/security/admin-auth";
import { writeSecurityAuditLog } from "@/lib/security/audit-log";
import { checkAdminApiRateLimit, extractClientIpFromHeaders } from "@/lib/security/rate-limit";

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
    const { data: partner, error: partnerError } = await admin
      .from("partners")
      .select("id, company_name")
      .eq("id", partnerId)
      .maybeSingle();

    if (partnerError) {
      return NextResponse.json({ error: partnerError.message }, { status: 500 });
    }
    if (!partner) {
      return NextResponse.json({ error: "Partner not found" }, { status: 404 });
    }

    const projections = await rebuildAllPublicAssetEntriesForPartner(partnerId, admin);

    await writeSecurityAuditLog({
      actorUserId: adminUser.userId,
      actorRole: adminUser.role,
      eventType: "update",
      entityType: "partner",
      entityId: partnerId,
      payload: {
        action: "rebuild_public_projections",
        partner_id: partnerId,
        company_name: String((partner as { company_name?: string | null }).company_name ?? ""),
        projections,
      },
      ip: extractClientIpFromHeaders(req.headers),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({
      ok: true,
      partner,
      projections,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (error.message === "FORBIDDEN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
