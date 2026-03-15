import { NextResponse } from "next/server";

import { createAdminClient } from "@/utils/supabase/admin";
import { requireAdmin } from "@/lib/security/admin-auth";
import { writeSecurityAuditLog } from "@/lib/security/audit-log";
import { checkAdminApiRateLimit, extractClientIpFromHeaders } from "@/lib/security/rate-limit";
import { getPartnerPurgeCheck, purgePartnerData } from "@/lib/admin/partner-purge";

type PurgeBody = {
  confirm_text?: string;
};

export async function DELETE(
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

    const body = (await req.json().catch(() => ({}))) as PurgeBody;
    const confirmText = String(body.confirm_text ?? "").trim().toUpperCase();
    if (confirmText !== "LOESCHEN") {
      return NextResponse.json({ error: "Confirm text mismatch" }, { status: 400 });
    }

    const admin = createAdminClient();
    const check = await getPartnerPurgeCheck(admin, partnerId);
    if (!check.canPurge) {
      return NextResponse.json(
        { error: "Purge blocked", blockers: check.blockers, summary: check.summary },
        { status: 409 },
      );
    }

    const purgeRes = await purgePartnerData(admin, partnerId);

    await writeSecurityAuditLog({
      actorUserId: adminUser.userId,
      actorRole: adminUser.role,
      eventType: "delete",
      entityType: "partner",
      entityId: partnerId,
      payload: {
        action: "partner_purged",
        summary: check.summary,
        dump_bucket: purgeRes.dumpBucket,
        dump_path: purgeRes.dumpPath,
        deleted_counts: purgeRes.deletedCounts,
        auth_user_deleted: purgeRes.authUserDeleted,
        auth_delete_error: purgeRes.authDeleteError,
      },
      ip: extractClientIpFromHeaders(req.headers),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({
      ok: true,
      dump_bucket: purgeRes.dumpBucket,
      dump_path: purgeRes.dumpPath,
      deleted_counts: purgeRes.deletedCounts,
      auth_user_deleted: purgeRes.authUserDeleted,
      warning: purgeRes.authDeleteError
        ? `Partnerdaten wurden entfernt, der Auth-User konnte aber nicht gelöscht werden: ${purgeRes.authDeleteError}`
        : null,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      if (error.message === "PARTNER_NOT_FOUND") return NextResponse.json({ error: "Partner not found" }, { status: 404 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
