import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/security/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";
import { checkAdminApiRateLimit, extractClientIpFromHeaders } from "@/lib/security/rate-limit";
import { writeSecurityAuditLog } from "@/lib/security/audit-log";
import { loadGlobalLlmConfig } from "@/lib/llm/global-governance";

type Body = {
  central_enabled?: boolean;
  monthly_token_budget?: number | null;
  monthly_cost_budget_eur?: number | null;
};

function asFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isMissingTable(error: unknown): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return msg.includes("public.llm_global_config") && msg.includes("does not exist");
}

export async function GET(req: Request) {
  try {
    const adminUser = await requireAdmin(["admin_super", "admin_ops"]);
    const limit = await checkAdminApiRateLimit(req, adminUser.userId);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } });
    }
    const { config, source } = await loadGlobalLlmConfig();
    return NextResponse.json({ ok: true, config, source });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const adminUser = await requireAdmin(["admin_super", "admin_ops"]);
    const limit = await checkAdminApiRateLimit(req, adminUser.userId);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } });
    }
    const body = (await req.json()) as Body;
    const patch: Record<string, unknown> = {};
    if (body.central_enabled !== undefined) patch.central_enabled = body.central_enabled === true;
    if (body.monthly_token_budget !== undefined) patch.monthly_token_budget = asFiniteNumber(body.monthly_token_budget);
    if (body.monthly_cost_budget_eur !== undefined) patch.monthly_cost_budget_eur = asFiniteNumber(body.monthly_cost_budget_eur);
    if (Object.keys(patch).length === 0) return NextResponse.json({ error: "No update fields provided" }, { status: 400 });

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("llm_global_config")
      .upsert({ id: true, ...patch }, { onConflict: "id" })
      .select("id, central_enabled, monthly_token_budget, monthly_cost_budget_eur, updated_at")
      .maybeSingle();

    if (error) {
      if (isMissingTable(error)) {
        return NextResponse.json({ error: "Tabelle `llm_global_config` fehlt. Bitte Migration `docs/sql/llm_global_management.sql` ausführen." }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await writeSecurityAuditLog({
      actorUserId: adminUser.userId,
      actorRole: adminUser.role,
      eventType: "update",
      entityType: "other",
      entityId: "llm_global_config",
      payload: patch,
      ip: extractClientIpFromHeaders(req.headers),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({ ok: true, config: data });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
