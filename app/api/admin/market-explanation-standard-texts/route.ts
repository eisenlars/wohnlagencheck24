import { NextResponse } from "next/server";

import { translateAdminTextItems } from "@/lib/admin-text-i18n";
import {
  buildAdminAreaTextI18nMetaViews,
  buildAdminAreaTextI18nSourceSnapshotHash,
  deleteAdminAreaTextI18nEntries,
  deleteAdminAreaTextI18nMeta,
  deleteAdminAreaTextRows,
  loadAdminAreaTextI18nEntries,
  loadAdminAreaTextI18nMeta,
  loadAdminAreaTextRows,
  upsertAdminAreaTextI18nEntries,
  upsertAdminAreaTextI18nMeta,
  upsertAdminAreaTextRows,
  type AdminAreaTextRecord,
  type AdminAreaTextI18nEntryRecord,
  type AdminAreaTextI18nEntryStatus,
} from "@/lib/admin-area-texts";
import { getBundeslaender } from "@/lib/data";
import {
  getMarketExplanationStandardDefinitions,
  inferMarketExplanationStandardGroup,
  type MarketExplanationStandardScope,
  type MarketExplanationStandardTextDefinition,
} from "@/lib/market-explanation-standard-text-definitions";
import { buildReportPath, type AreaRow } from "@/lib/text-bootstrap";
import { getTextKeyLabel } from "@/lib/text-key-labels";
import { requireAdmin } from "@/lib/security/admin-auth";
import { checkAdminApiRateLimit } from "@/lib/security/rate-limit";
import { createAdminClient } from "@/utils/supabase/admin";

const SUPABASE_BUCKET = "immobilienmarkt";
const KREIS_STANDARD_TEXT_PATH = "text-standards/kreis/text_standard_kreis.json";
const BUNDESLAND_STANDARD_TEXT_PATH = "text-standards/bundesland/text_standard_bundesland.json";

type JsonObject = Record<string, unknown>;
type TextTree = Record<string, Record<string, string>>;

type StandardPayload = {
  text?: unknown;
  bundeslandname?: { text?: unknown };
  kreisname?: { text?: unknown };
  ortslagenname?: { text?: unknown };
  [key: string]: unknown;
};

type ReportPayload = {
  text?: unknown;
  data?: {
    text?: unknown;
    [key: string]: unknown;
  } | unknown;
  [key: string]: unknown;
};

type MarketExplanationStandardEntry = {
  key: string;
  value_text: string;
  base_value_text?: string;
  override_value_text?: string | null;
  has_override?: boolean;
  text_type?: MarketExplanationStandardTextDefinition["type"];
  override_status?: string | null;
  override_updated_at?: string | null;
  translation_origin?: string | null;
  translation_is_stale?: boolean;
};

type Body = {
  level?: unknown;
  bundesland_slug?: unknown;
  area_id?: unknown;
  locale?: unknown;
  entries?: Array<{
    key?: unknown;
    value_text?: unknown;
    status?: unknown;
  }>;
  sync?: {
    target_locale?: unknown;
    mode?: unknown;
  };
  translate?: {
    target_locale?: unknown;
    keys?: unknown;
  };
  reset?: {
    keys?: unknown;
  };
};

type ScopedSelection =
  | {
      scope: "bundesland";
      scopeKind: "bundesland";
      scopeKey: string;
      bundeslandSlug: string;
      areaId: "";
      area: null;
    }
  | {
      scope: "kreis" | "ortslage";
      scopeKind: "kreis" | "ortslage";
      scopeKey: string;
      bundeslandSlug: "";
      areaId: string;
      area: AreaRow;
    };

function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asText(value: unknown): string {
  return String(value ?? "").trim();
}

function sanitizeScope(value: unknown): MarketExplanationStandardScope {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "bundesland") return "bundesland";
  if (normalized === "ortslage") return "ortslage";
  return "kreis";
}

function sanitizeLocale(value: unknown): string {
  return String(value ?? "de").trim().toLowerCase() || "de";
}

function sanitizeBundeslandSlug(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function sanitizeAreaId(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeBundeslandTranslationStatus(value: unknown): AdminAreaTextI18nEntryStatus {
  const normalized = asText(value).toLowerCase();
  if (normalized === "internal") return "internal";
  if (normalized === "live") return "live";
  return "draft";
}

function resolveAutoWriteStatus(status: AdminAreaTextI18nEntryStatus): AdminAreaTextI18nEntryStatus {
  return status === "live" ? "internal" : status;
}

function toTextTree(value: unknown): TextTree {
  if (!isRecord(value)) return {};
  const out: TextTree = {};
  for (const [groupKey, groupValue] of Object.entries(value)) {
    if (!isRecord(groupValue)) continue;
    const nextGroup: Record<string, string> = {};
    for (const [textKey, textValue] of Object.entries(groupValue)) {
      nextGroup[textKey] = String(textValue ?? "");
    }
    out[groupKey] = nextGroup;
  }
  return out;
}

function cloneTextTree(tree: TextTree): TextTree {
  const out: TextTree = {};
  for (const [groupKey, group] of Object.entries(tree)) {
    out[groupKey] = { ...group };
  }
  return out;
}

function resolveStandardTree(
  payload: StandardPayload | null,
  preferredScope?: MarketExplanationStandardScope,
): TextTree {
  if (!payload) return {};
  const top = toTextTree(payload.text);
  if (Object.keys(top).length > 0) return top;
  const bundesland = toTextTree(payload.bundeslandname?.text);
  const kreis = toTextTree(payload.kreisname?.text);
  const ortslage = toTextTree(payload.ortslagenname?.text);
  if (preferredScope === "bundesland" && Object.keys(bundesland).length > 0) return bundesland;
  if (preferredScope === "kreis" && Object.keys(kreis).length > 0) return kreis;
  if (preferredScope === "ortslage" && Object.keys(ortslage).length > 0) return ortslage;
  if (Object.keys(bundesland).length > 0) return bundesland;
  if (Object.keys(kreis).length > 0) return kreis;
  return ortslage;
}

function findTextByKey(tree: TextTree, key: string): string {
  for (const group of Object.values(tree)) {
    if (Object.prototype.hasOwnProperty.call(group, key)) {
      return String(group[key] ?? "");
    }
  }
  return "";
}

function applyEntriesToTree(tree: TextTree, entries: MarketExplanationStandardEntry[]): TextTree {
  const next = cloneTextTree(tree);
  for (const entry of entries) {
    let targetGroup: string | null = null;
    for (const [groupKey, group] of Object.entries(next)) {
      if (Object.prototype.hasOwnProperty.call(group, entry.key)) {
        targetGroup = groupKey;
        break;
      }
    }
    const groupKey = targetGroup ?? inferMarketExplanationStandardGroup(entry.key);
    next[groupKey] = {
      ...(next[groupKey] ?? {}),
      [entry.key]: entry.value_text,
    };
  }
  return next;
}

function ensureBundeslandScope(scope: MarketExplanationStandardScope, bundeslandSlug: string) {
  if (scope === "bundesland" && !bundeslandSlug) {
    throw new Error("Für Bundesland-Standardtexte wird ein Bundesland-Slug benötigt.");
  }
}

function ensureAreaScope(scope: MarketExplanationStandardScope, areaId: string) {
  if ((scope === "kreis" || scope === "ortslage") && !areaId) {
    throw new Error("Für Kreis-/Ortslagen-Standardtexte wird ein Gebiet benötigt.");
  }
}

function resolveScopeKind(scope: MarketExplanationStandardScope): "bundesland" | "kreis" | "ortslage" {
  return scope === "bundesland" ? "bundesland" : scope;
}

function buildStoragePath(scope: MarketExplanationStandardScope): string {
  if (scope === "kreis") return KREIS_STANDARD_TEXT_PATH;
  return BUNDESLAND_STANDARD_TEXT_PATH;
}

function buildBundeslandReportPath(bundeslandSlug: string): string {
  return `reports/deutschland/${bundeslandSlug}.json`;
}

async function downloadStandardPayload(
  admin: ReturnType<typeof createAdminClient>,
  scope: MarketExplanationStandardScope,
): Promise<StandardPayload | null> {
  const res = await admin.storage.from(SUPABASE_BUCKET).download(buildStoragePath(scope));
  if (res.error || !res.data) return null;
  const raw = await res.data.text();
  const payload = JSON.parse(raw);
  return isRecord(payload) ? (payload as StandardPayload) : null;
}

async function downloadBundeslandReport(
  admin: ReturnType<typeof createAdminClient>,
  bundeslandSlug: string,
) : Promise<ReportPayload | null> {
  const res = await admin.storage.from(SUPABASE_BUCKET).download(buildBundeslandReportPath(bundeslandSlug));
  if (res.error || !res.data) return null;
  const raw = await res.data.text();
  const payload = JSON.parse(raw);
  return isRecord(payload) ? (payload as ReportPayload) : null;
}

async function downloadAreaReport(
  admin: ReturnType<typeof createAdminClient>,
  area: AreaRow,
): Promise<ReportPayload | null> {
  const res = await admin.storage.from(SUPABASE_BUCKET).download(buildReportPath(area));
  if (res.error || !res.data) return null;
  const raw = await res.data.text();
  const payload = JSON.parse(raw);
  return isRecord(payload) ? (payload as ReportPayload) : null;
}

async function loadAreaRow(
  admin: ReturnType<typeof createAdminClient>,
  areaId: string,
): Promise<AreaRow | null> {
  const res = await admin
    .from("areas")
    .select("id, slug, name, parent_slug, bundesland_slug")
    .eq("id", areaId)
    .maybeSingle();
  if (res.error?.message) {
    throw new Error(String(res.error.message));
  }
  const row = res.data as {
    id?: string | null;
    slug?: string | null;
    name?: string | null;
    parent_slug?: string | null;
    bundesland_slug?: string | null;
  } | null;
  if (!row?.id || !row?.slug || !row?.bundesland_slug) return null;
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: row.name ? String(row.name) : null,
    parent_slug: row.parent_slug ? String(row.parent_slug) : null,
    bundesland_slug: String(row.bundesland_slug),
  };
}

function sanitizeKey(value: unknown, definitions: MarketExplanationStandardTextDefinition[]): string {
  const key = asText(value);
  if (!definitions.some((entry) => entry.key === key)) {
    throw new Error(`Unbekannter Standardtext-Key: ${key}`);
  }
  return key;
}

function buildEntries(definitions: MarketExplanationStandardTextDefinition[], tree: TextTree) {
  return definitions.map((definition) => ({
    key: definition.key,
    value_text: findTextByKey(tree, definition.key),
    text_type: definition.type,
  }));
}

function withTreePayload(payload: StandardPayload | null, tree: TextTree): StandardPayload {
  return {
    ...(payload ?? {}),
    text: tree,
  };
}

function resolveReportTree(payload: ReportPayload | null): TextTree {
  if (!payload) return {};
  const top = toTextTree(payload.text);
  if (Object.keys(top).length > 0) return top;
  if (isRecord(payload.data)) {
    return toTextTree(payload.data.text);
  }
  return {};
}

function mergeMissingEntriesFromStandard(reportTree: TextTree, standardTree: TextTree, definitions: MarketExplanationStandardTextDefinition[]): TextTree {
  const next = cloneTextTree(reportTree);
  for (const definition of definitions) {
    const current = findTextByKey(next, definition.key).trim();
    if (current) continue;
    const fallbackValue = findTextByKey(standardTree, definition.key);
    if (!String(fallbackValue ?? "").trim()) continue;
    const groupKey = inferMarketExplanationStandardGroup(definition.key);
    next[groupKey] = {
      ...(next[groupKey] ?? {}),
      [definition.key]: fallbackValue,
    };
  }
  return next;
}

function applyAdminOverridesToTree(baseTree: TextTree, rows: AdminAreaTextRecord[]): TextTree {
  return applyEntriesToTree(
    baseTree,
    rows
      .filter((row) => asText(row.optimized_content).length > 0)
      .map((row) => ({
        key: row.section_key,
        value_text: String(row.optimized_content ?? ""),
      })),
  );
}

function buildBundeslandEntries(args: {
  definitions: MarketExplanationStandardTextDefinition[];
  baseTree: TextTree;
  effectiveTree: TextTree;
  overrideRows: AdminAreaTextRecord[];
}): MarketExplanationStandardEntry[] {
  const overrideMap = new Map(args.overrideRows.map((row) => [row.section_key, row] as const));
  return args.definitions.map((definition) => {
    const override = overrideMap.get(definition.key) ?? null;
    const baseValue = findTextByKey(args.baseTree, definition.key);
    const effectiveValue = findTextByKey(args.effectiveTree, definition.key);
    return {
      key: definition.key,
      value_text: effectiveValue,
      base_value_text: baseValue,
      override_value_text: override?.optimized_content ?? null,
      has_override: Boolean(asText(override?.optimized_content)),
      text_type: definition.type,
      override_status: override?.status ?? null,
      override_updated_at: override?.last_updated ?? null,
    };
  });
}

function buildScopedEntries(args: {
  definitions: MarketExplanationStandardTextDefinition[];
  baseTree: TextTree;
  effectiveTree: TextTree;
  overrideRows: AdminAreaTextRecord[];
}): MarketExplanationStandardEntry[] {
  return buildBundeslandEntries(args);
}

function buildBundeslandSourceEntries(args: {
  definitions: MarketExplanationStandardTextDefinition[];
  effectiveTree: TextTree;
  overrideRows: AdminAreaTextRecord[];
}) {
  const overrideMap = new Map(args.overrideRows.map((row) => [row.section_key, row] as const));
  return args.definitions.map((definition) => ({
    scope_kind: "bundesland" as const,
    scope_key: "",
    section_key: definition.key,
    value_text: findTextByKey(args.effectiveTree, definition.key),
    updated_at: overrideMap.get(definition.key)?.last_updated ?? null,
  }));
}

function buildScopedSourceEntries(args: {
  definitions: MarketExplanationStandardTextDefinition[];
  effectiveTree: TextTree;
  overrideRows: AdminAreaTextRecord[];
  scopeKind: "bundesland" | "kreis" | "ortslage";
  scopeKey: string;
}) {
  return buildBundeslandSourceEntries({
    definitions: args.definitions,
    effectiveTree: args.effectiveTree,
    overrideRows: args.overrideRows,
  }).map((entry) => ({
    ...entry,
    scope_kind: args.scopeKind,
    scope_key: args.scopeKey,
  }));
}

function buildBundeslandTranslatedEntries(args: {
  definitions: MarketExplanationStandardTextDefinition[];
  sourceEntries: Array<{
    section_key: string;
    value_text: string;
    updated_at?: string | null;
  }>;
  targetRows: AdminAreaTextI18nEntryRecord[];
  metas: ReturnType<typeof buildAdminAreaTextI18nMetaViews>;
}): MarketExplanationStandardEntry[] {
  const sourceMap = new Map(args.sourceEntries.map((entry) => [entry.section_key, entry] as const));
  const targetMap = new Map(args.targetRows.map((row) => [row.section_key, row] as const));
  const metaMap = new Map(args.metas.map((meta) => [meta.section_key, meta] as const));
  return args.definitions.map((definition) => {
    const source = sourceMap.get(definition.key);
    const target = targetMap.get(definition.key) ?? null;
    const meta = metaMap.get(definition.key) ?? null;
    return {
      key: definition.key,
      value_text: target?.value_text ?? "",
      base_value_text: source?.value_text ?? "",
      override_value_text: target?.value_text ?? null,
      has_override: Boolean(asText(target?.value_text)),
      text_type: definition.type,
      override_status: target?.status ?? null,
      override_updated_at: target?.updated_at ?? null,
      translation_origin: meta?.translation_origin ?? null,
      translation_is_stale: meta?.translation_is_stale ?? false,
    };
  });
}

function buildScopedTranslatedEntries(args: {
  definitions: MarketExplanationStandardTextDefinition[];
  sourceEntries: Array<{
    section_key: string;
    value_text: string;
    updated_at?: string | null;
  }>;
  targetRows: AdminAreaTextI18nEntryRecord[];
  metas: ReturnType<typeof buildAdminAreaTextI18nMetaViews>;
}): MarketExplanationStandardEntry[] {
  return buildBundeslandTranslatedEntries(args);
}

async function loadBundeslandBaseTree(args: {
  admin: ReturnType<typeof createAdminClient>;
  bundeslandSlug: string;
  definitions: MarketExplanationStandardTextDefinition[];
}): Promise<TextTree> {
  const reportPayload = await downloadBundeslandReport(args.admin, args.bundeslandSlug);
  const reportTree = resolveReportTree(reportPayload);
  const standardPayload = await downloadStandardPayload(args.admin, "bundesland");
  const standardTree = resolveStandardTree(standardPayload);
  return mergeMissingEntriesFromStandard(reportTree, standardTree, args.definitions);
}

async function loadAreaBaseTree(args: {
  admin: ReturnType<typeof createAdminClient>;
  area: AreaRow;
  scope: "kreis" | "ortslage";
  definitions: MarketExplanationStandardTextDefinition[];
}): Promise<TextTree> {
  const reportPayload = await downloadAreaReport(args.admin, args.area);
  const reportTree = resolveReportTree(reportPayload);
  const standardPayload = await downloadStandardPayload(args.admin, "kreis");
  const standardTree = resolveStandardTree(standardPayload, args.scope);
  return mergeMissingEntriesFromStandard(reportTree, standardTree, args.definitions);
}

async function resolveScopedSelection(args: {
  admin: ReturnType<typeof createAdminClient>;
  scope: MarketExplanationStandardScope;
  bundeslandSlug: string;
  areaId: string;
  requireScopeKey?: boolean;
}): Promise<ScopedSelection | null> {
  if (args.scope === "bundesland") {
    if (!args.bundeslandSlug) {
      if (args.requireScopeKey) ensureBundeslandScope(args.scope, args.bundeslandSlug);
      return null;
    }
    return {
      scope: "bundesland",
      scopeKind: "bundesland",
      scopeKey: args.bundeslandSlug,
      bundeslandSlug: args.bundeslandSlug,
      areaId: "",
      area: null,
    };
  }

  if (!args.areaId) {
    if (args.requireScopeKey) ensureAreaScope(args.scope, args.areaId);
    return null;
  }

  const area = await loadAreaRow(args.admin, args.areaId);
  if (!area) {
    throw new Error("Gebiet konnte nicht geladen werden.");
  }
  const isKreis = String(area.parent_slug ?? "") === String(area.bundesland_slug ?? "");
  if (args.scope === "kreis" && !isKreis) {
    throw new Error("Für Kreis-Standardtexte muss ein Kreis ausgewählt werden.");
  }
  if (args.scope === "ortslage" && isKreis) {
    throw new Error("Für Ortslagen-Standardtexte muss eine Ortslage ausgewählt werden.");
  }
  return {
    scope: args.scope,
    scopeKind: args.scope,
    scopeKey: area.id,
    bundeslandSlug: "",
    areaId: area.id,
    area,
  };
}

async function loadPayload(args: {
  admin: ReturnType<typeof createAdminClient>;
  scope: MarketExplanationStandardScope;
  bundeslandSlug: string;
  areaId: string;
  locale: string;
}) {
  const definitions = getMarketExplanationStandardDefinitions(args.scope);
  const selection = await resolveScopedSelection({
    admin: args.admin,
    scope: args.scope,
    bundeslandSlug: args.bundeslandSlug,
    areaId: args.areaId,
    requireScopeKey: false,
  });
  let tree: TextTree;
  let entries: MarketExplanationStandardEntry[];
  if (!selection) {
    tree = {};
    entries = buildEntries(definitions, tree);
  } else {
    const baseTree = selection.scope === "bundesland"
      ? await loadBundeslandBaseTree({
          admin: args.admin,
          bundeslandSlug: selection.bundeslandSlug,
          definitions,
        })
      : await loadAreaBaseTree({
          admin: args.admin,
          area: selection.area,
          scope: selection.scope,
          definitions,
        });
    const overrideRows = await loadAdminAreaTextRows({
      supabaseClient: args.admin,
      scopeKind: selection.scopeKind,
      scopeKey: selection.scopeKey,
      keys: definitions.map((definition) => definition.key),
      approvedOnly: true,
    });
    const effectiveGermanTree = applyAdminOverridesToTree(baseTree, overrideRows);
    if (args.locale === "de") {
      tree = effectiveGermanTree;
      entries = buildScopedEntries({
        definitions,
        baseTree,
        effectiveTree: tree,
        overrideRows,
      });
    } else {
      const sourceEntries = buildScopedSourceEntries({
        definitions,
        effectiveTree: effectiveGermanTree,
        overrideRows,
        scopeKind: selection.scopeKind,
        scopeKey: selection.scopeKey,
      });
      const [targetRows, metas] = await Promise.all([
        loadAdminAreaTextI18nEntries({
          supabaseClient: args.admin,
          scopeKind: selection.scopeKind,
          scopeKey: selection.scopeKey,
          locale: args.locale,
          keys: definitions.map((definition) => definition.key),
        }),
        loadAdminAreaTextI18nMeta({
          supabaseClient: args.admin,
          scopeKind: selection.scopeKind,
          scopeKey: selection.scopeKey,
          locale: args.locale,
          keys: definitions.map((definition) => definition.key),
        }),
      ]);
      const metaViews = buildAdminAreaTextI18nMetaViews({
        metas,
        sourceEntries,
      });
      tree = applyEntriesToTree(
        effectiveGermanTree,
        targetRows
          .filter((row) => asText(row.value_text).length > 0)
          .map((row) => ({
            key: row.section_key,
            value_text: row.value_text,
          })),
      );
      entries = buildScopedTranslatedEntries({
        definitions,
        sourceEntries,
        targetRows,
        metas: metaViews,
      });
    }
  }
  const bundeslaender = await getBundeslaender();
  return {
    level: args.scope,
    locale: args.locale,
    bundesland_slug: args.bundeslandSlug,
    area_id: selection?.areaId ?? "",
    bundeslaender,
    definitions,
    entries,
  };
}

export async function GET(req: Request) {
  try {
    const adminUser = await requireAdmin(["admin_super", "admin_ops"]);
    const limit = await checkAdminApiRateLimit(req, adminUser.userId);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } });
    }

    const url = new URL(req.url);
    const scope = sanitizeScope(url.searchParams.get("level"));
    const locale = sanitizeLocale(url.searchParams.get("locale"));
    const bundeslandSlug = sanitizeBundeslandSlug(url.searchParams.get("bundesland_slug"));
    const areaId = sanitizeAreaId(url.searchParams.get("area_id"));
    if (scope === "bundesland") {
      ensureBundeslandScope(scope, bundeslandSlug);
    } else if (areaId) {
      ensureAreaScope(scope, areaId);
    }

    const admin = createAdminClient();
    const payload = await loadPayload({ admin, scope, bundeslandSlug, areaId, locale });
    return NextResponse.json({ ok: true, ...payload });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      return NextResponse.json({ error: error.message }, { status: 400 });
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
    const scope = sanitizeScope(body.level);
    const locale = sanitizeLocale(body.locale);
    const bundeslandSlug = sanitizeBundeslandSlug(body.bundesland_slug);
    const areaId = sanitizeAreaId(body.area_id);
    const admin = createAdminClient();
    const selection = await resolveScopedSelection({
      admin,
      scope,
      bundeslandSlug,
      areaId,
      requireScopeKey: true,
    });
    if (!selection) {
      throw new Error("Für diese Standardtexte fehlt die Gebietszuordnung.");
    }
    const definitions = getMarketExplanationStandardDefinitions(scope);

    if (body.translate) {
      const targetLocale = sanitizeLocale(body.translate.target_locale ?? locale);
      const requestedKeys = Array.isArray(body.translate.keys)
        ? body.translate.keys.map((item) => sanitizeKey(item, definitions))
        : definitions.map((definition) => definition.key);
      const baseTree = selection.scope === "bundesland"
        ? await loadBundeslandBaseTree({
            admin,
            bundeslandSlug: selection.bundeslandSlug,
            definitions,
          })
        : await loadAreaBaseTree({
            admin,
            area: selection.area,
            scope: selection.scope,
            definitions,
          });
      const existingOverrides = await loadAdminAreaTextRows({
        supabaseClient: admin,
        scopeKind: selection.scopeKind,
        scopeKey: selection.scopeKey,
        keys: requestedKeys,
        approvedOnly: true,
      });
      const sourceTree = applyAdminOverridesToTree(baseTree, existingOverrides);
      const items = requestedKeys.map((key) => ({
        key,
        label: getTextKeyLabel(key, key),
        sourceText: findTextByKey(sourceTree, key),
      }));
      const translated = await translateAdminTextItems({
        admin,
        domain: `market-standard-${scope}`,
        domainLabel: selection.scope === "bundesland"
          ? `Markterklärungstexte ${selection.bundeslandSlug}`
          : `Markterklärungstexte ${selection.area.name ?? selection.area.slug ?? selection.area.id}`,
        targetLocale,
        items,
      });
      if (targetLocale === "de") {
        const rows = requestedKeys.map((key) => {
          const definition = definitions.find((entry) => entry.key === key);
          if (!definition) {
            throw new Error(`Unbekannter Standardtext-Key: ${key}`);
          }
          return {
            scope_kind: selection.scopeKind,
            scope_key: selection.scopeKey,
            section_key: key,
            text_type: definition.type,
            raw_content: findTextByKey(baseTree, key),
            optimized_content: translated.get(key) ?? "",
            status: "approved" as const,
            updated_by: adminUser.userId,
          };
        }).filter((row) => asText(row.optimized_content).length > 0);
        await upsertAdminAreaTextRows({
          supabaseClient: admin,
          rows,
        });
      } else {
        const existingEntries = await loadAdminAreaTextI18nEntries({
          supabaseClient: admin,
          scopeKind: selection.scopeKind,
          scopeKey: selection.scopeKey,
          locale: targetLocale,
          keys: requestedKeys,
        });
        const existingMap = new Map(existingEntries.map((row) => [row.section_key, row] as const));
        const upsertRows = requestedKeys.flatMap((key) => {
          const translatedText = translated.get(key);
          if (!translatedText) return [];
          const current = existingMap.get(key);
          return [{
            scope_kind: selection.scopeKind,
            scope_key: selection.scopeKey,
            section_key: key,
            locale: targetLocale,
            status: resolveAutoWriteStatus(normalizeBundeslandTranslationStatus(current?.status)),
            value_text: translatedText,
          }];
        });
        if (upsertRows.length > 0) {
          await upsertAdminAreaTextI18nEntries({
            supabaseClient: admin,
            rows: upsertRows,
          });
          await upsertAdminAreaTextI18nMeta({
            supabaseClient: admin,
            rows: upsertRows.map((row) => ({
              scope_kind: row.scope_kind,
              scope_key: row.scope_key,
              section_key: row.section_key,
              locale: row.locale,
              source_locale: "de",
              source_snapshot_hash: buildAdminAreaTextI18nSourceSnapshotHash({
                scopeKind: row.scope_kind,
                scopeKey: row.scope_key,
                sectionKey: row.section_key,
                valueText: findTextByKey(sourceTree, row.section_key),
              }),
              source_updated_at: existingOverrides.find((entry) => entry.section_key === row.section_key)?.last_updated ?? null,
              translation_origin: "ai",
            })),
          });
        }
      }
      const responsePayload = await loadPayload({
        admin,
        scope,
        bundeslandSlug,
        areaId,
        locale: targetLocale,
      });
      return NextResponse.json({ ok: true, ...responsePayload });
    }

    if (body.sync) {
      throw new Error("DE-Sync ist für Bundesland-Standardtexte nicht vorgesehen.");
    }

    if (body.reset) {
      const resetKeys = Array.isArray(body.reset.keys)
        ? body.reset.keys.map((item) => sanitizeKey(item, definitions))
        : [];
      if (resetKeys.length === 0) {
        throw new Error("Keine Standardtext-Keys zum Zurücksetzen übergeben.");
      }
      if (locale === "de") {
        await deleteAdminAreaTextRows({
          supabaseClient: admin,
          scopeKind: selection.scopeKind,
          scopeKey: selection.scopeKey,
          keys: resetKeys,
        });
      } else {
        await deleteAdminAreaTextI18nEntries({
          supabaseClient: admin,
          scopeKind: selection.scopeKind,
          scopeKey: selection.scopeKey,
          locale,
          keys: resetKeys,
        });
        await deleteAdminAreaTextI18nMeta({
          supabaseClient: admin,
          scopeKind: selection.scopeKind,
          scopeKey: selection.scopeKey,
          locale,
          keys: resetKeys,
        });
      }
      const responsePayload = await loadPayload({ admin, scope, bundeslandSlug, areaId, locale });
      return NextResponse.json({ ok: true, ...responsePayload });
    }

    if (!Array.isArray(body.entries) || body.entries.length === 0) {
      throw new Error("Keine Standardtexte zum Speichern übergeben.");
    }

    const nextEntries: MarketExplanationStandardEntry[] = body.entries.map((entry) => ({
      key: sanitizeKey(entry.key, definitions),
      value_text: String(entry.value_text ?? ""),
      override_status: entry.status ? String(entry.status) : undefined,
    }));
    const baseTree = selection.scope === "bundesland"
      ? await loadBundeslandBaseTree({
          admin,
          bundeslandSlug: selection.bundeslandSlug,
          definitions,
        })
      : await loadAreaBaseTree({
          admin,
          area: selection.area,
          scope: selection.scope,
          definitions,
        });
    if (locale === "de") {
      const rowsToUpsert: Parameters<typeof upsertAdminAreaTextRows>[0]["rows"] = [];
      const rowsToDelete: string[] = [];
      for (const entry of nextEntries) {
        const definition = definitions.find((item) => item.key === entry.key);
        if (!definition) continue;
        const baseValue = findTextByKey(baseTree, entry.key);
        const nextValue = String(entry.value_text ?? "");
        if (!asText(nextValue) || nextValue === baseValue) {
          rowsToDelete.push(entry.key);
          continue;
        }
        rowsToUpsert.push({
          scope_kind: selection.scopeKind,
          scope_key: selection.scopeKey,
          section_key: entry.key,
          text_type: definition.type,
          raw_content: baseValue,
          optimized_content: nextValue,
          status: "approved",
          updated_by: adminUser.userId,
        });
      }
      if (rowsToDelete.length > 0) {
        await deleteAdminAreaTextRows({
          supabaseClient: admin,
          scopeKind: selection.scopeKind,
          scopeKey: selection.scopeKey,
          keys: rowsToDelete,
        });
      }
      if (rowsToUpsert.length > 0) {
        await upsertAdminAreaTextRows({
          supabaseClient: admin,
          rows: rowsToUpsert,
        });
      }
    } else {
      const approvedOverrides = await loadAdminAreaTextRows({
        supabaseClient: admin,
        scopeKind: selection.scopeKind,
        scopeKey: selection.scopeKey,
        keys: definitions.map((definition) => definition.key),
        approvedOnly: true,
      });
      const germanSourceTree = applyAdminOverridesToTree(baseTree, approvedOverrides);
      const rowsToUpsert: Parameters<typeof upsertAdminAreaTextI18nEntries>[0]["rows"] = [];
      const rowsToDelete: string[] = [];
      for (const entry of nextEntries) {
        const nextValue = String(entry.value_text ?? "");
        if (!asText(nextValue)) {
          rowsToDelete.push(entry.key);
          continue;
        }
        rowsToUpsert.push({
          scope_kind: selection.scopeKind,
          scope_key: selection.scopeKey,
          section_key: entry.key,
          locale,
          status: normalizeBundeslandTranslationStatus(entry.override_status),
          value_text: nextValue,
        });
      }
      if (rowsToDelete.length > 0) {
        await deleteAdminAreaTextI18nEntries({
          supabaseClient: admin,
          scopeKind: selection.scopeKind,
          scopeKey: selection.scopeKey,
          locale,
          keys: rowsToDelete,
        });
        await deleteAdminAreaTextI18nMeta({
          supabaseClient: admin,
          scopeKind: selection.scopeKind,
          scopeKey: selection.scopeKey,
          locale,
          keys: rowsToDelete,
        });
      }
      if (rowsToUpsert.length > 0) {
        await upsertAdminAreaTextI18nEntries({
          supabaseClient: admin,
          rows: rowsToUpsert,
        });
        await upsertAdminAreaTextI18nMeta({
          supabaseClient: admin,
          rows: rowsToUpsert.map((row) => ({
            scope_kind: row.scope_kind,
            scope_key: row.scope_key,
            section_key: row.section_key,
            locale: row.locale,
            source_locale: "de",
            source_snapshot_hash: buildAdminAreaTextI18nSourceSnapshotHash({
              scopeKind: row.scope_kind,
              scopeKey: row.scope_key,
              sectionKey: row.section_key,
              valueText: findTextByKey(germanSourceTree, row.section_key),
            }),
            source_updated_at: approvedOverrides.find((item) => item.section_key === row.section_key)?.last_updated ?? null,
            translation_origin: "manual",
          })),
        });
      }
    }

    const responsePayload = await loadPayload({ admin, scope, bundeslandSlug, areaId, locale });
    return NextResponse.json({ ok: true, ...responsePayload });
  } catch (error) {
    if (error instanceof Error) {
      const lowered = error.message.toLowerCase();
      if (lowered.includes("admin_area_text_i18n_entries") || lowered.includes("admin_area_text_i18n_meta")) {
        return NextResponse.json({ error: "Admin-Area-i18n-Tabellen fehlen. Bitte `docs/sql/portal_cms.sql` ausführen." }, { status: 409 });
      }
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
