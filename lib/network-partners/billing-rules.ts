import type { NetworkPartnerBookingRecord } from "@/lib/network-partners/types";

export type BillingPeriodBounds = {
  periodKey: string;
  periodStart: string;
  periodEnd: string;
};

function padMonth(value: number): string {
  return String(value).padStart(2, "0");
}

function formatUtcDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = padMonth(date.getUTCMonth() + 1);
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildBillingPeriodKey(date: Date): string {
  return `${date.getUTCFullYear()}-${padMonth(date.getUTCMonth() + 1)}`;
}

export function resolveBillingPeriodBounds(periodKey: string): BillingPeriodBounds {
  const match = /^(\d{4})-(\d{2})$/.exec(String(periodKey ?? "").trim());
  if (!match) {
    throw new Error("INVALID_BILLING_PERIOD_KEY");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("INVALID_BILLING_PERIOD_KEY");
  }

  const periodStartDate = new Date(Date.UTC(year, month - 1, 1));
  const periodEndDate = new Date(Date.UTC(year, month, 0));

  return {
    periodKey: `${year}-${padMonth(month)}`,
    periodStart: formatUtcDate(periodStartDate),
    periodEnd: formatUtcDate(periodEndDate),
  };
}

export function isBookingBillableForPeriod(
  booking: NetworkPartnerBookingRecord,
  bounds: BillingPeriodBounds,
): boolean {
  if (booking.status !== "active" && booking.status !== "paused") {
    return false;
  }

  const bookingStart = String(booking.starts_at ?? "").trim();
  if (!bookingStart || bookingStart > bounds.periodEnd) {
    return false;
  }

  const bookingEnd = String(booking.ends_at ?? "").trim();
  if (bookingEnd && bookingEnd < bounds.periodStart) {
    return false;
  }

  return true;
}

export function buildInvoiceAmounts(booking: NetworkPartnerBookingRecord): {
  gross_amount_eur: number;
  portal_fee_eur: number;
  partner_net_eur: number;
} {
  const grossAmount = Number(booking.monthly_price_eur.toFixed(2));
  const portalFee = Number(booking.portal_fee_eur.toFixed(2));
  const partnerNet = Number((grossAmount - portalFee).toFixed(2));

  return {
    gross_amount_eur: grossAmount,
    portal_fee_eur: portalFee,
    partner_net_eur: partnerNet,
  };
}
