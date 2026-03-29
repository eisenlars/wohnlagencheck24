-- Network Partner / Portal Partner AI Credits
-- Portal -> Portal-Partner:
-- - Creditmodell statt roher Tokenabrechnung im UI
-- - keine automatische Vorbelegung fuer Immobilienmarkttexte
-- - Warnhinweis und Kostenschaetzung im App-Layer
--
-- Portal-Partner -> Netzwerkpartner:
-- - spaeter eigenes Subledger moeglich
-- - im MVP reicht Kontextzuordnung ueber booking/content/network_partner_id

begin;

create table if not exists public.partner_ai_credit_ledgers (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  period_key text not null,
  opening_balance_eur numeric(10,2) not null default 0,
  credits_added_eur numeric(10,2) not null default 0,
  credits_used_eur numeric(10,2) not null default 0,
  closing_balance_eur numeric(10,2) not null default 0,
  status text not null default 'open' check (status in ('open', 'closed')),
  updated_at timestamptz not null default now(),
  unique (partner_id, period_key)
);

create table if not exists public.partner_ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  area_id text references public.areas(id) on delete set null,
  network_partner_id uuid references public.network_partners(id) on delete set null,
  content_item_id uuid references public.network_content_items(id) on delete set null,
  feature text not null check (feature in ('content_optimize', 'content_translate', 'seo_meta_generate')),
  locale text,
  billing_mode text not null check (billing_mode in ('included', 'credit_based', 'blocked')),
  prompt_tokens integer not null default 0 check (prompt_tokens >= 0),
  completion_tokens integer not null default 0 check (completion_tokens >= 0),
  estimated_cost_eur numeric(10,4) not null default 0 check (estimated_cost_eur >= 0),
  credit_delta_eur numeric(10,4) not null default 0 check (credit_delta_eur >= 0),
  status text not null default 'ok' check (status in ('ok', 'blocked', 'error')),
  created_at timestamptz not null default now()
);

create index if not exists idx_partner_ai_credit_ledgers_partner_period
  on public.partner_ai_credit_ledgers(partner_id, period_key);

create index if not exists idx_partner_ai_usage_events_partner_created
  on public.partner_ai_usage_events(partner_id, created_at desc);

create index if not exists idx_partner_ai_usage_events_network_partner_created
  on public.partner_ai_usage_events(network_partner_id, created_at desc);

create index if not exists idx_partner_ai_usage_events_content_created
  on public.partner_ai_usage_events(content_item_id, created_at desc);

drop trigger if exists trg_partner_ai_credit_ledgers_updated_at on public.partner_ai_credit_ledgers;
create trigger trg_partner_ai_credit_ledgers_updated_at
before update on public.partner_ai_credit_ledgers
for each row execute function public.set_row_updated_at();

alter table public.partner_ai_credit_ledgers enable row level security;
alter table public.partner_ai_usage_events enable row level security;

drop policy if exists partner_ai_credit_ledgers_select on public.partner_ai_credit_ledgers;
create policy partner_ai_credit_ledgers_select
  on public.partner_ai_credit_ledgers
  for select
  using (
    public.is_admin(auth.uid())
    or public.has_partner_role(auth.uid(), partner_id, array['partner_owner', 'partner_manager', 'partner_billing'])
  );

drop policy if exists partner_ai_credit_ledgers_deny_insert on public.partner_ai_credit_ledgers;
create policy partner_ai_credit_ledgers_deny_insert
  on public.partner_ai_credit_ledgers
  for insert
  with check (false);

drop policy if exists partner_ai_credit_ledgers_deny_update on public.partner_ai_credit_ledgers;
create policy partner_ai_credit_ledgers_deny_update
  on public.partner_ai_credit_ledgers
  for update
  using (false);

drop policy if exists partner_ai_credit_ledgers_deny_delete on public.partner_ai_credit_ledgers;
create policy partner_ai_credit_ledgers_deny_delete
  on public.partner_ai_credit_ledgers
  for delete
  using (false);

drop policy if exists partner_ai_usage_events_select on public.partner_ai_usage_events;
create policy partner_ai_usage_events_select
  on public.partner_ai_usage_events
  for select
  using (
    public.is_admin(auth.uid())
    or public.has_partner_role(auth.uid(), partner_id, array['partner_owner', 'partner_manager', 'partner_billing'])
    or (
      network_partner_id is not null
      and public.has_network_partner_role(auth.uid(), network_partner_id, array['network_owner', 'network_editor', 'network_billing'])
    )
  );

drop policy if exists partner_ai_usage_events_deny_insert on public.partner_ai_usage_events;
create policy partner_ai_usage_events_deny_insert
  on public.partner_ai_usage_events
  for insert
  with check (false);

drop policy if exists partner_ai_usage_events_deny_update on public.partner_ai_usage_events;
create policy partner_ai_usage_events_deny_update
  on public.partner_ai_usage_events
  for update
  using (false);

drop policy if exists partner_ai_usage_events_deny_delete on public.partner_ai_usage_events;
create policy partner_ai_usage_events_deny_delete
  on public.partner_ai_usage_events
  for delete
  using (false);

commit;
