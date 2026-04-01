import { NextResponse } from "next/server";

import { createAdminClient } from "@/utils/supabase/admin";
import { requireAdmin } from "@/lib/security/admin-auth";
import { writeSecurityAuditLog } from "@/lib/security/audit-log";
import { checkAdminApiRateLimit, extractClientIpFromHeaders } from "@/lib/security/rate-limit";
import {
  formatPartnerAccessLinkError,
  generatePartnerInviteForNewUser,
  sendPartnerInviteBySmtp,
} from "@/lib/auth/partner-access-link";

type CreatePartnerBody = {
  company_name?: string;
  contact_email?: string | null;
  contact_first_name?: string | null;
  contact_last_name?: string | null;
  website_url?: string | null;
  is_active?: boolean;
  is_system_default?: boolean;
  llm_partner_managed_allowed?: boolean;
  llm_mode_default?: string | null;
};

type PartnerAreaSummary = {
  total_areas: number;
  live_areas: number;
  activation_open: number;
  has_assignment: boolean;
};

function isMissingIsActiveColumn(error: unknown): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return msg.includes("partners.is_active") && msg.includes("does not exist");
}

function isMissingPartnerNameColumns(error: unknown): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  if (!msg.includes("does not exist")) return false;
  return (
    msg.includes("partners.contact_first_name")
    || msg.includes("partners.contact_last_name")
  );
}

function isMissingPartnerLlmPolicyColumns(error: unknown): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  if (!msg.includes("does not exist")) return false;
  return (
    msg.includes("partners.llm_partner_managed_allowed")
    || msg.includes("partners.llm_mode_default")
  );
}

function isMissingPartnerSystemDefaultColumn(error: unknown): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return msg.includes("partners.is_system_default") && msg.includes("does not exist");
}

function withPartnerFallback<T extends Record<string, unknown>>(row: T, includeIsActive: boolean): T & {
  contact_first_name: null;
  contact_last_name: null;
  is_active: boolean;
  is_system_default: boolean;
  llm_partner_managed_allowed: boolean;
  llm_mode_default: string;
} {
  return {
    ...row,
    contact_first_name: null,
    contact_last_name: null,
    is_active: includeIsActive ? Boolean((row as { is_active?: unknown }).is_active) : true,
    is_system_default: Boolean((row as { is_system_default?: unknown }).is_system_default),
    llm_partner_managed_allowed: Boolean((row as { llm_partner_managed_allowed?: unknown }).llm_partner_managed_allowed),
    llm_mode_default: String((row as { llm_mode_default?: unknown }).llm_mode_default ?? "central_managed"),
  };
}

function normalizeNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function isMissingAreaActivationStatusColumn(error: unknown): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return (
    msg.includes("partner_area_map.activation_status") && msg.includes("does not exist")
  ) || (
    msg.includes("partner_area_map.is_public_live") && msg.includes("does not exist")
  );
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

async function loadPartnerAreaSummaries(
  admin: ReturnType<typeof createAdminClient>,
  partnerIds: string[],
): Promise<Map<string, PartnerAreaSummary>> {
  const byPartner = new Map<string, PartnerAreaSummary>();
  if (partnerIds.length === 0) return byPartner;

  let { data: mappings, error: mappingError } = await admin
    .from("partner_area_map")
    .select("auth_user_id, area_id, is_active, is_public_live, activation_status")
    .in("auth_user_id", partnerIds)
    .order("area_id", { ascending: true });

  if (mappingError && isMissingAreaActivationStatusColumn(mappingError)) {
    const fallback = await admin
      .from("partner_area_map")
      .select("auth_user_id, area_id, is_active")
      .in("auth_user_id", partnerIds)
      .order("area_id", { ascending: true });
    mappings = (fallback.data ?? []).map((row) => {
      const baseRow = (row && typeof row === "object" ? row : {}) as Record<string, unknown>;
      return {
        auth_user_id: typeof baseRow.auth_user_id === "string" ? baseRow.auth_user_id : "",
        area_id: typeof baseRow.area_id === "string" ? baseRow.area_id : "",
        is_active: typeof baseRow.is_active === "boolean" ? baseRow.is_active : false,
        is_public_live: false,
        activation_status: null,
      };
    });
    mappingError = fallback.error;
  }

  if (mappingError) {
    throw new Error(mappingError.message);
  }

  const groupedByPartner = new Map<string, Map<string, { live: boolean; open: boolean }>>();
  for (const row of (mappings ?? []) as Array<{
    auth_user_id?: string | null;
    area_id?: string | null;
    is_active?: boolean | null;
    is_public_live?: boolean | null;
    activation_status?: string | null;
  }>) {
    const partnerId = String(row.auth_user_id ?? "").trim();
    const areaId = String(row.area_id ?? "").trim();
    if (!partnerId || !areaId) continue;
    const kreisId = areaId.split("-").slice(0, 3).join("-");
    if (kreisId.split("-").length !== 3) continue;
    const state = normalizeActivationStatus(row.activation_status, Boolean(row.is_active), Boolean(row.is_public_live));
    const live = state === "live";
    const partnerAreas = groupedByPartner.get(partnerId) ?? new Map<string, { live: boolean; open: boolean }>();
    const current = partnerAreas.get(kreisId) ?? { live: false, open: false };
    if (live) {
      current.live = true;
      current.open = false;
    } else if (!current.live) {
      current.open = true;
    }
    partnerAreas.set(kreisId, current);
    groupedByPartner.set(partnerId, partnerAreas);
  }

  for (const partnerId of partnerIds) {
    const groupedAreas = groupedByPartner.get(partnerId) ?? new Map<string, { live: boolean; open: boolean }>();
    let liveAreas = 0;
    let activationOpen = 0;
    for (const areaState of groupedAreas.values()) {
      if (areaState.live) liveAreas += 1;
      if (areaState.open) activationOpen += 1;
    }
    byPartner.set(partnerId, {
      total_areas: groupedAreas.size,
      live_areas: liveAreas,
      activation_open: activationOpen,
      has_assignment: groupedAreas.size > 0,
    });
  }

  return byPartner;
}

async function cleanupCreatedPartner(admin: ReturnType<typeof createAdminClient>, partnerId: string) {
  if (!partnerId) return;

  try {
    await admin.from("partners").delete().eq("id", partnerId);
  } catch (error) {
    console.warn("partner cleanup failed:", error);
  }

  try {
    await admin.auth.admin.deleteUser(partnerId);
  } catch (error) {
    console.warn("auth user cleanup failed:", error);
  }
}

export async function POST(req: Request) {
  try {
    const adminUser = await requireAdmin(["admin_super", "admin_ops"]);
    const adminRate = await checkAdminApiRateLimit(req, adminUser.userId);
    if (!adminRate.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(adminRate.retryAfterSec) } },
      );
    }

    const body = (await req.json()) as CreatePartnerBody;
    const companyName = normalizeNullableString(body.company_name);
    const contactEmail = normalizeNullableString(body.contact_email)?.toLowerCase() ?? null;
    const contactFirstName = normalizeNullableString(body.contact_first_name);
    const contactLastName = normalizeNullableString(body.contact_last_name);

    if (body.is_system_default === true) {
      return NextResponse.json(
        { error: "System default partners cannot be created through the regular invite flow." },
        { status: 400 },
      );
    }

    if (!companyName || !contactEmail || !contactFirstName || !contactLastName) {
      return NextResponse.json(
        { error: "Missing required fields: company_name, contact_email, contact_first_name, contact_last_name" },
        { status: 400 },
      );
    }

    const admin = createAdminClient();
    let inviteDraft;
    try {
      inviteDraft = await generatePartnerInviteForNewUser({
        admin,
        headers: req.headers,
        companyName,
        contactEmail,
      });
    } catch (error) {
      const formatted = formatPartnerAccessLinkError(error);
      const msg = String(formatted.message ?? "").trim();
      const lower = msg.toLowerCase();
      if (lower.includes("already") || lower.includes("exists") || lower.includes("registered")) {
        const { data: existingPartner } = await admin
          .from("partners")
          .select("id")
          .eq("contact_email", contactEmail)
          .maybeSingle();
        return NextResponse.json(
          {
            error: "Auth user already exists for this email. Please use existing user flow.",
            partner_id: String((existingPartner as { id?: string } | null)?.id ?? "").trim() || null,
          },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: msg || "Invite-Link konnte nicht erzeugt werden." }, { status: formatted.status });
    }

    const authUserId = normalizeNullableString(inviteDraft.authUserId);
    if (!authUserId) {
      return NextResponse.json({ error: "Invite-Link erstellt, aber Auth-User-ID fehlt." }, { status: 500 });
    }

    const payload = {
      id: authUserId,
      company_name: companyName,
      contact_email: contactEmail,
      contact_first_name: contactFirstName,
      contact_last_name: contactLastName,
      website_url: normalizeNullableString(body.website_url),
      // Neu angelegte Partner bleiben inaktiv, bis sie ihren Account-Flow abgeschlossen haben.
      is_active: body.is_active === true ? true : false,
      is_system_default: false,
      llm_partner_managed_allowed: body.llm_partner_managed_allowed === true,
      llm_mode_default: normalizeNullableString(body.llm_mode_default) ?? "central_managed",
    };

    let { data, error } = await admin
      .from("partners")
      .upsert(payload, { onConflict: "id" })
      .select("id, company_name, contact_email, contact_first_name, contact_last_name, website_url, is_active, is_system_default, llm_partner_managed_allowed, llm_mode_default, created_at")
      .single();

    if (error && (isMissingIsActiveColumn(error) || isMissingPartnerNameColumns(error) || isMissingPartnerLlmPolicyColumns(error) || isMissingPartnerSystemDefaultColumn(error))) {
      const missingIsActive = isMissingIsActiveColumn(error);
      const missingNames = isMissingPartnerNameColumns(error);
      const missingLlm = isMissingPartnerLlmPolicyColumns(error);
      const missingSystemDefault = isMissingPartnerSystemDefaultColumn(error);
      const fallbackPayload: Record<string, unknown> = {
        id: authUserId,
        company_name: companyName,
        contact_email: contactEmail,
        website_url: normalizeNullableString(body.website_url),
      };
      if (!missingNames) {
        fallbackPayload.contact_first_name = contactFirstName;
        fallbackPayload.contact_last_name = contactLastName;
      }
      if (!missingIsActive) {
        fallbackPayload.is_active = body.is_active === true ? true : false;
      }
      if (!missingSystemDefault) {
        fallbackPayload.is_system_default = false;
      }
      if (!missingLlm) {
        fallbackPayload.llm_partner_managed_allowed = body.llm_partner_managed_allowed === true;
        fallbackPayload.llm_mode_default = normalizeNullableString(body.llm_mode_default) ?? "central_managed";
      }
      const fallbackSelect = [
        "id",
        "company_name",
        "contact_email",
        ...(!missingNames ? ["contact_first_name", "contact_last_name"] : []),
        "website_url",
        ...(!missingIsActive ? ["is_active"] : []),
        ...(!missingSystemDefault ? ["is_system_default"] : []),
        ...(!missingLlm ? ["llm_partner_managed_allowed", "llm_mode_default"] : []),
        "created_at",
      ].join(", ");
      const fallback = await admin
        .from("partners")
        .upsert(fallbackPayload, { onConflict: "id" })
        .select(fallbackSelect)
        .single();
      data = fallback.data
        ? (withPartnerFallback(
            fallback.data as unknown as Record<string, unknown>,
            !missingIsActive,
          ) as typeof data)
        : null;
      error = fallback.error;
    }

    if (error) {
      await cleanupCreatedPartner(admin, authUserId);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      await cleanupCreatedPartner(admin, authUserId);
      return NextResponse.json({ error: "Partner could not be created" }, { status: 500 });
    }

    const delivery = {
      sent: false,
      contactEmail: inviteDraft.contactEmail,
      linkType: inviteDraft.linkType,
      redirectTo: inviteDraft.redirectTo,
    };
    try {
      const mail = await sendPartnerInviteBySmtp({
        partnerEmail: contactEmail,
        partnerFirstName: contactFirstName,
        companyName,
        inviteLink: inviteDraft.actionLink,
      });
      if (!mail.sent) {
        throw new Error(String(mail.reason ?? "Einladungsmail konnte nicht ueber SMTP versendet werden."));
      }
      delivery.sent = true;
    } catch (error) {
      await cleanupCreatedPartner(admin, authUserId);
      const message = String(error instanceof Error ? error.message : "Einladungsmail konnte nicht versendet werden.").trim();
      return NextResponse.json({ error: message || "Einladungsmail konnte nicht versendet werden." }, { status: 500 });
    }

    await writeSecurityAuditLog({
      actorUserId: adminUser.userId,
      actorRole: adminUser.role,
      eventType: "create",
      entityType: "partner",
      entityId: String(data.id),
      payload: {
        company_name: data.company_name,
        contact_email: data.contact_email,
        is_active: data.is_active,
        is_system_default: (data as Record<string, unknown>).is_system_default,
        llm_partner_managed_allowed: (data as Record<string, unknown>).llm_partner_managed_allowed,
        llm_mode_default: (data as Record<string, unknown>).llm_mode_default,
        auth_user_id: authUserId,
        invite_sent: delivery.sent,
        access_link_type: delivery.linkType,
        redirect_to: delivery.redirectTo,
      },
      ip: extractClientIpFromHeaders(req.headers),
      userAgent: req.headers.get("user-agent"),
    });

    await writeSecurityAuditLog({
      actorUserId: adminUser.userId,
      actorRole: adminUser.role,
      eventType: "invite",
      entityType: "auth_user",
      entityId: authUserId,
      payload: {
        contact_email: delivery.contactEmail,
        redirect_to: delivery.redirectTo,
        link_type: delivery.linkType,
        resend: false,
      },
      ip: extractClientIpFromHeaders(req.headers),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({
      ok: true,
      partner: data,
      delivery: {
        sent: delivery.sent,
        contact_email: delivery.contactEmail,
        link_type: delivery.linkType,
        redirect_to: delivery.redirectTo,
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (error.message === "FORBIDDEN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const adminUser = await requireAdmin(["admin_super", "admin_ops"]);
    const adminRate = await checkAdminApiRateLimit(req, adminUser.userId);
    if (!adminRate.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(adminRate.retryAfterSec) } },
      );
    }

    const url = new URL(req.url);
    const includeInactive = url.searchParams.get("include_inactive") === "1";
    const onlyActive = url.searchParams.get("only_active") === "1";
    const q = String(url.searchParams.get("q") ?? "").trim();
    const admin = createAdminClient();
    let query = admin
      .from("partners")
      .select("id, company_name, contact_email, contact_first_name, contact_last_name, website_url, is_active, is_system_default, llm_partner_managed_allowed, llm_mode_default, created_at")
      .order("company_name", { ascending: true });

    if (onlyActive || !includeInactive) {
      query = query.eq("is_active", true);
    }
    if (q) {
      query = query.or([
        `company_name.ilike.%${q}%`,
        `contact_email.ilike.%${q}%`,
        `id.ilike.%${q}%`,
      ].join(", "));
    }

    let { data, error } = await query;
    if (error && (isMissingIsActiveColumn(error) || isMissingPartnerNameColumns(error) || isMissingPartnerLlmPolicyColumns(error) || isMissingPartnerSystemDefaultColumn(error))) {
      const missingIsActive = isMissingIsActiveColumn(error);
      const missingNames = isMissingPartnerNameColumns(error);
      const missingLlm = isMissingPartnerLlmPolicyColumns(error);
      const missingSystemDefault = isMissingPartnerSystemDefaultColumn(error);
      const fallbackSelect = [
        "id",
        "company_name",
        "contact_email",
        ...(!missingNames ? ["contact_first_name", "contact_last_name"] : []),
        "website_url",
        ...(!missingIsActive ? ["is_active"] : []),
        ...(!missingSystemDefault ? ["is_system_default"] : []),
        ...(!missingLlm ? ["llm_partner_managed_allowed", "llm_mode_default"] : []),
        "created_at",
      ].join(", ");
      let fallbackQuery = admin
        .from("partners")
        .select(fallbackSelect)
        .order("company_name", { ascending: true });
      if (!missingIsActive && (onlyActive || !includeInactive)) {
        fallbackQuery = fallbackQuery.eq("is_active", true);
      }
      if (q) {
        fallbackQuery = fallbackQuery.or([
          `company_name.ilike.%${q}%`,
          `contact_email.ilike.%${q}%`,
          `id.ilike.%${q}%`,
        ].join(", "));
      }
      const filteredFallback = await fallbackQuery;
      if (filteredFallback.error) return NextResponse.json({ error: filteredFallback.error.message }, { status: 500 });
      data = (filteredFallback.data ?? []).map((row) =>
        withPartnerFallback(row as unknown as Record<string, unknown>, !missingIsActive),
      ) as typeof data;
      error = null;
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const partners = data ?? [];
    const areaSummaryByPartner = await loadPartnerAreaSummaries(
      admin,
      partners.map((partner) => String(partner.id ?? "")).filter(Boolean),
    );

    return NextResponse.json({
      ok: true,
      partners: partners.map((partner) => ({
        ...partner,
        area_summary: areaSummaryByPartner.get(String(partner.id ?? "")) ?? {
          total_areas: 0,
          live_areas: 0,
          activation_open: 0,
          has_assignment: false,
        },
      })),
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (error.message === "FORBIDDEN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
