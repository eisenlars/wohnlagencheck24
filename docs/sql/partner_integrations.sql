-- partner_integrations (CRM/LLM/other Integrationen)

create table if not exists public.partner_integrations (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id),
  kind text not null,              -- 'crm' | 'llm' | 'other'
  provider text not null,          -- 'propstack' | 'onoffice' | ...
  base_url text,
  auth_type text,
  auth_config jsonb,
  detail_url_template text,
  is_active boolean default true,
  settings jsonb,
  last_sync_at timestamptz
);

create unique index if not exists partner_integrations_kind_unique
  on public.partner_integrations (partner_id, kind);

alter table public.partner_integrations enable row level security;

drop policy if exists "partner_integrations_deny_select" on public.partner_integrations;
create policy "partner_integrations_deny_select"
  on public.partner_integrations for select using (false);
drop policy if exists "partner_integrations_deny_insert" on public.partner_integrations;
create policy "partner_integrations_deny_insert"
  on public.partner_integrations for insert with check (false);
drop policy if exists "partner_integrations_deny_update" on public.partner_integrations;
create policy "partner_integrations_deny_update"
  on public.partner_integrations for update using (false);
drop policy if exists "partner_integrations_deny_delete" on public.partner_integrations;
create policy "partner_integrations_deny_delete"
  on public.partner_integrations for delete using (false);
