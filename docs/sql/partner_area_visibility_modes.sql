-- Gebietsbezogene Sichtbarkeitsmodi fuer Partner-Assets
-- Ziel:
-- 1) Ausspielungsstrategie pro Partnergebiet explizit konfigurierbar machen
-- 2) Default zunaechst konservativ auf `partner_wide` halten
-- 3) spaetere `strict_local`-Freigabe vorbereiten, ohne aktuelle Ausspielung zu aendern

alter table public.partner_area_map
  add column if not exists offer_visibility_mode text not null default 'partner_wide',
  add column if not exists request_visibility_mode text not null default 'partner_wide';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'partner_area_map_offer_visibility_mode_check'
  ) then
    alter table public.partner_area_map
      add constraint partner_area_map_offer_visibility_mode_check
      check (offer_visibility_mode in ('partner_wide', 'strict_local'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'partner_area_map_request_visibility_mode_check'
  ) then
    alter table public.partner_area_map
      add constraint partner_area_map_request_visibility_mode_check
      check (request_visibility_mode in ('partner_wide', 'strict_local'));
  end if;
end $$;

comment on column public.partner_area_map.offer_visibility_mode is
  'Steuert die Ausspielung von Angeboten fuer dieses Partnergebiet. partner_wide = alle Partner-Angebote, strict_local = spaeter nur lokal gematchte Angebote.';

comment on column public.partner_area_map.request_visibility_mode is
  'Steuert die Ausspielung von Gesuchen fuer dieses Partnergebiet. partner_wide = alle Partner-Gesuche, strict_local = nur lokal passende Gesuche.';

create index if not exists partner_area_map_offer_visibility_idx
  on public.partner_area_map (auth_user_id, area_id, offer_visibility_mode);

create index if not exists partner_area_map_request_visibility_idx
  on public.partner_area_map (auth_user_id, area_id, request_visibility_mode);
