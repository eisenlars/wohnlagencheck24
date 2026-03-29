-- Network Partner Billing
-- Reichweitenpreis, Portalfee und Settlement bleiben von KI-Nutzung getrennt.
-- KI-Credits laufen in einem separaten Ledger.

begin;

create table if not exists public.network_partner_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.network_partner_bookings(id) on delete cascade,
  portal_partner_id uuid not null references public.partners(id) on delete cascade,
  network_partner_id uuid not null references public.network_partners(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  gross_amount_eur numeric(10,2) not null check (gross_amount_eur >= 0),
  portal_fee_eur numeric(10,2) not null check (portal_fee_eur >= 0),
  partner_net_eur numeric(10,2) not null check (partner_net_eur >= 0),
  status text not null default 'open' check (status in ('open', 'paid', 'overdue', 'cancelled')),
  created_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create table if not exists public.portal_partner_settlement_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_line_id uuid not null references public.network_partner_invoice_lines(id) on delete cascade,
  portal_partner_id uuid not null references public.partners(id) on delete cascade,
  gross_amount_eur numeric(10,2) not null check (gross_amount_eur >= 0),
  portal_fee_eur numeric(10,2) not null check (portal_fee_eur >= 0),
  partner_net_eur numeric(10,2) not null check (partner_net_eur >= 0),
  status text not null default 'pending' check (status in ('pending', 'cleared', 'held')),
  created_at timestamptz not null default now()
);

create index if not exists idx_network_partner_invoice_lines_partner_period
  on public.network_partner_invoice_lines(network_partner_id, status, period_start);

create index if not exists idx_network_partner_invoice_lines_portal_partner_period
  on public.network_partner_invoice_lines(portal_partner_id, status, period_start);

create index if not exists idx_portal_partner_settlement_lines_partner_status
  on public.portal_partner_settlement_lines(portal_partner_id, status, created_at);

alter table public.network_partner_invoice_lines enable row level security;
alter table public.portal_partner_settlement_lines enable row level security;

drop policy if exists network_partner_invoice_lines_select on public.network_partner_invoice_lines;
create policy network_partner_invoice_lines_select
  on public.network_partner_invoice_lines
  for select
  using (
    public.is_admin(auth.uid())
    or public.has_partner_role(auth.uid(), portal_partner_id, array['partner_owner', 'partner_manager', 'partner_billing'])
    or public.has_network_partner_role(auth.uid(), network_partner_id, array['network_owner', 'network_editor', 'network_billing'])
  );

drop policy if exists network_partner_invoice_lines_deny_insert on public.network_partner_invoice_lines;
create policy network_partner_invoice_lines_deny_insert
  on public.network_partner_invoice_lines
  for insert
  with check (false);

drop policy if exists network_partner_invoice_lines_deny_update on public.network_partner_invoice_lines;
create policy network_partner_invoice_lines_deny_update
  on public.network_partner_invoice_lines
  for update
  using (false);

drop policy if exists network_partner_invoice_lines_deny_delete on public.network_partner_invoice_lines;
create policy network_partner_invoice_lines_deny_delete
  on public.network_partner_invoice_lines
  for delete
  using (false);

drop policy if exists portal_partner_settlement_lines_select on public.portal_partner_settlement_lines;
create policy portal_partner_settlement_lines_select
  on public.portal_partner_settlement_lines
  for select
  using (
    public.is_admin(auth.uid())
    or public.has_partner_role(auth.uid(), portal_partner_id, array['partner_owner', 'partner_manager', 'partner_billing'])
  );

drop policy if exists portal_partner_settlement_lines_deny_insert on public.portal_partner_settlement_lines;
create policy portal_partner_settlement_lines_deny_insert
  on public.portal_partner_settlement_lines
  for insert
  with check (false);

drop policy if exists portal_partner_settlement_lines_deny_update on public.portal_partner_settlement_lines;
create policy portal_partner_settlement_lines_deny_update
  on public.portal_partner_settlement_lines
  for update
  using (false);

drop policy if exists portal_partner_settlement_lines_deny_delete on public.portal_partner_settlement_lines;
create policy portal_partner_settlement_lines_deny_delete
  on public.portal_partner_settlement_lines
  for delete
  using (false);

commit;
