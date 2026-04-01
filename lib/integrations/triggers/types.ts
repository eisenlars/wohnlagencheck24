import type { CrmSyncMode, ProviderKey } from "@/lib/providers/types";

export type PartnerIntegrationTriggerSource = "webhook";

export type PartnerIntegrationTriggerResource = "offers" | "requests" | "all" | "ignored";

export type PartnerIntegrationTriggerLogStatus =
  | "received"
  | "processed"
  | "ignored"
  | "duplicate"
  | "error";

export type PartnerIntegrationTriggerVerification =
  | "verified"
  | "unsigned"
  | "failed"
  | "not_supported";

export type ResolvedPartnerTriggerIntegration = {
  id: string;
  partner_id: string;
  kind: "crm";
  provider: ProviderKey;
  base_url: string | null;
  auth_type: string | null;
  auth_config: Record<string, unknown> | null;
  detail_url_template: string | null;
  is_active: boolean;
  settings: Record<string, unknown> | null;
  last_sync_at?: string | null;
};

export type NormalizedPartnerTriggerEvent = {
  provider: ProviderKey;
  integration_id: string;
  partner_id: string;
  source: PartnerIntegrationTriggerSource;
  event_type: string;
  resource_type: string;
  resource_id: string | null;
  changed_fields: string[];
  suggested_resource: PartnerIntegrationTriggerResource;
  suggested_mode: CrmSyncMode;
  verification: PartnerIntegrationTriggerVerification;
  dedupe_key: string;
  raw_payload: Record<string, unknown>;
  received_at: string;
};

export type PartnerIntegrationTriggerDispatchResult = {
  accepted: boolean;
  status: PartnerIntegrationTriggerLogStatus;
  message: string;
  resource: PartnerIntegrationTriggerResource;
  sync_job_id: string | null;
};
