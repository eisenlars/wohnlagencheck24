import { NextResponse } from "next/server";

import { requireNetworkPartnerActorContext } from "@/lib/network-partners/auth";
import {
  assertPortalPartnerOwnsArea,
  assertPortalPartnerOwnsNetworkPartner,
  requirePortalPartnerRole,
} from "@/lib/network-partners/roles";
import {
  assertBookingInputIsConsistent,
  createBooking,
  listBookingsByPortalPartner,
} from "@/lib/network-partners/repositories/bookings";
import { listPlacementCatalog } from "@/lib/network-partners/repositories/inventory";
import type { AIBillingMode, BookingStatus, PlacementCode } from "@/lib/network-partners/types";

type BookingBody = {
  network_partner_id?: string;
  area_id?: string;
  placement_code?: PlacementCode;
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

function asPlacementCode(value: unknown): PlacementCode | null {
  const normalized = String(value ?? "").trim();
  if (
    normalized === "company_profile"
    || normalized === "property_offer"
    || normalized === "property_request"
  ) {
    return normalized;
  }
  return null;
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
  if (error.message === "NETWORK_PARTNER_NOT_OWNED") return { status: 400, error: "network_partner_id does not belong to this portal partner" };
  if (error.message === "INVALID_PLACEMENT_CODE") return { status: 400, error: "Die gewählte Leistung ist derzeit nicht verfügbar." };
  if (error.message === "DUPLICATE_DISTRICT_BOOKING") return { status: 400, error: "Für diesen Netzwerkpartner existiert für diese Leistung im gewählten Kreis bereits eine Buchung." };
  if (error.message === "PORTAL_FEE_EXCEEDS_MONTHLY_PRICE") return { status: 400, error: "portal_fee_eur cannot exceed monthly_price_eur" };
  if (error.message === "MONTHLY_PRICE_BELOW_PORTAL_FEE") return { status: 400, error: "Der Preis muss mindestens 10 EUR betragen." };
  if (error.message === "INVALID_REQUIRED_LOCALES") return { status: 400, error: "required_locales must not be empty" };
  if (error.message === "MISSING_DE_LOCALE") return { status: 400, error: "required_locales must include 'de'" };
  if (error.message === "INVALID_MONTHLY_PRICE_EUR") return { status: 400, error: "monthly_price_eur must be >= 0" };
  if (error.message === "INVALID_PORTAL_FEE_EUR") return { status: 400, error: "portal_fee_eur must be >= 0" };
  if (error.message === "INVALID_AI_MONTHLY_BUDGET_EUR") return { status: 400, error: "ai_monthly_budget_eur must be >= 0" };
  if (error.message === "INVALID_BILLING_CYCLE_DAY") return { status: 400, error: "billing_cycle_day must be between 1 and 28" };
  if (error.message === "INVALID_BOOKING_STATUS_TRANSITION") return { status: 400, error: "Invalid booking status transition" };
  if (error.message === "NOT_FOUND") return { status: 404, error: "Booking not found" };
  return { status: 500, error: error.message || "Unexpected error" };
}

export async function GET(request: Request) {
  try {
    const actor = requirePortalPartnerRole(
      await requireNetworkPartnerActorContext(),
      ["partner_owner", "partner_manager", "partner_billing"],
    );
    const requestUrl = new URL(request.url);
    const networkPartnerId = asRequiredText(requestUrl.searchParams.get("network_partner_id"));
    if (networkPartnerId) {
      await assertPortalPartnerOwnsNetworkPartner(actor.partnerId, networkPartnerId);
    }
    const [bookings, placementCatalog] = await Promise.all([
      listBookingsByPortalPartner(actor.partnerId, networkPartnerId ?? undefined),
      listPlacementCatalog(),
    ]);
    return NextResponse.json({ ok: true, bookings, placement_catalog: placementCatalog });
  } catch (error) {
    const mapped = mapBookingError(error as Error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

export async function POST(req: Request) {
  try {
    const actor = requirePortalPartnerRole(
      await requireNetworkPartnerActorContext(),
      ["partner_owner", "partner_manager"],
    );
    const body = (await req.json()) as BookingBody;

    const networkPartnerId = asRequiredText(body.network_partner_id);
    const areaId = asRequiredText(body.area_id);
    const placementCode = asPlacementCode(body.placement_code);
    const status = body.status !== undefined ? asStatus(body.status) : "active";
    const startsAt = asRequiredText(body.starts_at);
    const monthlyPrice = asNumber(body.monthly_price_eur);
    const portalFee = asNumber(body.portal_fee_eur ?? 10);
    const billingCycleDay = asNumber(body.billing_cycle_day ?? 1);
    const aiBillingMode = body.ai_billing_mode !== undefined ? asAIBillingMode(body.ai_billing_mode) : "included";
    const aiMonthlyBudget = asNumber(body.ai_monthly_budget_eur ?? 0);
    const requiredLocales = asLocales(body.required_locales ?? ["de"]);

    if (!networkPartnerId) {
      return NextResponse.json({ error: "network_partner_id is required" }, { status: 400 });
    }
    if (!areaId) {
      return NextResponse.json({ error: "area_id is required" }, { status: 400 });
    }
    if (!placementCode) {
      return NextResponse.json({ error: "Invalid placement_code" }, { status: 400 });
    }
    if (!status) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    if (monthlyPrice === null) {
      return NextResponse.json({ error: "monthly_price_eur is required" }, { status: 400 });
    }
    if (portalFee === null) {
      return NextResponse.json({ error: "Invalid portal_fee_eur" }, { status: 400 });
    }
    if (billingCycleDay === null) {
      return NextResponse.json({ error: "Invalid billing_cycle_day" }, { status: 400 });
    }
    if (!aiBillingMode) {
      return NextResponse.json({ error: "Invalid ai_billing_mode" }, { status: 400 });
    }
    if (aiMonthlyBudget === null) {
      return NextResponse.json({ error: "Invalid ai_monthly_budget_eur" }, { status: 400 });
    }

    await assertPortalPartnerOwnsArea(actor.partnerId, areaId);
    await assertPortalPartnerOwnsNetworkPartner(actor.partnerId, networkPartnerId);
    await assertBookingInputIsConsistent({
      portal_partner_id: actor.partnerId,
      network_partner_id: networkPartnerId,
      area_id: areaId,
      placement_code: placementCode,
      monthly_price_eur: monthlyPrice,
      portal_fee_eur: portalFee,
      required_locales: requiredLocales,
    });

    const booking = await createBooking({
      portal_partner_id: actor.partnerId,
      network_partner_id: networkPartnerId,
      area_id: areaId,
      placement_code: placementCode,
      status,
      starts_at: startsAt ?? undefined,
      ends_at: asNullableText(body.ends_at),
      monthly_price_eur: monthlyPrice,
      portal_fee_eur: portalFee,
      billing_cycle_day: billingCycleDay,
      required_locales: requiredLocales,
      ai_billing_mode: aiBillingMode,
      ai_monthly_budget_eur: aiMonthlyBudget,
      notes: asNullableText(body.notes),
    });

    return NextResponse.json({ ok: true, booking }, { status: 201 });
  } catch (error) {
    const mapped = mapBookingError(error as Error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
