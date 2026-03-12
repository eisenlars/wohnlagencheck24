-- Global LLM management (admin)
-- Enables:
-- 1) zentrale Provider-/Modellverwaltung
-- 2) Fallback-Reihenfolge + Budgetgrenzen
-- 3) Token-/Kostenmonitoring pro Partner

create table if not exists public.llm_global_config (
  id boolean primary key default true,
  central_enabled boolean not null default true,
  monthly_token_budget bigint,
  monthly_cost_budget_eur numeric(14,6),
  updated_at timestamptz not null default now()
);

insert into public.llm_global_config (id, central_enabled)
values (true, true)
on conflict (id) do nothing;

create table if not exists public.llm_global_providers (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  model text not null,
  base_url text not null,
  auth_type text not null default 'api_key',
  auth_config jsonb,
  priority integer not null default 100,
  is_active boolean not null default true,
  temperature numeric(6,3),
  max_tokens integer,
  input_cost_eur_per_1k numeric(14,6),
  output_cost_eur_per_1k numeric(14,6),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.llm_global_providers
  add column if not exists price_source text,
  add column if not exists price_source_url_override text,
  add column if not exists price_source_url text,
  add column if not exists price_updated_at timestamptz;

alter table public.llm_global_providers
  drop constraint if exists llm_global_providers_costs_positive_chk;

alter table public.llm_global_providers
  add constraint llm_global_providers_costs_positive_chk
  check (
    (input_cost_eur_per_1k is null or input_cost_eur_per_1k > 0)
    and (output_cost_eur_per_1k is null or output_cost_eur_per_1k > 0)
  ) not valid;

alter table public.llm_global_providers
  drop constraint if exists llm_global_providers_active_requires_costs_chk;

alter table public.llm_global_providers
  add constraint llm_global_providers_active_requires_costs_chk
  check (
    is_active = false
    or (
      input_cost_eur_per_1k is not null
      and output_cost_eur_per_1k is not null
      and input_cost_eur_per_1k > 0
      and output_cost_eur_per_1k > 0
    )
  ) not valid;

create index if not exists llm_global_providers_priority_idx
  on public.llm_global_providers (is_active, priority asc, created_at asc);

create unique index if not exists llm_global_providers_active_provider_model_base_url_uq
  on public.llm_global_providers (provider, model, base_url)
  where is_active = true;

create table if not exists public.llm_fx_monthly_rates (
  month_start date not null,
  from_currency text not null,
  to_currency text not null,
  rate numeric(18,8) not null,
  source text,
  is_locked boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (month_start, from_currency, to_currency)
);

create table if not exists public.llm_partner_budget_overrides (
  partner_id uuid primary key references public.partners(id) on delete cascade,
  monthly_token_budget bigint,
  monthly_cost_budget_eur numeric(14,6),
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.llm_usage_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  partner_id uuid references public.partners(id) on delete set null,
  route_name text not null,
  mode text not null,
  provider text not null,
  model text not null,
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer,
  estimated_cost_eur numeric(14,6),
  status text not null default 'ok',
  error_code text
);

create table if not exists public.llm_provider_price_observations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  provider text not null,
  model text not null,
  source_kind text not null default 'provider_web',
  source_url text,
  fetched_at timestamptz not null default now(),
  input_cost_eur_per_1k numeric(14,6),
  output_cost_eur_per_1k numeric(14,6),
  parse_confidence numeric(5,4),
  parse_status text not null default 'unknown',
  parse_message text,
  raw_excerpt text,
  is_applied boolean not null default false,
  applied_at timestamptz
);

create index if not exists llm_usage_events_created_idx
  on public.llm_usage_events (created_at desc);

create index if not exists llm_usage_events_partner_created_idx
  on public.llm_usage_events (partner_id, created_at desc);

create index if not exists llm_usage_events_status_created_idx
  on public.llm_usage_events (status, created_at desc);

create index if not exists llm_provider_price_observations_provider_model_created_idx
  on public.llm_provider_price_observations (provider, model, created_at desc);

alter table public.llm_global_config enable row level security;
alter table public.llm_global_providers enable row level security;
alter table public.llm_partner_budget_overrides enable row level security;
alter table public.llm_usage_events enable row level security;
alter table public.llm_provider_price_observations enable row level security;
alter table public.llm_fx_monthly_rates enable row level security;

drop policy if exists "llm_global_config_deny_select" on public.llm_global_config;
create policy "llm_global_config_deny_select" on public.llm_global_config for select using (false);
drop policy if exists "llm_global_config_deny_insert" on public.llm_global_config;
create policy "llm_global_config_deny_insert" on public.llm_global_config for insert with check (false);
drop policy if exists "llm_global_config_deny_update" on public.llm_global_config;
create policy "llm_global_config_deny_update" on public.llm_global_config for update using (false);
drop policy if exists "llm_global_config_deny_delete" on public.llm_global_config;
create policy "llm_global_config_deny_delete" on public.llm_global_config for delete using (false);

drop policy if exists "llm_global_providers_deny_select" on public.llm_global_providers;
create policy "llm_global_providers_deny_select" on public.llm_global_providers for select using (false);
drop policy if exists "llm_global_providers_deny_insert" on public.llm_global_providers;
create policy "llm_global_providers_deny_insert" on public.llm_global_providers for insert with check (false);
drop policy if exists "llm_global_providers_deny_update" on public.llm_global_providers;
create policy "llm_global_providers_deny_update" on public.llm_global_providers for update using (false);
drop policy if exists "llm_global_providers_deny_delete" on public.llm_global_providers;
create policy "llm_global_providers_deny_delete" on public.llm_global_providers for delete using (false);

drop policy if exists "llm_partner_budget_overrides_deny_select" on public.llm_partner_budget_overrides;
create policy "llm_partner_budget_overrides_deny_select" on public.llm_partner_budget_overrides for select using (false);
drop policy if exists "llm_partner_budget_overrides_deny_insert" on public.llm_partner_budget_overrides;
create policy "llm_partner_budget_overrides_deny_insert" on public.llm_partner_budget_overrides for insert with check (false);
drop policy if exists "llm_partner_budget_overrides_deny_update" on public.llm_partner_budget_overrides;
create policy "llm_partner_budget_overrides_deny_update" on public.llm_partner_budget_overrides for update using (false);
drop policy if exists "llm_partner_budget_overrides_deny_delete" on public.llm_partner_budget_overrides;
create policy "llm_partner_budget_overrides_deny_delete" on public.llm_partner_budget_overrides for delete using (false);

drop policy if exists "llm_usage_events_deny_select" on public.llm_usage_events;
create policy "llm_usage_events_deny_select" on public.llm_usage_events for select using (false);
drop policy if exists "llm_usage_events_deny_insert" on public.llm_usage_events;
create policy "llm_usage_events_deny_insert" on public.llm_usage_events for insert with check (false);
drop policy if exists "llm_usage_events_deny_update" on public.llm_usage_events;
create policy "llm_usage_events_deny_update" on public.llm_usage_events for update using (false);
drop policy if exists "llm_usage_events_deny_delete" on public.llm_usage_events;
create policy "llm_usage_events_deny_delete" on public.llm_usage_events for delete using (false);

drop policy if exists "llm_provider_price_observations_deny_select" on public.llm_provider_price_observations;
create policy "llm_provider_price_observations_deny_select" on public.llm_provider_price_observations for select using (false);
drop policy if exists "llm_provider_price_observations_deny_insert" on public.llm_provider_price_observations;
create policy "llm_provider_price_observations_deny_insert" on public.llm_provider_price_observations for insert with check (false);
drop policy if exists "llm_provider_price_observations_deny_update" on public.llm_provider_price_observations;
create policy "llm_provider_price_observations_deny_update" on public.llm_provider_price_observations for update using (false);
drop policy if exists "llm_provider_price_observations_deny_delete" on public.llm_provider_price_observations;
create policy "llm_provider_price_observations_deny_delete" on public.llm_provider_price_observations for delete using (false);

drop policy if exists "llm_fx_monthly_rates_deny_select" on public.llm_fx_monthly_rates;
create policy "llm_fx_monthly_rates_deny_select" on public.llm_fx_monthly_rates for select using (false);
drop policy if exists "llm_fx_monthly_rates_deny_insert" on public.llm_fx_monthly_rates;
create policy "llm_fx_monthly_rates_deny_insert" on public.llm_fx_monthly_rates for insert with check (false);
drop policy if exists "llm_fx_monthly_rates_deny_update" on public.llm_fx_monthly_rates;
create policy "llm_fx_monthly_rates_deny_update" on public.llm_fx_monthly_rates for update using (false);
drop policy if exists "llm_fx_monthly_rates_deny_delete" on public.llm_fx_monthly_rates;
create policy "llm_fx_monthly_rates_deny_delete" on public.llm_fx_monthly_rates for delete using (false);
