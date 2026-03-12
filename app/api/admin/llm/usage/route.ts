import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/security/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";
import { checkAdminApiRateLimit } from "@/lib/security/rate-limit";

function isMissingTable(error: unknown, table: string): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return msg.includes(`public.${table}`) && msg.includes("does not exist");
}

function asFiniteNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function monthRangeUtc(date?: string | null) {
  const source = date ? new Date(date) : new Date();
  const y = source.getUTCFullYear();
  const m = source.getUTCMonth();
  const start = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m + 1, 1, 0, 0, 0, 0));
  return { start: start.toISOString(), end: end.toISOString() };
}

type UsageRow = {
  partner_id: string | null;
  route_name?: string | null;
  provider?: string | null;
  model?: string | null;
  total_tokens?: number | null;
  estimated_cost_eur?: number | null;
  status?: string | null;
};

export async function GET(req: Request) {
  try {
    const adminUser = await requireAdmin(["admin_super", "admin_ops"]);
    const limit = await checkAdminApiRateLimit(req, adminUser.userId);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } });
    }

    const url = new URL(req.url);
    const month = url.searchParams.get("month");
    const partnerId = String(url.searchParams.get("partner_id") ?? "").trim();
    const statusFilter = String(url.searchParams.get("status") ?? "all").trim().toLowerCase();
    const range = monthRangeUtc(month);
    const admin = createAdminClient();
    let query = admin
      .from("llm_usage_events")
      .select("partner_id, route_name, provider, model, total_tokens, estimated_cost_eur, status")
      .gte("created_at", range.start)
      .lt("created_at", range.end);
    if (statusFilter === "ok" || statusFilter === "error") {
      query = query.eq("status", statusFilter);
    }
    if (partnerId) {
      query = query.eq("partner_id", partnerId);
    }
    const { data, error } = await query;

    if (error) {
      if (isMissingTable(error, "llm_usage_events")) {
        return NextResponse.json({
          ok: true,
          month_start: range.start,
          month_end: range.end,
          by_partner: [],
          totals: { tokens: 0, cost_eur: 0 },
          warning: "Tabelle `llm_usage_events` fehlt. Bitte Migration `docs/sql/llm_global_management.sql` ausführen.",
        });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const map = new Map<string, { partner_id: string; tokens: number; cost_eur: number }>();
    const byItemMap = new Map<string, { route_name: string; provider: string; model: string; tokens: number; cost_eur: number }>();
    const byStatusMap = new Map<string, { status: string; entries: number; tokens: number; cost_eur: number }>();
    let totalTokensAll = 0;
    let totalCostAll = 0;
    for (const row of (data ?? []) as UsageRow[]) {
      totalTokensAll += asFiniteNumber(row.total_tokens);
      totalCostAll += asFiniteNumber(row.estimated_cost_eur);
      const status = String(row.status ?? "unknown").trim().toLowerCase() || "unknown";
      const statusExisting = byStatusMap.get(status) ?? { status, entries: 0, tokens: 0, cost_eur: 0 };
      statusExisting.entries += 1;
      statusExisting.tokens += asFiniteNumber(row.total_tokens);
      statusExisting.cost_eur += asFiniteNumber(row.estimated_cost_eur);
      byStatusMap.set(status, statusExisting);

      const pid = String(row.partner_id ?? "").trim();
      if (!pid) continue;
      const existing = map.get(pid) ?? { partner_id: pid, tokens: 0, cost_eur: 0 };
      existing.tokens += asFiniteNumber(row.total_tokens);
      existing.cost_eur += asFiniteNumber(row.estimated_cost_eur);
      map.set(pid, existing);

      const routeName = String(row.route_name ?? "").trim() || "unknown";
      const provider = String(row.provider ?? "").trim() || "unknown";
      const model = String(row.model ?? "").trim() || "unknown";
      const itemKey = `${routeName}::${provider}::${model}`;
      const itemExisting = byItemMap.get(itemKey) ?? { route_name: routeName, provider, model, tokens: 0, cost_eur: 0 };
      itemExisting.tokens += asFiniteNumber(row.total_tokens);
      itemExisting.cost_eur += asFiniteNumber(row.estimated_cost_eur);
      byItemMap.set(itemKey, itemExisting);
    }

    const byPartner = Array.from(map.values())
      .sort((a, b) => b.tokens - a.tokens)
      .map((row) => ({
        ...row,
        cost_eur: Number(row.cost_eur.toFixed(6)),
      }));
    const byItem = Array.from(byItemMap.values())
      .sort((a, b) => b.tokens - a.tokens)
      .map((row) => ({
        ...row,
        cost_eur: Number(row.cost_eur.toFixed(6)),
      }));
    const byStatus = Array.from(byStatusMap.values())
      .sort((a, b) => b.entries - a.entries)
      .map((row) => ({
        ...row,
        cost_eur: Number(row.cost_eur.toFixed(6)),
      }));

    return NextResponse.json({
      ok: true,
      month_start: range.start,
      month_end: range.end,
      partner_id: partnerId || null,
      status: statusFilter,
      by_partner: byPartner,
      by_item: byItem,
      by_status: byStatus,
      totals: {
        tokens: totalTokensAll,
        cost_eur: Number(totalCostAll.toFixed(6)),
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
