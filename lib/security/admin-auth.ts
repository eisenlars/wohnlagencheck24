import { createClient } from "@/utils/supabase/server";

export type AdminRole = "admin_super" | "admin_ops";

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

export async function requireAdmin(required: AdminRole[] = ["admin_super", "admin_ops"]): Promise<AdminUser> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    throw new Error("UNAUTHORIZED");
  }

  const role = getAdminRoleForUser(user.id);
  if (!role || !required.includes(role)) {
    throw new Error("FORBIDDEN");
  }

  return { userId: user.id, role };
}
