-- Migration: partner_listings -> crm_raw_offers
--
-- Vor Deploy ausfuehren, wenn die bestehende Datenbank noch `partner_listings`
-- und die alten Sync-Run-Spalten `listings_count` / `deactivated_listings` nutzt.

alter table if exists public.partner_listings
  rename to crm_raw_offers;

alter table if exists public.crm_raw_offers
  rename constraint partner_listings_pkey to crm_raw_offers_pkey;

alter table if exists public.crm_raw_offers
  rename constraint partner_listings_partner_id_fkey to crm_raw_offers_partner_id_fkey;

alter index if exists public.partner_listings_partner_provider_external_unique
  rename to crm_raw_offers_partner_provider_external_unique;

alter index if exists public.partner_listings_partner_updated_idx
  rename to crm_raw_offers_partner_updated_idx;

alter index if exists public.partner_listings_sync_status_idx
  rename to crm_raw_offers_sync_status_idx;

drop policy if exists "partner_listings_deny_select" on public.crm_raw_offers;
drop policy if exists "partner_listings_deny_insert" on public.crm_raw_offers;
drop policy if exists "partner_listings_deny_update" on public.crm_raw_offers;
drop policy if exists "partner_listings_deny_delete" on public.crm_raw_offers;

drop policy if exists "crm_raw_offers_deny_select" on public.crm_raw_offers;
create policy "crm_raw_offers_deny_select"
  on public.crm_raw_offers for select using (false);

drop policy if exists "crm_raw_offers_deny_insert" on public.crm_raw_offers;
create policy "crm_raw_offers_deny_insert"
  on public.crm_raw_offers for insert with check (false);

drop policy if exists "crm_raw_offers_deny_update" on public.crm_raw_offers;
create policy "crm_raw_offers_deny_update"
  on public.crm_raw_offers for update using (false);

drop policy if exists "crm_raw_offers_deny_delete" on public.crm_raw_offers;
create policy "crm_raw_offers_deny_delete"
  on public.crm_raw_offers for delete using (false);

alter table if exists public.integration_sync_runs
  rename column listings_count to raw_offers_count;

alter table if exists public.integration_sync_runs
  rename column deactivated_listings to deactivated_raw_offers;
