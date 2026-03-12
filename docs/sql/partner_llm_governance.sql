-- Partner LLM governance controls (admin-managed)
-- Run in target DB before enabling admin controls in UI.

alter table public.partners
  add column if not exists llm_partner_managed_allowed boolean not null default false,
  add column if not exists llm_mode_default text not null default 'central_managed';

update public.partners
set
  llm_partner_managed_allowed = coalesce(llm_partner_managed_allowed, false),
  llm_mode_default = case
    when lower(coalesce(llm_mode_default, '')) in ('central_managed', 'partner_managed')
      then lower(llm_mode_default)
    else 'central_managed'
  end;
