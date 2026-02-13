import { NextResponse } from "next/server";

import { createAdminClient } from "@/utils/supabase/admin";
import { requireAdmin } from "@/lib/security/admin-auth";
import { writeSecurityAuditLog } from "@/lib/security/audit-log";
import { checkAdminApiRateLimit, extractClientIpFromHeaders } from "@/lib/security/rate-limit";

type HandoverBody = {
  area_id?: string;
  old_partner_id?: string;
  new_partner_id?: string;
  deactivate_old_partner?: boolean;
  deactivate_old_integrations?: boolean;
};

function normalize(value: unknown): string {
  return String(value ?? "").trim();
}

function isKreisAreaId(areaId: string): boolean {
  const parts = areaId.split("-").filter((p) => p.length > 0);
  return parts.length === 3;
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
    const deactivateOldPartner = body.deactivate_old_partner === true;
    const deactivateOldIntegrations = body.deactivate_old_integrations !== false;

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
      .select("id, name")
      .eq("id", areaId)
      .maybeSingle();
    if (areaError) return NextResponse.json({ error: areaError.message }, { status: 500 });
    if (!areaExists) return NextResponse.json({ error: "Area not found" }, { status: 404 });

    const { data: activeMappings, error: activeMappingsError } = await admin
      .from("partner_area_map")
      .select("id, auth_user_id, area_id, is_active")
      .eq("area_id", areaId)
      .eq("is_active", true);
    if (activeMappingsError) return NextResponse.json({ error: activeMappingsError.message }, { status: 500 });

    const activeRows = activeMappings ?? [];
    if (activeRows.length > 1) {
      return NextResponse.json(
        { error: "Multiple active mappings found for area. Resolve data first." },
        { status: 409 },
      );
    }
    if (activeRows.length === 1 && String(activeRows[0].auth_user_id ?? "") !== oldPartnerId) {
      return NextResponse.json(
        { error: "Area is currently active on another partner" },
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
        old_partner_id: oldPartnerId,
        new_partner_id: newPartnerId,
      },
      ip: extractClientIpFromHeaders(req.headers),
      userAgent: req.headers.get("user-agent"),
    });

    const { data: oldMappingUpdated, error: deactivateMapError } = await admin
      .from("partner_area_map")
      .update({ is_active: false })
      .eq("area_id", areaId)
      .eq("auth_user_id", oldPartnerId)
      .eq("is_active", true)
      .select("id, auth_user_id, area_id, is_active");
    if (deactivateMapError) {
      return NextResponse.json({ error: deactivateMapError.message }, { status: 500 });
    }

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

    const { data: newMapping, error: upsertMappingError } = await admin
      .from("partner_area_map")
      .upsert(
        {
          auth_user_id: newPartnerId,
          area_id: areaId,
          is_active: true,
        },
        { onConflict: "auth_user_id,area_id" },
      )
      .select("id, auth_user_id, area_id, is_active")
      .single();
    if (upsertMappingError) {
      return NextResponse.json({ error: upsertMappingError.message }, { status: 500 });
    }

    let oldPartnerDeactivated = false;
    let oldPartnerDeactivateSkippedReason: string | null = null;
    if (deactivateOldPartner) {
      const { count: remainingActiveAreas, error: remainingAreasError } = await admin
        .from("partner_area_map")
        .select("id", { count: "exact", head: true })
        .eq("auth_user_id", oldPartnerId)
        .eq("is_active", true);
      if (remainingAreasError) {
        return NextResponse.json({ error: remainingAreasError.message }, { status: 500 });
      }

      if ((remainingActiveAreas ?? 0) === 0) {
        const { error: deactivatePartnerError } = await admin
          .from("partners")
          .update({ is_active: false })
          .eq("id", oldPartnerId);
        if (deactivatePartnerError) {
          return NextResponse.json({ error: deactivatePartnerError.message }, { status: 500 });
        }
        oldPartnerDeactivated = true;
      } else {
        oldPartnerDeactivateSkippedReason = "Old partner still has active area assignments";
      }
    }

    await writeSecurityAuditLog({
      actorUserId: adminUser.userId,
      actorRole: adminUser.role,
      eventType: "deactivate",
      entityType: "partner_area_map",
      entityId: `${oldPartnerId}:${areaId}`,
      payload: {
        action: "deactivate_old_mapping",
        area_id: areaId,
        old_partner_id: oldPartnerId,
        affected_rows: Array.isArray(oldMappingUpdated) ? oldMappingUpdated.length : 0,
      },
      ip: extractClientIpFromHeaders(req.headers),
      userAgent: req.headers.get("user-agent"),
    });

    await writeSecurityAuditLog({
      actorUserId: adminUser.userId,
      actorRole: adminUser.role,
      eventType: "create",
      entityType: "partner_area_map",
      entityId: String(newMapping.id),
      payload: {
        action: "assign_new_mapping",
        area_id: areaId,
        new_partner_id: newPartnerId,
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
        old_partner_id: oldPartnerId,
        new_partner_id: newPartnerId,
        deactivate_old_partner: deactivateOldPartner,
        deactivate_old_integrations: deactivateOldIntegrations,
        old_partner_deactivated: oldPartnerDeactivated,
        old_partner_deactivate_skipped_reason: oldPartnerDeactivateSkippedReason,
      },
      ip: extractClientIpFromHeaders(req.headers),
      userAgent: req.headers.get("user-agent"),
    });

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
        deactivate_old_partner_requested: deactivateOldPartner,
        deactivate_old_partner_applied: oldPartnerDeactivated,
        deactivate_old_partner_skipped_reason: oldPartnerDeactivateSkippedReason,
        deactivate_old_integrations: deactivateOldIntegrations,
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
