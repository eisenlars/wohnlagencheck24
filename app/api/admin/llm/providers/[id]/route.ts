import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/security/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";
import { checkAdminApiRateLimit, extractClientIpFromHeaders } from "@/lib/security/rate-limit";
import { writeSecurityAuditLog } from "@/lib/security/audit-log";
import { maskIntegrationForResponse } from "@/lib/security/integration-mask";

type Body = {
  provider?: string;
  model?: string;
  base_url?: string;
  auth_type?: string;
  priority?: number;
  is_active?: boolean;
  temperature?: number | null;
  max_tokens?: number | null;
  price_source_url_override?: string | null;
  input_cost_eur_per_1k?: number | null;
  output_cost_eur_per_1k?: number | null;
};

function norm(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const v = String(value).trim();
  return v.length > 0 ? v : null;
}

function asFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isPositiveNumber(value: unknown): boolean {
  const parsed = asFiniteNumber(value);
  return parsed !== null && parsed > 0;
}

function isMissingTable(error: unknown): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return msg.includes("public.llm_global_providers") && msg.includes("does not exist");
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const adminUser = await requireAdmin(["admin_super", "admin_ops"]);
    const limit = await checkAdminApiRateLimit(req, adminUser.userId);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } });
    }
    const params = await ctx.params;
    const id = String(params.id ?? "").trim();
    if (!id) return NextResponse.json({ error: "Missing provider id" }, { status: 400 });
    const body = (await req.json()) as Body;
    const admin = createAdminClient();
    const { data: existing, error: existingError } = await admin
      .from("llm_global_providers")
      .select("id, is_active, input_cost_eur_per_1k, output_cost_eur_per_1k")
      .eq("id", id)
      .maybeSingle();
    if (existingError) {
      if (isMissingTable(existingError)) {
        return NextResponse.json({ error: "Tabelle `llm_global_providers` fehlt. Bitte Migration `docs/sql/llm_global_management.sql` ausführen." }, { status: 409 });
      }
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }
    if (!existing) return NextResponse.json({ error: "Provider not found" }, { status: 404 });

    const patch: Record<string, unknown> = {};
    if (body.provider !== undefined) patch.provider = norm(body.provider)?.toLowerCase();
    if (body.model !== undefined) patch.model = norm(body.model);
    if (body.base_url !== undefined) patch.base_url = norm(body.base_url);
    if (body.auth_type !== undefined) patch.auth_type = norm(body.auth_type)?.toLowerCase();
    if (body.priority !== undefined) patch.priority = Math.max(1, Math.floor(asFiniteNumber(body.priority) ?? 100));
    if (body.is_active !== undefined) patch.is_active = body.is_active === true;
    if (body.temperature !== undefined) patch.temperature = asFiniteNumber(body.temperature);
    if (body.max_tokens !== undefined) patch.max_tokens = asFiniteNumber(body.max_tokens);
    if (body.price_source_url_override !== undefined) patch.price_source_url_override = norm(body.price_source_url_override);
    if (body.input_cost_eur_per_1k !== undefined) patch.input_cost_eur_per_1k = asFiniteNumber(body.input_cost_eur_per_1k);
    if (body.output_cost_eur_per_1k !== undefined) patch.output_cost_eur_per_1k = asFiniteNumber(body.output_cost_eur_per_1k);
    if (body.input_cost_eur_per_1k !== undefined && !isPositiveNumber(body.input_cost_eur_per_1k)) {
      return NextResponse.json({ error: "input_cost_eur_per_1k muss > 0 sein." }, { status: 400 });
    }
    if (body.output_cost_eur_per_1k !== undefined && !isPositiveNumber(body.output_cost_eur_per_1k)) {
      return NextResponse.json({ error: "output_cost_eur_per_1k muss > 0 sein." }, { status: 400 });
    }
    const nextIsActive = body.is_active !== undefined ? body.is_active === true : Boolean(existing.is_active);
    const nextInputCost = body.input_cost_eur_per_1k !== undefined ? asFiniteNumber(body.input_cost_eur_per_1k) : asFiniteNumber(existing.input_cost_eur_per_1k);
    const nextOutputCost = body.output_cost_eur_per_1k !== undefined ? asFiniteNumber(body.output_cost_eur_per_1k) : asFiniteNumber(existing.output_cost_eur_per_1k);
    if (nextIsActive && (!(nextInputCost && nextInputCost > 0) || !(nextOutputCost && nextOutputCost > 0))) {
      return NextResponse.json({ error: "Aktive Provider benötigen gültige Input-/Output-Kosten (> 0)." }, { status: 400 });
    }
    if (Object.keys(patch).length === 0) return NextResponse.json({ error: "No update fields provided" }, { status: 400 });

    const { data, error } = await admin
      .from("llm_global_providers")
      .update(patch)
      .eq("id", id)
      .select("id, provider, model, base_url, auth_type, auth_config, priority, is_active, temperature, max_tokens, price_source_url_override, input_cost_eur_per_1k, output_cost_eur_per_1k, price_source, price_source_url, price_updated_at, created_at, updated_at")
      .maybeSingle();
    if (error) {
      if (isMissingTable(error)) {
        return NextResponse.json({ error: "Tabelle `llm_global_providers` fehlt. Bitte Migration `docs/sql/llm_global_management.sql` ausführen." }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) return NextResponse.json({ error: "Provider not found" }, { status: 404 });

    await writeSecurityAuditLog({
      actorUserId: adminUser.userId,
      actorRole: adminUser.role,
      eventType: "update",
      entityType: "other",
      entityId: id,
      payload: patch,
      ip: extractClientIpFromHeaders(req.headers),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({ ok: true, provider: maskIntegrationForResponse(data as Record<string, unknown>) });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const adminUser = await requireAdmin(["admin_super", "admin_ops"]);
    const limit = await checkAdminApiRateLimit(req, adminUser.userId);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } });
    }
    const params = await ctx.params;
    const id = String(params.id ?? "").trim();
    if (!id) return NextResponse.json({ error: "Missing provider id" }, { status: 400 });

    const admin = createAdminClient();
    const { error } = await admin
      .from("llm_global_providers")
      .delete()
      .eq("id", id);
    if (error) {
      if (isMissingTable(error)) {
        return NextResponse.json({ error: "Tabelle `llm_global_providers` fehlt. Bitte Migration `docs/sql/llm_global_management.sql` ausführen." }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await writeSecurityAuditLog({
      actorUserId: adminUser.userId,
      actorRole: adminUser.role,
      eventType: "delete",
      entityType: "other",
      entityId: id,
      payload: { table: "llm_global_providers" },
      ip: extractClientIpFromHeaders(req.headers),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
