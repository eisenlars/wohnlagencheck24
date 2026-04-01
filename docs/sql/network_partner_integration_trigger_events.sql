create table if not exists public.network_partner_integration_trigger_events (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references public.network_partner_integrations(id) on delete cascade,
  provider text not null,
  event_type text not null,
  resource_type text not null,
  resource_id text null,
  dedupe_key text not null,
  status text not null check (status in ('received', 'processed', 'ignored', 'duplicate', 'error')),
  verification text not null check (verification in ('verified', 'unsigned', 'failed', 'not_supported')),
  changed_fields jsonb null,
  raw_payload jsonb null,
  summary jsonb null,
  error text null,
  sync_run_id uuid null references public.network_partner_integration_sync_runs(id) on delete set null,
  received_at timestamptz not null default timezone('utc'::text, now()),
  processed_at timestamptz null
);

create unique index if not exists network_partner_integration_trigger_events_dedupe_idx
  on public.network_partner_integration_trigger_events (dedupe_key);

create index if not exists network_partner_integration_trigger_events_integration_idx
  on public.network_partner_integration_trigger_events (integration_id, received_at desc);
