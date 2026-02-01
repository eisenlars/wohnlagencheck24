-- partner_property_offers extensions (external_id/source + RLS)

alter table public.partner_property_offers
  add column if not exists source text,
  add column if not exists external_id text;

create unique index if not exists partner_property_offers_ext_idx
  on public.partner_property_offers (partner_id, source, external_id);

create index if not exists partner_property_offers_area_offer_idx
  on public.partner_property_offers (area_id, offer_type, updated_at);

alter table public.partner_property_offers enable row level security;

create policy "offers_public_read"
  on public.partner_property_offers for select using (true);

create policy "offers_deny_insert"
  on public.partner_property_offers for insert with check (false);
create policy "offers_deny_update"
  on public.partner_property_offers for update using (false);
create policy "offers_deny_delete"
  on public.partner_property_offers for delete using (false);
