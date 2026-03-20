-- Performance hardening for elevated Supabase Disk IO.
-- Focus:
-- 1) avoid full scans on public route lookups
-- 2) support partner/area visibility lookups with dedicated indexes
-- 3) accelerate approved-text lookups used on public page renders

begin;

create index if not exists areas_bundesland_slug_idx
  on public.areas (bundesland_slug, slug);

create index if not exists areas_bundesland_parent_slug_idx
  on public.areas (bundesland_slug, parent_slug);

create index if not exists partner_area_map_area_active_partner_idx
  on public.partner_area_map (area_id, is_active, auth_user_id);

create index if not exists partner_area_map_area_public_partner_idx
  on public.partner_area_map (area_id, is_public_live, auth_user_id);

create index if not exists partner_area_map_partner_public_area_idx
  on public.partner_area_map (auth_user_id, is_public_live, area_id);

create index if not exists report_texts_approved_area_partner_idx
  on public.report_texts (area_id, partner_id)
  where status = 'approved';

create index if not exists partner_marketing_texts_approved_area_partner_idx
  on public.partner_marketing_texts (area_id, partner_id)
  where status = 'approved';

commit;
