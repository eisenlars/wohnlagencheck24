import { NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { requireAdmin } from "@/lib/security/admin-auth";
import { writeSecurityAuditLog } from "@/lib/security/audit-log";
import { checkAdminApiRateLimit, extractClientIpFromHeaders } from "@/lib/security/rate-limit";
import { resolveAppBaseUrl, resolvePartnerInviteRedirectUrl } from "@/lib/auth/resolve-app-base-url";

export async function POST(
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
    const { data: partner, error: partnerError } = await admin
      .from("partners")
      .select("id, company_name, contact_email, is_active")
      .eq("id", partnerId)
      .maybeSingle();

    if (partnerError) {
      return NextResponse.json({ error: partnerError.message }, { status: 500 });
    }
    if (!partner) {
      return NextResponse.json({ error: "Partner not found" }, { status: 404 });
    }

    const email = String((partner as { contact_email?: string | null }).contact_email ?? "").trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "Partner has no contact email" }, { status: 400 });
    }

    const { data: authUserRes, error: authUserError } = await admin.auth.admin.getUserById(partnerId);
    if (authUserError || !authUserRes.user) {
      return NextResponse.json({ error: authUserError?.message ?? "Auth user not found" }, { status: 404 });
    }

    const isActive = Boolean((partner as { is_active?: boolean | null }).is_active);
    let linkType: "invite" | "recovery" = "recovery";
    let redirectTo = `${resolveAppBaseUrl(req.headers)}/auth/setup?aud=partner`;

    if (!isActive) {
      redirectTo = resolvePartnerInviteRedirectUrl(req.headers);
      const invite = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo,
        data: {
          role: "partner",
          company_name: String((partner as { company_name?: string | null }).company_name ?? "").trim(),
          activation_pending: true,
        },
      });
      if (invite.error) {
        return NextResponse.json({ error: String(invite.error.message ?? "Invite failed") }, { status: 500 });
      }
      linkType = "invite";
    } else {
      const supabase = createClient();
      const reset = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (reset.error) {
        return NextResponse.json({ error: String(reset.error.message ?? "Password reset failed") }, { status: 500 });
      }
    }

    await writeSecurityAuditLog({
      actorUserId: adminUser.userId,
      actorRole: adminUser.role,
      eventType: "invite",
      entityType: "auth_user",
      entityId: partnerId,
      payload: {
        contact_email: email,
        redirect_to: redirectTo,
        resend: true,
        link_type: linkType,
      },
      ip: extractClientIpFromHeaders(req.headers),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({
      ok: true,
      partner_id: partnerId,
      contact_email: email,
      link_type: linkType,
      redirect_to: redirectTo,
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
