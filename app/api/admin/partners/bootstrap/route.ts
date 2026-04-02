import { NextResponse } from "next/server";

import { createAdminClient } from "@/utils/supabase/admin";
import { requireAdmin } from "@/lib/security/admin-auth";
import { checkAdminApiRateLimit } from "@/lib/security/rate-limit";

type PartnerAreaSummary = {
  total_areas: number;
  live_areas: number;
  activation_open: number;
  has_assignment: boolean;
};

type PartnerRow = {
  id: string;
  company_name: string;
  contact_email: string | null;
  contact_first_name: string | null;
  contact_last_name: string | null;
  website_url: string | null;
  is_active: boolean;
  is_system_default: boolean;
  llm_partner_managed_allowed: boolean;
  llm_mode_default: string;
  created_at: string | null;
};

function roundTiming(value: number): number {
  return Number(value.toFixed(2));
}

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

function isMissingAreaActivationStatusColumn(error: unknown): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return (
    msg.includes("partner_area_map.activation_status") && msg.includes("does not exist")
  ) || (
    msg.includes("partner_area_map.is_public_live") && msg.includes("does not exist")
  );
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

function normalizePartnerRow(value: unknown, includeIsActive: boolean): PartnerRow {
  const row = withPartnerFallback(
    (value && typeof value === "object" ? value : {}) as Record<string, unknown>,
    includeIsActive,
  );
  return {
    id: String(row.id ?? ""),
    company_name: String(row.company_name ?? ""),
    contact_email: row.contact_email == null ? null : String(row.contact_email),
    contact_first_name: row.contact_first_name == null ? null : String(row.contact_first_name),
    contact_last_name: row.contact_last_name == null ? null : String(row.contact_last_name),
    website_url: row.website_url == null ? null : String(row.website_url),
    is_active: Boolean(row.is_active),
    is_system_default: Boolean(row.is_system_default),
    llm_partner_managed_allowed: Boolean(row.llm_partner_managed_allowed),
    llm_mode_default: String(row.llm_mode_default ?? "central_managed"),
    created_at: row.created_at == null ? null : String(row.created_at),
  };
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

export async function GET(req: Request) {
  try {
    const requestStartedAt = performance.now();
    const url = new URL(req.url);
    const debugTiming = url.searchParams.get("debug_timing") === "1";
    const timings: Record<string, number> = {};
    const mark = (key: string, startedAt: number) => {
      if (!debugTiming) return;
      timings[key] = roundTiming(performance.now() - startedAt);
    };
    const withDebugTimings = <T extends Record<string, unknown>>(payload: T): T | (T & { debug_timings: Record<string, number> }) => {
      if (!debugTiming) return payload;
      return {
        ...payload,
        debug_timings: {
          ...timings,
          total_ms: roundTiming(performance.now() - requestStartedAt),
        },
      };
    };

    const authStartedAt = performance.now();
    const adminUser = await requireAdmin(["admin_super", "admin_ops"]);
    const adminRate = await checkAdminApiRateLimit(req, adminUser.userId);
    mark("auth_ms", authStartedAt);
    if (!adminRate.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(adminRate.retryAfterSec) } },
      );
    }

    const includeInactive = url.searchParams.get("include_inactive") === "1";
    const onlyActive = url.searchParams.get("only_active") === "1";
    const q = String(url.searchParams.get("q") ?? "").trim();
    const requestedSelectedPartnerId = String(url.searchParams.get("selected_partner_id") ?? "").trim();

    const admin = createAdminClient();

    let partnersQuery = admin
      .from("partners")
      .select("id, company_name, contact_email, contact_first_name, contact_last_name, website_url, is_active, is_system_default, llm_partner_managed_allowed, llm_mode_default, created_at")
      .order("company_name", { ascending: true });

    if (onlyActive || !includeInactive) {
      partnersQuery = partnersQuery.eq("is_active", true);
    }
    if (q) {
      partnersQuery = partnersQuery.or([
        `company_name.ilike.%${q}%`,
        `contact_email.ilike.%${q}%`,
        `id.ilike.%${q}%`,
      ].join(", "));
    }

    const partnersQueryStartedAt = performance.now();
    let { data: partnersData, error: partnersError } = await partnersQuery;
    if (partnersError && (isMissingIsActiveColumn(partnersError) || isMissingPartnerNameColumns(partnersError) || isMissingPartnerLlmPolicyColumns(partnersError) || isMissingPartnerSystemDefaultColumn(partnersError))) {
      const missingIsActive = isMissingIsActiveColumn(partnersError);
      const missingNames = isMissingPartnerNameColumns(partnersError);
      const missingLlm = isMissingPartnerLlmPolicyColumns(partnersError);
      const missingSystemDefault = isMissingPartnerSystemDefaultColumn(partnersError);
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
      const fallback = await fallbackQuery;
      partnersData = (fallback.data ?? []).map((row) => normalizePartnerRow(row, !missingIsActive));
      partnersError = fallback.error;
    }
    mark("partners_query_ms", partnersQueryStartedAt);

    if (partnersError) {
      return NextResponse.json({ error: partnersError.message }, { status: 500 });
    }

    const partners = (partnersData ?? []) as Array<Record<string, unknown>>;
    const partnerIds = partners.map((row) => String(row.id ?? "").trim()).filter(Boolean);

    const areaSummaryStartedAt = performance.now();
    const areaSummaries = await loadPartnerAreaSummaries(admin, partnerIds);
    mark("area_summary_ms", areaSummaryStartedAt);

    const enrichedPartners = partners.map((row) => {
      const partnerId = String(row.id ?? "").trim();
      return {
        ...row,
        area_summary: areaSummaries.get(partnerId) ?? {
          total_areas: 0,
          live_areas: 0,
          activation_open: 0,
          has_assignment: false,
        },
      };
    });

    const selectedPartnerId = requestedSelectedPartnerId && partnerIds.includes(requestedSelectedPartnerId)
      ? requestedSelectedPartnerId
      : "";

    let selectedPartner: Record<string, unknown> | null = null;
    let selectedAreaMappings: unknown[] = [];

    if (selectedPartnerId) {
      const selectedPartnerQueryStartedAt = performance.now();
      let { data: partnerData, error: partnerError } = await admin
        .from("partners")
        .select("id, company_name, contact_email, contact_first_name, contact_last_name, website_url, is_active, is_system_default, llm_partner_managed_allowed, llm_mode_default, created_at")
        .eq("id", selectedPartnerId)
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
          .eq("id", selectedPartnerId)
          .maybeSingle();
        partnerData = fallback.data
          ? normalizePartnerRow(fallback.data, !missingIsActive)
          : null;
        partnerError = fallback.error;
      }
      mark("selected_partner_query_ms", selectedPartnerQueryStartedAt);

      if (partnerError) {
        return NextResponse.json({ error: partnerError.message }, { status: 500 });
      }

      selectedPartner = (partnerData as Record<string, unknown> | null) ?? null;

      const selectedMappingsQueryStartedAt = performance.now();
      let { data: mappingsData, error: mappingsError } = await admin
        .from("partner_area_map")
        .select("id, auth_user_id, area_id, is_active, is_public_live, activation_status")
        .eq("auth_user_id", selectedPartnerId)
        .order("area_id", { ascending: true });

      if (mappingsError && isMissingAreaActivationStatusColumn(mappingsError)) {
        const fallback = await admin
          .from("partner_area_map")
          .select("id, auth_user_id, area_id, is_active")
          .eq("auth_user_id", selectedPartnerId)
          .order("area_id", { ascending: true });
        mappingsData = (fallback.data ?? []).map((row) => {
          const baseRow = (row && typeof row === "object" ? row : {}) as Record<string, unknown>;
          return {
            id: typeof baseRow.id === "string" ? baseRow.id : null,
            auth_user_id: typeof baseRow.auth_user_id === "string" ? baseRow.auth_user_id : null,
            area_id: typeof baseRow.area_id === "string" ? baseRow.area_id : null,
            is_active: typeof baseRow.is_active === "boolean" ? baseRow.is_active : null,
            is_public_live: null,
            activation_status: null,
          };
        });
        mappingsError = fallback.error;
      }
      mark("selected_area_mappings_query_ms", selectedMappingsQueryStartedAt);

      if (mappingsError) {
        return NextResponse.json({ error: mappingsError.message }, { status: 500 });
      }

      selectedAreaMappings = mappingsData ?? [];
    }

    return NextResponse.json(withDebugTimings({
      ok: true,
      partners: enrichedPartners,
      selected_partner_id: selectedPartnerId || null,
      selected_partner: selectedPartner,
      selected_area_mappings: selectedAreaMappings,
    }));
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
