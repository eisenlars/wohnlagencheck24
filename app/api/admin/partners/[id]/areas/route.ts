import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

import { createAdminClient } from "@/utils/supabase/admin";
import { requireAdmin } from "@/lib/security/admin-auth";
import { writeSecurityAuditLog } from "@/lib/security/audit-log";
import { checkAdminApiRateLimit, extractClientIpFromHeaders } from "@/lib/security/rate-limit";
import { publishVisibilityIndex } from "@/lib/visibility-index";
import { sendPartnerAreaAssignedEmail } from "@/lib/notifications/admin-review-email";
import {
  bootstrapAreaReportText,
  fetchStandardPayload,
  type AreaRow,
} from "@/lib/text-bootstrap";
import { reportScopeTagsForArea } from "@/lib/cache-tags";

type AssignAreaBody = {
  area_id?: string;
};

function isMissingActivationStatusColumn(error: unknown): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return msg.includes("partner_area_map.activation_status") && msg.includes("does not exist");
}

function isKreisAreaId(areaId: string): boolean {
  const parts = String(areaId ?? "")
    .trim()
    .split("-")
    .filter((p) => p.length > 0);
  return parts.length === 3;
}

function toUniqueAreaIds(areas: AreaRow[]): string[] {
  return Array.from(
    new Set(
      areas
        .map((area) => String(area.id ?? "").trim())
        .filter((id) => id.length > 0),
    ),
  );
}

export async function POST(
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

    const body = (await req.json()) as AssignAreaBody;
    const areaId = String(body.area_id ?? "").trim();
    if (!areaId) {
      return NextResponse.json({ error: "Missing area_id" }, { status: 400 });
    }
    if (!isKreisAreaId(areaId)) {
      return NextResponse.json({ error: "Only kreis area_id is allowed" }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: partnerExists, error: partnerError } = await admin
      .from("partners")
      .select("id, company_name, contact_email, contact_first_name")
      .eq("id", partnerId)
      .maybeSingle();
    if (partnerError) {
      return NextResponse.json({ error: partnerError.message }, { status: 500 });
    }
    if (!partnerExists) {
      return NextResponse.json({ error: "Partner not found" }, { status: 404 });
    }

    const { data: areaExists, error: areaError } = await admin
      .from("areas")
      .select("id, slug, name, parent_slug, bundesland_slug")
      .eq("id", areaId)
      .maybeSingle();
    if (areaError) {
      return NextResponse.json({ error: areaError.message }, { status: 500 });
    }
    if (!areaExists) {
      return NextResponse.json({ error: "Area not found" }, { status: 404 });
    }

    const standardPayload = await fetchStandardPayload(admin as never);
    if (!standardPayload) {
      return NextResponse.json(
        { error: "Standard text payload not found at text-standards/kreis/text_standard_kreis.json" },
        { status: 500 },
      );
    }

    const { data: allAreasRaw, error: allAreasError } = await admin
      .from("areas")
      .select("id, slug, name, parent_slug, bundesland_slug")
      .order("id", { ascending: true });
    if (allAreasError) {
      return NextResponse.json({ error: allAreasError.message }, { status: 500 });
    }

    const allAreas = ((allAreasRaw ?? []) as Array<{
      id?: string | null;
      slug?: string | null;
      name?: string | null;
      parent_slug?: string | null;
      bundesland_slug?: string | null;
    }>)
      .map((row) => ({
        id: String(row.id ?? "").trim(),
        slug: String(row.slug ?? "").trim(),
        name: row.name ? String(row.name) : null,
        parent_slug: row.parent_slug ? String(row.parent_slug) : null,
        bundesland_slug: String(row.bundesland_slug ?? "").trim(),
      }))
      .filter((row) => row.id && row.slug && row.bundesland_slug) as AreaRow[];

    const rootArea = allAreas.find((area) => area.id === areaId);
    if (!rootArea) {
      return NextResponse.json({ error: "Area metadata not found for bootstrap" }, { status: 500 });
    }

    const bootstrapTargets: AreaRow[] = [
      rootArea,
      ...allAreas.filter(
        (area) =>
          area.bundesland_slug === rootArea.bundesland_slug &&
          (
            String(area.parent_slug ?? "") === rootArea.slug
            || String(area.id ?? "").startsWith(`${rootArea.id}-`)
          ),
      ),
    ];
    const assignmentAreaIds = toUniqueAreaIds(bootstrapTargets);

    const { data: activeAssignedRows, error: activeAssignedError } = await admin
      .from("partner_area_map")
      .select("auth_user_id, area_id")
      .in("area_id", assignmentAreaIds)
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
        {
          error: "Area already assigned to another partner",
          blocked_area_ids: blockedAreaIds,
        },
        { status: 409 },
      );
    }

    const bootstrapResults = [];
    for (const target of bootstrapTargets) {
      const result = await bootstrapAreaReportText({
        admin: admin as never,
        area: target,
        allAreas,
        standardPayload,
        force: false,
        dryRun: false,
      });
      bootstrapResults.push(result);
      if (result.status === "error") {
        return NextResponse.json(
          { error: `Text bootstrap failed for area ${target.id}: ${result.reason ?? "unknown"}` },
          { status: 500 },
        );
      }
    }

    if (bootstrapResults.some((row) => row.status === "updated")) {
      const reportTags = new Set<string>();
      for (const area of bootstrapTargets) {
        for (const tag of reportScopeTagsForArea(area)) {
          reportTags.add(tag);
        }
      }
      for (const tag of reportTags) {
        revalidateTag(tag, "max");
      }
    }

    // Workflow-Regel: neue Zuordnung wird immer inaktiv angelegt.
    // Aktivierung erfolgt erst im separaten PATCH-Flow inkl. Mandatory-Gate.
    const assignmentPayload = assignmentAreaIds.map((targetAreaId) => ({
      auth_user_id: partnerId,
      area_id: targetAreaId,
      is_active: false,
      activation_status: "assigned",
    }));

    let { data, error } = await admin
      .from("partner_area_map")
      .upsert(assignmentPayload, { onConflict: "auth_user_id,area_id" })
      .select("id, auth_user_id, area_id, is_active, activation_status, created_at");

    if (error && isMissingActivationStatusColumn(error)) {
      const fallback = await admin
        .from("partner_area_map")
        .upsert(
          assignmentAreaIds.map((targetAreaId) => ({
            auth_user_id: partnerId,
            area_id: targetAreaId,
            is_active: false,
          })),
          { onConflict: "auth_user_id,area_id" },
        )
        .select("id, auth_user_id, area_id, is_active, created_at");
      data = Array.isArray(fallback.data)
        ? fallback.data.map((row) => ({ ...row, activation_status: "assigned" }))
        : null;
      error = fallback.error;
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data || data.length === 0) {
      return NextResponse.json({ error: "Area assignment returned no data" }, { status: 500 });
    }
    const rootMapping = data.find((row) => String((row as { area_id?: string | null }).area_id ?? "") === areaId) ?? data[0];

    await writeSecurityAuditLog({
      actorUserId: adminUser.userId,
      actorRole: adminUser.role,
      eventType: "create",
      entityType: "partner_area_map",
      entityId: String(rootMapping.id),
      payload: {
        auth_user_id: partnerId,
        area_id: areaId,
        assigned_area_ids: assignmentAreaIds,
        assigned_area_count: assignmentAreaIds.length,
        is_active: Boolean((rootMapping as { is_active?: boolean | null }).is_active),
        activation_status: String((rootMapping as { activation_status?: string | null }).activation_status ?? "assigned"),
      },
      ip: extractClientIpFromHeaders(req.headers),
      userAgent: req.headers.get("user-agent"),
    });

    let partnerAssignMailSent = false;
    let partnerAssignMailReason: string | undefined;
    try {
      const partnerMail = await sendPartnerAreaAssignedEmail({
        partnerEmail: String((partnerExists as { contact_email?: string | null } | null)?.contact_email ?? "").trim(),
        partnerName: String((partnerExists as { contact_first_name?: string | null } | null)?.contact_first_name ?? "").trim()
          || String((partnerExists as { company_name?: string | null } | null)?.company_name ?? "").trim()
          || partnerId,
        areaId,
        areaName: String((areaExists as { name?: string | null } | null)?.name ?? "").trim() || areaId,
        assignedAtIso: new Date().toISOString(),
      });
      partnerAssignMailSent = partnerMail.sent;
      partnerAssignMailReason = partnerMail.reason;
      if (!partnerMail.sent) {
        console.warn("partner assign mail not sent:", partnerMail.reason);
      }
    } catch (mailErr) {
      partnerAssignMailSent = false;
      partnerAssignMailReason = mailErr instanceof Error ? mailErr.message : "mail_error";
      console.warn("partner assign mail failed:", mailErr);
    }

    await writeSecurityAuditLog({
      actorUserId: adminUser.userId,
      actorRole: adminUser.role,
      eventType: "other",
      entityType: "other",
      entityId: `${areaId}:assign:partner_mail`,
      payload: {
        action: "mail_admin_assign_partner_notify",
        area_id: areaId,
        partner_id: partnerId,
        sent: partnerAssignMailSent,
        reason: partnerAssignMailReason ?? null,
      },
      ip: extractClientIpFromHeaders(req.headers),
      userAgent: req.headers.get("user-agent"),
    });

    try {
      await publishVisibilityIndex(admin as never);
    } catch (publishErr) {
      console.warn("visibility index publish failed after area assign:", publishErr);
    }

    return NextResponse.json(
      {
        ok: true,
        mapping: rootMapping,
        mappings_count: data.length,
        assigned_area_ids: assignmentAreaIds,
        bootstrap: {
          total: bootstrapResults.length,
          updated: bootstrapResults.filter((row) => row.status === "updated").length,
          skipped: bootstrapResults.filter((row) => row.status === "skipped").length,
        },
        notification: {
          partner: {
            sent: partnerAssignMailSent,
            reason: partnerAssignMailReason ?? null,
          },
        },
      },
      { status: 201 },
    );
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
