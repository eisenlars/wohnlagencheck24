-- Enable 'marketing' as valid channel in partner_texts_i18n
-- Run once per database.

do $$
declare
  ch_constraint_name text;
begin
  select c.conname
  into ch_constraint_name
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'partner_texts_i18n'
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) ilike '%channel%';

  if ch_constraint_name is not null then
    execute format('alter table public.partner_texts_i18n drop constraint %I', ch_constraint_name);
  end if;

  alter table public.partner_texts_i18n
    add constraint partner_texts_i18n_channel_check
    check (channel in ('portal', 'local_site', 'marketing'));
end $$;
