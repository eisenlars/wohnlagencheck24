import {
  getPortalCmsPage,
  getPortalCmsSection,
  normalizePortalCmsFields,
  parsePortalContentBlocks,
  parsePortalContentWraps,
  serializePortalContentBlocks,
  serializePortalContentWraps,
  type PortalContentBlock,
  type PortalContentEntryRecord,
  type PortalContentFieldDefinition,
  type PortalContentWrap,
} from "@/lib/portal-cms";
import {
  buildPortalCmsSourceSnapshotHash,
  resolvePortalCmsAutomatedStatus,
  upsertPortalContentI18nMeta,
  type PortalContentTranslationOrigin,
} from "@/lib/portal-cms-i18n-meta";
import { getI18nStandardPrompt } from "@/lib/i18n-prompts";
import {
  estimateCostEur,
  estimateCostUsd,
  loadActiveGlobalLlmProviders,
  loadGlobalLlmConfig,
  writeLlmUsageEvent,
} from "@/lib/llm/global-governance";
import { readSecretFromAuthConfig } from "@/lib/security/secret-crypto";
import { validateOutboundUrl } from "@/lib/security/outbound-url";
import { createAdminClient } from "@/utils/supabase/admin";

export type PortalCmsSyncMode = "copy_all" | "fill_missing";
export type PortalCmsAiApplyMode = "overwrite" | "fill_missing";

type AdminClient = ReturnType<typeof createAdminClient>;

type PortalCmsDraftOverride = {
  section_key: string;
  status?: PortalContentEntryRecord["status"];
  fields_json?: Record<string, string> | null;
};

type PortalCmsAiProvider = {
  provider: string;
  model: string;
  baseUrl: string;
  apiKey: string;
  apiVersion?: string | null;
  temperature?: number | null;
  maxTokens?: number | null;
  providerAccountId?: string | null;
  providerModelId?: string | null;
  inputCostUsdPer1k?: number | null;
  outputCostUsdPer1k?: number | null;
  inputCostEurPer1k?: number | null;
  outputCostEurPer1k?: number | null;
  fxRateUsdToEur?: number | null;
};

type ChatCompletionResult = {
  content: string;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  requestId: string | null;
  rawUsage: Record<string, unknown> | null;
};

function asText(value: unknown): string {
  return String(value ?? "").trim();
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function stripJsonCodeFence(value: string): string {
  const raw = String(value ?? "").trim();
  if (!raw.startsWith("```")) return raw;
  return raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

function usesCompletionTokens(provider: string, model: string): boolean {
  const normalizedProvider = String(provider ?? "").trim().toLowerCase();
  const normalizedModel = String(model ?? "").trim().toLowerCase();
  if (!normalizedModel) return false;
  if (normalizedProvider !== "openai" && normalizedProvider !== "azure_openai") return false;
  return normalizedModel.startsWith("gpt-5");
}

function isMissingTable(error: unknown, table: string): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return msg.includes(`public.${table}`) && msg.includes("does not exist");
}

function monthRangeUtc(d = new Date()) {
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 0, 0, 0, 0));
  return { start: start.toISOString(), end: end.toISOString() };
}

function sumOptional(left: number | null, right: number | null): number | null {
  if (left === null && right === null) return null;
  return (left ?? 0) + (right ?? 0);
}

function mapEntryFields(row: {
  page_key?: unknown;
  section_key?: unknown;
  locale?: unknown;
  status?: unknown;
  fields_json?: Record<string, unknown> | null;
  updated_at?: string | null;
}): PortalContentEntryRecord {
  return {
    page_key: String(row.page_key ?? ""),
    section_key: String(row.section_key ?? ""),
    locale: String(row.locale ?? ""),
    status: String(row.status ?? "draft") as PortalContentEntryRecord["status"],
    fields_json: Object.entries((row.fields_json ?? {}) as Record<string, unknown>).reduce<Record<string, string>>((acc, [key, value]) => {
      acc[key] = String(value ?? "");
      return acc;
    }, {}),
    updated_at: row.updated_at ?? null,
  };
}

async function loadPageEntries(admin: AdminClient, pageKey: string, locale: string): Promise<Map<string, PortalContentEntryRecord>> {
  const { data, error } = await admin
    .from("portal_content_entries")
    .select("page_key, section_key, locale, status, fields_json, updated_at")
    .eq("page_key", pageKey)
    .eq("locale", locale);
  if (error) throw new Error(String(error.message ?? "Portal-CMS-Eintraege konnten nicht geladen werden."));
  return new Map((data ?? []).map((row) => {
    const entry = mapEntryFields(row);
    return [entry.section_key, entry] as const;
  }));
}

async function checkPortalCmsGlobalBudget(admin: AdminClient): Promise<void> {
  const { config } = await loadGlobalLlmConfig();
  if (!config.central_enabled) {
    throw new Error("Zentrale LLM-Nutzung ist deaktiviert.");
  }
  if (config.monthly_token_budget === null && config.monthly_cost_budget_eur === null) return;

  const range = monthRangeUtc();
  const usageRes = await admin
    .from("llm_usage_events")
    .select("total_tokens, estimated_cost_eur")
    .gte("created_at", range.start)
    .lt("created_at", range.end)
    .eq("status", "ok");

  if (usageRes.error) {
    if (isMissingTable(usageRes.error, "llm_usage_events")) return;
    throw new Error(String(usageRes.error.message ?? "LLM usage lookup failed"));
  }

  const usage = (usageRes.data ?? []).reduce((acc, row) => ({
    tokens: acc.tokens + (asFiniteNumber(row.total_tokens) ?? 0),
    cost: acc.cost + (asFiniteNumber(row.estimated_cost_eur) ?? 0),
  }), { tokens: 0, cost: 0 });

  if (config.monthly_token_budget !== null && usage.tokens >= config.monthly_token_budget) {
    throw new Error("Globales LLM-Tokenbudget ist ausgeschoepft.");
  }
  if (config.monthly_cost_budget_eur !== null && usage.cost >= config.monthly_cost_budget_eur) {
    throw new Error("Globales LLM-Kostenbudget ist ausgeschoepft.");
  }
}

async function writePortalCmsAiUsageEvent(args: {
  provider: PortalCmsAiProvider;
  requestId?: string | null;
  status: "ok" | "error";
  errorCode?: string | null;
  usage?: {
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
    rawUsage?: Record<string, unknown> | null;
  };
  context: {
    pageKey: string;
    sectionKey: string;
    targetLocale: string;
    sourceLocale: string;
    fieldKey?: string | null;
    applyMode: PortalCmsAiApplyMode;
  };
}): Promise<void> {
  const promptTokens = args.usage?.promptTokens ?? null;
  const completionTokens = args.usage?.completionTokens ?? null;
  const totalTokens = args.usage?.totalTokens ?? sumOptional(promptTokens, completionTokens);
  const estimatedCostUsd = estimateCostUsd({
    promptTokens,
    completionTokens,
    inputCostUsdPer1k: args.provider.inputCostUsdPer1k ?? null,
    outputCostUsdPer1k: args.provider.outputCostUsdPer1k ?? null,
  });
  const directEstimatedCostEur = estimateCostEur({
    promptTokens,
    completionTokens,
    inputCostEurPer1k: args.provider.inputCostEurPer1k ?? null,
    outputCostEurPer1k: args.provider.outputCostEurPer1k ?? null,
  });
  const estimatedCostEur = directEstimatedCostEur ?? (
    estimatedCostUsd !== null && args.provider.fxRateUsdToEur !== null && args.provider.fxRateUsdToEur !== undefined
      ? Number((estimatedCostUsd * args.provider.fxRateUsdToEur).toFixed(6))
      : null
  );

  await writeLlmUsageEvent({
    partner_id: null,
    route_name: "admin-portal-cms-ai",
    mode: "central_managed",
    provider: args.provider.provider,
    model: args.provider.model,
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: totalTokens,
    provider_account_id: args.provider.providerAccountId ?? null,
    provider_model_id: args.provider.providerModelId ?? null,
    billing_currency: estimatedCostEur !== null ? "EUR" : "USD",
    fx_rate_usd_to_eur: args.provider.fxRateUsdToEur ?? null,
    input_cost_usd_per_1k_snapshot: args.provider.inputCostUsdPer1k ?? null,
    output_cost_usd_per_1k_snapshot: args.provider.outputCostUsdPer1k ?? null,
    estimated_cost_usd: estimatedCostUsd,
    estimated_cost_eur: estimatedCostEur,
    status: args.status,
    error_code: args.errorCode ?? null,
    request_id: args.requestId ?? null,
    raw_usage_json: {
      ...(args.usage?.rawUsage ?? {}),
      page_key: args.context.pageKey,
      section_key: args.context.sectionKey,
      source_locale: args.context.sourceLocale,
      target_locale: args.context.targetLocale,
      field_key: args.context.fieldKey ?? null,
      apply_mode: args.context.applyMode,
    },
  });
}

function hasMeaningfulBlockContent(blocks: PortalContentBlock[]): boolean {
  return blocks.some((block) => {
    if (block.type === "heading" || block.type === "paragraph" || block.type === "note") {
      return asText(block.text).length > 0;
    }
    if (block.type === "list") return block.items.some((item) => asText(item).length > 0);
    if (block.type === "link_list") {
      return block.items.some((item) => asText(item.label).length > 0 || asText(item.href).length > 0);
    }
    if (block.type === "contact") return block.lines.some((line) => asText(line).length > 0);
    return false;
  });
}

function hasMeaningfulWrapContent(wraps: PortalContentWrap[]): boolean {
  return wraps.some((wrap) =>
    asText(wrap.title).length > 0
    || wrap.blocks.some((block) => asText(block.text).length > 0),
  );
}

function isFieldValueEmpty(field: PortalContentFieldDefinition, value: string): boolean {
  const raw = String(value ?? "");
  if (field.type === "text" || field.type === "textarea") return asText(raw).length === 0;
  if (field.type === "block_content") return !hasMeaningfulBlockContent(parsePortalContentBlocks(raw));
  if (field.type === "content_wraps") return !hasMeaningfulWrapContent(parsePortalContentWraps(raw));
  return asText(raw).length === 0;
}

function mergeFieldsByMode(args: {
  fields: PortalContentFieldDefinition[];
  sourceFields: Record<string, string>;
  targetFields: Record<string, string>;
  mode: PortalCmsSyncMode;
}): Record<string, string> {
  const { fields, sourceFields, targetFields, mode } = args;
  const next = { ...targetFields };
  for (const field of fields) {
    const sourceValue = String(sourceFields[field.key] ?? "");
    const targetValue = String(targetFields[field.key] ?? "");
    if (mode === "copy_all") {
      next[field.key] = sourceValue;
      continue;
    }
    next[field.key] = isFieldValueEmpty(field, targetValue) ? sourceValue : targetValue;
  }
  return next;
}

export async function syncPortalCmsPageFromSourceLocale(args: {
  admin?: AdminClient;
  pageKey: string;
  sourceLocale?: string;
  targetLocale: string;
  mode?: PortalCmsSyncMode;
  targetOverrides?: PortalCmsDraftOverride[];
}) {
  const admin = args.admin ?? createAdminClient();
  const pageKey = asText(args.pageKey);
  const sourceLocale = asText(args.sourceLocale || "de").toLowerCase();
  const targetLocale = asText(args.targetLocale).toLowerCase();
  const mode = args.mode ?? "copy_all";

  const page = getPortalCmsPage(pageKey);
  if (!page) throw new Error(`Unbekannter Portal-CMS-Bereich: ${pageKey}`);
  if (!targetLocale) throw new Error("Ziel-Locale fehlt.");
  if (sourceLocale === targetLocale) throw new Error("Quell- und Ziel-Locale duerfen nicht identisch sein.");

  const [sourceEntries, targetEntries] = await Promise.all([
    loadPageEntries(admin, pageKey, sourceLocale),
    loadPageEntries(admin, pageKey, targetLocale),
  ]);
  const targetOverrideMap = new Map(
    (args.targetOverrides ?? [])
      .map((entry) => [asText(entry.section_key), entry] as const)
      .filter(([key]) => key.length > 0),
  );

  const updatedSections: string[] = [];
  const upsertRows: Array<{
    page_key: string;
    section_key: string;
    locale: string;
    status: PortalContentEntryRecord["status"];
    fields_json: Record<string, string>;
    updated_at: string;
  }> = [];
  const metaRows: Array<{
    page_key: string;
    section_key: string;
    locale: string;
    source_locale: string;
    source_snapshot_hash: string | null;
    source_updated_at: string | null;
    translation_origin: PortalContentTranslationOrigin;
  }> = [];

  for (const section of page.sections) {
    const sourceEntry = sourceEntries.get(section.section_key);
    if (!sourceEntry) continue;
    const targetEntry = targetEntries.get(section.section_key);
    const targetOverride = targetOverrideMap.get(section.section_key);
    const sourceFields = normalizePortalCmsFields(section, sourceEntry.fields_json);
    const targetFields = normalizePortalCmsFields(section, targetOverride?.fields_json ?? targetEntry?.fields_json);
    const mergedFields = mergeFieldsByMode({
      fields: section.fields,
      sourceFields,
      targetFields,
      mode,
    });
    const changed = JSON.stringify(mergedFields) !== JSON.stringify(targetFields);
    if (!changed && targetEntry) continue;

    updatedSections.push(section.section_key);
    upsertRows.push({
      page_key: page.page_key,
      section_key: section.section_key,
      locale: targetLocale,
      status: resolvePortalCmsAutomatedStatus(targetOverride?.status ?? targetEntry?.status ?? null),
      fields_json: mergedFields,
      updated_at: new Date().toISOString(),
    });
    metaRows.push({
      page_key: page.page_key,
      section_key: section.section_key,
      locale: targetLocale,
      source_locale: sourceLocale,
      source_snapshot_hash: buildPortalCmsSourceSnapshotHash({
        pageKey: page.page_key,
        sectionKey: section.section_key,
        fieldsJson: sourceEntry.fields_json,
      }),
      source_updated_at: sourceEntry.updated_at ?? null,
      translation_origin: mode === "copy_all" ? "sync_copy_all" : "sync_fill_missing",
    });
  }

  if (upsertRows.length > 0) {
    const { error } = await admin.from("portal_content_entries").upsert(upsertRows, {
      onConflict: "page_key,section_key,locale",
    });
    if (error) throw new Error(String(error.message ?? "Portal-CMS-Sync fehlgeschlagen."));
    await upsertPortalContentI18nMeta(admin, metaRows);
  }

  return {
    page_key: page.page_key,
    source_locale: sourceLocale,
    target_locale: targetLocale,
    mode,
    updated_sections: updatedSections,
    updated_count: updatedSections.length,
  };
}

async function selectPortalCmsAiProvider(): Promise<PortalCmsAiProvider> {
  const { config } = await loadGlobalLlmConfig();
  if (!config.central_enabled) {
    throw new Error("Zentrale LLM-Nutzung ist deaktiviert.");
  }
  const { providers } = await loadActiveGlobalLlmProviders();
  const provider = providers[0] ?? null;
  if (!provider) {
    throw new Error("Kein aktiver globaler LLM-Provider fuer Portal-CMS KI-Unterstuetzung verfuegbar.");
  }
  const apiKey = readSecretFromAuthConfig(provider.auth_config ?? null, "api_key")
    || readSecretFromAuthConfig(provider.auth_config ?? null, "token")
    || "";
  if (!apiKey || !provider.model) {
    throw new Error("Dem aktiven globalen LLM-Provider fehlen API-Key oder Modell.");
  }
  return {
    provider: provider.provider,
    model: provider.model,
    baseUrl: provider.base_url || "https://api.openai.com/v1",
    apiKey,
    apiVersion: provider.api_version,
    temperature: provider.temperature,
    maxTokens: provider.max_tokens,
    providerAccountId: provider.provider_account_id ?? null,
    providerModelId: provider.provider_model_id ?? provider.id ?? null,
    inputCostUsdPer1k: provider.input_cost_usd_per_1k ?? null,
    outputCostUsdPer1k: provider.output_cost_usd_per_1k ?? null,
    inputCostEurPer1k: provider.input_cost_eur_per_1k ?? null,
    outputCostEurPer1k: provider.output_cost_eur_per_1k ?? null,
    fxRateUsdToEur: provider.fx_rate_usd_to_eur ?? null,
  };
}

async function callOpenAiCompatible(args: PortalCmsAiProvider & { system: string; user: string }): Promise<ChatCompletionResult> {
  const validated = await validateOutboundUrl(args.baseUrl);
  if (!validated.ok) throw new Error("Portal-CMS-KI Ziel-URL wurde blockiert.");

  const provider = args.provider.toLowerCase();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${args.apiKey}`,
  };

  let endpoint = `${validated.url.replace(/\/+$/, "")}/chat/completions`;
  if (provider === "azure_openai") {
    const version = asText(args.apiVersion) || "2024-10-21";
    endpoint = `${validated.url.replace(/\/+$/, "")}/chat/completions?api-version=${encodeURIComponent(version)}`;
    headers["api-key"] = args.apiKey;
    delete headers.Authorization;
  }

  const body = {
    model: args.model,
    temperature: args.temperature ?? 0.2,
    ...(usesCompletionTokens(provider, args.model)
      ? { max_completion_tokens: args.maxTokens ?? 1600 }
      : { max_tokens: args.maxTokens ?? 1600 }),
    messages: [
      { role: "system", content: args.system },
      { role: "user", content: args.user },
    ],
  };

  const res = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) {
    throw new Error(`Portal-CMS-KI Anfrage fehlgeschlagen (${res.status}).`);
  }
  const payload = await res.json().catch(() => null) as Record<string, unknown> | null;
  const choices = Array.isArray(payload?.choices) ? payload.choices as Array<Record<string, unknown>> : [];
  const content = asText((choices[0]?.message as Record<string, unknown> | undefined)?.content);
  if (!content) throw new Error("Portal-CMS-KI hat keinen Inhalt zurueckgegeben.");
  const usage = (payload?.usage as Record<string, unknown> | null) ?? null;
  return {
    content,
    promptTokens: asFiniteNumber(usage?.prompt_tokens),
    completionTokens: asFiniteNumber(usage?.completion_tokens),
    totalTokens: asFiniteNumber(usage?.total_tokens),
    requestId: String(res.headers.get("x-request-id") ?? payload?.id ?? "").trim() || null,
    rawUsage: usage,
  };
}

async function translatePlainText(args: {
  provider: PortalCmsAiProvider;
  targetLocale: string;
  sourceText: string;
  sectionLabel: string;
  fieldLabel: string;
}): Promise<ChatCompletionResult> {
  const standardPrompt = getI18nStandardPrompt("general", args.targetLocale);
  return callOpenAiCompatible({
    ...args.provider,
    system: "You are a professional translator for structured portal content.",
    user:
      `${standardPrompt}\n\n` +
      "Uebersetze den folgenden deutschen CMS-Inhalt. " +
      "Bewahre Fakten, Namen, Rechtsbezeichnungen, Zahlen, E-Mail-Adressen, URLs und Formatierungen. " +
      "Gib nur den uebersetzten Inhalt ohne Erklaerung zurueck.\n\n" +
      `Bereich: ${args.sectionLabel}\n` +
      `Feld: ${args.fieldLabel}\n\n` +
      `Quelle:\n${args.sourceText}`,
  });
}

async function translateWraps(args: {
  provider: PortalCmsAiProvider;
  targetLocale: string;
  sourceWraps: PortalContentWrap[];
  sectionLabel: string;
  fieldLabel: string;
}): Promise<ChatCompletionResult> {
  const standardPrompt = getI18nStandardPrompt("general", args.targetLocale);
  const sourceJson = serializePortalContentWraps(args.sourceWraps);
  const result = await callOpenAiCompatible({
    ...args.provider,
    system: "You are a professional translator for structured JSON content.",
    user:
      `${standardPrompt}\n\n` +
      "Uebersetze die String-Inhalte in diesem JSON fuer ein CMS. " +
      "Erhalte Struktur, Reihenfolge, IDs, Typen, Levels und Booleans exakt. " +
      "Uebersetze nur `title` und `text`. " +
      "Gib ausschliesslich gueltiges JSON zurueck.\n\n" +
      `Bereich: ${args.sectionLabel}\n` +
      `Feld: ${args.fieldLabel}\n\n` +
      sourceJson,
  });
  const parsed = parsePortalContentWraps(result.content);
  if (args.sourceWraps.length === 0) {
    return { ...result, content: serializePortalContentWraps(parsed) };
  }
  const parsedFromFence = parsed.length > 0 ? parsed : parsePortalContentWraps(stripJsonCodeFence(result.content));
  if (parsedFromFence.length === 0) {
    throw new Error("Portal-CMS-KI konnte Content-Wraps nicht als JSON zurueckgeben.");
  }
  return { ...result, content: serializePortalContentWraps(parsedFromFence) };
}

async function translateBlocks(args: {
  provider: PortalCmsAiProvider;
  targetLocale: string;
  sourceBlocks: PortalContentBlock[];
  sectionLabel: string;
  fieldLabel: string;
}): Promise<ChatCompletionResult> {
  const standardPrompt = getI18nStandardPrompt("general", args.targetLocale);
  const sourceJson = serializePortalContentBlocks(args.sourceBlocks);
  const result = await callOpenAiCompatible({
    ...args.provider,
    system: "You are a professional translator for structured JSON content.",
    user:
      `${standardPrompt}\n\n` +
      "Uebersetze die textlichen Werte in diesem JSON fuer ein CMS. " +
      "Erhalte Struktur, Reihenfolge, Typen, Levels, Styles und Hrefs exakt. " +
      "Uebersetze nur sichtbare Textinhalte. " +
      "Gib ausschliesslich gueltiges JSON zurueck.\n\n" +
      `Bereich: ${args.sectionLabel}\n` +
      `Feld: ${args.fieldLabel}\n\n` +
      sourceJson,
  });
  const parsed = parsePortalContentBlocks(result.content);
  if (args.sourceBlocks.length === 0) {
    return { ...result, content: serializePortalContentBlocks(parsed) };
  }
  const parsedFromFence = parsed.length > 0 ? parsed : parsePortalContentBlocks(stripJsonCodeFence(result.content));
  if (parsedFromFence.length === 0) {
    throw new Error("Portal-CMS-KI konnte Block-Content nicht als JSON zurueckgeben.");
  }
  return { ...result, content: serializePortalContentBlocks(parsedFromFence) };
}

async function translateFieldValue(args: {
  provider: PortalCmsAiProvider;
  field: PortalContentFieldDefinition;
  sourceValue: string;
  targetLocale: string;
  sectionLabel: string;
}): Promise<ChatCompletionResult> {
  if (args.field.type === "text" || args.field.type === "textarea") {
    return translatePlainText({
      provider: args.provider,
      targetLocale: args.targetLocale,
      sourceText: args.sourceValue,
      sectionLabel: args.sectionLabel,
      fieldLabel: args.field.label,
    });
  }
  if (args.field.type === "content_wraps") {
    return translateWraps({
      provider: args.provider,
      targetLocale: args.targetLocale,
      sourceWraps: parsePortalContentWraps(args.sourceValue),
      sectionLabel: args.sectionLabel,
      fieldLabel: args.field.label,
    });
  }
  if (args.field.type === "block_content") {
    return translateBlocks({
      provider: args.provider,
      targetLocale: args.targetLocale,
      sourceBlocks: parsePortalContentBlocks(args.sourceValue),
      sectionLabel: args.sectionLabel,
      fieldLabel: args.field.label,
    });
  }
  throw new Error(`Feldtyp ${args.field.type} wird fuer Portal-CMS-KI noch nicht unterstuetzt.`);
}

export async function translatePortalCmsSectionFromSourceLocale(args: {
  admin?: AdminClient;
  pageKey: string;
  sectionKey: string;
  targetLocale: string;
  sourceLocale?: string;
  fieldKey?: string;
  applyMode?: PortalCmsAiApplyMode;
  targetOverride?: PortalCmsDraftOverride | null;
}) {
  const admin = args.admin ?? createAdminClient();
  const pageKey = asText(args.pageKey);
  const sectionKey = asText(args.sectionKey);
  const targetLocale = asText(args.targetLocale).toLowerCase();
  const sourceLocale = asText(args.sourceLocale || "de").toLowerCase();
  const fieldKey = asText(args.fieldKey);
  const applyMode = args.applyMode ?? "overwrite";

  const page = getPortalCmsPage(pageKey);
  const section = getPortalCmsSection(pageKey, sectionKey);
  if (!page || !section) throw new Error(`Unbekannter Portal-CMS-Bereich: ${pageKey}/${sectionKey}`);
  if (!targetLocale) throw new Error("Ziel-Locale fehlt.");
  if (sourceLocale === targetLocale) throw new Error("Quell- und Ziel-Locale duerfen nicht identisch sein.");

  const selectedFields = fieldKey
    ? section.fields.filter((field) => field.key === fieldKey)
    : section.fields;
  if (selectedFields.length === 0) {
    throw new Error(`Unbekanntes Feld fuer ${pageKey}/${sectionKey}: ${fieldKey}`);
  }

  const provider = await selectPortalCmsAiProvider();
  await checkPortalCmsGlobalBudget(admin);

  const [sourceEntries, targetEntries] = await Promise.all([
    loadPageEntries(admin, pageKey, sourceLocale),
    loadPageEntries(admin, pageKey, targetLocale),
  ]);
  const sourceEntry = sourceEntries.get(sectionKey);
  if (!sourceEntry) {
    throw new Error(`In ${sourceLocale} liegen fuer ${pageKey}/${sectionKey} keine CMS-Inhalte vor.`);
  }
  const targetEntry = targetEntries.get(sectionKey);
  const targetOverride = args.targetOverride ?? null;
  const sourceFields = normalizePortalCmsFields(section, sourceEntry.fields_json);
  const nextFields = normalizePortalCmsFields(section, targetOverride?.fields_json ?? targetEntry?.fields_json);

  const translatedFieldKeys: string[] = [];
  let usage = {
    promptTokens: null as number | null,
    completionTokens: null as number | null,
    totalTokens: null as number | null,
    rawUsage: null as Record<string, unknown> | null,
    requestId: null as string | null,
  };

  try {
    for (const field of selectedFields) {
      const sourceValue = String(sourceFields[field.key] ?? "");
      const targetValue = String(nextFields[field.key] ?? "");
      if (isFieldValueEmpty(field, sourceValue)) continue;
      if (applyMode === "fill_missing" && !isFieldValueEmpty(field, targetValue)) continue;

      const translated = await translateFieldValue({
        provider,
        field,
        sourceValue,
        targetLocale,
        sectionLabel: section.label,
      });
      nextFields[field.key] = translated.content.trim();
      translatedFieldKeys.push(field.key);
      usage = {
        promptTokens: sumOptional(usage.promptTokens, translated.promptTokens),
        completionTokens: sumOptional(usage.completionTokens, translated.completionTokens),
        totalTokens: sumOptional(usage.totalTokens, translated.totalTokens),
        rawUsage: translated.rawUsage ?? usage.rawUsage,
        requestId: translated.requestId ?? usage.requestId,
      };
    }

    if (translatedFieldKeys.length === 0) {
      return {
        page_key: page.page_key,
        section_key: section.section_key,
        target_locale: targetLocale,
        translated_field_keys: [],
        translated_count: 0,
      };
    }

    const { error } = await admin.from("portal_content_entries").upsert({
      page_key: page.page_key,
      section_key: section.section_key,
      locale: targetLocale,
      status: resolvePortalCmsAutomatedStatus(targetOverride?.status ?? targetEntry?.status ?? null),
      fields_json: nextFields,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: "page_key,section_key,locale",
    });
    if (error) throw new Error(String(error.message ?? "Portal-CMS-KI-Uebersetzung konnte nicht gespeichert werden."));

    await upsertPortalContentI18nMeta(admin, [{
      page_key: page.page_key,
      section_key: section.section_key,
      locale: targetLocale,
      source_locale: sourceLocale,
      source_snapshot_hash: buildPortalCmsSourceSnapshotHash({
        pageKey: page.page_key,
        sectionKey: section.section_key,
        fieldsJson: sourceEntry.fields_json,
      }),
      source_updated_at: sourceEntry.updated_at ?? null,
      translation_origin: "ai",
    }]);
    await writePortalCmsAiUsageEvent({
      provider,
      requestId: usage.requestId,
      status: "ok",
      usage,
      context: {
        pageKey: page.page_key,
        sectionKey: section.section_key,
        targetLocale,
        sourceLocale,
        fieldKey: fieldKey || null,
        applyMode,
      },
    });

    return {
      page_key: page.page_key,
      section_key: section.section_key,
      target_locale: targetLocale,
      translated_field_keys: translatedFieldKeys,
      translated_count: translatedFieldKeys.length,
    };
  } catch (error) {
    try {
      await writePortalCmsAiUsageEvent({
        provider,
        requestId: usage.requestId,
        status: "error",
        errorCode: "PORTAL_CMS_AI_FAILED",
        usage,
        context: {
          pageKey: page.page_key,
          sectionKey: section.section_key,
          targetLocale,
          sourceLocale,
          fieldKey: fieldKey || null,
          applyMode,
        },
      });
    } catch {
      // Der eigentliche Uebersetzungsfehler soll nicht von einem Logging-Problem verdeckt werden.
    }
    throw error;
  }
}
