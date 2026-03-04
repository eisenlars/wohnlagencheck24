-- Live Security Preflight (read-only checks)
-- Run before production migrations/deploys.

-- 1) RLS status for critical tables
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in (
    'partners',
    'partner_area_map',
    'report_texts',
    'partner_integrations',
    'partner_marketing_texts',
    'partner_local_site_texts',
    'data_value_settings',
    'areas',
    'market_data',
    'security_audit_log',
    'security_rate_limits'
  )
order by c.relname;

-- 2) Policy coverage for critical tables
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
from pg_policies
where schemaname = 'public'
  and tablename in (
    'partners',
    'partner_area_map',
    'report_texts',
    'partner_integrations',
    'partner_marketing_texts',
    'partner_local_site_texts',
    'data_value_settings',
    'areas',
    'market_data',
    'security_audit_log',
    'security_rate_limits'
  )
order by tablename, policyname;

-- 3) Foreign keys + delete rules (CASCADE risk scan)
select
  tc.table_name,
  kcu.column_name,
  ccu.table_name as foreign_table_name,
  ccu.column_name as foreign_column_name,
  rc.delete_rule,
  rc.update_rule
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
 and tc.table_schema = kcu.table_schema
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name
 and ccu.table_schema = tc.table_schema
join information_schema.referential_constraints rc
  on rc.constraint_name = tc.constraint_name
 and rc.constraint_schema = tc.table_schema
where tc.table_schema = 'public'
  and tc.constraint_type = 'FOREIGN KEY'
order by tc.table_name, kcu.column_name;

-- 4) Partner integration index state (LLM-multiple support)
select
  schemaname,
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'partner_integrations'
order by indexname;

-- 5) Schema drift sentinels
select
  table_name,
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'partners' and column_name in ('contact_person', 'contact_first_name', 'contact_last_name', 'is_active'))
    or (table_name = 'partner_area_map' and column_name in ('activation_status', 'mandatory_checked_at', 'mandatory_missing_keys', 'partner_submitted_at'))
  )
order by table_name, column_name;

