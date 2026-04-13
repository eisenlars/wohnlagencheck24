-- Public asset projections
-- Ziel:
-- 1) oeffentliche Ausspielung von Angeboten, Gesuchen und Referenzen
--    von den Roh-/CRM-Tabellen entkoppeln
-- 2) nur freigegebene, oeffentlich zulaessige Felder in Public-Tabellen halten
-- 3) locale-spezifische Live-Projektionen zentral bereitstellen

create table if not exists public.public_offer_entries (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  visible_area_id text not null references public.areas(id) on delete cascade,
  locale text not null check (locale ~ '^[a-z]{2}(-[a-z]{2})?$'),
  offer_id uuid not null references public.partner_property_offers(id) on delete cascade,
  source text not null,
  external_id text not null,
  offer_type text not null,
  object_type text,
  title text,
  seo_title text,
  seo_description text,
  seo_h1 text,
  short_description text,
  long_description text,
  location_text text,
  features_text text,
  highlights jsonb not null default '[]'::jsonb,
  image_alt_texts jsonb not null default '[]'::jsonb,
  price numeric,
  rent numeric,
  area_sqm numeric,
  rooms numeric,
  address text,
  image_url text,
  detail_url text,
  is_top boolean not null default false,
  is_live boolean not null default true,
  source_updated_at timestamptz,
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists public_offer_entries_unique
  on public.public_offer_entries (partner_id, offer_id, visible_area_id, locale);

create index if not exists public_offer_entries_area_locale_offer_idx
  on public.public_offer_entries (visible_area_id, locale, offer_type, updated_at desc);

create index if not exists public_offer_entries_live_feed_idx
  on public.public_offer_entries (visible_area_id, locale, offer_type, is_top, source_updated_at desc)
  where is_live = true;

create table if not exists public.public_request_entries (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  visible_area_id text not null references public.areas(id) on delete cascade,
  locale text not null check (locale ~ '^[a-z]{2}(-[a-z]{2})?$'),
  request_id uuid not null references public.partner_requests(id) on delete cascade,
  provider text not null,
  external_id text not null,
  request_type text not null,
  object_type text,
  object_subtype text,
  title text,
  seo_title text,
  seo_description text,
  seo_h1 text,
  short_description text,
  long_description text,
  location_text text,
  features_text text,
  highlights jsonb not null default '[]'::jsonb,
  image_alt_texts jsonb not null default '[]'::jsonb,
  request_image_catalog_id text,
  min_rooms numeric,
  max_rooms numeric,
  min_area_sqm numeric,
  max_area_sqm numeric,
  min_living_area_sqm numeric,
  max_living_area_sqm numeric,
  min_price numeric,
  max_price numeric,
  radius_km numeric,
  region_targets jsonb not null default '[]'::jsonb,
  region_target_keys jsonb not null default '[]'::jsonb,
  is_live boolean not null default true,
  source_updated_at timestamptz,
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists public_request_entries_unique
  on public.public_request_entries (partner_id, request_id, visible_area_id, locale);

create index if not exists public_request_entries_area_locale_type_idx
  on public.public_request_entries (visible_area_id, locale, request_type, updated_at desc);

create index if not exists public_request_entries_live_feed_idx
  on public.public_request_entries (visible_area_id, locale, source_updated_at desc)
  where is_live = true;

create table if not exists public.public_reference_entries (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  visible_area_id text not null references public.areas(id) on delete cascade,
  locale text not null check (locale ~ '^[a-z]{2}(-[a-z]{2})?$'),
  reference_id uuid not null references public.partner_references(id) on delete cascade,
  provider text not null,
  external_id text not null,
  title text,
  seo_title text,
  seo_description text,
  seo_h1 text,
  short_description text,
  long_description text,
  location_text text,
  features_text text,
  highlights jsonb not null default '[]'::jsonb,
  image_alt_texts jsonb not null default '[]'::jsonb,
  description text,
  image_url text,
  city text,
  district text,
  is_live boolean not null default true,
  source_updated_at timestamptz,
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists public_reference_entries_unique
  on public.public_reference_entries (partner_id, reference_id, visible_area_id, locale);

create index if not exists public_reference_entries_area_locale_updated_idx
  on public.public_reference_entries (visible_area_id, locale, updated_at desc);

create index if not exists public_reference_entries_live_feed_idx
  on public.public_reference_entries (visible_area_id, locale, source_updated_at desc)
  where is_live = true;

alter table public.public_offer_entries enable row level security;
alter table public.public_request_entries enable row level security;
alter table public.public_reference_entries enable row level security;

drop policy if exists "public_offer_entries_read_live" on public.public_offer_entries;
create policy "public_offer_entries_read_live"
  on public.public_offer_entries
  for select
  using (is_live = true);

drop policy if exists "public_request_entries_read_live" on public.public_request_entries;
create policy "public_request_entries_read_live"
  on public.public_request_entries
  for select
  using (is_live = true);

drop policy if exists "public_reference_entries_read_live" on public.public_reference_entries;
create policy "public_reference_entries_read_live"
  on public.public_reference_entries
  for select
  using (is_live = true);

drop policy if exists "public_offer_entries_deny_insert" on public.public_offer_entries;
create policy "public_offer_entries_deny_insert"
  on public.public_offer_entries
  for insert
  with check (false);

drop policy if exists "public_offer_entries_deny_update" on public.public_offer_entries;
create policy "public_offer_entries_deny_update"
  on public.public_offer_entries
  for update
  using (false);

drop policy if exists "public_offer_entries_deny_delete" on public.public_offer_entries;
create policy "public_offer_entries_deny_delete"
  on public.public_offer_entries
  for delete
  using (false);

drop policy if exists "public_request_entries_deny_insert" on public.public_request_entries;
create policy "public_request_entries_deny_insert"
  on public.public_request_entries
  for insert
  with check (false);

drop policy if exists "public_request_entries_deny_update" on public.public_request_entries;
create policy "public_request_entries_deny_update"
  on public.public_request_entries
  for update
  using (false);

drop policy if exists "public_request_entries_deny_delete" on public.public_request_entries;
create policy "public_request_entries_deny_delete"
  on public.public_request_entries
  for delete
  using (false);

drop policy if exists "public_reference_entries_deny_insert" on public.public_reference_entries;
create policy "public_reference_entries_deny_insert"
  on public.public_reference_entries
  for insert
  with check (false);

drop policy if exists "public_reference_entries_deny_update" on public.public_reference_entries;
create policy "public_reference_entries_deny_update"
  on public.public_reference_entries
  for update
  using (false);

drop policy if exists "public_reference_entries_deny_delete" on public.public_reference_entries;
create policy "public_reference_entries_deny_delete"
  on public.public_reference_entries
  for delete
  using (false);
