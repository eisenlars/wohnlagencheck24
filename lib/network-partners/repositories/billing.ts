import { createAdminClient } from "@/utils/supabase/admin";
import { listBookingsByPortalPartner } from "@/lib/network-partners/repositories/bookings";
import { listNetworkPartnersByPortalPartner } from "@/lib/network-partners/repositories/network-partners";
import type {
  NetworkBillingMonthSummary,
  NetworkBillingOverview,
  NetworkBillingProjectionRow,
  NetworkPartnerInvoiceLineRecord,
  NetworkPartnerInvoiceStatus,
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
