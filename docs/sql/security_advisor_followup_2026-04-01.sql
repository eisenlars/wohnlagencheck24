-- Security Advisor Follow-up (2026-04-01)
-- Scope:
-- 1) RLS fuer neue public-Tabellen aktivieren, die nur serverseitig per service_role genutzt werden.
-- 2) Direkten Zugriff fuer anon/authenticated auf diese Tabellen explizit sperren.
-- Hinweis:
-- service_role umgeht RLS weiterhin. Die bestehenden Admin-/Server-Flows bleiben daher funktionsfaehig.

begin;

alter table public.partner_area_runtime_states enable row level security;
alter table public.partner_area_generated_texts enable row level security;
alter table public.integration_sync_runs enable row level security;
alter table public.admin_area_text_i18n_entries enable row level security;
alter table public.admin_area_text_i18n_meta enable row level security;
alter table public.market_explanation_faq_entries enable row level security;
alter table public.market_explanation_faq_i18n_meta enable row level security;

drop policy if exists partner_area_runtime_states_deny_select on public.partner_area_runtime_states;
create policy partner_area_runtime_states_deny_select
  on public.partner_area_runtime_states
  for select
  using (false);

drop policy if exists partner_area_runtime_states_deny_insert on public.partner_area_runtime_states;
create policy partner_area_runtime_states_deny_insert
  on public.partner_area_runtime_states
  for insert
  with check (false);

drop policy if exists partner_area_runtime_states_deny_update on public.partner_area_runtime_states;
create policy partner_area_runtime_states_deny_update
  on public.partner_area_runtime_states
  for update
  using (false);

drop policy if exists partner_area_runtime_states_deny_delete on public.partner_area_runtime_states;
create policy partner_area_runtime_states_deny_delete
  on public.partner_area_runtime_states
  for delete
  using (false);

drop policy if exists partner_area_generated_texts_deny_select on public.partner_area_generated_texts;
create policy partner_area_generated_texts_deny_select
  on public.partner_area_generated_texts
  for select
  using (false);

drop policy if exists partner_area_generated_texts_deny_insert on public.partner_area_generated_texts;
create policy partner_area_generated_texts_deny_insert
  on public.partner_area_generated_texts
  for insert
  with check (false);

drop policy if exists partner_area_generated_texts_deny_update on public.partner_area_generated_texts;
create policy partner_area_generated_texts_deny_update
  on public.partner_area_generated_texts
  for update
  using (false);

drop policy if exists partner_area_generated_texts_deny_delete on public.partner_area_generated_texts;
create policy partner_area_generated_texts_deny_delete
  on public.partner_area_generated_texts
  for delete
  using (false);

drop policy if exists integration_sync_runs_deny_select on public.integration_sync_runs;
create policy integration_sync_runs_deny_select
  on public.integration_sync_runs
  for select
  using (false);

drop policy if exists integration_sync_runs_deny_insert on public.integration_sync_runs;
create policy integration_sync_runs_deny_insert
  on public.integration_sync_runs
  for insert
  with check (false);

drop policy if exists integration_sync_runs_deny_update on public.integration_sync_runs;
create policy integration_sync_runs_deny_update
  on public.integration_sync_runs
  for update
  using (false);

drop policy if exists integration_sync_runs_deny_delete on public.integration_sync_runs;
create policy integration_sync_runs_deny_delete
  on public.integration_sync_runs
  for delete
  using (false);

drop policy if exists admin_area_text_i18n_entries_deny_select on public.admin_area_text_i18n_entries;
create policy admin_area_text_i18n_entries_deny_select
  on public.admin_area_text_i18n_entries
  for select
  using (false);

drop policy if exists admin_area_text_i18n_entries_deny_insert on public.admin_area_text_i18n_entries;
create policy admin_area_text_i18n_entries_deny_insert
  on public.admin_area_text_i18n_entries
  for insert
  with check (false);

drop policy if exists admin_area_text_i18n_entries_deny_update on public.admin_area_text_i18n_entries;
create policy admin_area_text_i18n_entries_deny_update
  on public.admin_area_text_i18n_entries
  for update
  using (false);

drop policy if exists admin_area_text_i18n_entries_deny_delete on public.admin_area_text_i18n_entries;
create policy admin_area_text_i18n_entries_deny_delete
  on public.admin_area_text_i18n_entries
  for delete
  using (false);

drop policy if exists admin_area_text_i18n_meta_deny_select on public.admin_area_text_i18n_meta;
create policy admin_area_text_i18n_meta_deny_select
  on public.admin_area_text_i18n_meta
  for select
  using (false);

drop policy if exists admin_area_text_i18n_meta_deny_insert on public.admin_area_text_i18n_meta;
create policy admin_area_text_i18n_meta_deny_insert
  on public.admin_area_text_i18n_meta
  for insert
  with check (false);

drop policy if exists admin_area_text_i18n_meta_deny_update on public.admin_area_text_i18n_meta;
create policy admin_area_text_i18n_meta_deny_update
  on public.admin_area_text_i18n_meta
  for update
  using (false);

drop policy if exists admin_area_text_i18n_meta_deny_delete on public.admin_area_text_i18n_meta;
create policy admin_area_text_i18n_meta_deny_delete
  on public.admin_area_text_i18n_meta
  for delete
  using (false);

drop policy if exists market_explanation_faq_entries_deny_select on public.market_explanation_faq_entries;
create policy market_explanation_faq_entries_deny_select
  on public.market_explanation_faq_entries
  for select
  using (false);

drop policy if exists market_explanation_faq_entries_deny_insert on public.market_explanation_faq_entries;
create policy market_explanation_faq_entries_deny_insert
  on public.market_explanation_faq_entries
  for insert
  with check (false);

drop policy if exists market_explanation_faq_entries_deny_update on public.market_explanation_faq_entries;
create policy market_explanation_faq_entries_deny_update
  on public.market_explanation_faq_entries
  for update
  using (false);

drop policy if exists market_explanation_faq_entries_deny_delete on public.market_explanation_faq_entries;
create policy market_explanation_faq_entries_deny_delete
  on public.market_explanation_faq_entries
  for delete
  using (false);

drop policy if exists market_explanation_faq_i18n_meta_deny_select on public.market_explanation_faq_i18n_meta;
create policy market_explanation_faq_i18n_meta_deny_select
  on public.market_explanation_faq_i18n_meta
  for select
  using (false);

drop policy if exists market_explanation_faq_i18n_meta_deny_insert on public.market_explanation_faq_i18n_meta;
create policy market_explanation_faq_i18n_meta_deny_insert
  on public.market_explanation_faq_i18n_meta
  for insert
  with check (false);

drop policy if exists market_explanation_faq_i18n_meta_deny_update on public.market_explanation_faq_i18n_meta;
create policy market_explanation_faq_i18n_meta_deny_update
  on public.market_explanation_faq_i18n_meta
  for update
  using (false);

drop policy if exists market_explanation_faq_i18n_meta_deny_delete on public.market_explanation_faq_i18n_meta;
create policy market_explanation_faq_i18n_meta_deny_delete
  on public.market_explanation_faq_i18n_meta
  for delete
  using (false);

commit;
