-- partner_integrations (CRM/LLM/other Integrationen)

create table if not exists public.partner_integrations (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id),
  kind text not null,              -- 'crm' | 'llm' | 'local_site' | 'other'
  provider text not null,          -- 'propstack' | 'onoffice' | ...
  base_url text,
  auth_type text,
  auth_config jsonb,
  detail_url_template text,
  is_active boolean default true,
  settings jsonb,
  last_sync_at timestamptz
);

-- Historisch: 1 Integration pro partner_id+kind.
-- Neu: Mehrere LLM-Integrationen erlaubt, fuer alle anderen kinds weiterhin unique.
drop index if exists public.partner_integrations_kind_unique;
create unique index if not exists partner_integrations_kind_unique_non_llm
  on public.partner_integrations (partner_id, kind)
  where kind <> 'llm';

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
