import { NextResponse } from "next/server";

import { createAdminClient } from "@/utils/supabase/admin";
import { requireAdmin } from "@/lib/security/admin-auth";
import { writeSecurityAuditLog } from "@/lib/security/audit-log";
import { checkAdminApiRateLimit, extractClientIpFromHeaders } from "@/lib/security/rate-limit";
import { checkPartnerAreaMandatoryTexts } from "@/lib/partner-area-mandatory";
import { INDIVIDUAL_MANDATORY_KEYS } from "@/lib/text-key-registry";
import { MANDATORY_MEDIA_KEYS } from "@/lib/mandatory-media";
import { sendPartnerAreaApprovedEmail, sendPartnerReviewChangesRequestedEmail } from "@/lib/notifications/admin-review-email";
import { isMissingPublicLiveColumn } from "@/lib/public-partner-mappings";

type ReviewAction = "in_review" | "changes_requested" | "approve";

type ReviewPatchBody = {
  action?: ReviewAction;
  note?: string | null;
};

type ReviewField = {
  key: string;
  content: string;
  status: "approved" | "draft";
  present: boolean;
};

type MappingRow = {
  id: string;
  auth_user_id: string;
  area_id: string;
  is_active: boolean;
  is_public_live?: boolean | null;
  activation_status?: string | null;
  partner_preview_signoff_at?: string | null;
  admin_review_note?: string | null;
};

function isMissingActivationStatusColumn(error: unknown): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return (
    (msg.includes("partner_area_map.activation_status") && msg.includes("does not exist")) ||
    (msg.includes("partner_area_map.partner_submitted_at") && msg.includes("does not exist"))
  );
}

function isMissingPreviewSignoffColumn(error: unknown): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return msg.includes("partner_preview_signoff_at")
    && msg.includes("partner_area_map")
    && (msg.includes("does not exist") || msg.includes("schema cache"));
}

function isMissingAdminReviewNoteColumn(error: unknown): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return msg.includes("admin_review_note")
    && msg.includes("partner_area_map")
    && (msg.includes("does not exist") || msg.includes("schema cache"));
}

function normalizeActivationStatus(value: unknown, isActive: boolean, isPublicLive = false): string {
  if (isPublicLive) return "live";
  const raw = String(value ?? "").trim().toLowerCase();
  if (
    raw === "assigned"
    || raw === "in_progress"
    || raw === "ready_for_review"
    || raw === "in_review"
    || raw === "changes_requested"
    || raw === "approved_preview"
    || raw === "live"
    || raw === "active"
  ) {
    return raw;
  }
  if (isActive) return "approved_preview";
  return "assigned";
}

async function loadMapping(admin: ReturnType<typeof createAdminClient>, partnerId: string, areaId: string) {
  let { data, error } = await admin
    .from("partner_area_map")
    .select("id, auth_user_id, area_id, is_active, is_public_live, activation_status, partner_preview_signoff_at, admin_review_note")
    .eq("auth_user_id", partnerId)
    .eq("area_id", areaId)
    .maybeSingle();

  if (error && (isMissingActivationStatusColumn(error) || isMissingPublicLiveColumn(error) || isMissingPreviewSignoffColumn(error) || isMissingAdminReviewNoteColumn(error))) {
    const missingActivationStatus = isMissingActivationStatusColumn(error);
    const missingPublicLive = isMissingPublicLiveColumn(error);
    const missingPreviewSignoff = isMissingPreviewSignoffColumn(error);
    const missingAdminReviewNote = isMissingAdminReviewNoteColumn(error);

    if ((missingPreviewSignoff || missingAdminReviewNote) && !missingActivationStatus && !missingPublicLive) {
      const fallback = await admin
        .from("partner_area_map")
        .select("id, auth_user_id, area_id, is_active, is_public_live, activation_status")
        .eq("auth_user_id", partnerId)
        .eq("area_id", areaId)
        .maybeSingle();
      data = fallback.data
        ? {
          ...fallback.data,
          partner_preview_signoff_at: null,
          admin_review_note: null,
        }
        : null;
      error = fallback.error;
    } else {
      const fallback = await admin
        .from("partner_area_map")
        .select("id, auth_user_id, area_id, is_active")
        .eq("auth_user_id", partnerId)
        .eq("area_id", areaId)
        .maybeSingle();
      data = fallback.data ? { ...fallback.data, activation_status: null, is_public_live: null, partner_preview_signoff_at: null, admin_review_note: null } : null;
      error = fallback.error;
    }
  }

  return { data: data as MappingRow | null, error };
}

async function fetchReviewFields(admin: ReturnType<typeof createAdminClient>, partnerId: string, areaId: string): Promise<ReviewField[]> {
  const { data } = await admin
    .from("report_texts")
    .select("section_key, optimized_content, status")
    .eq("partner_id", partnerId)
    .eq("area_id", areaId);

  const rows = Array.isArray(data) ? data : [];
  const byKey = new Map<string, { content: string; status: string }>();
  for (const row of rows) {
    const key = String((row as { section_key?: string }).section_key ?? "");
    if (!key) continue;
    const content = String((row as { optimized_content?: string | null }).optimized_content ?? "");
    const status = String((row as { status?: string | null }).status ?? "draft");
    if (!byKey.has(key)) byKey.set(key, { content, status });
  }

  const keys = [...INDIVIDUAL_MANDATORY_KEYS, ...MANDATORY_MEDIA_KEYS];
  return keys.map((key) => {
    const row = byKey.get(key);
    const content = String(row?.content ?? "");
    const status = row?.status === "approved" ? "approved" : "draft";
    return {
      key,
      content,
      status,
      present: content.trim().length > 0,
    };
  });
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string; area_id: string }> },
) {
  try {
    const adminUser = await requireAdmin(["admin_super", "admin_ops"]);
    const adminRate = await checkAdminApiRateLimit(req, adminUser.userId);
    if (!adminRate.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(adminRate.retryAfterSec) } },
      );
    }

    const params = await ctx.params;
    const partnerId = String(params.id ?? "").trim();
    const areaId = String(params.area_id ?? "").trim();
    if (!partnerId || !areaId) {
      return NextResponse.json({ error: "Missing partner id or area id" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: mapping, error: mappingError } = await loadMapping(admin, partnerId, areaId);
    if (mappingError) return NextResponse.json({ error: mappingError.message }, { status: 500 });
    if (!mapping) return NextResponse.json({ error: "Mapping not found" }, { status: 404 });

    const mandatoryCheck = await checkPartnerAreaMandatoryTexts({
      admin,
      partnerId,
      areaId,
      requireApprovedMedia: false,
    });
    const fields = await fetchReviewFields(admin, partnerId, areaId);

    return NextResponse.json({
      ok: true,
      mapping: {
        ...mapping,
        activation_status: normalizeActivationStatus(
          mapping.activation_status,
          Boolean(mapping.is_active),
          Boolean(mapping.is_public_live),
        ),
      },
      mandatory: mandatoryCheck,
      fields,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string; area_id: string }> },
) {
  try {
    const adminUser = await requireAdmin(["admin_super", "admin_ops"]);
    const adminRate = await checkAdminApiRateLimit(req, adminUser.userId);
    if (!adminRate.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(adminRate.retryAfterSec) } },
      );
    }

    const params = await ctx.params;
    const partnerId = String(params.id ?? "").trim();
    const areaId = String(params.area_id ?? "").trim();
    if (!partnerId || !areaId) {
      return NextResponse.json({ error: "Missing partner id or area id" }, { status: 400 });
    }

    const body = (await req.json()) as ReviewPatchBody;
    const action = String(body.action ?? "").trim() as ReviewAction;
    if (!action || !["in_review", "changes_requested", "approve"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: mapping, error: mappingError } = await loadMapping(admin, partnerId, areaId);
    if (mappingError) return NextResponse.json({ error: mappingError.message }, { status: 500 });
    if (!mapping) return NextResponse.json({ error: "Mapping not found" }, { status: 404 });

    if (action === "approve") {
      const { data: activeAssignedRows, error: activeAssignedError } = await admin
        .from("partner_area_map")
        .select("auth_user_id")
        .eq("area_id", areaId)
        .eq("is_active", true)
        .neq("auth_user_id", partnerId)
        .limit(1);
      if (activeAssignedError) {
        return NextResponse.json({ error: activeAssignedError.message }, { status: 500 });
      }
      if (Array.isArray(activeAssignedRows) && activeAssignedRows.length > 0) {
        return NextResponse.json({ error: "Area is already active on another partner" }, { status: 409 });
      }
    }

    const mandatoryCheck = await checkPartnerAreaMandatoryTexts({
      admin,
      partnerId,
      areaId,
      requireApprovedMedia: false,
    });
    if (action === "approve" && !mandatoryCheck.ok) {
      return NextResponse.json(
        {
          error: mandatoryCheck.error,
          missing_keys: mandatoryCheck.missing ?? [],
          scope: mandatoryCheck.scope,
          gate: "INDIVIDUAL_MANDATORY",
        },
        { status: mandatoryCheck.status },
      );
    }

    const reviewNote = String(body.note ?? "").trim();
    if (action === "changes_requested" && !reviewNote) {
      return NextResponse.json({ error: "Hinweis fuer die Nachbesserung fehlt." }, { status: 400 });
    }

    const nextPatch = action === "approve"
      ? { is_active: true, is_public_live: false, activation_status: "approved_preview", partner_preview_signoff_at: null, admin_review_note: null }
      : { is_active: false, is_public_live: false, activation_status: action, partner_preview_signoff_at: null, admin_review_note: reviewNote || null };

    let { data: updated, error: updateError } = await admin
      .from("partner_area_map")
      .update(nextPatch)
      .eq("auth_user_id", partnerId)
      .eq("area_id", areaId)
      .select("id, auth_user_id, area_id, is_active, is_public_live, activation_status, partner_preview_signoff_at, admin_review_note, created_at")
      .maybeSingle();

    if (updateError && (isMissingActivationStatusColumn(updateError) || isMissingPublicLiveColumn(updateError) || isMissingPreviewSignoffColumn(updateError) || isMissingAdminReviewNoteColumn(updateError))) {
      const fallbackPatch = action === "approve"
        ? { is_active: true, is_public_live: false, activation_status: "approved_preview" }
        : { is_active: false, is_public_live: false, activation_status: action, ...(reviewNote ? { admin_review_note: reviewNote } : {}) };
      const missingActivationStatus = isMissingActivationStatusColumn(updateError);
      const missingPublicLive = isMissingPublicLiveColumn(updateError);
      const missingPreviewSignoff = isMissingPreviewSignoffColumn(updateError);
      const missingAdminReviewNote = isMissingAdminReviewNoteColumn(updateError);

      if ((missingPreviewSignoff || missingAdminReviewNote) && !missingActivationStatus && !missingPublicLive) {
        const fallback = await admin
          .from("partner_area_map")
          .update(fallbackPatch)
          .eq("auth_user_id", partnerId)
          .eq("area_id", areaId)
          .select("id, auth_user_id, area_id, is_active, is_public_live, activation_status, created_at")
          .maybeSingle();
        updated = fallback.data
          ? {
            ...fallback.data,
            partner_preview_signoff_at: null,
            admin_review_note: missingAdminReviewNote ? null : (reviewNote || null),
          }
          : null;
        updateError = fallback.error;
      } else {
        const fallback = await admin
          .from("partner_area_map")
          .update(action === "approve" ? { is_active: true } : { is_active: false })
          .eq("auth_user_id", partnerId)
          .eq("area_id", areaId)
          .select("id, auth_user_id, area_id, is_active, created_at")
          .maybeSingle();
        updated = fallback.data
          ? {
            ...fallback.data,
            activation_status: action === "approve" ? "approved_preview" : action,
            is_public_live: null,
            partner_preview_signoff_at: null,
            admin_review_note: missingAdminReviewNote ? null : (action === "changes_requested" ? reviewNote : null),
          }
          : null;
        updateError = fallback.error;
      }
    }

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    if (!updated) return NextResponse.json({ error: "Mapping not found" }, { status: 404 });

    await writeSecurityAuditLog({
      actorUserId: adminUser.userId,
      actorRole: adminUser.role,
      eventType: "update",
      entityType: "partner_area_map",
      entityId: String(updated.id),
      payload: {
        action: `admin_review_${action}`,
        partner_id: partnerId,
        area_id: areaId,
        is_active: updated.is_active,
        is_public_live: Boolean((updated as { is_public_live?: boolean | null }).is_public_live),
        activation_status: String((updated as { activation_status?: string | null }).activation_status ?? (action === "approve" ? "approved_preview" : action)),
        admin_review_note: action === "changes_requested" ? reviewNote : null,
      },
      ip: extractClientIpFromHeaders(req.headers),
      userAgent: req.headers.get("user-agent"),
    });

    let partnerApprovalMailSent = false;
    let partnerApprovalMailReason: string | undefined;
    if (action === "approve" || action === "changes_requested") {
      try {
        const [partnerRes, areaRes] = await Promise.all([
          admin
            .from("partners")
            .select("id, company_name, contact_email, contact_first_name")
            .eq("id", partnerId)
            .maybeSingle(),
          admin
            .from("areas")
            .select("id, name")
            .eq("id", areaId)
            .maybeSingle(),
        ]);
        const partnerMail = action === "approve"
          ? await sendPartnerAreaApprovedEmail({
            partnerEmail: String(partnerRes.data?.contact_email ?? "").trim(),
            partnerName: String(partnerRes.data?.contact_first_name ?? "").trim()
              || String(partnerRes.data?.company_name ?? "").trim()
              || partnerId,
            areaId,
            areaName: String(areaRes.data?.name ?? "").trim() || areaId,
            approvedAtIso: new Date().toISOString(),
          })
          : await sendPartnerReviewChangesRequestedEmail({
            partnerEmail: String(partnerRes.data?.contact_email ?? "").trim(),
            partnerName: String(partnerRes.data?.contact_first_name ?? "").trim()
              || String(partnerRes.data?.company_name ?? "").trim()
              || partnerId,
            areaId,
            areaName: String(areaRes.data?.name ?? "").trim() || areaId,
            requestedAtIso: new Date().toISOString(),
            note: reviewNote,
          });
        partnerApprovalMailSent = partnerMail.sent;
        partnerApprovalMailReason = partnerMail.reason;
        if (!partnerMail.sent) {
          console.warn("partner review mail not sent:", partnerMail.reason);
        }
      } catch (mailErr) {
        partnerApprovalMailSent = false;
        partnerApprovalMailReason = mailErr instanceof Error ? mailErr.message : "mail_error";
        console.warn("partner review mail failed:", mailErr);
      }

      await writeSecurityAuditLog({
        actorUserId: adminUser.userId,
        actorRole: adminUser.role,
        eventType: "other",
        entityType: "other",
        entityId: `${areaId}:${action}:partner_mail`,
        payload: {
          action: action === "approve" ? "mail_admin_approve_partner_notify" : "mail_admin_changes_requested_partner_notify",
          area_id: areaId,
          partner_id: partnerId,
          sent: partnerApprovalMailSent,
          reason: partnerApprovalMailReason ?? null,
        },
        ip: extractClientIpFromHeaders(req.headers),
        userAgent: req.headers.get("user-agent"),
      });
    }

    const fields = await fetchReviewFields(admin, partnerId, areaId);
    return NextResponse.json({
      ok: true,
      mapping: {
        ...updated,
        activation_status: normalizeActivationStatus(
          (updated as { activation_status?: string | null }).activation_status,
          Boolean((updated as { is_active?: boolean | null }).is_active),
          Boolean((updated as { is_public_live?: boolean | null }).is_public_live),
        ),
      },
      mandatory: mandatoryCheck,
      fields,
      notification: action === "approve"
        || action === "changes_requested"
        ? {
          partner: {
            sent: partnerApprovalMailSent,
            reason: partnerApprovalMailReason ?? null,
          },
        }
        : null,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
