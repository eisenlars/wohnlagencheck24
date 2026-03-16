-- partner_reference_i18n (Partner-Referenz-Uebersetzungen je Objekt/Sprache)

create table if not exists public.partner_reference_i18n (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references auth.users(id) on delete cascade,
  reference_id uuid not null references public.partner_references(id) on delete cascade,
  area_id text not null,
  source text not null,
  external_id text not null,
  target_locale text not null check (target_locale ~ '^[a-z]{2}(-[a-z]{2})?$'),
  translated_seo_title text,
  translated_seo_description text,
  translated_seo_h1 text,
  translated_short_description text,
  translated_long_description text,
  translated_location_text text,
  translated_features_text text,
  translated_highlights text[] not null default '{}'::text[],
  translated_image_alt_texts text[] not null default '{}'::text[],
  status text not null default 'draft' check (status in ('draft', 'approved', 'needs_review')),
  source_snapshot_hash text,
  source_last_updated timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists partner_reference_i18n_unique
  on public.partner_reference_i18n (partner_id, reference_id, target_locale);

create index if not exists partner_reference_i18n_partner_area_locale_idx
  on public.partner_reference_i18n (partner_id, area_id, target_locale);

alter table public.partner_reference_i18n enable row level security;

drop policy if exists "partner_reference_i18n_self_select" on public.partner_reference_i18n;
create policy "partner_reference_i18n_self_select"
  on public.partner_reference_i18n
  for select
  using (auth.uid() = partner_id);

drop policy if exists "partner_reference_i18n_self_insert" on public.partner_reference_i18n;
create policy "partner_reference_i18n_self_insert"
  on public.partner_reference_i18n
  for insert
  with check (auth.uid() = partner_id);

drop policy if exists "partner_reference_i18n_self_update" on public.partner_reference_i18n;
create policy "partner_reference_i18n_self_update"
  on public.partner_reference_i18n
  for update
  using (auth.uid() = partner_id)
  with check (auth.uid() = partner_id);

drop policy if exists "partner_reference_i18n_self_delete" on public.partner_reference_i18n;
create policy "partner_reference_i18n_self_delete"
  on public.partner_reference_i18n
  for delete
  using (auth.uid() = partner_id);
