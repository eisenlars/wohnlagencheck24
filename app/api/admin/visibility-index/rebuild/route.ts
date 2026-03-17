import { NextResponse } from "next/server";

import { createAdminClient } from "@/utils/supabase/admin";
import { requireAdmin } from "@/lib/security/admin-auth";
import { writeSecurityAuditLog } from "@/lib/security/audit-log";
import { checkAdminApiRateLimit, extractClientIpFromHeaders } from "@/lib/security/rate-limit";
import { publishVisibilityIndex } from "@/lib/visibility-index";

export async function POST(req: Request) {
  try {
    const adminUser = await requireAdmin(["admin_super", "admin_ops"]);
    const adminRate = await checkAdminApiRateLimit(req, adminUser.userId);
    if (!adminRate.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(adminRate.retryAfterSec) } },
      );
    }

    const admin = createAdminClient();
    const index = await publishVisibilityIndex(admin as never);

    await writeSecurityAuditLog({
      actorUserId: adminUser.userId,
      actorRole: adminUser.role,
      eventType: "update",
      entityType: "other",
      entityId: "visibility_index",
      payload: {
        action: "rebuild_visibility_index",
        generated_at: index.generated_at,
        bundesland_count: Object.keys(index.bundeslaender ?? {}).length,
        kreis_count: Object.keys(index.kreise ?? {}).length,
      },
      ip: extractClientIpFromHeaders(req.headers),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({
      ok: true,
      index,
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
