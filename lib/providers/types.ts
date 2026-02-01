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
  raw: Record<string, unknown>;
};
