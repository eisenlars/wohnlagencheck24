-- crm_raw_references
--
-- Ziel:
-- 1) neue providernahe Rohschicht fuer Referenzobjekte
-- 2) bestehende Canonical-/Public-Funktion nicht beruehren
-- 3) service-role-only / keine direkten Partner- oder Public-Reads

create table if not exists public.crm_raw_references (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
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

create unique index if not exists crm_raw_references_partner_provider_external_unique
  on public.crm_raw_references (partner_id, provider, external_id);

create index if not exists crm_raw_references_partner_provider_active_idx
  on public.crm_raw_references (partner_id, provider, is_active);

create index if not exists crm_raw_references_partner_source_updated_idx
  on public.crm_raw_references (partner_id, source_updated_at desc);

create index if not exists crm_raw_references_partner_last_seen_idx
  on public.crm_raw_references (partner_id, last_seen_at desc);

alter table public.crm_raw_references enable row level security;

drop policy if exists "crm_raw_references_deny_select" on public.crm_raw_references;
create policy "crm_raw_references_deny_select"
  on public.crm_raw_references for select using (false);

drop policy if exists "crm_raw_references_deny_insert" on public.crm_raw_references;
create policy "crm_raw_references_deny_insert"
  on public.crm_raw_references for insert with check (false);

drop policy if exists "crm_raw_references_deny_update" on public.crm_raw_references;
create policy "crm_raw_references_deny_update"
  on public.crm_raw_references for update using (false);

drop policy if exists "crm_raw_references_deny_delete" on public.crm_raw_references;
create policy "crm_raw_references_deny_delete"
  on public.crm_raw_references for delete using (false);
