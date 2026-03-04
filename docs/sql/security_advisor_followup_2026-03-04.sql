-- Security Advisor Follow-up (2026-03-04)
-- Scope:
-- 1) Dokumentation: Leaked Password Protection in Supabase Auth aktivieren (UI-Setting, kein SQL).
-- 2) DB-Cleanup: ungenutzte Tabelle public.market_data entfernen.

-- Optionaler Check vor dem Drop
select to_regclass('public.market_data') as market_data_exists;

-- Optionaler Check auf Datenbestand (nur falls Tabelle existiert)
do $$
begin
  if to_regclass('public.market_data') is not null then
    raise notice 'market_data_rows=%', (select count(*) from public.market_data);
  else
    raise notice 'public.market_data not found (skip row count)';
  end if;
end
$$;

-- Entfernt abhängige FK-Constraints/Objekte automatisch mit.
drop table if exists public.market_data cascade;

-- Optionaler Check nach dem Drop
select to_regclass('public.market_data') as market_data_exists_after_drop;
