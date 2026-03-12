-- partner_local_site_texts (Lokale Website Texte je Partner/Region)
-- Hinweis: Im aktuellen Supabase-Schema-Snapshot ist diese Tabelle nicht standardmaessig vorhanden.
-- Nur ausfuehren, wenn der separate Local-Site-Textkanal aktiv genutzt werden soll.

create table if not exists public.partner_local_site_texts (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id),
  area_id text not null references public.areas(id),
  section_key text not null,
  text_type text,
  raw_content text,
  optimized_content text,
  status text default 'draft',
  last_updated timestamptz default now()
);

create unique index if not exists partner_local_site_texts_unique
  on public.partner_local_site_texts (partner_id, area_id, section_key);

alter table public.partner_local_site_texts enable row level security;

drop policy if exists "partner_local_site_texts_deny_select" on public.partner_local_site_texts;
drop policy if exists "partner_local_site_texts_deny_insert" on public.partner_local_site_texts;
drop policy if exists "partner_local_site_texts_deny_update" on public.partner_local_site_texts;
drop policy if exists "partner_local_site_texts_deny_delete" on public.partner_local_site_texts;

drop policy if exists "partner_local_site_texts_self_select" on public.partner_local_site_texts;
create policy "partner_local_site_texts_self_select"
  on public.partner_local_site_texts
  for select
  using (auth.uid() = partner_id);

drop policy if exists "partner_local_site_texts_self_insert" on public.partner_local_site_texts;
create policy "partner_local_site_texts_self_insert"
  on public.partner_local_site_texts
  for insert
  with check (auth.uid() = partner_id);

drop policy if exists "partner_local_site_texts_self_update" on public.partner_local_site_texts;
create policy "partner_local_site_texts_self_update"
  on public.partner_local_site_texts
  for update
  using (auth.uid() = partner_id)
  with check (auth.uid() = partner_id);

drop policy if exists "partner_local_site_texts_self_delete" on public.partner_local_site_texts;
create policy "partner_local_site_texts_self_delete"
  on public.partner_local_site_texts
  for delete
  using (auth.uid() = partner_id);
