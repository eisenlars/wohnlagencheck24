# Integration Settings Schema (Entwurf)

## Zweck

Dieses Dokument definiert den geplanten Strukturvertrag fuer `partner_integrations.settings`.
Der Vertrag dient als gemeinsame Grundlage fuer:

- API-Validierung (POST/PATCH von Integrationen)
- UI-Formulare im Partner- und Admin-Bereich
- Sync-Prozesse fuer Objekte, Gesuche und Referenzen

Wichtig: Stand heute ist dies ein **Dokumentations-Entwurf**. Die Validierung ist erst wirksam, wenn sie aktiv in den API-Routen eingebaut wird.

## Scope

Der Entwurf gilt fuer Integrationen in `public.partner_integrations`, insbesondere:

- `kind = crm`
- `kind = llm`
- perspektivisch weitere Quellen (`local_site`, `other`)

## Zielstruktur in `settings`

```json
{
  "capabilities": {
    "listings": true,
    "requests": false,
    "references": false
  },
  "resource_endpoints": {
    "listings_path": "/api/v1/properties",
    "requests_path": "/api/v1/search-profiles",
    "references_path": "/api/v1/references"
  },
  "resource_filters": {
    "listings": { "status": ["active"] },
    "requests": { "status": ["active"] },
    "references": { "status": ["published"] }
  },
  "sync_mode": "polling",
  "cursor_config": {
    "field": "updated_at",
    "value": "2026-02-11T12:00:00Z",
    "page_size": 100
  }
}
```

## Felddefinitionen

### `capabilities` (Pflicht)

Steuert, welche Ressourcentypen fuer eine Integration technisch unterstuetzt und synchronisiert werden.

- `listings` (`boolean`): Objekte
- `requests` (`boolean`): Gesuche
- `references` (`boolean`): Referenzen

### `resource_endpoints` (optional, je Provider empfohlen)

Provider-spezifische Endpoint-Pfade relativ zur `base_url`.

- `listings_path` (`string`)
- `requests_path` (`string`)
- `references_path` (`string`)

### `resource_filters` (optional)

Provider-spezifische Filterstruktur je Ressourcentyp, z. B. Status, Vermarktungsart, Mandant.

- `listings` (`object`)
- `requests` (`object`)
- `references` (`object`)

### `sync_mode` (optional, empfohlen)

- `polling`
- `webhook`
- `hybrid`

### `cursor_config` (optional, fuer Delta-Sync empfohlen)

- `field` (`string`, Pflicht wenn `cursor_config` gesetzt): z. B. `updated_at`
- `value` (`any`): letzter Cursorwert
- `page_size` (`integer >= 1`)

## JSON-Schema-Entwurf

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Partner Integration Settings",
  "type": "object",
  "additionalProperties": true,
  "properties": {
    "capabilities": {
      "type": "object",
      "properties": {
        "listings": { "type": "boolean" },
        "requests": { "type": "boolean" },
        "references": { "type": "boolean" }
      },
      "required": ["listings", "requests", "references"],
      "additionalProperties": false
    },
    "resource_endpoints": {
      "type": "object",
      "properties": {
        "listings_path": { "type": "string" },
        "requests_path": { "type": "string" },
        "references_path": { "type": "string" }
      },
      "additionalProperties": false
    },
    "resource_filters": {
      "type": "object",
      "properties": {
        "listings": { "type": "object", "additionalProperties": true },
        "requests": { "type": "object", "additionalProperties": true },
        "references": { "type": "object", "additionalProperties": true }
      },
      "additionalProperties": false
    },
    "sync_mode": {
      "type": "string",
      "enum": ["polling", "webhook", "hybrid"]
    },
    "cursor_config": {
      "type": "object",
      "properties": {
        "field": { "type": "string" },
        "value": {},
        "page_size": { "type": "integer", "minimum": 1 }
      },
      "required": ["field"],
      "additionalProperties": true
    }
  }
}
```

## Provider-Defaults (Startpunkt)

Diese Defaults sind als initiale Orientierung fuer das erste Andocken gedacht:

- `propstack`
  - `capabilities`: `listings=true`, `requests=true`, `references=true`
  - `sync_mode`: `polling`
  - `cursor_config.field`: `updated_at`
- `onoffice`
  - `capabilities`: providerabhaengig, initial mit `listings=true`
  - `sync_mode`: `hybrid` (wenn Webhooks verfuegbar, sonst `polling`)
- `flowfact`
  - `capabilities`: initial `listings=true`, Referenzen nach API-Pruefung
  - `sync_mode`: `polling`
- `openimmo`
  - typischerweise objektzentriert; `requests/references` haeufig eingeschraenkt
  - `capabilities` initial konservativ setzen

## Umsetzungs-Checkliste

1. API-Validierung aktivieren
- `settings` bei `POST/PATCH` gegen Schema pruefen
- bei Fehler: `400` mit Feldbezug

2. UI-Formulare an Schema binden
- nur definierte Felder anzeigen/speichern
- `capabilities` als klare Toggle-Controls

3. Sync an `settings` koppeln
- Ressourcentypen nur bei `capabilities.* = true`
- Endpoints/Filter/Cursor aus `settings` lesen

4. Monitoring
- Sync-Lauf mit Input-Snapshot (`settings`) protokollieren
- Fehler je Ressourcentyp getrennt auswertbar machen

## Hinweis

Bis zur technischen Validierung in den API-Routen bleibt die Struktur in `settings` formal flexibel.
Dieses Dokument beschreibt den Zielzustand fuer den produktiven Betrieb der ersten externen Systeme.
