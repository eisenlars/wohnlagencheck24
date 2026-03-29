-- Network Partner Content
-- API-/Service-Layer muss zusaetzlich pruefen:
-- 1) booking.portal_partner_id = content.portal_partner_id
-- 2) booking.network_partner_id = content.network_partner_id
-- 3) booking.area_id = content.area_id
-- 4) content_type passt zur gebuchten placement_code-Logik

begin;

create table if not exists public.network_content_items (
  id uuid primary key default gen_random_uuid(),
  portal_partner_id uuid not null references public.partners(id) on delete cascade,
  network_partner_id uuid not null references public.network_partners(id) on delete cascade,
  booking_id uuid not null references public.network_partner_bookings(id) on delete cascade,
  area_id text not null references public.areas(id) on delete cascade,
  content_type text not null check (content_type in ('company_profile', 'property_offer', 'property_request')),
  source_type text not null default 'manual' check (source_type in ('manual', 'api')),
  status text not null default 'draft' check (status in ('draft', 'in_review', 'approved', 'live', 'paused', 'rejected', 'expired')),
  slug text not null,
  title text not null,
  summary text,
  body_md text,
  cta_label text,
  cta_url text,
  primary_locale text not null default 'de',
  published_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (booking_id, slug)
);

create table if not exists public.network_company_profiles (
  content_item_id uuid primary key references public.network_content_items(id) on delete cascade,
  company_name text not null,
  industry_type text,
  service_region text,
  address_json jsonb,
  contact_json jsonb
);

create table if not exists public.network_property_offers (
  content_item_id uuid primary key references public.network_content_items(id) on delete cascade,
  external_id text,
  marketing_type text,
  property_type text,
  location_label text,
  price numeric(12,2),
  living_area numeric(10,2),
  plot_area numeric(10,2),
  rooms numeric(6,2),
  facts_json jsonb
);

create table if not exists public.network_property_requests (
  content_item_id uuid primary key references public.network_content_items(id) on delete cascade,
  external_id text,
  request_type text,
  search_region text,
  budget_min numeric(12,2),
  budget_max numeric(12,2),
  area_min numeric(10,2),
  area_max numeric(10,2),
  facts_json jsonb
);

create table if not exists public.network_content_media (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references public.network_content_items(id) on delete cascade,
  kind text not null check (kind in ('logo', 'hero', 'gallery', 'document')),
  url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.network_content_i18n (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references public.network_content_items(id) on delete cascade,
  locale text not null,
  status text not null check (status in ('machine_generated', 'reviewed', 'edited', 'stale')),
  translated_title text,
  translated_summary text,
  translated_body_md text,
  source_snapshot_hash text,
  updated_at timestamptz not null default now(),
  unique (content_item_id, locale)
);

create table if not exists public.network_content_reviews (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references public.network_content_items(id) on delete cascade,
  review_status text not null check (review_status in ('pending', 'approved', 'rejected')) default 'pending',
  reviewed_by_user_id uuid references auth.users(id) on delete set null,
  review_note text,
  reviewed_at timestamptz
);

create index if not exists idx_network_content_items_portal_partner
  on public.network_content_items(portal_partner_id, status);

create index if not exists idx_network_content_items_network_partner
  on public.network_content_items(network_partner_id, status);

create index if not exists idx_network_content_items_booking
  on public.network_content_items(booking_id, status);

create index if not exists idx_network_content_items_area
  on public.network_content_items(area_id, status);

create index if not exists idx_network_content_i18n_content_locale
  on public.network_content_i18n(content_item_id, locale, status);

create index if not exists idx_network_content_reviews_content
  on public.network_content_reviews(content_item_id, review_status);

drop trigger if exists trg_network_content_items_updated_at on public.network_content_items;
create trigger trg_network_content_items_updated_at
before update on public.network_content_items
for each row execute function public.set_row_updated_at();

create or replace function public.can_edit_network_content(_uid uuid, _content_item_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.network_content_items ci
    where ci.id = _content_item_id
      and (
        public.is_admin(_uid)
        or public.has_network_partner_role(_uid, ci.network_partner_id, array['network_owner', 'network_editor'])
        or (
          public.can_manage_network_partner(_uid, ci.network_partner_id)
          and public.is_managed_editing_enabled(ci.network_partner_id)
        )
      )
  );
$$;

create or replace function public.can_review_network_content(_uid uuid, _content_item_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.network_content_items ci
    where ci.id = _content_item_id
      and (
        public.is_admin(_uid)
        or public.can_manage_network_partner(_uid, ci.network_partner_id)
      )
  );
$$;

alter table public.network_content_items enable row level security;
alter table public.network_company_profiles enable row level security;
alter table public.network_property_offers enable row level security;
alter table public.network_property_requests enable row level security;
alter table public.network_content_media enable row level security;
alter table public.network_content_i18n enable row level security;
alter table public.network_content_reviews enable row level security;

drop policy if exists network_content_items_select on public.network_content_items;
create policy network_content_items_select
  on public.network_content_items
  for select
  using (
    public.is_admin(auth.uid())
    or public.has_partner_role(auth.uid(), portal_partner_id, array['partner_owner', 'partner_manager', 'partner_billing'])
    or public.has_network_partner_role(auth.uid(), network_partner_id, array['network_owner', 'network_editor', 'network_billing'])
  );

drop policy if exists network_content_items_insert on public.network_content_items;
create policy network_content_items_insert
  on public.network_content_items
  for insert
  with check (
    public.is_admin(auth.uid())
    or public.has_network_partner_role(auth.uid(), network_partner_id, array['network_owner', 'network_editor'])
    or (
      public.can_manage_network_partner(auth.uid(), network_partner_id)
      and public.is_managed_editing_enabled(network_partner_id)
    )
  );

drop policy if exists network_content_items_update on public.network_content_items;
create policy network_content_items_update
  on public.network_content_items
  for update
  using (public.can_edit_network_content(auth.uid(), id))
  with check (public.can_edit_network_content(auth.uid(), id));

drop policy if exists network_content_items_delete on public.network_content_items;
create policy network_content_items_delete
  on public.network_content_items
  for delete
  using (
    public.is_admin(auth.uid())
    or public.has_network_partner_role(auth.uid(), network_partner_id, array['network_owner'])
  );

drop policy if exists network_company_profiles_access on public.network_company_profiles;
create policy network_company_profiles_access
  on public.network_company_profiles
  for all
  using (
    exists (
      select 1
      from public.network_content_items ci
      where ci.id = content_item_id
        and (
          public.is_admin(auth.uid())
          or public.has_partner_role(auth.uid(), ci.portal_partner_id, array['partner_owner', 'partner_manager', 'partner_billing'])
          or public.has_network_partner_role(auth.uid(), ci.network_partner_id, array['network_owner', 'network_editor', 'network_billing'])
        )
    )
  )
  with check (
    exists (
      select 1
      from public.network_content_items ci
      where ci.id = content_item_id
        and public.can_edit_network_content(auth.uid(), ci.id)
    )
  );

drop policy if exists network_property_offers_access on public.network_property_offers;
create policy network_property_offers_access
  on public.network_property_offers
  for all
  using (
    exists (
      select 1
      from public.network_content_items ci
      where ci.id = content_item_id
        and (
          public.is_admin(auth.uid())
          or public.has_partner_role(auth.uid(), ci.portal_partner_id, array['partner_owner', 'partner_manager', 'partner_billing'])
          or public.has_network_partner_role(auth.uid(), ci.network_partner_id, array['network_owner', 'network_editor', 'network_billing'])
        )
    )
  )
  with check (
    exists (
      select 1
      from public.network_content_items ci
      where ci.id = content_item_id
        and public.can_edit_network_content(auth.uid(), ci.id)
    )
  );

drop policy if exists network_property_requests_access on public.network_property_requests;
create policy network_property_requests_access
  on public.network_property_requests
  for all
  using (
    exists (
      select 1
      from public.network_content_items ci
      where ci.id = content_item_id
        and (
          public.is_admin(auth.uid())
          or public.has_partner_role(auth.uid(), ci.portal_partner_id, array['partner_owner', 'partner_manager', 'partner_billing'])
          or public.has_network_partner_role(auth.uid(), ci.network_partner_id, array['network_owner', 'network_editor', 'network_billing'])
        )
    )
  )
  with check (
    exists (
      select 1
      from public.network_content_items ci
      where ci.id = content_item_id
        and public.can_edit_network_content(auth.uid(), ci.id)
    )
  );

drop policy if exists network_content_media_access on public.network_content_media;
create policy network_content_media_access
  on public.network_content_media
  for all
  using (
    exists (
      select 1
      from public.network_content_items ci
      where ci.id = content_item_id
        and (
          public.is_admin(auth.uid())
          or public.has_partner_role(auth.uid(), ci.portal_partner_id, array['partner_owner', 'partner_manager', 'partner_billing'])
          or public.has_network_partner_role(auth.uid(), ci.network_partner_id, array['network_owner', 'network_editor', 'network_billing'])
        )
    )
  )
  with check (
    exists (
      select 1
      from public.network_content_items ci
      where ci.id = content_item_id
        and public.can_edit_network_content(auth.uid(), ci.id)
    )
  );

drop policy if exists network_content_i18n_select on public.network_content_i18n;
create policy network_content_i18n_select
  on public.network_content_i18n
  for select
  using (
    exists (
      select 1
      from public.network_content_items ci
      where ci.id = content_item_id
        and (
          public.is_admin(auth.uid())
          or public.has_partner_role(auth.uid(), ci.portal_partner_id, array['partner_owner', 'partner_manager', 'partner_billing'])
          or public.has_network_partner_role(auth.uid(), ci.network_partner_id, array['network_owner', 'network_editor', 'network_billing'])
        )
    )
  );

drop policy if exists network_content_i18n_modify on public.network_content_i18n;
create policy network_content_i18n_modify
  on public.network_content_i18n
  for all
  using (
    exists (
      select 1
      from public.network_content_items ci
      where ci.id = content_item_id
        and public.can_edit_network_content(auth.uid(), ci.id)
    )
  )
  with check (
    exists (
      select 1
      from public.network_content_items ci
      where ci.id = content_item_id
        and public.can_edit_network_content(auth.uid(), ci.id)
    )
  );

drop policy if exists network_content_reviews_select on public.network_content_reviews;
create policy network_content_reviews_select
  on public.network_content_reviews
  for select
  using (
    exists (
      select 1
      from public.network_content_items ci
      where ci.id = content_item_id
        and (
          public.is_admin(auth.uid())
          or public.has_partner_role(auth.uid(), ci.portal_partner_id, array['partner_owner', 'partner_manager', 'partner_billing'])
          or public.has_network_partner_role(auth.uid(), ci.network_partner_id, array['network_owner', 'network_editor', 'network_billing'])
        )
    )
  );

drop policy if exists network_content_reviews_modify on public.network_content_reviews;
create policy network_content_reviews_modify
  on public.network_content_reviews
  for all
  using (public.can_review_network_content(auth.uid(), content_item_id))
  with check (public.can_review_network_content(auth.uid(), content_item_id));

commit;
