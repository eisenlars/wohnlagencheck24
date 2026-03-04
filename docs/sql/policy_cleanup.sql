-- Policy Cleanup (post hardening)
-- Zweck: Redundante/alte Policy-Namen entfernen, ohne Zielverhalten zu ändern.
-- Voraussetzung: live_rls_hardening.sql wurde bereits erfolgreich ausgeführt.

begin;

-- ---------------------------------------------------------------------------
-- data_value_settings: alte Duplikate entfernen, self_* bleibt bestehen
-- ---------------------------------------------------------------------------
drop policy if exists "data_value_settings_select_own" on public.data_value_settings;
drop policy if exists "data_value_settings_insert_own" on public.data_value_settings;
drop policy if exists "data_value_settings_update_own" on public.data_value_settings;
drop policy if exists "data_value_settings_delete_own" on public.data_value_settings;
drop policy if exists "dvs_select_own" on public.data_value_settings;
drop policy if exists "dvs_update_own" on public.data_value_settings;
drop policy if exists "dvs_insert_service_role" on public.data_value_settings;

-- ---------------------------------------------------------------------------
-- partner_area_map: alte Duplikate entfernen, self_select + deny_* bleibt
-- ---------------------------------------------------------------------------
drop policy if exists "pam_select_own" on public.partner_area_map;
drop policy if exists "pam_insert_service_role" on public.partner_area_map;

-- ---------------------------------------------------------------------------
-- partner_marketing_texts: alte partner_* Duplikate entfernen, self_* bleibt
-- ---------------------------------------------------------------------------
drop policy if exists "partner_marketing_texts_partner_select" on public.partner_marketing_texts;
drop policy if exists "partner_marketing_texts_partner_insert" on public.partner_marketing_texts;
drop policy if exists "partner_marketing_texts_partner_update" on public.partner_marketing_texts;
drop policy if exists "partner_marketing_texts_partner_delete" on public.partner_marketing_texts;

-- ---------------------------------------------------------------------------
-- report_texts: alte *_own Duplikate entfernen, self_* bleibt
-- ---------------------------------------------------------------------------
drop policy if exists "report_texts_select_own" on public.report_texts;
drop policy if exists "report_texts_insert_own" on public.report_texts;
drop policy if exists "report_texts_update_own" on public.report_texts;
drop policy if exists "report_texts_delete_own" on public.report_texts;

commit;

