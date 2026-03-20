-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.areas (
  id text NOT NULL,
  name text NOT NULL,
  type text,
  parent_id text,
  slug text,
  parent_slug text,
  bundesland_slug text,
  CONSTRAINT areas_pkey PRIMARY KEY (id)
);
CREATE INDEX areas_bundesland_slug_idx
  ON public.areas (bundesland_slug, slug);
CREATE INDEX areas_bundesland_parent_slug_idx
  ON public.areas (bundesland_slug, parent_slug);
CREATE TABLE public.data_value_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  auth_user_id uuid,
  area_id text,
  price_factor_houses double precision DEFAULT 1.0,
  price_factor_apartments double precision DEFAULT 1.0,
  custom_intro_text text,
  custom_market_report text,
  is_active boolean DEFAULT true,
  last_update timestamp with time zone DEFAULT now(),
  standortfaktoren jsonb DEFAULT '{"bildung": 1, "gesundheit": 1, "mobilitaet": 1, "naherholung": 1, "arbeitsplatz": 1, "nahversorgung": 1, "lebenserhaltungskosten": 1}'::jsonb,
  immobilienmarkt_trend jsonb DEFAULT '{"mietmarkt": 1, "immobilienmarkt": 1}'::jsonb,
  kauf_haus jsonb DEFAULT '{"f01": 1, "f02": 1, "f03": 1, "f04": 1, "f05": 1, "f06": 1}'::jsonb,
  kauf_wohnung jsonb DEFAULT '{"f01": 1, "f02": 1, "f03": 1, "f04": 1, "f05": 1, "f06": 1}'::jsonb,
  kauf_grundstueck jsonb DEFAULT '{"f01": 1, "f02": 1, "f03": 1, "f04": 1, "f05": 1, "f06": 1}'::jsonb,
  miete_haus jsonb DEFAULT '{"f01": 1, "f02": 1, "f03": 1, "f04": 1, "f05": 1, "f06": 1}'::jsonb,
  miete_wohnung jsonb DEFAULT '{"f01": 1, "f02": 1, "f03": 1, "f04": 1, "f05": 1, "f06": 1}'::jsonb,
  rendite jsonb DEFAULT '{"mietrendite_efh": 1, "mietrendite_etw": 1, "mietrendite_mfh": 1, "kaufpreisfaktor_efh": 1, "kaufpreisfaktor_etw": 1, "kaufpreisfaktor_mfh": 1}'::jsonb,
  CONSTRAINT data_value_settings_pkey PRIMARY KEY (id),
  CONSTRAINT data_value_settings_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES public.partners(id),
  CONSTRAINT data_value_settings_area_id_fkey FOREIGN KEY (area_id) REFERENCES public.areas(id)
);
CREATE TABLE public.market_data (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  area_id text,
  reference_date date NOT NULL,
  avg_price_sqm_house double precision,
  avg_price_sqm_apartment double precision,
  purchase_yield double precision,
  vacancy_rate double precision,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT market_data_pkey PRIMARY KEY (id),
  CONSTRAINT market_data_area_id_fkey FOREIGN KEY (area_id) REFERENCES public.areas(id)
);
CREATE TABLE public.partner_area_map (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL,
  area_id text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  activation_status text NOT NULL DEFAULT 'assigned'::text,
  mandatory_checked_at timestamp with time zone,
  mandatory_missing_keys jsonb,
  partner_submitted_at timestamp with time zone,
  is_public_live boolean NOT NULL DEFAULT false,
  admin_review_note text,
  CONSTRAINT partner_area_map_pkey PRIMARY KEY (id),
  CONSTRAINT partner_area_map_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES public.partners(id),
  CONSTRAINT partner_area_map_area_id_fkey FOREIGN KEY (area_id) REFERENCES public.areas(id)
);
CREATE INDEX partner_area_map_area_active_partner_idx
  ON public.partner_area_map (area_id, is_active, auth_user_id);
CREATE INDEX partner_area_map_area_public_partner_idx
  ON public.partner_area_map (area_id, is_public_live, auth_user_id);
CREATE INDEX partner_area_map_partner_public_area_idx
  ON public.partner_area_map (auth_user_id, is_public_live, area_id);
CREATE TABLE public.partners (
  id uuid NOT NULL DEFAULT auth.uid(),
  company_name text NOT NULL,
  contact_person text,
  website_url text,
  created_at timestamp with time zone DEFAULT now(),
  contact_email text,
  is_system_default boolean NOT NULL DEFAULT false,
  CONSTRAINT partners_pkey PRIMARY KEY (id)
);
CREATE TABLE public.report_texts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL,
  area_id text NOT NULL,
  section_key text NOT NULL,
  text_type USER-DEFINED NOT NULL,
  raw_content text,
  optimized_content text,
  status text DEFAULT 'approved'::text,
  last_updated timestamp with time zone DEFAULT now(),
  CONSTRAINT report_texts_pkey PRIMARY KEY (id),
  CONSTRAINT report_texts_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.partners(id),
  CONSTRAINT report_texts_area_id_fkey FOREIGN KEY (area_id) REFERENCES public.areas(id)
);
CREATE INDEX report_texts_approved_area_partner_idx
  ON public.report_texts (area_id, partner_id)
  WHERE (status = 'approved'::text);

-- ------------------------------
-- Lokale Website Texte (partner_local_site_texts)
-- ------------------------------
CREATE TABLE public.partner_local_site_texts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL,
  area_id text NOT NULL,
  section_key text NOT NULL,
  text_type text,
  raw_content text,
  optimized_content text,
  status text DEFAULT 'draft'::text,
  last_updated timestamp with time zone DEFAULT now(),
  CONSTRAINT partner_local_site_texts_pkey PRIMARY KEY (id),
  CONSTRAINT partner_local_site_texts_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.partners(id),
  CONSTRAINT partner_local_site_texts_area_id_fkey FOREIGN KEY (area_id) REFERENCES public.areas(id)
);

CREATE UNIQUE INDEX partner_local_site_texts_unique
  ON public.partner_local_site_texts (partner_id, area_id, section_key);

ALTER TABLE public.partner_local_site_texts ENABLE ROW LEVEL SECURITY;
CREATE POLICY partner_local_site_texts_deny_select
  ON public.partner_local_site_texts FOR SELECT USING (false);
CREATE POLICY partner_local_site_texts_deny_insert
  ON public.partner_local_site_texts FOR INSERT WITH CHECK (false);
CREATE POLICY partner_local_site_texts_deny_update
  ON public.partner_local_site_texts FOR UPDATE USING (false);
CREATE POLICY partner_local_site_texts_deny_delete
  ON public.partner_local_site_texts FOR DELETE USING (false);

-- ------------------------------
-- Online-Marketing Texte (partner_marketing_texts)
-- ------------------------------
CREATE TABLE public.partner_marketing_texts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL,
  area_id text NOT NULL,
  section_key text NOT NULL,
  text_type text,
  raw_content text,
  optimized_content text,
  status text DEFAULT 'draft'::text,
  last_updated timestamp with time zone DEFAULT now(),
  CONSTRAINT partner_marketing_texts_pkey PRIMARY KEY (id),
  CONSTRAINT partner_marketing_texts_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.partners(id),
  CONSTRAINT partner_marketing_texts_area_id_fkey FOREIGN KEY (area_id) REFERENCES public.areas(id)
);

CREATE UNIQUE INDEX partner_marketing_texts_unique
  ON public.partner_marketing_texts (partner_id, area_id, section_key);
CREATE INDEX partner_marketing_texts_approved_area_partner_idx
  ON public.partner_marketing_texts (area_id, partner_id)
  WHERE (status = 'approved'::text);

ALTER TABLE public.partner_marketing_texts ENABLE ROW LEVEL SECURITY;
CREATE POLICY partner_marketing_texts_deny_select
  ON public.partner_marketing_texts FOR SELECT USING (false);
CREATE POLICY partner_marketing_texts_deny_insert
  ON public.partner_marketing_texts FOR INSERT WITH CHECK (false);
CREATE POLICY partner_marketing_texts_deny_update
  ON public.partner_marketing_texts FOR UPDATE USING (false);
CREATE POLICY partner_marketing_texts_deny_delete
  ON public.partner_marketing_texts FOR DELETE USING (false);

-- ------------------------------
-- CRM Integrations (partner_integrations)
-- ------------------------------
CREATE TABLE public.partner_integrations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL,
  kind text NOT NULL,
  provider text NOT NULL,
  base_url text,
  auth_type text,
  auth_config jsonb,
  detail_url_template text,
  is_active boolean DEFAULT true,
  settings jsonb,
  last_sync_at timestamp with time zone,
  CONSTRAINT partner_integrations_pkey PRIMARY KEY (id),
  CONSTRAINT partner_integrations_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.partners(id)
);

-- Unique per partner + kind (crm / llm / other)
CREATE UNIQUE INDEX partner_integrations_kind_unique
  ON public.partner_integrations (partner_id, kind);

-- RLS (deny all for anon/auth; service-role bypasses)
ALTER TABLE public.partner_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY partner_integrations_deny_select
  ON public.partner_integrations FOR SELECT USING (false);
CREATE POLICY partner_integrations_deny_insert
  ON public.partner_integrations FOR INSERT WITH CHECK (false);
CREATE POLICY partner_integrations_deny_update
  ON public.partner_integrations FOR UPDATE USING (false);
CREATE POLICY partner_integrations_deny_delete
  ON public.partner_integrations FOR DELETE USING (false);

-- ------------------------------
-- partner_property_offers extensions
-- ------------------------------
ALTER TABLE public.partner_property_offers
  ADD COLUMN source text,
  ADD COLUMN external_id text;

CREATE UNIQUE INDEX partner_property_offers_ext_idx
  ON public.partner_property_offers (partner_id, source, external_id);

CREATE INDEX partner_property_offers_area_offer_idx
  ON public.partner_property_offers (area_id, offer_type, updated_at);

ALTER TABLE public.partner_property_offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY offers_public_read
  ON public.partner_property_offers FOR SELECT USING (true);
CREATE POLICY offers_deny_insert
  ON public.partner_property_offers FOR INSERT WITH CHECK (false);
CREATE POLICY offers_deny_update
  ON public.partner_property_offers FOR UPDATE USING (false);
CREATE POLICY offers_deny_delete
  ON public.partner_property_offers FOR DELETE USING (false);

-- ------------------------------
-- partner_property_overrides (SEO/Content Overrides)
-- ------------------------------
CREATE TABLE public.partner_property_overrides (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL,
  source text NOT NULL,
  external_id text NOT NULL,
  is_active_override boolean,
  is_top_override boolean,
  seo_title text,
  seo_description text,
  seo_h1 text,
  short_description text,
  long_description text,
  location_text text,
  features_text text,
  highlights jsonb,
  image_alt_texts jsonb,
  status text DEFAULT 'draft'::text,
  last_updated timestamp with time zone DEFAULT now(),
  CONSTRAINT partner_property_overrides_pkey PRIMARY KEY (id),
  CONSTRAINT partner_property_overrides_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.partners(id)
);

CREATE UNIQUE INDEX partner_property_overrides_unique
  ON public.partner_property_overrides (partner_id, source, external_id);

ALTER TABLE public.partner_property_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY overrides_public_read
  ON public.partner_property_overrides FOR SELECT USING (true);
CREATE POLICY overrides_partner_write
  ON public.partner_property_overrides FOR INSERT WITH CHECK (auth.uid() = partner_id);
CREATE POLICY overrides_partner_update
  ON public.partner_property_overrides FOR UPDATE USING (auth.uid() = partner_id);
CREATE POLICY overrides_partner_delete
  ON public.partner_property_overrides FOR DELETE USING (auth.uid() = partner_id);
