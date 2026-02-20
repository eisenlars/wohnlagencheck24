-- partner_listings (CRM-Angebote je Partner, provider-normalisiert)

create table if not exists public.partner_listings (
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

create unique index if not exists partner_listings_partner_provider_external_unique
  on public.partner_listings (partner_id, provider, external_id);

create index if not exists partner_listings_partner_updated_idx
  on public.partner_listings (partner_id, updated_at desc);

create index if not exists partner_listings_sync_status_idx
  on public.partner_listings (sync_status, last_seen_at desc);

alter table public.partner_listings enable row level security;

drop policy if exists "partner_listings_deny_select" on public.partner_listings;
create policy "partner_listings_deny_select"
  on public.partner_listings for select using (false);
drop policy if exists "partner_listings_deny_insert" on public.partner_listings;
create policy "partner_listings_deny_insert"
  on public.partner_listings for insert with check (false);
drop policy if exists "partner_listings_deny_update" on public.partner_listings;
create policy "partner_listings_deny_update"
  on public.partner_listings for update using (false);
drop policy if exists "partner_listings_deny_delete" on public.partner_listings;
create policy "partner_listings_deny_delete"
  on public.partner_listings for delete using (false);
