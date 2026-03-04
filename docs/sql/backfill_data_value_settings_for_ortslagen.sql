-- Backfill: Fehlende data_value_settings fuer Ortslagen aus Kreiswerten initialisieren.
-- Zweck: Sicherstellen, dass die Faktorisierung in allen kreiszugehoerigen Ortslagen verfuegbar ist.

-- 1) Vorab-Check: Wie viele Ortslagen-Settings fehlen aktuell?
select count(*) as missing_ortslage_settings
from public.partner_area_map pam
join public.areas kreis
  on kreis.id = pam.area_id
join public.areas ort
  on ort.id like pam.area_id || '-%'
 and ort.bundesland_slug = kreis.bundesland_slug
left join public.data_value_settings dvs
  on dvs.auth_user_id = pam.auth_user_id
 and dvs.area_id = ort.id
where length(pam.area_id) - length(replace(pam.area_id, '-', '')) = 2
  and dvs.id is null;

-- 2) Fehlende Zeilen erzeugen (idempotent via ON CONFLICT)
insert into public.data_value_settings (
  auth_user_id,
  area_id,
  standortfaktoren,
  immobilienmarkt_trend,
  kauf_haus,
  kauf_wohnung,
  kauf_grundstueck,
  miete_haus,
  miete_wohnung,
  rendite,
  is_active,
  last_update
)
select
  pam.auth_user_id,
  ort.id as area_id,
  coalesce(kreis_dvs.standortfaktoren, '{"bildung":1,"gesundheit":1,"mobilitaet":1,"naherholung":1,"arbeitsplatz":1,"nahversorgung":1,"lebenserhaltungskosten":1}'::jsonb),
  coalesce(kreis_dvs.immobilienmarkt_trend, '{"mietmarkt":0,"immobilienmarkt":0}'::jsonb),
  coalesce(kreis_dvs.kauf_haus, '{"f01":1,"f02":1,"f03":1,"f04":1,"f05":1,"f06":1}'::jsonb),
  coalesce(kreis_dvs.kauf_wohnung, '{"f01":1,"f02":1,"f03":1,"f04":1,"f05":1,"f06":1}'::jsonb),
  coalesce(kreis_dvs.kauf_grundstueck, '{"f01":1,"f02":1,"f03":1,"f04":1,"f05":1,"f06":1}'::jsonb),
  coalesce(kreis_dvs.miete_haus, '{"f01":1,"f02":1,"f03":1,"f04":1,"f05":1,"f06":1}'::jsonb),
  coalesce(kreis_dvs.miete_wohnung, '{"f01":1,"f02":1,"f03":1,"f04":1,"f05":1,"f06":1}'::jsonb),
  coalesce(kreis_dvs.rendite, '{"mietrendite_efh":1,"mietrendite_etw":1,"mietrendite_mfh":1,"kaufpreisfaktor_efh":1,"kaufpreisfaktor_etw":1,"kaufpreisfaktor_mfh":1}'::jsonb),
  true,
  now()
from public.partner_area_map pam
join public.areas kreis
  on kreis.id = pam.area_id
join public.areas ort
  on ort.id like pam.area_id || '-%'
 and ort.bundesland_slug = kreis.bundesland_slug
left join public.data_value_settings kreis_dvs
  on kreis_dvs.auth_user_id = pam.auth_user_id
 and kreis_dvs.area_id = pam.area_id
where length(pam.area_id) - length(replace(pam.area_id, '-', '')) = 2
on conflict (auth_user_id, area_id) do nothing;

-- 3) Nachkontrolle: fehlende Zeilen sollten jetzt 0 sein
select count(*) as remaining_missing_ortslage_settings
from public.partner_area_map pam
join public.areas kreis
  on kreis.id = pam.area_id
join public.areas ort
  on ort.id like pam.area_id || '-%'
 and ort.bundesland_slug = kreis.bundesland_slug
left join public.data_value_settings dvs
  on dvs.auth_user_id = pam.auth_user_id
 and dvs.area_id = ort.id
where length(pam.area_id) - length(replace(pam.area_id, '-', '')) = 2
  and dvs.id is null;
