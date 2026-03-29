import { createAdminClient } from "@/utils/supabase/admin";
import type {
  AIBillingMode,
  BookingStatus,
  NetworkPartnerBookingCreateInput,
  NetworkPartnerBookingRecord,
  NetworkPartnerBookingUpdateInput,
} from "@/lib/network-partners/types";
import { hasActiveInventoryForAreaAndPlacement } from "@/lib/network-partners/repositories/inventory";

function asText(value: unknown): string {
  return String(value ?? "").trim();
}

function asNullableText(value: unknown): string | null {
  const normalized = asText(value);
  return normalized.length > 0 ? normalized : null;
}

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function normalizeStatus(value: unknown): BookingStatus {
  const status = asText(value);
  if (
    status === "pending_review"
    || status === "active"
    || status === "paused"
    || status === "cancelled"
    || status === "expired"
  ) {
    return status;
  }
  return "draft";
}

function normalizeAIBillingMode(value: unknown): AIBillingMode {
  const mode = asText(value);
  if (mode === "credit_based" || mode === "blocked") return mode;
  return "included";
}

function normalizeRequiredLocales(locales: string[]): string[] {
  const normalized = Array.from(
    new Set(
      (locales ?? [])
        .map((locale) => String(locale ?? "").trim().toLowerCase())
        .filter(Boolean),
    ),
  );
  return normalized;
}

function assertValidAmount(value: number, field: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`INVALID_${field.toUpperCase()}`);
  }
}

function assertBillingCycleDay(value: number) {
  if (!Number.isInteger(value) || value < 1 || value > 28) {
    throw new Error("INVALID_BILLING_CYCLE_DAY");
  }
}

function assertRequiredLocales(locales: string[]) {
  if (locales.length === 0) {
    throw new Error("INVALID_REQUIRED_LOCALES");
  }
  if (!locales.includes("de")) {
    throw new Error("MISSING_DE_LOCALE");
  }
}

function assertAllowedBookingTransition(current: BookingStatus, next: BookingStatus) {
  if (current === next) return;
  const allowedTransitions: Record<BookingStatus, BookingStatus[]> = {
    draft: ["pending_review", "cancelled"],
    pending_review: ["active", "cancelled"],
    active: ["paused", "expired", "cancelled"],
    paused: ["active", "cancelled", "expired"],
    cancelled: [],
    expired: [],
  };
  if (!allowedTransitions[current].includes(next)) {
    throw new Error("INVALID_BOOKING_STATUS_TRANSITION");
  }
}

function mapBookingRow(row: Record<string, unknown>): NetworkPartnerBookingRecord {
  return {
    id: asText(row.id),
    portal_partner_id: asText(row.portal_partner_id),
    network_partner_id: asText(row.network_partner_id),
    area_id: asText(row.area_id),
    placement_code: String(row.placement_code ?? "").trim() as NetworkPartnerBookingRecord["placement_code"],
    status: normalizeStatus(row.status),
    starts_at: asText(row.starts_at),
    ends_at: asNullableText(row.ends_at),
    monthly_price_eur: asNumber(row.monthly_price_eur),
    portal_fee_eur: asNumber(row.portal_fee_eur),
    billing_cycle_day: Math.floor(asNumber(row.billing_cycle_day)),
    required_locales: normalizeRequiredLocales(
      Array.isArray(row.required_locales) ? row.required_locales.map((value) => String(value)) : [],
    ),
    ai_billing_mode: normalizeAIBillingMode(row.ai_billing_mode),
    ai_monthly_budget_eur: asNumber(row.ai_monthly_budget_eur),
    notes: asNullableText(row.notes),
    created_at: asText(row.created_at),
    updated_at: asText(row.updated_at),
  };
}

async function assertNetworkPartnerBelongsToPortalPartner(
  portalPartnerId: string,
  networkPartnerId: string,
): Promise<void> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("network_partners")
    .select("id, portal_partner_id")
    .eq("id", networkPartnerId)
    .eq("portal_partner_id", portalPartnerId)
    .maybeSingle();

  if (error) throw new Error(error.message ?? "NETWORK_PARTNER_LOOKUP_FAILED");
  if (!data) throw new Error("NETWORK_PARTNER_NOT_OWNED");
}

export async function assertBookingInputIsConsistent(input: {
  portal_partner_id: string;
  network_partner_id: string;
  area_id: string;
  placement_code: NetworkPartnerBookingRecord["placement_code"];
  monthly_price_eur: number;
  portal_fee_eur: number;
  required_locales: string[];
}): Promise<void> {
  await assertNetworkPartnerBelongsToPortalPartner(input.portal_partner_id, input.network_partner_id);
  const hasInventory = await hasActiveInventoryForAreaAndPlacement(
    input.portal_partner_id,
    input.area_id,
    input.placement_code,
  );
  if (!hasInventory) {
    throw new Error("INVENTORY_NOT_AVAILABLE");
  }
  assertValidAmount(input.monthly_price_eur, "monthly_price_eur");
  assertValidAmount(input.portal_fee_eur, "portal_fee_eur");
  if (input.portal_fee_eur > input.monthly_price_eur) {
    throw new Error("PORTAL_FEE_EXCEEDS_MONTHLY_PRICE");
  }
  assertRequiredLocales(normalizeRequiredLocales(input.required_locales));
}

export async function listBookingsByPortalPartner(
  partnerId: string,
): Promise<NetworkPartnerBookingRecord[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("network_partner_bookings")
    .select("id, portal_partner_id, network_partner_id, area_id, placement_code, status, starts_at, ends_at, monthly_price_eur, portal_fee_eur, billing_cycle_day, required_locales, ai_billing_mode, ai_monthly_budget_eur, notes, created_at, updated_at")
    .eq("portal_partner_id", partnerId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message ?? "BOOKINGS_LIST_FAILED");
  return (data ?? []).map((row) => mapBookingRow(row as Record<string, unknown>));
}

export async function getBookingByIdForPortalPartner(
  id: string,
  partnerId: string,
): Promise<NetworkPartnerBookingRecord | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("network_partner_bookings")
    .select("id, portal_partner_id, network_partner_id, area_id, placement_code, status, starts_at, ends_at, monthly_price_eur, portal_fee_eur, billing_cycle_day, required_locales, ai_billing_mode, ai_monthly_budget_eur, notes, created_at, updated_at")
    .eq("id", id)
    .eq("portal_partner_id", partnerId)
    .maybeSingle();

  if (error) throw new Error(error.message ?? "BOOKING_LOOKUP_FAILED");
  return data ? mapBookingRow(data as Record<string, unknown>) : null;
}

export async function createBooking(
  input: NetworkPartnerBookingCreateInput,
): Promise<NetworkPartnerBookingRecord> {
  const requiredLocales = normalizeRequiredLocales(input.required_locales);
  await assertBookingInputIsConsistent({
    portal_partner_id: input.portal_partner_id,
    network_partner_id: input.network_partner_id,
    area_id: input.area_id,
    placement_code: input.placement_code,
    monthly_price_eur: input.monthly_price_eur,
    portal_fee_eur: input.portal_fee_eur,
    required_locales: requiredLocales,
  });
  assertBillingCycleDay(input.billing_cycle_day);
  assertValidAmount(input.ai_monthly_budget_eur ?? 0, "ai_monthly_budget_eur");

  const admin = createAdminClient();
  const payload = {
    portal_partner_id: input.portal_partner_id,
    network_partner_id: input.network_partner_id,
    area_id: input.area_id,
    placement_code: input.placement_code,
    status: input.status ?? "draft",
    starts_at: input.starts_at,
    ends_at: asNullableText(input.ends_at),
    monthly_price_eur: input.monthly_price_eur,
    portal_fee_eur: input.portal_fee_eur,
    billing_cycle_day: input.billing_cycle_day,
    required_locales: requiredLocales,
    ai_billing_mode: input.ai_billing_mode,
    ai_monthly_budget_eur: input.ai_monthly_budget_eur ?? 0,
    notes: asNullableText(input.notes),
  };

  const { data, error } = await admin
    .from("network_partner_bookings")
    .insert(payload)
    .select("id, portal_partner_id, network_partner_id, area_id, placement_code, status, starts_at, ends_at, monthly_price_eur, portal_fee_eur, billing_cycle_day, required_locales, ai_billing_mode, ai_monthly_budget_eur, notes, created_at, updated_at")
    .maybeSingle();

  if (error) throw new Error(error.message ?? "BOOKING_CREATE_FAILED");
  if (!data) throw new Error("BOOKING_CREATE_FAILED");
  return mapBookingRow(data as Record<string, unknown>);
}

export async function updateBooking(
  input: NetworkPartnerBookingUpdateInput,
): Promise<NetworkPartnerBookingRecord> {
  const current = await getBookingByIdForPortalPartner(input.id, input.portal_partner_id);
  if (!current) throw new Error("NOT_FOUND");

  const nextStatus = input.status ?? current.status;
  assertAllowedBookingTransition(current.status, nextStatus);

  const nextMonthlyPrice = input.monthly_price_eur ?? current.monthly_price_eur;
  const nextPortalFee = input.portal_fee_eur ?? current.portal_fee_eur;
  const nextLocales = input.required_locales !== undefined
    ? normalizeRequiredLocales(input.required_locales)
    : current.required_locales;

  assertValidAmount(nextMonthlyPrice, "monthly_price_eur");
  assertValidAmount(nextPortalFee, "portal_fee_eur");
  if (nextPortalFee > nextMonthlyPrice) {
    throw new Error("PORTAL_FEE_EXCEEDS_MONTHLY_PRICE");
  }
  assertRequiredLocales(nextLocales);

  const nextBillingCycleDay = input.billing_cycle_day ?? current.billing_cycle_day;
  assertBillingCycleDay(nextBillingCycleDay);

  const nextAiBudget = input.ai_monthly_budget_eur ?? current.ai_monthly_budget_eur;
  assertValidAmount(nextAiBudget, "ai_monthly_budget_eur");

  const patch: Record<string, unknown> = {
    status: nextStatus,
    monthly_price_eur: nextMonthlyPrice,
    portal_fee_eur: nextPortalFee,
    billing_cycle_day: nextBillingCycleDay,
    required_locales: nextLocales,
    ai_billing_mode: input.ai_billing_mode ?? current.ai_billing_mode,
    ai_monthly_budget_eur: nextAiBudget,
  };
  if (input.starts_at !== undefined) patch.starts_at = input.starts_at;
  if (input.ends_at !== undefined) patch.ends_at = asNullableText(input.ends_at);
  if (input.notes !== undefined) patch.notes = asNullableText(input.notes);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("network_partner_bookings")
    .update(patch)
    .eq("id", input.id)
    .eq("portal_partner_id", input.portal_partner_id)
    .select("id, portal_partner_id, network_partner_id, area_id, placement_code, status, starts_at, ends_at, monthly_price_eur, portal_fee_eur, billing_cycle_day, required_locales, ai_billing_mode, ai_monthly_budget_eur, notes, created_at, updated_at")
    .maybeSingle();

  if (error) throw new Error(error.message ?? "BOOKING_UPDATE_FAILED");
  if (!data) throw new Error("NOT_FOUND");
  return mapBookingRow(data as Record<string, unknown>);
}
