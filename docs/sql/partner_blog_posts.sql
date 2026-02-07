-- partner_blog_posts (Blogartikel je Partner/Region)
create table if not exists public.partner_blog_posts (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null,
  area_id text not null,
  area_name text,
  bundesland_slug text,
  kreis_slug text,
  headline text not null,
  subline text,
  body_md text not null,
  author_name text,
  author_image_url text,
  source_individual_01 text,
  source_individual_02 text,
  source_zitat text,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_partner_blog_posts_created_at
  on public.partner_blog_posts (created_at desc);

create index if not exists idx_partner_blog_posts_status_created_at
  on public.partner_blog_posts (status, created_at desc);
