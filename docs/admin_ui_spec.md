# Admin UI Spezifikation (Partnerverwaltung)

Stand: 2026-02-11

## 1. Zielbild

Die Admin-UI wird die zentrale Schaltstelle fuer:
- Partner-Stammdaten (`partners`)
- Gebietszuordnung (`partner_area_map`)
- Integrationen und Secrets (`partner_integrations`)

Grundsatz:
- **DB ist Source of Truth**
- Python-Backend liest nur noch aus DB (oder uebergangsweise aus DB-exportiertem JSON)
- Keine Klartext-Secrets in statischen Dateien

---

## 2. Scope

### In Scope
- Partner anlegen/aktualisieren/deaktivieren
- Partner-User (Auth) zuordnen
- Gebiete zuweisen/entziehen/aktivieren/deaktivieren
- Integrationen (`crm`, `llm`, `local_site`) verwalten
- Secrets write-only + token rotation
- Audit-Logging sicherheitsrelevanter Aktionen

### Out of Scope (Phase 1)
- Vollstaendige Multi-Admin-Organisation mit Freigabeworkflows
- Fine-grained Rechte pro Feld
- Vollautomatischer Python-Umbau

---

## 3. Datenmodell

### 3.1 `partners`
- `id` (uuid, PK)
- `company_name`
- `contact_email`
- optional: `contact_person`, `website_url`
- optional (neu): `is_active` boolean default true

### 3.2 `partner_area_map`
- `id` (uuid, PK)
- `auth_user_id` (FK -> `partners.id`)
- `area_id` (FK -> `areas.id`)
- `is_active` boolean default true
- `created_at`

Empfohlene Constraint:
- Unique Index auf (`auth_user_id`, `area_id`)

### 3.3 `partner_integrations`
- `id` (uuid, PK)
- `partner_id` (FK -> `partners.id`)
- `kind` (`crm` | `llm` | `local_site` | `other`)
- `provider`
- `base_url`
- `auth_type`
- `auth_config` (nur non-sensitive Metadaten + Hashes)
- `settings`
- `is_active`

Empfohlene Erweiterung:
- Eindeutigkeit mindestens auf (`partner_id`, `kind`)
- optional mehrere CRM pro Partner: (`partner_id`, `kind`, `provider`)

### 3.4 Secrets (neu)
Empfohlen:
- separate Tabelle `partner_integration_secrets`
  - `integration_id` FK
  - `secret_key` (z. B. `api_key`, `token`, `secret`)
  - `secret_value_encrypted`
  - `created_at`, `updated_at`, `rotated_at`

Alternative kurzfristig:
- weiter `auth_config`, aber nur gehashte Tokens und keine Klartextwerte zurueckgeben.

### 3.5 Audit (neu)
- Tabelle `security_audit_log`
  - `id`
  - `actor_user_id`
  - `actor_role`
  - `event_type`
  - `entity_type`
  - `entity_id`
  - `payload` (jsonb, redacted)
  - `ip`
  - `user_agent`
  - `created_at`

---

## 4. Rollenmodell

### Rollen
- `admin_super`
  - darf alles
- `admin_ops`
  - darf Partner/Gebiete/Integrationen pflegen
  - darf keine anderen Admins verwalten
- `partner_user`
  - kein Zugriff auf Admin-UI

Technik:
- Rolle ueber eigenes Profil oder JWT-Claim
- Alle Admin-Endpunkte serverseitig rollenpruefen

---

## 5. API-Design (Next.js, server-only)

Prefix: `/api/admin/*`

### Partner
- `POST /api/admin/partners`
- `PATCH /api/admin/partners/:id`
- `POST /api/admin/partners/:id/deactivate`
- `POST /api/admin/partners/:id/reactivate`

### Gebietszuordnung
- `POST /api/admin/partners/:id/areas` (assign)
- `DELETE /api/admin/partners/:id/areas/:area_id` (unassign)
- `PATCH /api/admin/partners/:id/areas/:area_id` (`is_active`)

### Integrationen
- `POST /api/admin/partners/:id/integrations`
- `PATCH /api/admin/integrations/:integration_id`
- `POST /api/admin/integrations/:integration_id/deactivate`
- `POST /api/admin/integrations/:integration_id/reactivate`

### Secrets / Rotation
- `POST /api/admin/integrations/:integration_id/secrets` (write-only upsert)
- `POST /api/admin/integrations/:integration_id/rotate-token`
- `POST /api/admin/integrations/:integration_id/revoke-token`

### User-Onboarding
- `POST /api/admin/partners/:id/invite-user`
- `POST /api/admin/users/:auth_user_id/force-password-reset`

---

## 6. Sicherheitsanforderungen

1. **Write-only secrets**
- Klartext nur beim Setzen
- niemals im Read-Endpoint

2. **Token Hashing**
- `local_site` token nur als Hash speichern
- Vergleich ueber Hash

3. **RLS + Service Role**
- Admin-Endpunkte laufen serverseitig
- direkte Client-Zugriffe auf sensitive Tabellen per RLS blockiert

4. **Input Validation**
- Zod/valibot fuer alle Payloads
- allowlist fuer `provider`, `kind`, `auth_type`

5. **Rate Limits**
- auf Admin-Endpunkten + Login

6. **Audit Logging**
- jede sicherheitsrelevante Mutation loggen

7. **No secret in logs**
- Payload redaction fuer `api_key`, `token`, `secret`

8. **Route-Gates (hart, serverseitig)**
- `/admin/*` nur fuer Admin-Rollen/IDs
- `/dashboard/*` nur fuer User mit vorhandenem `partners`-Profil
- keine stillen Failures: bei Verstoessen immer klarer Redirect auf Login

9. **Session Scope beachten**
- Admin- und Partner-Login im selben Browser teilen die gleiche Supabase-Session.
- Fuer paralleles Arbeiten (Admin + Partner) getrennte Browser-Profile/Incognito verwenden.

---

## 7. Admin-UI Screens (MVP)

1. Partnerliste
- Suche, Status, letzte Aenderung

2. Partnerdetail
- Stammdaten
- User-Status (eingeladen/aktiv)
- Integrationen (ohne Klartext-Secrets)
- Gebiete (aktiv/inaktiv)

3. Area Assignment
- area picker (Bundesland/Kreis/Ort)
- bulk assign / bulk deactivate

4. Integration Editor
- Felder je `kind/provider`
- Secret-Felder masked + write-only
- Test-Connection Aktion

5. Audit Viewer
- filterbar nach actor, partner, event_type, Zeitraum

---

## 8. Bruecke zu Python

### Ziel
- Python liest Integrationen und Zuordnungen aus DB.

### Uebergang (falls Python noch JSON braucht)
- Nightly/On-demand Export aus DB in kompatibles `partner.json` Format
- Datei nur als temporaerer Kompatibilitaetslayer

### Endzustand
- Kein manueller JSON-Pflegeprozess mehr

---

## 9. Migrationsplan

### Phase 1 (sofort)
- Admin-API MVP + UI MVP
- Existing records in `partner_integrations` sichtbar (masked)
- lokale Website token_hash only

### Phase 2
- Secret-Tabelle + Verschluesselung
- Audit-Log produktiv
- Python liest direkt aus DB

### Phase 3
- Legacy `partner.json` Prozess abschalten
- Query-token fallback entfernen (Header-only)

---

## 10. Akzeptanzkriterien

1. Partner kann nur den ihm zugeordneten Gebieten zugeordnet werden (keine Inkonsistenzen).
2. Kein Klartext-Secret ueber Read-API abrufbar.
3. Jede Integration-Aenderung erzeugt Audit-Log.
4. Token-Rotation invalidiert alte Tokens.
5. Python-Sync laeuft auf Basis DB-Daten ohne manuelle Datei-Edits.
