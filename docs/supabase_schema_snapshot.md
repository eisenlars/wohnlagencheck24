# Supabase Schema Snapshot

Stand: vom Team bereitgestellter Export (März 2026).

Diese Datei dokumentiert den aktuell produktionsnahen Tabellenstand in Supabase (Public Schema), damit SQL-Snippets und Prozessdokumente eindeutig auf denselben DB-Zustand referenzieren.

## Kern-Tabellen (Public)

- `areas`
- `partners`
- `partner_area_map`
- `data_value_settings`
- `report_texts`
- `partner_marketing_texts`
- `partner_blog_posts`
- `partner_integrations`
- `partner_listings`
- `partner_property_offers`
- `partner_property_overrides`
- `public_offer_entries`
- `partner_references`
- `partner_reference_overrides`
- `public_reference_entries`
- `partner_requests`
- `partner_request_overrides`
- `public_request_entries`
- `security_audit_log`
- `security_rate_limits`

## Wichtige Modell-Details

- `partners` nutzt:
  - `contact_first_name text not null`
  - `contact_last_name text not null`
  - kein `contact_person` mehr

- `partner_area_map` enthält den Aktivierungs-Workflow:
  - `activation_status`
  - `mandatory_checked_at`
  - `mandatory_missing_keys`
  - `partner_submitted_at`

- `partner_integrations.kind` umfasst:
  - `crm`
  - `llm`
  - `local_site`
  - `other`

## Integrations-Indexregel (aktuell)

Mehrere LLM-Integrationen pro Partner sind erlaubt.  
Für alle anderen `kind`-Typen soll die Eindeutigkeit pro Partner erhalten bleiben.

Empfohlenes SQL:

```sql
drop index if exists public.partner_integrations_kind_unique;

create unique index if not exists partner_integrations_kind_unique_non_llm
  on public.partner_integrations (partner_id, kind)
  where kind <> 'llm';
```

## Hinweis

Der vollständige SQL-Export kann je Umgebung leicht abweichen (z. B. Dev/Staging/Prod).  
Bei Migrationen immer zuerst den echten Zielstand (`to_regclass`, `information_schema`) prüfen.

## Aenderung 2026-03-20

- Performance-Hardening fuer erhoehten Supabase Disk IO vorbereitet.
- Neue Read-Indizes fuer:
  - `areas`
  - `partner_area_map`
  - `report_texts`
  - `partner_marketing_texts`
  - `public_offer_entries`
  - `public_request_entries`
  - `public_reference_entries`
- Public-Projektionen bleiben fachlich unveraendert, sollen aber inkrementell gepflegt werden statt partnerweise komplett geloescht und neu geschrieben zu werden.
- Runbooks:
  - `docs/sql/performance_disk_io_2026-03-20.sql`
  - `docs/sql/public_asset_projections.sql`

## Aenderung 2026-03-04

- `market_data` wird aus dem Public-Schema entfernt (nicht genutzt).
- Hintergrund:
  - Security Advisor meldete `RLS enabled, no policy` fuer `market_data`.
  - Table ist funktional nicht im aktiven Partner-/Frontend-Flow eingebunden.
- Runbook: `docs/sql/security_advisor_followup_2026-03-04.sql`
