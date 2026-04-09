import { createAdminClient } from "@/utils/supabase/admin";
import type {
  AIBillingMode,
  BookingStatus,
  NetworkPartnerBookingCreateInput,
  NetworkPartnerBookingRecord,
  NetworkPartnerBookingUpdateInput,
} from "@/lib/network-partners/types";
import { assertPlacementIsActive } from "@/lib/network-partners/repositories/inventory";

const DEFAULT_PORTAL_FEE_EUR = 10;
const DEFAULT_BILLING_CYCLE_DAY = 1;
const DEFAULT_REQUIRED_LOCALES = ["de"] as const;
const DEFAULT_AI_BILLING_MODE: AIBillingMode = "included";

function toDistrictAreaId(areaId: string): string {
  const normalized = asText(areaId);
  if (!normalized) return "";
  const parts = normalized.split("-");
  return parts.slice(0, Math.min(3, parts.length)).join("-");
}

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asRowArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord);
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

function defaultStartsAt(): string {
  return new Date().toISOString().slice(0, 10);
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

async function assertNoDuplicateDistrictBooking(input: {
  portal_partner_id: string;
  network_partner_id: string;
  area_id: string;
  placement_code: NetworkPartnerBookingRecord["placement_code"];
  exclude_booking_id?: string;
}) {
  const districtAreaId = toDistrictAreaId(input.area_id);
  if (!districtAreaId) return;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("network_partner_bookings")
    .select("id, area_id, status")
    .eq("portal_partner_id", input.portal_partner_id)
    .eq("network_partner_id", input.network_partner_id)
    .eq("placement_code", input.placement_code)
    .in("status", ["draft", "pending_review", "active", "paused"]);

  if (error) throw new Error(error.message ?? "BOOKING_DUPLICATE_CHECK_FAILED");
  const rows = asRowArray(data);
  const duplicate = rows.find((row) => {
    const bookingId = asText(row.id);
    if (input.exclude_booking_id && bookingId === input.exclude_booking_id) return false;
    return toDistrictAreaId(asText(row.area_id)) === districtAreaId;
  });
  if (duplicate) {
    throw new Error("DUPLICATE_DISTRICT_BOOKING");
  }
}

export async function assertBookingInputIsConsistent(input: {
  portal_partner_id: string;
  network_partner_id: string;
  area_id: string;
  placement_code: NetworkPartnerBookingRecord["placement_code"];
  monthly_price_eur: number;
  portal_fee_eur: number;
  required_locales: string[];
  exclude_booking_id?: string;
}): Promise<void> {
  await assertNetworkPartnerBelongsToPortalPartner(input.portal_partner_id, input.network_partner_id);
  await assertNoDuplicateDistrictBooking({
    portal_partner_id: input.portal_partner_id,
    network_partner_id: input.network_partner_id,
    area_id: input.area_id,
    placement_code: input.placement_code,
    exclude_booking_id: input.exclude_booking_id,
  });
  await assertPlacementIsActive(input.placement_code);
  assertValidAmount(input.monthly_price_eur, "monthly_price_eur");
  assertValidAmount(input.portal_fee_eur, "portal_fee_eur");
  if (input.monthly_price_eur < DEFAULT_PORTAL_FEE_EUR) {
    throw new Error("MONTHLY_PRICE_BELOW_PORTAL_FEE");
  }
  if (input.portal_fee_eur > input.monthly_price_eur) {
    throw new Error("PORTAL_FEE_EXCEEDS_MONTHLY_PRICE");
  }
  assertRequiredLocales(normalizeRequiredLocales(input.required_locales));
}

export async function listBookingsByPortalPartner(
  partnerId: string,
  networkPartnerId?: string,
): Promise<NetworkPartnerBookingRecord[]> {
  const admin = createAdminClient();
  let query = admin
    .from("network_partner_bookings")
    .select("id, portal_partner_id, network_partner_id, area_id, placement_code, status, starts_at, ends_at, monthly_price_eur, portal_fee_eur, billing_cycle_day, required_locales, ai_billing_mode, ai_monthly_budget_eur, notes, created_at, updated_at")
    .eq("portal_partner_id", partnerId)
    .order("created_at", { ascending: false });

  if (networkPartnerId) {
    query = query.eq("network_partner_id", networkPartnerId);
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message ?? "BOOKINGS_LIST_FAILED");
  return asRowArray(data).map((row) => mapBookingRow(row));
}

export async function listBookingsByNetworkPartner(
  networkPartnerId: string,
): Promise<NetworkPartnerBookingRecord[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("network_partner_bookings")
    .select("id, portal_partner_id, network_partner_id, area_id, placement_code, status, starts_at, ends_at, monthly_price_eur, portal_fee_eur, billing_cycle_day, required_locales, ai_billing_mode, ai_monthly_budget_eur, notes, created_at, updated_at")
    .eq("network_partner_id", networkPartnerId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message ?? "BOOKINGS_LIST_FAILED");
  return asRowArray(data).map((row) => mapBookingRow(row));
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
  return isRecord(data) ? mapBookingRow(data) : null;
}

export async function getBookingByIdForNetworkPartner(
  id: string,
  networkPartnerId: string,
): Promise<NetworkPartnerBookingRecord | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("network_partner_bookings")
    .select("id, portal_partner_id, network_partner_id, area_id, placement_code, status, starts_at, ends_at, monthly_price_eur, portal_fee_eur, billing_cycle_day, required_locales, ai_billing_mode, ai_monthly_budget_eur, notes, created_at, updated_at")
    .eq("id", id)
    .eq("network_partner_id", networkPartnerId)
    .maybeSingle();

  if (error) throw new Error(error.message ?? "BOOKING_LOOKUP_FAILED");
  return isRecord(data) ? mapBookingRow(data) : null;
}

export async function createBooking(
  input: NetworkPartnerBookingCreateInput,
): Promise<NetworkPartnerBookingRecord> {
  const requiredLocales = normalizeRequiredLocales(input.required_locales ?? [...DEFAULT_REQUIRED_LOCALES]);
  const monthlyPrice = input.monthly_price_eur;
  const portalFee = input.portal_fee_eur ?? DEFAULT_PORTAL_FEE_EUR;
  const billingCycleDay = input.billing_cycle_day ?? DEFAULT_BILLING_CYCLE_DAY;
  await assertBookingInputIsConsistent({
    portal_partner_id: input.portal_partner_id,
    network_partner_id: input.network_partner_id,
    area_id: input.area_id,
    placement_code: input.placement_code,
    monthly_price_eur: monthlyPrice,
    portal_fee_eur: portalFee,
    required_locales: requiredLocales,
  });
  assertBillingCycleDay(billingCycleDay);
  assertValidAmount(input.ai_monthly_budget_eur ?? 0, "ai_monthly_budget_eur");

  const admin = createAdminClient();
  const payload = {
    portal_partner_id: input.portal_partner_id,
    network_partner_id: input.network_partner_id,
    area_id: input.area_id,
    placement_code: input.placement_code,
    status: input.status ?? "draft",
    starts_at: input.starts_at ?? defaultStartsAt(),
    ends_at: asNullableText(input.ends_at),
    monthly_price_eur: monthlyPrice,
    portal_fee_eur: portalFee,
    billing_cycle_day: billingCycleDay,
    required_locales: requiredLocales,
    ai_billing_mode: input.ai_billing_mode ?? DEFAULT_AI_BILLING_MODE,
    ai_monthly_budget_eur: input.ai_monthly_budget_eur ?? 0,
    notes: asNullableText(input.notes),
  };

  const { data, error } = await admin
    .from("network_partner_bookings")
    .insert(payload)
    .select("id, portal_partner_id, network_partner_id, area_id, placement_code, status, starts_at, ends_at, monthly_price_eur, portal_fee_eur, billing_cycle_day, required_locales, ai_billing_mode, ai_monthly_budget_eur, notes, created_at, updated_at")
    .maybeSingle();

  if (error) throw new Error(error.message ?? "BOOKING_CREATE_FAILED");
  if (!isRecord(data)) throw new Error("BOOKING_CREATE_FAILED");
  return mapBookingRow(data);
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

  await assertNoDuplicateDistrictBooking({
    portal_partner_id: input.portal_partner_id,
    network_partner_id: current.network_partner_id,
    area_id: current.area_id,
    placement_code: current.placement_code,
    exclude_booking_id: current.id,
  });

  assertValidAmount(nextMonthlyPrice, "monthly_price_eur");
  assertValidAmount(nextPortalFee, "portal_fee_eur");
  if (nextMonthlyPrice < DEFAULT_PORTAL_FEE_EUR) {
    throw new Error("MONTHLY_PRICE_BELOW_PORTAL_FEE");
  }
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
  if (!isRecord(data)) throw new Error("NOT_FOUND");
  return mapBookingRow(data);
}
