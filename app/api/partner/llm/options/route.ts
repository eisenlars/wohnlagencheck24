import { NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { checkRateLimitPersistent, extractClientIpFromHeaders } from "@/lib/security/rate-limit";
import { loadPartnerLlmPolicy } from "@/lib/llm/partner-policy";
import { loadGlobalLlmConfig } from "@/lib/llm/global-governance";
import { listFlattenedLlmProviderModels } from "@/lib/llm/provider-catalog";

type PartnerIntegrationRow = {
  id?: string | null;
  kind?: string | null;
  provider?: string | null;
  is_active?: boolean | null;
  settings?: Record<string, unknown> | null;
};

function normalizeBadges(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const badges: string[] = [];
  for (const item of value) {
    const badge = asText(item);
    if (!badge) continue;
    const key = badge.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    badges.push(badge);
  }
  return badges;
}

function asText(value: unknown): string | null {
  const v = String(value ?? "").trim();
  return v.length > 0 ? v : null;
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
    `partner_llm_options:${user.id}:${ip}`,
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
    const globalConfig = await loadGlobalLlmConfig();

    const options: Array<{
      id: string;
      source: "partner" | "global";
      provider: string;
      model: string;
      label: string;
      hint: string | null;
      badges: string[];
      recommended: boolean;
      input_cost_usd_per_1k: number | null;
      output_cost_usd_per_1k: number | null;
      input_cost_eur_per_1k: number | null;
      output_cost_eur_per_1k: number | null;
      partner_integration_id: string | null;
      global_provider_id: string | null;
    }> = [];

    if (policy.llm_partner_managed_allowed) {
      const { data: partnerRows, error: partnerError } = await admin
        .from("partner_integrations")
        .select("id, kind, provider, is_active, settings")
        .eq("partner_id", userId)
        .eq("kind", "llm")
        .eq("is_active", true)
        .order("id", { ascending: true });
      if (partnerError && !isMissingTable(partnerError, "partner_integrations")) {
        return NextResponse.json({ error: partnerError.message }, { status: 500 });
      }
      for (const row of (partnerRows ?? []) as PartnerIntegrationRow[]) {
        const integrationId = asText(row.id);
        if (!integrationId) continue;
        const provider = asText(row.provider) ?? "llm";
        const settings = (row.settings ?? {}) as Record<string, unknown>;
        const model = asText(settings.model) ?? asText(settings.model_name) ?? "Standardmodell";
        options.push({
          id: `partner:${integrationId}`,
          source: "partner",
          provider,
          model,
          label: `${provider} · ${model} (Partner)`,
          hint: null,
          badges: [],
          recommended: false,
          input_cost_usd_per_1k: null,
          output_cost_usd_per_1k: null,
          input_cost_eur_per_1k: null,
          output_cost_eur_per_1k: null,
          partner_integration_id: integrationId,
          global_provider_id: null,
        });
      }
    }

    if (globalConfig.config.central_enabled) {
      const { models: globalRows } = await listFlattenedLlmProviderModels({ admin, activeOnly: true });
      for (const row of globalRows) {
        const providerId = asText(row.id);
        if (!providerId) continue;
        const provider = asText(row.provider) ?? "llm";
        const model = asText(row.model) ?? "Standardmodell";
        const displayLabel = asText(row.display_label) ?? `${provider} · ${model}`;
        options.push({
          id: `global:${providerId}`,
          source: "global",
          provider,
          model,
          label: `${displayLabel} (Global)`,
          hint: asText(row.hint),
          badges: normalizeBadges(row.badges),
          recommended: row.recommended === true,
          input_cost_usd_per_1k: row.input_cost_usd_per_1k,
          output_cost_usd_per_1k: row.output_cost_usd_per_1k,
          input_cost_eur_per_1k: row.input_cost_eur_per_1k,
          output_cost_eur_per_1k: row.output_cost_eur_per_1k,
          partner_integration_id: null,
          global_provider_id: providerId,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      policy,
      llm_mode_default: policy.llm_mode_default,
      options,
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
