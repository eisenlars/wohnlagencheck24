import { NextResponse } from "next/server";

import { dispatchNormalizedTriggerEvent } from "@/lib/network-partners/triggers/dispatch";
import { normalizeOnOfficeTriggerEvent } from "@/lib/network-partners/triggers/providers/onoffice";
import { resolveIntegrationByTriggerToken } from "@/lib/network-partners/triggers/resolve-integration";

function parsePayload(rawBody: string): Record<string, unknown> {
  const trimmed = rawBody.trim();
  if (!trimmed) return {};
  try {
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : { value: parsed };
  } catch {
    const params = new URLSearchParams(trimmed);
    const out: Record<string, unknown> = {};
    for (const [key, value] of params.entries()) {
      out[key] = value;
    }
    return out;
  }
}

function readProvidedSecret(headers: Headers): string | null {
  const direct = headers.get("x-wc24-trigger-secret")?.trim();
  if (direct) return direct;

  const alt = headers.get("x-webhook-secret")?.trim();
  if (alt) return alt;

  const auth = headers.get("authorization")?.trim();
  if (!auth) return null;
  const bearerPrefix = "bearer ";
  if (auth.toLowerCase().startsWith(bearerPrefix)) {
    const token = auth.slice(bearerPrefix.length).trim();
    return token || null;
  }
  return auth;
}

function mapTriggerError(error: Error) {
  if (error.message === "INVALID_TRIGGER_SIGNATURE") {
    return { status: 401, error: "Ungültiger onOffice-Webhook-Header." };
  }
  if (error.message === "NOT_FOUND") {
    return { status: 404, error: "Integration nicht gefunden." };
  }
  return {
    status: 500,
    error: error.message || "Trigger konnte nicht verarbeitet werden.",
  };
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  try {
    const params = await ctx.params;
    const integration = await resolveIntegrationByTriggerToken({
      provider: "onoffice",
      token: String(params.token ?? "").trim(),
    });
    if (!integration) {
      return NextResponse.json({ error: "Integration nicht gefunden." }, { status: 404 });
    }

    const rawBody = await request.text();
    const event = normalizeOnOfficeTriggerEvent({
      integration,
      rawBody,
      payload: parsePayload(rawBody),
      searchParams: new URL(request.url).searchParams,
      providedSecret: readProvidedSecret(request.headers),
    });
    const result = await dispatchNormalizedTriggerEvent(event);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const mapped = mapTriggerError(error as Error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
