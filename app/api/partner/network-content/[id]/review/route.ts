import { NextResponse } from "next/server";

import { requireNetworkPartnerActorContext } from "@/lib/network-partners/auth";
import { requirePortalPartnerRole } from "@/lib/network-partners/roles";
import { applyContentReviewAction } from "@/lib/network-partners/repositories/content";
import type { NetworkContentReviewAction } from "@/lib/network-partners/types";

type ReviewBody = {
  action?: NetworkContentReviewAction;
  review_note?: string | null;
};

function asRequiredText(value: unknown): string | null {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

function asReviewAction(value: unknown): NetworkContentReviewAction | null {
  const normalized = String(value ?? "").trim();
  if (
    normalized === "submit"
    || normalized === "approve"
    || normalized === "reject"
    || normalized === "publish"
    || normalized === "pause"
    || normalized === "reset_draft"
  ) {
    return normalized;
  }
  return null;
}

function mapContentReviewError(error: Error) {
  if (error.message === "UNAUTHORIZED") return { status: 401, error: "Unauthorized" };
  if (error.message === "FORBIDDEN") return { status: 403, error: "Forbidden" };
  if (error.message === "NOT_FOUND") return { status: 404, error: "Content item not found" };
  if (error.message === "INVALID_CONTENT_REVIEW_ACTION") return { status: 400, error: "Invalid content review action" };
  if (error.message.startsWith("MISSING_REQUIRED_TRANSLATIONS:")) {
    const locales = error.message.split(":")[1] ?? "";
    return { status: 400, error: `Missing or stale required translations: ${locales}` };
  }
  return { status: 500, error: error.message || "Unexpected error" };
}

export async function POST(
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

    const body = (await req.json()) as ReviewBody;
    const action = asReviewAction(body.action);
    if (!action) {
      return NextResponse.json({ error: "Invalid content review action" }, { status: 400 });
    }

    const contentItem = await applyContentReviewAction({
      id: contentId,
      portal_partner_id: actor.partnerId,
      reviewer_user_id: actor.userId,
      action,
      review_note: body.review_note ?? null,
    });

    return NextResponse.json({ ok: true, content_item: contentItem });
  } catch (error) {
    const mapped = mapContentReviewError(error as Error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
