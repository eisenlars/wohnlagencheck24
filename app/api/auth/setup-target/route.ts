import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getAdminRoleForUser } from "@/lib/security/admin-auth";
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

    const role = getAdminRoleForUser(user.id);
    if (role === "admin_super" || role === "admin_ops") {
      return NextResponse.json({ ok: true, redirect_to: "/admin" });
    }

    const admin = createAdminClient();
    const { data: partnerProfile, error: partnerError } = await admin
      .from("partners")
      .select("id, is_active")
      .eq("id", user.id)
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
