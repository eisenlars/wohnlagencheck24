import { resolvePartnerInviteRedirectUrl } from "@/lib/auth/resolve-app-base-url";
import { buildPartnerAuthUserMetadata } from "@/lib/auth/partner-access-link";
import { sendPartnerInviteEmail } from "@/lib/notifications/admin-review-email";

export type PartnerInviteDeliveryResult = {
  authUserId: string;
  actionLink: string;
  contactEmail: string;
  linkType: "invite";
  redirectTo: string;
};

function pickPartnerGreetingName(rawFirstName: string, rawCompanyName: string): string {
  const firstName = String(rawFirstName ?? "").trim();
  if (firstName) return firstName;

  const companyName = String(rawCompanyName ?? "").trim();
  if (!companyName) return "";
  return companyName;
}

export async function generatePartnerInviteForNewUser(args: {
  admin: {
    auth: {
      admin: {
        generateLink: (params: {
          type: "invite";
          email: string;
          options?: { data?: Record<string, unknown>; redirectTo?: string };
        }) => Promise<{
          data: {
            user: { id?: string | null; email?: string | null } | null;
            properties?: { action_link?: string | null; redirect_to?: string | null } | null;
          };
          error: { message?: string | null } | null;
        }>;
      };
    };
  };
  headers: Headers;
  companyName: string;
  contactEmail: string;
}): Promise<PartnerInviteDeliveryResult> {
  const contactEmail = String(args.contactEmail ?? "").trim().toLowerCase();
  const companyName = String(args.companyName ?? "").trim();
  if (!contactEmail) {
    throw new Error("Kontakt-E-Mail fehlt. Einladung kann nicht erstellt werden.");
  }
  if (!companyName) {
    throw new Error("Firmenname fehlt. Einladung kann nicht erstellt werden.");
  }

  const redirectTo = resolvePartnerInviteRedirectUrl(args.headers);
  const generated = await args.admin.auth.admin.generateLink({
    type: "invite",
    email: contactEmail,
    options: {
      data: buildPartnerAuthUserMetadata(companyName),
      redirectTo,
    },
  });

  if (generated.error) {
    throw new Error(String(generated.error.message ?? "Invite-Link konnte nicht erzeugt werden."));
  }

  const authUserId = String(generated.data.user?.id ?? "").trim();
  if (!authUserId) {
    throw new Error("Invite-Link wurde erzeugt, aber die Auth-User-ID fehlt.");
  }

  const actionLink = String(generated.data.properties?.action_link ?? "").trim();
  if (!actionLink) {
    throw new Error("Invite-Link wurde erzeugt, aber der Aktivierungslink fehlt.");
  }

  return {
    authUserId,
    actionLink,
    contactEmail,
    linkType: "invite",
    redirectTo,
  };
}

export async function sendPartnerInviteBySmtp(args: {
  partnerEmail: string;
  partnerFirstName?: string | null;
  companyName?: string | null;
  inviteLink: string;
}): Promise<{ sent: boolean; reason?: string }> {
  return sendPartnerInviteEmail({
    partnerEmail: String(args.partnerEmail ?? "").trim().toLowerCase(),
    partnerName: pickPartnerGreetingName(
      String(args.partnerFirstName ?? ""),
      String(args.companyName ?? ""),
    ),
    companyName: String(args.companyName ?? "").trim(),
    inviteLink: String(args.inviteLink ?? "").trim(),
  });
}
