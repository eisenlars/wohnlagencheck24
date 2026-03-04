-- Backfill: fehlende Ortslagen-Zuordnungen aus bestehenden Kreis-Zuordnungen erzeugen.
-- Zweck: Partner-Funktionalitaeten (Faktoren, Texte, Media, Rebuild) pro Ortslage wieder konsistent machen.
--
-- Annahmen:
-- - Kreis-IDs haben exakt 3 Segmente (z. B. 14-6-27).
-- - Ortslagen liegen in `areas` mit parent_slug = kreis.slug und gleichem bundesland_slug.
--
-- Vorab-Check: Wie viele fehlende Ortslagen-Zuordnungen existieren?
with kreis_mappings as (
  select
    pam.auth_user_id,
    pam.area_id as kreis_area_id,
    pam.is_active,
    pam.activation_status,
    kreis.slug as kreis_slug,
    kreis.bundesland_slug
  from public.partner_area_map pam
  join public.areas kreis on kreis.id = pam.area_id
  where array_length(string_to_array(pam.area_id, '-'), 1) = 3
),
missing as (
  select
    km.auth_user_id,
    ort.id as ort_area_id
  from kreis_mappings km
  join public.areas ort
    on ort.parent_slug = km.kreis_slug
   and ort.bundesland_slug = km.bundesland_slug
  left join public.partner_area_map existing
    on existing.auth_user_id = km.auth_user_id
   and existing.area_id = ort.id
  where existing.id is null
)
select count(*) as missing_ortslage_mappings
from missing;

-- Backfill ausfuehren.
insert into public.partner_area_map (auth_user_id, area_id, is_active, activation_status)
select
  km.auth_user_id,
  ort.id as area_id,
  km.is_active,
  case
    when km.activation_status is null or btrim(km.activation_status) = '' then
      case when km.is_active then 'active' else 'assigned' end
    else km.activation_status
  end as activation_status
from (
  select
    pam.auth_user_id,
    pam.area_id as kreis_area_id,
    pam.is_active,
    pam.activation_status,
    kreis.slug as kreis_slug,
    kreis.bundesland_slug
  from public.partner_area_map pam
  join public.areas kreis on kreis.id = pam.area_id
  where array_length(string_to_array(pam.area_id, '-'), 1) = 3
) km
join public.areas ort
  on ort.parent_slug = km.kreis_slug
 and ort.bundesland_slug = km.bundesland_slug
left join public.partner_area_map existing
  on existing.auth_user_id = km.auth_user_id
 and existing.area_id = ort.id
where existing.id is null
on conflict (auth_user_id, area_id) do nothing;

-- Nachkontrolle: verbleibende Luecken.
with kreis_mappings as (
  select
    pam.auth_user_id,
    pam.area_id as kreis_area_id,
    kreis.slug as kreis_slug,
    kreis.bundesland_slug
  from public.partner_area_map pam
  join public.areas kreis on kreis.id = pam.area_id
  where array_length(string_to_array(pam.area_id, '-'), 1) = 3
),
missing as (
  select
    km.auth_user_id,
    ort.id as ort_area_id
  from kreis_mappings km
  join public.areas ort
    on ort.parent_slug = km.kreis_slug
   and ort.bundesland_slug = km.bundesland_slug
  left join public.partner_area_map existing
    on existing.auth_user_id = km.auth_user_id
   and existing.area_id = ort.id
  where existing.id is null
)
select count(*) as remaining_missing_ortslage_mappings
from missing;
