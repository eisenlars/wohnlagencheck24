import { sendAdminInviteResendRequestEmail } from "@/lib/notifications/admin-review-email";
import { writeSecurityAuditLog } from "@/lib/security/audit-log";
import { extractClientIpFromHeaders } from "@/lib/security/rate-limit";
import { createAdminClient } from "@/utils/supabase/admin";

export function normalizeNetworkPartnerInviteRequestEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export async function notifyPortalPartnerAboutNetworkPartnerInviteRequest(args: {
  email: string;
  headers: Headers;
}) {
  const email = normalizeNetworkPartnerInviteRequestEmail(args.email);
  if (!email) return { matched: false };

  const admin = createAdminClient();
  const { data: networkPartner } = await admin
    .from("network_partners")
    .select("id, portal_partner_id, company_name, contact_email")
    .eq("contact_email", email)
    .maybeSingle();

  const networkPartnerId = String((networkPartner as { id?: string } | null)?.id ?? "").trim();
  const portalPartnerId = String((networkPartner as { portal_partner_id?: string } | null)?.portal_partner_id ?? "").trim();
  if (!networkPartnerId || !portalPartnerId) return { matched: false };

  const { data: portalPartner } = await admin
    .from("partners")
    .select("id, company_name, contact_email, is_active")
    .eq("id", portalPartnerId)
    .maybeSingle();

  const portalPartnerEmail = String((portalPartner as { contact_email?: string | null } | null)?.contact_email ?? "").trim().toLowerCase();
  if (!portalPartnerEmail) return { matched: false };

  const requestedAtIso = new Date().toISOString();
  const networkPartnerName = String((networkPartner as { company_name?: string | null } | null)?.company_name ?? "").trim() || null;
  const portalPartnerName = String((portalPartner as { company_name?: string | null } | null)?.company_name ?? "").trim() || null;
  const portalPartnerIsActive = Boolean((portalPartner as { is_active?: boolean } | null)?.is_active);

  try {
    await sendAdminInviteResendRequestEmail({
      email,
      audience: "network_partner",
      requestedAtIso,
      partnerId: portalPartnerId,
      partnerName: portalPartnerName,
      partnerIsActive: portalPartnerIsActive,
      networkPartnerId,
      networkPartnerName,
      recipients: [portalPartnerEmail],
    });
  } catch {
    // Request should not fail outward because of email delivery issues.
  }

  await writeSecurityAuditLog({
    actorUserId: "system:network_partner_invite_request",
    actorRole: "system",
    eventType: "other",
    entityType: "auth_user",
    entityId: networkPartnerId,
    payload: {
      action: "network_partner_invite_resend_requested",
      email,
      network_partner_id: networkPartnerId,
      network_partner_name: networkPartnerName,
      portal_partner_id: portalPartnerId,
      portal_partner_name: portalPartnerName,
      requested_at: requestedAtIso,
    },
    ip: extractClientIpFromHeaders(args.headers),
    userAgent: args.headers.get("user-agent"),
  });

  return {
    matched: true,
    networkPartnerId,
    networkPartnerName,
    portalPartnerId,
    portalPartnerName,
  };
}
