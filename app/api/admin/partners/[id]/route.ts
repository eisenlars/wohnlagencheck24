import { NextResponse } from "next/server";

import { createAdminClient } from "@/utils/supabase/admin";
import { requireAdmin } from "@/lib/security/admin-auth";
import { writeSecurityAuditLog } from "@/lib/security/audit-log";
import { checkAdminApiRateLimit, extractClientIpFromHeaders } from "@/lib/security/rate-limit";

type UpdatePartnerBody = {
  company_name?: string;
  contact_email?: string | null;
  contact_person?: string | null;
  website_url?: string | null;
  is_active?: boolean;
};

function isMissingIsActiveColumn(error: unknown): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return msg.includes("partners.is_active") && msg.includes("does not exist");
}

function normalizeNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const adminUser = await requireAdmin(["admin_super", "admin_ops"]);
    const adminRate = await checkAdminApiRateLimit(req, adminUser.userId);
    if (!adminRate.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(adminRate.retryAfterSec) } },
      );
    }

    const params = await ctx.params;
    const partnerId = String(params.id ?? "").trim();
    if (!partnerId) {
      return NextResponse.json({ error: "Missing partner id" }, { status: 400 });
    }

    const body = (await req.json()) as UpdatePartnerBody;
    const patch: Record<string, unknown> = {};
    if (body.company_name !== undefined) {
      const companyName = normalizeNullableString(body.company_name);
      if (!companyName) {
        return NextResponse.json({ error: "company_name cannot be empty" }, { status: 400 });
      }
      patch.company_name = companyName;
    }
    if (body.contact_email !== undefined) patch.contact_email = normalizeNullableString(body.contact_email);
    if (body.contact_person !== undefined) patch.contact_person = normalizeNullableString(body.contact_person);
    if (body.website_url !== undefined) patch.website_url = normalizeNullableString(body.website_url);
    if (body.is_active !== undefined) patch.is_active = Boolean(body.is_active);

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No update fields provided" }, { status: 400 });
    }

    const admin = createAdminClient();
    let { data, error } = await admin
      .from("partners")
      .update(patch)
      .eq("id", partnerId)
      .select("id, company_name, contact_email, contact_person, website_url, is_active, created_at")
      .maybeSingle();

    if (error && isMissingIsActiveColumn(error)) {
      const patchNoIsActive = { ...patch };
      delete patchNoIsActive.is_active;
      const fallback = await admin
        .from("partners")
        .update(patchNoIsActive)
        .eq("id", partnerId)
        .select("id, company_name, contact_email, contact_person, website_url, created_at")
        .maybeSingle();
      data = fallback.data ? { ...fallback.data, is_active: true } : null;
      error = fallback.error;
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Partner not found" }, { status: 404 });
    }

    await writeSecurityAuditLog({
      actorUserId: adminUser.userId,
      actorRole: adminUser.role,
      eventType: "update",
      entityType: "partner",
      entityId: partnerId,
      payload: patch,
      ip: extractClientIpFromHeaders(req.headers),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({ ok: true, partner: data });
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

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const adminUser = await requireAdmin(["admin_super", "admin_ops"]);
    const adminRate = await checkAdminApiRateLimit(req, adminUser.userId);
    if (!adminRate.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(adminRate.retryAfterSec) } },
      );
    }

    const params = await ctx.params;
    const partnerId = String(params.id ?? "").trim();
    if (!partnerId) {
      return NextResponse.json({ error: "Missing partner id" }, { status: 400 });
    }

    const admin = createAdminClient();
    let { data: partner, error: partnerError } = await admin
      .from("partners")
      .select("id, company_name, contact_email, contact_person, website_url, is_active, created_at")
      .eq("id", partnerId)
      .maybeSingle();

    if (partnerError && isMissingIsActiveColumn(partnerError)) {
      const fallback = await admin
        .from("partners")
        .select("id, company_name, contact_email, contact_person, website_url, created_at")
        .eq("id", partnerId)
        .maybeSingle();
      partner = fallback.data ? { ...fallback.data, is_active: true } : null;
      partnerError = fallback.error;
    }

    if (partnerError) return NextResponse.json({ error: partnerError.message }, { status: 500 });
    if (!partner) return NextResponse.json({ error: "Partner not found" }, { status: 404 });

    const { data: mappings, error: mappingError } = await admin
      .from("partner_area_map")
      .select("id, auth_user_id, area_id, is_active, created_at, areas(name, slug, parent_slug, bundesland_slug)")
      .eq("auth_user_id", partnerId)
      .order("area_id", { ascending: true });

    if (mappingError) return NextResponse.json({ error: mappingError.message }, { status: 500 });

    return NextResponse.json({
      ok: true,
      partner,
      area_mappings: mappings ?? [],
    });
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
