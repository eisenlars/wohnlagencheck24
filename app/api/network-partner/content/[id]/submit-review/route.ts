import { NextResponse } from "next/server";

import { requireNetworkPartnerActorContext } from "@/lib/network-partners/auth";
import { requireNetworkPartnerRole } from "@/lib/network-partners/roles";
import { submitContentForReviewByNetworkPartner } from "@/lib/network-partners/repositories/content";

type ReviewBody = {
  review_note?: string | null;
};

function asRequiredText(value: unknown): string | null {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

function mapReviewError(error: Error) {
  if (error.message === "UNAUTHORIZED") return { status: 401, error: "Unauthorized" };
  if (error.message === "FORBIDDEN") return { status: 403, error: "Forbidden" };
  if (error.message === "NOT_FOUND") return { status: 404, error: "Content item not found" };
  if (error.message === "INVALID_CONTENT_REVIEW_ACTION") return { status: 400, error: "Content cannot be submitted in the current status" };
  return { status: 500, error: error.message || "Unexpected error" };
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const actor = requireNetworkPartnerRole(
      await requireNetworkPartnerActorContext(),
      ["network_owner", "network_editor"],
    );
    const params = await ctx.params;
    const contentId = asRequiredText(params.id);
    if (!contentId) {
      return NextResponse.json({ error: "Missing content id" }, { status: 400 });
    }

    const body = (await req.json()) as ReviewBody;
    const contentItem = await submitContentForReviewByNetworkPartner({
      id: contentId,
      network_partner_id: actor.networkPartnerId,
      reviewer_user_id: actor.userId,
      review_note: body.review_note ?? null,
    });

    return NextResponse.json({ ok: true, content_item: contentItem });
  } catch (error) {
    const mapped = mapReviewError(error as Error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
