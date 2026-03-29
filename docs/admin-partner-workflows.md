# Admin- und Partner-Workflows

## Beteiligte Flaechen

- `app/admin`
  Admin-Zugang
- `app/dashboard`
  Partner-Dashboard und Partner-UI
- `app/api/admin/*`
  Admin-Endpunkte
- `app/api/partner/*`
  Partner-Endpunkte

## Partner-Dashboard-Bootstrap

`app/api/partner/dashboard/bootstrap/route.ts` baut den Startzustand des Partner-Dashboards auf.
Der Endpoint kombiniert:

- authentifizierten Partner-User
- Rate Limit
- `partner_area_map` inkl. Fallbacks fuer fehlende Spalten
- Mandatory-Status pro Gebiet
- Partner-Locale-Availability
- Billing-Feature-Kontext
- Partnerprofil- und Kontaktdaten

Der Bootstrap ist damit die technische Sammelstelle fuer fast alle Partner-UI-Schritte.

## Gebietslebenszyklus

Im Code beobachtete Status- und Freigabezustaende:

- `in_progress`
- `ready_for_review`
- `approved_preview`
- `live`
- `active`

Die Statusinterpretation erfolgt nicht nur ueber `activation_status`, sondern teils auch ueber:

- `is_active`
- `is_public_live`
- `partner_preview_signoff_at`

## Partner-Workflow

### 1. Pflichtangaben aufbauen

Partner bearbeiten ein Gebiet ueber Texte, Medien und Profildaten. Die Pflichtpruefung laeuft ueber:

- `app/api/partner/areas/[area_id]/mandatory-status/route.ts`
- `lib/partner-area-mandatory.ts`

Geprueft werden:

- individuelle Pflichttexte aus `INDIVIDUAL_MANDATORY_KEYS`
- Pflichtmedien aus `MANDATORY_MEDIA_KEYS`
- optional Freigabestatus der Medien

### 2. Review einreichen

`app/api/partner/areas/[area_id]/submit-review/route.ts`:

- prueft die Pflichtangaben
- setzt bei Erfolg `ready_for_review`
- setzt `partner_submitted_at`
- leert `admin_review_note`
- verschickt Admin- und Partner-Mails
- schreibt Security-Audit-Logs

Wenn Pflichtangaben fehlen, wird das Gebiet auf `in_progress` zurueckgefuehrt.

### 3. Livegang anfragen

`app/api/partner/areas/[area_id]/request-live/route.ts`:

- setzt `partner_preview_signoff_at`
- erlaubt den Schritt nur aus einem Preview-faehigen Zustand heraus
- versendet Admin- und Partner-Benachrichtigungen
- schreibt Audit-Logs

## Admin-Workflow

### Review und Medienpruefung

Vorhandene Endpunkte zeigen, dass Admin getrennte Pruefflaechen fuer:

- Gebietsreview
- Medienreview
- Gebietszuweisung
- Integrationen
- LLM-Management
- Portal-CMS

bereitstellt. Die Reviewlogik ist damit nicht monolithisch, sondern in Workflow-Schritte aufgeteilt.

### Live publizieren

`app/api/admin/partners/[id]/areas/[area_id]/publish/route.ts` fuehrt die produktive Liveschaltung aus.
Dabei werden unter anderem geprueft:

- Admin-Rolle
- Admin-Rate-Limit
- Existenz von Partner und Gebietszuordnung
- Preview-Readiness
- Partner-Signoff fuer Nicht-Systempartner
- Systempartner-Default-Mandatory-Status

Bei erfolgreichem Publish passieren mehrere Seiteneffekte:

- `partner_area_map` wird auf live gesetzt
- Security-Audit-Log wird geschrieben
- `visibility_index.json` wird neu publiziert
- Public-Asset-Projektionen werden neu gebaut
- Live-Benachrichtigungen werden verschickt

## Preview- und Public-Partnerkontext

`lib/public-partner-mappings.ts` liefert die zentrale Gebietszuordnung fuer:

- Public-Live-Partner je Gebiet
- Preview-Zugriff je Gebiet
- Gebietslisten fuer Public-Leadflows
- Gebietslisten fuer Preview-Leadflows
- Systempartner-Kontext pro Gebiet

Diese Zuordnung basiert auf `partner_area_map` und faengt mehrere Legacy-/Migrationsfaelle ab.

## Systempartner-Sonderfall

Ist ein aktiver Public-Partner als `is_system_default` markiert, greift im Render- und Live-Workflow
zusaetzlich das Default-Profil aus:

- `lib/systempartner-default-profile.ts`

Dieses Profil liefert Basiswerte fuer:

- `berater_name`
- `berater_email`
- `berater_telefon_fest`
- `berater_telefon_mobil`
- `media_berater_avatar`

Der Admin-Publish blockiert den Livegang eines Systempartners, solange die dafuer definierten Pflichtfelder fehlen.

## Locale-Verfuegbarkeit fuer Partner

`lib/partner-locale-availability.ts` baut die Partner-Sicht auf verfuegbare Locales aus:

- globaler Locale-Registry
- Billing-Feature-Katalog
- Partner-Feature-Overrides

Damit ist Mehrsprachigkeit nicht nur technisch schaltbar, sondern auch billing- und partnerbezogen modelliert.
