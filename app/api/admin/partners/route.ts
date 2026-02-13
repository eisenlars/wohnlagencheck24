import { NextResponse } from "next/server";

import { createAdminClient } from "@/utils/supabase/admin";
import { requireAdmin } from "@/lib/security/admin-auth";
import { writeSecurityAuditLog } from "@/lib/security/audit-log";
import { checkAdminApiRateLimit, extractClientIpFromHeaders } from "@/lib/security/rate-limit";

type CreatePartnerBody = {
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

export async function POST(req: Request) {
  try {
    const adminUser = await requireAdmin(["admin_super", "admin_ops"]);
    const adminRate = await checkAdminApiRateLimit(req, adminUser.userId);
    if (!adminRate.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(adminRate.retryAfterSec) } },
      );
    }

    const body = (await req.json()) as CreatePartnerBody;
    const companyName = normalizeNullableString(body.company_name);
    const contactEmail = normalizeNullableString(body.contact_email)?.toLowerCase() ?? null;

    if (!companyName || !contactEmail) {
      return NextResponse.json(
        { error: "Missing required fields: company_name, contact_email" },
        { status: 400 },
      );
    }

    const admin = createAdminClient();
    const inviteRedirectTo =
      process.env.PARTNER_INVITE_REDIRECT_URL ??
      `${new URL(req.url).origin}/partner/setup`;
    const invite = await admin.auth.admin.inviteUserByEmail(contactEmail, {
      redirectTo: inviteRedirectTo,
      data: { role: "partner", company_name: companyName },
    });
    if (invite.error) {
      const msg = String(invite.error.message ?? "");
      const lower = msg.toLowerCase();
      if (lower.includes("already") || lower.includes("exists") || lower.includes("registered")) {
        return NextResponse.json(
          { error: "Auth user already exists for this email. Please use existing user flow." },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: msg || "Invite failed" }, { status: 500 });
    }

    const authUserId = normalizeNullableString(invite.data.user?.id);
    if (!authUserId) {
      return NextResponse.json({ error: "Invite succeeded but user id missing" }, { status: 500 });
    }

    const payload = {
      id: authUserId,
      company_name: companyName,
      contact_email: contactEmail,
      contact_person: normalizeNullableString(body.contact_person),
      website_url: normalizeNullableString(body.website_url),
      is_active: body.is_active === false ? false : true,
    };

    let { data, error } = await admin
      .from("partners")
      .upsert(payload, { onConflict: "id" })
      .select("id, company_name, contact_email, contact_person, website_url, is_active, created_at")
      .single();

    if (error && isMissingIsActiveColumn(error)) {
      const fallback = await admin
        .from("partners")
        .upsert({
          id: authUserId,
          company_name: companyName,
          contact_email: contactEmail,
          contact_person: normalizeNullableString(body.contact_person),
          website_url: normalizeNullableString(body.website_url),
        }, { onConflict: "id" })
        .select("id, company_name, contact_email, contact_person, website_url, created_at")
        .single();
      data = fallback.data ? { ...fallback.data, is_active: true } : null;
      error = fallback.error;
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Partner could not be created" }, { status: 500 });
    }

    await writeSecurityAuditLog({
      actorUserId: adminUser.userId,
      actorRole: adminUser.role,
      eventType: "create",
      entityType: "partner",
      entityId: String(data.id),
      payload: {
        company_name: data.company_name,
        contact_email: data.contact_email,
        is_active: data.is_active,
        auth_user_id: authUserId,
        invite_sent: true,
      },
      ip: extractClientIpFromHeaders(req.headers),
      userAgent: req.headers.get("user-agent"),
    });

    await writeSecurityAuditLog({
      actorUserId: adminUser.userId,
      actorRole: adminUser.role,
      eventType: "invite",
      entityType: "auth_user",
      entityId: authUserId,
      payload: {
        contact_email: contactEmail,
        redirect_to: inviteRedirectTo,
      },
      ip: extractClientIpFromHeaders(req.headers),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({ ok: true, partner: data }, { status: 201 });
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
    const includeInactive = url.searchParams.get("include_inactive") === "1";
    const admin = createAdminClient();
    let query = admin
      .from("partners")
      .select("id, company_name, contact_email, contact_person, website_url, is_active, created_at")
      .order("company_name", { ascending: true });

    if (!includeInactive) {
      query = query.eq("is_active", true);
    }

    let { data, error } = await query;
    if (error && isMissingIsActiveColumn(error)) {
      const fallback = await admin
        .from("partners")
        .select("id, company_name, contact_email, contact_person, website_url, created_at")
        .order("company_name", { ascending: true });
      if (fallback.error) return NextResponse.json({ error: fallback.error.message }, { status: 500 });
      data = (fallback.data ?? []).map((row) => ({ ...row, is_active: true }));
      error = null;
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, partners: data ?? [] });
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
