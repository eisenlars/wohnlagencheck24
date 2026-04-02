export type OpenImmoAttachment = {
  url: string;
  title: string | null;
  group: string | null;
};

export type OpenImmoListing = {
  external_id: string;
  offer_type: "kauf" | "miete";
  object_type: string;
  title: string | null;
  description: string | null;
  location_note: string | null;
  furnishing_note: string | null;
  price: number | null;
  rent: number | null;
  area_sqm: number | null;
  rooms: number | null;
  address: string | null;
  image_url: string | null;
  updated_at: string | null;
  attachments: OpenImmoAttachment[];
  raw: Record<string, unknown>;
};

export type OpenImmoParseResult = {
  listings: OpenImmoListing[];
  notes: string[];
};
