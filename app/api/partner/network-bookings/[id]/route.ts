import { NextResponse } from "next/server";

import { requireNetworkPartnerActorContext } from "@/lib/network-partners/auth";
import {
  getBookingByIdForPortalPartner,
  updateBooking,
} from "@/lib/network-partners/repositories/bookings";
import { requirePortalPartnerRole } from "@/lib/network-partners/roles";
import type { AIBillingMode, BookingStatus } from "@/lib/network-partners/types";

type BookingPatchBody = {
  status?: BookingStatus;
  starts_at?: string;
  ends_at?: string | null;
  monthly_price_eur?: number;
  portal_fee_eur?: number;
  billing_cycle_day?: number;
  required_locales?: string[];
  ai_billing_mode?: AIBillingMode;
  ai_monthly_budget_eur?: number;
  notes?: string | null;
};

function asRequiredText(value: unknown): string | null {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

function asNullableText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function asStatus(value: unknown): BookingStatus | null {
  const normalized = String(value ?? "").trim();
  if (
    normalized === "draft"
    || normalized === "pending_review"
    || normalized === "active"
    || normalized === "paused"
    || normalized === "cancelled"
    || normalized === "expired"
  ) {
    return normalized;
  }
  return null;
}

function asAIBillingMode(value: unknown): AIBillingMode | null {
  const normalized = String(value ?? "").trim();
  if (normalized === "included" || normalized === "credit_based" || normalized === "blocked") {
    return normalized;
  }
  return null;
}

function asNumber(value: unknown): number | null {
  const numeric =
    typeof value === "number" ? value
      : typeof value === "string" && value.trim().length > 0 ? Number(value)
        : NaN;
  if (!Number.isFinite(numeric)) return null;
  return numeric;
}

function asLocales(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((locale) => String(locale ?? "").trim().toLowerCase())
    .filter((locale) => locale.length > 0);
}

function mapBookingError(error: Error) {
  if (error.message === "UNAUTHORIZED") return { status: 401, error: "Unauthorized" };
  if (error.message === "FORBIDDEN") return { status: 403, error: "Forbidden" };
  if (error.message === "NOT_FOUND") return { status: 404, error: "Booking not found" };
  if (error.message === "PORTAL_FEE_EXCEEDS_MONTHLY_PRICE") return { status: 400, error: "portal_fee_eur cannot exceed monthly_price_eur" };
  if (error.message === "INVALID_REQUIRED_LOCALES") return { status: 400, error: "required_locales must not be empty" };
  if (error.message === "MISSING_DE_LOCALE") return { status: 400, error: "required_locales must include 'de'" };
  if (error.message === "INVALID_MONTHLY_PRICE_EUR") return { status: 400, error: "monthly_price_eur must be >= 0" };
  if (error.message === "INVALID_PORTAL_FEE_EUR") return { status: 400, error: "portal_fee_eur must be >= 0" };
  if (error.message === "INVALID_AI_MONTHLY_BUDGET_EUR") return { status: 400, error: "ai_monthly_budget_eur must be >= 0" };
  if (error.message === "INVALID_BILLING_CYCLE_DAY") return { status: 400, error: "billing_cycle_day must be between 1 and 28" };
  if (error.message === "INVALID_BOOKING_STATUS_TRANSITION") return { status: 400, error: "Invalid booking status transition" };
  return { status: 500, error: error.message || "Unexpected error" };
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const actor = requirePortalPartnerRole(
      await requireNetworkPartnerActorContext(),
      ["partner_owner", "partner_manager", "partner_billing"],
    );
    const params = await ctx.params;
    const bookingId = asRequiredText(params.id);
    if (!bookingId) {
      return NextResponse.json({ error: "Missing booking id" }, { status: 400 });
    }

    const booking = await getBookingByIdForPortalPartner(bookingId, actor.partnerId);
    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, booking });
  } catch (error) {
    const mapped = mapBookingError(error as Error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const actor = requirePortalPartnerRole(
      await requireNetworkPartnerActorContext(),
      ["partner_owner", "partner_manager"],
    );
    const params = await ctx.params;
    const bookingId = asRequiredText(params.id);
    if (!bookingId) {
      return NextResponse.json({ error: "Missing booking id" }, { status: 400 });
    }

    const body = (await req.json()) as BookingPatchBody;
    const patch: {
      id: string;
      portal_partner_id: string;
      status?: BookingStatus;
      starts_at?: string;
      ends_at?: string | null;
      monthly_price_eur?: number;
      portal_fee_eur?: number;
      billing_cycle_day?: number;
      required_locales?: string[];
      ai_billing_mode?: AIBillingMode;
      ai_monthly_budget_eur?: number;
      notes?: string | null;
    } = {
      id: bookingId,
      portal_partner_id: actor.partnerId,
    };

    if (body.status !== undefined) {
      const status = asStatus(body.status);
      if (!status) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      patch.status = status;
    }
    if (body.starts_at !== undefined) patch.starts_at = String(body.starts_at).trim();
    if (body.ends_at !== undefined) patch.ends_at = asNullableText(body.ends_at);
    if (body.monthly_price_eur !== undefined) {
      const monthlyPrice = asNumber(body.monthly_price_eur);
      if (monthlyPrice === null) {
        return NextResponse.json({ error: "Invalid monthly_price_eur" }, { status: 400 });
      }
      patch.monthly_price_eur = monthlyPrice;
    }
    if (body.portal_fee_eur !== undefined) {
      const portalFee = asNumber(body.portal_fee_eur);
      if (portalFee === null) {
        return NextResponse.json({ error: "Invalid portal_fee_eur" }, { status: 400 });
      }
      patch.portal_fee_eur = portalFee;
    }
    if (body.billing_cycle_day !== undefined) {
      const billingCycleDay = asNumber(body.billing_cycle_day);
      if (billingCycleDay === null) {
        return NextResponse.json({ error: "Invalid billing_cycle_day" }, { status: 400 });
      }
      patch.billing_cycle_day = billingCycleDay;
    }
    if (body.required_locales !== undefined) patch.required_locales = asLocales(body.required_locales);
    if (body.ai_billing_mode !== undefined) {
      const aiBillingMode = asAIBillingMode(body.ai_billing_mode);
      if (!aiBillingMode) {
        return NextResponse.json({ error: "Invalid ai_billing_mode" }, { status: 400 });
      }
      patch.ai_billing_mode = aiBillingMode;
    }
    if (body.ai_monthly_budget_eur !== undefined) {
      const aiBudget = asNumber(body.ai_monthly_budget_eur);
      if (aiBudget === null) {
        return NextResponse.json({ error: "Invalid ai_monthly_budget_eur" }, { status: 400 });
      }
      patch.ai_monthly_budget_eur = aiBudget;
    }
    if (body.notes !== undefined) patch.notes = asNullableText(body.notes);

    const booking = await updateBooking(patch);
    return NextResponse.json({ ok: true, booking });
  } catch (error) {
    const mapped = mapBookingError(error as Error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
