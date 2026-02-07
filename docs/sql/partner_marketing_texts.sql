-- partner_marketing_texts (Online-Marketing Overrides je Partner/Region)

create table if not exists public.partner_marketing_texts (
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

create unique index if not exists partner_marketing_texts_unique
  on public.partner_marketing_texts (partner_id, area_id, section_key);

alter table public.partner_marketing_texts enable row level security;

create policy "partner_marketing_texts_deny_select"
  on public.partner_marketing_texts for select using (false);
create policy "partner_marketing_texts_deny_insert"
  on public.partner_marketing_texts for insert with check (false);
create policy "partner_marketing_texts_deny_update"
  on public.partner_marketing_texts for update using (false);
create policy "partner_marketing_texts_deny_delete"
  on public.partner_marketing_texts for delete using (false);
