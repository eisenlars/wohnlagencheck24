import { NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { checkRateLimitPersistent, extractClientIpFromHeaders } from "@/lib/security/rate-limit";
import { writeSecurityAuditLog } from "@/lib/security/audit-log";
import {
  sendAdminPreviewSignoffEmail,
  sendPartnerPreviewSignoffEmail,
} from "@/lib/notifications/admin-review-email";

function parseCsv(value: string): string[] {
  return String(value ?? "")
    .split(/[,\n;]+/)
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

function isMissingPreviewSignoffColumn(error: unknown): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return msg.includes("partner_area_map.partner_preview_signoff_at") && msg.includes("does not exist");
}

async function requirePartnerUser(req: Request): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    throw new Error("UNAUTHORIZED");
  }

  const ip = extractClientIpFromHeaders(req.headers);
  const limit = await checkRateLimitPersistent(
    `partner_request_live:${user.id}:${ip}`,
    { windowMs: 60 * 1000, max: 20 },
  );
  if (!limit.allowed) {
    throw new Error(`RATE_LIMIT:${limit.retryAfterSec}`);
  }
  return user.id;
}

async function resolveAdminNotificationRecipients(admin: ReturnType<typeof createAdminClient>): Promise<string[]> {
  const explicit = Array.from(new Set([
    ...parseCsv(String(process.env.ADMIN_REVIEW_NOTIFY_TO ?? "")),
    ...parseCsv(String(process.env.SMTP_TO ?? "")),
  ]));
  if (explicit.length > 0) return explicit;

  const candidateIds = Array.from(new Set([
    ...parseCsv(String(process.env.ADMIN_SUPER_USER_IDS ?? "")),
    ...parseCsv(String(process.env.ADMIN_OPS_USER_IDS ?? "")),
  ]));
  if (candidateIds.length === 0) return [];

  const results = await Promise.all(
    candidateIds.map(async (userId) => {
      const { data, error } = await admin.auth.admin.getUserById(userId);
      if (error) return null;
      return String(data.user?.email ?? "").trim() || null;
    }),
  );
  const fromIds = Array.from(new Set(results.filter((v): v is string => Boolean(v))));
  if (fromIds.length > 0) return fromIds;
  const smtpUser = String(process.env.SMTP_USER ?? "").trim();
  if (smtpUser) return [smtpUser];
  return [];
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ area_id: string }> },
) {
  try {
    const userId = await requirePartnerUser(req);
    const params = await ctx.params;
    const areaId = String(params.area_id ?? "").trim();
    if (!areaId) {
      return NextResponse.json({ error: "Missing area id" }, { status: 400 });
    }

    const admin = createAdminClient();
    let { data: mapping, error: mappingError } = await admin
      .from("partner_area_map")
      .select("id, auth_user_id, area_id, is_active, is_public_live, activation_status, partner_preview_signoff_at")
      .eq("auth_user_id", userId)
      .eq("area_id", areaId)
      .maybeSingle();

    if (mappingError && isMissingPreviewSignoffColumn(mappingError)) {
      const fallback = await admin
        .from("partner_area_map")
        .select("id, auth_user_id, area_id, is_active, is_public_live, activation_status")
        .eq("auth_user_id", userId)
        .eq("area_id", areaId)
        .maybeSingle();
      mapping = fallback.data ? { ...fallback.data, partner_preview_signoff_at: null } : null;
      mappingError = fallback.error;
    }

    if (mappingError) {
      return NextResponse.json({ error: mappingError.message }, { status: 500 });
    }
    if (!mapping) {
      return NextResponse.json({ error: "Area assignment not found" }, { status: 404 });
    }

    const activationStatus = String((mapping as { activation_status?: string | null }).activation_status ?? "").trim().toLowerCase();
    if (Boolean((mapping as { is_public_live?: boolean | null }).is_public_live) || activationStatus === "live") {
      return NextResponse.json({ error: "Gebiet ist bereits online." }, { status: 409 });
    }
    if (activationStatus !== "approved_preview" && !Boolean((mapping as { is_active?: boolean | null }).is_active)) {
      return NextResponse.json({ error: "Gebiet ist noch nicht fuer die Previewphase freigegeben." }, { status: 409 });
    }

    const existingSignoff = String((mapping as { partner_preview_signoff_at?: string | null }).partner_preview_signoff_at ?? "").trim();
    if (existingSignoff) {
      return NextResponse.json({
        ok: true,
        mapping: {
          ...mapping,
          partner_preview_signoff_at: existingSignoff,
        },
        notification: null,
      });
    }

    const signedOffAtIso = new Date().toISOString();
    const { data: updated, error: updateError } = await admin
      .from("partner_area_map")
      .update({ partner_preview_signoff_at: signedOffAtIso })
      .eq("auth_user_id", userId)
      .eq("area_id", areaId)
      .select("id, auth_user_id, area_id, is_active, is_public_live, activation_status, partner_preview_signoff_at, created_at")
      .maybeSingle();

    if (updateError && isMissingPreviewSignoffColumn(updateError)) {
      return NextResponse.json(
        { error: "partner_area_map.partner_preview_signoff_at fehlt. Bitte DB-Migration zuerst ausführen." },
        { status: 500 },
      );
    }

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
    if (!updated) {
      return NextResponse.json({ error: "Area assignment not found" }, { status: 404 });
    }

    await writeSecurityAuditLog({
      actorUserId: userId,
      actorRole: "system",
      eventType: "other",
      entityType: "partner_area_map",
      entityId: String(updated.id),
      payload: {
        action: "partner_request_live",
        area_id: areaId,
        partner_preview_signoff_at: signedOffAtIso,
      },
      ip: extractClientIpFromHeaders(req.headers),
      userAgent: req.headers.get("user-agent"),
    });

    let adminMailSent = false;
    let adminMailReason: string | undefined;
    let partnerMailSent = false;
    let partnerMailReason: string | undefined;

    try {
      const [partnerRes, areaRes] = await Promise.all([
        admin
          .from("partners")
          .select("id, company_name, contact_email, contact_first_name")
          .eq("id", userId)
          .maybeSingle(),
        admin
          .from("areas")
          .select("id, name")
          .eq("id", areaId)
          .maybeSingle(),
      ]);
      const partnerName = String(partnerRes.data?.company_name ?? userId);
      const areaName = String(areaRes.data?.name ?? areaId);
      const recipients = await resolveAdminNotificationRecipients(admin);

      const adminMailResult = await sendAdminPreviewSignoffEmail({
        areaId,
        areaName,
        partnerId: userId,
        partnerName,
        signedOffAtIso,
        recipients,
      });
      adminMailSent = adminMailResult.sent;
      adminMailReason = adminMailResult.reason;

      const partnerMailResult = await sendPartnerPreviewSignoffEmail({
        partnerEmail: String(partnerRes.data?.contact_email ?? "").trim(),
        partnerName: String(partnerRes.data?.contact_first_name ?? "").trim() || partnerName,
        areaId,
        areaName,
        signedOffAtIso,
      });
      partnerMailSent = partnerMailResult.sent;
      partnerMailReason = partnerMailResult.reason;
    } catch (mailErr) {
      const reason = mailErr instanceof Error ? mailErr.message : "mail_error";
      adminMailReason = adminMailReason ?? reason;
      partnerMailReason = partnerMailReason ?? reason;
      console.warn("preview signoff mails failed:", mailErr);
    }

    await writeSecurityAuditLog({
      actorUserId: userId,
      actorRole: "system",
      eventType: "other",
      entityType: "other",
      entityId: `${areaId}:request_live:admin_mail`,
      payload: {
        action: "mail_partner_request_live_admin_notify",
        area_id: areaId,
        partner_id: userId,
        sent: adminMailSent,
        reason: adminMailReason ?? null,
      },
      ip: extractClientIpFromHeaders(req.headers),
      userAgent: req.headers.get("user-agent"),
    });

    await writeSecurityAuditLog({
      actorUserId: userId,
      actorRole: "system",
      eventType: "other",
      entityType: "other",
      entityId: `${areaId}:request_live:partner_mail`,
      payload: {
        action: "mail_partner_request_live_partner_confirm",
        area_id: areaId,
        partner_id: userId,
        sent: partnerMailSent,
        reason: partnerMailReason ?? null,
      },
      ip: extractClientIpFromHeaders(req.headers),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({
      ok: true,
      mapping: updated,
      notification: {
        admin: { sent: adminMailSent, reason: adminMailReason ?? null },
        partner: { sent: partnerMailSent, reason: partnerMailReason ?? null },
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message.startsWith("RATE_LIMIT:")) {
        const retryAfter = Number(error.message.split(":")[1] ?? "60");
        return NextResponse.json(
          { error: "Too many requests" },
          { status: 429, headers: { "Retry-After": String(Number.isFinite(retryAfter) ? retryAfter : 60) } },
        );
      }
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
