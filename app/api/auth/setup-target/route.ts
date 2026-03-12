import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getAdminRoleForUser } from "@/lib/security/admin-auth";

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

    return NextResponse.json({ ok: true, redirect_to: "/dashboard" });
  } catch {
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
