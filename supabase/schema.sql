-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.areas (
  id text NOT NULL,
  name text NOT NULL,
  type text,
  parent_id text,
  CONSTRAINT areas_pkey PRIMARY KEY (id)
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
CREATE TABLE public.partner_area_config (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  partner_id uuid,
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
  CONSTRAINT partner_area_config_pkey PRIMARY KEY (id),
  CONSTRAINT partner_area_config_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.partners(id),
  CONSTRAINT partner_area_config_area_id_fkey FOREIGN KEY (area_id) REFERENCES public.areas(id)
);
CREATE TABLE public.partners (
  id uuid NOT NULL DEFAULT auth.uid(),
  company_name text NOT NULL,
  contact_person text,
  website_url text,
  created_at timestamp with time zone DEFAULT now(),
  contact_email text,
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