import { createAdminClient } from "@/utils/supabase/admin";
import type {
  AIBillingMode,
  PartnerAICreditLedgerRecord,
  PartnerAIUsageEventCreateInput,
  PartnerAIUsageEventFilters,
  PartnerAIUsageEventRecord,
  PartnerAIUsageFeature,
  PartnerAIUsageStatus,
} from "@/lib/network-partners/types";

function asText(value: unknown): string {
  return String(value ?? "").trim();
}

function asNullableText(value: unknown): string | null {
  const normalized = asText(value);
  return normalized.length > 0 ? normalized : null;
}

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asRowArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord);
}

function buildPeriodRange(periodKey: string): { start: string; end: string } {
  const match = /^(\d{4})-(\d{2})$/.exec(String(periodKey ?? "").trim());
  if (!match) {
    throw new Error("INVALID_AI_PERIOD_KEY");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("INVALID_AI_PERIOD_KEY");
  }

  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 1));
  return {
    start: startDate.toISOString(),
    end: endDate.toISOString(),
  };
}

function normalizeLedgerStatus(value: unknown): PartnerAICreditLedgerRecord["status"] {
  const status = asText(value);
  return status === "closed" ? "closed" : "open";
}

function normalizeBillingMode(value: unknown): AIBillingMode {
  const mode = asText(value);
  if (mode === "credit_based" || mode === "blocked") return mode;
  return "included";
}

function normalizeFeature(value: unknown): PartnerAIUsageFeature {
  const feature = asText(value);
  if (feature === "content_translate" || feature === "seo_meta_generate") return feature;
  return "content_optimize";
}

function normalizeUsageStatus(value: unknown): PartnerAIUsageStatus {
  const status = asText(value);
  if (status === "blocked" || status === "error") return status;
  return "ok";
}

function mapLedgerRow(row: Record<string, unknown>): PartnerAICreditLedgerRecord {
  return {
    id: asText(row.id),
    partner_id: asText(row.partner_id),
    period_key: asText(row.period_key),
    opening_balance_eur: asNumber(row.opening_balance_eur),
    credits_added_eur: asNumber(row.credits_added_eur),
    credits_used_eur: asNumber(row.credits_used_eur),
    closing_balance_eur: asNumber(row.closing_balance_eur),
    status: normalizeLedgerStatus(row.status),
    updated_at: asText(row.updated_at),
  };
}

function mapUsageEventRow(row: Record<string, unknown>): PartnerAIUsageEventRecord {
  return {
    id: asText(row.id),
    partner_id: asText(row.partner_id),
    area_id: asNullableText(row.area_id),
    network_partner_id: asNullableText(row.network_partner_id),
    content_item_id: asNullableText(row.content_item_id),
    feature: normalizeFeature(row.feature),
    locale: asNullableText(row.locale),
    billing_mode: normalizeBillingMode(row.billing_mode),
    prompt_tokens: Math.max(0, Math.floor(asNumber(row.prompt_tokens))),
    completion_tokens: Math.max(0, Math.floor(asNumber(row.completion_tokens))),
    estimated_cost_eur: asNumber(row.estimated_cost_eur),
    credit_delta_eur: asNumber(row.credit_delta_eur),
    status: normalizeUsageStatus(row.status),
    created_at: asText(row.created_at),
  };
}

export async function getPartnerAICreditLedger(
  partnerId: string,
  periodKey: string,
): Promise<PartnerAICreditLedgerRecord | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("partner_ai_credit_ledgers")
    .select("id, partner_id, period_key, opening_balance_eur, credits_added_eur, credits_used_eur, closing_balance_eur, status, updated_at")
    .eq("partner_id", partnerId)
    .eq("period_key", periodKey)
    .maybeSingle();

  if (error) throw new Error(error.message ?? "PARTNER_AI_CREDIT_LEDGER_LOOKUP_FAILED");
  return isRecord(data) ? mapLedgerRow(data) : null;
}

export async function listPartnerAIUsageEvents(
  partnerId: string,
  filters: PartnerAIUsageEventFilters = {},
): Promise<PartnerAIUsageEventRecord[]> {
  const admin = createAdminClient();
  let query = admin
    .from("partner_ai_usage_events")
    .select("id, partner_id, area_id, network_partner_id, content_item_id, feature, locale, billing_mode, prompt_tokens, completion_tokens, estimated_cost_eur, credit_delta_eur, status, created_at")
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false });

  if (filters.period_key) {
    const range = buildPeriodRange(filters.period_key);
    query = query.gte("created_at", range.start).lt("created_at", range.end);
  }
  if (filters.network_partner_id) {
    query = query.eq("network_partner_id", filters.network_partner_id);
  }
  if (filters.content_item_id) {
    query = query.eq("content_item_id", filters.content_item_id);
  }
  if (filters.feature) {
    query = query.eq("feature", filters.feature);
  }
  if (typeof filters.limit === "number" && Number.isFinite(filters.limit) && filters.limit > 0) {
    query = query.limit(Math.floor(filters.limit));
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message ?? "PARTNER_AI_USAGE_EVENTS_LIST_FAILED");
  return asRowArray(data).map((row) => mapUsageEventRow(row));
}

export async function listNetworkPartnerAIUsageEvents(
  networkPartnerId: string,
  filters: Omit<PartnerAIUsageEventFilters, "network_partner_id"> = {},
): Promise<PartnerAIUsageEventRecord[]> {
  const admin = createAdminClient();
  let query = admin
    .from("partner_ai_usage_events")
    .select("id, partner_id, area_id, network_partner_id, content_item_id, feature, locale, billing_mode, prompt_tokens, completion_tokens, estimated_cost_eur, credit_delta_eur, status, created_at")
    .eq("network_partner_id", networkPartnerId)
    .order("created_at", { ascending: false });

  if (filters.period_key) {
    const range = buildPeriodRange(filters.period_key);
    query = query.gte("created_at", range.start).lt("created_at", range.end);
  }
  if (filters.content_item_id) {
    query = query.eq("content_item_id", filters.content_item_id);
  }
  if (filters.feature) {
    query = query.eq("feature", filters.feature);
  }
  if (typeof filters.limit === "number" && Number.isFinite(filters.limit) && filters.limit > 0) {
    query = query.limit(Math.floor(filters.limit));
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message ?? "NETWORK_PARTNER_AI_USAGE_EVENTS_LIST_FAILED");
  return asRowArray(data).map((row) => mapUsageEventRow(row));
}

export async function recordPartnerAIUsageEvent(
  input: PartnerAIUsageEventCreateInput,
): Promise<PartnerAIUsageEventRecord> {
  const admin = createAdminClient();
  const payload = {
    partner_id: input.partner_id,
    area_id: asNullableText(input.area_id),
    network_partner_id: asNullableText(input.network_partner_id),
    content_item_id: asNullableText(input.content_item_id),
    feature: input.feature,
    locale: asNullableText(input.locale),
    billing_mode: input.billing_mode,
    prompt_tokens: Math.max(0, Math.floor(input.prompt_tokens)),
    completion_tokens: Math.max(0, Math.floor(input.completion_tokens)),
    estimated_cost_eur: Number(input.estimated_cost_eur.toFixed(4)),
    credit_delta_eur: Number(input.credit_delta_eur.toFixed(4)),
    status: input.status ?? "ok",
  };

  const { data, error } = await admin
    .from("partner_ai_usage_events")
    .insert(payload)
    .select("id, partner_id, area_id, network_partner_id, content_item_id, feature, locale, billing_mode, prompt_tokens, completion_tokens, estimated_cost_eur, credit_delta_eur, status, created_at")
    .single();

  if (error) throw new Error(error.message ?? "PARTNER_AI_USAGE_EVENT_CREATE_FAILED");
  if (!isRecord(data)) throw new Error("PARTNER_AI_USAGE_EVENT_CREATE_FAILED");
  return mapUsageEventRow(data);
}
