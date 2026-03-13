import { NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { checkRateLimitPersistent, extractClientIpFromHeaders } from "@/lib/security/rate-limit";
import { loadPartnerLlmPolicy } from "@/lib/llm/partner-policy";
import { listFlattenedLlmProviderModels, loadUsdToEurRate } from "@/lib/llm/provider-catalog";

type UsageRow = {
  provider?: string | null;
  model?: string | null;
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  total_tokens?: number | null;
  estimated_cost_eur?: number | null;
};

type UsageBoundsRow = {
  created_at?: string | null;
};

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

function yearRangeUtc(year: number) {
  const y = Number.isFinite(year) ? Math.max(2000, Math.min(2100, Math.floor(year))) : new Date().getUTCFullYear();
  const start = new Date(Date.UTC(y, 0, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y + 1, 0, 1, 0, 0, 0, 0));
  return { start: start.toISOString(), end: end.toISOString() };
}

function isMissingTable(error: unknown, table: string): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return msg.includes(`public.${table}`) && msg.includes("does not exist");
}

async function requirePartnerUser(req: Request): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) throw new Error("UNAUTHORIZED");

  const ip = extractClientIpFromHeaders(req.headers);
  const limit = await checkRateLimitPersistent(
    `partner_llm_usage:${user.id}:${ip}`,
    { windowMs: 60 * 1000, max: 60 },
  );
  if (!limit.allowed) throw new Error(`RATE_LIMIT:${limit.retryAfterSec}`);
  return user.id;
}

export async function GET(req: Request) {
  try {
    const userId = await requirePartnerUser(req);
    const admin = createAdminClient();
    const policy = await loadPartnerLlmPolicy(admin, userId);
    const { data: activePartnerLlm } = await admin
      .from("partner_integrations")
      .select("id")
      .eq("partner_id", userId)
      .eq("kind", "llm")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    const partnerManagedAllowed = policy.llm_partner_managed_allowed !== false;
    const hasUsablePartnerLlm = partnerManagedAllowed && Boolean(activePartnerLlm?.id);
    const usesPortalLlm =
      (policy.llm_mode_default === "central_managed" || !partnerManagedAllowed)
      && !hasUsablePartnerLlm;
    if (!usesPortalLlm) {
      return NextResponse.json({ error: "Usage ist nur für zentrale LLM-Nutzung verfügbar." }, { status: 403 });
    }

    const url = new URL(req.url);
    const period = String(url.searchParams.get("period") ?? "month").toLowerCase();
    const month = url.searchParams.get("month");
    const yearRaw = Number(url.searchParams.get("year"));
    const nowYear = new Date().getUTCFullYear();
    const requestedYear = Number.isFinite(yearRaw) ? yearRaw : nowYear;

    let range: { start: string; end: string } | null;
    if (period === "all") {
      range = null;
    } else if (period === "year") {
      range = yearRangeUtc(requestedYear);
    } else {
      range = monthRangeUtc(month);
    }
    const monthStart = (range ?? monthRangeUtc(month)).start.slice(0, 10);

    let usageQuery = admin
      .from("llm_usage_events")
      .select("provider, model, prompt_tokens, completion_tokens, total_tokens, estimated_cost_eur")
      .eq("partner_id", userId)
      .eq("status", "ok");
    if (range) {
      usageQuery = usageQuery.gte("created_at", range.start).lt("created_at", range.end);
    }
    const [usageRes, firstUsageRes, lastUsageRes] = await Promise.all([
      usageQuery,
      admin
        .from("llm_usage_events")
        .select("created_at")
        .eq("partner_id", userId)
        .eq("status", "ok")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
      admin
        .from("llm_usage_events")
        .select("created_at")
        .eq("partner_id", userId)
        .eq("status", "ok")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    const { data, error } = usageRes;

    if (error) {
      if (isMissingTable(error, "llm_usage_events")) {
        return NextResponse.json({
          ok: true,
          period,
          range_start: range?.start ?? null,
          range_end: range?.end ?? null,
          by_model: [],
          totals: { input_tokens: 0, output_tokens: 0, total_tokens: 0, tokens: 0, cost_eur: 0 },
          warning: "Tabelle `llm_usage_events` fehlt.",
          usage_bounds: {
            has_usage: false,
            earliest_month: null,
            latest_month: null,
          },
        });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const firstUsage = firstUsageRes.data as UsageBoundsRow | null;
    const lastUsage = lastUsageRes.data as UsageBoundsRow | null;
    const earliestMonth = String(firstUsage?.created_at ?? "").slice(0, 7) || null;
    const latestMonth = String(lastUsage?.created_at ?? "").slice(0, 7) || null;
    const hasUsage = Boolean(earliestMonth && latestMonth);

    const map = new Map<string, {
      provider: string;
      model: string;
      input_tokens: number;
      output_tokens: number;
      total_tokens: number;
      cost_eur: number;
    }>();
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalTokens = 0;
    let totalCost = 0;
    for (const row of (data ?? []) as UsageRow[]) {
      const provider = String(row.provider ?? "").trim() || "unknown";
      const model = String(row.model ?? "").trim() || "unknown";
      const inputTokens = asFiniteNumber(row.prompt_tokens);
      const outputTokens = asFiniteNumber(row.completion_tokens);
      const tokens = asFiniteNumber(row.total_tokens);
      const cost = asFiniteNumber(row.estimated_cost_eur);
      totalInputTokens += inputTokens;
      totalOutputTokens += outputTokens;
      totalTokens += tokens;
      totalCost += cost;
      const key = `${provider}::${model}`;
      const existing = map.get(key) ?? {
        provider,
        model,
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
        cost_eur: 0,
      };
      existing.input_tokens += inputTokens;
      existing.output_tokens += outputTokens;
      existing.total_tokens += tokens;
      existing.cost_eur += cost;
      map.set(key, existing);
    }

    const byModel = Array.from(map.values())
      .sort((a, b) => b.total_tokens - a.total_tokens);

    const [providerCatalog, fxRateUsdToEur] = await Promise.all([
      listFlattenedLlmProviderModels({ admin, activeOnly: true }),
      loadUsdToEurRate(admin, monthStart).catch(() => null),
    ]);
    const providerPrices = providerCatalog.models;

    const byModelEnriched = byModel.map((row) => {
      const match = providerPrices.find(
        (price) =>
          String(price.provider ?? "").trim().toLowerCase() === row.provider.toLowerCase()
          && String(price.model ?? "").trim() === row.model,
      );
      const inputUsd = asFiniteNumber(match?.input_cost_usd_per_1k);
      const outputUsd = asFiniteNumber(match?.output_cost_usd_per_1k);
      return {
        ...row,
        cost_eur: Number(row.cost_eur.toFixed(6)),
        input_price_usd_per_1k: inputUsd,
        output_price_usd_per_1k: outputUsd,
      };
    });

    return NextResponse.json({
      ok: true,
      period,
      range_start: range?.start ?? null,
      range_end: range?.end ?? null,
      by_model: byModelEnriched,
      totals: {
        input_tokens: totalInputTokens,
        output_tokens: totalOutputTokens,
        total_tokens: totalTokens,
        tokens: totalTokens,
        cost_eur: Number(totalCost.toFixed(6)),
      },
      fx_rate_usd_to_eur: fxRateUsdToEur && fxRateUsdToEur > 0 ? Number(fxRateUsdToEur.toFixed(6)) : null,
      usage_bounds: {
        has_usage: hasUsage,
        earliest_month: earliestMonth,
        latest_month: latestMonth,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message.startsWith("RATE_LIMIT:")) {
        const sec = Number(error.message.split(":")[1] ?? "60");
        return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(sec) } });
      }
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
