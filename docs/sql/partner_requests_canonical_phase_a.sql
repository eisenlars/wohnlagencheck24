-- partner_requests_canonical_phase_a
--
-- Ziel:
-- 1) bestehende Tabelle `partner_requests` fuer den kuenftigen Canonical-Layer vorbereiten
-- 2) heutige Funktion nicht brechen
-- 3) spaetere Trennung von owner/publisher jetzt schon mitdenken
--
-- Wichtig:
-- - `source` bleibt in Phase A bewusst nullable, weil die laufende Sync-Logik
--   noch auf `provider` schreibt.
-- - `canonical_payload` wird initial aus `normalized_payload` vorbelegt.

alter table public.partner_requests
  add column if not exists source text,
  add column if not exists lifecycle_status text not null default 'active'
    check (lifecycle_status = any (array['active'::text, 'stale'::text, 'expired'::text, 'hidden'::text, 'draft'::text])),
  add column if not exists is_live boolean not null default true,
  add column if not exists canonical_payload jsonb not null default '{}'::jsonb,
  add column if not exists owner_account_id uuid references public.partners(id),
  add column if not exists publisher_account_id uuid references public.partners(id);

update public.partner_requests
set
  source = coalesce(source, provider),
  lifecycle_status = coalesce(nullif(lifecycle_status, ''), 'active'),
  is_live = coalesce(is_live, is_active, true),
  canonical_payload = case
    when canonical_payload = '{}'::jsonb and normalized_payload is not null then normalized_payload
    else canonical_payload
  end,
  owner_account_id = coalesce(owner_account_id, partner_id),
  publisher_account_id = coalesce(publisher_account_id, partner_id)
where
  source is null
  or lifecycle_status is null
  or canonical_payload = '{}'::jsonb
  or owner_account_id is null
  or publisher_account_id is null;

create index if not exists partner_requests_partner_live_idx
  on public.partner_requests (partner_id, lifecycle_status, is_live);

create index if not exists partner_requests_partner_source_updated_idx
  on public.partner_requests (partner_id, source_updated_at desc);

create index if not exists partner_requests_partner_source_external_idx
  on public.partner_requests (partner_id, source, external_id);

create unique index if not exists partner_requests_partner_source_external_unique
  on public.partner_requests (partner_id, source, external_id)
  where source is not null;
