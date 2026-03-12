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

export async function GET(req: Request) {
  try {
    const adminUser = await requireAdmin(["admin_super", "admin_ops"]);
    const limit = await checkAdminApiRateLimit(req, adminUser.userId);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } });
    }
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("llm_global_providers")
      .select("id, provider, model, base_url, auth_type, auth_config, priority, is_active, temperature, max_tokens, price_source_url_override, input_cost_eur_per_1k, output_cost_eur_per_1k, price_source, price_source_url, price_updated_at, created_at, updated_at")
      .order("priority", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      if (isMissingTable(error)) {
        return NextResponse.json({ ok: true, providers: [], source: "fallback", warning: "Tabelle `llm_global_providers` fehlt." });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const masked = (data ?? []).map((row) =>
      maskIntegrationForResponse({
        ...row,
        auth_config: row.auth_config ?? null,
      } as Record<string, unknown>),
    );
    return NextResponse.json({ ok: true, providers: masked, source: "db" });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const adminUser = await requireAdmin(["admin_super", "admin_ops"]);
    const limit = await checkAdminApiRateLimit(req, adminUser.userId);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } });
    }
    const body = (await req.json()) as Body;
    const provider = norm(body.provider)?.toLowerCase();
    const model = norm(body.model);
    const baseUrl = norm(body.base_url) ?? "https://api.openai.com/v1";
    const authType = norm(body.auth_type)?.toLowerCase() ?? "api_key";
    const priority = Math.max(1, Math.floor(asFiniteNumber(body.priority) ?? 100));
    const isActive = body.is_active !== false;
    const inputCost = asFiniteNumber(body.input_cost_eur_per_1k);
    const outputCost = asFiniteNumber(body.output_cost_eur_per_1k);
    if (!provider || !model) {
      return NextResponse.json({ error: "provider und model sind erforderlich" }, { status: 400 });
    }
    if (body.input_cost_eur_per_1k !== undefined && !isPositiveNumber(body.input_cost_eur_per_1k)) {
      return NextResponse.json({ error: "input_cost_eur_per_1k muss > 0 sein." }, { status: 400 });
    }
    if (body.output_cost_eur_per_1k !== undefined && !isPositiveNumber(body.output_cost_eur_per_1k)) {
      return NextResponse.json({ error: "output_cost_eur_per_1k muss > 0 sein." }, { status: 400 });
    }
    if (isActive && (!(inputCost && inputCost > 0) || !(outputCost && outputCost > 0))) {
      return NextResponse.json({ error: "Aktive Provider benötigen gültige Input-/Output-Kosten (> 0)." }, { status: 400 });
    }
    const payload = {
      provider,
      model,
      base_url: baseUrl,
      auth_type: authType,
      priority,
      is_active: isActive,
      temperature: asFiniteNumber(body.temperature),
      max_tokens: asFiniteNumber(body.max_tokens),
      price_source_url_override: norm(body.price_source_url_override),
      input_cost_eur_per_1k: inputCost,
      output_cost_eur_per_1k: outputCost,
    };
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("llm_global_providers")
      .insert(payload)
      .select("id, provider, model, base_url, auth_type, auth_config, priority, is_active, temperature, max_tokens, price_source_url_override, input_cost_eur_per_1k, output_cost_eur_per_1k, price_source, price_source_url, price_updated_at, created_at, updated_at")
      .maybeSingle();
    if (error) {
      if (isMissingTable(error)) {
        return NextResponse.json({ error: "Tabelle `llm_global_providers` fehlt. Bitte Migration `docs/sql/llm_global_management.sql` ausführen." }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    await writeSecurityAuditLog({
      actorUserId: adminUser.userId,
      actorRole: adminUser.role,
      eventType: "create",
      entityType: "other",
      entityId: String(data?.id ?? "llm_global_provider"),
      payload: payload as unknown as Record<string, unknown>,
      ip: extractClientIpFromHeaders(req.headers),
      userAgent: req.headers.get("user-agent"),
    });
    return NextResponse.json({ ok: true, provider: maskIntegrationForResponse(data as Record<string, unknown>) }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
