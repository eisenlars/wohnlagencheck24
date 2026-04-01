import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/security/admin-auth";
import { checkAdminApiRateLimit } from "@/lib/security/rate-limit";
import { createAdminClient } from "@/utils/supabase/admin";

type AreaOverviewRow = {
  key: string;
  kreisId: string;
  kreisName: string;
  partnerId: string;
  partnerName: string;
  isActive: boolean;
  activationStatus: string;
};

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

function statusPriority(status: string): number {
  if (status === "live") return 7;
  if (status === "approved_preview" || status === "active") return 6;
  if (status === "in_review") return 5;
  if (status === "ready_for_review") return 4;
  if (status === "changes_requested") return 3;
  if (status === "in_progress") return 2;
  return 1;
}

function matchesFilter(row: AreaOverviewRow, query: string, onlyActive: boolean): boolean {
  if (onlyActive && !row.isActive) return false;
  if (!query) return true;
  const haystack = [
    row.kreisName,
    row.kreisId,
    row.partnerName,
    row.partnerId,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
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
    const q = String(url.searchParams.get("q") ?? "").trim().toLowerCase();
    const onlyActive = url.searchParams.get("only_active") === "1";
    const admin = createAdminClient();

    const { data: partners, error: partnerError } = await admin
      .from("partners")
      .select("id, company_name");
    if (partnerError) return NextResponse.json({ error: partnerError.message }, { status: 500 });

    let { data: mappings, error: mappingError } = await admin
      .from("partner_area_map")
      .select("auth_user_id, area_id, is_active, is_public_live, activation_status, areas(name)")
      .order("area_id", { ascending: true });

    if (mappingError && isMissingAreaActivationStatusColumn(mappingError)) {
      const fallback = await admin
        .from("partner_area_map")
        .select("auth_user_id, area_id, is_active, areas(name)")
        .order("area_id", { ascending: true });
      mappings = (fallback.data ?? []).map((row) => {
        const baseRow = (row && typeof row === "object" ? row : {}) as Record<string, unknown>;
        return {
          auth_user_id: typeof baseRow.auth_user_id === "string" ? baseRow.auth_user_id : "",
          area_id: typeof baseRow.area_id === "string" ? baseRow.area_id : "",
          is_active: typeof baseRow.is_active === "boolean" ? baseRow.is_active : false,
          is_public_live: false,
          activation_status: null,
          areas: baseRow.areas,
        };
      });
      mappingError = fallback.error;
    }

    if (mappingError) return NextResponse.json({ error: mappingError.message }, { status: 500 });

    const partnerNameById = new Map<string, string>();
    for (const row of partners ?? []) {
      const partnerId = String((row as { id?: unknown }).id ?? "").trim();
      if (!partnerId) continue;
      partnerNameById.set(partnerId, String((row as { company_name?: unknown }).company_name ?? "").trim() || partnerId);
    }

    const groupedRows = new Map<string, AreaOverviewRow>();
    for (const row of (mappings ?? []) as Array<Record<string, unknown>>) {
      const partnerId = String(row.auth_user_id ?? "").trim();
      const areaId = String(row.area_id ?? "").trim();
      if (!partnerId || !areaId) continue;
      const kreisId = areaId.split("-").slice(0, 3).join("-");
      if (kreisId.split("-").length !== 3) continue;
      const key = `${partnerId}:${kreisId}`;
      const areaSource = Array.isArray(row.areas) ? row.areas[0] : row.areas;
      const kreisName = String(
        (areaSource && typeof areaSource === "object" ? (areaSource as { name?: unknown }).name : "")
          ?? "",
      ).trim() || kreisId;
      const activationStatus = normalizeActivationStatus(row.activation_status, Boolean(row.is_active), Boolean(row.is_public_live));
      const existing = groupedRows.get(key);
      if (!existing) {
        groupedRows.set(key, {
          key,
          kreisId,
          kreisName,
          partnerId,
          partnerName: partnerNameById.get(partnerId) ?? partnerId,
          isActive: Boolean(row.is_active),
          activationStatus,
        });
        continue;
      }
      groupedRows.set(key, {
        ...existing,
        kreisName: existing.kreisName === existing.kreisId ? kreisName : existing.kreisName,
        isActive: existing.isActive || Boolean(row.is_active),
        activationStatus: statusPriority(activationStatus) > statusPriority(existing.activationStatus)
          ? activationStatus
          : existing.activationStatus,
      });
    }

    const allRows = Array.from(groupedRows.values()).sort((a, b) => {
      const byKreis = a.kreisId.localeCompare(b.kreisId, "de");
      if (byKreis !== 0) return byKreis;
      return a.partnerName.localeCompare(b.partnerName, "de");
    });
    const filteredRows = allRows.filter((row) => matchesFilter(row, q, onlyActive));

    return NextResponse.json({
      ok: true,
      areas: filteredRows,
      total_count: allRows.length,
      filtered_count: filteredRows.length,
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
