import { NextResponse } from "next/server";

import { requireNetworkPartnerActorContext } from "@/lib/network-partners/auth";
import { requireNetworkPartnerRole } from "@/lib/network-partners/roles";
import { assertNetworkPartnerOwnsContent } from "@/lib/network-partners/access";
import {
  createMediaForContent,
  deleteMediaById,
  listMediaForContent,
} from "@/lib/network-partners/repositories/media";
import type { NetworkContentMediaKind } from "@/lib/network-partners/types";

type MediaBody = {
  kind?: NetworkContentMediaKind;
  url?: string;
  sort_order?: number | null;
  media_id?: string;
};

function asRequiredText(value: unknown): string | null {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

function asMediaKind(value: unknown): NetworkContentMediaKind | null {
  const normalized = String(value ?? "").trim();
  if (normalized === "logo" || normalized === "hero" || normalized === "gallery" || normalized === "document") {
    return normalized;
  }
  return null;
}

function mapMediaError(error: Error) {
  if (error.message === "UNAUTHORIZED") return { status: 401, error: "Unauthorized" };
  if (error.message === "FORBIDDEN") return { status: 403, error: "Forbidden" };
  if (error.message === "NOT_FOUND") return { status: 404, error: "Content item not found" };
  if (error.message === "INVALID_MEDIA_URL") return { status: 400, error: "A valid http/https media URL is required" };
  return { status: 500, error: error.message || "Unexpected error" };
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const actor = requireNetworkPartnerRole(
      await requireNetworkPartnerActorContext(),
      ["network_owner", "network_editor", "network_billing"],
    );
    const params = await ctx.params;
    const contentId = asRequiredText(params.id);
    if (!contentId) {
      return NextResponse.json({ error: "Missing content id" }, { status: 400 });
    }

    await assertNetworkPartnerOwnsContent(actor.networkPartnerId, contentId);
    const media = await listMediaForContent(contentId);
    return NextResponse.json({ ok: true, media });
  } catch (error) {
    const mapped = mapMediaError(error as Error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
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

    await assertNetworkPartnerOwnsContent(actor.networkPartnerId, contentId);
    const body = (await req.json()) as MediaBody;
    const kind = asMediaKind(body.kind);
    const url = asRequiredText(body.url);
    if (!kind) {
      return NextResponse.json({ error: "kind is required" }, { status: 400 });
    }
    if (!url) {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    await createMediaForContent({
      contentItemId: contentId,
      kind,
      url,
      sort_order: typeof body.sort_order === 'number' ? body.sort_order : null,
    });
    const media = await listMediaForContent(contentId);
    return NextResponse.json({ ok: true, media }, { status: 201 });
  } catch (error) {
    const mapped = mapMediaError(error as Error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

export async function DELETE(
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

    await assertNetworkPartnerOwnsContent(actor.networkPartnerId, contentId);
    const body = (await req.json()) as MediaBody;
    const mediaId = asRequiredText(body.media_id);
    if (!mediaId) {
      return NextResponse.json({ error: "media_id is required" }, { status: 400 });
    }

    await deleteMediaById(mediaId, contentId);
    const media = await listMediaForContent(contentId);
    return NextResponse.json({ ok: true, media });
  } catch (error) {
    const mapped = mapMediaError(error as Error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
