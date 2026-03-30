import { NextResponse } from "next/server";

import { requireNetworkPartnerActorContext } from "@/lib/network-partners/auth";
import {
  assertPortalPartnerOwnsNetworkPartner,
  requirePortalPartnerRole,
} from "@/lib/network-partners/roles";
import {
  createContent,
  listContentByPortalPartner,
} from "@/lib/network-partners/repositories/content";
import type {
  NetworkCompanyProfileDetails,
  NetworkPropertyOfferDetails,
  NetworkPropertyRequestDetails,
} from "@/lib/network-partners/types";

type ContentBody = {
  booking_id?: string;
  slug?: string;
  title?: string;
  summary?: string | null;
  body_md?: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
  primary_locale?: string;
  company_profile?: Partial<NetworkCompanyProfileDetails> | null;
  property_offer?: Partial<NetworkPropertyOfferDetails> | null;
  property_request?: Partial<NetworkPropertyRequestDetails> | null;
};

function asRequiredText(value: unknown): string | null {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

function mapContentError(error: Error) {
  if (error.message === "UNAUTHORIZED") return { status: 401, error: "Unauthorized" };
  if (error.message === "FORBIDDEN") return { status: 403, error: "Forbidden" };
  if (error.message === "BOOKING_NOT_FOUND") return { status: 404, error: "Booking not found" };
  if (error.message === "BOOKING_NOT_CONTENT_EDITABLE") return { status: 400, error: "Content cannot be created for cancelled or expired bookings" };
  if (error.message === "INVALID_BOOKING_ID") return { status: 400, error: "booking_id is required" };
  if (error.message === "INVALID_SLUG") return { status: 400, error: "slug is required" };
  if (error.message === "INVALID_TITLE") return { status: 400, error: "title is required" };
  if (error.message === "INVALID_COMPANY_PROFILE_NAME") return { status: 400, error: "company_profile.company_name is required" };
  return { status: 500, error: error.message || "Unexpected error" };
}

export async function GET(request: Request) {
  try {
    const actor = requirePortalPartnerRole(
      await requireNetworkPartnerActorContext(),
      ["partner_owner", "partner_manager"],
    );
    const { searchParams } = new URL(request.url);
    const networkPartnerId = asRequiredText(searchParams.get("network_partner_id"));
    if (networkPartnerId) {
      await assertPortalPartnerOwnsNetworkPartner(actor.partnerId, networkPartnerId);
    }
    const contentItems = await listContentByPortalPartner(actor.partnerId, networkPartnerId ?? undefined);
    return NextResponse.json({ ok: true, content_items: contentItems });
  } catch (error) {
    const mapped = mapContentError(error as Error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

export async function POST(req: Request) {
  try {
    const actor = requirePortalPartnerRole(
      await requireNetworkPartnerActorContext(),
      ["partner_owner", "partner_manager"],
    );
    const body = (await req.json()) as ContentBody;
    const bookingId = asRequiredText(body.booking_id);
    const slug = asRequiredText(body.slug);
    const title = asRequiredText(body.title);

    if (!bookingId) {
      return NextResponse.json({ error: "booking_id is required" }, { status: 400 });
    }
    if (!slug) {
      return NextResponse.json({ error: "slug is required" }, { status: 400 });
    }
    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    const contentItem = await createContent({
      portal_partner_id: actor.partnerId,
      booking_id: bookingId,
      slug,
      title,
      summary: body.summary ?? null,
      body_md: body.body_md ?? null,
      cta_label: body.cta_label ?? null,
      cta_url: body.cta_url ?? null,
      primary_locale: body.primary_locale,
      company_profile: body.company_profile ?? null,
      property_offer: body.property_offer ?? null,
      property_request: body.property_request ?? null,
    });

    return NextResponse.json({ ok: true, content_item: contentItem }, { status: 201 });
  } catch (error) {
    const mapped = mapContentError(error as Error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
