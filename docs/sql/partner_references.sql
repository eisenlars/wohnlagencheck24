-- partner_references (vermarktete Referenzobjekte je Partner)

create table if not exists public.partner_references (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id),
  provider text not null,
  external_id text not null,
  title text,
  status text,
  source_updated_at timestamptz,
  normalized_payload jsonb not null default '{}'::jsonb,
  source_payload jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  sync_status text not null default 'ok',
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists partner_references_partner_provider_external_unique
  on public.partner_references (partner_id, provider, external_id);

create index if not exists partner_references_partner_updated_idx
  on public.partner_references (partner_id, updated_at desc);

create index if not exists partner_references_sync_status_idx
  on public.partner_references (sync_status, last_seen_at desc);

alter table public.partner_references enable row level security;

drop policy if exists "partner_references_deny_select" on public.partner_references;
create policy "partner_references_deny_select"
  on public.partner_references for select using (false);
drop policy if exists "partner_references_deny_insert" on public.partner_references;
create policy "partner_references_deny_insert"
  on public.partner_references for insert with check (false);
drop policy if exists "partner_references_deny_update" on public.partner_references;
create policy "partner_references_deny_update"
  on public.partner_references for update using (false);
drop policy if exists "partner_references_deny_delete" on public.partner_references;
create policy "partner_references_deny_delete"
  on public.partner_references for delete using (false);
