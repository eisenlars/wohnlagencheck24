import { NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { checkRateLimitPersistent, extractClientIpFromHeaders } from "@/lib/security/rate-limit";
import { checkPartnerAreaMandatoryTexts } from "@/lib/partner-area-mandatory";
import { INDIVIDUAL_MANDATORY_KEYS } from "@/lib/text-key-registry";
import { MANDATORY_MEDIA_KEYS } from "@/lib/mandatory-media";

type PartnerArea = {
  id?: string;
  name?: string;
  slug?: string;
  parent_slug?: string;
  bundesland_slug?: string;
};

type PartnerAreaConfig = {
  area_id: string;
  areas?: PartnerArea;
  is_active?: boolean;
  is_public_live?: boolean | null;
  activation_status?: string | null;
  partner_preview_signoff_at?: string | null;
  admin_review_note?: string | null;
  [key: string]: unknown;
};

type PartnerFeatureRow = {
  key: string;
  label: string;
  enabled: boolean;
  monthly_price_eur: number;
  billing_unit?: string | null;
  note?: string | null;
};

function isMissingAreaActivationStatusColumn(error: unknown): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return (
    (msg.includes("partner_area_map.activation_status") && msg.includes("does not exist"))
    || (msg.includes("partner_area_map.is_public_live") && msg.includes("does not exist"))
  );
}

function isMissingAreaPreviewSignoffColumn(error: unknown): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return msg.includes("partner_preview_signoff_at")
    && msg.includes("partner_area_map")
    && (msg.includes("does not exist") || msg.includes("schema cache"));
}

function isMissingAdminReviewNoteColumn(error: unknown): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return msg.includes("admin_review_note")
    && msg.includes("partner_area_map")
    && (msg.includes("does not exist") || msg.includes("schema cache"));
}

function isMissingPartnerNameColumns(error: unknown): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  if (!msg.includes("does not exist")) return false;
  return (
    msg.includes("partners.contact_first_name")
    || msg.includes("partners.contact_last_name")
  );
}

function isMissingBillingTable(error: unknown, table: string): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return msg.includes(`public.${table}`) && msg.includes("does not exist");
}

function asText(value: unknown): string | null {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

function asFiniteNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function resolvePartnerFirstNameFromUser(user: unknown): string | null {
  const rec = (typeof user === "object" && user !== null) ? (user as Record<string, unknown>) : null;
  if (!rec) return null;
  const meta = (typeof rec.user_metadata === "object" && rec.user_metadata !== null)
    ? (rec.user_metadata as Record<string, unknown>)
    : {};
  const candidates = [
    meta.first_name,
    meta.firstname,
    meta.given_name,
    meta.vorname,
  ]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
  if (candidates.length > 0) return candidates[0];

  const fullName = String(meta.full_name ?? meta.name ?? "").trim();
  if (!fullName) return null;
  const token = fullName.split(/\s+/)[0]?.trim();
  return token || null;
}

async function requirePartnerUser(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) throw new Error("UNAUTHORIZED");

  const ip = extractClientIpFromHeaders(req.headers);
  const limit = await checkRateLimitPersistent(
    `partner_dashboard_bootstrap:${user.id}:${ip}`,
    { windowMs: 60 * 1000, max: 120 },
  );
  if (!limit.allowed) throw new Error(`RATE_LIMIT:${limit.retryAfterSec}`);

  return { userId: user.id, user };
}

async function loadPartnerConfigs(admin: ReturnType<typeof createAdminClient>, userId: string): Promise<PartnerAreaConfig[]> {
  let { data, error } = await admin
    .from("partner_area_map")
    .select("area_id, is_active, is_public_live, activation_status, partner_preview_signoff_at, admin_review_note, areas(id, name, slug, parent_slug, bundesland_slug)")
    .eq("auth_user_id", userId)
    .order("area_id", { ascending: true });

  if (error && (isMissingAreaActivationStatusColumn(error) || isMissingAreaPreviewSignoffColumn(error) || isMissingAdminReviewNoteColumn(error))) {
    const missingActivationStatus = isMissingAreaActivationStatusColumn(error);
    const missingPreviewSignoff = isMissingAreaPreviewSignoffColumn(error);
    const missingAdminReviewNote = isMissingAdminReviewNoteColumn(error);

    if ((missingPreviewSignoff || missingAdminReviewNote) && !missingActivationStatus) {
      const fallback = await admin
        .from("partner_area_map")
        .select("area_id, is_active, is_public_live, activation_status, areas(id, name, slug, parent_slug, bundesland_slug)")
        .eq("auth_user_id", userId)
        .order("area_id", { ascending: true });
      data = (fallback.data ?? []).map((row) => ({
        ...row,
        partner_preview_signoff_at: null,
        admin_review_note: null,
      }));
      error = fallback.error;
    } else {
      const fallback = await admin
        .from("partner_area_map")
        .select("area_id, is_active, areas(id, name, slug, parent_slug, bundesland_slug)")
        .eq("auth_user_id", userId)
        .order("area_id", { ascending: true });
      data = (fallback.data ?? []).map((row) => ({
        ...row,
        is_public_live: null,
        activation_status: null,
        partner_preview_signoff_at: null,
        admin_review_note: null,
      }));
      error = fallback.error;
    }
  }

  if (error) throw new Error(error.message);

  let mergedConfigs = (data ?? []) as PartnerAreaConfig[];
  if (mergedConfigs.length === 0) return mergedConfigs;

  const activeDistricts = mergedConfigs.filter((cfg) => {
    const areaId = String(cfg.area_id ?? "");
    return areaId.split("-").length <= 3 && Boolean(cfg.is_active);
  });
  const activeDistrictSlugs = activeDistricts
    .map((cfg) => String(cfg.areas?.slug ?? "").trim())
    .filter((slug) => slug.length > 0);

  if (activeDistrictSlugs.length === 0) return mergedConfigs;

  const districtBySlug = new Map(
    activeDistricts.map((cfg) => [String(cfg.areas?.slug ?? ""), cfg] as const),
  );

  mergedConfigs = mergedConfigs.map((cfg) => {
    const areaId = String(cfg.area_id ?? "");
    if (!areaId || areaId.split("-").length <= 3) return cfg;
    const parentSlug = String(cfg.areas?.parent_slug ?? "").trim();
    const parentDistrict = districtBySlug.get(parentSlug);
    if (!parentDistrict) return cfg;
    return {
      ...cfg,
      is_active: true,
      is_public_live: Boolean(parentDistrict.is_public_live),
      activation_status: parentDistrict.activation_status ?? "active",
    };
  });

  const mappedAreaIds = new Set(mergedConfigs.map((cfg) => String(cfg.area_id ?? "")));
  const { data: childAreas, error: childAreasError } = await admin
    .from("areas")
    .select("id, name, slug, parent_slug, bundesland_slug")
    .in("parent_slug", activeDistrictSlugs)
    .order("name", { ascending: true });

  if (childAreasError) throw new Error(childAreasError.message);

  const derivedOrtslagen: PartnerAreaConfig[] = (childAreas ?? [])
    .map((area) => {
      const areaId = String(area.id ?? "");
      if (!areaId || mappedAreaIds.has(areaId)) return null;
      const parentSlug = String(area.parent_slug ?? "");
      const parentDistrict = districtBySlug.get(parentSlug);
      if (!parentDistrict) return null;
      return {
        area_id: areaId,
        is_active: true,
        activation_status: parentDistrict.activation_status ?? "active",
        is_public_live: Boolean(parentDistrict.is_public_live),
        areas: {
          id: areaId,
          name: String(area.name ?? ""),
          slug: String(area.slug ?? ""),
          parent_slug: parentSlug,
          bundesland_slug: String(area.bundesland_slug ?? ""),
        },
      } as PartnerAreaConfig;
    })
    .filter((entry): entry is PartnerAreaConfig => Boolean(entry));

  if (derivedOrtslagen.length === 0) return mergedConfigs;
  return [...mergedConfigs, ...derivedOrtslagen].sort((a, b) =>
    String(a.area_id ?? "").localeCompare(String(b.area_id ?? ""), "de"),
  );
}

async function loadPartnerFirstName(admin: ReturnType<typeof createAdminClient>, userId: string) {
  let { data, error } = await admin
    .from("partners")
    .select("contact_first_name, contact_last_name")
    .eq("id", userId)
    .maybeSingle();

  if (error && isMissingPartnerNameColumns(error)) {
    const fallback = await admin
      .from("partners")
      .select("id")
      .eq("id", userId)
      .maybeSingle();
    data = fallback.data ? { ...fallback.data, contact_first_name: null, contact_last_name: null } : null;
    error = fallback.error;
  }

  if (error) throw new Error(error.message);
  return asText(data?.contact_first_name) ?? null;
}

async function loadPartnerFeatures(admin: ReturnType<typeof createAdminClient>, userId: string): Promise<PartnerFeatureRow[]> {
  const [catalogRes, overridesRes] = await Promise.all([
    admin
      .from("billing_feature_catalog")
      .select("code, label, note, billing_unit, default_enabled, default_monthly_price_eur, sort_order, is_active")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("code", { ascending: true }),
    admin
      .from("partner_feature_overrides")
      .select("feature_code, is_enabled, monthly_price_eur")
      .eq("partner_id", userId),
  ]);

  if (catalogRes.error || overridesRes.error) {
    const error = catalogRes.error ?? overridesRes.error;
    if (!error) {
      return [];
    }
    if (
      isMissingBillingTable(error, "billing_feature_catalog")
      || isMissingBillingTable(error, "partner_feature_overrides")
    ) {
      return [];
    }
    throw new Error(error.message);
  }

  const overridesByCode = new Map(
    (overridesRes.data ?? []).map((row) => [String(row.feature_code ?? ""), row] as const),
  );

  return (catalogRes.data ?? []).map((feature) => {
    const code = String(feature.code ?? "");
    const override = overridesByCode.get(code);
    const enabled = override?.is_enabled ?? feature.default_enabled ?? false;
    const monthlyPrice = override?.monthly_price_eur ?? feature.default_monthly_price_eur ?? 0;
    return {
      key: code,
      label: String(feature.label ?? code),
      enabled: Boolean(enabled),
      monthly_price_eur: Number(asFiniteNumber(monthlyPrice).toFixed(2)),
      billing_unit: asText(feature.billing_unit) ?? "pro Monat",
      note: asText(feature.note) ?? "",
    };
  });
}

async function loadMandatoryProgress(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  areaId: string,
) {
  const mappingRes = await admin
    .from("partner_area_map")
    .select("id")
    .eq("auth_user_id", userId)
    .eq("area_id", areaId)
    .maybeSingle();

  if (mappingRes.error) throw new Error(mappingRes.error.message);
  if (!mappingRes.data) return null;

  const mandatoryCheck = await checkPartnerAreaMandatoryTexts({
    admin,
    partnerId: userId,
    areaId,
  });

  const total = INDIVIDUAL_MANDATORY_KEYS.length + MANDATORY_MEDIA_KEYS.length;
  const missing = mandatoryCheck.ok ? [] : (mandatoryCheck.missing ?? []);
  const missingUnique = new Set(missing.map((item) => item.key).filter(Boolean));
  const completed = Math.max(0, total - missingUnique.size);
  const percent = total > 0 ? Math.max(0, Math.min(100, Math.round((completed / total) * 100))) : 0;

  return {
    area_id: areaId,
    completed,
    total,
    percent,
  };
}

export async function GET(req: Request) {
  try {
    const { userId, user } = await requirePartnerUser(req);
    const admin = createAdminClient();
    const url = new URL(req.url);
    const requestedAreaId = String(url.searchParams.get("selected_area_id") ?? "").trim();

    const [configs, profileFirstName, partnerFeatures, mandatoryProgress] = await Promise.all([
      loadPartnerConfigs(admin, userId),
      (async () => resolvePartnerFirstNameFromUser(user) ?? await loadPartnerFirstName(admin, userId))(),
      loadPartnerFeatures(admin, userId),
      requestedAreaId ? loadMandatoryProgress(admin, userId, requestedAreaId) : Promise.resolve(null),
    ]);

    return NextResponse.json({
      ok: true,
      last_login: String(user.last_sign_in_at ?? "").trim() || null,
      partner_first_name: profileFirstName,
      partner_features: partnerFeatures,
      configs,
      requested_area_id: requestedAreaId || null,
      mandatory_progress: mandatoryProgress,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (error.message.startsWith("RATE_LIMIT:")) {
        const sec = Number(error.message.split(":")[1] ?? "60");
        return NextResponse.json(
          { error: "Too many requests" },
          { status: 429, headers: { "Retry-After": String(sec) } },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
