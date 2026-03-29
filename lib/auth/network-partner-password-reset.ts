import { createAdminClient } from "@/utils/supabase/admin";
import { resolveAppBaseUrl } from "@/lib/auth/resolve-app-base-url";
import { sendPartnerPasswordResetEmail } from "@/lib/notifications/admin-review-email";

function pickGreetingName(companyName: string): string {
  const normalized = String(companyName ?? "").trim();
  return normalized || "";
}

function resolveNetworkPartnerPasswordResetRedirectUrl(headers: Headers): string {
  return `${resolveAppBaseUrl(headers)}/auth/setup?aud=network_partner`;
}

export async function requestNetworkPartnerPasswordReset(email: string, headers: Headers): Promise<{
  delivered: boolean;
  reason?: string;
}> {
  const normalizedEmail = String(email ?? "").trim().toLowerCase();
  if (!normalizedEmail) return { delivered: false, reason: "email_missing" };

  const admin = createAdminClient();
  const { data: membership, error: membershipError } = await admin
    .from("network_partner_users")
    .select("auth_user_id, network_partner_id")
    .limit(1);

  if (membershipError) {
    console.error("network partner password reset membership lookup failed:", membershipError);
    return { delivered: false, reason: "membership_lookup_failed" };
  }

  const memberships = Array.isArray(membership) ? membership : [];
  for (const item of memberships) {
    const authUserId = String(item?.auth_user_id ?? "").trim();
    const networkPartnerId = String(item?.network_partner_id ?? "").trim();
    if (!authUserId || !networkPartnerId) continue;

    const [authUser, networkPartner] = await Promise.all([
      admin.auth.admin.getUserById(authUserId),
      admin
        .from("network_partners")
        .select("id, company_name, contact_email, status")
        .eq("id", networkPartnerId)
        .maybeSingle(),
    ]);

    if (authUser.error || !authUser.data.user) continue;
    const authEmail = String(authUser.data.user.email ?? "").trim().toLowerCase();
    const contactEmail = String((networkPartner.data as { contact_email?: string | null } | null)?.contact_email ?? "").trim().toLowerCase();
    if (authEmail !== normalizedEmail && contactEmail !== normalizedEmail) continue;

    const status = String((networkPartner.data as { status?: string | null } | null)?.status ?? "").trim().toLowerCase();
    if (status && status !== "active") {
      return { delivered: false, reason: "network_partner_not_active" };
    }

    const redirectTo = resolveNetworkPartnerPasswordResetRedirectUrl(headers);
    const generated = await admin.auth.admin.generateLink({
      type: "recovery",
      email: normalizedEmail,
      options: { redirectTo },
    });

    if (generated.error) {
      console.error("network partner password reset generateLink failed:", generated.error);
      return { delivered: false, reason: "generate_link_failed" };
    }

    const actionLink = String(generated.data.properties?.action_link ?? "").trim();
    if (!actionLink) {
      console.error("network partner password reset action link missing");
      return { delivered: false, reason: "action_link_missing" };
    }

    const mail = await sendPartnerPasswordResetEmail({
      partnerEmail: normalizedEmail,
      partnerName: pickGreetingName(String((networkPartner.data as { company_name?: string | null } | null)?.company_name ?? "")),
      resetLink: actionLink,
    });

    if (!mail.sent) {
      console.error("network partner password reset email send failed:", mail.reason);
      return { delivered: false, reason: mail.reason ?? "smtp_send_failed" };
    }

    return { delivered: true };
  }

  return { delivered: false, reason: "network_partner_not_found" };
}
