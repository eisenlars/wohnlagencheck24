-- Partner Billing Management (Portalabo + Features)
-- Run once in target DB (Supabase SQL Editor).

create table if not exists public.billing_global_defaults (
  id integer primary key default 1 check (id = 1),
  portal_base_price_eur numeric(12,2) not null default 50.00,
  portal_ortslage_price_eur numeric(12,2) not null default 1.00,
  portal_export_ortslage_price_eur numeric(12,2) not null default 1.00,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (portal_base_price_eur >= 0),
  check (portal_ortslage_price_eur >= 0),
  check (portal_export_ortslage_price_eur >= 0)
);

insert into public.billing_global_defaults (
  id,
  portal_base_price_eur,
  portal_ortslage_price_eur,
  portal_export_ortslage_price_eur
)
values (1, 50.00, 1.00, 1.00)
on conflict (id) do nothing;

create table if not exists public.billing_feature_catalog (
  code text primary key,
  label text not null,
  note text,
  billing_unit text not null default 'pro Monat',
  default_enabled boolean not null default false,
  default_monthly_price_eur numeric(12,2) not null default 0.00,
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (default_monthly_price_eur >= 0)
);

insert into public.billing_feature_catalog (code, label, note, billing_unit, default_enabled, default_monthly_price_eur, sort_order, is_active)
values
  ('immobilien', 'Immobilienabbildung', 'Objektdaten aus angebundenem CRM.', 'pro Monat', true, 5.00, 10, true),
  ('gesuche', 'Gesuche', 'Suchprofile aus angebundenem CRM.', 'pro Monat', true, 5.00, 20, true),
  ('referenzen', 'Referenzen', 'Referenzobjekte aus angebundenem CRM.', 'pro Monat', true, 5.00, 30, true),
  ('international', 'International', 'Mehrsprachige Ausspielung je Sprache.', 'pro Sprache / Monat', false, 5.00, 40, true),
  ('social_media', 'Social-Media', 'Schnittstellen und Content-Ausspielung.', 'pro Monat', false, 5.00, 50, true),
  ('portal_monetarisierung', 'Portalmonetarisierung', 'Monetarisierungsfunktionen im Portal.', 'pro Monat', false, 5.00, 60, true),
  ('prognosemonitor', 'Prognosemonitor', 'Erweiterter Monitoring-/Prognosebereich.', 'pro Monat', false, 5.00, 70, true)
on conflict (code) do nothing;

create table if not exists public.partner_billing_settings (
  partner_id uuid primary key references public.partners(id) on delete cascade,
  portal_base_price_eur numeric(12,2),
  portal_ortslage_price_eur numeric(12,2),
  portal_export_ortslage_price_eur numeric(12,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (portal_base_price_eur is null or portal_base_price_eur >= 0),
  check (portal_ortslage_price_eur is null or portal_ortslage_price_eur >= 0),
  check (portal_export_ortslage_price_eur is null or portal_export_ortslage_price_eur >= 0)
);

create table if not exists public.partner_feature_overrides (
  partner_id uuid not null references public.partners(id) on delete cascade,
  feature_code text not null references public.billing_feature_catalog(code) on delete cascade,
  is_enabled boolean,
  monthly_price_eur numeric(12,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (partner_id, feature_code),
  check (monthly_price_eur is null or monthly_price_eur >= 0)
);

create index if not exists partner_feature_overrides_partner_idx
  on public.partner_feature_overrides (partner_id);

-- RLS hardening: service-role only via API routes.
alter table public.billing_global_defaults enable row level security;
alter table public.billing_feature_catalog enable row level security;
alter table public.partner_billing_settings enable row level security;
alter table public.partner_feature_overrides enable row level security;

drop policy if exists "billing_global_defaults_deny_select" on public.billing_global_defaults;
create policy "billing_global_defaults_deny_select" on public.billing_global_defaults for select using (false);
drop policy if exists "billing_global_defaults_deny_insert" on public.billing_global_defaults;
create policy "billing_global_defaults_deny_insert" on public.billing_global_defaults for insert with check (false);
drop policy if exists "billing_global_defaults_deny_update" on public.billing_global_defaults;
create policy "billing_global_defaults_deny_update" on public.billing_global_defaults for update using (false);
drop policy if exists "billing_global_defaults_deny_delete" on public.billing_global_defaults;
create policy "billing_global_defaults_deny_delete" on public.billing_global_defaults for delete using (false);

drop policy if exists "billing_feature_catalog_deny_select" on public.billing_feature_catalog;
create policy "billing_feature_catalog_deny_select" on public.billing_feature_catalog for select using (false);
drop policy if exists "billing_feature_catalog_deny_insert" on public.billing_feature_catalog;
create policy "billing_feature_catalog_deny_insert" on public.billing_feature_catalog for insert with check (false);
drop policy if exists "billing_feature_catalog_deny_update" on public.billing_feature_catalog;
create policy "billing_feature_catalog_deny_update" on public.billing_feature_catalog for update using (false);
drop policy if exists "billing_feature_catalog_deny_delete" on public.billing_feature_catalog;
create policy "billing_feature_catalog_deny_delete" on public.billing_feature_catalog for delete using (false);

drop policy if exists "partner_billing_settings_deny_select" on public.partner_billing_settings;
create policy "partner_billing_settings_deny_select" on public.partner_billing_settings for select using (false);
drop policy if exists "partner_billing_settings_deny_insert" on public.partner_billing_settings;
create policy "partner_billing_settings_deny_insert" on public.partner_billing_settings for insert with check (false);
drop policy if exists "partner_billing_settings_deny_update" on public.partner_billing_settings;
create policy "partner_billing_settings_deny_update" on public.partner_billing_settings for update using (false);
drop policy if exists "partner_billing_settings_deny_delete" on public.partner_billing_settings;
create policy "partner_billing_settings_deny_delete" on public.partner_billing_settings for delete using (false);

drop policy if exists "partner_feature_overrides_deny_select" on public.partner_feature_overrides;
create policy "partner_feature_overrides_deny_select" on public.partner_feature_overrides for select using (false);
drop policy if exists "partner_feature_overrides_deny_insert" on public.partner_feature_overrides;
create policy "partner_feature_overrides_deny_insert" on public.partner_feature_overrides for insert with check (false);
drop policy if exists "partner_feature_overrides_deny_update" on public.partner_feature_overrides;
create policy "partner_feature_overrides_deny_update" on public.partner_feature_overrides for update using (false);
drop policy if exists "partner_feature_overrides_deny_delete" on public.partner_feature_overrides;
create policy "partner_feature_overrides_deny_delete" on public.partner_feature_overrides for delete using (false);
