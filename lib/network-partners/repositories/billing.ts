import { createAdminClient } from "@/utils/supabase/admin";
import {
  buildInvoiceAmounts,
  isBookingBillableForPeriod,
  resolveBillingPeriodBounds,
  type BillingPeriodBounds,
} from "@/lib/network-partners/billing-rules";
import { listBookingsByPortalPartner } from "@/lib/network-partners/repositories/bookings";
import { listBookingsByNetworkPartner } from "@/lib/network-partners/repositories/bookings";
import { listNetworkPartnersByPortalPartner } from "@/lib/network-partners/repositories/network-partners";
import type {
  NetworkBillingMonthSummary,
  NetworkBillingOverview,
  NetworkBillingProjectionRow,
  NetworkBillingRunLine,
  NetworkBillingRunResult,
  NetworkPartnerBillingOverview,
  NetworkPartnerInvoiceLineRecord,
  NetworkPartnerInvoiceStatus,
  NetworkPartnerBookingRecord,
  PortalPartnerSettlementLineRecord,
  PortalPartnerSettlementStatus,
} from "@/lib/network-partners/types";

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

function asRowArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isMissingTable(error: unknown, table: string): boolean {
  const message = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return message.includes(`public.${table}`) && message.includes("does not exist");
}

function normalizeInvoiceStatus(value: unknown): NetworkPartnerInvoiceStatus {
  const status = asText(value);
  if (status === "paid" || status === "overdue" || status === "cancelled") return status;
  return "open";
}

function normalizeSettlementStatus(value: unknown): PortalPartnerSettlementStatus {
  const status = asText(value);
  if (status === "cleared" || status === "held") return status;
  return "pending";
}

function mapInvoiceRow(row: Record<string, unknown>): NetworkPartnerInvoiceLineRecord {
  const booking = row.network_partner_bookings && typeof row.network_partner_bookings === "object"
    ? row.network_partner_bookings as Record<string, unknown>
    : null;
  const partner = row.network_partners && typeof row.network_partners === "object"
    ? row.network_partners as Record<string, unknown>
    : null;

  return {
    id: asText(row.id),
    booking_id: asText(row.booking_id),
    portal_partner_id: asText(row.portal_partner_id),
    network_partner_id: asText(row.network_partner_id),
    period_start: asText(row.period_start),
    period_end: asText(row.period_end),
    gross_amount_eur: asNumber(row.gross_amount_eur),
    portal_fee_eur: asNumber(row.portal_fee_eur),
    partner_net_eur: asNumber(row.partner_net_eur),
    status: normalizeInvoiceStatus(row.status),
    created_at: asText(row.created_at),
    network_partner_name: asNullableText(partner?.company_name),
    area_id: asNullableText(booking?.area_id),
    placement_code: asNullableText(booking?.placement_code) as NetworkPartnerInvoiceLineRecord["placement_code"],
  };
}

function mapSettlementRow(row: Record<string, unknown>): PortalPartnerSettlementLineRecord {
  return {
    id: asText(row.id),
    invoice_line_id: asText(row.invoice_line_id),
    portal_partner_id: asText(row.portal_partner_id),
    gross_amount_eur: asNumber(row.gross_amount_eur),
    portal_fee_eur: asNumber(row.portal_fee_eur),
    partner_net_eur: asNumber(row.partner_net_eur),
    status: normalizeSettlementStatus(row.status),
    created_at: asText(row.created_at),
  };
}

function buildMonthSummaries(invoiceLines: NetworkPartnerInvoiceLineRecord[]): NetworkBillingMonthSummary[] {
  const buckets = new Map<string, NetworkBillingMonthSummary>();
  for (const line of invoiceLines) {
    const periodKey = asText(line.period_start).slice(0, 7);
    const current = buckets.get(periodKey) ?? {
      period_key: periodKey,
      invoice_count: 0,
      gross_amount_eur: 0,
      portal_fee_eur: 0,
      partner_net_eur: 0,
    };
    current.invoice_count += 1;
    current.gross_amount_eur = Number((current.gross_amount_eur + line.gross_amount_eur).toFixed(2));
    current.portal_fee_eur = Number((current.portal_fee_eur + line.portal_fee_eur).toFixed(2));
    current.partner_net_eur = Number((current.partner_net_eur + line.partner_net_eur).toFixed(2));
    buckets.set(periodKey, current);
  }
  return Array.from(buckets.values()).sort((a, b) => b.period_key.localeCompare(a.period_key, "de"));
}

async function listInvoiceLinesByPortalPartner(partnerId: string): Promise<{
  available: boolean;
  rows: NetworkPartnerInvoiceLineRecord[];
}> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("network_partner_invoice_lines")
    .select([
      "id",
      "booking_id",
      "portal_partner_id",
      "network_partner_id",
      "period_start",
      "period_end",
      "gross_amount_eur",
      "portal_fee_eur",
      "partner_net_eur",
      "status",
      "created_at",
      "network_partner_bookings(area_id, placement_code)",
      "network_partners(company_name)",
    ].join(", "))
    .eq("portal_partner_id", partnerId)
    .order("period_start", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingTable(error, "network_partner_invoice_lines")) {
      return { available: false, rows: [] };
    }
    throw new Error(error.message ?? "NETWORK_PARTNER_INVOICE_LINES_LIST_FAILED");
  }

  return {
    available: true,
    rows: asRowArray(data).map((row) => mapInvoiceRow(row)),
  };
}

async function listInvoiceLinesByPortalPartnerForPeriod(
  partnerId: string,
  bounds: BillingPeriodBounds,
): Promise<NetworkPartnerInvoiceLineRecord[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("network_partner_invoice_lines")
    .select([
      "id",
      "booking_id",
      "portal_partner_id",
      "network_partner_id",
      "period_start",
      "period_end",
      "gross_amount_eur",
      "portal_fee_eur",
      "partner_net_eur",
      "status",
      "created_at",
      "network_partner_bookings(area_id, placement_code)",
      "network_partners(company_name)",
    ].join(", "))
    .eq("portal_partner_id", partnerId)
    .eq("period_start", bounds.periodStart)
    .eq("period_end", bounds.periodEnd)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message ?? "NETWORK_PARTNER_INVOICE_LINES_PERIOD_LIST_FAILED");
  return asRowArray(data).map((row) => mapInvoiceRow(row));
}

async function listSettlementLinesByPortalPartner(partnerId: string): Promise<{
  available: boolean;
  rows: PortalPartnerSettlementLineRecord[];
}> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("portal_partner_settlement_lines")
    .select("id, invoice_line_id, portal_partner_id, gross_amount_eur, portal_fee_eur, partner_net_eur, status, created_at")
    .eq("portal_partner_id", partnerId)
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingTable(error, "portal_partner_settlement_lines")) {
      return { available: false, rows: [] };
    }
    throw new Error(error.message ?? "PORTAL_PARTNER_SETTLEMENT_LINES_LIST_FAILED");
  }

  return {
    available: true,
    rows: asRowArray(data).map((row) => mapSettlementRow(row)),
  };
}

async function createInvoiceLineForBookingPeriod(
  booking: NetworkPartnerBookingRecord,
  bounds: BillingPeriodBounds,
): Promise<NetworkPartnerInvoiceLineRecord> {
  const admin = createAdminClient();
  const amounts = buildInvoiceAmounts(booking);
  const { data, error } = await admin
    .from("network_partner_invoice_lines")
    .insert({
      booking_id: booking.id,
      portal_partner_id: booking.portal_partner_id,
      network_partner_id: booking.network_partner_id,
      period_start: bounds.periodStart,
      period_end: bounds.periodEnd,
      gross_amount_eur: amounts.gross_amount_eur,
      portal_fee_eur: amounts.portal_fee_eur,
      partner_net_eur: amounts.partner_net_eur,
      status: "open",
    })
    .select([
      "id",
      "booking_id",
      "portal_partner_id",
      "network_partner_id",
      "period_start",
      "period_end",
      "gross_amount_eur",
      "portal_fee_eur",
      "partner_net_eur",
      "status",
      "created_at",
      "network_partner_bookings(area_id, placement_code)",
      "network_partners(company_name)",
    ].join(", "))
    .single();

  if (error) throw new Error(error.message ?? "NETWORK_PARTNER_INVOICE_LINE_CREATE_FAILED");
  if (!isRecord(data)) throw new Error("NETWORK_PARTNER_INVOICE_LINE_CREATE_FAILED");
  return mapInvoiceRow(data);
}

async function createSettlementLineForInvoice(
  invoiceLine: NetworkPartnerInvoiceLineRecord,
): Promise<PortalPartnerSettlementLineRecord> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("portal_partner_settlement_lines")
    .insert({
      invoice_line_id: invoiceLine.id,
      portal_partner_id: invoiceLine.portal_partner_id,
      gross_amount_eur: invoiceLine.gross_amount_eur,
      portal_fee_eur: invoiceLine.portal_fee_eur,
      partner_net_eur: invoiceLine.partner_net_eur,
      status: "pending",
    })
    .select("id, invoice_line_id, portal_partner_id, gross_amount_eur, portal_fee_eur, partner_net_eur, status, created_at")
    .single();

  if (error) throw new Error(error.message ?? "PORTAL_PARTNER_SETTLEMENT_LINE_CREATE_FAILED");
  if (!isRecord(data)) throw new Error("PORTAL_PARTNER_SETTLEMENT_LINE_CREATE_FAILED");
  return mapSettlementRow(data);
}

async function buildBookingProjection(partnerId: string): Promise<NetworkBillingProjectionRow[]> {
  const [bookings, networkPartners] = await Promise.all([
    listBookingsByPortalPartner(partnerId),
    listNetworkPartnersByPortalPartner(partnerId),
  ]);

  return bookings
    .filter((booking) => booking.status !== "cancelled" && booking.status !== "expired")
    .map((booking) => ({
      booking_id: booking.id,
      network_partner_id: booking.network_partner_id,
      network_partner_name: networkPartners.find((entry) => entry.id === booking.network_partner_id)?.company_name ?? null,
      area_id: booking.area_id,
      placement_code: booking.placement_code,
      booking_status: booking.status,
      monthly_price_eur: booking.monthly_price_eur,
      portal_fee_eur: booking.portal_fee_eur,
      partner_net_eur: Number((booking.monthly_price_eur - booking.portal_fee_eur).toFixed(2)),
      billing_cycle_day: booking.billing_cycle_day,
    }))
    .sort((a, b) => {
      const byName = String(a.network_partner_name ?? "").localeCompare(String(b.network_partner_name ?? ""), "de");
      if (byName !== 0) return byName;
      return a.area_id.localeCompare(b.area_id, "de");
    });
}

async function listInvoiceLinesByNetworkPartner(networkPartnerId: string): Promise<{
  available: boolean;
  rows: NetworkPartnerInvoiceLineRecord[];
}> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("network_partner_invoice_lines")
    .select([
      "id",
      "booking_id",
      "portal_partner_id",
      "network_partner_id",
      "period_start",
      "period_end",
      "gross_amount_eur",
      "portal_fee_eur",
      "partner_net_eur",
      "status",
      "created_at",
      "network_partner_bookings(area_id, placement_code)",
      "network_partners(company_name)",
    ].join(", "))
    .eq("network_partner_id", networkPartnerId)
    .order("period_start", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingTable(error, "network_partner_invoice_lines")) {
      return { available: false, rows: [] };
    }
    throw new Error(error.message ?? "NETWORK_PARTNER_INVOICE_LINES_LIST_FAILED");
  }

  return {
    available: true,
    rows: asRowArray(data).map((row) => mapInvoiceRow(row)),
  };
}

async function buildBookingProjectionForNetworkPartner(
  networkPartnerId: string,
): Promise<NetworkBillingProjectionRow[]> {
  const bookings = await listBookingsByNetworkPartner(networkPartnerId);

  return bookings
    .filter((booking) => booking.status !== "cancelled" && booking.status !== "expired")
    .map((booking) => ({
      booking_id: booking.id,
      network_partner_id: booking.network_partner_id,
      network_partner_name: null,
      area_id: booking.area_id,
      placement_code: booking.placement_code,
      booking_status: booking.status,
      monthly_price_eur: booking.monthly_price_eur,
      portal_fee_eur: booking.portal_fee_eur,
      partner_net_eur: Number((booking.monthly_price_eur - booking.portal_fee_eur).toFixed(2)),
      billing_cycle_day: booking.billing_cycle_day,
    }))
    .sort((a, b) => a.area_id.localeCompare(b.area_id, "de"));
}

export async function loadNetworkBillingOverviewByPortalPartner(
  partnerId: string,
): Promise<NetworkBillingOverview> {
  const [invoiceResult, settlementResult, bookingProjection] = await Promise.all([
    listInvoiceLinesByPortalPartner(partnerId),
    listSettlementLinesByPortalPartner(partnerId),
    buildBookingProjection(partnerId),
  ]);

  return {
    invoice_lines: invoiceResult.rows,
    settlement_lines: settlementResult.rows,
    month_summaries: buildMonthSummaries(invoiceResult.rows),
    booking_projection: bookingProjection,
    invoice_table_available: invoiceResult.available,
    settlement_table_available: settlementResult.available,
  };
}

export async function loadNetworkBillingOverviewByNetworkPartner(
  networkPartnerId: string,
): Promise<NetworkPartnerBillingOverview> {
  const [invoiceResult, bookingProjection] = await Promise.all([
    listInvoiceLinesByNetworkPartner(networkPartnerId),
    buildBookingProjectionForNetworkPartner(networkPartnerId),
  ]);

  return {
    invoice_lines: invoiceResult.rows,
    booking_projection: bookingProjection,
    invoice_table_available: invoiceResult.available,
  };
}

export async function runBillingForPortalPartner(
  partnerId: string,
  periodKey: string,
): Promise<NetworkBillingRunResult> {
  const bounds = resolveBillingPeriodBounds(periodKey);
  const [bookings, existingInvoiceLines] = await Promise.all([
    listBookingsByPortalPartner(partnerId),
    listInvoiceLinesByPortalPartnerForPeriod(partnerId, bounds),
  ]);

  const existingInvoiceLineByBookingId = new Map(
    existingInvoiceLines.map((line) => [line.booking_id, line]),
  );

  const lines: NetworkBillingRunLine[] = [];
  let createdInvoiceCount = 0;
  let skippedDuplicateCount = 0;
  let skippedNotBillableCount = 0;

  for (const booking of bookings) {
    const amounts = buildInvoiceAmounts(booking);

    if (!isBookingBillableForPeriod(booking, bounds)) {
      skippedNotBillableCount += 1;
      lines.push({
        booking_id: booking.id,
        network_partner_id: booking.network_partner_id,
        area_id: booking.area_id,
        placement_code: booking.placement_code,
        period_key: bounds.periodKey,
        status: "skipped",
        reason: "not_billable",
        invoice_line_id: null,
        settlement_line_id: null,
        ...amounts,
      });
      continue;
    }

    const existingInvoiceLine = existingInvoiceLineByBookingId.get(booking.id);
    if (existingInvoiceLine) {
      skippedDuplicateCount += 1;
      lines.push({
        booking_id: booking.id,
        network_partner_id: booking.network_partner_id,
        area_id: booking.area_id,
        placement_code: booking.placement_code,
        period_key: bounds.periodKey,
        status: "skipped",
        reason: "duplicate",
        invoice_line_id: existingInvoiceLine.id,
        settlement_line_id: null,
        gross_amount_eur: existingInvoiceLine.gross_amount_eur,
        portal_fee_eur: existingInvoiceLine.portal_fee_eur,
        partner_net_eur: existingInvoiceLine.partner_net_eur,
      });
      continue;
    }

    const invoiceLine = await createInvoiceLineForBookingPeriod(booking, bounds);
    const settlementLine = await createSettlementLineForInvoice(invoiceLine);
    createdInvoiceCount += 1;
    existingInvoiceLineByBookingId.set(booking.id, invoiceLine);
    lines.push({
      booking_id: booking.id,
      network_partner_id: booking.network_partner_id,
      area_id: booking.area_id,
      placement_code: booking.placement_code,
      period_key: bounds.periodKey,
      status: "created",
      reason: "created",
      invoice_line_id: invoiceLine.id,
      settlement_line_id: settlementLine.id,
      gross_amount_eur: invoiceLine.gross_amount_eur,
      portal_fee_eur: invoiceLine.portal_fee_eur,
      partner_net_eur: invoiceLine.partner_net_eur,
    });
  }

  return {
    period_key: bounds.periodKey,
    period_start: bounds.periodStart,
    period_end: bounds.periodEnd,
    checked_booking_count: bookings.length,
    created_invoice_count: createdInvoiceCount,
    skipped_duplicate_count: skippedDuplicateCount,
    skipped_not_billable_count: skippedNotBillableCount,
    lines,
  };
}
