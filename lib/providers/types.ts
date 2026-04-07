export type ProviderKey = "propstack" | "onoffice" | "openimmo";

export type CrmSyncResource = "offers" | "references" | "requests" | "all";
export type CrmSyncMode = "guarded" | "full";
export type CrmSyncTrigger = "admin_manual" | "auto_scheduler";

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
  kind: "image" | "floorplan" | "location_map" | "document";
};

export type OfferDocumentAsset = {
  url: string;
  title: string | null;
  name: string | null;
  position: number | null;
  kind: "document" | "floorplan" | "video";
  is_exposee: boolean | null;
  on_landing_page: boolean | null;
};

export type OfferEnergySnapshot = {
  certificate_type: string | null;
  value: number | null;
  value_kind: "bedarf" | "verbrauch" | null;
  construction_year: number | null;
  heating_energy_source: string | null;
  efficiency_class: string | null;
  certificate_availability: string | null;
  certificate_start_date: string | null;
  certificate_end_date: string | null;
  warm_water_included: boolean | null;
  demand: number | null;
  year: number | null;
};

export type OfferDetailsSnapshot = {
  living_area_sqm: number | null;
  usable_area_sqm: number | null;
  plot_area_sqm: number | null;
  rooms: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  floor: number | null;
  construction_year: number | null;
  condition: string | null;
  availability: string | null;
  parking: string | null;
  balcony: boolean | null;
  terrace: boolean | null;
  garden: boolean | null;
  elevator: boolean | null;
  address_hidden: boolean | null;
};

export type MappedOffer = {
  partner_id: string;
  source: ProviderKey;
  external_id: string;
  offer_type: "kauf" | "miete";
  object_type: string;
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

export type RawReferenceRow = RawListing;
export type RawRequestRow = RawListing;

export type CanonicalLifecycleStatus = "active" | "stale" | "expired" | "hidden" | "draft";

export type CanonicalReference = {
  partner_id: string;
  provider: ProviderKey;
  source: ProviderKey;
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
  lifecycle_status: CanonicalLifecycleStatus;
  is_live: boolean;
  canonical_payload: JsonObject;
  owner_account_id?: string | null;
  publisher_account_id?: string | null;
};

export type CanonicalRequest = {
  partner_id: string;
  provider: ProviderKey;
  source: ProviderKey;
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
  lifecycle_status: CanonicalLifecycleStatus;
  is_live: boolean;
  canonical_payload: JsonObject;
  owner_account_id?: string | null;
  publisher_account_id?: string | null;
};

export type RawReference = RawReferenceRow;
export type RawRequest = RawRequestRow;

export type ResourceSyncDiagnostics = {
  provider_request_count: number;
  provider_pages_fetched: number;
  provider_breakdown?: Record<string, { requests: number; pages_fetched: number }>;
  guarded_limits?: Record<string, { target_objects: number; max_pages?: number; per_page?: number }>;
  sync_limits?: Record<string, { target_objects?: number; max_pages?: number; per_page?: number }>;
  partial_sync_mode?: boolean;
  stale_deactivation_allowed?: boolean;
  references_source?: "live" | "unavailable";
  requests_source?: "live" | "unavailable";
  resource?: CrmSyncResource;
  mode?: CrmSyncMode;
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
