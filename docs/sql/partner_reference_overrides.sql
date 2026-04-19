-- partner_reference_overrides (SEO- und Inhalts-Overrides pro Referenzobjekt)

create table if not exists public.partner_reference_overrides (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id),
  source text not null,
  external_id text not null,
  is_active_override boolean,
  seo_title text,
  seo_description text,
  seo_h1 text,
  short_description text,
  long_description text,
  location_text text,
  features_text text,
  image_url text,
  highlights jsonb,
  image_alt_texts jsonb,
  status text default 'draft',
  last_updated timestamptz default now()
);

create unique index if not exists partner_reference_overrides_unique
  on public.partner_reference_overrides (partner_id, source, external_id);

alter table public.partner_reference_overrides enable row level security;

drop policy if exists "reference_overrides_partner_read" on public.partner_reference_overrides;
create policy "reference_overrides_partner_read"
  on public.partner_reference_overrides for select
  using (auth.uid() = partner_id);

drop policy if exists "reference_overrides_partner_insert" on public.partner_reference_overrides;
create policy "reference_overrides_partner_insert"
  on public.partner_reference_overrides for insert
  with check (auth.uid() = partner_id);

drop policy if exists "reference_overrides_partner_update" on public.partner_reference_overrides;
create policy "reference_overrides_partner_update"
  on public.partner_reference_overrides for update
  using (auth.uid() = partner_id);

drop policy if exists "reference_overrides_partner_delete" on public.partner_reference_overrides;
create policy "reference_overrides_partner_delete"
  on public.partner_reference_overrides for delete
  using (auth.uid() = partner_id);
