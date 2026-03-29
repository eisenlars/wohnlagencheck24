import { NextResponse } from "next/server";

import { requireNetworkPartnerActorContext } from "@/lib/network-partners/auth";
import { listPartnerAIUsageEvents } from "@/lib/network-partners/repositories/ai-credits";
import { requirePortalPartnerRole } from "@/lib/network-partners/roles";
import type { PartnerAIUsageFeature } from "@/lib/network-partners/types";

function asFeature(value: string | null): PartnerAIUsageFeature | null {
  if (value === "content_optimize" || value === "content_translate" || value === "seo_meta_generate") {
    return value;
  }
  return null;
}

function asPositiveInt(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return undefined;
  return parsed;
}

function mapAIError(error: Error) {
  if (error.message === "UNAUTHORIZED") return { status: 401, error: "Unauthorized" };
  if (error.message === "FORBIDDEN") return { status: 403, error: "Forbidden" };
  if (error.message === "INVALID_AI_PERIOD_KEY") {
    return { status: 400, error: "Ungueltiger Periodenschluessel. Erwartet wird YYYY-MM." };
  }
  return { status: 500, error: error.message || "Unexpected error" };
}

export async function GET(request: Request) {
  try {
    const actor = requirePortalPartnerRole(
      await requireNetworkPartnerActorContext(),
      ["partner_owner", "partner_manager", "partner_billing"],
    );

    const { searchParams } = new URL(request.url);
    const featureParam = searchParams.get("feature");
    const parsedFeature = featureParam ? asFeature(featureParam) : undefined;
    const feature = parsedFeature ?? undefined;
    if (featureParam && !feature) {
      return NextResponse.json({ error: "Invalid feature" }, { status: 400 });
    }

    const usageEvents = await listPartnerAIUsageEvents(actor.partnerId, {
      period_key: searchParams.get("period_key") ?? undefined,
      network_partner_id: searchParams.get("network_partner_id") ?? undefined,
      content_item_id: searchParams.get("content_item_id") ?? undefined,
      feature,
      limit: asPositiveInt(searchParams.get("limit")),
    });

    return NextResponse.json({ ok: true, usage_events: usageEvents });
  } catch (error) {
    const mapped = mapAIError(error as Error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
