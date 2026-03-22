-- Angebots-Gebietsmatching: operative Debug-Queries
-- Ersetze <PARTNER_ID> vor Ausfuehrung.

-- 1) Aktive / public-live Gebiete des Partners
select
  pam.auth_user_id as partner_id,
  pam.area_id,
  pam.is_active,
  pam.is_public_live,
  pam.offer_visibility_mode,
  pam.request_visibility_mode,
  a.name,
  a.slug,
  a.parent_slug,
  a.bundesland_slug
from public.partner_area_map pam
left join public.areas a on a.id = pam.area_id
where pam.auth_user_id = '<PARTNER_ID>'
order by pam.is_public_live desc, pam.is_active desc, pam.area_id;

-- 2) Angebots-Geosignale aus dem kanonischen Readmodell
select
  o.id as offer_id,
  o.partner_id,
  o.title,
  o.offer_type,
  o.source,
  o.external_id,
  o.raw->>'zip_code' as zip_code,
  o.raw->>'city' as city,
  o.raw->>'region' as region,
  o.raw->>'country' as country,
  o.raw->>'lat' as lat,
  o.raw->>'lng' as lng,
  o.updated_at
from public.partner_property_offers o
where o.partner_id = '<PARTNER_ID>'
order by o.updated_at desc, o.id;

-- 3) Persistierte Angebots-Matches
select
  t.partner_id,
  t.offer_id,
  t.area_id,
  t.is_primary,
  t.match_source,
  t.match_confidence,
  t.score,
  t.matched_zip_code,
  t.matched_city,
  t.matched_region,
  t.updated_at
from public.partner_offer_area_targets t
where t.partner_id = '<PARTNER_ID>'
order by t.offer_id, t.is_primary desc, t.score desc nulls last, t.area_id;

-- 4) Verdichtete Sicht: Angebot + vorhandene Matches
select
  o.id as offer_id,
  o.title,
  o.offer_type,
  o.raw->>'zip_code' as zip_code,
  o.raw->>'city' as city,
  o.raw->>'region' as region,
  o.raw->>'lat' as lat,
  o.raw->>'lng' as lng,
  t.area_id as matched_area_id,
  a.name as matched_area_name,
  t.is_primary,
  t.match_source,
  t.match_confidence,
  t.score
from public.partner_property_offers o
left join public.partner_offer_area_targets t
  on t.offer_id = o.id
left join public.areas a
  on a.id = t.area_id
where o.partner_id = '<PARTNER_ID>'
order by o.updated_at desc, o.id, t.is_primary desc, t.score desc nulls last;

-- 5) Schnellcheck: Angebote ohne Match
select
  o.id as offer_id,
  o.title,
  o.raw->>'zip_code' as zip_code,
  o.raw->>'city' as city,
  o.raw->>'region' as region,
  o.raw->>'lat' as lat,
  o.raw->>'lng' as lng
from public.partner_property_offers o
left join public.partner_offer_area_targets t
  on t.offer_id = o.id
where o.partner_id = '<PARTNER_ID>'
group by o.id, o.title, o.raw
having count(t.id) = 0
order by o.updated_at desc, o.id;
