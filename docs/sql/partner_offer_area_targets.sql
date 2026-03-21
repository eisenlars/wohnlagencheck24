-- Angebots-Gebietszuordnung
-- Ziel:
-- 1) `partner_property_offers` partnergebunden halten
-- 2) lokale Angebotszuordnung separat speichern
-- 3) Grundlage fuer `strict_local`, Karten, Filter und spaeteres KI-Matching schaffen

create table if not exists public.partner_offer_area_targets (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  offer_id uuid not null references public.partner_property_offers(id) on delete cascade,
  area_id text not null references public.areas(id) on delete cascade,
  is_primary boolean not null default false,
  match_source text not null,
  match_confidence text not null check (match_confidence in ('high', 'medium', 'low')),
  score numeric,
  matched_zip_code text,
  matched_city text,
  matched_region text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists partner_offer_area_targets_offer_area_idx
  on public.partner_offer_area_targets (offer_id, area_id);

create index if not exists partner_offer_area_targets_partner_area_idx
  on public.partner_offer_area_targets (partner_id, area_id, is_primary);

create index if not exists partner_offer_area_targets_offer_primary_idx
  on public.partner_offer_area_targets (offer_id, is_primary);

alter table public.partner_offer_area_targets enable row level security;

drop policy if exists "partner_offer_area_targets_public_read" on public.partner_offer_area_targets;
create policy "partner_offer_area_targets_public_read"
  on public.partner_offer_area_targets
  for select
  using (true);

drop policy if exists "partner_offer_area_targets_deny_insert" on public.partner_offer_area_targets;
create policy "partner_offer_area_targets_deny_insert"
  on public.partner_offer_area_targets
  for insert
  with check (false);

drop policy if exists "partner_offer_area_targets_deny_update" on public.partner_offer_area_targets;
create policy "partner_offer_area_targets_deny_update"
  on public.partner_offer_area_targets
  for update
  using (false);

drop policy if exists "partner_offer_area_targets_deny_delete" on public.partner_offer_area_targets;
create policy "partner_offer_area_targets_deny_delete"
  on public.partner_offer_area_targets
  for delete
  using (false);
