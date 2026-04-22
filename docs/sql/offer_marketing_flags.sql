-- Offer marketing flags
--
-- Ziel:
-- 1) CRM-Vermarktungskennzeichen providerunabhaengig speichern
-- 2) Canonical-Angebote und Public-Projektionen synchron halten
-- 3) Frontend-Badges aus Public-Daten lesen, ohne providernahe Rohdaten zu brauchen

alter table public.partner_property_offers
  add column if not exists marketing_flags jsonb not null default '[]'::jsonb;

alter table public.public_offer_entries
  add column if not exists marketing_flags jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'partner_property_offers_marketing_flags_array'
  ) then
    alter table public.partner_property_offers
      add constraint partner_property_offers_marketing_flags_array
      check (jsonb_typeof(marketing_flags) = 'array');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'public_offer_entries_marketing_flags_array'
  ) then
    alter table public.public_offer_entries
      add constraint public_offer_entries_marketing_flags_array
      check (jsonb_typeof(marketing_flags) = 'array');
  end if;
end $$;
