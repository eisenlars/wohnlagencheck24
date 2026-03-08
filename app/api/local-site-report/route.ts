import { NextResponse } from "next/server";

import { createAdminClient } from "@/utils/supabase/admin";
import { applyDataDrivenTexts } from "@/lib/text-core";
import { getOrteForKreis } from "@/lib/data";
import {
  loadTextSourcesByAreaIds,
  mergeTextsWithPriority,
  type LocalSiteTextMergeClient,
} from "@/lib/local-site-text-merge";
import {
  extractLocalSiteToken,
  loadLocalSiteIntegrationByToken,
  type LocalSiteIntegrationLookupClient,
} from "@/lib/security/local-site-auth";
import { checkRateLimitPersistent, extractClientIpFromHeaders } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const SUPABASE_PUBLIC_BASE_URL = process.env.SUPABASE_PUBLIC_BASE_URL ?? "";
const SUPABASE_BUCKET = "immobilienmarkt";
const LOCAL_SITE_REPORT_RATE_LIMIT = { windowMs: 60_000, max: 120 };

function buildSupabaseReportUrl(pathParts: string[]): string | null {
  if (!SUPABASE_PUBLIC_BASE_URL) return null;
  const base = SUPABASE_PUBLIC_BASE_URL.replace(/\/+$/, "");
  const rel = pathParts
    .map((part) => part.replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/");
  return `${base}/${SUPABASE_BUCKET}/${rel}`;
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
  const ip = extractClientIpFromHeaders(req.headers);
  const rateLimit = await checkRateLimitPersistent(
    `local_site_report:${ip}`,
    LOCAL_SITE_REPORT_RATE_LIMIT,
  );
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } },
    );
  }

  const url = new URL(req.url);
  const token = extractLocalSiteToken(req);
  const bundesland = url.searchParams.get("bundesland") ?? "";
  const kreis = url.searchParams.get("kreis") ?? "";
  const ortslage = url.searchParams.get("ortslage");

  if (!token || !bundesland || !kreis) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const integration = await loadLocalSiteIntegrationByToken(supabase as unknown as LocalSiteIntegrationLookupClient, token);
  if (!integration?.partner_id) {
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

  let { data: accessMapping } = await supabase
    .from("partner_area_map")
    .select("id")
    .eq("auth_user_id", integration.partner_id)
    .eq("area_id", areaId)
    .eq("is_active", true)
    .maybeSingle();

  if (!accessMapping && ortslage) {
    const { data: parentKreis } = await supabase
      .from("areas")
      .select("id")
      .eq("bundesland_slug", bundesland)
      .eq("slug", kreis)
      .eq("parent_slug", bundesland)
      .maybeSingle();
    if (parentKreis?.id) {
      const parentAccess = await supabase
        .from("partner_area_map")
        .select("id")
        .eq("auth_user_id", integration.partner_id)
        .eq("area_id", parentKreis.id)
        .eq("is_active", true)
        .maybeSingle();
      accessMapping = parentAccess.data ?? null;
    }
  }

  if (!accessMapping) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
  let ortslageNameMap: Record<string, string> | undefined = undefined;
  if (!ortslage) {
    const orte = await getOrteForKreis(bundesland, kreis);
    ortslageNameMap = Object.fromEntries(orte.map((o) => [o.slug, o.name]));
  }
  reportJson = applyDataDrivenTexts(reportJson, areaId, ortslageNameMap);
  const baseTextsRaw = (reportJson?.text ?? {}) as Record<string, Record<string, string>>;
  const baseTexts = stripGroups(baseTextsRaw, ["berater", "makler"]);

  const { localByArea, reportByArea } = await loadTextSourcesByAreaIds(
    supabase as unknown as LocalSiteTextMergeClient,
    integration.partner_id,
    [areaId],
  );
  const { merged } = mergeTextsWithPriority(
    baseTexts,
    localByArea[areaId],
    reportByArea[areaId],
  );

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
