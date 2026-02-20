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

export type ResourceSyncData = {
  listings: RawListing[];
  references: RawReference[];
  requests: RawRequest[];
  referencesFetched: boolean;
  requestsFetched: boolean;
  notes: string[];
};
