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
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !partnerProfile) {
    redirect("/partner/login?message=Kein-Partnerprofil");
  }

  return <>{children}</>;
}
