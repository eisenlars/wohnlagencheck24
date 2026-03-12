import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { getAdminRoleForUser } from "@/lib/security/admin-auth";
import { sendAdminPartnerOnboardedEmail } from "@/lib/notifications/admin-review-email";

type UserMeta = Record<string, unknown>;

function isPendingActivation(meta: UserMeta | null | undefined): boolean {
  const value = meta?.activation_pending;
  if (value === true) return true;
  return String(value ?? "").trim().toLowerCase() === "true";
}

export async function POST() {
  try {
    const supabase = createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user?.id) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const role = getAdminRoleForUser(user.id);
    if (role === "admin_super" || role === "admin_ops") {
      return NextResponse.json({ ok: true, activated: false, reason: "admin_user" });
    }

    const admin = createAdminClient();
    const { data: partnerProfile, error: partnerError } = await admin
      .from("partners")
      .select("id, company_name, contact_email, is_active")
      .eq("id", user.id)
      .maybeSingle();

    if (partnerError || !partnerProfile) {
      return NextResponse.json({ ok: true, activated: false, reason: "no_partner_profile" });
    }

    const isActive = Boolean((partnerProfile as { is_active?: boolean } | null)?.is_active);
    const pending = isPendingActivation((user.user_metadata as UserMeta | undefined) ?? null);
    if (!pending || isActive) {
      return NextResponse.json({ ok: true, activated: false, reason: pending ? "already_active" : "not_pending" });
    }

    const { error: activateError } = await admin
      .from("partners")
      .update({ is_active: true })
      .eq("id", user.id);

    if (activateError) {
      return NextResponse.json({ ok: false, error: "ACTIVATE_FAILED" }, { status: 500 });
    }

    const nextMeta: UserMeta = {
      ...((user.user_metadata as UserMeta | undefined) ?? {}),
      activation_pending: false,
    };
    await admin.auth.admin.updateUserById(user.id, {
      user_metadata: nextMeta,
    });

    await sendAdminPartnerOnboardedEmail({
      partnerId: user.id,
      partnerName: String((partnerProfile as { company_name?: string } | null)?.company_name ?? "").trim() || null,
      partnerEmail: String((partnerProfile as { contact_email?: string } | null)?.contact_email ?? "").trim().toLowerCase() || null,
      loggedInAtIso: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true, activated: true });
  } catch {
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
