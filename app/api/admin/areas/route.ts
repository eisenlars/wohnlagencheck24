import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/security/admin-auth";
import { checkAdminApiRateLimit } from "@/lib/security/rate-limit";
import { createAdminClient } from "@/utils/supabase/admin";

export async function GET(req: Request) {
  try {
    const adminUser = await requireAdmin(["admin_super", "admin_ops"]);
    const adminRate = await checkAdminApiRateLimit(req, adminUser.userId);
    if (!adminRate.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(adminRate.retryAfterSec) } },
      );
    }

    const url = new URL(req.url);
    const q = String(url.searchParams.get("q") ?? "").trim().toLowerCase();
    const kreisId = String(url.searchParams.get("kreis_id") ?? "").trim();
    const limitRaw = Number(url.searchParams.get("limit") ?? 25);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), 100) : 25;

    const admin = createAdminClient();
    const { data: mappedRows, error: mappedError } = await admin
      .from("partner_area_map")
      .select("area_id");
    if (mappedError) return NextResponse.json({ error: mappedError.message }, { status: 500 });

    const blockedKreisIds = new Set(
      (mappedRows ?? [])
        .map((row) => String((row as { area_id?: string }).area_id ?? "").split("-").slice(0, 3).join("-"))
        .filter((id) => id.split("-").length === 3),
    );

    const query = admin
      .from("areas")
      .select("id, name, slug, parent_slug, bundesland_slug")
      .order("name", { ascending: true })
      .limit(1000);

    const { data, error } = await query;

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = (data ?? []) as Array<{
      id: string;
      name?: string | null;
      slug?: string | null;
      parent_slug?: string | null;
      bundesland_slug?: string | null;
    }>;

    if (kreisId) {
      const children = rows
        .filter((row) => {
          const id = String(row.id ?? "").trim();
          return id === kreisId || id.startsWith(`${kreisId}-`);
        })
        .sort((a, b) => {
          const aIsKreis = String(a.id ?? "").trim() === kreisId;
          const bIsKreis = String(b.id ?? "").trim() === kreisId;
          if (aIsKreis && !bIsKreis) return -1;
          if (!aIsKreis && bIsKreis) return 1;
          return String(a.name ?? "").localeCompare(String(b.name ?? ""), "de");
        })
        .slice(0, limit);
      return NextResponse.json({ ok: true, areas: children });
    }

    const normalized = q.toLowerCase();
    const looksLikeIdSearch = /^[0-9-]+$/.test(normalized);

    const filtered = rows
      .filter((row) => {
        const kreisId = String(row.id ?? "").split("-").slice(0, 3).join("-");
        if (kreisId.split("-").length !== 3) return false;
        return row.id === kreisId;
      })
      .filter((row) => {
        if (!normalized) return true;
        const id = String(row.id ?? "").toLowerCase();
        const name = String(row.name ?? "").toLowerCase();
        const slug = String(row.slug ?? "").toLowerCase();
        const parentSlug = String(row.parent_slug ?? "").toLowerCase();
        const bundeslandSlug = String(row.bundesland_slug ?? "").toLowerCase();
        if (looksLikeIdSearch) {
          return id.startsWith(normalized);
        }
        return (
          name.includes(normalized) ||
          id.includes(normalized) ||
          slug.includes(normalized) ||
          parentSlug.includes(normalized) ||
          bundeslandSlug.includes(normalized)
        );
      })
      .filter((row) => !blockedKreisIds.has(row.id))
      .slice(0, limit);

    return NextResponse.json({ ok: true, areas: filtered });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (error.message === "FORBIDDEN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
