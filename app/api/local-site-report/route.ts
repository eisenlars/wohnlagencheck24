import { NextResponse } from "next/server";

import { createAdminClient } from "@/utils/supabase/admin";
import { applyDataDrivenTexts } from "@/lib/text-core";

export const runtime = "nodejs";

const SUPABASE_PUBLIC_BASE_URL = process.env.SUPABASE_PUBLIC_BASE_URL ?? "";
const SUPABASE_BUCKET = "immobilienmarkt";

function buildSupabaseReportUrl(pathParts: string[]): string | null {
  if (!SUPABASE_PUBLIC_BASE_URL) return null;
  const base = SUPABASE_PUBLIC_BASE_URL.replace(/\/+$/, "");
  const rel = pathParts
    .map((part) => part.replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/");
  return `${base}/${SUPABASE_BUCKET}/${rel}`;
}

type OverrideRow = {
  optimized_content?: string | null;
  status?: string | null;
  last_updated?: string | null;
  text_type?: string | null;
};

type OverrideMap = Record<string, OverrideRow>;

function mergeTexts(
  baseTexts: Record<string, Record<string, string>>,
  overrides: OverrideMap,
) {
  const merged: Record<string, Record<string, string>> = {};
  const meta: Record<string, Record<string, string | null>> = {};

  Object.entries(baseTexts || {}).forEach(([groupKey, group]) => {
    merged[groupKey] = {};
    Object.entries(group || {}).forEach(([sectionKey, rawValue]) => {
      const override = overrides[sectionKey];
      const approved = override?.status === "approved";
      const value = approved && override?.optimized_content ? override.optimized_content : rawValue;
      merged[groupKey][sectionKey] = value;
      meta[sectionKey] = {
        status: override?.status ?? "raw",
        last_updated: override?.last_updated ?? null,
        text_type: override?.text_type ?? null,
        source: approved ? "override" : "raw",
      };
    });
  });

  Object.keys(overrides).forEach((sectionKey) => {
    if (!meta[sectionKey]) {
      const override = overrides[sectionKey];
      meta[sectionKey] = {
        status: override?.status ?? "raw",
        last_updated: override?.last_updated ?? null,
        text_type: override?.text_type ?? null,
        source: override?.status === "approved" ? "override" : "raw",
      };
    }
  });

  return { merged, meta };
}

function stripGroups(
  baseTexts: Record<string, Record<string, string>>,
  groupsToRemove: string[],
) {
  const cleaned: Record<string, Record<string, string>> = {};
  Object.entries(baseTexts || {}).forEach(([groupKey, group]) => {
    if (groupsToRemove.includes(groupKey)) return;
    cleaned[groupKey] = group;
  });
  return cleaned;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const bundesland = url.searchParams.get("bundesland") ?? "";
  const kreis = url.searchParams.get("kreis") ?? "";
  const ortslage = url.searchParams.get("ortslage");

  if (!token || !bundesland || !kreis) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: integration, error: integrationError } = await supabase
    .from("partner_integrations")
    .select("partner_id, auth_config")
    .eq("kind", "local_site")
    .eq("is_active", true)
    .contains("auth_config", { token })
    .maybeSingle();

  if (integrationError || !integration?.partner_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const areaQuery = supabase
    .from("areas")
    .select("id")
    .eq("bundesland_slug", bundesland);

  const { data: areaData } = ortslage
    ? await areaQuery
        .eq("slug", ortslage)
        .eq("parent_slug", kreis)
        .maybeSingle()
    : await areaQuery
        .eq("slug", kreis)
        .maybeSingle();

  const areaId = areaData?.id ?? null;
  if (!areaId) {
    return NextResponse.json({ error: "Area not found" }, { status: 404 });
  }

  const reportPath = ortslage
    ? ["reports", "deutschland", bundesland, kreis, `${ortslage}.json`]
    : ["reports", "deutschland", bundesland, `${kreis}.json`];

  const reportUrl = buildSupabaseReportUrl(reportPath);
  if (!reportUrl) {
    return NextResponse.json({ error: "SUPABASE_PUBLIC_BASE_URL fehlt" }, { status: 500 });
  }

  const reportRes = await fetch(reportUrl);
  if (!reportRes.ok) {
    return NextResponse.json({ error: "Report nicht gefunden" }, { status: 404 });
  }
  let reportJson = await reportRes.json();
  reportJson = applyDataDrivenTexts(reportJson, areaId);
  const baseTextsRaw = (reportJson?.text ?? {}) as Record<string, Record<string, string>>;
  const baseTexts = stripGroups(baseTextsRaw, ["berater", "makler"]);

  const { data: overrides } = await supabase
    .from("partner_local_site_texts")
    .select("section_key, optimized_content, status, text_type, last_updated")
    .eq("partner_id", integration.partner_id)
    .eq("area_id", areaId);

  const allowedKeys = new Set(
    Object.values(baseTexts).flatMap((group) => Object.keys(group || {})),
  );
  const overridesMap = (overrides ?? []).reduce<OverrideMap>((acc, row) => {
    const key = String(row.section_key);
    if (allowedKeys.has(key)) {
      acc[key] = row as OverrideRow;
    }
    return acc;
  }, {});

  const { merged } = mergeTexts(baseTexts, overridesMap);

  return NextResponse.json({
    ...reportJson,
    text: merged,
    local_site: {
      partner_id: integration.partner_id,
      area_id: areaId,
      generated_at: new Date().toISOString(),
    },
  });
}
