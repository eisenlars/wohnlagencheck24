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
  const { data: partnerProfile, error } = await admin
    .from("partners")
    .select("id, is_active")
    .eq("id", user.id)
    .maybeSingle();

  const isActive = Boolean((partnerProfile as { is_active?: boolean } | null)?.is_active);
  if (error || !partnerProfile || !isActive) {
    redirect("/partner/login?message=Kein-Partnerprofil");
  }

  return <>{children}</>;
}
