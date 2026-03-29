-- Network Partner Inventory and Bookings
-- Wichtiger Typ-Hinweis:
-- public.areas.id ist im aktuellen Projekt text, nicht uuid.
-- Daher werden alle area_id-FKs in dieser Domaene als text modelliert.

begin;

create table if not exists public.placement_catalog (
  code text primary key,
  label text not null,
  content_type text not null check (content_type in ('company_profile', 'property_offer', 'property_request')),
  billing_mode text not null check (billing_mode in ('monthly_fixed')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.partner_area_inventory (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  area_id text not null references public.areas(id) on delete cascade,
  placement_code text not null references public.placement_catalog(code),
  slot_limit integer not null check (slot_limit > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (partner_id, area_id, placement_code)
);

create table if not exists public.network_partner_bookings (
  id uuid primary key default gen_random_uuid(),
  portal_partner_id uuid not null references public.partners(id) on delete cascade,
  network_partner_id uuid not null references public.network_partners(id) on delete cascade,
  area_id text not null references public.areas(id) on delete cascade,
  placement_code text not null references public.placement_catalog(code),
  status text not null default 'draft' check (status in ('draft', 'pending_review', 'active', 'paused', 'cancelled', 'expired')),
  starts_at date not null,
  ends_at date,
  monthly_price_eur numeric(10,2) not null check (monthly_price_eur >= 0),
  portal_fee_eur numeric(10,2) not null check (portal_fee_eur >= 0),
  billing_cycle_day integer not null check (billing_cycle_day between 1 and 28),
  required_locales jsonb not null default '["de"]'::jsonb,
  ai_billing_mode text not null default 'included' check (ai_billing_mode in ('included', 'credit_based', 'blocked')),
  ai_monthly_budget_eur numeric(10,2) not null default 0 check (ai_monthly_budget_eur >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at),
  check (jsonb_typeof(required_locales) = 'array')
);

create index if not exists idx_partner_area_inventory_partner_area
  on public.partner_area_inventory(partner_id, area_id, placement_code);

create index if not exists idx_network_partner_bookings_partner_status
  on public.network_partner_bookings(portal_partner_id, network_partner_id, status);

create index if not exists idx_network_partner_bookings_area_status
  on public.network_partner_bookings(area_id, placement_code, status);

create index if not exists idx_network_partner_bookings_network_partner
  on public.network_partner_bookings(network_partner_id, status);

drop trigger if exists trg_partner_area_inventory_updated_at on public.partner_area_inventory;
create trigger trg_partner_area_inventory_updated_at
before update on public.partner_area_inventory
for each row execute function public.set_row_updated_at();

drop trigger if exists trg_network_partner_bookings_updated_at on public.network_partner_bookings;
create trigger trg_network_partner_bookings_updated_at
before update on public.network_partner_bookings
for each row execute function public.set_row_updated_at();

insert into public.placement_catalog (code, label, content_type, billing_mode)
values
  ('company_profile', 'Unternehmensprofil', 'company_profile', 'monthly_fixed'),
  ('property_offer', 'Immobilienangebot', 'property_offer', 'monthly_fixed'),
  ('property_request', 'Immobiliengesuch', 'property_request', 'monthly_fixed')
on conflict (code) do update set
  label = excluded.label,
  content_type = excluded.content_type,
  billing_mode = excluded.billing_mode,
  is_active = true;

alter table public.placement_catalog enable row level security;
alter table public.partner_area_inventory enable row level security;
alter table public.network_partner_bookings enable row level security;

drop policy if exists placement_catalog_select on public.placement_catalog;
create policy placement_catalog_select
  on public.placement_catalog
  for select
  using (
    public.is_admin(auth.uid())
    or exists (select 1 from public.partner_users pu where pu.auth_user_id = auth.uid())
    or exists (select 1 from public.network_partner_users npu where npu.auth_user_id = auth.uid())
  );

drop policy if exists placement_catalog_modify on public.placement_catalog;
create policy placement_catalog_modify
  on public.placement_catalog
  for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists partner_area_inventory_select on public.partner_area_inventory;
create policy partner_area_inventory_select
  on public.partner_area_inventory
  for select
  using (
    public.is_admin(auth.uid())
    or public.has_partner_role(auth.uid(), partner_id, array['partner_owner', 'partner_manager', 'partner_billing'])
    or exists (
      select 1
      from public.network_partners np
      join public.network_partner_users npu on npu.network_partner_id = np.id
      where np.portal_partner_id = partner_id
        and npu.auth_user_id = auth.uid()
    )
  );

drop policy if exists partner_area_inventory_modify on public.partner_area_inventory;
create policy partner_area_inventory_modify
  on public.partner_area_inventory
  for all
  using (
    public.is_admin(auth.uid())
    or public.has_partner_role(auth.uid(), partner_id, array['partner_owner', 'partner_manager'])
  )
  with check (
    public.is_admin(auth.uid())
    or public.has_partner_role(auth.uid(), partner_id, array['partner_owner', 'partner_manager'])
  );

drop policy if exists network_partner_bookings_select on public.network_partner_bookings;
create policy network_partner_bookings_select
  on public.network_partner_bookings
  for select
  using (
    public.is_admin(auth.uid())
    or public.has_partner_role(auth.uid(), portal_partner_id, array['partner_owner', 'partner_manager', 'partner_billing'])
    or public.has_network_partner_role(auth.uid(), network_partner_id, array['network_owner', 'network_editor', 'network_billing'])
  );

drop policy if exists network_partner_bookings_modify on public.network_partner_bookings;
create policy network_partner_bookings_modify
  on public.network_partner_bookings
  for all
  using (
    public.is_admin(auth.uid())
    or public.has_partner_role(auth.uid(), portal_partner_id, array['partner_owner', 'partner_manager'])
  )
  with check (
    public.is_admin(auth.uid())
    or public.has_partner_role(auth.uid(), portal_partner_id, array['partner_owner', 'partner_manager'])
  );

commit;
