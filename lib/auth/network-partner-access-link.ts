import { resolveAppBaseUrl } from "@/lib/auth/resolve-app-base-url";
import { sendPartnerInviteEmail } from "@/lib/notifications/admin-review-email";

type NetworkPartnerAccessLinkErrorCode =
  | "NETWORK_PARTNER_NOT_FOUND"
  | "NETWORK_PARTNER_EMAIL_MISSING"
  | "INVITE_LINK_GENERATE_FAILED"
  | "INVITE_ACTION_LINK_MISSING"
  | "AUTH_USER_NOT_FOUND"
  | "RECOVERY_LINK_GENERATE_FAILED"
  | "RECOVERY_ACTION_LINK_MISSING"
  | "INVITE_SEND_FAILED";

export class NetworkPartnerAccessLinkError extends Error {
  code: NetworkPartnerAccessLinkErrorCode;
  status: number;

  constructor(code: NetworkPartnerAccessLinkErrorCode, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function buildNetworkPartnerAuthUserMetadata(args: {
  companyName: string;
  networkPartnerId: string;
}): Record<string, unknown> {
  return {
    role: "network_partner",
    company_name: String(args.companyName ?? "").trim(),
    network_partner_id: String(args.networkPartnerId ?? "").trim(),
    activation_pending: true,
  };
}

function resolveNetworkPartnerInviteRedirectUrl(headers: Headers): string {
  const configured = String(process.env.NETWORK_PARTNER_INVITE_REDIRECT_URL ?? "").trim();
  const fallback = `${resolveAppBaseUrl(headers)}/auth/setup?aud=network_partner`;
  if (!configured) return fallback;

  try {
    const url = new URL(configured);
    if (url.pathname === "/network-partner/setup" || url.pathname === "/auth/setup") {
      url.pathname = "/auth/setup";
      url.searchParams.set("aud", "network_partner");
      return url.toString();
    }
    return fallback;
  } catch {
    return fallback;
  }
}

export function formatNetworkPartnerAccessLinkError(error: unknown): { status: number; message: string } {
  if (error instanceof NetworkPartnerAccessLinkError) {
    return { status: error.status, message: error.message };
  }
  if (error instanceof Error) {
    return { status: 500, message: error.message || "Einladungsversand fehlgeschlagen." };
  }
  return { status: 500, message: "Einladungsversand fehlgeschlagen." };
}

export async function generateNetworkPartnerInviteForNewUser(args: {
  admin: {
    auth: {
      admin: {
        generateLink: (params: {
          type: "invite";
          email: string;
          options?: { data?: Record<string, unknown>; redirectTo?: string };
        }) => Promise<{
          data: {
            user: { id?: string | null } | null;
            properties?: { action_link?: string | null } | null;
          };
          error: { message?: string | null } | null;
        }>;
      };
    };
  };
  headers: Headers;
  contactEmail: string;
  companyName: string;
  networkPartnerId: string;
}): Promise<{ authUserId: string; actionLink: string; redirectTo: string; linkType: "invite" }> {
  const contactEmail = String(args.contactEmail ?? "").trim().toLowerCase();
  if (!contactEmail) {
    throw new NetworkPartnerAccessLinkError(
      "NETWORK_PARTNER_EMAIL_MISSING",
      "Kontakt-E-Mail fehlt. Einladung kann nicht erstellt werden.",
      400,
    );
  }

  const redirectTo = resolveNetworkPartnerInviteRedirectUrl(args.headers);
  const generated = await args.admin.auth.admin.generateLink({
    type: "invite",
    email: contactEmail,
    options: {
      data: buildNetworkPartnerAuthUserMetadata({
        companyName: args.companyName,
        networkPartnerId: args.networkPartnerId,
      }),
      redirectTo,
    },
  });

  if (generated.error) {
    throw new NetworkPartnerAccessLinkError(
      "INVITE_LINK_GENERATE_FAILED",
      String(generated.error.message ?? "Invite-Link konnte nicht erzeugt werden."),
      500,
    );
  }

  const authUserId = String(generated.data.user?.id ?? "").trim();
  if (!authUserId) {
    throw new NetworkPartnerAccessLinkError(
      "AUTH_USER_NOT_FOUND",
      "Invite-Link wurde erzeugt, aber die Auth-User-ID fehlt.",
      500,
    );
  }

  const actionLink = String(generated.data.properties?.action_link ?? "").trim();
  if (!actionLink) {
    throw new NetworkPartnerAccessLinkError(
      "INVITE_ACTION_LINK_MISSING",
      "Invite-Link wurde erzeugt, aber der Aktivierungslink fehlt.",
      500,
    );
  }

  return {
    authUserId,
    actionLink,
    redirectTo,
    linkType: "invite",
  };
}

export async function generateNetworkPartnerAccessLinkForExistingUser(args: {
  admin: {
    auth: {
      admin: {
        updateUserById: (
          userId: string,
          attributes: { user_metadata: Record<string, unknown> },
        ) => Promise<{ data: { user: { id?: string } | null }; error: { message?: string | null } | null }>;
        generateLink: (params: {
          type: "recovery";
          email: string;
          options?: { redirectTo?: string };
        }) => Promise<{
          data: {
            properties?: { action_link?: string | null } | null;
          };
          error: { message?: string | null } | null;
        }>;
      };
    };
  };
  headers: Headers;
  authUserId: string;
  contactEmail: string;
  companyName: string;
  networkPartnerId: string;
}): Promise<{ actionLink: string; redirectTo: string; linkType: "recovery" }> {
  const contactEmail = String(args.contactEmail ?? "").trim().toLowerCase();
  if (!contactEmail) {
    throw new NetworkPartnerAccessLinkError(
      "NETWORK_PARTNER_EMAIL_MISSING",
      "Kontakt-E-Mail fehlt. Einladung kann nicht versendet werden.",
      400,
    );
  }

  const updated = await args.admin.auth.admin.updateUserById(args.authUserId, {
    user_metadata: buildNetworkPartnerAuthUserMetadata({
      companyName: args.companyName,
      networkPartnerId: args.networkPartnerId,
    }),
  });
  if (updated.error) {
    throw new NetworkPartnerAccessLinkError(
      "AUTH_USER_NOT_FOUND",
      String(updated.error.message ?? "Auth-User-Metadaten konnten nicht aktualisiert werden."),
      500,
    );
  }
  const redirectTo = resolveNetworkPartnerInviteRedirectUrl(args.headers);
  const generated = await args.admin.auth.admin.generateLink({
    type: "recovery",
    email: contactEmail,
    options: { redirectTo },
  });

  if (generated.error) {
    throw new NetworkPartnerAccessLinkError(
      "RECOVERY_LINK_GENERATE_FAILED",
      String(generated.error.message ?? "Zugangslink konnte nicht erzeugt werden."),
      500,
    );
  }

  const actionLink = String(generated.data.properties?.action_link ?? "").trim();
  if (!actionLink) {
    throw new NetworkPartnerAccessLinkError(
      "RECOVERY_ACTION_LINK_MISSING",
      "Zugangslink wurde erzeugt, aber der Aktivierungslink fehlt.",
      500,
    );
  }

  return {
    actionLink,
    redirectTo,
    linkType: "recovery",
  };
}

export async function sendNetworkPartnerAccessLinkBySmtp(args: {
  partnerEmail: string;
  companyName?: string | null;
  inviteLink: string;
}): Promise<{ sent: boolean; reason?: string }> {
  const result = await sendPartnerInviteEmail({
    partnerEmail: String(args.partnerEmail ?? "").trim().toLowerCase(),
    partnerName: String(args.companyName ?? "").trim(),
    companyName: String(args.companyName ?? "").trim(),
    inviteLink: String(args.inviteLink ?? "").trim(),
  });

  if (!result.sent) {
    throw new NetworkPartnerAccessLinkError(
      "INVITE_SEND_FAILED",
      result.reason ?? "Einladungs-Mail konnte nicht versendet werden.",
      500,
    );
  }

  return result;
}
