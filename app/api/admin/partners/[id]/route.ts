import { NextResponse } from "next/server";

import { createAdminClient } from "@/utils/supabase/admin";
import { requireAdmin } from "@/lib/security/admin-auth";
import { writeSecurityAuditLog } from "@/lib/security/audit-log";
import { checkAdminApiRateLimit, extractClientIpFromHeaders } from "@/lib/security/rate-limit";

type UpdatePartnerBody = {
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

function isMissingAreaActivationStatusColumn(error: unknown): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return (
    msg.includes("partner_area_map.activation_status") && msg.includes("does not exist")
  ) || (
    msg.includes("partner_area_map.is_public_live") && msg.includes("does not exist")
  );
}

function isMissingAreaPreviewSignoffColumn(error: unknown): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return msg.includes("partner_area_map.partner_preview_signoff_at") && msg.includes("does not exist");
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

function normalizeNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
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

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
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
    if (!partnerId) {
      return NextResponse.json({ error: "Missing partner id" }, { status: 400 });
    }

    const body = (await req.json()) as UpdatePartnerBody;
    const patch: Record<string, unknown> = {};
    if (body.company_name !== undefined) {
      const companyName = normalizeNullableString(body.company_name);
      if (!companyName) {
        return NextResponse.json({ error: "company_name cannot be empty" }, { status: 400 });
      }
      patch.company_name = companyName;
    }
    if (body.contact_email !== undefined) patch.contact_email = normalizeNullableString(body.contact_email);
    if (body.contact_first_name !== undefined) patch.contact_first_name = normalizeNullableString(body.contact_first_name);
    if (body.contact_last_name !== undefined) patch.contact_last_name = normalizeNullableString(body.contact_last_name);
    if (body.website_url !== undefined) patch.website_url = normalizeNullableString(body.website_url);
    if (body.is_active !== undefined) patch.is_active = Boolean(body.is_active);
    if (body.is_system_default !== undefined) patch.is_system_default = Boolean(body.is_system_default);
    if (body.llm_partner_managed_allowed !== undefined) patch.llm_partner_managed_allowed = Boolean(body.llm_partner_managed_allowed);
    if (body.llm_mode_default !== undefined) patch.llm_mode_default = normalizeNullableString(body.llm_mode_default) ?? "central_managed";

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No update fields provided" }, { status: 400 });
    }

    const admin = createAdminClient();
    let { data, error } = await admin
      .from("partners")
      .update(patch)
      .eq("id", partnerId)
      .select("id, company_name, contact_email, contact_first_name, contact_last_name, website_url, is_active, is_system_default, llm_partner_managed_allowed, llm_mode_default, created_at")
      .maybeSingle();

    if (error && (isMissingIsActiveColumn(error) || isMissingPartnerNameColumns(error) || isMissingPartnerLlmPolicyColumns(error) || isMissingPartnerSystemDefaultColumn(error))) {
      const patchNoIsActive = { ...patch };
      delete patchNoIsActive.is_active;
      const missingIsActive = isMissingIsActiveColumn(error);
      const missingNames = isMissingPartnerNameColumns(error);
      const missingLlm = isMissingPartnerLlmPolicyColumns(error);
      const missingSystemDefault = isMissingPartnerSystemDefaultColumn(error);
      if (missingNames) {
        delete patchNoIsActive.contact_first_name;
        delete patchNoIsActive.contact_last_name;
      }
      if (missingSystemDefault) {
        delete patchNoIsActive.is_system_default;
      }
      if (missingLlm) {
        delete patchNoIsActive.llm_partner_managed_allowed;
        delete patchNoIsActive.llm_mode_default;
      }
      if (Object.keys(patchNoIsActive).length === 0) {
        const readSelect = [
          "id",
          "company_name",
          "contact_email",
          "website_url",
          "created_at",
        ].join(", ");
        const legacyRead = await admin
          .from("partners")
          .select(readSelect)
          .eq("id", partnerId)
          .maybeSingle();
        if (legacyRead.error) return NextResponse.json({ error: legacyRead.error.message }, { status: 500 });
        if (!legacyRead.data) return NextResponse.json({ error: "Partner not found" }, { status: 404 });
        return NextResponse.json({
          ok: true,
          partner: withPartnerFallback(legacyRead.data as unknown as Record<string, unknown>, false),
        });
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
        .update(patchNoIsActive)
        .eq("id", partnerId)
        .select(fallbackSelect)
        .maybeSingle();
      data = fallback.data
        ? (withPartnerFallback(
            fallback.data as unknown as Record<string, unknown>,
            !missingIsActive,
          ) as typeof data)
        : null;
      error = fallback.error;
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Partner not found" }, { status: 404 });
    }

    await writeSecurityAuditLog({
      actorUserId: adminUser.userId,
      actorRole: adminUser.role,
      eventType: "update",
      entityType: "partner",
      entityId: partnerId,
      payload: patch,
      ip: extractClientIpFromHeaders(req.headers),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({ ok: true, partner: data });
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

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
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
    if (!partnerId) {
      return NextResponse.json({ error: "Missing partner id" }, { status: 400 });
    }

    const admin = createAdminClient();
    let { data: partner, error: partnerError } = await admin
      .from("partners")
      .select("id, company_name, contact_email, contact_first_name, contact_last_name, website_url, is_active, is_system_default, llm_partner_managed_allowed, llm_mode_default, created_at")
      .eq("id", partnerId)
      .maybeSingle();

    if (partnerError && (isMissingIsActiveColumn(partnerError) || isMissingPartnerNameColumns(partnerError) || isMissingPartnerLlmPolicyColumns(partnerError) || isMissingPartnerSystemDefaultColumn(partnerError))) {
      const missingIsActive = isMissingIsActiveColumn(partnerError);
      const missingNames = isMissingPartnerNameColumns(partnerError);
      const missingLlm = isMissingPartnerLlmPolicyColumns(partnerError);
      const missingSystemDefault = isMissingPartnerSystemDefaultColumn(partnerError);
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
        .select(fallbackSelect)
        .eq("id", partnerId)
        .maybeSingle();
      partner = fallback.data
        ? (withPartnerFallback(
            fallback.data as unknown as Record<string, unknown>,
            !missingIsActive,
          ) as typeof partner)
        : null;
      partnerError = fallback.error;
    }

    if (partnerError) return NextResponse.json({ error: partnerError.message }, { status: 500 });
    if (!partner) return NextResponse.json({ error: "Partner not found" }, { status: 404 });

    let { data: mappings, error: mappingError } = await admin
      .from("partner_area_map")
      .select("id, auth_user_id, area_id, is_active, is_public_live, activation_status, partner_preview_signoff_at, created_at, areas(name, slug, parent_slug, bundesland_slug)")
      .eq("auth_user_id", partnerId)
      .order("area_id", { ascending: true });

    if (mappingError && (isMissingAreaActivationStatusColumn(mappingError) || isMissingAreaPreviewSignoffColumn(mappingError))) {
      const missingActivationStatus = isMissingAreaActivationStatusColumn(mappingError);
      const missingPreviewSignoff = isMissingAreaPreviewSignoffColumn(mappingError);

      if (missingPreviewSignoff && !missingActivationStatus) {
        const fallback = await admin
          .from("partner_area_map")
          .select("id, auth_user_id, area_id, is_active, is_public_live, activation_status, created_at, areas(name, slug, parent_slug, bundesland_slug)")
          .eq("auth_user_id", partnerId)
          .order("area_id", { ascending: true });
        mappings = (fallback.data ?? []).map((row) => ({
          ...row,
          partner_preview_signoff_at: null,
        }));
        mappingError = fallback.error;
      } else {
        const fallback = await admin
          .from("partner_area_map")
          .select("id, auth_user_id, area_id, is_active, created_at, areas(name, slug, parent_slug, bundesland_slug)")
          .eq("auth_user_id", partnerId)
          .order("area_id", { ascending: true });
        mappings = (fallback.data ?? []).map((row) => ({
          ...row,
          activation_status: null,
          is_public_live: null,
          partner_preview_signoff_at: null,
        }));
        mappingError = fallback.error;
      }
    }

    if (mappingError) return NextResponse.json({ error: mappingError.message }, { status: 500 });

    return NextResponse.json({
      ok: true,
      partner,
      area_mappings: mappings ?? [],
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
