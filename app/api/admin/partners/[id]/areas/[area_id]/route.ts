import { NextResponse } from "next/server";

import { createAdminClient } from "@/utils/supabase/admin";
import { requireAdmin } from "@/lib/security/admin-auth";
import { writeSecurityAuditLog } from "@/lib/security/audit-log";
import { checkAdminApiRateLimit, extractClientIpFromHeaders } from "@/lib/security/rate-limit";
import { checkPartnerAreaMandatoryTexts } from "@/lib/partner-area-mandatory";
import { publishVisibilityIndex } from "@/lib/visibility-index";

type AreaToggleBody = {
  is_active?: boolean;
};

function isMissingActivationStatusColumn(error: unknown): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return (
    msg.includes("partner_area_map.activation_status") && msg.includes("does not exist")
  ) || (
    msg.includes("partner_area_map.is_public_live") && msg.includes("does not exist")
  );
}

function isMissingVisibilityModeColumn(error: unknown): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return (
    msg.includes("partner_area_map.offer_visibility_mode")
    || msg.includes("partner_area_map.request_visibility_mode")
  ) && (msg.includes("does not exist") || msg.includes("schema cache"));
}

function isKreisAreaId(areaId: string): boolean {
  return String(areaId ?? "")
    .split("-")
    .filter((part) => part.length > 0).length === 3;
}

async function resolveAssignmentAreaIds(
  admin: ReturnType<typeof createAdminClient>,
  areaId: string,
): Promise<string[]> {
  if (!isKreisAreaId(areaId)) return [areaId];

  const { data: kreisArea, error: kreisError } = await admin
    .from("areas")
    .select("id, slug, bundesland_slug")
    .eq("id", areaId)
    .maybeSingle();
  if (kreisError || !kreisArea) return [areaId];

  const kreisSlug = String((kreisArea as { slug?: string | null }).slug ?? "").trim();
  const bundeslandSlug = String((kreisArea as { bundesland_slug?: string | null }).bundesland_slug ?? "").trim();
  if (!kreisSlug || !bundeslandSlug) return [areaId];

  const { data: childAreas, error: childError } = await admin
    .from("areas")
    .select("id, parent_slug")
    .eq("bundesland_slug", bundeslandSlug);
  if (childError) return [areaId];

  const childIds = (childAreas ?? [])
    .filter((row) => {
      const id = String((row as { id?: string | null }).id ?? "").trim();
      const parentSlug = String((row as { parent_slug?: string | null }).parent_slug ?? "").trim();
      if (!id) return false;
      return parentSlug === kreisSlug || id.startsWith(`${areaId}-`);
    })
    .map((row) => String((row as { id?: string | null }).id ?? "").trim())
    .filter((id) => id.length > 0);

  return Array.from(
    new Set([
      areaId,
      ...childIds,
    ]),
  );
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

    const body = (await req.json()) as AreaToggleBody;
    if (body.is_active === undefined) {
      return NextResponse.json({ error: "Missing is_active" }, { status: 400 });
    }

    const admin = createAdminClient();
    const targetAreaIds = await resolveAssignmentAreaIds(admin, areaId);

    if (body.is_active === true) {
      const { data: activeAssignedRows, error: activeAssignedError } = await admin
        .from("partner_area_map")
        .select("auth_user_id, area_id")
        .in("area_id", targetAreaIds)
        .eq("is_active", true)
        .neq("auth_user_id", partnerId);
      if (activeAssignedError) {
        return NextResponse.json({ error: activeAssignedError.message }, { status: 500 });
      }
      if (Array.isArray(activeAssignedRows) && activeAssignedRows.length > 0) {
        const blockedAreaIds = Array.from(
          new Set(
            activeAssignedRows
              .map((row) => String((row as { area_id?: string | null }).area_id ?? "").trim())
              .filter((id) => id.length > 0),
          ),
        );
        return NextResponse.json(
          { error: "Area is already active on another partner", blocked_area_ids: blockedAreaIds },
          { status: 409 },
        );
      }

      const mandatoryCheck = await checkPartnerAreaMandatoryTexts({
        admin,
        partnerId,
        areaId,
        requireApprovedMedia: true,
      });
      if (!mandatoryCheck.ok) {
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
    }

    let { data, error } = await admin
      .from("partner_area_map")
      .update({
        is_active: Boolean(body.is_active),
        is_public_live: false,
        activation_status: body.is_active ? "approved_preview" : "in_progress",
      })
      .eq("auth_user_id", partnerId)
      .in("area_id", targetAreaIds)
      .select("id, auth_user_id, area_id, is_active, is_public_live, activation_status, offer_visibility_mode, request_visibility_mode, created_at");

    if (error && (isMissingActivationStatusColumn(error) || isMissingVisibilityModeColumn(error))) {
      const missingActivationStatus = isMissingActivationStatusColumn(error);
      const missingVisibilityMode = isMissingVisibilityModeColumn(error);
      const fallback = await admin
        .from("partner_area_map")
        .update({ is_active: Boolean(body.is_active) })
        .eq("auth_user_id", partnerId)
        .in("area_id", targetAreaIds)
        .select([
          "id",
          "auth_user_id",
          "area_id",
          "is_active",
          ...(!missingActivationStatus ? ["is_public_live", "activation_status"] : []),
          ...(!missingVisibilityMode ? ["offer_visibility_mode", "request_visibility_mode"] : []),
          "created_at",
        ].join(", "));
      data = Array.isArray(fallback.data)
        ? fallback.data.map((row) => {
          const baseRow = (row && typeof row === "object" ? row : {}) as Record<string, unknown>;
          return {
          ...baseRow,
          activation_status: missingActivationStatus
            ? (body.is_active ? "approved_preview" : "in_progress")
            : (baseRow as { activation_status?: string | null }).activation_status ?? (body.is_active ? "approved_preview" : "in_progress"),
          is_public_live: missingActivationStatus
            ? null
            : (baseRow as { is_public_live?: boolean | null }).is_public_live ?? null,
          offer_visibility_mode: missingVisibilityMode
            ? "partner_wide"
            : (baseRow as { offer_visibility_mode?: string | null }).offer_visibility_mode ?? "partner_wide",
          request_visibility_mode: missingVisibilityMode
            ? "partner_wide"
            : (baseRow as { request_visibility_mode?: string | null }).request_visibility_mode ?? "partner_wide",
        };
        })
        : null;
      error = fallback.error;
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data || data.length === 0) {
      return NextResponse.json({ error: "Mapping not found" }, { status: 404 });
    }
    const rootMapping = data.find((row) => String((row as { area_id?: string | null }).area_id ?? "") === areaId) ?? data[0];

    await writeSecurityAuditLog({
      actorUserId: adminUser.userId,
      actorRole: adminUser.role,
      eventType: body.is_active ? "activate" : "deactivate",
      entityType: "partner_area_map",
      entityId: String(rootMapping.id),
      payload: {
        auth_user_id: partnerId,
        area_id: areaId,
        is_active: Boolean((rootMapping as { is_active?: boolean | null }).is_active),
        is_public_live: Boolean((rootMapping as { is_public_live?: boolean | null }).is_public_live),
        affected_count: data.length,
        affected_area_ids: targetAreaIds,
      },
      ip: extractClientIpFromHeaders(req.headers),
      userAgent: req.headers.get("user-agent"),
    });

    try {
      await publishVisibilityIndex(admin as never);
    } catch (publishErr) {
      console.warn("visibility index publish failed after area toggle:", publishErr);
    }

    return NextResponse.json({
      ok: true,
      mapping: rootMapping,
      affected_count: data.length,
      affected_area_ids: targetAreaIds,
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

export async function DELETE(
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
    const targetAreaIds = await resolveAssignmentAreaIds(admin, areaId);
    const { data: existing, error: selectError } = await admin
      .from("partner_area_map")
      .select("id, auth_user_id, area_id, is_active, created_at")
      .eq("auth_user_id", partnerId)
      .eq("area_id", areaId)
      .maybeSingle();

    if (selectError) {
      return NextResponse.json({ error: selectError.message }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: "Mapping not found" }, { status: 404 });
    }

    const { data: deleteCandidates, error: candidateError } = await admin
      .from("partner_area_map")
      .select("id, area_id")
      .eq("auth_user_id", partnerId)
      .in("area_id", targetAreaIds);
    if (candidateError) {
      return NextResponse.json({ error: candidateError.message }, { status: 500 });
    }

    const { error } = await admin
      .from("partner_area_map")
      .delete()
      .eq("auth_user_id", partnerId)
      .in("area_id", targetAreaIds);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await writeSecurityAuditLog({
      actorUserId: adminUser.userId,
      actorRole: adminUser.role,
      eventType: "delete",
      entityType: "partner_area_map",
      entityId: String(existing.id),
      payload: {
        auth_user_id: partnerId,
        area_id: areaId,
        affected_count: Array.isArray(deleteCandidates) ? deleteCandidates.length : 0,
        affected_area_ids: targetAreaIds,
      },
      ip: extractClientIpFromHeaders(req.headers),
      userAgent: req.headers.get("user-agent"),
    });

    try {
      await publishVisibilityIndex(admin as never);
    } catch (publishErr) {
      console.warn("visibility index publish failed after area delete:", publishErr);
    }

    return NextResponse.json({
      ok: true,
      affected_count: Array.isArray(deleteCandidates) ? deleteCandidates.length : 0,
      affected_area_ids: targetAreaIds,
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
