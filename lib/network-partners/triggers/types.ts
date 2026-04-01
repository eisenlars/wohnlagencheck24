import type { NetworkPartnerCrmProvider } from "@/lib/network-partners/sync/types";

export type IntegrationTriggerSource = "webhook";

export type IntegrationTriggerResource = "offers" | "requests" | "all" | "ignored";

export type IntegrationTriggerLogStatus = "received" | "processed" | "ignored" | "duplicate" | "error";

export type IntegrationTriggerVerification = "verified" | "unsigned" | "failed" | "not_supported";

export type NormalizedIntegrationTriggerEvent = {
  provider: NetworkPartnerCrmProvider;
  integration_id: string;
  portal_partner_id: string;
  network_partner_id: string;
  source: IntegrationTriggerSource;
  event_type: string;
  resource_type: string;
  resource_id: string | null;
  changed_fields: string[];
  suggested_resource: IntegrationTriggerResource;
  suggested_mode: "guarded" | "full";
  verification: IntegrationTriggerVerification;
  dedupe_key: string;
  raw_payload: Record<string, unknown>;
  received_at: string;
};

export type IntegrationTriggerDispatchResult = {
  accepted: boolean;
  status: IntegrationTriggerLogStatus;
  message: string;
  resource: IntegrationTriggerResource;
  sync_run_id: string | null;
};
