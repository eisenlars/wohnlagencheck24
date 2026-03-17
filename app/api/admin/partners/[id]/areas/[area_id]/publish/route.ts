import { NextResponse } from "next/server";

import { createAdminClient } from "@/utils/supabase/admin";
import { requireAdmin } from "@/lib/security/admin-auth";
import { writeSecurityAuditLog } from "@/lib/security/audit-log";
import { checkAdminApiRateLimit, extractClientIpFromHeaders } from "@/lib/security/rate-limit";
import { publishVisibilityIndex } from "@/lib/visibility-index";
import { isMissingPublicLiveColumn } from "@/lib/public-partner-mappings";
import { rebuildAllPublicAssetEntriesForPartner } from "@/lib/public-asset-projections";

function isMissingActivationStatusColumn(error: unknown): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return msg.includes("partner_area_map.activation_status") && msg.includes("does not exist");
}

function isMissingPreviewSignoffColumn(error: unknown): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return msg.includes("partner_area_map.partner_preview_signoff_at")
    && (msg.includes("does not exist") || msg.includes("schema cache"));
}

async function updatePublication(args: {
  partnerId: string;
  areaId: string;
  publish: boolean;
  admin: ReturnType<typeof createAdminClient>;
}) {
  const patch = args.publish
    ? { is_active: true, is_public_live: true, activation_status: "live" }
    : { is_public_live: false, activation_status: "approved_preview", partner_preview_signoff_at: null };

  let { data, error } = await args.admin
    .from("partner_area_map")
    .update(patch)
    .eq("auth_user_id", args.partnerId)
    .eq("area_id", args.areaId)
    .select("id, auth_user_id, area_id, is_active, is_public_live, activation_status, partner_preview_signoff_at, created_at")
    .maybeSingle();

  if (error && (isMissingActivationStatusColumn(error) || isMissingPublicLiveColumn(error) || isMissingPreviewSignoffColumn(error))) {
    const missingActivationStatus = isMissingActivationStatusColumn(error);
    const missingPublicLive = isMissingPublicLiveColumn(error);
    const missingPreviewSignoff = isMissingPreviewSignoffColumn(error);

    if (missingPreviewSignoff && !missingActivationStatus && !missingPublicLive) {
      const fallback = await args.admin
        .from("partner_area_map")
        .update(patch)
        .eq("auth_user_id", args.partnerId)
        .eq("area_id", args.areaId)
        .select("id, auth_user_id, area_id, is_active, is_public_live, activation_status, created_at")
        .maybeSingle();
      data = fallback.data
        ? {
          ...fallback.data,
          partner_preview_signoff_at: null,
        }
        : null;
      error = fallback.error;
    } else {
      const fallbackPatch = args.publish
        ? { is_active: true }
        : { is_active: true };
      const fallback = await args.admin
        .from("partner_area_map")
        .update(fallbackPatch)
        .eq("auth_user_id", args.partnerId)
        .eq("area_id", args.areaId)
        .select("id, auth_user_id, area_id, is_active, created_at")
        .maybeSingle();
      data = fallback.data
        ? {
          ...fallback.data,
          is_public_live: null,
          activation_status: args.publish ? "live" : "approved_preview",
          partner_preview_signoff_at: null,
        }
        : null;
      error = fallback.error;
    }
  }

  return { data, error };
}

export async function POST(
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
    let { data: mapping, error: mappingError } = await admin
      .from("partner_area_map")
      .select("id, auth_user_id, area_id, is_active, is_public_live, activation_status, partner_preview_signoff_at")
      .eq("auth_user_id", partnerId)
      .eq("area_id", areaId)
      .maybeSingle();
    if (mappingError && (isMissingActivationStatusColumn(mappingError) || isMissingPublicLiveColumn(mappingError) || isMissingPreviewSignoffColumn(mappingError))) {
      const missingActivationStatus = isMissingActivationStatusColumn(mappingError);
      const missingPublicLive = isMissingPublicLiveColumn(mappingError);
      const missingPreviewSignoff = isMissingPreviewSignoffColumn(mappingError);

      if (missingPreviewSignoff && !missingActivationStatus && !missingPublicLive) {
        const fallback = await admin
          .from("partner_area_map")
          .select("id, auth_user_id, area_id, is_active, is_public_live, activation_status")
          .eq("auth_user_id", partnerId)
          .eq("area_id", areaId)
          .maybeSingle();
        mapping = fallback.data ? { ...fallback.data, partner_preview_signoff_at: null } : null;
        mappingError = fallback.error;
      } else {
        const fallback = await admin
          .from("partner_area_map")
          .select("id, auth_user_id, area_id, is_active")
          .eq("auth_user_id", partnerId)
          .eq("area_id", areaId)
          .maybeSingle();
        mapping = fallback.data ? { ...fallback.data, is_public_live: null, activation_status: null, partner_preview_signoff_at: null } : null;
        mappingError = fallback.error;
      }
    }
    if (mappingError) return NextResponse.json({ error: mappingError.message }, { status: 500 });
    if (!mapping) return NextResponse.json({ error: "Mapping not found" }, { status: 404 });

    const activationStatus = String((mapping as { activation_status?: string | null }).activation_status ?? "").trim().toLowerCase();
    if (!(Boolean((mapping as { is_active?: boolean | null }).is_active) || activationStatus === "approved_preview" || activationStatus === "live" || activationStatus === "active")) {
      return NextResponse.json({ error: "Gebiet ist noch nicht fuer Preview freigegeben." }, { status: 409 });
    }
    const previewSignoffAt = String((mapping as { partner_preview_signoff_at?: string | null }).partner_preview_signoff_at ?? "").trim();
    if (!previewSignoffAt) {
      return NextResponse.json({ error: "Partner hat den Livegang noch nicht angefragt." }, { status: 409 });
    }

    const { data: updated, error: updateError } = await updatePublication({
      admin,
      partnerId,
      areaId,
      publish: true,
    });
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    if (!updated) return NextResponse.json({ error: "Mapping not found" }, { status: 404 });

    await writeSecurityAuditLog({
      actorUserId: adminUser.userId,
      actorRole: adminUser.role,
      eventType: "activate",
      entityType: "partner_area_map",
      entityId: String(updated.id),
      payload: {
        action: "admin_publish_live",
        partner_id: partnerId,
        area_id: areaId,
        is_active: Boolean((updated as { is_active?: boolean | null }).is_active),
        is_public_live: true,
        activation_status: "live",
      },
      ip: extractClientIpFromHeaders(req.headers),
      userAgent: req.headers.get("user-agent"),
    });

    await publishVisibilityIndex(admin as never);
    const projectionCounts = await rebuildAllPublicAssetEntriesForPartner(partnerId, admin);

    return NextResponse.json({
      ok: true,
      mapping: updated,
      projections: projectionCounts,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
    const { data: updated, error: updateError } = await updatePublication({
      admin,
      partnerId,
      areaId,
      publish: false,
    });
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    if (!updated) return NextResponse.json({ error: "Mapping not found" }, { status: 404 });

    await writeSecurityAuditLog({
      actorUserId: adminUser.userId,
      actorRole: adminUser.role,
      eventType: "deactivate",
      entityType: "partner_area_map",
      entityId: String(updated.id),
      payload: {
        action: "admin_unpublish_live",
        partner_id: partnerId,
        area_id: areaId,
        is_public_live: false,
        activation_status: "approved_preview",
      },
      ip: extractClientIpFromHeaders(req.headers),
      userAgent: req.headers.get("user-agent"),
    });

    await publishVisibilityIndex(admin as never);
    const projectionCounts = await rebuildAllPublicAssetEntriesForPartner(partnerId, admin);

    return NextResponse.json({
      ok: true,
      mapping: updated,
      projections: projectionCounts,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
