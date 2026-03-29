# Security und Auth

## Authentifizierungsgrenzen

### Public

- keine Sessionpflicht
- Sichtbarkeit ueber `partner_area_map` und `visibility_index.json`
- Locale-Gates fuer lokalisierte Public-Routen

### Partner

- Session ueber Supabase Server Client
- Partner-Endpunkte lesen den angemeldeten User direkt aus `supabase.auth.getUser()`

### Admin

- Session ueber Supabase Server Client
- Rollenpruefung ueber `lib/security/admin-auth.ts`
- Admin-Rollen kommen aus Umgebungsvariablen:
  - `ADMIN_SUPER_USER_IDS`
  - `ADMIN_OPS_USER_IDS`

## Admin-Rollenmodell

Beobachtete Rollen:

- `admin_super`
- `admin_ops`

`requireAdmin()` blockiert unautorisierte oder nicht berechtigte User mit `UNAUTHORIZED` bzw. `FORBIDDEN`.

## Rate Limiting

`lib/security/rate-limit.ts` stellt zwei Modi bereit:

- In-Memory-Fallback
- optional persistent ueber `security_rate_limits`, wenn `RATE_LIMIT_BACKEND = supabase`

Verwendet wird das System unter anderem fuer:

- Admin-APIs
- Partner-Dashboard-Bootstrap
- Partner-Review-/Live-Request-Endpunkte
- Local-Site-Paket

Der Schluesselaufbau kombiniert in der Regel:

- Route-/Funktionsprefix
- User-ID oder Tokenkontext
- Client-IP

## Audit Log

`lib/security/audit-log.ts` schreibt sicherheitsrelevante Ereignisse nach `security_audit_log`.

### Beobachtete Eigenschaften

- Actor-User-ID
- Actor-Rolle
- Event-Typ
- Entity-Typ und Entity-ID
- Payload
- IP
- User-Agent

Sensible Felder wie `api_key`, `token`, `secret`, `password` oder `authorization` werden im Payload rekursiv redigiert.

## Local-Site-Token-Sicherheit

`lib/security/local-site-auth.ts` arbeitet ausschliesslich mit Token-Hashes.

### Ablauf

1. Bearer-Token aus dem Request extrahieren
2. SHA-256-Hash bilden
3. in `partner_integrations.auth_config.token_hash` suchen
4. nur aktive `local_site`-Integrationen akzeptieren

Klartext-Tokens sind damit nicht Teil des produktiven Lookups.

## Secret- und Outbound-Sicherheit

Die Sicherheitsbibliotheken decken weitere produktive Themen ab:

- `lib/security/secret-crypto.ts`
  Entschluesselung/Verwendung von Secret-Daten
- `lib/security/outbound-url.ts`
  Validierung externer Ziel-URLs
- `lib/security/integration-mask.ts`
  Maskierung sicherheitsrelevanter Integrationsdaten

Diese Bausteine werden unter anderem in Integrations- und i18n-/LLM-Routen verwendet.

## Sicherheitsrelevante Workflow-Kopplungen

- Admin-Publish schreibt immer Audit Logs.
- Partner-Review- und Live-Request-Endpunkte schreiben ebenfalls Audit Logs.
- Preview- und Public-Sichtbarkeit haengen an `partner_area_map` und nicht nur an Frontend-Schaltern.
- Rate Limits sind bereits auf mehreren schreibenden und exportierenden Endpunkten aktiv.

## Aktuelle Sicherheitsannahmen im Code

- Rollen fuer Admins sind derzeit env-basiert, nicht DB-basiert.
- Partner werden primar ueber den Supabase-Auth-User identifiziert.
- Public-Live-Zugaenge fuer Gebiete werden ueber Mapping- und Sichtbarkeitsdaten modelliert.
- Local-Site-Zugriffe sind tokenbasiert und zusaetzlich an aktive Gebietszuordnungen gekoppelt.
