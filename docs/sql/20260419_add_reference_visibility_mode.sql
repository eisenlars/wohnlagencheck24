alter table public.partner_area_map
  add column if not exists reference_visibility_mode text not null default 'partner_wide';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'partner_area_map_reference_visibility_mode_check'
      and conrelid = 'public.partner_area_map'::regclass
  ) then
    alter table public.partner_area_map
      add constraint partner_area_map_reference_visibility_mode_check
      check (reference_visibility_mode in ('partner_wide', 'strict_local'));
  end if;
end $$;
