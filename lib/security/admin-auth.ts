import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

export type AdminRole = "admin_super" | "admin_ops" | "admin_billing";

type AdminUser = {
  userId: string;
  role: AdminRole;
};

function parseCsv(value: string): string[] {
  return String(value ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

function getAdminSets() {
  const superAdmins = new Set(parseCsv(process.env.ADMIN_SUPER_USER_IDS ?? ""));
  const opsAdmins = new Set(parseCsv(process.env.ADMIN_OPS_USER_IDS ?? ""));
  return { superAdmins, opsAdmins };
}

export function getAdminRoleForUser(userId: string): AdminRole | null {
  const normalized = String(userId ?? "").trim();
  if (!normalized) return null;
  const { superAdmins, opsAdmins } = getAdminSets();
  if (superAdmins.has(normalized)) return "admin_super";
  if (opsAdmins.has(normalized)) return "admin_ops";
  return null;
}

export async function loadAdminRoleForUser(userId: string): Promise<AdminRole | null> {
  const normalized = String(userId ?? "").trim();
  if (!normalized) return null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("admin_users")
    .select("role")
    .eq("auth_user_id", normalized)
    .maybeSingle();

  if (!error && data && typeof data === "object" && !Array.isArray(data)) {
    const role = String((data as { role?: string | null }).role ?? "").trim();
    if (role === "admin_super" || role === "admin_ops" || role === "admin_billing") {
      return role;
    }
  }

  return getAdminRoleForUser(normalized);
}

export async function requireAdmin(required: AdminRole[] = ["admin_super", "admin_ops"]): Promise<AdminUser> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    throw new Error("UNAUTHORIZED");
  }

  const role = await loadAdminRoleForUser(user.id);
  if (!role || !required.includes(role)) {
    throw new Error("FORBIDDEN");
  }

  return { userId: user.id, role };
}
