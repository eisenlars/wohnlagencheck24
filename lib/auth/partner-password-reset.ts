import { resolvePartnerPasswordResetRedirectUrl } from "@/lib/auth/resolve-app-base-url";
import { sendPartnerPasswordResetEmail } from "@/lib/notifications/admin-review-email";
import { createAdminClient } from "@/utils/supabase/admin";

function pickPartnerGreetingName(rawFirstName: string, rawCompanyName: string): string {
  const firstName = String(rawFirstName ?? "").trim();
  if (firstName) return firstName;

  const companyName = String(rawCompanyName ?? "").trim();
  if (!companyName) return "";
  return companyName;
}

export async function requestPartnerPasswordReset(email: string, headers: Headers): Promise<{
  delivered: boolean;
  reason?: string;
}> {
  const normalizedEmail = String(email ?? "").trim().toLowerCase();
  if (!normalizedEmail) return { delivered: false, reason: "email_missing" };

  const admin = createAdminClient();
  const { data: partner, error: partnerError } = await admin
    .from("partners")
    .select("id, company_name, contact_email, contact_first_name, is_active")
    .eq("contact_email", normalizedEmail)
    .maybeSingle();

  if (partnerError) {
    console.error("partner password reset lookup failed:", partnerError);
    return { delivered: false, reason: "partner_lookup_failed" };
  }

  const partnerRow = partner as {
    id?: string | null;
    company_name?: string | null;
    contact_email?: string | null;
    contact_first_name?: string | null;
    is_active?: boolean | null;
  } | null;

  if (!partnerRow?.id) return { delivered: false, reason: "partner_not_found" };
  if (partnerRow.is_active !== true) return { delivered: false, reason: "partner_not_active" };

  const authUser = await admin.auth.admin.getUserById(String(partnerRow.id));
  if (authUser.error || !authUser.data.user) {
    console.error("partner password reset auth user lookup failed:", authUser.error);
    return { delivered: false, reason: "auth_user_not_found" };
  }

  const authEmail = String(authUser.data.user.email ?? "").trim().toLowerCase();
  if (!authEmail || authEmail !== normalizedEmail) {
    console.error("partner password reset auth email mismatch:", {
      partnerId: partnerRow.id,
      partnerEmail: normalizedEmail,
      authEmail,
    });
    return { delivered: false, reason: "auth_email_mismatch" };
  }

  const redirectTo = resolvePartnerPasswordResetRedirectUrl(headers);
  const generated = await admin.auth.admin.generateLink({
    type: "recovery",
    email: normalizedEmail,
    options: { redirectTo },
  });

  if (generated.error) {
    console.error("partner password reset generateLink failed:", generated.error);
    return { delivered: false, reason: "generate_link_failed" };
  }

  const actionLink = String(generated.data.properties?.action_link ?? "").trim();
  if (!actionLink) {
    console.error("partner password reset action link missing");
    return { delivered: false, reason: "action_link_missing" };
  }

  const mail = await sendPartnerPasswordResetEmail({
    partnerEmail: normalizedEmail,
    partnerName: pickPartnerGreetingName(partnerRow.contact_first_name ?? "", partnerRow.company_name ?? ""),
    resetLink: actionLink,
  });

  if (!mail.sent) {
    console.error("partner password reset email send failed:", mail.reason);
    return { delivered: false, reason: mail.reason ?? "smtp_send_failed" };
  }

  return { delivered: true };
}
