-- Portal-CMS fuer globale Sprachen und statische Portalinhalte

create table if not exists public.portal_locale_config (
  locale text primary key,
  status text not null default 'planned'
    check (status in ('planned', 'internal', 'live')),
  partner_bookable boolean not null default false,
  is_active boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.portal_content_entries (
  page_key text not null,
  section_key text not null,
  locale text not null,
  status text not null default 'draft'
    check (status in ('draft', 'internal', 'live')),
  fields_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (page_key, section_key, locale)
);

insert into public.portal_locale_config (locale, status, partner_bookable, is_active)
values
  ('de', 'live', false, true),
  ('en', 'planned', false, false)
on conflict (locale) do update
set
  status = excluded.status,
  partner_bookable = excluded.partner_bookable,
  is_active = excluded.is_active,
  updated_at = now();
