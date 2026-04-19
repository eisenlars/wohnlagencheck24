import { NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { checkRateLimitPersistent, extractClientIpFromHeaders } from "@/lib/security/rate-limit";
import { writeSecurityAuditLog } from "@/lib/security/audit-log";
import { publishVisibilityIndex } from "@/lib/visibility-index";

type VisibilityMode = "partner_wide" | "strict_local";

type VisibilityBody = {
  offer_visibility_mode?: VisibilityMode;
  request_visibility_mode?: VisibilityMode;
  reference_visibility_mode?: VisibilityMode;
};

function isMissingVisibilityModeColumn(error: unknown): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return (
    msg.includes("partner_area_map.offer_visibility_mode")
    || msg.includes("partner_area_map.request_visibility_mode")
    || msg.includes("partner_area_map.reference_visibility_mode")
  ) && (msg.includes("does not exist") || msg.includes("schema cache"));
}

function isKreisAreaId(areaId: string): boolean {
  return String(areaId ?? "")
    .split("-")
    .filter((part) => part.length > 0).length === 3;
}

function normalizeVisibilityMode(value: unknown): VisibilityMode | null {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "partner_wide") return "partner_wide";
  if (raw === "strict_local") return "strict_local";
  return null;
}

async function requirePartnerUser(req: Request): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) throw new Error("UNAUTHORIZED");

  const ip = extractClientIpFromHeaders(req.headers);
  const limit = await checkRateLimitPersistent(
    `partner_area_visibility:${user.id}:${ip}`,
    { windowMs: 60 * 1000, max: 30 },
  );
  if (!limit.allowed) throw new Error(`RATE_LIMIT:${limit.retryAfterSec}`);
  return user.id;
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

  return Array.from(new Set([areaId, ...childIds]));
}

export async function PATCH(
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

    const body = (await req.json()) as VisibilityBody;
    const offerVisibilityMode = body.offer_visibility_mode !== undefined
      ? normalizeVisibilityMode(body.offer_visibility_mode)
      : null;
    const requestVisibilityMode = body.request_visibility_mode !== undefined
      ? normalizeVisibilityMode(body.request_visibility_mode)
      : null;
    const referenceVisibilityMode = body.reference_visibility_mode !== undefined
      ? normalizeVisibilityMode(body.reference_visibility_mode)
      : null;

    if (body.offer_visibility_mode !== undefined && !offerVisibilityMode) {
      return NextResponse.json({ error: "Invalid offer_visibility_mode" }, { status: 400 });
    }
    if (body.request_visibility_mode !== undefined && !requestVisibilityMode) {
      return NextResponse.json({ error: "Invalid request_visibility_mode" }, { status: 400 });
    }
    if (body.reference_visibility_mode !== undefined && !referenceVisibilityMode) {
      return NextResponse.json({ error: "Invalid reference_visibility_mode" }, { status: 400 });
    }
    if (
      body.offer_visibility_mode === undefined
      && body.request_visibility_mode === undefined
      && body.reference_visibility_mode === undefined
    ) {
      return NextResponse.json({ error: "Missing visibility mode payload" }, { status: 400 });
    }

    const admin = createAdminClient();
    const targetAreaIds = await resolveAssignmentAreaIds(admin, areaId);

    const patch: Record<string, unknown> = {};
    if (offerVisibilityMode) patch.offer_visibility_mode = offerVisibilityMode;
    if (requestVisibilityMode) patch.request_visibility_mode = requestVisibilityMode;
    if (referenceVisibilityMode) patch.reference_visibility_mode = referenceVisibilityMode;

    const { data: existing, error: existingError } = await admin
      .from("partner_area_map")
      .select("id, area_id")
      .eq("auth_user_id", userId)
      .in("area_id", targetAreaIds);

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }
    if (!Array.isArray(existing) || existing.length === 0) {
      return NextResponse.json({ error: "Area assignment not found" }, { status: 404 });
    }

    const { data, error } = await admin
      .from("partner_area_map")
      .update(patch)
      .eq("auth_user_id", userId)
      .in("area_id", targetAreaIds)
      .select("id, auth_user_id, area_id, is_active, is_public_live, activation_status, offer_visibility_mode, request_visibility_mode, reference_visibility_mode, partner_preview_signoff_at, admin_review_note, created_at");

    if (error && isMissingVisibilityModeColumn(error)) {
      return NextResponse.json(
        { error: "partner_area_map.*_visibility_mode fehlt. Bitte DB-Migration zuerst ausführen." },
        { status: 500 },
      );
    }
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data || data.length === 0) {
      return NextResponse.json({ error: "Area assignment not found" }, { status: 404 });
    }

    const rootMapping = data.find((row) => String((row as { area_id?: string | null }).area_id ?? "") === areaId) ?? data[0];

    await writeSecurityAuditLog({
      actorUserId: userId,
      actorRole: "system",
      eventType: "update",
      entityType: "partner_area_map",
      entityId: String((rootMapping as { id?: string | null }).id ?? areaId),
      payload: {
        action: "partner_update_visibility_modes",
        area_id: areaId,
        affected_area_ids: targetAreaIds,
        offer_visibility_mode: (rootMapping as { offer_visibility_mode?: string | null }).offer_visibility_mode ?? null,
        request_visibility_mode: (rootMapping as { request_visibility_mode?: string | null }).request_visibility_mode ?? null,
        reference_visibility_mode: (rootMapping as { reference_visibility_mode?: string | null }).reference_visibility_mode ?? null,
      },
      ip: extractClientIpFromHeaders(req.headers),
      userAgent: req.headers.get("user-agent"),
    });

    try {
      await publishVisibilityIndex(admin as never);
    } catch (publishErr) {
      console.warn("visibility index publish failed after partner visibility update:", publishErr);
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
