-- Network Partner Foundation
-- Zweck:
-- 1) DB-seitige Rollenbasis fuer neue RLS-gesicherte Netzwerkpartner-Domaene
-- 2) Membership-Modelle fuer Portal-Partner und Netzwerkpartner
-- 3) Helper-Functions fuer spaetere Policies

begin;

create extension if not exists pgcrypto;

create or replace function public.set_row_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.admin_users (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin_super', 'admin_ops', 'admin_billing')),
  created_at timestamptz not null default now()
);

create table if not exists public.partner_users (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('partner_owner', 'partner_manager', 'partner_billing')),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (partner_id, auth_user_id)
);

create table if not exists public.network_partners (
  id uuid primary key default gen_random_uuid(),
  portal_partner_id uuid not null references public.partners(id) on delete cascade,
  company_name text not null,
  legal_name text,
  contact_email text not null,
  contact_phone text,
  website_url text,
  status text not null default 'active' check (status in ('active', 'paused', 'inactive')),
  managed_editing_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.network_partner_users (
  id uuid primary key default gen_random_uuid(),
  network_partner_id uuid not null references public.network_partners(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('network_owner', 'network_editor', 'network_billing')),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (network_partner_id, auth_user_id)
);

create index if not exists idx_admin_users_role
  on public.admin_users(role);

create index if not exists idx_partner_users_auth_user_id
  on public.partner_users(auth_user_id);

create index if not exists idx_partner_users_partner_role
  on public.partner_users(partner_id, role);

create index if not exists idx_network_partners_portal_partner_id
  on public.network_partners(portal_partner_id, status);

create index if not exists idx_network_partner_users_auth_user_id
  on public.network_partner_users(auth_user_id);

create index if not exists idx_network_partner_users_network_partner_role
  on public.network_partner_users(network_partner_id, role);

drop trigger if exists trg_network_partners_updated_at on public.network_partners;
create trigger trg_network_partners_updated_at
before update on public.network_partners
for each row execute function public.set_row_updated_at();

create or replace function public.is_admin(_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where auth_user_id = _uid
  );
$$;

create or replace function public.has_partner_role(_uid uuid, _partner_id uuid, _roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.partner_users
    where auth_user_id = _uid
      and partner_id = _partner_id
      and role = any(_roles)
  );
$$;

create or replace function public.has_network_partner_role(_uid uuid, _network_partner_id uuid, _roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.network_partner_users
    where auth_user_id = _uid
      and network_partner_id = _network_partner_id
      and role = any(_roles)
  );
$$;

create or replace function public.can_manage_network_partner(_uid uuid, _network_partner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.network_partners np
    join public.partner_users pu
      on pu.partner_id = np.portal_partner_id
    where np.id = _network_partner_id
      and pu.auth_user_id = _uid
      and pu.role = any (array['partner_owner', 'partner_manager'])
  );
$$;

create or replace function public.is_managed_editing_enabled(_network_partner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select managed_editing_enabled
    from public.network_partners
    where id = _network_partner_id
  ), false);
$$;

alter table public.admin_users enable row level security;
alter table public.partner_users enable row level security;
alter table public.network_partners enable row level security;
alter table public.network_partner_users enable row level security;

drop policy if exists admin_users_deny_select on public.admin_users;
create policy admin_users_deny_select
  on public.admin_users for select using (false);
drop policy if exists admin_users_deny_insert on public.admin_users;
create policy admin_users_deny_insert
  on public.admin_users for insert with check (false);
drop policy if exists admin_users_deny_update on public.admin_users;
create policy admin_users_deny_update
  on public.admin_users for update using (false);
drop policy if exists admin_users_deny_delete on public.admin_users;
create policy admin_users_deny_delete
  on public.admin_users for delete using (false);

drop policy if exists partner_users_select on public.partner_users;
create policy partner_users_select
  on public.partner_users
  for select
  using (
    public.is_admin(auth.uid())
    or auth.uid() = auth_user_id
    or public.has_partner_role(auth.uid(), partner_id, array['partner_owner', 'partner_manager'])
  );

drop policy if exists partner_users_modify on public.partner_users;
create policy partner_users_modify
  on public.partner_users
  for all
  using (
    public.is_admin(auth.uid())
    or public.has_partner_role(auth.uid(), partner_id, array['partner_owner', 'partner_manager'])
  )
  with check (
    public.is_admin(auth.uid())
    or public.has_partner_role(auth.uid(), partner_id, array['partner_owner', 'partner_manager'])
  );

drop policy if exists network_partners_select on public.network_partners;
create policy network_partners_select
  on public.network_partners
  for select
  using (
    public.is_admin(auth.uid())
    or public.has_network_partner_role(auth.uid(), id, array['network_owner', 'network_editor', 'network_billing'])
    or public.has_partner_role(auth.uid(), portal_partner_id, array['partner_owner', 'partner_manager', 'partner_billing'])
  );

drop policy if exists network_partners_modify on public.network_partners;
create policy network_partners_modify
  on public.network_partners
  for all
  using (
    public.is_admin(auth.uid())
    or public.has_partner_role(auth.uid(), portal_partner_id, array['partner_owner', 'partner_manager'])
  )
  with check (
    public.is_admin(auth.uid())
    or public.has_partner_role(auth.uid(), portal_partner_id, array['partner_owner', 'partner_manager'])
  );

drop policy if exists network_partner_users_select on public.network_partner_users;
create policy network_partner_users_select
  on public.network_partner_users
  for select
  using (
    public.is_admin(auth.uid())
    or auth.uid() = auth_user_id
    or public.has_network_partner_role(auth.uid(), network_partner_id, array['network_owner'])
    or public.can_manage_network_partner(auth.uid(), network_partner_id)
  );

drop policy if exists network_partner_users_modify on public.network_partner_users;
create policy network_partner_users_modify
  on public.network_partner_users
  for all
  using (
    public.is_admin(auth.uid())
    or public.can_manage_network_partner(auth.uid(), network_partner_id)
  )
  with check (
    public.is_admin(auth.uid())
    or public.can_manage_network_partner(auth.uid(), network_partner_id)
  );

commit;
