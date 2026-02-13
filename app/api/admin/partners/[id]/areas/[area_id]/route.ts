import { NextResponse } from "next/server";

import { createAdminClient } from "@/utils/supabase/admin";
import { requireAdmin } from "@/lib/security/admin-auth";
import { writeSecurityAuditLog } from "@/lib/security/audit-log";
import { checkAdminApiRateLimit, extractClientIpFromHeaders } from "@/lib/security/rate-limit";

type AreaToggleBody = {
  is_active?: boolean;
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

    const body = (await req.json()) as AreaToggleBody;
    if (body.is_active === undefined) {
      return NextResponse.json({ error: "Missing is_active" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("partner_area_map")
      .update({ is_active: Boolean(body.is_active) })
      .eq("auth_user_id", partnerId)
      .eq("area_id", areaId)
      .select("id, auth_user_id, area_id, is_active, created_at")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Mapping not found" }, { status: 404 });
    }

    await writeSecurityAuditLog({
      actorUserId: adminUser.userId,
      actorRole: adminUser.role,
      eventType: body.is_active ? "activate" : "deactivate",
      entityType: "partner_area_map",
      entityId: String(data.id),
      payload: { auth_user_id: partnerId, area_id: areaId, is_active: data.is_active },
      ip: extractClientIpFromHeaders(req.headers),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({ ok: true, mapping: data });
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

export async function DELETE(
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

    const admin = createAdminClient();
    const { data: existing, error: selectError } = await admin
      .from("partner_area_map")
      .select("id, auth_user_id, area_id, is_active, created_at")
      .eq("auth_user_id", partnerId)
      .eq("area_id", areaId)
      .maybeSingle();

    if (selectError) {
      return NextResponse.json({ error: selectError.message }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: "Mapping not found" }, { status: 404 });
    }

    const { error } = await admin
      .from("partner_area_map")
      .delete()
      .eq("auth_user_id", partnerId)
      .eq("area_id", areaId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await writeSecurityAuditLog({
      actorUserId: adminUser.userId,
      actorRole: adminUser.role,
      eventType: "delete",
      entityType: "partner_area_map",
      entityId: String(existing.id),
      payload: { auth_user_id: partnerId, area_id: areaId },
      ip: extractClientIpFromHeaders(req.headers),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({ ok: true });
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
