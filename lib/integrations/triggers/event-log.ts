import { createAdminClient } from "@/utils/supabase/admin";
import type {
  NormalizedPartnerTriggerEvent,
  PartnerIntegrationTriggerLogStatus,
} from "@/lib/integrations/triggers/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isMissingTableError(error: unknown): boolean {
  const message = String((isRecord(error) ? error.message : error) ?? "").toLowerCase();
  return message.includes("partner_integration_trigger_events") && message.includes("does not exist");
}

function isDuplicateError(error: unknown): boolean {
  const message = String((isRecord(error) ? error.message : error) ?? "").toLowerCase();
  return message.includes("duplicate") || message.includes("unique");
}

export async function createPartnerTriggerEventLog(
  event: NormalizedPartnerTriggerEvent,
): Promise<{ id: string | null; duplicate: boolean }> {
  const admin = createAdminClient();
  const payload = {
    integration_id: event.integration_id,
    provider: event.provider,
    event_type: event.event_type,
    resource_type: event.resource_type,
    resource_id: event.resource_id,
    dedupe_key: event.dedupe_key,
    status: "received",
    changed_fields: event.changed_fields,
    verification: event.verification,
    raw_payload: event.raw_payload,
    received_at: event.received_at,
  };

  const { data, error } = await admin
    .from("partner_integration_trigger_events")
    .insert(payload)
    .select("id")
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error)) return { id: null, duplicate: false };
    if (isDuplicateError(error)) return { id: null, duplicate: true };
    throw new Error(String(error.message ?? "PARTNER_TRIGGER_EVENT_CREATE_FAILED"));
  }

  const id = isRecord(data) ? String(data.id ?? "").trim() || null : null;
  return { id, duplicate: false };
}

export async function finishPartnerTriggerEventLog(input: {
  id: string | null;
  status: PartnerIntegrationTriggerLogStatus;
  syncJobId?: string | null;
  error?: string | null;
  summary?: Record<string, unknown> | null;
}): Promise<void> {
  if (!input.id) return;
  const admin = createAdminClient();
  const { error } = await admin
    .from("partner_integration_trigger_events")
    .update({
      status: input.status,
      sync_job_id: input.syncJobId ?? null,
      error: input.error ?? null,
      summary: input.summary ?? null,
      processed_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (error) {
    if (isMissingTableError(error)) return;
    throw new Error(String(error.message ?? "PARTNER_TRIGGER_EVENT_UPDATE_FAILED"));
  }
}
