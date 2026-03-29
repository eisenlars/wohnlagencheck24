import { NextResponse } from "next/server";

import { requireNetworkPartnerActorContext } from "@/lib/network-partners/auth";
import { requirePortalPartnerRole } from "@/lib/network-partners/roles";
import {
  getContentByIdForPortalPartner,
  updateContent,
} from "@/lib/network-partners/repositories/content";
import type {
  NetworkCompanyProfileDetails,
  NetworkPropertyOfferDetails,
  NetworkPropertyRequestDetails,
} from "@/lib/network-partners/types";

type ContentPatchBody = {
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
  if (error.message === "NOT_FOUND") return { status: 404, error: "Content item not found" };
  if (error.message === "INVALID_SLUG") return { status: 400, error: "slug cannot be empty" };
  if (error.message === "INVALID_TITLE") return { status: 400, error: "title cannot be empty" };
  if (error.message === "INVALID_COMPANY_PROFILE_NAME") return { status: 400, error: "company_profile.company_name is required" };
  return { status: 500, error: error.message || "Unexpected error" };
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const actor = requirePortalPartnerRole(
      await requireNetworkPartnerActorContext(),
      ["partner_owner", "partner_manager"],
    );
    const params = await ctx.params;
    const contentId = asRequiredText(params.id);
    if (!contentId) {
      return NextResponse.json({ error: "Missing content id" }, { status: 400 });
    }

    const contentItem = await getContentByIdForPortalPartner(contentId, actor.partnerId);
    if (!contentItem) {
      return NextResponse.json({ error: "Content item not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, content_item: contentItem });
  } catch (error) {
    const mapped = mapContentError(error as Error);
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
    const contentId = asRequiredText(params.id);
    if (!contentId) {
      return NextResponse.json({ error: "Missing content id" }, { status: 400 });
    }

    const body = (await req.json()) as ContentPatchBody;
    const contentItem = await updateContent({
      id: contentId,
      portal_partner_id: actor.partnerId,
      slug: body.slug,
      title: body.title,
      summary: body.summary,
      body_md: body.body_md,
      cta_label: body.cta_label,
      cta_url: body.cta_url,
      primary_locale: body.primary_locale,
      company_profile: body.company_profile,
      property_offer: body.property_offer,
      property_request: body.property_request,
    });

    return NextResponse.json({ ok: true, content_item: contentItem });
  } catch (error) {
    const mapped = mapContentError(error as Error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
