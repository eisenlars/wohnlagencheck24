-- Network Partner Integrations
-- Zweck:
-- 1) eigene CRM-Integrationsdomaene fuer Netzwerkpartner
-- 2) Ownership ueber network_partner_id, Governance ueber portal_partner_id
-- 3) Basis fuer Test-, Preview- und spaetere produktive Sync-Laeufe

begin;

create extension if not exists pgcrypto;

create table if not exists public.network_partner_integrations (
  id uuid primary key default gen_random_uuid(),
  portal_partner_id uuid not null references public.partners(id) on delete cascade,
  network_partner_id uuid not null references public.network_partners(id) on delete cascade,
  kind text not null default 'crm' check (kind in ('crm')),
  provider text not null check (provider in ('propstack', 'onoffice')),
  base_url text,
  auth_type text,
  auth_config jsonb,
  detail_url_template text,
  is_active boolean not null default true,
  settings jsonb,
  last_test_at timestamptz,
  last_preview_sync_at timestamptz,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (network_partner_id, kind, provider)
);

create table if not exists public.network_partner_integration_sync_runs (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references public.network_partner_integrations(id) on delete cascade,
  portal_partner_id uuid not null references public.partners(id) on delete cascade,
  network_partner_id uuid not null references public.network_partners(id) on delete cascade,
  run_kind text not null check (run_kind in ('test', 'preview', 'sync')),
  run_mode text not null check (run_mode in ('guarded', 'full')),
  status text not null check (status in ('running', 'ok', 'warning', 'error')),
  trace_id text,
  summary jsonb,
  diagnostics jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_network_partner_integrations_network_partner
  on public.network_partner_integrations(network_partner_id, provider);

create index if not exists idx_network_partner_integrations_portal_partner
  on public.network_partner_integrations(portal_partner_id, provider);

create index if not exists idx_network_partner_integration_sync_runs_integration
  on public.network_partner_integration_sync_runs(integration_id, started_at desc);

create index if not exists idx_network_partner_integration_sync_runs_network_partner
  on public.network_partner_integration_sync_runs(network_partner_id, started_at desc);

drop trigger if exists trg_network_partner_integrations_updated_at on public.network_partner_integrations;
create trigger trg_network_partner_integrations_updated_at
before update on public.network_partner_integrations
for each row execute function public.set_row_updated_at();

alter table public.network_partner_integrations enable row level security;
alter table public.network_partner_integration_sync_runs enable row level security;

drop policy if exists network_partner_integrations_select on public.network_partner_integrations;
create policy network_partner_integrations_select
  on public.network_partner_integrations
  for select
  using (
    public.is_admin(auth.uid())
    or public.has_network_partner_role(auth.uid(), network_partner_id, array['network_owner', 'network_editor', 'network_billing'])
    or public.has_partner_role(auth.uid(), portal_partner_id, array['partner_owner', 'partner_manager', 'partner_billing'])
  );

drop policy if exists network_partner_integrations_modify on public.network_partner_integrations;
create policy network_partner_integrations_modify
  on public.network_partner_integrations
  for all
  using (
    public.is_admin(auth.uid())
    or public.has_network_partner_role(auth.uid(), network_partner_id, array['network_owner', 'network_editor'])
    or public.has_partner_role(auth.uid(), portal_partner_id, array['partner_owner', 'partner_manager'])
  )
  with check (
    public.is_admin(auth.uid())
    or public.has_network_partner_role(auth.uid(), network_partner_id, array['network_owner', 'network_editor'])
    or public.has_partner_role(auth.uid(), portal_partner_id, array['partner_owner', 'partner_manager'])
  );

drop policy if exists network_partner_integration_sync_runs_select on public.network_partner_integration_sync_runs;
create policy network_partner_integration_sync_runs_select
  on public.network_partner_integration_sync_runs
  for select
  using (
    public.is_admin(auth.uid())
    or public.has_network_partner_role(auth.uid(), network_partner_id, array['network_owner', 'network_editor', 'network_billing'])
    or public.has_partner_role(auth.uid(), portal_partner_id, array['partner_owner', 'partner_manager', 'partner_billing'])
  );

drop policy if exists network_partner_integration_sync_runs_deny_insert on public.network_partner_integration_sync_runs;
create policy network_partner_integration_sync_runs_deny_insert
  on public.network_partner_integration_sync_runs
  for insert
  with check (false);

drop policy if exists network_partner_integration_sync_runs_deny_update on public.network_partner_integration_sync_runs;
create policy network_partner_integration_sync_runs_deny_update
  on public.network_partner_integration_sync_runs
  for update
  using (false);

drop policy if exists network_partner_integration_sync_runs_deny_delete on public.network_partner_integration_sync_runs;
create policy network_partner_integration_sync_runs_deny_delete
  on public.network_partner_integration_sync_runs
  for delete
  using (false);

commit;
