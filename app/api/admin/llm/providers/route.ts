import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/security/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";
import { checkAdminApiRateLimit, extractClientIpFromHeaders } from "@/lib/security/rate-limit";
import { writeSecurityAuditLog } from "@/lib/security/audit-log";
import { maskIntegrationForResponse } from "@/lib/security/integration-mask";
import { isMissingTable, listFlattenedLlmProviderModels } from "@/lib/llm/provider-catalog";

type Body = {
  provider_account_id?: string;
  model?: string;
  display_label?: string | null;
  hint?: string | null;
  badges?: unknown;
  recommended?: boolean;
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

export async function GET(req: Request) {
  try {
    const adminUser = await requireAdmin(["admin_super", "admin_ops"]);
    const limit = await checkAdminApiRateLimit(req, adminUser.userId);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } });
    }

    const result = await listFlattenedLlmProviderModels({ activeOnly: false });
    const providers = result.models.map((row) =>
      maskIntegrationForResponse({
        ...row,
        auth_config: row.auth_config ?? null,
      } as Record<string, unknown>),
    );
    return NextResponse.json({ ok: true, providers, source: result.source, fx_rate_usd_to_eur: result.fxRateUsdToEur });
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
    const providerAccountId = norm(body.provider_account_id);
    const model = norm(body.model);
    const sortOrder = Math.max(1, Math.floor(asFiniteNumber(body.sort_order) ?? 100));
    const isActive = body.is_active !== false;
    const inputCost = asFiniteNumber(body.input_cost_usd_per_1k);
    const outputCost = asFiniteNumber(body.output_cost_usd_per_1k);
    if (!providerAccountId || !model) {
      return NextResponse.json({ error: "provider_account_id und model sind erforderlich" }, { status: 400 });
    }
    if (body.input_cost_usd_per_1k !== undefined && !isPositiveNumber(body.input_cost_usd_per_1k)) {
      return NextResponse.json({ error: "input_cost_usd_per_1k muss > 0 sein." }, { status: 400 });
    }
    if (body.output_cost_usd_per_1k !== undefined && !isPositiveNumber(body.output_cost_usd_per_1k)) {
      return NextResponse.json({ error: "output_cost_usd_per_1k muss > 0 sein." }, { status: 400 });
    }
    if (isActive && (!(inputCost && inputCost > 0) || !(outputCost && outputCost > 0))) {
      return NextResponse.json({ error: "Aktive Modelle benötigen gültige Input-/Output-Kosten (> 0)." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: account, error: accountError } = await admin
      .from("llm_provider_accounts")
      .select("id")
      .eq("id", providerAccountId)
      .maybeSingle();
    if (accountError) {
      if (isMissingTable(accountError, "llm_provider_accounts")) {
        return NextResponse.json({ error: "Tabelle `llm_provider_accounts` fehlt. Bitte Migration ausführen." }, { status: 409 });
      }
      return NextResponse.json({ error: accountError.message }, { status: 500 });
    }
    if (!account) return NextResponse.json({ error: "Provider-Account nicht gefunden" }, { status: 404 });

    if (body.recommended === true) {
      await admin
        .from("llm_provider_models")
        .update({ recommended: false })
        .eq("provider_account_id", providerAccountId);
    }

    const payload = {
      provider_account_id: providerAccountId,
      model,
      display_label: norm(body.display_label),
      hint: norm(body.hint),
      badges: normalizeBadges(body.badges),
      recommended: body.recommended === true,
      sort_order: sortOrder,
      is_active: isActive,
      temperature: asFiniteNumber(body.temperature),
      max_tokens: asFiniteNumber(body.max_tokens),
      input_cost_usd_per_1k: inputCost,
      output_cost_usd_per_1k: outputCost,
    };

    const { data, error } = await admin
      .from("llm_provider_models")
      .insert(payload)
      .select("id")
      .maybeSingle();
    if (error) {
      if (isMissingTable(error, "llm_provider_models")) {
        return NextResponse.json({ error: "Tabelle `llm_provider_models` fehlt. Bitte Migration ausführen." }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const models = await listFlattenedLlmProviderModels({ admin, activeOnly: false });
    const created = models.models.find((row) => row.id === String(data?.id ?? "").trim()) ?? null;

    await writeSecurityAuditLog({
      actorUserId: adminUser.userId,
      actorRole: adminUser.role,
      eventType: "create",
      entityType: "other",
      entityId: String(data?.id ?? "llm_provider_model"),
      payload: payload as unknown as Record<string, unknown>,
      ip: extractClientIpFromHeaders(req.headers),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({
      ok: true,
      provider: created ? maskIntegrationForResponse(created as unknown as Record<string, unknown>) : { id: String(data?.id ?? "") },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
