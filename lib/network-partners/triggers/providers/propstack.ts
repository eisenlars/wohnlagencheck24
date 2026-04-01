import { createHmac, timingSafeEqual } from "node:crypto";

import { buildTriggerDedupeKey } from "@/lib/network-partners/triggers/dispatch";
import { readIntegrationTriggerSecret } from "@/lib/network-partners/triggers/resolve-integration";
import type {
  IntegrationTriggerVerification,
  NormalizedIntegrationTriggerEvent,
} from "@/lib/network-partners/triggers/types";
import type { NetworkPartnerIntegrationRecord } from "@/lib/network-partners/types";

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

function mapPropstackEventToResource(eventType: string): { resource: "offers" | "requests" | "all" | "ignored"; resourceType: string } {
  if (eventType.startsWith("property_")) {
    return { resource: "all", resourceType: "property" };
  }
  if (eventType.startsWith("saved_query_")) {
    return { resource: "requests", resourceType: "saved_query" };
  }
  return { resource: "ignored", resourceType: "other" };
}

function verifySignature(rawBody: string, signature: string | null, secret: string | null): IntegrationTriggerVerification {
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

export function normalizePropstackTriggerEvent(input: {
  integration: NetworkPartnerIntegrationRecord;
  rawBody: string;
  payload: Record<string, unknown>;
  searchParams: URLSearchParams;
  signature: string | null;
}): NormalizedIntegrationTriggerEvent {
  const eventType = String(
    input.searchParams.get("event")
    ?? input.payload.event
    ?? input.payload.event_type
    ?? "property_updated",
  ).trim().toLowerCase();
  const mapped = mapPropstackEventToResource(eventType);
  const resourceId = asText(input.searchParams.get("resource_id"))
    ?? asText(input.payload.id)
    ?? asText(input.payload.property_id)
    ?? asText(input.payload.saved_query_id)
    ?? asText(input.payload.client_id);
  const changedFields = normalizeChangedFields(input.payload.changed_attributes);
  const verification = verifySignature(input.rawBody, input.signature, readIntegrationTriggerSecret(input.integration));

  if (verification === "failed") {
    throw new Error("INVALID_TRIGGER_SIGNATURE");
  }

  return {
    provider: "propstack",
    integration_id: input.integration.id,
    portal_partner_id: input.integration.portal_partner_id,
    network_partner_id: input.integration.network_partner_id,
    source: "webhook",
    event_type: eventType,
    resource_type: mapped.resourceType,
    resource_id: resourceId,
    changed_fields: changedFields,
    suggested_resource: mapped.resource,
    suggested_mode: "guarded",
    verification,
    dedupe_key: buildTriggerDedupeKey({
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
