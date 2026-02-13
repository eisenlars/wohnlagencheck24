import { NextResponse } from "next/server";

import { createAdminClient } from "@/utils/supabase/admin";
import { requireAdmin } from "@/lib/security/admin-auth";
import { writeSecurityAuditLog } from "@/lib/security/audit-log";
import { checkAdminApiRateLimit, extractClientIpFromHeaders } from "@/lib/security/rate-limit";

type AssignAreaBody = {
  area_id?: string;
  is_active?: boolean;
};

function isKreisAreaId(areaId: string): boolean {
  const parts = String(areaId ?? "")
    .trim()
    .split("-")
    .filter((p) => p.length > 0);
  return parts.length === 3;
}

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

    const body = (await req.json()) as AssignAreaBody;
    const areaId = String(body.area_id ?? "").trim();
    if (!areaId) {
      return NextResponse.json({ error: "Missing area_id" }, { status: 400 });
    }
    if (!isKreisAreaId(areaId)) {
      return NextResponse.json({ error: "Only kreis area_id is allowed" }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: partnerExists, error: partnerError } = await admin
      .from("partners")
      .select("id")
      .eq("id", partnerId)
      .maybeSingle();
    if (partnerError) {
      return NextResponse.json({ error: partnerError.message }, { status: 500 });
    }
    if (!partnerExists) {
      return NextResponse.json({ error: "Partner not found" }, { status: 404 });
    }

    const { data: areaExists, error: areaError } = await admin
      .from("areas")
      .select("id")
      .eq("id", areaId)
      .maybeSingle();
    if (areaError) {
      return NextResponse.json({ error: areaError.message }, { status: 500 });
    }
    if (!areaExists) {
      return NextResponse.json({ error: "Area not found" }, { status: 404 });
    }

    const { data: activeAssignedRows, error: activeAssignedError } = await admin
      .from("partner_area_map")
      .select("auth_user_id")
      .eq("area_id", areaId)
      .eq("is_active", true)
      .neq("auth_user_id", partnerId)
      .limit(1);
    if (activeAssignedError) {
      return NextResponse.json({ error: activeAssignedError.message }, { status: 500 });
    }
    if (Array.isArray(activeAssignedRows) && activeAssignedRows.length > 0) {
      return NextResponse.json(
        { error: "Area already assigned to another partner" },
        { status: 409 },
      );
    }

    const { data, error } = await admin
      .from("partner_area_map")
      .upsert(
        {
          auth_user_id: partnerId,
          area_id: areaId,
          is_active: body.is_active === false ? false : true,
        },
        { onConflict: "auth_user_id,area_id" },
      )
      .select("id, auth_user_id, area_id, is_active, created_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await writeSecurityAuditLog({
      actorUserId: adminUser.userId,
      actorRole: adminUser.role,
      eventType: "create",
      entityType: "partner_area_map",
      entityId: String(data.id),
      payload: { auth_user_id: partnerId, area_id: areaId, is_active: data.is_active },
      ip: extractClientIpFromHeaders(req.headers),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({ ok: true, mapping: data }, { status: 201 });
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
