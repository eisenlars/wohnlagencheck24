import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { loadAdminRoleForUser } from "@/lib/security/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";

export async function GET() {
  try {
    const supabase = createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user?.id) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const role = await loadAdminRoleForUser(user.id);
    if (role === "admin_super" || role === "admin_ops") {
      return NextResponse.json({ ok: true, redirect_to: "/admin" });
    }

    const admin = createAdminClient();
    const networkPartnerMemberships = await admin
      .from("network_partner_users")
      .select("network_partner_id")
      .eq("auth_user_id", user.id)
      .limit(1);

    if (Array.isArray(networkPartnerMemberships.data) && networkPartnerMemberships.data.length > 0) {
      return NextResponse.json({ ok: true, redirect_to: "/network-partner" });
    }

    const membershipResult = await admin
      .from("partner_users")
      .select("partner_id, is_primary, created_at")
      .eq("auth_user_id", user.id)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true });
    let partnerId =
      Array.isArray(membershipResult.data) && membershipResult.data.length > 0
        ? String(membershipResult.data[0]?.partner_id ?? "").trim()
        : "";
    if (!partnerId) {
      const fallbackProfile = await admin
        .from("partners")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();
      partnerId = String((fallbackProfile.data as { id?: string | null } | null)?.id ?? "").trim();
    }

    const { data: partnerProfile, error: partnerError } = await admin
      .from("partners")
      .select("id, is_active")
      .eq("id", partnerId)
      .maybeSingle();
    const isActive = Boolean((partnerProfile as { is_active?: boolean } | null)?.is_active);
    if (partnerError || !partnerProfile || !isActive) {
      return NextResponse.json({
        ok: true,
        redirect_to: "/partner/login?message=Partnerkonto%20noch%20nicht%20aktiviert",
      });
    }

    return NextResponse.json({ ok: true, redirect_to: "/dashboard" });
  } catch {
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
