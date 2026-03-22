-- Portal-CMS fuer globale Sprachen und statische Portalinhalte
-- Oeffentliche Locale-Routen unter /<locale>/... werden aus portal_locale_config
-- abgeleitet. Oeffentlich sichtbar sind nur Locales mit is_active = true und
-- status = 'live'.

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

create table if not exists public.portal_content_i18n_meta (
  page_key text not null,
  section_key text not null,
  locale text not null,
  source_locale text not null default 'de',
  source_snapshot_hash text,
  source_updated_at timestamptz,
  translation_origin text not null default 'manual'
    check (translation_origin in ('manual', 'ai', 'sync_copy_all', 'sync_fill_missing')),
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
