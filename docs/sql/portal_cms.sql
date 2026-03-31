-- Portal-CMS fuer globale Sprachen und statische Portalinhalte
-- Oeffentliche Locale-Routen unter /<locale>/... werden aus portal_locale_config
-- abgeleitet. Oeffentlich sichtbar sind nur Locales mit is_active = true und
-- status = 'live'.
-- Partner-Dashboard International nutzt dieselbe Registry ueber partner_bookable
-- + billing_feature_code als Bruecke zu Billing/Feature-Freischaltungen.

create table if not exists public.portal_locale_config (
  locale text primary key,
  status text not null default 'planned'
    check (status in ('planned', 'internal', 'live')),
  partner_bookable boolean not null default false,
  is_active boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.portal_locale_config add column if not exists label_native text;
alter table public.portal_locale_config add column if not exists label_de text;
alter table public.portal_locale_config add column if not exists bcp47_tag text;
alter table public.portal_locale_config add column if not exists fallback_locale text not null default 'de';
alter table public.portal_locale_config add column if not exists text_direction text not null default 'ltr'
  check (text_direction in ('ltr', 'rtl'));
alter table public.portal_locale_config add column if not exists number_locale text;
alter table public.portal_locale_config add column if not exists date_locale text;
alter table public.portal_locale_config add column if not exists currency_code text not null default 'EUR';
alter table public.portal_locale_config add column if not exists billing_feature_code text;

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

create table if not exists public.portal_system_text_entries (
  key text not null,
  locale text not null,
  status text not null default 'draft'
    check (status in ('draft', 'internal', 'live')),
  value_text text not null default '',
  updated_at timestamptz not null default now(),
  primary key (key, locale)
);

create table if not exists public.portal_system_text_i18n_meta (
  key text not null,
  locale text not null,
  source_locale text not null default 'de',
  source_snapshot_hash text,
  source_updated_at timestamptz,
  translation_origin text not null default 'manual'
    check (translation_origin in ('manual', 'ai', 'sync_copy_all', 'sync_fill_missing')),
  updated_at timestamptz not null default now(),
  primary key (key, locale)
);

create table if not exists public.market_explanation_static_text_entries (
  key text not null,
  locale text not null,
  status text not null default 'draft'
    check (status in ('draft', 'internal', 'live')),
  value_text text not null default '',
  updated_at timestamptz not null default now(),
  primary key (key, locale)
);

create table if not exists public.market_explanation_static_text_i18n_meta (
  key text not null,
  locale text not null,
  source_locale text not null default 'de',
  source_snapshot_hash text,
  source_updated_at timestamptz,
  translation_origin text not null default 'manual'
    check (translation_origin in ('manual', 'ai', 'sync_copy_all', 'sync_fill_missing')),
  updated_at timestamptz not null default now(),
  primary key (key, locale)
);

create table if not exists public.admin_area_texts (
  scope_kind text not null
    check (scope_kind in ('bundesland', 'kreis', 'ortslage')),
  scope_key text not null,
  section_key text not null,
  text_type text not null default 'general'
    check (text_type in ('general', 'individual')),
  raw_content text not null default '',
  optimized_content text not null default '',
  status text not null default 'approved'
    check (status in ('draft', 'approved')),
  source_snapshot_hash text,
  source_last_updated timestamptz,
  updated_by text,
  last_updated timestamptz not null default now(),
  primary key (scope_kind, scope_key, section_key)
);

create table if not exists public.admin_area_text_i18n_entries (
  scope_kind text not null
    check (scope_kind in ('bundesland', 'kreis', 'ortslage')),
  scope_key text not null,
  section_key text not null,
  locale text not null,
  status text not null default 'draft'
    check (status in ('draft', 'internal', 'live')),
  value_text text not null default '',
  updated_at timestamptz not null default now(),
  primary key (scope_kind, scope_key, section_key, locale)
);

create table if not exists public.admin_area_text_i18n_meta (
  scope_kind text not null
    check (scope_kind in ('bundesland', 'kreis', 'ortslage')),
  scope_key text not null,
  section_key text not null,
  locale text not null,
  source_locale text not null default 'de',
  source_snapshot_hash text,
  source_updated_at timestamptz,
  translation_origin text not null default 'manual'
    check (translation_origin in ('manual', 'ai', 'sync_copy_all', 'sync_fill_missing')),
  updated_at timestamptz not null default now(),
  primary key (scope_kind, scope_key, section_key, locale)
);

create table if not exists public.market_explanation_faq_entries (
  tab_id text not null
    check (tab_id in ('uebersicht', 'immobilienpreise', 'mietpreise', 'mietrendite', 'wohnmarktsituation', 'grundstueckspreise', 'wohnlagencheck', 'wirtschaft')),
  item_id text not null,
  locale text not null,
  status text not null default 'draft'
    check (status in ('draft', 'internal', 'live')),
  question text not null default '',
  answer text not null default '',
  sort_order integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (tab_id, item_id, locale)
);

create table if not exists public.market_explanation_faq_i18n_meta (
  tab_id text not null
    check (tab_id in ('uebersicht', 'immobilienpreise', 'mietpreise', 'mietrendite', 'wohnmarktsituation', 'grundstueckspreise', 'wohnlagencheck', 'wirtschaft')),
  item_id text not null,
  locale text not null,
  source_locale text not null default 'de',
  source_snapshot_hash text,
  source_updated_at timestamptz,
  translation_origin text not null default 'manual'
    check (translation_origin in ('manual', 'ai', 'sync_copy_all', 'sync_fill_missing')),
  updated_at timestamptz not null default now(),
  primary key (tab_id, item_id, locale)
);

-- Partner-Runtime-Layer fuer Kreis/Ortslage
-- Storage-Reports bleiben Base; partnerbezogene Rebuild-Ergebnisse liegen in der DB.
create table if not exists public.partner_area_runtime_states (
  partner_id text not null,
  area_id text not null,
  scope text not null
    check (scope in ('kreis', 'ortslage')),
  factors_snapshot jsonb not null default '{}'::jsonb,
  data_json jsonb not null default '{}'::jsonb,
  textgen_inputs_json jsonb not null default '{}'::jsonb,
  helpers_json jsonb not null default '{}'::jsonb,
  rebuilt_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (partner_id, area_id, scope)
);

create table if not exists public.partner_area_generated_texts (
  partner_id text not null,
  area_id text not null,
  scope text not null
    check (scope in ('kreis', 'ortslage')),
  section_key text not null,
  value_text text not null default '',
  source_signature text,
  updated_at timestamptz not null default now(),
  primary key (partner_id, area_id, scope, section_key)
);

create index if not exists partner_area_runtime_states_area_idx
  on public.partner_area_runtime_states (area_id, scope);

create index if not exists partner_area_generated_texts_area_idx
  on public.partner_area_generated_texts (area_id, scope);

insert into public.portal_locale_config (
  locale,
  status,
  partner_bookable,
  is_active,
  label_native,
  label_de,
  bcp47_tag,
  fallback_locale,
  text_direction,
  number_locale,
  date_locale,
  currency_code,
  billing_feature_code
)
values
  ('de', 'live', false, true, 'Deutsch', 'Deutsch', 'de-DE', 'de', 'ltr', 'de-DE', 'de-DE', 'EUR', 'international'),
  ('en', 'planned', false, false, 'English', 'Englisch', 'en-US', 'de', 'ltr', 'en-US', 'en-US', 'EUR', 'international_en')
on conflict (locale) do update
set
  status = excluded.status,
  partner_bookable = excluded.partner_bookable,
  is_active = excluded.is_active,
  label_native = coalesce(public.portal_locale_config.label_native, excluded.label_native),
  label_de = coalesce(public.portal_locale_config.label_de, excluded.label_de),
  bcp47_tag = coalesce(public.portal_locale_config.bcp47_tag, excluded.bcp47_tag),
  fallback_locale = coalesce(public.portal_locale_config.fallback_locale, excluded.fallback_locale),
  text_direction = coalesce(public.portal_locale_config.text_direction, excluded.text_direction),
  number_locale = coalesce(public.portal_locale_config.number_locale, excluded.number_locale),
  date_locale = coalesce(public.portal_locale_config.date_locale, excluded.date_locale),
  currency_code = coalesce(public.portal_locale_config.currency_code, excluded.currency_code),
  billing_feature_code = coalesce(public.portal_locale_config.billing_feature_code, excluded.billing_feature_code),
  updated_at = now();

comment on table public.portal_system_text_entries is
  'Portalweite Systemtexte pro Locale. Oeffentlich zaehlt nur status=live.';

comment on table public.portal_system_text_i18n_meta is
  'Quelle und Veraltungsstatus fuer uebersetzte Portal-Systemtexte.';

comment on table public.market_explanation_static_text_entries is
  'Portalweite statische Markterklaerungstexte pro Locale. Oeffentlich zaehlt nur status=live.';

comment on table public.market_explanation_static_text_i18n_meta is
  'Quelle und Verwaltungsstatus fuer uebersetzte statische Markterklaerungstexte.';

comment on table public.admin_area_texts is
  'Admin-Overrides fuer portalverantwortete Gebietstexte auf Bundesland-, Kreis- und Ortslagenebene.';

comment on table public.admin_area_text_i18n_entries is
  'Mehrsprachige Admin-Overrides fuer portalverantwortete Gebietstexte auf Bundesland-, Kreis- und Ortslagenebene.';

comment on table public.admin_area_text_i18n_meta is
  'Quellbezug und Uebersetzungsstatus fuer mehrsprachige Admin-Gebietstexte.';

comment on table public.market_explanation_faq_entries is
  'Dynamische FAQ-Eintraege pro Markterklaerungs-Themen-Tab und Locale.';

comment on table public.market_explanation_faq_i18n_meta is
  'Quellbezug und Uebersetzungsstatus fuer dynamische Markterklaerungs-FAQ.';

comment on table public.partner_area_runtime_states is
  'Partnerbezogene Runtime-Snapshots fuer faktorisierte Gebietsdaten, textgen_inputs und helper state. Storage-Reports bleiben damit Base.';

comment on table public.partner_area_generated_texts is
  'Partnerbezogene data-driven Texte pro Gebiet als DB-Layer ueber dem neutralen Storage-Report.';
