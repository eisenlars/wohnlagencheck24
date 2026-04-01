import { NextResponse } from "next/server";

import { dispatchPartnerTriggerEvent } from "@/lib/integrations/triggers/dispatch";
import { normalizePartnerPropstackTriggerEvent } from "@/lib/integrations/triggers/providers/propstack";
import { resolvePartnerIntegrationByTriggerToken } from "@/lib/integrations/triggers/resolve-integration";

function parsePayload(rawBody: string): Record<string, unknown> {
  const trimmed = rawBody.trim();
  if (!trimmed) return {};
  try {
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : { value: parsed };
  } catch {
    const params = new URLSearchParams(trimmed);
    const out: Record<string, unknown> = {};
    for (const [key, value] of params.entries()) {
      out[key] = value;
    }
    return out;
  }
}

function mapTriggerError(error: Error) {
  if (error.message === "INVALID_TRIGGER_SIGNATURE") {
    return { status: 401, error: "Ungültige Propstack-Signatur." };
  }
  if (error.message === "NOT_FOUND") {
    return { status: 404, error: "Integration nicht gefunden." };
  }
  return { status: 500, error: error.message || "Trigger konnte nicht verarbeitet werden." };
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  try {
    const params = await ctx.params;
    const integration = await resolvePartnerIntegrationByTriggerToken({
      provider: "propstack",
      token: String(params.token ?? "").trim(),
    });
    if (!integration) {
      return NextResponse.json({ error: "Integration nicht gefunden." }, { status: 404 });
    }

    const rawBody = await request.text();
    const event = normalizePartnerPropstackTriggerEvent({
      integration,
      rawBody,
      payload: parsePayload(rawBody),
      searchParams: new URL(request.url).searchParams,
      signature: request.headers.get("x-propstack-signature"),
    });
    const result = await dispatchPartnerTriggerEvent(event);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const mapped = mapTriggerError(error as Error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
