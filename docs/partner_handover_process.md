# Partner Offboarding & Gebietsuebergabe (Runbook)

## Zweck

Dieses Runbook beschreibt den sicheren Prozess, wenn ein Partner kuendigt und ein Gebiet (Kreis) an einen neuen Partner uebergeben wird.

Ziele:

- keine Doppelvergabe aktiver Gebiete
- keine unkontrollierte Datenmigration
- reproduzierbarer Admin-Prozess
- lueckenlose Nachvollziehbarkeit im Audit-Log

## Fachliche Leitlinie

- Inhalte sind **partnergebunden** (Historie bleibt beim alten Partner), ausser es wird explizit ein Migrationsauftrag definiert.
- Gebietszuordnung ist **kreisgebunden** und darf aktiv nur bei einem Partner liegen.
- Secrets werden nie zwischen Partnern uebertragen.

## Betroffene Tabellen/Objekte

Pflichtpruefung bei jeder Uebergabe:

1. `public.partners`
2. `public.partner_area_map`
3. `public.partner_integrations`
4. `public.security_audit_log`
5. Supabase `auth.users` (Admin API)

Pruefung je nach Fachregel:

1. `public.partner_property_offers`
2. `public.partner_property_overrides`
3. `public.partner_marketing_texts`
4. `public.partner_local_site_texts`
5. `public.partner_blog_posts`
6. `public.data_value_settings`

Hinweis: Diese Tabellen werden standardmaessig **nicht** migriert, sondern verbleiben beim alten Partner (Historie).

## Standardprozess (Uebergabe)

1. Preflight
- alter Partner, neuer Partner, Kreis-ID validieren
- sicherstellen, dass Kreis-ID dem Kreisformat entspricht (3 Segmente)
- sicherstellen, dass kein zweiter aktiver Besitzer fuer den Kreis existiert

2. Offboarding alter Partner (fachlich konfigurierbar)
- alte aktive Zuordnung in `partner_area_map` auf `is_active = false`
- alte Integrationen in `partner_integrations` auf `is_active = false`
- optional alten Partner in `partners.is_active = false`
- optional Login fuer alten Auth-User sperren

3. Onboarding neuer Partner
- Auth-Invite (Setz-Link) senden
- neue aktive Kreiszuordnung in `partner_area_map` anlegen
- erforderliche Integrationen fuer den neuen Partner aktivieren/anlegen

4. Audit
- pro Schritt Audit-Events schreiben:
  - `handover_start`
  - `deactivate_old_mapping`
  - `deactivate_old_integrations`
  - `assign_new_mapping`
  - `handover_done`

## SQL-Runbook (manuell)

Die folgenden SQLs sind als manuelles Fallback gedacht (z. B. Incidents), wenn kein Wizard genutzt wird.

### A) Preflight

```sql
-- Parameter
-- :kreis_id
-- :old_partner_id
-- :new_partner_id

-- 1) Partner vorhanden?
select id, company_name, is_active
from public.partners
where id in (:old_partner_id, :new_partner_id);

-- 2) Aktive Zuordnungen fuer den Kreis
select pam.id, pam.auth_user_id, p.company_name, pam.area_id, pam.is_active, pam.created_at
from public.partner_area_map pam
left join public.partners p on p.id = pam.auth_user_id
where pam.area_id = :kreis_id
order by pam.is_active desc, pam.created_at asc nulls last;
```

### B) Uebergabe (transaktional)

```sql
begin;

-- 1) Alte aktive Kreiszuordnung deaktivieren
update public.partner_area_map
set is_active = false
where area_id = :kreis_id
  and auth_user_id = :old_partner_id
  and is_active = true;

-- 2) Alte Integrationen deaktivieren
update public.partner_integrations
set is_active = false
where partner_id = :old_partner_id
  and is_active = true;

-- 3) Neue aktive Zuordnung setzen
insert into public.partner_area_map (auth_user_id, area_id, is_active)
values (:new_partner_id, :kreis_id, true)
on conflict (auth_user_id, area_id)
do update set is_active = excluded.is_active;

commit;
```

### C) Post-Checks

```sql
-- Es darf nur eine aktive Zuordnung fuer den Kreis geben
select area_id, count(*) as active_count
from public.partner_area_map
where area_id = :kreis_id
  and is_active = true
group by area_id;

-- Integrationen alter Partner sind deaktiviert?
select kind, provider, is_active
from public.partner_integrations
where partner_id = :old_partner_id
order by kind;
```

## Rollback-Plan (kurz)

Wenn Uebergabe fehlschlaegt:

1. offene Transaktion `rollback;`
2. falls bereits committed:
- neue Zuordnung auf `is_active=false`
- alte Zuordnung wieder `is_active=true`
- alte Integrationen wieder aktivieren (falls fachlich erforderlich)
3. Incident im Audit-Log dokumentieren (`handover_rollback`)

## Implementierungs-Checkliste fuer den Wizard

1. API-Endpunkt `POST /api/admin/handovers` (neu)
2. serverseitige Guards:
- nur Kreis-ID erlaubt
- keine aktive Doppelvergabe
- Admin-Rolle erforderlich
3. atomare Ausfuehrung (RPC/Transaction)
4. Audit-Events fuer jeden Teilschritt
5. UI-Flow:
- Altpartner + Kreis waehlen
- Neupartner waehlen/erstellen
- dry-run Anzeige
- final bestaetigen

## Datenmigration (optional, nur bei Auftrag)

Wenn Inhalte ausnahmsweise migriert werden sollen, muessen Quelle/Ziel und Umfang pro Tabelle explizit freigegeben werden.
Standard bleibt: keine automatische Migration von Content/Overrides/Offers.
