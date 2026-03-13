import { resolvePartnerInviteRedirectUrl } from "@/lib/auth/resolve-app-base-url";
import { sendPartnerInviteEmail } from "@/lib/notifications/admin-review-email";

type PartnerAccessLinkResult = {
  contactEmail: string;
  linkType: "invite";
  redirectTo: string;
};

type PartnerInviteDraftResult = PartnerAccessLinkResult & {
  authUserId: string;
  actionLink: string;
};

type PartnerAccessLinkErrorCode =
  | "PARTNER_NOT_FOUND"
  | "PARTNER_LOOKUP_FAILED"
  | "PARTNER_EMAIL_MISSING"
  | "PARTNER_ALREADY_ACTIVE"
  | "AUTH_USER_NOT_FOUND"
  | "AUTH_USER_LOOKUP_FAILED"
  | "AUTH_USER_EMAIL_MISMATCH"
  | "INVITE_REDIRECT_INVALID"
  | "AUTH_USER_METADATA_SYNC_FAILED"
  | "INVITE_LINK_GENERATE_FAILED"
  | "INVITE_ACTION_LINK_MISSING"
  | "INVITE_SEND_FAILED";

export class PartnerAccessLinkError extends Error {
  code: PartnerAccessLinkErrorCode;
  status: number;

  constructor(code: PartnerAccessLinkErrorCode, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export function buildPartnerAuthUserMetadata(companyName: string): Record<string, unknown> {
  return {
    role: "partner",
    company_name: String(companyName ?? "").trim(),
    activation_pending: true,
  };
}

function parseInviteRedirectOrThrow(headers: Headers): string {
  const redirectTo = resolvePartnerInviteRedirectUrl(headers);
  try {
    const url = new URL(redirectTo);
    if (url.pathname !== "/partner/setup") {
      throw new Error("invalid_path");
    }
    return url.toString();
  } catch {
    throw new PartnerAccessLinkError(
      "INVITE_REDIRECT_INVALID",
      "Invite-Konfiguration ungueltig: Redirect-Ziel fuer Partner-Einladungen ist nicht korrekt gesetzt.",
      500,
    );
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pickPartnerGreetingName(rawFirstName: string, rawCompanyName: string): string {
  const firstName = String(rawFirstName ?? "").trim();
  if (firstName) return firstName;

  const companyName = String(rawCompanyName ?? "").trim();
  if (!companyName) return "";
  return companyName;
}

async function loadAuthUserWithRetry(args: {
  admin: {
    auth: {
      admin: {
        getUserById: (userId: string) => Promise<{
          data: { user: { email?: string | null; user_metadata?: Record<string, unknown> | null } | null };
          error: { message?: string } | null;
        }>;
      };
    };
  };
  partnerId: string;
  attempts?: number;
  waitMs?: number;
}) {
  const attempts = Math.max(1, Number(args.attempts ?? 4));
  const waitMs = Math.max(0, Number(args.waitMs ?? 250));

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const result = await args.admin.auth.admin.getUserById(args.partnerId);
    if (!result.error && result.data.user) {
      return result.data.user;
    }
    if (result.error && attempt === attempts - 1) {
      throw new PartnerAccessLinkError(
        "AUTH_USER_LOOKUP_FAILED",
        String(result.error.message ?? "Auth-User konnte nicht geladen werden."),
        500,
      );
    }
    if (attempt < attempts - 1) {
      await sleep(waitMs);
    }
  }

  throw new PartnerAccessLinkError(
    "AUTH_USER_NOT_FOUND",
    "Zum Partner wurde kein Auth-Benutzer gefunden. Einladung kann nicht versendet werden.",
    400,
  );
}

export function formatPartnerAccessLinkError(error: unknown): { status: number; message: string } {
  if (error instanceof PartnerAccessLinkError) {
    return {
      status: error.status,
      message: error.message,
    };
  }
  if (error instanceof Error) {
    return {
      status: 500,
      message: error.message || "Einladungsversand fehlgeschlagen.",
    };
  }
  return {
    status: 500,
    message: "Einladungsversand fehlgeschlagen.",
  };
}

export async function generatePartnerInviteForNewUser(args: {
  admin: unknown;
  headers: Headers;
  companyName: string;
  contactEmail: string;
}): Promise<PartnerInviteDraftResult> {
  const admin = args.admin as {
    auth: {
      admin: {
        generateLink: (params: {
          type: "invite";
          email: string;
          options?: { data?: Record<string, unknown>; redirectTo?: string };
        }) => Promise<{
          data: {
            user: { id?: string | null; email?: string | null } | null;
            properties?: { action_link?: string | null } | null;
          };
          error: { message?: string | null } | null;
        }>;
      };
    };
  };

  const contactEmail = String(args.contactEmail ?? "").trim().toLowerCase();
  const companyName = String(args.companyName ?? "").trim();
  if (!contactEmail) {
    throw new PartnerAccessLinkError(
      "PARTNER_EMAIL_MISSING",
      "Kontakt-E-Mail fehlt. Einladung kann nicht erstellt werden.",
      400,
    );
  }
  if (!companyName) {
    throw new PartnerAccessLinkError(
      "PARTNER_LOOKUP_FAILED",
      "Firmenname fehlt. Einladung kann nicht erstellt werden.",
      400,
    );
  }

  const redirectTo = parseInviteRedirectOrThrow(args.headers);
  const generated = await admin.auth.admin.generateLink({
    type: "invite",
    email: contactEmail,
    options: {
      data: buildPartnerAuthUserMetadata(companyName),
      redirectTo,
    },
  });

  if (generated.error) {
    throw new PartnerAccessLinkError(
      "INVITE_LINK_GENERATE_FAILED",
      String(generated.error.message ?? "Invite-Link konnte nicht erzeugt werden."),
      500,
    );
  }

  const authUserId = String(generated.data.user?.id ?? "").trim();
  if (!authUserId) {
    throw new PartnerAccessLinkError(
      "AUTH_USER_NOT_FOUND",
      "Invite-Link wurde erzeugt, aber die Auth-User-ID fehlt.",
      500,
    );
  }

  const actionLink = String(generated.data.properties?.action_link ?? "").trim();
  if (!actionLink) {
    throw new PartnerAccessLinkError(
      "INVITE_ACTION_LINK_MISSING",
      "Invite-Link wurde erzeugt, aber der Aktivierungslink fehlt.",
      500,
    );
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

export async function sendPartnerAccessLink(args: {
  admin: unknown;
  partnerId: string;
  headers: Headers;
  authUserRetryAttempts?: number;
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
          data: { user: { id?: string; email?: string | null; user_metadata?: Record<string, unknown> | null } | null };
          error: { message?: string } | null;
        }>;
        updateUserById: (
          userId: string,
          attributes: { user_metadata: Record<string, unknown> },
        ) => Promise<{ data: { user: { id?: string } | null }; error: { message?: string } | null }>;
        generateLink: (
          params: {
            type: "recovery";
            email: string;
            options?: { redirectTo?: string };
          },
        ) => Promise<{
          data: {
            properties?: { action_link?: string | null } | null;
          };
          error: { message?: string } | null;
        }>;
      };
    };
  };

  const { data: partner, error: partnerError } = await admin
    .from("partners")
    .select("id, company_name, contact_email, contact_first_name, is_active")
    .eq("id", partnerId)
    .maybeSingle();

  if (partnerError) {
    throw new PartnerAccessLinkError(
      "PARTNER_LOOKUP_FAILED",
      String(partnerError.message ?? "Partnerdaten konnten nicht geladen werden."),
      500,
    );
  }
  if (!partner) {
    throw new PartnerAccessLinkError(
      "PARTNER_NOT_FOUND",
      "Partner nicht gefunden. Einladung kann nicht versendet werden.",
      404,
    );
  }

  const email = String((partner as { contact_email?: string | null }).contact_email ?? "").trim().toLowerCase();
  if (!email) {
    throw new PartnerAccessLinkError(
      "PARTNER_EMAIL_MISSING",
      "Beim Partner ist keine Kontakt-E-Mail hinterlegt. Einladung kann nicht versendet werden.",
      400,
    );
  }

  const isActive = Boolean((partner as { is_active?: boolean | null }).is_active);
  if (isActive) {
    throw new PartnerAccessLinkError(
      "PARTNER_ALREADY_ACTIVE",
      "Der Partner ist bereits aktiv. Eine Einladung darf nur an inaktive Partner gesendet werden.",
      409,
    );
  }

  const authUser = await loadAuthUserWithRetry({
    admin,
    partnerId,
    attempts: args.authUserRetryAttempts ?? 4,
    waitMs: 250,
  });

  const authEmail = String(authUser.email ?? "").trim().toLowerCase();
  if (authEmail && authEmail !== email) {
    throw new PartnerAccessLinkError(
      "AUTH_USER_EMAIL_MISMATCH",
      "Kontakt-E-Mail und Auth-User stimmen nicht ueberein. Einladung wurde nicht versendet.",
      409,
    );
  }

  const companyName = String((partner as { company_name?: string | null }).company_name ?? "").trim();
  const redirectTo = parseInviteRedirectOrThrow(headers);
  const desiredUserMetadata = buildPartnerAuthUserMetadata(companyName);
  const currentUserMetadata = (authUser.user_metadata ?? {}) as Record<string, unknown>;
  const metadataNeedsSync = (
    String(currentUserMetadata.role ?? "").trim() !== String(desiredUserMetadata.role)
    || String(currentUserMetadata.company_name ?? "").trim() !== String(desiredUserMetadata.company_name)
    || currentUserMetadata.activation_pending !== desiredUserMetadata.activation_pending
  );

  if (metadataNeedsSync) {
    const sync = await admin.auth.admin.updateUserById(partnerId, {
      user_metadata: {
        ...currentUserMetadata,
        ...desiredUserMetadata,
      },
    });
    if (sync.error) {
      throw new PartnerAccessLinkError(
        "AUTH_USER_METADATA_SYNC_FAILED",
        String(sync.error.message ?? "Auth-Metadaten fuer die Einladung konnten nicht aktualisiert werden."),
        500,
      );
    }
  }

  const generated = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: {
      redirectTo,
    },
  });
  if (generated.error) {
    throw new PartnerAccessLinkError(
      "INVITE_LINK_GENERATE_FAILED",
      String(generated.error.message ?? "Aktivierungslink konnte nicht erzeugt werden."),
      500,
    );
  }

  const actionLink = String(generated.data.properties?.action_link ?? "").trim();
  if (!actionLink) {
    throw new PartnerAccessLinkError(
      "INVITE_ACTION_LINK_MISSING",
      "Aktivierungslink wurde erzeugt, aber der Link fehlt in der Antwort.",
      500,
    );
  }

  const mail = await sendPartnerInviteBySmtp({
    partnerEmail: email,
    partnerFirstName: String((partner as { contact_first_name?: string | null }).contact_first_name ?? ""),
    companyName,
    inviteLink: actionLink,
  });
  if (!mail.sent) {
    throw new PartnerAccessLinkError(
      "INVITE_SEND_FAILED",
      String(mail.reason ?? "Einladungsmail konnte nicht ueber SMTP versendet werden."),
      500,
    );
  }

  return {
    contactEmail: email,
    linkType: "invite",
    redirectTo,
  };
}
