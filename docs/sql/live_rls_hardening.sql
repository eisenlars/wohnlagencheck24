-- Live RLS Hardening (idempotent)
-- Ziel:
-- 1) Partner-spezifische Tabellen auf "own row access" haerten
-- 2) alte deny-all Policies ersetzen, die Client-Flows blockieren
-- 3) fehlende Unique-Indizes fuer sichere Upserts ergaenzen

begin;

-- -----------------------------------------------------------------------------
-- 0) Idempotente Upsert-Indizes (wichtig fuer onConflict im Frontend)
-- -----------------------------------------------------------------------------
create unique index if not exists data_value_settings_user_area_unique
  on public.data_value_settings (auth_user_id, area_id);

create unique index if not exists report_texts_partner_area_section_unique
  on public.report_texts (partner_id, area_id, section_key);

create unique index if not exists partner_marketing_texts_unique
  on public.partner_marketing_texts (partner_id, area_id, section_key);

-- Optional/legacy table (exists not guaranteed in every env)
do $$
begin
  if to_regclass('public.partner_local_site_texts') is not null then
    execute 'create unique index if not exists partner_local_site_texts_unique on public.partner_local_site_texts (partner_id, area_id, section_key)';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 1) partners: user can read/update only own profile row
-- -----------------------------------------------------------------------------
alter table public.partners enable row level security;

drop policy if exists "partners_self_select" on public.partners;
create policy "partners_self_select"
  on public.partners
  for select
  using (auth.uid() = id);

drop policy if exists "partners_self_update" on public.partners;
create policy "partners_self_update"
  on public.partners
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "partners_deny_insert" on public.partners;
create policy "partners_deny_insert"
  on public.partners
  for insert
  with check (false);

drop policy if exists "partners_deny_delete" on public.partners;
create policy "partners_deny_delete"
  on public.partners
  for delete
  using (false);

-- -----------------------------------------------------------------------------
-- 2) partner_area_map: user can read only own assignments
-- -----------------------------------------------------------------------------
alter table public.partner_area_map enable row level security;

drop policy if exists "partner_area_map_self_select" on public.partner_area_map;
create policy "partner_area_map_self_select"
  on public.partner_area_map
  for select
  using (auth.uid() = auth_user_id);

drop policy if exists "partner_area_map_deny_insert" on public.partner_area_map;
create policy "partner_area_map_deny_insert"
  on public.partner_area_map
  for insert
  with check (false);

drop policy if exists "partner_area_map_deny_update" on public.partner_area_map;
create policy "partner_area_map_deny_update"
  on public.partner_area_map
  for update
  using (false);

drop policy if exists "partner_area_map_deny_delete" on public.partner_area_map;
create policy "partner_area_map_deny_delete"
  on public.partner_area_map
  for delete
  using (false);

-- -----------------------------------------------------------------------------
-- 3) data_value_settings: own-row read/write
-- -----------------------------------------------------------------------------
alter table public.data_value_settings enable row level security;

drop policy if exists "data_value_settings_self_select" on public.data_value_settings;
create policy "data_value_settings_self_select"
  on public.data_value_settings
  for select
  using (auth.uid() = auth_user_id);

drop policy if exists "data_value_settings_self_insert" on public.data_value_settings;
create policy "data_value_settings_self_insert"
  on public.data_value_settings
  for insert
  with check (auth.uid() = auth_user_id);

drop policy if exists "data_value_settings_self_update" on public.data_value_settings;
create policy "data_value_settings_self_update"
  on public.data_value_settings
  for update
  using (auth.uid() = auth_user_id)
  with check (auth.uid() = auth_user_id);

drop policy if exists "data_value_settings_self_delete" on public.data_value_settings;
create policy "data_value_settings_self_delete"
  on public.data_value_settings
  for delete
  using (auth.uid() = auth_user_id);

-- -----------------------------------------------------------------------------
-- 4) report_texts: own-row read/write
-- -----------------------------------------------------------------------------
alter table public.report_texts enable row level security;

drop policy if exists "public read report_texts" on public.report_texts;
drop policy if exists "report_texts_select_approved" on public.report_texts;

drop policy if exists "report_texts_self_select" on public.report_texts;
create policy "report_texts_self_select"
  on public.report_texts
  for select
  using (auth.uid() = partner_id);

drop policy if exists "report_texts_self_insert" on public.report_texts;
create policy "report_texts_self_insert"
  on public.report_texts
  for insert
  with check (auth.uid() = partner_id);

drop policy if exists "report_texts_self_update" on public.report_texts;
create policy "report_texts_self_update"
  on public.report_texts
  for update
  using (auth.uid() = partner_id)
  with check (auth.uid() = partner_id);

drop policy if exists "report_texts_self_delete" on public.report_texts;
create policy "report_texts_self_delete"
  on public.report_texts
  for delete
  using (auth.uid() = partner_id);

-- -----------------------------------------------------------------------------
-- 5) partner_marketing_texts: replace deny-all with own-row read/write
-- -----------------------------------------------------------------------------
alter table public.partner_marketing_texts enable row level security;

drop policy if exists "partner_marketing_texts_deny_select" on public.partner_marketing_texts;
drop policy if exists "partner_marketing_texts_deny_insert" on public.partner_marketing_texts;
drop policy if exists "partner_marketing_texts_deny_update" on public.partner_marketing_texts;
drop policy if exists "partner_marketing_texts_deny_delete" on public.partner_marketing_texts;
drop policy if exists "partner_marketing_texts_public_select_approved" on public.partner_marketing_texts;

drop policy if exists "partner_marketing_texts_self_select" on public.partner_marketing_texts;
create policy "partner_marketing_texts_self_select"
  on public.partner_marketing_texts
  for select
  using (auth.uid() = partner_id);

drop policy if exists "partner_marketing_texts_self_insert" on public.partner_marketing_texts;
create policy "partner_marketing_texts_self_insert"
  on public.partner_marketing_texts
  for insert
  with check (auth.uid() = partner_id);

drop policy if exists "partner_marketing_texts_self_update" on public.partner_marketing_texts;
create policy "partner_marketing_texts_self_update"
  on public.partner_marketing_texts
  for update
  using (auth.uid() = partner_id)
  with check (auth.uid() = partner_id);

drop policy if exists "partner_marketing_texts_self_delete" on public.partner_marketing_texts;
create policy "partner_marketing_texts_self_delete"
  on public.partner_marketing_texts
  for delete
  using (auth.uid() = partner_id);

-- -----------------------------------------------------------------------------
-- 6) partner_local_site_texts (optional table): replace deny-all with own-row read/write
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.partner_local_site_texts') is not null then
    execute 'alter table public.partner_local_site_texts enable row level security';

    execute 'drop policy if exists "partner_local_site_texts_deny_select" on public.partner_local_site_texts';
    execute 'drop policy if exists "partner_local_site_texts_deny_insert" on public.partner_local_site_texts';
    execute 'drop policy if exists "partner_local_site_texts_deny_update" on public.partner_local_site_texts';
    execute 'drop policy if exists "partner_local_site_texts_deny_delete" on public.partner_local_site_texts';

    execute 'drop policy if exists "partner_local_site_texts_self_select" on public.partner_local_site_texts';
    execute 'create policy "partner_local_site_texts_self_select" on public.partner_local_site_texts for select using (auth.uid() = partner_id)';

    execute 'drop policy if exists "partner_local_site_texts_self_insert" on public.partner_local_site_texts';
    execute 'create policy "partner_local_site_texts_self_insert" on public.partner_local_site_texts for insert with check (auth.uid() = partner_id)';

    execute 'drop policy if exists "partner_local_site_texts_self_update" on public.partner_local_site_texts';
    execute 'create policy "partner_local_site_texts_self_update" on public.partner_local_site_texts for update using (auth.uid() = partner_id) with check (auth.uid() = partner_id)';

    execute 'drop policy if exists "partner_local_site_texts_self_delete" on public.partner_local_site_texts';
    execute 'create policy "partner_local_site_texts_self_delete" on public.partner_local_site_texts for delete using (auth.uid() = partner_id)';
  end if;
end $$;

commit;
