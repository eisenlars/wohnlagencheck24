import AdminClient from "./AdminClient";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getAdminRoleForUser } from "@/lib/security/admin-auth";

export default async function AdminPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    redirect("/admin/login");
  }
  const role = getAdminRoleForUser(user.id);
  if (role !== "admin_super" && role !== "admin_ops") {
    redirect("/admin/login?message=Kein%20Admin-Zugriff");
  }
  return <AdminClient />;
}
