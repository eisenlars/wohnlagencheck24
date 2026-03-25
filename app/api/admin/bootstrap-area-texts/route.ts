import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { timingSafeEqual } from "node:crypto";

import { createAdminClient } from "@/utils/supabase/admin";
import { requireAdmin } from "@/lib/security/admin-auth";
import { checkAdminApiRateLimit } from "@/lib/security/rate-limit";
import {
  bootstrapAreaReportText,
  fetchStandardPayload,
  refreshAreaReportTextFromStandard,
  refreshBundeslandReportTextFromStandard,
  type AreaRow,
  type BootstrapResult,
} from "@/lib/text-bootstrap";
import { reportScopeTagsFromReportPath } from "@/lib/cache-tags";

type Body = {
  area_id?: string;
  bundesland_slug?: string;
  include_ortslagen?: boolean;
  force?: boolean;
  dry_run?: boolean;
  mode?: "missing_only" | "all" | "standard_overwrite";
  limit?: number;
};

function normalize(value: unknown): string {
  return String(value ?? "").trim();
}

function constantTimeTokenEquals(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function isKreisArea(area: AreaRow): boolean {
  return String(area.parent_slug ?? "") === String(area.bundesland_slug ?? "");
}

function dedupeAreas(rows: AreaRow[]): AreaRow[] {
  const seen = new Set<string>();
  const out: AreaRow[] = [];
  for (const row of rows) {
    if (!row.id || seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
}

export async function POST(req: Request) {
  try {
    const tokenFromHeader = normalize(req.headers.get("x-area-bootstrap-token"));
    const providedToken = tokenFromHeader;
    const expectedToken = normalize(process.env.AREA_BOOTSTRAP_TOKEN);
    const tokenAuthOk =
      Boolean(expectedToken) &&
      Boolean(providedToken) &&
      constantTimeTokenEquals(providedToken, expectedToken);

    let actorUserId = "service:area_bootstrap";
    if (!tokenAuthOk) {
      const adminUser = await requireAdmin(["admin_super", "admin_ops"]);
      const adminRate = await checkAdminApiRateLimit(req, adminUser.userId);
      if (!adminRate.allowed) {
        return NextResponse.json(
          { error: "Too many requests" },
          { status: 429, headers: { "Retry-After": String(adminRate.retryAfterSec) } },
        );
      }
      actorUserId = adminUser.userId;
    }

    const body = (await req.json().catch(() => ({}))) as Body;
    const requestedAreaId = normalize(body.area_id);
    const requestedBundeslandSlug = normalize(body.bundesland_slug).toLowerCase();
    const includeOrtslagen = body.include_ortslagen !== false;
    const force = body.force === true;
    const dryRun = body.dry_run === true;
    const mode = body.mode === "all"
      ? "all"
      : body.mode === "standard_overwrite"
        ? "standard_overwrite"
        : "missing_only";
    const limit = typeof body.limit === "number" && Number.isFinite(body.limit) && body.limit > 0
      ? Math.floor(body.limit)
      : null;

    const admin = createAdminClient();
    const { data: allAreasRaw, error: areasError } = await admin
      .from("areas")
      .select("id, slug, name, parent_slug, bundesland_slug")
      .order("id", { ascending: true });
    if (areasError) {
      return NextResponse.json({ error: areasError.message }, { status: 500 });
    }

    const allAreas = ((allAreasRaw ?? []) as Array<{
      id?: string | null;
      slug?: string | null;
      name?: string | null;
      parent_slug?: string | null;
      bundesland_slug?: string | null;
    }>)
      .map((row) => ({
        id: String(row.id ?? "").trim(),
        slug: String(row.slug ?? "").trim(),
        name: row.name ? String(row.name) : null,
        parent_slug: row.parent_slug ? String(row.parent_slug) : null,
        bundesland_slug: String(row.bundesland_slug ?? "").trim(),
      }))
      .filter((row) => row.id && row.slug && row.bundesland_slug);

    if (allAreas.length === 0) {
      return NextResponse.json({ ok: true, actor: actorUserId, processed: 0, results: [] });
    }

    let targetAreas: AreaRow[] = [];
    const bundeslandSlugs = Array.from(new Set(allAreas.map((area) => area.bundesland_slug).filter(Boolean))).sort();
    let targetBundeslaender: string[] = [];
    if (mode === "standard_overwrite") {
      targetBundeslaender = requestedBundeslandSlug
        ? bundeslandSlugs.filter((slug) => slug === requestedBundeslandSlug)
        : bundeslandSlugs;
      if (requestedBundeslandSlug && targetBundeslaender.length === 0) {
        return NextResponse.json({ error: "Bundesland not found" }, { status: 404 });
      }
    }

    if (mode === "standard_overwrite" && requestedBundeslandSlug && !requestedAreaId) {
      targetAreas = [];
    } else if (requestedAreaId) {
      const rootArea = allAreas.find((area) => area.id === requestedAreaId);
      if (!rootArea) {
        return NextResponse.json({ error: "Area not found" }, { status: 404 });
      }
      targetAreas.push(rootArea);
      if (includeOrtslagen && isKreisArea(rootArea)) {
        const children = allAreas.filter(
          (area) =>
            area.bundesland_slug === rootArea.bundesland_slug &&
            String(area.parent_slug ?? "") === rootArea.slug,
        );
        targetAreas = targetAreas.concat(children);
      }
    } else {
      targetAreas = includeOrtslagen ? allAreas : allAreas.filter((area) => isKreisArea(area));
    }

    targetAreas = dedupeAreas(targetAreas);
    if (limit) targetAreas = targetAreas.slice(0, limit);

    const results: BootstrapResult[] = [];
    if (mode === "standard_overwrite") {
      const areaStandardPayload = await fetchStandardPayload(admin as never, "area");
      if (!areaStandardPayload) {
        return NextResponse.json(
          { error: "Standard text payload not found at text-standards/kreis/text_standard_kreis.json" },
          { status: 500 },
        );
      }
      const bundeslandStandardPayload = await fetchStandardPayload(admin as never, "bundesland");
      if (!bundeslandStandardPayload) {
        return NextResponse.json(
          { error: "Standard text payload not found at text-standards/bundesland/text_standard_bundesland.json" },
          { status: 500 },
        );
      }

      for (const bundeslandSlug of targetBundeslaender) {
        const result = await refreshBundeslandReportTextFromStandard({
          admin: admin as never,
          bundeslandSlug,
          standardPayload: bundeslandStandardPayload,
          dryRun,
        });
        results.push(result);
      }

      for (const area of targetAreas) {
        const result = await refreshAreaReportTextFromStandard({
          admin: admin as never,
          area,
          standardPayload: areaStandardPayload,
          dryRun,
        });
        results.push(result);
      }
    } else {
      const standardPayload = await fetchStandardPayload(admin as never, "area");
      if (!standardPayload) {
        return NextResponse.json(
          { error: "Standard text payload not found at text-standards/kreis/text_standard_kreis.json" },
          { status: 500 },
        );
      }

      for (const area of targetAreas) {
        const result = await bootstrapAreaReportText({
          admin: admin as never,
          area,
          allAreas,
          standardPayload,
          force: mode === "all" ? true : force,
          dryRun,
        });
        results.push(result);
      }
    }

    const updated = results.filter((row) => row.status === "updated");
    const skipped = results.filter((row) => row.status === "skipped");
    const failed = results.filter((row) => row.status === "error");

    if (!dryRun && updated.length > 0) {
      const reportTags = new Set<string>();
      for (const row of updated) {
        for (const tag of reportScopeTagsFromReportPath(row.report_path)) {
          reportTags.add(tag);
        }
      }
      for (const tag of reportTags) {
        revalidateTag(tag, "max");
      }
    }

    return NextResponse.json({
      ok: failed.length === 0,
      actor: actorUserId,
      mode,
      force: mode === "all" ? true : force,
      dry_run: dryRun,
      requested_area_id: requestedAreaId || null,
      requested_bundesland_slug: requestedBundeslandSlug || null,
      include_ortslagen: includeOrtslagen,
      total: results.length,
      updated: updated.length,
      skipped: skipped.length,
      failed: failed.length,
      results,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (error.message === "FORBIDDEN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
