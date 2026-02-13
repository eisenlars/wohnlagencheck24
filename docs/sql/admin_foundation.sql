-- Admin foundation migration (ADM-001..003)
-- Run in maintenance window if partner_area_map contains duplicates.

-- 1) partners: active flag
alter table public.partners
  add column if not exists is_active boolean not null default true;

-- 2) partner_area_map dedupe + uniqueness
-- Keep oldest row per (auth_user_id, area_id), remove newer duplicates.
with ranked as (
  select
    id,
    auth_user_id,
    area_id,
    created_at,
    row_number() over (
      partition by auth_user_id, area_id
      order by created_at asc nulls last, id asc
    ) as rn
  from public.partner_area_map
)
delete from public.partner_area_map pam
using ranked r
where pam.id = r.id
  and r.rn > 1;

create unique index if not exists partner_area_map_unique_user_area
  on public.partner_area_map (auth_user_id, area_id);

-- 3) security audit log
create table if not exists public.security_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid,
  actor_role text not null,
  event_type text not null,
  entity_type text not null,
  entity_id text not null,
  payload jsonb,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists security_audit_log_created_at_idx
  on public.security_audit_log (created_at desc);

create index if not exists security_audit_log_entity_idx
  on public.security_audit_log (entity_type, entity_id);

alter table public.security_audit_log enable row level security;

drop policy if exists "security_audit_log_deny_select" on public.security_audit_log;
create policy "security_audit_log_deny_select"
  on public.security_audit_log for select using (false);
drop policy if exists "security_audit_log_deny_insert" on public.security_audit_log;
create policy "security_audit_log_deny_insert"
  on public.security_audit_log for insert with check (false);
drop policy if exists "security_audit_log_deny_update" on public.security_audit_log;
create policy "security_audit_log_deny_update"
  on public.security_audit_log for update using (false);
drop policy if exists "security_audit_log_deny_delete" on public.security_audit_log;
create policy "security_audit_log_deny_delete"
  on public.security_audit_log for delete using (false);
