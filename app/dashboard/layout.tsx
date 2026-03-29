import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";

type DashboardLayoutProps = {
  children: ReactNode;
};

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    redirect("/partner/login");
  }

  const admin = createAdminClient();
  const membershipResult = await admin
    .from("partner_users")
    .select("partner_id, role, is_primary, created_at")
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

  if (!partnerId) {
    redirect("/partner/login?message=Kein-Partnerprofil");
  }

  const { data: partnerProfile, error } = await admin
    .from("partners")
    .select("id, is_active")
    .eq("id", partnerId)
    .maybeSingle();

  const isActive = Boolean((partnerProfile as { is_active?: boolean } | null)?.is_active);
  if (error || !partnerProfile || !isActive) {
    redirect("/partner/login?message=Kein-Partnerprofil");
  }

  return <>{children}</>;
}
