import { NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { checkRateLimitPersistent, extractClientIpFromHeaders } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const SUPABASE_BUCKET = "immobilienmarkt";

type AreaRow = {
  id?: string | null;
  name?: string | null;
  slug?: string | null;
  parent_slug?: string | null;
  bundesland_slug?: string | null;
};

type PartnerAreaMapRow = {
  area_id?: string | null;
  is_active?: boolean | null;
  areas?: AreaRow | null;
};

type PortalAboRow = {
  key: string;
  kreis_name: string;
  kreis_id: string;
  base_price_eur: number;
  ortslage_price_eur: number;
  ortslagen_count: number;
  ortslagen_total_price_eur: number;
  export_ortslagen_count: number;
  export_ortslagen_total_price_eur: number;
  total_price_eur: number;
};

type GlobalDefaultsRow = {
  portal_base_price_eur?: number | null;
  portal_ortslage_price_eur?: number | null;
  portal_export_ortslage_price_eur?: number | null;
};

type PartnerBillingSettingsRow = {
  portal_base_price_eur?: number | null;
  portal_ortslage_price_eur?: number | null;
  portal_export_ortslage_price_eur?: number | null;
};

function isMissingTable(error: unknown, table: string): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return msg.includes(`public.${table}`) && msg.includes("does not exist");
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isDistrictArea(areaId: string): boolean {
  return areaId.split("-").length <= 3;
}

function readPopulationFromReport(report: unknown): number | null {
  const candidate = (report as { data?: { wohnungsnachfrage_allgemein?: Array<{ anzahl_einwohner?: unknown }> } })
    ?.data
    ?.wohnungsnachfrage_allgemein?.[0]?.anzahl_einwohner;
  return asFiniteNumber(candidate);
}

async function requirePartnerUser(req: Request): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) throw new Error("UNAUTHORIZED");

  const ip = extractClientIpFromHeaders(req.headers);
  const limit = await checkRateLimitPersistent(
    `partner_portal_abo:${user.id}:${ip}`,
    { windowMs: 60 * 1000, max: 60 },
  );
  if (!limit.allowed) throw new Error(`RATE_LIMIT:${limit.retryAfterSec}`);
  return user.id;
}

async function loadDistrictPopulation(
  admin: ReturnType<typeof createAdminClient>,
  district: AreaRow,
): Promise<number | null> {
  const bundeslandSlug = String(district.bundesland_slug ?? "").trim();
  const districtSlug = String(district.slug ?? "").trim();
  if (!bundeslandSlug || !districtSlug) return null;

  const reportPath = ["reports", "deutschland", bundeslandSlug, `${districtSlug}.json`].join("/");
  const downloadRes = await admin.storage.from(SUPABASE_BUCKET).download(reportPath);
  if (downloadRes.error || !downloadRes.data) return null;

  try {
    const raw = await downloadRes.data.text();
    const parsed = JSON.parse(raw) as unknown;
    return readPopulationFromReport(parsed);
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  try {
    const userId = await requirePartnerUser(req);
    const admin = createAdminClient();

    const [{ data, error }, globalRes, partnerRes] = await Promise.all([
      admin
      .from("partner_area_map")
      .select("area_id, is_active, areas(id, name, slug, parent_slug, bundesland_slug)")
      .eq("auth_user_id", userId)
      .eq("is_active", true)
      .order("area_id", { ascending: true }),
      admin
        .from("billing_global_defaults")
        .select("portal_base_price_eur, portal_ortslage_price_eur, portal_export_ortslage_price_eur")
        .eq("id", 1)
        .maybeSingle(),
      admin
        .from("partner_billing_settings")
        .select("portal_base_price_eur, portal_ortslage_price_eur, portal_export_ortslage_price_eur")
        .eq("partner_id", userId)
        .maybeSingle(),
    ]);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (globalRes.error && !isMissingTable(globalRes.error, "billing_global_defaults")) {
      return NextResponse.json({ error: globalRes.error.message }, { status: 500 });
    }
    if (partnerRes.error && !isMissingTable(partnerRes.error, "partner_billing_settings")) {
      return NextResponse.json({ error: partnerRes.error.message }, { status: 500 });
    }

    const globalDefaults = (globalRes.data ?? {}) as GlobalDefaultsRow;
    const partnerOverrides = (partnerRes.data ?? {}) as PartnerBillingSettingsRow;

    const activeMappings = (data ?? []) as PartnerAreaMapRow[];
    const districtRows = activeMappings.filter((entry) => {
      const areaId = String(entry.area_id ?? "").trim();
      return areaId.length > 0 && isDistrictArea(areaId);
    });
    if (districtRows.length === 0) {
      return NextResponse.json({ ok: true, rows: [] });
    }

    const districtSlugs = districtRows
      .map((entry) => String(entry.areas?.slug ?? "").trim())
      .filter((slug) => slug.length > 0);
    const districtSlugSet = new Set(districtSlugs);

    const ortslageCountByDistrict = new Map<string, number>();
    if (districtSlugs.length > 0) {
      const { data: childAreas, error: childAreasError } = await admin
        .from("areas")
        .select("id, parent_slug")
        .in("parent_slug", districtSlugs);

      if (childAreasError) return NextResponse.json({ error: childAreasError.message }, { status: 500 });

      for (const row of (childAreas ?? []) as Array<{ parent_slug?: string | null }>) {
        const parentSlug = String(row.parent_slug ?? "").trim();
        if (!parentSlug || !districtSlugSet.has(parentSlug)) continue;
        ortslageCountByDistrict.set(parentSlug, (ortslageCountByDistrict.get(parentSlug) ?? 0) + 1);
      }
    }

    const rows = await Promise.all(
      districtRows.map(async (entry) => {
        const areaId = String(entry.area_id ?? "").trim();
        const area = entry.areas ?? {};
        const districtSlug = String(area.slug ?? "").trim();
        const districtName = String(area.name ?? areaId).trim() || areaId;
        const ortslagenCount = ortslageCountByDistrict.get(districtSlug) ?? 0;
        const population = await loadDistrictPopulation(admin, area);

        // Fallback to legacy heuristic when no admin defaults are configured yet.
        const isLargeDistrict = (population ?? 0) > 500000;
        const fallbackBase = isLargeDistrict ? 75 : 50;
        const fallbackOrtslage = isLargeDistrict ? 1.5 : 1;
        const fallbackExport = fallbackOrtslage;
        const basePrice = asFiniteNumber(partnerOverrides.portal_base_price_eur)
          ?? asFiniteNumber(globalDefaults.portal_base_price_eur)
          ?? fallbackBase;
        const ortslagePrice = asFiniteNumber(partnerOverrides.portal_ortslage_price_eur)
          ?? asFiniteNumber(globalDefaults.portal_ortslage_price_eur)
          ?? fallbackOrtslage;
        const exportOrtslagePrice = asFiniteNumber(partnerOverrides.portal_export_ortslage_price_eur)
          ?? asFiniteNumber(globalDefaults.portal_export_ortslage_price_eur)
          ?? fallbackExport;
        const exportCount = ortslagenCount;
        const ortslagenTotal = Number((ortslagenCount * ortslagePrice).toFixed(2));
        const exportOrtslagenTotal = Number((exportCount * exportOrtslagePrice).toFixed(2));
        const total = Number((basePrice + ortslagenTotal + exportOrtslagenTotal).toFixed(2));

        return {
          key: areaId,
          kreis_name: districtName,
          kreis_id: areaId,
          base_price_eur: basePrice,
          ortslage_price_eur: ortslagePrice,
          ortslagen_count: ortslagenCount,
          ortslagen_total_price_eur: ortslagenTotal,
          export_ortslagen_count: exportCount,
          export_ortslagen_total_price_eur: exportOrtslagenTotal,
          total_price_eur: total,
        } satisfies PortalAboRow;
      }),
    );

    rows.sort((a, b) => a.kreis_name.localeCompare(b.kreis_name, "de"));
    return NextResponse.json({ ok: true, rows });
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
