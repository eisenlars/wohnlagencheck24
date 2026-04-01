import { createHmac, timingSafeEqual } from "node:crypto";

import { buildPartnerTriggerDedupeKey } from "@/lib/integrations/triggers/dispatch";
import { readPartnerIntegrationTriggerSecret } from "@/lib/integrations/triggers/resolve-integration";
import type {
  NormalizedPartnerTriggerEvent,
  PartnerIntegrationTriggerVerification,
  ResolvedPartnerTriggerIntegration,
} from "@/lib/integrations/triggers/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asText(value: unknown): string | null {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeChangedFields(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry ?? "").trim()).filter(Boolean);
  }
  if (isRecord(value)) {
    return Object.keys(value).map((key) => String(key).trim()).filter(Boolean);
  }
  const single = asText(value);
  return single ? [single] : [];
}

function mapPropstackEventToResource(eventType: string): {
  resource: "offers" | "requests" | "all" | "ignored";
  resourceType: string;
} {
  if (eventType.startsWith("property_")) {
    return { resource: "all", resourceType: "property" };
  }
  if (eventType.startsWith("saved_query_")) {
    return { resource: "requests", resourceType: "saved_query" };
  }
  return { resource: "ignored", resourceType: "other" };
}

function verifySignature(
  rawBody: string,
  signature: string | null,
  secret: string | null,
): PartnerIntegrationTriggerVerification {
  if (!secret) return "unsigned";
  if (!signature) return "failed";
  const expected = Buffer.from(
    createHmac("sha256", secret).update(rawBody, "utf8").digest("hex"),
    "utf8",
  );
  const provided = Buffer.from(signature.trim(), "utf8");
  if (expected.length !== provided.length) return "failed";
  return timingSafeEqual(expected, provided) ? "verified" : "failed";
}

export function normalizePartnerPropstackTriggerEvent(input: {
  integration: ResolvedPartnerTriggerIntegration;
  rawBody: string;
  payload: Record<string, unknown>;
  searchParams: URLSearchParams;
  signature: string | null;
}): NormalizedPartnerTriggerEvent {
  const eventType = String(
    input.searchParams.get("event")
      ?? input.payload.event
      ?? input.payload.event_type
      ?? "property_updated",
  )
    .trim()
    .toLowerCase();
  const mapped = mapPropstackEventToResource(eventType);
  const resourceId =
    asText(input.searchParams.get("resource_id"))
    ?? asText(input.payload.id)
    ?? asText(input.payload.property_id)
    ?? asText(input.payload.saved_query_id)
    ?? asText(input.payload.client_id);
  const changedFields = normalizeChangedFields(input.payload.changed_attributes);
  const verification = verifySignature(
    input.rawBody,
    input.signature,
    readPartnerIntegrationTriggerSecret(input.integration),
  );

  if (verification === "failed") {
    throw new Error("INVALID_TRIGGER_SIGNATURE");
  }

  return {
    provider: "propstack",
    integration_id: input.integration.id,
    partner_id: input.integration.partner_id,
    source: "webhook",
    event_type: eventType,
    resource_type: mapped.resourceType,
    resource_id: resourceId,
    changed_fields: changedFields,
    suggested_resource: mapped.resource,
    suggested_mode: "guarded",
    verification,
    dedupe_key: buildPartnerTriggerDedupeKey({
      provider: "propstack",
      integrationId: input.integration.id,
      eventType,
      resourceType: mapped.resourceType,
      resourceId,
      rawBody: input.rawBody,
    }),
    raw_payload: input.payload,
    received_at: new Date().toISOString(),
  };
}
