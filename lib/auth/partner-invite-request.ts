import { sendAdminInviteResendRequestEmail } from "@/lib/notifications/admin-review-email";
import { writeSecurityAuditLog } from "@/lib/security/audit-log";
import { extractClientIpFromHeaders } from "@/lib/security/rate-limit";
import { createAdminClient } from "@/utils/supabase/admin";

export function normalizePartnerInviteRequestEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export async function notifyAdminAboutPartnerInviteRequest(args: {
  email: string;
  headers: Headers;
}) {
  const email = normalizePartnerInviteRequestEmail(args.email);
  if (!email) return { matched: false };

  const admin = createAdminClient();
  const { data: partner } = await admin
    .from("partners")
    .select("id, company_name, contact_email, is_active")
    .eq("contact_email", email)
    .maybeSingle();

  const partnerId = String((partner as { id?: string } | null)?.id ?? "").trim();
  if (!partnerId) return { matched: false };

  const requestedAtIso = new Date().toISOString();
  const partnerName = String((partner as { company_name?: string | null } | null)?.company_name ?? "").trim() || null;
  const partnerIsActive = Boolean((partner as { is_active?: boolean } | null)?.is_active);

  try {
    await sendAdminInviteResendRequestEmail({
      email,
      audience: "partner",
      requestedAtIso,
      partnerId,
      partnerName,
      partnerIsActive,
    });
  } catch {
    // Die Anfrage soll selbst bei Mailproblemen nicht nach außen fehlschlagen.
  }

  await writeSecurityAuditLog({
    actorUserId: "system:partner_invite_request",
    actorRole: "system",
    eventType: "other",
    entityType: "auth_user",
    entityId: partnerId,
    payload: {
      action: "partner_invite_resend_requested",
      email,
      partner_id: partnerId,
      partner_name: partnerName,
      partner_is_active: partnerIsActive,
      requested_at: requestedAtIso,
    },
    ip: extractClientIpFromHeaders(args.headers),
    userAgent: args.headers.get("user-agent"),
  });

  return {
    matched: true,
    partnerId,
    partnerName,
    partnerIsActive,
  };
}
