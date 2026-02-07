import { NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";

const SUPABASE_BUCKET = "immobilienmarkt";

type PreviewRequest = {
  area_id?: string;
  scope?: "kreis" | "ortslage";
};

function num(value: any) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getLatestYear(rows: any[]) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  let latest: number | null = null;
  for (const row of rows) {
    const year = typeof row?.jahr === "number" ? row.jahr : null;
    if (year === null) continue;
    if (latest === null || year > latest) latest = year;
  }
  return latest;
}

function getYearValue(rows: any[], year: number | null, key: string) {
  if (!Array.isArray(rows) || year === null) return null;
  for (const row of rows) {
    if (row?.jahr === year && typeof row?.[key] === "number") {
      return row[key];
    }
  }
  return null;
}

function buildYearMap(rows: any[], key: string, baseValue: number | null) {
  const latest = getLatestYear(rows);
  const result: Record<string, number | null> = {};
  for (let offset = 0; offset <= 5; offset += 1) {
    const year = latest === null ? null : latest - offset;
    const value = offset === 0 && baseValue !== null
      ? baseValue
      : getYearValue(rows, year, key);
    result[`f0${offset + 1}`] = value;
  }
  return result;
}

export async function POST(req: Request) {
  let payload: PreviewRequest = {};
  try {
    payload = (await req.json()) as PreviewRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const areaId = String(payload.area_id ?? "").trim();
  const scope = payload.scope === "ortslage" ? "ortslage" : "kreis";
  if (!areaId) return NextResponse.json({ error: "Missing area_id." }, { status: 400 });

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: hasAccess, error: accessError } = await supabase
    .from("partner_area_map")
    .select("id")
    .eq("auth_user_id", user.id)
    .eq("area_id", areaId)
    .maybeSingle();
  if (accessError) return NextResponse.json({ error: accessError.message }, { status: 500 });
  if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const { data: area, error: areaError } = await admin
    .from("areas")
    .select("id, slug, parent_slug, bundesland_slug")
    .eq("id", areaId)
    .maybeSingle();
  if (areaError || !area) {
    return NextResponse.json({ error: areaError?.message ?? "Area not found." }, { status: 404 });
  }

  const reportPath =
    scope === "ortslage"
      ? ["reports", "deutschland", area.bundesland_slug, area.parent_slug, `${area.slug}.json`].join("/")
      : ["reports", "deutschland", area.bundesland_slug, `${area.slug}.json`].join("/");

  const downloadRes = await admin.storage.from(SUPABASE_BUCKET).download(reportPath);
  if (downloadRes.error || !downloadRes.data) {
    return NextResponse.json(
      { error: downloadRes.error?.message ?? "Report not found." },
      { status: 404 },
    );
  }

  const raw = await downloadRes.data.text();
  const report = JSON.parse(raw);
  const data = report?.data ?? {};
  const meta = report?.meta ?? {};
  const base = (meta?.base_values && meta.base_values[scope]) || {};

  return NextResponse.json({
    immobilienmarkt_index: num(data?.immobilienmarkt_situation?.[0]?.immobilienmarkt_index),
    mietmarkt_index: num(data?.immobilienmarkt_situation?.[0]?.mietmarkt_index),
    haus_kaufpreis: buildYearMap(
      data?.haus_kaufpreisentwicklung ?? [],
      "preis_k",
      num(base?.haus_kaufpreis) ?? null,
    ),
    wohnung_kaufpreis: buildYearMap(
      data?.wohnung_kaufpreisentwicklung ?? [],
      "preis_k",
      num(base?.wohnung_kaufpreis) ?? null,
    ),
    grundstueck_kaufpreis: buildYearMap(
      data?.grundstueck_kaufpreisentwicklung ?? [],
      "kaufpreisentwicklung_grundstueck",
      num(base?.grundstueck_kaufpreis) ?? null,
    ),
    miete_haus_avg: buildYearMap(
      data?.mietpreisentwicklung_haus ?? [],
      "preis_k",
      num(base?.miete_haus_avg) ?? null,
    ),
    miete_wohnung_avg: buildYearMap(
      data?.mietpreisentwicklung_wohnung ?? [],
      "preis_k",
      num(base?.miete_wohnung_avg) ?? null,
    ),
  });
}
