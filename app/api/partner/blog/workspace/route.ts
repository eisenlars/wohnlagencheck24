import { NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { checkRateLimitPersistent, extractClientIpFromHeaders } from "@/lib/security/rate-limit";

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

async function requirePartnerUser(req: Request): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) throw new Error("UNAUTHORIZED");

  const ip = extractClientIpFromHeaders(req.headers);
  const limit = await checkRateLimitPersistent(
    `partner_blog_workspace:${user.id}:${ip}`,
    { windowMs: 60 * 1000, max: 60 },
  );
  if (!limit.allowed) throw new Error(`RATE_LIMIT:${limit.retryAfterSec}`);

  return user.id;
}

async function loadReportAuthorName(bundeslandSlug: string, kreisSlug: string): Promise<string> {
  const bundesland = bundeslandSlug.trim();
  const kreis = kreisSlug.trim();
  if (!bundesland || !kreis) return "";

  const url = buildSupabaseReportUrl(["reports", "deutschland", bundesland, `${kreis}.json`]);
  if (!url) return "";

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return "";

  const jsonData = await res.json().catch(() => null) as { text?: { berater?: { berater_name?: string } } } | null;
  return String(jsonData?.text?.berater?.berater_name ?? "").trim();
}

export async function GET(req: Request) {
  try {
    const userId = await requirePartnerUser(req);
    const { searchParams } = new URL(req.url);
    const areaId = String(searchParams.get("area_id") ?? "").trim();
    const bundeslandSlug = String(searchParams.get("bundesland_slug") ?? "").trim();
    const kreisSlug = String(searchParams.get("kreis_slug") ?? "").trim();

    if (!areaId) {
      return NextResponse.json({ error: "Missing area_id" }, { status: 400 });
    }

    const admin = createAdminClient();

    const [authorName, sourceRes, postsRes] = await Promise.all([
      loadReportAuthorName(bundeslandSlug, kreisSlug),
      admin
        .from("report_texts")
        .select("section_key, optimized_content")
        .eq("area_id", areaId)
        .eq("partner_id", userId)
        .in("section_key", [
          "immobilienmarkt_individuell_01",
          "immobilienmarkt_individuell_02",
          "immobilienmarkt_zitat",
        ]),
      admin
        .from("partner_blog_posts")
        .select("id, headline, subline, body_md, status, created_at")
        .eq("partner_id", userId)
        .eq("area_id", areaId)
        .order("created_at", { ascending: false }),
    ]);

    if (sourceRes.error) {
      return NextResponse.json({ error: sourceRes.error.message }, { status: 500 });
    }
    if (postsRes.error) {
      return NextResponse.json({ error: postsRes.error.message }, { status: 500 });
    }

    const source = {
      individual01: "",
      individual02: "",
      zitat: "",
    };
    for (const entry of sourceRes.data ?? []) {
      const key = String(entry.section_key ?? "").trim();
      const value = typeof entry.optimized_content === "string" ? entry.optimized_content.trim() : "";
      if (!value) continue;
      if (key === "immobilienmarkt_individuell_01") source.individual01 = value;
      if (key === "immobilienmarkt_individuell_02") source.individual02 = value;
      if (key === "immobilienmarkt_zitat") source.zitat = value;
    }

    return NextResponse.json({
      ok: true,
      author_name: authorName,
      source,
      posts: postsRes.data ?? [],
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (error.message.startsWith("RATE_LIMIT:")) {
        const sec = Number(error.message.split(":")[1] ?? "60");
        return NextResponse.json(
          { error: "Too many requests" },
          { status: 429, headers: { "Retry-After": String(sec) } },
        );
      }
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
