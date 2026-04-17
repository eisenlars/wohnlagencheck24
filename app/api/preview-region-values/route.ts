import { NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";

const SUPABASE_BUCKET = "immobilienmarkt";

type PreviewRequest = {
  area_id?: string;
  scope?: "kreis" | "ortslage";
};

type DataRow = { jahr?: number; [key: string]: unknown };
type PreviewFactorValues = {
  f01_min: number | null;
  f01_avg: number | null;
  f01_max: number | null;
  f02: number | null;
  f03: number | null;
  f04: number | null;
  f05: number | null;
  f06: number | null;
};

function num(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getLatestYear(rows: DataRow[]) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  let latest: number | null = null;
  for (const row of rows) {
    const year = typeof row?.jahr === "number" ? row.jahr : null;
    if (year === null) continue;
    if (latest === null || year > latest) latest = year;
  }
  return latest;
}

function getYearValue(rows: DataRow[], year: number | null, key: string) {
  if (!Array.isArray(rows) || year === null) return null;
  for (const row of rows) {
    if (row?.jahr === year && typeof row?.[key] === "number") {
      return row[key] as number;
    }
  }
  return null;
}

function buildFactorPreview(
  rows: DataRow[],
  key: string,
  currentValues: { min: number | null; avg: number | null; max: number | null },
): PreviewFactorValues {
  const latest = getLatestYear(rows);
  const result: PreviewFactorValues = {
    f01_min: currentValues.min,
    f01_avg: currentValues.avg,
    f01_max: currentValues.max,
    f02: null,
    f03: null,
    f04: null,
    f05: null,
    f06: null,
  };
  for (let offset = 1; offset <= 5; offset += 1) {
    const year = latest === null ? null : latest - offset;
    const value = getYearValue(rows, year, key);
    result[`f0${offset + 1}` as keyof PreviewFactorValues] = value;
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
  const hausSpan = data?.haus_kaufpreisspanne?.[0] ?? {};
  const wohnungSpan = data?.wohnung_kaufpreisspanne?.[0] ?? {};
  const grundstueckSpan = data?.grundstueck_kaufpreisspanne?.[0] ?? {};
  const hausMiete = data?.mietpreise_haus_gesamt?.[0] ?? {};
  const wohnungMiete = data?.mietpreise_wohnung_gesamt?.[0] ?? {};

  return NextResponse.json({
    immobilienmarkt_index: num(data?.immobilienmarkt_situation?.[0]?.immobilienmarkt_index),
    mietmarkt_index: num(data?.immobilienmarkt_situation?.[0]?.mietmarkt_index),
    haus_kaufpreis: buildFactorPreview(
      data?.haus_kaufpreisentwicklung ?? [],
      "preis_k",
      {
        min: num(base?.haus_kaufpreis_min) ?? num(hausSpan?.preis_haus_min),
        avg: num(base?.haus_kaufpreis_avg) ?? num(base?.haus_kaufpreis) ?? num(hausSpan?.preis_haus_avg),
        max: num(base?.haus_kaufpreis_max) ?? num(hausSpan?.preis_haus_max),
      },
    ),
    wohnung_kaufpreis: buildFactorPreview(
      data?.wohnung_kaufpreisentwicklung ?? [],
      "preis_k",
      {
        min: num(base?.wohnung_kaufpreis_min) ?? num(wohnungSpan?.preis_wohnung_min),
        avg: num(base?.wohnung_kaufpreis_avg) ?? num(base?.wohnung_kaufpreis) ?? num(wohnungSpan?.preis_wohnung_avg),
        max: num(base?.wohnung_kaufpreis_max) ?? num(wohnungSpan?.preis_wohnung_max),
      },
    ),
    grundstueck_kaufpreis: buildFactorPreview(
      data?.grundstueck_kaufpreisentwicklung ?? [],
      "kaufpreisentwicklung_grundstueck",
      {
        min: num(base?.grundstueck_kaufpreis_min) ?? num(grundstueckSpan?.preis_grundstueck_min),
        avg: num(base?.grundstueck_kaufpreis_avg) ?? num(base?.grundstueck_kaufpreis) ?? num(grundstueckSpan?.preis_grundstueck_avg),
        max: num(base?.grundstueck_kaufpreis_max) ?? num(grundstueckSpan?.preis_grundstueck_max),
      },
    ),
    miete_haus: buildFactorPreview(
      data?.mietpreisentwicklung_haus ?? [],
      "preis_k",
      {
        min: num(base?.miete_haus_min) ?? num(hausMiete?.preis_haus_min),
        avg: num(base?.miete_haus_avg) ?? num(hausMiete?.preis_haus_avg),
        max: num(base?.miete_haus_max) ?? num(hausMiete?.preis_haus_max),
      },
    ),
    miete_wohnung: buildFactorPreview(
      data?.mietpreisentwicklung_wohnung ?? [],
      "preis_k",
      {
        min: num(base?.miete_wohnung_min) ?? num(wohnungMiete?.preis_wohnung_min),
        avg: num(base?.miete_wohnung_avg) ?? num(wohnungMiete?.preis_wohnung_avg),
        max: num(base?.miete_wohnung_max) ?? num(wohnungMiete?.preis_wohnung_max),
      },
    ),
  });
}
