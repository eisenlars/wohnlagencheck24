import { timingSafeEqual } from "node:crypto";

import { buildPartnerTriggerDedupeKey } from "@/lib/integrations/triggers/dispatch";
import { readPartnerIntegrationTriggerSecret } from "@/lib/integrations/triggers/resolve-integration";
import type {
  NormalizedPartnerTriggerEvent,
  ResolvedPartnerTriggerIntegration,
} from "@/lib/integrations/triggers/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asText(value: unknown): string | null {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

function mapOnOfficeModuleToResource(moduleName: string): {
  resource: "offers" | "requests" | "all" | "ignored";
  resourceType: string;
} {
  if (moduleName === "estate") {
    return { resource: "all", resourceType: "estate" };
  }
  if (moduleName === "searchcriteria") {
    return { resource: "requests", resourceType: "searchcriteria" };
  }
  return { resource: "ignored", resourceType: moduleName || "other" };
}

function verifySharedSecret(providedSecret: string | null, configuredSecret: string | null) {
  if (!configuredSecret) return "unsigned" as const;
  if (!providedSecret) return "failed" as const;

  const expected = Buffer.from(configuredSecret, "utf8");
  const provided = Buffer.from(providedSecret.trim(), "utf8");
  if (expected.length !== provided.length) return "failed" as const;
  return timingSafeEqual(expected, provided) ? ("verified" as const) : ("failed" as const);
}

export function normalizePartnerOnOfficeTriggerEvent(input: {
  integration: ResolvedPartnerTriggerIntegration;
  rawBody: string;
  payload: Record<string, unknown>;
  searchParams: URLSearchParams;
  providedSecret: string | null;
}): NormalizedPartnerTriggerEvent {
  const moduleName = String(
    input.searchParams.get("module")
      ?? input.payload.module
      ?? input.payload.record_module
      ?? "estate",
  )
    .trim()
    .toLowerCase();
  const eventType = String(
    input.searchParams.get("event")
      ?? input.payload.event
      ?? input.payload.event_type
      ?? `${moduleName}_updated`,
  )
    .trim()
    .toLowerCase();
  const resourceId =
    asText(input.searchParams.get("resource_id"))
    ?? asText(input.payload.resource_id)
    ?? asText(input.payload.record_id)
    ?? asText(input.payload.id)
    ?? asText(isRecord(input.payload.record) ? input.payload.record.id : null);
  const changedFields = Array.isArray(input.payload.changed_fields)
    ? input.payload.changed_fields.map((entry) => String(entry ?? "").trim()).filter(Boolean)
    : [];
  const mapped = mapOnOfficeModuleToResource(moduleName);
  const verification = verifySharedSecret(
    input.providedSecret,
    readPartnerIntegrationTriggerSecret(input.integration),
  );

  if (verification === "failed") {
    throw new Error("INVALID_TRIGGER_SIGNATURE");
  }

  return {
    provider: "onoffice",
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
      provider: "onoffice",
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
