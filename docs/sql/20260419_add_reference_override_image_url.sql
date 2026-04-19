alter table public.partner_reference_overrides
  add column if not exists image_url text;
