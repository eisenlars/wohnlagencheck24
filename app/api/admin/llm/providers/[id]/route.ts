import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/security/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";
import { checkAdminApiRateLimit, extractClientIpFromHeaders } from "@/lib/security/rate-limit";
import { writeSecurityAuditLog } from "@/lib/security/audit-log";
import { maskIntegrationForResponse } from "@/lib/security/integration-mask";
import { isMissingTable, listFlattenedLlmProviderModels } from "@/lib/llm/provider-catalog";

type Body = {
  provider?: string;
  model?: string;
  display_label?: string | null;
  hint?: string | null;
  badges?: unknown;
  recommended?: boolean;
  base_url?: string;
  auth_type?: string;
  api_version?: string | null;
  priority?: number;
  sort_order?: number;
  is_active?: boolean;
  temperature?: number | null;
  max_tokens?: number | null;
  input_cost_usd_per_1k?: number | null;
  output_cost_usd_per_1k?: number | null;
};

function norm(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  return raw.length > 0 ? raw : null;
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

function normalizeBadges(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const badges: string[] = [];
  for (const item of value) {
    const badge = String(item ?? "").trim();
    if (!badge) continue;
    const key = badge.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    badges.push(badge);
  }
  return badges;
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
      .from("llm_provider_models")
      .select("id, provider_account_id, is_active, input_cost_usd_per_1k, output_cost_usd_per_1k")
      .eq("id", id)
      .maybeSingle();
    if (existingError) {
      if (isMissingTable(existingError, "llm_provider_models")) {
        return NextResponse.json({ error: "Tabelle `llm_provider_models` fehlt. Bitte Migration ausführen." }, { status: 409 });
      }
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }
    if (!existing) return NextResponse.json({ error: "Modell nicht gefunden" }, { status: 404 });

    const patch: Record<string, unknown> = {};
    const accountPatch: Record<string, unknown> = {};
    if (body.model !== undefined) patch.model = norm(body.model);
    if (body.display_label !== undefined) patch.display_label = norm(body.display_label);
    if (body.hint !== undefined) patch.hint = norm(body.hint);
    if (body.badges !== undefined) patch.badges = normalizeBadges(body.badges);
    if (body.recommended !== undefined) patch.recommended = body.recommended === true;
    if (body.priority !== undefined || body.sort_order !== undefined) {
      patch.sort_order = Math.max(1, Math.floor(asFiniteNumber(body.sort_order ?? body.priority) ?? 100));
    }
    if (body.is_active !== undefined) patch.is_active = body.is_active === true;
    if (body.temperature !== undefined) patch.temperature = asFiniteNumber(body.temperature);
    if (body.max_tokens !== undefined) patch.max_tokens = asFiniteNumber(body.max_tokens);
    if (body.input_cost_usd_per_1k !== undefined) patch.input_cost_usd_per_1k = asFiniteNumber(body.input_cost_usd_per_1k);
    if (body.output_cost_usd_per_1k !== undefined) patch.output_cost_usd_per_1k = asFiniteNumber(body.output_cost_usd_per_1k);
    if (body.provider !== undefined) accountPatch.provider = norm(body.provider)?.toLowerCase();
    if (body.base_url !== undefined) accountPatch.base_url = norm(body.base_url);
    if (body.auth_type !== undefined) accountPatch.auth_type = norm(body.auth_type)?.toLowerCase();
    if (body.api_version !== undefined) accountPatch.api_version = norm(body.api_version);

    if (body.input_cost_usd_per_1k !== undefined && !isPositiveNumber(body.input_cost_usd_per_1k)) {
      return NextResponse.json({ error: "input_cost_usd_per_1k muss > 0 sein." }, { status: 400 });
    }
    if (body.output_cost_usd_per_1k !== undefined && !isPositiveNumber(body.output_cost_usd_per_1k)) {
      return NextResponse.json({ error: "output_cost_usd_per_1k muss > 0 sein." }, { status: 400 });
    }
    const nextIsActive = body.is_active !== undefined ? body.is_active === true : Boolean(existing.is_active);
    const nextInputCost = body.input_cost_usd_per_1k !== undefined ? asFiniteNumber(body.input_cost_usd_per_1k) : asFiniteNumber(existing.input_cost_usd_per_1k);
    const nextOutputCost = body.output_cost_usd_per_1k !== undefined ? asFiniteNumber(body.output_cost_usd_per_1k) : asFiniteNumber(existing.output_cost_usd_per_1k);
    if (nextIsActive && (!(nextInputCost && nextInputCost > 0) || !(nextOutputCost && nextOutputCost > 0))) {
      return NextResponse.json({ error: "Aktive Modelle benötigen gültige Input-/Output-Kosten (> 0)." }, { status: 400 });
    }
    if (Object.keys(patch).length === 0 && Object.keys(accountPatch).length === 0) {
      return NextResponse.json({ error: "No update fields provided" }, { status: 400 });
    }

    if (body.recommended === true) {
      await admin
        .from("llm_provider_models")
        .update({ recommended: false })
        .eq("provider_account_id", String(existing.provider_account_id ?? ""))
        .neq("id", id);
    }

    if (Object.keys(accountPatch).length > 0) {
      const { error: accountUpdateError } = await admin
        .from("llm_provider_accounts")
        .update(accountPatch)
        .eq("id", String(existing.provider_account_id ?? ""));
      if (accountUpdateError) {
        if (isMissingTable(accountUpdateError, "llm_provider_accounts")) {
          return NextResponse.json({ error: "Tabelle `llm_provider_accounts` fehlt. Bitte Migration ausführen." }, { status: 409 });
        }
        return NextResponse.json({ error: accountUpdateError.message }, { status: 500 });
      }
    }

    if (Object.keys(patch).length > 0) {
      const { error } = await admin
        .from("llm_provider_models")
        .update(patch)
        .eq("id", id);
      if (error) {
        if (isMissingTable(error, "llm_provider_models")) {
          return NextResponse.json({ error: "Tabelle `llm_provider_models` fehlt. Bitte Migration ausführen." }, { status: 409 });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    const models = await listFlattenedLlmProviderModels({ admin, activeOnly: false });
    const updated = models.models.find((row) => row.id === id) ?? null;
    if (!updated) return NextResponse.json({ error: "Modell nicht gefunden" }, { status: 404 });

    await writeSecurityAuditLog({
      actorUserId: adminUser.userId,
      actorRole: adminUser.role,
      eventType: "update",
      entityType: "other",
      entityId: id,
      payload: { ...accountPatch, ...patch },
      ip: extractClientIpFromHeaders(req.headers),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({ ok: true, provider: maskIntegrationForResponse(updated as unknown as Record<string, unknown>) });
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
      .from("llm_provider_models")
      .delete()
      .eq("id", id);
    if (error) {
      if (isMissingTable(error, "llm_provider_models")) {
        return NextResponse.json({ error: "Tabelle `llm_provider_models` fehlt. Bitte Migration ausführen." }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await writeSecurityAuditLog({
      actorUserId: adminUser.userId,
      actorRole: adminUser.role,
      eventType: "delete",
      entityType: "other",
      entityId: id,
      payload: { table: "llm_provider_models" },
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
