import { NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { resolveMarketingContextForArea } from "@/lib/areas/marketing-context";
import { buildMarketingDefaults } from "@/lib/marketing-defaults";

export const runtime = "nodejs";

type TableName = "report_texts" | "partner_local_site_texts" | "partner_marketing_texts";

type PartnerArea = {
  id?: string;
  name?: string;
  slug?: string;
  parent_slug?: string;
  bundesland_slug?: string;
};

type PartnerAreaConfig = {
  area_id: string;
  areas?: PartnerArea;
};

type TextEntry = {
  section_key: string;
  optimized_content?: string | null;
  status?: string | null;
  text_type?: string | null;
  last_updated?: string | null;
};

type TextTree = Record<string, Record<string, string>>;

type TextAreaData = {
  baseTexts: { text: TextTree };
  standardTexts: { text: TextTree };
  dbTexts: TextEntry[];
};

const SUPABASE_PUBLIC_BASE_URL = process.env.SUPABASE_PUBLIC_BASE_URL ?? "";
const SUPABASE_BUCKET = "immobilienmarkt";
const STANDARD_PATH = ["text-standards", "kreis", "text_standard_kreis.json"] as const;
const ALLOWED_TABLES = new Set<TableName>([
  "report_texts",
  "partner_local_site_texts",
  "partner_marketing_texts",
]);

function buildSupabaseUrl(pathParts: readonly string[]): string | null {
  if (!SUPABASE_PUBLIC_BASE_URL) return null;
  const base = SUPABASE_PUBLIC_BASE_URL.replace(/\/+$/, "");
  const rel = pathParts
    .map((part) => part.replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/");
  return `${base}/${SUPABASE_BUCKET}/${rel}`;
}

function asTextTree(value: unknown): TextTree | null {
  if (!value || typeof value !== "object") return null;
  const out: TextTree = {};
  for (const [groupKey, groupVal] of Object.entries(value as Record<string, unknown>)) {
    if (!groupVal || typeof groupVal !== "object") continue;
    const group: Record<string, string> = {};
    for (const [key, entryValue] of Object.entries(groupVal as Record<string, unknown>)) {
      if (typeof entryValue === "string") group[key] = entryValue;
    }
    if (Object.keys(group).length > 0) out[groupKey] = group;
  }
  return Object.keys(out).length > 0 ? out : null;
}

function normalizeArea(value: unknown): PartnerArea | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || typeof candidate !== "object") return undefined;
  const rec = candidate as Record<string, unknown>;
  return {
    id: typeof rec.id === "string" ? rec.id : undefined,
    name: typeof rec.name === "string" ? rec.name : undefined,
    slug: typeof rec.slug === "string" ? rec.slug : undefined,
    parent_slug: typeof rec.parent_slug === "string" ? rec.parent_slug : undefined,
    bundesland_slug: typeof rec.bundesland_slug === "string" ? rec.bundesland_slug : undefined,
  };
}

function normalizeAreaConfig(value: unknown): PartnerAreaConfig | null {
  if (!value || typeof value !== "object") return null;
  const rec = value as Record<string, unknown>;
  const areaId = typeof rec.area_id === "string" ? rec.area_id.trim() : "";
  if (!areaId) return null;
  return {
    area_id: areaId,
    areas: normalizeArea(rec.areas),
  };
}

function normalizeTextEntries(value: unknown): TextEntry[] {
  if (!Array.isArray(value)) return [];
  return value.reduce<TextEntry[]>((acc, row) => {
      if (!row || typeof row !== "object") return acc;
      const rec = row as Record<string, unknown>;
      const sectionKey = typeof rec.section_key === "string" ? rec.section_key.trim() : "";
      if (!sectionKey) return acc;
      acc.push({
        section_key: sectionKey,
        optimized_content: typeof rec.optimized_content === "string" ? rec.optimized_content : null,
        status: typeof rec.status === "string" ? rec.status : null,
        text_type: typeof rec.text_type === "string" ? rec.text_type : null,
        last_updated: typeof rec.last_updated === "string" ? rec.last_updated : null,
      } satisfies TextEntry);
      return acc;
    }, []);
}

async function requirePartnerUser(): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) throw new Error("UNAUTHORIZED");
  return user.id;
}

async function loadRootAreaConfig(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  rootAreaId: string,
): Promise<PartnerAreaConfig | null> {
  const { data, error } = await admin
    .from("partner_area_map")
    .select("area_id, areas(id, name, slug, parent_slug, bundesland_slug)")
    .eq("auth_user_id", userId)
    .eq("area_id", rootAreaId)
    .maybeSingle();
  if (error || !data) return null;
  return normalizeAreaConfig(data);
}

async function loadScopeAreaItems(
  admin: ReturnType<typeof createAdminClient>,
  rootConfig: PartnerAreaConfig,
): Promise<PartnerAreaConfig[]> {
  const rootAreaId = String(rootConfig.area_id ?? "").trim();
  if (!rootAreaId) return [];
  if (rootAreaId.split("-").length > 3) return [rootConfig];

  const bundeslandSlug = String(rootConfig.areas?.bundesland_slug ?? "").trim();
  const kreisSlug = String(rootConfig.areas?.slug ?? "").trim();
  if (!bundeslandSlug || !kreisSlug) return [rootConfig];

  const { data } = await admin
    .from("areas")
    .select("id, name, slug, parent_slug, bundesland_slug")
    .eq("bundesland_slug", bundeslandSlug)
    .eq("parent_slug", kreisSlug)
    .order("id", { ascending: true });

  const children = Array.isArray(data)
    ? data.reduce<PartnerAreaConfig[]>((acc, row) => {
        if (!row || typeof row !== "object") return acc;
        const rec = row as Record<string, unknown>;
        const areaId = typeof rec.id === "string" ? rec.id.trim() : "";
        if (!areaId) return acc;
        acc.push({
          area_id: areaId,
          areas: {
            name: typeof rec.name === "string" ? rec.name : undefined,
            slug: typeof rec.slug === "string" ? rec.slug : undefined,
            parent_slug: typeof rec.parent_slug === "string" ? rec.parent_slug : undefined,
            bundesland_slug: typeof rec.bundesland_slug === "string" ? rec.bundesland_slug : undefined,
          },
        });
        return acc;
      }, [])
    : [];

  return [rootConfig, ...children];
}

async function loadStandardTexts(scope: "kreis" | "ortslage"): Promise<{ text: TextTree }> {
  const url = buildSupabaseUrl(STANDARD_PATH);
  if (!url) return { text: {} };

  try {
    const res = await fetch(url);
    if (!res.ok) return { text: {} };
    const payload = await res.json() as {
      text?: unknown;
      kreisname?: { text?: unknown };
      ortslagenname?: { text?: unknown };
    };
    const normalized = asTextTree(payload?.text);
    const text =
      normalized ??
      (scope === "ortslage"
        ? asTextTree(payload?.ortslagenname?.text) ?? asTextTree(payload?.kreisname?.text)
        : asTextTree(payload?.kreisname?.text) ?? asTextTree(payload?.ortslagenname?.text));
    return { text: text ?? {} };
  } catch {
    return { text: {} };
  }
}

async function loadReportBaseTexts(areaConfig: PartnerAreaConfig): Promise<{ text: TextTree }> {
  const areaId = String(areaConfig.area_id ?? "").trim();
  if (!areaId) return { text: {} };
  const areaIsOrtslage = areaId.split("-").length > 3;
  const bundeslandSlug = String(areaConfig.areas?.bundesland_slug ?? "").trim();
  const kreisSlug = areaIsOrtslage
    ? String(areaConfig.areas?.parent_slug ?? "").trim()
    : String(areaConfig.areas?.slug ?? "").trim();
  const ortSlug = areaIsOrtslage ? String(areaConfig.areas?.slug ?? "").trim() : "";
  if (!bundeslandSlug || !kreisSlug) return { text: {} };

  const reportPath = ortSlug
    ? ["reports", "deutschland", bundeslandSlug, kreisSlug, `${ortSlug}.json`]
    : ["reports", "deutschland", bundeslandSlug, `${kreisSlug}.json`];

  const url = buildSupabaseUrl(reportPath);
  if (!url) return { text: {} };

  try {
    const res = await fetch(url);
    if (!res.ok) return { text: {} };
    const payload = await res.json() as { text?: unknown };
    return { text: asTextTree(payload?.text) ?? {} };
  } catch {
    return { text: {} };
  }
}

async function loadMarketingBaseTexts(
  admin: ReturnType<typeof createAdminClient>,
  areaId: string,
): Promise<{ text: TextTree }> {
  const context = await resolveMarketingContextForArea({ admin, areaId });
  if (!context) return { text: { marketing: {} } };
  return {
    text: {
      marketing: buildMarketingDefaults(context) as unknown as Record<string, string>,
    },
  };
}

async function loadDbTexts(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  tableName: TableName,
  areaId: string,
): Promise<TextEntry[]> {
  const { data, error } = await admin
    .from(tableName)
    .select("section_key, optimized_content, status, text_type, last_updated")
    .eq("partner_id", userId)
    .eq("area_id", areaId);

  if (error) {
    console.warn("[text-editor-bootstrap] db text load failed", {
      table: tableName,
      area_id: areaId,
      partner_id: userId,
      error: error.message,
    });
    return [];
  }

  return normalizeTextEntries(data);
}

async function loadAreaData(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  tableName: TableName,
  areaConfig: PartnerAreaConfig,
): Promise<TextAreaData> {
  const areaId = String(areaConfig.area_id ?? "").trim();
  const areaIsOrtslage = areaId.split("-").length > 3;
  const [baseTexts, standardTexts, dbTexts] = await Promise.all([
    tableName === "partner_marketing_texts"
      ? loadMarketingBaseTexts(admin, areaId)
      : loadReportBaseTexts(areaConfig),
    tableName === "partner_marketing_texts"
      ? Promise.resolve({ text: {} })
      : loadStandardTexts(areaIsOrtslage ? "ortslage" : "kreis"),
    loadDbTexts(admin, userId, tableName, areaId),
  ]);

  return { baseTexts, standardTexts, dbTexts };
}

export async function GET(req: Request) {
  try {
    const userId = await requirePartnerUser();
    const admin = createAdminClient();
    const url = new URL(req.url);
    const areaId = String(url.searchParams.get("area_id") ?? "").trim();
    const rootAreaId = String(url.searchParams.get("root_area_id") ?? areaId).trim();
    const tableName = String(url.searchParams.get("table") ?? "report_texts").trim() as TableName;

    if (!areaId || !rootAreaId) {
      return NextResponse.json({ error: "Missing area_id or root_area_id" }, { status: 400 });
    }
    if (!ALLOWED_TABLES.has(tableName)) {
      return NextResponse.json({ error: "Unsupported table" }, { status: 400 });
    }

    const rootConfig = await loadRootAreaConfig(admin, userId, rootAreaId);
    if (!rootConfig) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const scopeItems = await loadScopeAreaItems(admin, rootConfig);
    const requestedConfig = scopeItems.find((item) => item.area_id === areaId) ?? null;
    if (!requestedConfig) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [requestedData, rootData] = await Promise.all([
      loadAreaData(admin, userId, tableName, requestedConfig),
      areaId !== rootAreaId ? loadAreaData(admin, userId, tableName, rootConfig) : Promise.resolve(null),
    ]);

    return NextResponse.json({
      ok: true,
      table: tableName,
      area_id: areaId,
      root_area_id: rootAreaId,
      scope_items: scopeItems,
      requested_data: requestedData,
      root_data: rootData,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[text-editor-bootstrap] unexpected error", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
