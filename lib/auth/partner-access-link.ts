import {
  resolvePartnerInviteRedirectUrl,
  resolvePartnerPasswordResetRedirectUrl,
} from "@/lib/auth/resolve-app-base-url";

type PartnerAccessLinkResult = {
  contactEmail: string;
  linkType: "invite" | "recovery";
  redirectTo: string;
};

export function buildPartnerAuthUserMetadata(companyName: string): Record<string, unknown> {
  return {
    role: "partner",
    company_name: String(companyName ?? "").trim(),
    activation_pending: true,
  };
}

export async function sendPartnerAccessLink(args: {
  admin: unknown;
  supabase: unknown;
  partnerId: string;
  headers: Headers;
}): Promise<PartnerAccessLinkResult> {
  const { partnerId, headers } = args;
  const admin = args.admin as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: unknown) => {
          maybeSingle: () => Promise<{ data: unknown; error: { message?: string } | null }>;
        };
      };
    };
    auth: {
      admin: {
        getUserById: (userId: string) => Promise<{
          data: { user: { id?: string } | null };
          error: { message?: string } | null;
        }>;
        inviteUserByEmail: (
          email: string,
          options: { redirectTo: string; data: Record<string, unknown> },
        ) => Promise<{ error: { message?: string } | null }>;
      };
    };
  };
  const supabase = args.supabase as {
    auth: {
      resetPasswordForEmail: (
        email: string,
        options: { redirectTo: string },
      ) => Promise<{ error: { message?: string } | null }>;
    };
  };

  const { data: partner, error: partnerError } = await admin
    .from("partners")
    .select("id, company_name, contact_email, is_active")
    .eq("id", partnerId)
    .maybeSingle();

  if (partnerError) throw new Error(String(partnerError.message ?? "Partner lookup failed"));
  if (!partner) throw new Error("Partner not found");

  const email = String((partner as { contact_email?: string | null }).contact_email ?? "").trim().toLowerCase();
  if (!email) throw new Error("Partner has no contact email");

  const { data: authUserRes, error: authUserError } = await admin.auth.admin.getUserById(partnerId);
  if (authUserError || !authUserRes.user) {
    throw new Error(String(authUserError?.message ?? "Auth user not found"));
  }

  const isActive = Boolean((partner as { is_active?: boolean | null }).is_active);
  if (!isActive) {
    const redirectTo = resolvePartnerInviteRedirectUrl(headers);
    const invite = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: buildPartnerAuthUserMetadata(
        String((partner as { company_name?: string | null }).company_name ?? "").trim(),
      ),
    });
    if (invite.error) throw new Error(String(invite.error.message ?? "Invite failed"));
    return {
      contactEmail: email,
      linkType: "invite",
      redirectTo,
    };
  }

  const redirectTo = resolvePartnerPasswordResetRedirectUrl(headers);
  const reset = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (reset.error) throw new Error(String(reset.error.message ?? "Password reset failed"));
  return {
    contactEmail: email,
    linkType: "recovery",
    redirectTo,
  };
}
