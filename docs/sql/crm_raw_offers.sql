-- crm_raw_offers
--
-- Ziel:
-- 1) providernahe Rohschicht fuer Angebotsobjekte
-- 2) bestehende Canonical-/Public-Funktion in `partner_property_offers` nicht beruehren
-- 3) service-role-only / keine direkten Partner- oder Public-Reads

create table if not exists public.crm_raw_offers (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id),
  provider text not null,
  external_id text not null,
  title text,
  status text,
  source_updated_at timestamptz,
  normalized_payload jsonb not null default '{}'::jsonb,
  source_payload jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  sync_status text not null default 'ok',
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists crm_raw_offers_partner_provider_external_unique
  on public.crm_raw_offers (partner_id, provider, external_id);

create index if not exists crm_raw_offers_partner_updated_idx
  on public.crm_raw_offers (partner_id, updated_at desc);

create index if not exists crm_raw_offers_sync_status_idx
  on public.crm_raw_offers (sync_status, last_seen_at desc);

alter table public.crm_raw_offers enable row level security;

drop policy if exists "crm_raw_offers_deny_select" on public.crm_raw_offers;
create policy "crm_raw_offers_deny_select"
  on public.crm_raw_offers for select using (false);
drop policy if exists "crm_raw_offers_deny_insert" on public.crm_raw_offers;
create policy "crm_raw_offers_deny_insert"
  on public.crm_raw_offers for insert with check (false);
drop policy if exists "crm_raw_offers_deny_update" on public.crm_raw_offers;
create policy "crm_raw_offers_deny_update"
  on public.crm_raw_offers for update using (false);
drop policy if exists "crm_raw_offers_deny_delete" on public.crm_raw_offers;
create policy "crm_raw_offers_deny_delete"
  on public.crm_raw_offers for delete using (false);
