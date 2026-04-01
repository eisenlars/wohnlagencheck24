-- Performance Follow-up (2026-04-01)
-- Fokus:
-- 1) schnellere Lookups fuer neue i18n-/FAQ-Tabellen
-- 2) schnellere Updates auf integration_sync_runs
-- Hinweis:
-- Diese Indizes sind fuer bestehende Umgebungen gedacht.
-- CONCURRENTLY vermeidet harte Schreibblockaden, darf aber nicht in einer Transaktion laufen.

create index concurrently if not exists admin_area_text_i18n_entries_lookup_idx
  on public.admin_area_text_i18n_entries (scope_kind, scope_key, locale, section_key);

create index concurrently if not exists admin_area_text_i18n_entries_live_lookup_idx
  on public.admin_area_text_i18n_entries (scope_kind, scope_key, locale, section_key)
  where status = 'live';

create index concurrently if not exists admin_area_text_i18n_meta_lookup_idx
  on public.admin_area_text_i18n_meta (scope_kind, scope_key, locale, section_key);

create index concurrently if not exists market_explanation_faq_entries_admin_idx
  on public.market_explanation_faq_entries (tab_id, locale, sort_order, item_id);

create index concurrently if not exists market_explanation_faq_entries_live_idx
  on public.market_explanation_faq_entries (tab_id, sort_order, item_id, locale)
  where status = 'live';

create index concurrently if not exists market_explanation_faq_i18n_meta_lookup_idx
  on public.market_explanation_faq_i18n_meta (tab_id, locale, item_id);

create index concurrently if not exists integration_sync_runs_integration_sync_job_idx
  on public.integration_sync_runs (integration_id, sync_job_id);
