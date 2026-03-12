-- partner_texts_i18n (Partner-Uebersetzungen je Bereich/Sprache)

create table if not exists public.partner_texts_i18n (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references auth.users(id) on delete cascade,
  area_id text not null,
  section_key text not null,
  channel text not null check (channel in ('portal', 'local_site', 'marketing')),
  target_locale text not null check (target_locale ~ '^[a-z]{2}(-[a-z]{2})?$'),
  translated_content text,
  status text not null default 'draft' check (status in ('draft', 'approved', 'needs_review')),
  source_snapshot_hash text,
  source_last_updated timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists partner_texts_i18n_unique
  on public.partner_texts_i18n (partner_id, area_id, section_key, channel, target_locale);

create index if not exists partner_texts_i18n_partner_area_locale_idx
  on public.partner_texts_i18n (partner_id, area_id, target_locale, channel);

alter table public.partner_texts_i18n enable row level security;

drop policy if exists "partner_texts_i18n_self_select" on public.partner_texts_i18n;
create policy "partner_texts_i18n_self_select"
  on public.partner_texts_i18n
  for select
  using (auth.uid() = partner_id);

drop policy if exists "partner_texts_i18n_self_insert" on public.partner_texts_i18n;
create policy "partner_texts_i18n_self_insert"
  on public.partner_texts_i18n
  for insert
  with check (auth.uid() = partner_id);

drop policy if exists "partner_texts_i18n_self_update" on public.partner_texts_i18n;
create policy "partner_texts_i18n_self_update"
  on public.partner_texts_i18n
  for update
  using (auth.uid() = partner_id)
  with check (auth.uid() = partner_id);

drop policy if exists "partner_texts_i18n_self_delete" on public.partner_texts_i18n;
create policy "partner_texts_i18n_self_delete"
  on public.partner_texts_i18n
  for delete
  using (auth.uid() = partner_id);
