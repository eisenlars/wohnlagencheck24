-- Persistent rate limit store for optional backend RATE_LIMIT_BACKEND=supabase

create table if not exists public.security_rate_limits (
  key_hash text primary key,
  count integer not null default 0,
  reset_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create index if not exists security_rate_limits_reset_at_idx
  on public.security_rate_limits (reset_at);

alter table public.security_rate_limits enable row level security;

create policy "security_rate_limits_deny_select"
  on public.security_rate_limits for select using (false);
create policy "security_rate_limits_deny_insert"
  on public.security_rate_limits for insert with check (false);
create policy "security_rate_limits_deny_update"
  on public.security_rate_limits for update using (false);
create policy "security_rate_limits_deny_delete"
  on public.security_rate_limits for delete using (false);
