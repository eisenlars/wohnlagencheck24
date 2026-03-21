import { NextResponse } from "next/server";

import { syncPortalCmsPageFromSourceLocale, type PortalCmsSyncMode } from "@/lib/portal-cms-sync";
import { requireAdmin } from "@/lib/security/admin-auth";
import { checkAdminApiRateLimit } from "@/lib/security/rate-limit";
import { createAdminClient } from "@/utils/supabase/admin";

type Body = {
  page_key?: unknown;
  source_locale?: unknown;
  target_locale?: unknown;
  mode?: unknown;
  target_entries?: Array<{
    section_key?: unknown;
    status?: unknown;
    fields_json?: unknown;
  }>;
};

function asText(value: unknown): string {
  return String(value ?? "").trim();
}

function sanitizeFields(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>((acc, [key, fieldValue]) => {
    acc[String(key)] = String(fieldValue ?? "");
    return acc;
  }, {});
}

function normalizeMode(value: unknown): PortalCmsSyncMode {
  return asText(value).toLowerCase() === "fill_missing" ? "fill_missing" : "copy_all";
}

export async function POST(req: Request) {
  try {
    const adminUser = await requireAdmin(["admin_super", "admin_ops"]);
    const limit = await checkAdminApiRateLimit(req, adminUser.userId);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } });
    }

    const body = await req.json() as Body;
    const admin = createAdminClient();
    const result = await syncPortalCmsPageFromSourceLocale({
      admin,
      pageKey: asText(body.page_key),
      sourceLocale: asText(body.source_locale || "de"),
      targetLocale: asText(body.target_locale),
      mode: normalizeMode(body.mode),
      targetOverrides: (body.target_entries ?? []).map((entry) => ({
        section_key: asText(entry.section_key),
        status: asText(entry.status || "draft") as "draft" | "internal" | "live",
        fields_json: sanitizeFields(entry.fields_json),
      })),
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
