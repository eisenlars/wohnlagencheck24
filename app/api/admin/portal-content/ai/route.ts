import { NextResponse } from "next/server";

import { translatePortalCmsSectionFromSourceLocale, type PortalCmsAiApplyMode } from "@/lib/portal-cms-sync";
import { requireAdmin } from "@/lib/security/admin-auth";
import { checkAdminApiRateLimit } from "@/lib/security/rate-limit";
import { createAdminClient } from "@/utils/supabase/admin";

type Body = {
  page_key?: unknown;
  section_key?: unknown;
  field_key?: unknown;
  source_locale?: unknown;
  target_locale?: unknown;
  apply_mode?: unknown;
  target_entry?: {
    section_key?: unknown;
    status?: unknown;
    fields_json?: unknown;
  } | null;
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

function normalizeApplyMode(value: unknown): PortalCmsAiApplyMode {
  return asText(value).toLowerCase() === "fill_missing" ? "fill_missing" : "overwrite";
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
    const result = await translatePortalCmsSectionFromSourceLocale({
      admin,
      pageKey: asText(body.page_key),
      sectionKey: asText(body.section_key),
      fieldKey: asText(body.field_key),
      sourceLocale: asText(body.source_locale || "de"),
      targetLocale: asText(body.target_locale),
      applyMode: normalizeApplyMode(body.apply_mode),
      targetOverride: body.target_entry ? {
        section_key: asText(body.target_entry.section_key),
        status: asText(body.target_entry.status || "draft") as "draft" | "internal" | "live",
        fields_json: sanitizeFields(body.target_entry.fields_json),
      } : null,
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
