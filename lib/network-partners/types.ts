export type AdminRole = "admin_super" | "admin_ops" | "admin_billing";
export type PortalPartnerRole = "partner_owner" | "partner_manager" | "partner_billing";
export type NetworkPartnerRole = "network_owner" | "network_editor" | "network_billing";
export type NetworkPartnerIntegrationKind = "crm" | "llm";

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
  llm_partner_managed_allowed: boolean;
  created_at: string;
  updated_at: string;
};

export type NetworkPartnerUserRecord = {
  id: string;
  network_partner_id: string;
  auth_user_id: string;
  role: NetworkPartnerRole;
  is_primary: boolean;
  email: string | null;
  activation_pending: boolean;
  last_sign_in_at: string | null;
  created_at: string;
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
  starts_at?: string;
  ends_at?: string | null;
  monthly_price_eur: number;
  portal_fee_eur?: number;
  billing_cycle_day?: number;
  required_locales?: string[];
  ai_billing_mode?: AIBillingMode;
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
  llm_partner_managed_allowed?: boolean;
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
  llm_partner_managed_allowed?: boolean;
};

export type NetworkPartnerIntegrationRecord = {
  id: string;
  portal_partner_id: string;
  network_partner_id: string;
  kind: NetworkPartnerIntegrationKind;
  provider: string;
  base_url: string | null;
  auth_type: string | null;
  auth_config: Record<string, unknown> | null;
  detail_url_template: string | null;
  is_active: boolean;
  settings: Record<string, unknown> | null;
  last_test_at: string | null;
  last_preview_sync_at: string | null;
  last_sync_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type NetworkPartnerIntegrationCreateInput = {
  portal_partner_id: string;
  network_partner_id: string;
  kind?: NetworkPartnerIntegrationKind;
  provider: string;
  base_url?: string | null;
  auth_type?: string | null;
  auth_config?: Record<string, unknown> | null;
  detail_url_template?: string | null;
  is_active?: boolean;
  settings?: Record<string, unknown> | null;
};

export type NetworkPartnerIntegrationUpdateInput = {
  id: string;
  network_partner_id: string;
  provider?: string;
  base_url?: string | null;
  auth_type?: string | null;
  auth_config?: Record<string, unknown> | null;
  detail_url_template?: string | null;
  is_active?: boolean;
  settings?: Record<string, unknown> | null;
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

export type NetworkContentMediaKind = "logo" | "hero" | "gallery" | "document";

export type NetworkContentMediaRecord = {
  id: string;
  content_item_id: string;
  kind: NetworkContentMediaKind;
  url: string;
  sort_order: number;
  created_at: string;
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

export type NetworkPartnerBillingOverview = {
  invoice_lines: NetworkPartnerInvoiceLineRecord[];
  booking_projection: NetworkBillingProjectionRow[];
  invoice_table_available: boolean;
};

export type NetworkBillingRunLineStatus = "created" | "skipped";
export type NetworkBillingRunLineReason = "created" | "duplicate" | "not_billable";

export type NetworkBillingRunLine = {
  booking_id: string;
  network_partner_id: string;
  area_id: string;
  placement_code: PlacementCode;
  period_key: string;
  status: NetworkBillingRunLineStatus;
  reason: NetworkBillingRunLineReason;
  invoice_line_id: string | null;
  settlement_line_id: string | null;
  gross_amount_eur: number;
  portal_fee_eur: number;
  partner_net_eur: number;
};

export type NetworkBillingRunResult = {
  period_key: string;
  period_start: string;
  period_end: string;
  checked_booking_count: number;
  created_invoice_count: number;
  skipped_duplicate_count: number;
  skipped_not_billable_count: number;
  lines: NetworkBillingRunLine[];
};

export type NetworkBillingRunResponse = {
  ok: true;
  result: NetworkBillingRunResult;
};

export type PartnerAICreditLedgerStatus = "open" | "closed";
export type PartnerAIUsageFeature = "content_optimize" | "content_translate" | "seo_meta_generate";
export type PartnerAIUsageStatus = "ok" | "blocked" | "error";

export type PartnerAICreditLedgerRecord = {
  id: string;
  partner_id: string;
  period_key: string;
  opening_balance_eur: number;
  credits_added_eur: number;
  credits_used_eur: number;
  closing_balance_eur: number;
  status: PartnerAICreditLedgerStatus;
  updated_at: string;
};

export type PartnerAIUsageEventRecord = {
  id: string;
  partner_id: string;
  area_id: string | null;
  network_partner_id: string | null;
  content_item_id: string | null;
  feature: PartnerAIUsageFeature;
  locale: string | null;
  billing_mode: AIBillingMode;
  prompt_tokens: number;
  completion_tokens: number;
  estimated_cost_eur: number;
  credit_delta_eur: number;
  status: PartnerAIUsageStatus;
  created_at: string;
};

export type PartnerAIUsageEventCreateInput = {
  partner_id: string;
  area_id?: string | null;
  network_partner_id?: string | null;
  content_item_id?: string | null;
  feature: PartnerAIUsageFeature;
  locale?: string | null;
  billing_mode: AIBillingMode;
  prompt_tokens: number;
  completion_tokens: number;
  estimated_cost_eur: number;
  credit_delta_eur: number;
  status?: PartnerAIUsageStatus;
};

export type PartnerAIUsageEventFilters = {
  period_key?: string;
  network_partner_id?: string;
  content_item_id?: string;
  feature?: PartnerAIUsageFeature;
  limit?: number;
};

export type PartnerAICostEstimateInput = {
  feature: PartnerAIUsageFeature;
  model?: string | null;
  prompt_tokens: number;
  completion_tokens: number;
  prompt_price_per_1k_eur?: number;
  completion_price_per_1k_eur?: number;
};

export type PartnerAICostEstimate = {
  feature: PartnerAIUsageFeature;
  model: string | null;
  prompt_tokens: number;
  completion_tokens: number;
  prompt_price_per_1k_eur: number;
  completion_price_per_1k_eur: number;
  estimated_cost_eur: number;
};

export type PartnerAIBudgetCheckReason =
  | "ok"
  | "blocked"
  | "missing_ledger"
  | "exceeds_budget"
  | "low_balance";

export type PartnerAIBudgetCheckResult = {
  ok: boolean;
  warning: boolean;
  reason: PartnerAIBudgetCheckReason;
  billing_mode: AIBillingMode;
  period_key: string;
  estimated_cost_eur: number;
  available_credit_eur: number | null;
  remaining_after_run_eur: number | null;
};

export type PartnerAICreditsResponse = {
  ok: true;
  period_key: string;
  ledger: PartnerAICreditLedgerRecord | null;
};

export type PartnerAIUsageResponse = {
  ok: true;
  usage_events: PartnerAIUsageEventRecord[];
};

export type PartnerAIEstimateResponse = {
  ok: true;
  estimate: PartnerAICostEstimate;
  budget_check: PartnerAIBudgetCheckResult;
};

export type NetworkPartnerPreviewSyncResource = "offers" | "requests" | "all";
export type NetworkPartnerPreviewSyncMode = "guarded" | "full";
export type NetworkPartnerPreviewSyncItemStatus =
  | "exact_match"
  | "kreis_match"
  | "unresolved_area"
  | "not_booked"
  | "unsupported_type"
  | "invalid_record";

export type NetworkPartnerAreaDebug = {
  input_signals: {
    zip_code: string | null;
    city: string | null;
    district: string | null;
    region: string | null;
    location: string | null;
  };
  candidate_names: string[];
  candidate_slugs: string[];
  candidate_areas: Array<{
    id: string;
    name: string | null;
    slug: string | null;
    parent_slug: string | null;
    bundesland_slug: string | null;
  }>;
  matched_scope: {
    booking_id: string | null;
    area_id: string | null;
    area_name: string | null;
    area_slug: string | null;
    match_kind: "exact_match" | "kreis_match" | null;
  };
  final_reason: string | null;
};

export type NetworkPartnerPreviewSyncItem = {
  source_resource: "offers" | "references" | "requests";
  content_type: "property_offer" | "property_request" | null;
  external_id: string;
  title: string | null;
  provider: string;
  location_label: string | null;
  status: NetworkPartnerPreviewSyncItemStatus;
  area_id: string | null;
  booking_id: string | null;
  matched_area_name: string | null;
  matched_area_slug: string | null;
  reason: string | null;
  area_debug?: NetworkPartnerAreaDebug | null;
  normalized_payload: Record<string, unknown>;
  source_payload: Record<string, unknown>;
};

export type NetworkPartnerPreviewSyncCounts = {
  total: number;
  exact_match: number;
  kreis_match: number;
  unresolved_area: number;
  not_booked: number;
  unsupported_type: number;
  invalid_record: number;
};

export type NetworkPartnerPreviewSyncResult = {
  integration_id: string;
  network_partner_id: string;
  provider: string;
  resource: NetworkPartnerPreviewSyncResource;
  mode: NetworkPartnerPreviewSyncMode;
  booking_scope_count: number;
  counts: NetworkPartnerPreviewSyncCounts;
  items: NetworkPartnerPreviewSyncItem[];
  notes: string[];
  diagnostics: {
    provider_request_count: number | null;
    provider_pages_fetched: number | null;
    sample_limit: number;
    references_fetched: boolean;
    requests_fetched: boolean;
  };
};

export type NetworkPartnerWriteSyncLineStatus = "created" | "updated" | "skipped" | "error";

export type NetworkPartnerWriteSyncLine = {
  external_id: string;
  content_type: "property_offer" | "property_request" | null;
  booking_id: string | null;
  content_item_id: string | null;
  status: NetworkPartnerWriteSyncLineStatus;
  reason: string | null;
  area_debug?: NetworkPartnerAreaDebug | null;
};

export type NetworkPartnerWriteSyncResult = {
  integration_id: string;
  network_partner_id: string;
  provider: string;
  resource: NetworkPartnerPreviewSyncResource;
  mode: NetworkPartnerPreviewSyncMode;
  preview_counts: NetworkPartnerPreviewSyncCounts;
  created_count: number;
  updated_count: number;
  skipped_count: number;
  error_count: number;
  lines: NetworkPartnerWriteSyncLine[];
  notes: string[];
  diagnostics: {
    provider_request_count: number | null;
    provider_pages_fetched: number | null;
    references_fetched: boolean;
    requests_fetched: boolean;
  };
};

export type NetworkPartnerIntegrationSyncRunKind = "test" | "preview" | "sync";
export type NetworkPartnerIntegrationSyncRunStatus = "running" | "ok" | "warning" | "error";

export type NetworkPartnerIntegrationSyncRunRecord = {
  id: string;
  integration_id: string;
  portal_partner_id: string;
  network_partner_id: string;
  run_kind: NetworkPartnerIntegrationSyncRunKind;
  run_mode: NetworkPartnerPreviewSyncMode;
  status: NetworkPartnerIntegrationSyncRunStatus;
  trace_id: string | null;
  summary: Record<string, unknown> | null;
  diagnostics: Record<string, unknown> | null;
  started_at: string;
  finished_at: string | null;
  created_at: string;
};

export type PublicNetworkContentLocaleSource = "primary" | "translation";

export type PublicNetworkContentItem = {
  id: string;
  booking_id: string;
  area_id: string;
  network_partner_id: string;
  network_partner_name: string | null;
  content_type: NetworkContentType;
  slug: string;
  title: string;
  summary: string | null;
  body_md: string | null;
  cta_label: string | null;
  cta_url: string | null;
  locale: string;
  locale_source: PublicNetworkContentLocaleSource;
  primary_locale: string;
  media: NetworkContentMediaRecord[];
  company_profile: NetworkCompanyProfileDetails | null;
  property_offer: NetworkPropertyOfferDetails | null;
  property_request: NetworkPropertyRequestDetails | null;
};

export type PublicNetworkContentCollection = {
  area_id: string;
  locale: string;
  items: PublicNetworkContentItem[];
  company_profiles: PublicNetworkContentItem[];
  property_offers: PublicNetworkContentItem[];
  property_requests: PublicNetworkContentItem[];
};
