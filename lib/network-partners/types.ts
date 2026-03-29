export type AdminRole = "admin_super" | "admin_ops" | "admin_billing";
export type PortalPartnerRole = "partner_owner" | "partner_manager" | "partner_billing";
export type NetworkPartnerRole = "network_owner" | "network_editor" | "network_billing";

export type ActorContext =
  | { kind: "admin"; userId: string; role: AdminRole }
  | { kind: "portal_partner"; userId: string; partnerId: string; role: PortalPartnerRole }
  | { kind: "network_partner"; userId: string; networkPartnerId: string; role: NetworkPartnerRole };

export type NetworkPartnerStatus = "active" | "paused" | "inactive";
export type PlacementCode = "company_profile" | "property_offer" | "property_request";
export type BookingStatus =
  | "draft"
  | "pending_review"
  | "active"
  | "paused"
  | "cancelled"
  | "expired";
export type AIBillingMode = "included" | "credit_based" | "blocked";
export type NetworkContentType = PlacementCode;
export type NetworkContentSourceType = "manual" | "api";
export type NetworkContentStatus =
  | "draft"
  | "in_review"
  | "approved"
  | "live"
  | "paused"
  | "rejected"
  | "expired";
export type NetworkContentReviewStatus = "pending" | "approved" | "rejected";
export type NetworkContentReviewAction =
  | "submit"
  | "approve"
  | "reject"
  | "publish"
  | "pause"
  | "reset_draft";
export type NetworkContentTranslationStatus =
  | "machine_generated"
  | "reviewed"
  | "edited"
  | "stale";

export type NetworkPartnerRecord = {
  id: string;
  portal_partner_id: string;
  company_name: string;
  legal_name: string | null;
  contact_email: string;
  contact_phone: string | null;
  website_url: string | null;
  status: NetworkPartnerStatus;
  managed_editing_enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type PlacementCatalogRecord = {
  code: PlacementCode;
  label: string;
  content_type: PlacementCode;
  billing_mode: "monthly_fixed";
  is_active: boolean;
};

export type PartnerAreaInventoryRecord = {
  id: string;
  partner_id: string;
  area_id: string;
  placement_code: PlacementCode;
  slot_limit: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PartnerAreaInventoryCreateInput = {
  partner_id: string;
  area_id: string;
  placement_code: PlacementCode;
  slot_limit: number;
  is_active?: boolean;
};

export type PartnerAreaInventoryUpdateInput = {
  id: string;
  partner_id: string;
  slot_limit?: number;
  is_active?: boolean;
};

export type NetworkPartnerBookingRecord = {
  id: string;
  portal_partner_id: string;
  network_partner_id: string;
  area_id: string;
  placement_code: PlacementCode;
  status: BookingStatus;
  starts_at: string;
  ends_at: string | null;
  monthly_price_eur: number;
  portal_fee_eur: number;
  billing_cycle_day: number;
  required_locales: string[];
  ai_billing_mode: AIBillingMode;
  ai_monthly_budget_eur: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type NetworkPartnerBookingCreateInput = {
  portal_partner_id: string;
  network_partner_id: string;
  area_id: string;
  placement_code: PlacementCode;
  status?: BookingStatus;
  starts_at: string;
  ends_at?: string | null;
  monthly_price_eur: number;
  portal_fee_eur: number;
  billing_cycle_day: number;
  required_locales: string[];
  ai_billing_mode: AIBillingMode;
  ai_monthly_budget_eur?: number;
  notes?: string | null;
};

export type NetworkPartnerBookingUpdateInput = {
  id: string;
  portal_partner_id: string;
  status?: BookingStatus;
  starts_at?: string;
  ends_at?: string | null;
  monthly_price_eur?: number;
  portal_fee_eur?: number;
  billing_cycle_day?: number;
  required_locales?: string[];
  ai_billing_mode?: AIBillingMode;
  ai_monthly_budget_eur?: number;
  notes?: string | null;
};

export type NetworkPartnerCreateInput = {
  portal_partner_id: string;
  company_name: string;
  legal_name?: string | null;
  contact_email: string;
  contact_phone?: string | null;
  website_url?: string | null;
  status?: NetworkPartnerStatus;
  managed_editing_enabled?: boolean;
};

export type NetworkPartnerUpdateInput = {
  id: string;
  portal_partner_id: string;
  company_name?: string;
  legal_name?: string | null;
  contact_email?: string;
  contact_phone?: string | null;
  website_url?: string | null;
  status?: NetworkPartnerStatus;
  managed_editing_enabled?: boolean;
};

export type NetworkCompanyProfileDetails = {
  company_name: string;
  industry_type: string | null;
  service_region: string | null;
};

export type NetworkPropertyOfferDetails = {
  external_id: string | null;
  marketing_type: string | null;
  property_type: string | null;
  location_label: string | null;
  price: number | null;
  living_area: number | null;
  plot_area: number | null;
  rooms: number | null;
};

export type NetworkPropertyRequestDetails = {
  external_id: string | null;
  request_type: string | null;
  search_region: string | null;
  budget_min: number | null;
  budget_max: number | null;
  area_min: number | null;
  area_max: number | null;
};

export type NetworkContentReviewRecord = {
  id: string;
  content_item_id: string;
  review_status: NetworkContentReviewStatus;
  reviewed_by_user_id: string | null;
  review_note: string | null;
  reviewed_at: string | null;
};

export type NetworkContentRecord = {
  id: string;
  portal_partner_id: string;
  network_partner_id: string;
  booking_id: string;
  area_id: string;
  content_type: NetworkContentType;
  source_type: NetworkContentSourceType;
  status: NetworkContentStatus;
  slug: string;
  title: string;
  summary: string | null;
  body_md: string | null;
  cta_label: string | null;
  cta_url: string | null;
  primary_locale: string;
  published_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  company_profile: NetworkCompanyProfileDetails | null;
  property_offer: NetworkPropertyOfferDetails | null;
  property_request: NetworkPropertyRequestDetails | null;
  latest_review: NetworkContentReviewRecord | null;
};

export type NetworkContentCreateInput = {
  portal_partner_id: string;
  booking_id: string;
  slug: string;
  title: string;
  summary?: string | null;
  body_md?: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
  primary_locale?: string;
  company_profile?: Partial<NetworkCompanyProfileDetails> | null;
  property_offer?: Partial<NetworkPropertyOfferDetails> | null;
  property_request?: Partial<NetworkPropertyRequestDetails> | null;
};

export type NetworkContentUpdateInput = {
  id: string;
  portal_partner_id: string;
  slug?: string;
  title?: string;
  summary?: string | null;
  body_md?: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
  primary_locale?: string;
  company_profile?: Partial<NetworkCompanyProfileDetails> | null;
  property_offer?: Partial<NetworkPropertyOfferDetails> | null;
  property_request?: Partial<NetworkPropertyRequestDetails> | null;
};

export type NetworkContentTranslationRecord = {
  id: string;
  content_item_id: string;
  locale: string;
  status: NetworkContentTranslationStatus;
  translated_title: string | null;
  translated_summary: string | null;
  translated_body_md: string | null;
  source_snapshot_hash: string | null;
  updated_at: string;
};

export type NetworkContentTranslationView = NetworkContentTranslationRecord & {
  is_required: boolean;
  is_stale: boolean;
};

export type NetworkPartnerInvoiceStatus = "open" | "paid" | "overdue" | "cancelled";
export type PortalPartnerSettlementStatus = "pending" | "cleared" | "held";

export type NetworkPartnerInvoiceLineRecord = {
  id: string;
  booking_id: string;
  portal_partner_id: string;
  network_partner_id: string;
  period_start: string;
  period_end: string;
  gross_amount_eur: number;
  portal_fee_eur: number;
  partner_net_eur: number;
  status: NetworkPartnerInvoiceStatus;
  created_at: string;
  network_partner_name: string | null;
  area_id: string | null;
  placement_code: PlacementCode | null;
};

export type PortalPartnerSettlementLineRecord = {
  id: string;
  invoice_line_id: string;
  portal_partner_id: string;
  gross_amount_eur: number;
  portal_fee_eur: number;
  partner_net_eur: number;
  status: PortalPartnerSettlementStatus;
  created_at: string;
};

export type NetworkBillingMonthSummary = {
  period_key: string;
  invoice_count: number;
  gross_amount_eur: number;
  portal_fee_eur: number;
  partner_net_eur: number;
};

export type NetworkBillingProjectionRow = {
  booking_id: string;
  network_partner_id: string;
  network_partner_name: string | null;
  area_id: string;
  placement_code: PlacementCode;
  booking_status: BookingStatus;
  monthly_price_eur: number;
  portal_fee_eur: number;
  partner_net_eur: number;
  billing_cycle_day: number;
};

export type NetworkBillingOverview = {
  invoice_lines: NetworkPartnerInvoiceLineRecord[];
  settlement_lines: PortalPartnerSettlementLineRecord[];
  month_summaries: NetworkBillingMonthSummary[];
  booking_projection: NetworkBillingProjectionRow[];
  invoice_table_available: boolean;
  settlement_table_available: boolean;
};
