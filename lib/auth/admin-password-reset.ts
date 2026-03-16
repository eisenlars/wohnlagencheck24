import { createAdminClient } from "@/utils/supabase/admin";
import { sendAdminPasswordResetEmail } from "@/lib/notifications/admin-review-email";

function parseCsv(value: string): string[] {
  return String(value ?? "")
    .split(/[,\n;]+/)
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

function resolveAdminPasswordResetRedirectUrl(headers: Headers): string {
  const envUrl = String(process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "").trim();
  if (envUrl) return `${envUrl.replace(/\/+$/, "")}/admin/reset`;
  const origin = String(headers.get("origin") ?? "").trim();
  if (origin) return `${origin.replace(/\/+$/, "")}/admin/reset`;
  const host = String(headers.get("x-forwarded-host") ?? headers.get("host") ?? "").trim();
  const protoHeader = String(headers.get("x-forwarded-proto") ?? "").trim();
  const isLocalHost = /^localhost(?::\d+)?$/i.test(host) || /^127\.0\.0\.1(?::\d+)?$/.test(host);
  const proto = protoHeader || (isLocalHost ? "http" : "https");
  if (!host) return "http://localhost:3000/admin/reset";
  return `${proto}://${host}/admin/reset`;
}

function pickAdminGreetingName(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
} | null): string {
  const meta = user?.user_metadata ?? {};
  const firstName = String(
    meta.first_name
      ?? meta.firstname
      ?? meta.given_name
      ?? meta.vorname
      ?? "",
  ).trim();
  if (firstName) return firstName;

  const fullName = String(meta.full_name ?? meta.name ?? "").trim();
  if (fullName) {
    const token = fullName.split(/\s+/)[0]?.trim();
    if (token) return token;
  }

  const email = String(user?.email ?? "").trim().toLowerCase();
  if (!email) return "";
  return email.split("@")[0] ?? "";
}

export async function requestAdminPasswordReset(email: string, headers: Headers): Promise<{
  delivered: boolean;
  reason?: string;
}> {
  const normalizedEmail = String(email ?? "").trim().toLowerCase();
  if (!normalizedEmail) return { delivered: false, reason: "email_missing" };

  const adminIds = Array.from(new Set([
    ...parseCsv(String(process.env.ADMIN_SUPER_USER_IDS ?? "")),
    ...parseCsv(String(process.env.ADMIN_OPS_USER_IDS ?? "")),
  ]));
  if (adminIds.length === 0) return { delivered: false, reason: "admin_ids_missing" };

  const admin = createAdminClient();
  const candidates = await Promise.all(
    adminIds.map(async (userId) => {
      const result = await admin.auth.admin.getUserById(userId);
      if (result.error || !result.data.user) return null;
      return result.data.user;
    }),
  );

  const matchedUser = candidates.find((user) => String(user?.email ?? "").trim().toLowerCase() === normalizedEmail) ?? null;
  if (!matchedUser?.id) return { delivered: false, reason: "admin_not_found" };

  const redirectTo = resolveAdminPasswordResetRedirectUrl(headers);
  const generated = await admin.auth.admin.generateLink({
    type: "recovery",
    email: normalizedEmail,
    options: { redirectTo },
  });

  if (generated.error) {
    console.error("admin password reset generateLink failed:", generated.error);
    return { delivered: false, reason: "generate_link_failed" };
  }

  const actionLink = String(generated.data.properties?.action_link ?? "").trim();
  if (!actionLink) {
    console.error("admin password reset action link missing");
    return { delivered: false, reason: "action_link_missing" };
  }

  const mail = await sendAdminPasswordResetEmail({
    adminEmail: normalizedEmail,
    adminName: pickAdminGreetingName(matchedUser),
    resetLink: actionLink,
  });

  if (!mail.sent) {
    console.error("admin password reset email send failed:", mail.reason);
    return { delivered: false, reason: mail.reason ?? "smtp_send_failed" };
  }

  return { delivered: true };
}
