export type ProviderKey = "propstack" | "onoffice";

export type PartnerIntegration = {
  id: string;
  partner_id: string;
  kind: "crm" | "llm" | "other";
  provider: ProviderKey;
  base_url: string | null;
  auth_type: string | null;
  auth_config: Record<string, unknown> | null;
  detail_url_template: string | null;
  is_active: boolean;
  settings: Record<string, unknown> | null;
};

export type JsonObject = Record<string, unknown>;

export type OfferMediaAsset = {
  url: string;
  title: string | null;
  position: number | null;
  kind: "image" | "floorplan";
};

export type OfferEnergySnapshot = {
  certificate_type: string | null;
  value: number | null;
  value_kind: "bedarf" | "verbrauch" | null;
  construction_year: number | null;
  heating_energy_source: string | null;
  efficiency_class: string | null;
  demand: number | null;
  year: number | null;
};

export type MappedOffer = {
  partner_id: string;
  source: ProviderKey;
  external_id: string;
  offer_type: "kauf" | "miete";
  object_type: "haus" | "wohnung";
  title: string | null;
  price: number | null;
  rent: number | null;
  area_sqm: number | null;
  rooms: number | null;
  address: string | null;
  image_url: string | null;
  detail_url: string | null;
  is_top: boolean;
  updated_at: string | null;
  raw: JsonObject;
  source_payload: JsonObject;
};

export type RawListing = {
  partner_id: string;
  provider: ProviderKey;
  external_id: string;
  title: string | null;
  status: string | null;
  source_updated_at: string | null;
  normalized_payload: JsonObject;
  source_payload: JsonObject;
  is_active: boolean;
  sync_status: string;
  last_seen_at: string;
  updated_at: string;
};

export type RawReference = RawListing;
export type RawRequest = RawListing;

export type ResourceSyncDiagnostics = {
  provider_request_count: number;
  provider_pages_fetched: number;
  provider_breakdown?: Record<string, { requests: number; pages_fetched: number }>;
  partial_sync_mode?: boolean;
  stale_deactivation_allowed?: boolean;
  references_source?: "live" | "unavailable";
  requests_source?: "live" | "unavailable";
};

export type ResourceSyncData = {
  listings: RawListing[];
  references: RawReference[];
  requests: RawRequest[];
  referencesFetched: boolean;
  requestsFetched: boolean;
  notes: string[];
  diagnostics?: ResourceSyncDiagnostics;
};
