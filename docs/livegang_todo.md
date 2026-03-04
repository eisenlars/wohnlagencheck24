# Livegang TODO

## Vercel Build-Gating

- [ ] Ignored Build Step in Vercel gesetzt
  - [ ] Command: `bash scripts/vercel-ignore.sh`
  - [ ] Test 1: reine Doku-Aenderung (`docs/*.md`) -> Build wird uebersprungen
  - [ ] Test 2: Runtime-Aenderung (`app/` oder `lib/`) -> Build laeuft

## Security & DB Preflight

- [ ] Supabase Security Advisor ohne offene WARN-Findings
  - [ ] `Leaked Password Protection` in Supabase Auth aktivieren
  - [ ] Test: geleaktes/schwaches Passwort wird abgelehnt
- [ ] Purge-Dumps nur in privatem Admin-Bucket speichern (nicht im öffentlichen Report-/Asset-Bucket)
  - [ ] separaten Storage-Bucket anlegen (z. B. `admin-private`)
  - [ ] öffentliche Leserechte für diesen Bucket ausschließen
  - [ ] Retention/Loeschkonzept fuer Purge-Dumps festlegen (z. B. 30/90 Tage)
- [ ] Legacy-Token-Pfade deaktiviert und dokumentiert
  - [ ] keine Query-Token-Nutzung mehr fuer `partner-sync`/`bootstrap-area-texts`
  - [ ] Local-Site-Plaintext-Token-Fallback deaktiviert
- [ ] `PARTNER_INVITE_REDIRECT_URL` in Vercel gesetzt (kein Origin-Fallback)
- [ ] Supabase Performance Advisor Kernpunkte abgearbeitet
  - [ ] FK-Indexe angelegt:
    - [ ] `idx_market_data_area_id` (falls Tabelle noch vorhanden)
    - [ ] `idx_partner_marketing_texts_area_id`
    - [ ] `idx_report_texts_area_id`
  - [ ] `unindexed_foreign_keys` erneut prüfen (sollte leer sein)
- [ ] Nicht genutzte Tabelle `public.market_data` entfernt (wenn weiterhin fachlich ungenutzt)
  - [ ] SQL-Runbook ausgeführt: `docs/sql/security_advisor_followup_2026-03-04.sql`
  - [ ] Security Advisor INFO `RLS enabled no policy` für `market_data` verschwunden

## Partner-Freigabeprozess

- [ ] Admin-Mailbenachrichtigung produktiv aktivieren
  - [ ] SMTP-Providerdaten prüfen (Host, Port, User, Passwort)
  - [ ] Produktions-Absenderadresse prüfen (`noreply@wohnlagencheck24.de`)
  - [ ] ENV in Vercel setzen:
    - [ ] `ADMIN_REVIEW_NOTIFY_SIMULATE=0`
    - [ ] `SMTP_HOST`
    - [ ] `SMTP_PORT`
    - [ ] `SMTP_SECURE` (`1` oder `0`)
    - [ ] `SMTP_USER`
    - [ ] `SMTP_PASS`
    - [ ] `SMTP_FROM` (optional, Default: `noreply@wohnlagencheck24.de`)
    - [ ] `ADMIN_REVIEW_NOTIFY_FROM` (optional, überschreibt `SMTP_FROM`)
    - [ ] `ADMIN_REVIEW_NOTIFY_TO` (CSV)
  - [ ] End-to-End-Test mit Testpartner durchführen (Submit -> Maileingang Admin)

- [ ] Partner-Mail bei Gebietszuweisung aktiv (Admin -> Gebiet zuordnen)
  - [ ] End-to-End-Test mit Testpartner durchführen (Assign -> Maileingang Partner)
  - [ ] Audit-Log prüfen (`mail_admin_assign_partner_notify`, `sent=true`)

- [ ] Admin-Prüfworkflow final abnehmen
  - [ ] `ready_for_review -> in_review -> approve` testen
  - [ ] `changes_requested` testen
  - [ ] Audit-Log-Einträge prüfen
    - [ ] `mail_partner_submit_review_admin_notify`
    - [ ] `mail_partner_submit_review_partner_confirm`
    - [ ] `mail_admin_approve_partner_notify`
  - [ ] Bei Fehlern `payload.reason` dokumentieren und ENV korrigieren

## Partner Onboarding & UX

- [ ] Neuer Partner: Invite-Link, Passwort setzen, erster Login erfolgreich
- [ ] Admin sieht offene Gebietszuweisung klar:
  - [ ] roter Punkt am Partner-Button
  - [ ] Partner ohne Zuordnung in Liste oben
  - [ ] Hinweisbox im Tab `Gebiete`
- [ ] Partner-Dashboard ohne Zuordnung:
  - [ ] Card `Warte auf Gebietszuweisung` sichtbar
  - [ ] Fachtexte/Buttons korrekt gesperrt bis Zuweisung

## Dokumentation & Nachweis

- [ ] Dokumente auf aktuellen Stand:
  - [ ] `docs/security_partnerbereich.md`
  - [ ] `docs/supabase_schema_snapshot.md`
  - [ ] `docs/sql/security_advisor_followup_2026-03-04.sql`
- [ ] Abschlussnachweis abgelegt (Datum, Tester, Ergebnis, offene Restpunkte)

## Temporärer Testmodus (lokal)

- Für lokale Tests ohne echten Mailprovider:
  - `ADMIN_REVIEW_NOTIFY_SIMULATE=1`
  - Ergebnis: Freigabeprozess bleibt funktionsfähig, Mailversand wird als erfolgreich simuliert.
