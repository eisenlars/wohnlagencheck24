import { NextResponse } from "next/server";

import { requireNetworkPartnerActorContext } from "@/lib/network-partners/auth";
import { requireNetworkPartnerRole } from "@/lib/network-partners/roles";
import {
  autoPrefillNetworkContentTranslationsForNetworkPartner,
  listNetworkContentTranslationsForNetworkPartner,
  upsertNetworkContentTranslationForNetworkPartner,
} from "@/lib/network-partners/i18n";
import type { NetworkContentTranslationStatus } from "@/lib/network-partners/types";

type TranslationBody = {
  mode?: "upsert" | "autofill";
  locale?: string;
  locales?: string[];
  translated_title?: string | null;
  translated_summary?: string | null;
  translated_body_md?: string | null;
  status?: NetworkContentTranslationStatus;
};

function asRequiredText(value: unknown): string | null {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

function asTranslationStatus(value: unknown): NetworkContentTranslationStatus | null {
  const normalized = String(value ?? "").trim();
  if (
    normalized === "machine_generated"
    || normalized === "reviewed"
    || normalized === "edited"
    || normalized === "stale"
  ) {
    return normalized;
  }
  return null;
}

function normalizeLocales(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((entry) => String(entry ?? "").trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

function mapTranslationError(error: Error) {
  if (error.message === "UNAUTHORIZED") return { status: 401, error: "Unauthorized" };
  if (error.message === "FORBIDDEN") return { status: 403, error: "Forbidden" };
  if (error.message === "NOT_FOUND") return { status: 404, error: "Content item not found" };
  if (error.message === "BOOKING_NOT_FOUND") return { status: 404, error: "Booking not found" };
  if (error.message === "INVALID_TRANSLATION_LOCALE") return { status: 400, error: "locale must be a non-de target locale" };
  if (error.message === "AUTO_TRANSLATION_NOT_SUPPORTED") return { status: 400, error: "Auto-prefill is only supported for property_offer and property_request" };
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

    const payload = await listNetworkContentTranslationsForNetworkPartner({
      contentItemId: contentId,
      networkPartnerId: actor.networkPartnerId,
    });
    return NextResponse.json({ ok: true, ...payload });
  } catch (error) {
    const mapped = mapTranslationError(error as Error);
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

    const body = (await req.json()) as TranslationBody;
    const mode = body.mode === "autofill" ? "autofill" : "upsert";

    if (mode === "autofill") {
      const locale = asRequiredText(body.locale);
      const locales = normalizeLocales(body.locales);
      await autoPrefillNetworkContentTranslationsForNetworkPartner({
        contentItemId: contentId,
        networkPartnerId: actor.networkPartnerId,
        locales: locale ? [locale] : locales,
      });
    } else {
      const locale = asRequiredText(body.locale);
      const status = asTranslationStatus(body.status) ?? "edited";
      if (!locale) {
        return NextResponse.json({ error: "locale is required" }, { status: 400 });
      }
      await upsertNetworkContentTranslationForNetworkPartner({
        contentItemId: contentId,
        networkPartnerId: actor.networkPartnerId,
        locale,
        translated_title: body.translated_title ?? null,
        translated_summary: body.translated_summary ?? null,
        translated_body_md: body.translated_body_md ?? null,
        status,
      });
    }

    const payload = await listNetworkContentTranslationsForNetworkPartner({
      contentItemId: contentId,
      networkPartnerId: actor.networkPartnerId,
    });
    return NextResponse.json({ ok: true, ...payload });
  } catch (error) {
    const mapped = mapTranslationError(error as Error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
