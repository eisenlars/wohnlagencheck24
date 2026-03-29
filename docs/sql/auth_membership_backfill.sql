-- Auth Membership Backfill
-- Zweck:
-- 1) bestehende Testaccounts kontrolliert in die Membership-Tabellen ueberfuehren
-- 2) Admins in public.admin_users spiegeln
-- 3) bestehende Portal-Partner in public.partner_users spiegeln
--
-- Voraussetzungen:
-- - public.admin_users, public.partner_users und public.network_partner_users existieren
--   aus network_partner_foundation.sql
-- - fuer Portal-Partner gilt im Altbestand noch: partners.id = auth.users.id
--
-- Wichtiger Hinweis:
-- - fuer Admins muessen die gewuenschten auth.users IDs vor dem Run in die CTE
--   desired_admin_users eingetragen werden
-- - die UUIDs koennen aus den bisherigen ENV-Werten (ADMIN_SUPER_USER_IDS,
--   ADMIN_OPS_USER_IDS) uebernommen werden, sollen aber bewusst pro Umgebung
--   explizit gesetzt werden

begin;

-- 1) Admin-Mitgliedschaften backfillen.
-- Trage hier die realen auth.users IDs der bestehenden Admin-Testaccounts ein.
with desired_admin_users(auth_user_id, role) as (
  values
    -- ('00000000-0000-0000-0000-000000000000'::uuid, 'admin_super'::text),
    -- ('11111111-1111-1111-1111-111111111111'::uuid, 'admin_ops'::text)
    (null::uuid, null::text)
),
normalized_admin_users as (
  select auth_user_id, role
  from desired_admin_users
  where auth_user_id is not null
    and role in ('admin_super', 'admin_ops', 'admin_billing')
)
insert into public.admin_users (auth_user_id, role)
select auth_user_id, role
from normalized_admin_users
on conflict (auth_user_id) do update
set role = excluded.role;

-- 2) Bestehende Portal-Partner in partner_users spiegeln.
-- Altannahme: partners.id entspricht im Testbestand dem auth.users.id.
insert into public.partner_users (
  partner_id,
  auth_user_id,
  role,
  is_primary
)
select
  p.id as partner_id,
  p.id as auth_user_id,
  'partner_owner'::text as role,
  true as is_primary
from public.partners p
join auth.users au
  on au.id = p.id
where not exists (
  select 1
  from public.partner_users pu
  where pu.partner_id = p.id
    and pu.auth_user_id = p.id
);

-- 3) Optionaler Korrekturschritt:
-- vorhandene Owner-Memberships fuer direkte Testaccounts als primaer markieren.
update public.partner_users pu
set is_primary = true
where pu.role = 'partner_owner'
  and pu.partner_id = pu.auth_user_id
  and coalesce(pu.is_primary, false) = false;

commit;

-- Diagnose-Queries nach dem Run:
-- select role, count(*) from public.admin_users group by role order by role;
-- select role, count(*) from public.partner_users group by role order by role;
-- select p.id, p.company_name, pu.auth_user_id, pu.role, pu.is_primary
-- from public.partners p
-- left join public.partner_users pu on pu.partner_id = p.id
-- order by p.created_at desc nulls last;
