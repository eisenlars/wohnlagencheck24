import { INDIVIDUAL_MANDATORY_KEYS } from "@/lib/text-key-registry";
import {
  MANDATORY_MEDIA_KEYS,
  looksLikePlaceholderMediaUrl,
  type MandatoryMediaKey,
} from "@/lib/mandatory-media";

const SUPABASE_PUBLIC_BASE_URL = process.env.SUPABASE_PUBLIC_BASE_URL ?? "";
const SUPABASE_BUCKET = "immobilienmarkt";

type ReportTextTree = Record<string, Record<string, string>>;

type StandardPayload = {
  text?: ReportTextTree;
  kreisname?: { text?: ReportTextTree };
  ortslagenname?: { text?: ReportTextTree };
};

export type MissingMandatoryKey = {
  key: string;
  reason: "missing" | "default" | "unapproved";
};

export type MandatoryScope = "kreis" | "ortslage";

export type MandatoryCheckResult =
  | {
      ok: true;
      scope: MandatoryScope;
      missing: MissingMandatoryKey[];
    }
  | {
      ok: false;
      status: number;
      error: string;
      scope?: MandatoryScope;
      missing?: MissingMandatoryKey[];
    };

function buildSupabaseUrl(pathParts: string[]): string | null {
  if (!SUPABASE_PUBLIC_BASE_URL) return null;
  const base = SUPABASE_PUBLIC_BASE_URL.replace(/\/+$/, "");
  const rel = pathParts
    .map((part) => part.replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/");
  return `${base}/${SUPABASE_BUCKET}/${rel}`;
}

function normalizeText(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function findTextByKey(textTree: ReportTextTree | null | undefined, key: string): string {
  if (!textTree || typeof textTree !== "object") return "";
  for (const group of Object.values(textTree)) {
    if (!group || typeof group !== "object") continue;
    const val = group[key];
    if (typeof val === "string") return val;
  }
  return "";
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url);
  if (!res.ok) return null;
  return (await res.json()) as T;
}

function resolveStandardTree(payload: StandardPayload | null, scope: MandatoryScope): ReportTextTree {
  if (!payload) return {};
  if (payload.text && typeof payload.text === "object") {
    return payload.text;
  }
  if (scope === "ortslage") {
    return payload.ortslagenname?.text ?? payload.kreisname?.text ?? {};
  }
  return payload.kreisname?.text ?? payload.ortslagenname?.text ?? {};
}

export async function checkPartnerAreaMandatoryTexts(args: {
  admin: unknown;
  partnerId: string;
  areaId: string;
  requireApprovedMedia?: boolean;
}): Promise<MandatoryCheckResult> {
  const { admin, partnerId, areaId, requireApprovedMedia = false } = args;
  type QueryError = { message?: string } | null | undefined;
  type QueryResponse = {
    data?: Array<Record<string, unknown>> | null;
    error?: QueryError;
  };
  type AdminQuery = Promise<QueryResponse> & {
    eq: (column: string, value: unknown) => AdminQuery;
    maybeSingle: () => Promise<{ data?: Record<string, unknown> | null; error?: QueryError }>;
  };
  const adminClient = admin as {
    from: (table: string) => {
      select: (columns: string) => AdminQuery;
    };
  };
  const { data: areaRecord } = await adminClient
    .from("areas")
    .select("id, slug, parent_slug, bundesland_slug")
    .eq("id", areaId)
    .maybeSingle();
  const area = (areaRecord ?? null) as {
    slug?: string;
    parent_slug?: string | null;
    bundesland_slug?: string;
  } | null;

  if (!area) {
    return { ok: false, status: 404, error: "Area not found" };
  }

  const isOrtslage = Boolean(area.parent_slug);
  const scope: MandatoryScope = isOrtslage ? "ortslage" : "kreis";
  const requiredKeys = Array.from(new Set([...INDIVIDUAL_MANDATORY_KEYS]));
  const mediaKeys = new Set<string>(MANDATORY_MEDIA_KEYS);
  const textRequiredKeys = requiredKeys.filter((key) => !mediaKeys.has(key));

  const { data: overridesData } = await adminClient
    .from("report_texts")
    .select("section_key, optimized_content, status")
    .eq("partner_id", partnerId)
    .eq("area_id", areaId)
    .eq("status", "approved");
  const overrides = (overridesData ?? []) as Array<{
    section_key?: string | null;
    optimized_content?: string | null;
  }>;

  const overrideMap = new Map<string, string>();
  for (const row of overrides ?? []) {
    const key = String(row.section_key ?? "");
    const text = String(row.optimized_content ?? "");
    if (key) overrideMap.set(key, text);
  }

  const { data: mediaRowsData } = await adminClient
    .from("report_texts")
    .select("section_key, optimized_content, status")
    .eq("partner_id", partnerId)
    .eq("area_id", areaId);
  const mediaRows = (mediaRowsData ?? []) as Array<{
    section_key?: string | null;
    optimized_content?: string | null;
    status?: string | null;
  }>;
  const mediaMap = new Map<MandatoryMediaKey, { url: string; status: string }>();
  for (const row of mediaRows ?? []) {
    const key = String(row.section_key ?? "").trim();
    if (!mediaKeys.has(key)) continue;
    mediaMap.set(key as MandatoryMediaKey, {
      url: String(row.optimized_content ?? "").trim(),
      status: String(row.status ?? "").trim().toLowerCase(),
    });
  }

  const reportPath = isOrtslage
    ? ["reports", "deutschland", String(area.bundesland_slug), String(area.parent_slug), `${String(area.slug)}.json`]
    : ["reports", "deutschland", String(area.bundesland_slug), `${String(area.slug)}.json`];
  const standardPath = ["text-standards", "kreis", "text_standard_kreis.json"];

  const reportUrl = buildSupabaseUrl(reportPath);
  const standardUrl = buildSupabaseUrl(standardPath);

  if (!reportUrl || !standardUrl) {
    return { ok: false, status: 500, error: "SUPABASE_PUBLIC_BASE_URL fehlt" };
  }

  const [reportJson, standardJson] = await Promise.all([
    fetchJson<{ text?: ReportTextTree }>(reportUrl),
    fetchJson<StandardPayload>(standardUrl),
  ]);

  if (!reportJson?.text || !standardJson) {
    const missingFromOverrides: MissingMandatoryKey[] = [];
    const missingFromMedia: MissingMandatoryKey[] = [];
    for (const mediaKey of MANDATORY_MEDIA_KEYS) {
      const media = mediaMap.get(mediaKey);
      const url = String(media?.url ?? "").trim();
      if (!url || looksLikePlaceholderMediaUrl(url)) {
        missingFromMedia.push({ key: mediaKey, reason: "missing" });
        continue;
      }
      if (requireApprovedMedia && media?.status !== "approved") {
        missingFromMedia.push({ key: mediaKey, reason: "unapproved" });
      }
    }

    for (const key of textRequiredKeys) {
      const effective = normalizeText(overrideMap.get(key) ?? "");
      if (!effective) {
        missingFromOverrides.push({ key, reason: "missing" });
      }
    }
    const combinedMissing = [...missingFromOverrides, ...missingFromMedia];
    if (combinedMissing.length > 0) {
      return {
        ok: false,
        status: 409,
        error: "Mandatory Pflichtangaben unvollstaendig oder noch auf Standard.",
        scope,
        missing: combinedMissing,
      };
    }
    return { ok: true, scope, missing: [] };
  }

  const standardTree = resolveStandardTree(standardJson, scope);

  const missing: MissingMandatoryKey[] = [];
  for (const key of textRequiredKeys) {
    const reportText = findTextByKey(reportJson.text, key);
    const standard = normalizeText(findTextByKey(standardTree, key));
    if (!normalizeText(reportText) && !standard) {
      continue;
    }
    const effective = normalizeText(overrideMap.get(key) ?? reportText);
    if (!effective) {
      missing.push({ key, reason: "missing" });
      continue;
    }
    if (standard && effective === standard) {
      missing.push({ key, reason: "default" });
    }
  }

  for (const mediaKey of MANDATORY_MEDIA_KEYS) {
    const media = mediaMap.get(mediaKey);
    const url = String(media?.url ?? "").trim();
    if (!url || looksLikePlaceholderMediaUrl(url)) {
      missing.push({ key: mediaKey, reason: "missing" });
      continue;
    }
    if (requireApprovedMedia && media?.status !== "approved") {
      missing.push({ key: mediaKey, reason: "unapproved" });
    }
  }

  if (missing.length > 0) {
    return {
      ok: false,
      status: 409,
      error: "Mandatory Pflichtangaben unvollstaendig oder noch auf Standard.",
      scope,
      missing,
    };
  }

  return { ok: true, scope, missing: [] };
}
