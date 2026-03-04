# Sicherheit Partnerbereich

Stand: 2026-03-04

## Ziel
Absicherung von:
- Partner-Login
- KI-Endpunkten
- CRM-Sync
- Local-Site-API
- Mandantentrennung bei Text-Overrides

## Sicherheits-Checkliste (operativ)
1. Route-Gates aktiv:
- `/admin/*` nur Admin
- `/dashboard/*` nur mit `partners`-Profil (`partners.id = auth.user.id`)
2. Session-Kollision vermeiden:
- Admin und Partner nicht parallel im selben Browser-Profil betreiben
- fuer Parallelbetrieb getrennte Browser-Profile/Incognito nutzen
3. Partner-Onboarding nur ueber Admin-Flow:
- Invite per Setz-Link (kein Klartext-Passwortversand)
- Partnerdatensatz in `public.partners` muss zur Auth-User-ID existieren
4. Secrets nie im Klartext auslesen:
- write-only fuer Token/API-Keys
- Hashing/Masking fuer `local_site`-Token
5. Audit fuer sicherheitsrelevante Mutationen:
- Create/Update/Deactivate/Invite/Transfer protokollieren
6. Offboarding/Uebergabe nur ueber definierten Prozess:
- Gebiet deaktivieren/uebertragen
- Partner nur deaktivieren, wenn keine aktiven Gebiete verbleiben

## Umgesetzt (Code/Stand)
- Debug-Endpoint entfernt: `app/api/debug/env/route.ts`
- `partner-sync` fail-closed (`CRON_SECRET` zwingend): `app/api/partner-sync/route.ts`
- Hartes Partnerprofil-Gate fuer `/dashboard/*`: `app/dashboard/layout.tsx`
- KI-Endpunkte nur mit Login + Rate-Limit:
  - `app/api/ai-rewrite/route.ts`
  - `app/api/ai-blog/route.ts`
- Partner-Submit-Review mit Login + Rate-Limit:
  - `app/api/partner/areas/[area_id]/submit-review/route.ts`
- Login-Rate-Limit in Server Action: `app/partner/login/actions.ts`
- Rate-Limit-Utility:
  - in-memory fallback
  - optional persistent via Supabase (`RATE_LIMIT_BACKEND=supabase`)
  - `lib/security/rate-limit.ts`
- Local-Site-Auth:
  - ausschließlich `Authorization: Bearer <token>`
  - kein Query-Token-Fallback mehr (Leak-Prävention über URL/Logs)
  - Token-Hash-Support (`auth_config.token_hash`)
  - `lib/security/local-site-auth.ts`
- Mandantentrennung `report_texts`:
  - Overrides nur bei eindeutigem Partner je Area
  - `features/immobilienmarkt/page/buildPageModel.ts`
  - `lib/data.ts`

## Betriebskonfiguration (Minimum)
- `CRON_SECRET` muss gesetzt sein.
- `ADMIN_SUPER_USER_IDS` muss gepflegt sein.
- Optional: `RATE_LIMIT_BACKEND=supabase` aktivieren.
- Optionaler Legacy-Schalter (nur temporaer fuer Migration):
  - `ALLOW_LEGACY_QUERY_TOKENS=1` erlaubt Query-Token auf internen Endpoints (`partner-sync`, `bootstrap-area-texts`).
  - `LOCAL_SITE_ALLOW_PLAINTEXT_TOKEN_FALLBACK=1` erlaubt Local-Site Plaintext-Token-Fallback.
  - Zielzustand Livegang: beide **nicht gesetzt**.
- Optional Basic-Schutz:
  - `BASIC_AUTH_USER`
  - `BASIC_AUTH_PASS`

## Monitoring-Checks (regelmaessig)
1. Gibt es `auth.users` ohne zugehoeriges `partners`-Profil?
2. Sind aktive `partner_area_map`-Zuordnungen konsistent?
3. Gibt es fehlgeschlagene Login-/Admin-Aktionen mit Haeufung (Rate-Limit/Audit)?

## Security Advisor Follow-up (2026-03-04)

### WARN: Leaked Password Protection Disabled
- Status: offen bis in Supabase Auth aktiviert.
- Einordnung: sicherheitsrelevant vor Livegang.
- Umsetzung in Supabase:
1. Dashboard -> Authentication -> (Security/Password settings).
2. "Leaked password protection" aktivieren.
3. Speichern und einen Test mit bewusst schwachem/geleaktem Passwort machen.

Hinweis: Das ist eine Auth-Provider-Einstellung, kein SQL-Migrationsschritt.

### INFO: `public.market_data` (RLS enabled, no policy)
- Entscheidung: Tabelle wird nicht genutzt und wird entfernt.
- Umsetzung: Runbook `docs/sql/security_advisor_followup_2026-03-04.sql`.
- Erwartetes Ergebnis: Info-Hinweis verschwindet nach dem Drop der Tabelle.

## Passwort-/Nutzerprozess (vergeben, keine Self-Registration)
Empfohlen:
1. Admin erstellt User.
2. Einmaliger Passwort-Set-Link (kurze TTL).
3. Pflichtwechsel beim ersten Login.
4. Optional MFA für Partner-Admins.

## SQL/Runbooks
- Rate-Limit-Store: `docs/sql/security_rate_limits.sql`
- Local-Site Token-Hash-Migration: `docs/sql/local_site_token_hash_migration.sql`
- Offboarding/Uebergabe: `docs/partner_handover_process.md`
- Live Security Preflight (read-only): `docs/sql/live_security_preflight.sql`
- Live RLS Hardening (write migration): `docs/sql/live_rls_hardening.sql`
- Policy Cleanup (redundante Policies entfernen): `docs/sql/policy_cleanup.sql`
- Security Advisor Follow-up (Leaked Password + market_data): `docs/sql/security_advisor_followup_2026-03-04.sql`
