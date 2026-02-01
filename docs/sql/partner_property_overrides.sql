-- partner_property_overrides (SEO- und Inhalts-Overrides pro Angebot)

create table if not exists public.partner_property_overrides (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id),
  source text not null,
  external_id text not null,
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
  status text default 'draft',
  last_updated timestamptz default now()
);

create unique index if not exists partner_property_overrides_unique
  on public.partner_property_overrides (partner_id, source, external_id);

alter table public.partner_property_overrides enable row level security;

create policy "overrides_public_read"
  on public.partner_property_overrides for select using (true);

create policy "overrides_partner_write"
  on public.partner_property_overrides
  for insert with check (auth.uid() = partner_id);

create policy "overrides_partner_update"
  on public.partner_property_overrides
  for update using (auth.uid() = partner_id);

create policy "overrides_partner_delete"
  on public.partner_property_overrides
  for delete using (auth.uid() = partner_id);
