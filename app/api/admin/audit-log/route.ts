import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/security/admin-auth";
import { checkAdminApiRateLimit } from "@/lib/security/rate-limit";
import { createAdminClient } from "@/utils/supabase/admin";

export async function GET(req: Request) {
  try {
    const adminUser = await requireAdmin(["admin_super", "admin_ops"]);
    const adminRate = await checkAdminApiRateLimit(req, adminUser.userId);
    if (!adminRate.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(adminRate.retryAfterSec) } },
      );
    }

    const url = new URL(req.url);
    const entityType = String(url.searchParams.get("entity_type") ?? "").trim();
    const eventType = String(url.searchParams.get("event_type") ?? "").trim();
    const actorUserId = String(url.searchParams.get("actor_user_id") ?? "").trim();
    const createdFrom = String(url.searchParams.get("created_from") ?? "").trim();
    const createdTo = String(url.searchParams.get("created_to") ?? "").trim();

    const limitRaw = Number(url.searchParams.get("limit") ?? 100);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), 500) : 100;

    const admin = createAdminClient();
    let query = admin
      .from("security_audit_log")
      .select("id, actor_user_id, actor_role, event_type, entity_type, entity_id, payload, ip, user_agent, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (entityType) query = query.eq("entity_type", entityType);
    if (eventType) query = query.eq("event_type", eventType);
    if (actorUserId) query = query.eq("actor_user_id", actorUserId);
    if (createdFrom) query = query.gte("created_at", createdFrom);
    if (createdTo) query = query.lte("created_at", createdTo);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      ok: true,
      logs: data ?? [],
      count: Array.isArray(data) ? data.length : 0,
    });
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

