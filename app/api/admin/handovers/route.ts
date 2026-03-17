import { NextResponse } from "next/server";

import { createAdminClient } from "@/utils/supabase/admin";
import { requireAdmin } from "@/lib/security/admin-auth";
import { writeSecurityAuditLog } from "@/lib/security/audit-log";
import { checkAdminApiRateLimit, extractClientIpFromHeaders } from "@/lib/security/rate-limit";
import { publishVisibilityIndex } from "@/lib/visibility-index";

type HandoverBody = {
  area_id?: string;
  old_partner_id?: string;
  new_partner_id?: string;
};

function normalize(value: unknown): string {
  return String(value ?? "").trim();
}

function isKreisAreaId(areaId: string): boolean {
  const parts = areaId.split("-").filter((p) => p.length > 0);
  return parts.length === 3;
}

function isMissingActivationStatusColumn(error: unknown): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return (
    msg.includes("partner_area_map.activation_status") && msg.includes("does not exist")
  ) || (
    msg.includes("partner_area_map.is_public_live") && msg.includes("does not exist")
  );
}

async function resolveTransferAreaIds(
  admin: ReturnType<typeof createAdminClient>,
  areaId: string,
): Promise<string[]> {
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

    const body = (await req.json()) as HandoverBody;
    const areaId = normalize(body.area_id);
    const oldPartnerId = normalize(body.old_partner_id);
    const newPartnerId = normalize(body.new_partner_id);
    const deactivateOldIntegrations = true;

    if (!areaId || !oldPartnerId || !newPartnerId) {
      return NextResponse.json(
        { error: "Missing required fields: area_id, old_partner_id, new_partner_id" },
        { status: 400 },
      );
    }
    if (oldPartnerId === newPartnerId) {
      return NextResponse.json(
        { error: "old_partner_id and new_partner_id must be different" },
        { status: 400 },
      );
    }
    if (!isKreisAreaId(areaId)) {
      return NextResponse.json({ error: "Only kreis area_id is allowed" }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: partners, error: partnersError } = await admin
      .from("partners")
      .select("id, company_name")
      .in("id", [oldPartnerId, newPartnerId]);
    if (partnersError) return NextResponse.json({ error: partnersError.message }, { status: 500 });

    const oldPartner = (partners ?? []).find((p) => String(p.id) === oldPartnerId);
    const newPartner = (partners ?? []).find((p) => String(p.id) === newPartnerId);
    if (!oldPartner) return NextResponse.json({ error: "Old partner not found" }, { status: 404 });
    if (!newPartner) return NextResponse.json({ error: "New partner not found" }, { status: 404 });

    const { data: areaExists, error: areaError } = await admin
      .from("areas")
      .select("id, name, slug, bundesland_slug")
      .eq("id", areaId)
      .maybeSingle();
    if (areaError) return NextResponse.json({ error: areaError.message }, { status: 500 });
    if (!areaExists) return NextResponse.json({ error: "Area not found" }, { status: 404 });
    const transferAreaIds = await resolveTransferAreaIds(admin, areaId);

    const { data: existingMappings, error: existingMappingsError } = await admin
      .from("partner_area_map")
      .select("id, auth_user_id, area_id")
      .in("area_id", transferAreaIds);
    if (existingMappingsError) return NextResponse.json({ error: existingMappingsError.message }, { status: 500 });

    const conflictingRows = (existingMappings ?? []).filter((row) => {
      const ownerId = String(row.auth_user_id ?? "").trim();
      return ownerId !== oldPartnerId && ownerId !== newPartnerId;
    });
    if (conflictingRows.length > 0) {
      const blockedAreaIds = Array.from(
        new Set(conflictingRows.map((row) => String(row.area_id ?? "").trim()).filter((id) => id.length > 0)),
      );
      return NextResponse.json(
        { error: "Area already has another operational owner", blocked_area_ids: blockedAreaIds },
        { status: 409 },
      );
    }

    await writeSecurityAuditLog({
      actorUserId: adminUser.userId,
      actorRole: adminUser.role,
      eventType: "other",
      entityType: "other",
      entityId: areaId,
      payload: {
        action: "handover_start",
        area_id: areaId,
        transferred_area_ids: transferAreaIds,
        transferred_area_count: transferAreaIds.length,
        old_partner_id: oldPartnerId,
        new_partner_id: newPartnerId,
      },
      ip: extractClientIpFromHeaders(req.headers),
      userAgent: req.headers.get("user-agent"),
    });

    if (deactivateOldIntegrations) {
      const { error: deactivateIntegrationsError } = await admin
        .from("partner_integrations")
        .update({ is_active: false })
        .eq("partner_id", oldPartnerId)
        .eq("is_active", true);
      if (deactivateIntegrationsError) {
        return NextResponse.json({ error: deactivateIntegrationsError.message }, { status: 500 });
      }
    }

    let { data: newMappings, error: upsertMappingError } = await admin
      .from("partner_area_map")
      .upsert(
        transferAreaIds.map((targetAreaId) => ({
          auth_user_id: newPartnerId,
          area_id: targetAreaId,
          is_active: false,
          is_public_live: false,
          activation_status: "assigned",
        })),
        { onConflict: "auth_user_id,area_id" },
      )
      .select("id, auth_user_id, area_id, is_active, is_public_live, activation_status");
    if (upsertMappingError && isMissingActivationStatusColumn(upsertMappingError)) {
      const fallback = await admin
        .from("partner_area_map")
        .upsert(
          transferAreaIds.map((targetAreaId) => ({
            auth_user_id: newPartnerId,
            area_id: targetAreaId,
            is_active: false,
            is_public_live: false,
          })),
          { onConflict: "auth_user_id,area_id" },
        )
        .select("id, auth_user_id, area_id, is_active");
      newMappings = Array.isArray(fallback.data)
        ? fallback.data.map((row) => ({ ...row, activation_status: "assigned", is_public_live: null }))
        : null;
      upsertMappingError = fallback.error;
    }
    if (upsertMappingError) {
      return NextResponse.json({ error: upsertMappingError.message }, { status: 500 });
    }
    if (!newMappings || newMappings.length === 0) {
      return NextResponse.json({ error: "New mapping could not be created" }, { status: 500 });
    }
    const newRootMapping = newMappings.find((row) => String((row as { area_id?: string | null }).area_id ?? "") === areaId) ?? newMappings[0];

    const { data: removedOldMappings, error: deleteOldMappingsError } = await admin
      .from("partner_area_map")
      .delete()
      .in("area_id", transferAreaIds)
      .eq("auth_user_id", oldPartnerId)
      .select("id, auth_user_id, area_id");
    if (deleteOldMappingsError) {
      return NextResponse.json({ error: deleteOldMappingsError.message }, { status: 500 });
    }

    await writeSecurityAuditLog({
      actorUserId: adminUser.userId,
      actorRole: adminUser.role,
      eventType: "delete",
      entityType: "partner_area_map",
      entityId: `${oldPartnerId}:${areaId}`,
      payload: {
        action: "remove_old_mapping",
        area_id: areaId,
        transferred_area_ids: transferAreaIds,
        old_partner_id: oldPartnerId,
        removed_rows: Array.isArray(removedOldMappings) ? removedOldMappings.length : 0,
      },
      ip: extractClientIpFromHeaders(req.headers),
      userAgent: req.headers.get("user-agent"),
    });

    await writeSecurityAuditLog({
      actorUserId: adminUser.userId,
      actorRole: adminUser.role,
      eventType: "create",
      entityType: "partner_area_map",
      entityId: String(newRootMapping.id),
      payload: {
        action: "assign_new_mapping",
        area_id: areaId,
        transferred_area_ids: transferAreaIds,
        assigned_area_count: transferAreaIds.length,
        new_partner_id: newPartnerId,
        is_active: false,
        activation_status: String((newRootMapping as { activation_status?: string | null }).activation_status ?? "assigned"),
      },
      ip: extractClientIpFromHeaders(req.headers),
      userAgent: req.headers.get("user-agent"),
    });

    await writeSecurityAuditLog({
      actorUserId: adminUser.userId,
      actorRole: adminUser.role,
      eventType: "other",
      entityType: "other",
      entityId: areaId,
      payload: {
        action: "handover_done",
        area_id: areaId,
        transferred_area_ids: transferAreaIds,
        transferred_area_count: transferAreaIds.length,
        old_partner_id: oldPartnerId,
        new_partner_id: newPartnerId,
        deactivate_old_integrations: deactivateOldIntegrations,
        old_partner_retained: true,
        old_partner_retention_reason: "Old partner remains active after handover by policy",
      },
      ip: extractClientIpFromHeaders(req.headers),
      userAgent: req.headers.get("user-agent"),
    });

    try {
      await publishVisibilityIndex(admin as never);
    } catch (publishErr) {
      console.warn("visibility index publish failed after handover:", publishErr);
    }

    return NextResponse.json({
      ok: true,
      handover: {
        area_id: areaId,
        area_name: areaExists.name ?? areaId,
        old_partner: {
          id: oldPartnerId,
          company_name: oldPartner.company_name ?? oldPartnerId,
        },
        new_partner: {
          id: newPartnerId,
          company_name: newPartner.company_name ?? newPartnerId,
        },
        deactivate_old_integrations_applied: deactivateOldIntegrations,
        old_partner_remains_active: true,
        transferred_area_count: transferAreaIds.length,
        new_mapping_status: String((newRootMapping as { activation_status?: string | null }).activation_status ?? "assigned"),
        new_mapping_is_active: false,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
