-- Debug-View: Gesuch-Zielregionen aus partner_requests.normalized_payload aufgeloest
-- Zweck:
-- 1) Schnell pruefen, ob region_targets korrekt gespeichert sind
-- 2) region_target_keys direkt neben city/district sehen
-- 3) Basis fuer spaetere ortslagenbezogene Matching-Queries

create or replace view public.partner_request_region_targets_debug as
select
  r.id as request_id,
  r.partner_id,
  r.provider,
  r.external_id,
  r.title,
  r.status,
  r.is_active,
  r.sync_status,
  r.updated_at,
  coalesce(rt.ord, 0) as target_pos,
  rt.value ->> 'city' as city,
  rt.value ->> 'district' as district,
  rt.value ->> 'label' as label,
  case
    when rk.key is not null then rk.key
    when rt.value ->> 'city' is not null then
      lower(rt.value ->> 'city') || '::' || lower(coalesce(rt.value ->> 'district', ''))
    else null
  end as region_target_key
from public.partner_requests r
left join lateral jsonb_array_elements(
  case
    when jsonb_typeof(r.normalized_payload -> 'region_targets') = 'array'
      then r.normalized_payload -> 'region_targets'
    else '[]'::jsonb
  end
) with ordinality as rt(value, ord) on true
left join lateral (
  select elem as key
  from jsonb_array_elements_text(
    case
      when jsonb_typeof(r.normalized_payload -> 'region_target_keys') = 'array'
        then r.normalized_payload -> 'region_target_keys'
      else '[]'::jsonb
    end
  ) with ordinality as e(elem, ord)
  where e.ord = rt.ord
  limit 1
) rk on true;

comment on view public.partner_request_region_targets_debug is
  'Debug-View fuer partner_requests: region_targets + region_target_keys auf Zeilenebene.';
