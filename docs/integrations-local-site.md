# Integrationen und Local-Site

## Integrationsmodell

Integrationen werden partnerbezogen ueber `partner_integrations` und zugehoerige Admin-/Partner-APIs verwaltet.
Die Codebasis unterscheidet dabei klar zwischen:

- Konfigurationsnormalisierung
- Secret-Handling
- Test-/Preview-Sync
- produktivem Sync
- lokalen Paketexporten

## CRM-Integrationssettings

`lib/integrations/settings.ts` normalisiert heterogene Integrationssettings in stabile Laufzeitmodelle.

### Beobachtete Ressourcen

- `offers`
- `references`
- `requests`

### Beobachtete Steuerungsachsen

- `enabled`
- `guarded`-Limits
- `sync`-Limits
- `auto_sync`
- `request_freshness`

### Zweck der Normalisierung

- Legacy-Strukturen auffangen
- positive Integer und Booleans normalisieren
- guarded/full-Sync sauber trennen
- Freshness-Regeln fuer Gesuche zentral bewerten

## Partner- und Admin-Integrationsendpunkte

Beobachtete API-Flaechen:

- `app/api/admin/integrations/*`
- `app/api/partner/integrations/*`

Unterstuetzt werden unter anderem:

- CRUD fuer Integrationen
- Secret-Verwaltung
- Testlaeufe
- Preview-Sync
- produktive Syncs
- Deaktivierung und Reaktivierung

## Local-Site-Paket

`app/api/local-site-package/route.ts` erzeugt ein ZIP fuer lokale Partnerseiten.

### Authentifizierung

- Bearer-Token im `Authorization`-Header
- Token wird gehasht
- Lookup in `partner_integrations` fuer `kind = local_site`
- zusaetzlich aktive Gebietszuordnung in `partner_area_map`

### Eingang

- `bundesland`
- `kreis`
- Bearer-Token

### Ausgabe

- `<kreis>.json`
- `ortslagen/<ort>.json`

### Paketaufbau

- Kreisreport und Ortslagenreports werden aus Public Storage gelesen
- `applyDataDrivenTexts()` wird erneut angewendet
- Gruppen `berater` und `makler` werden aus dem Basistext entfernt
- Texte werden mit Prioritaet `partner_local_site_texts -> report_texts -> raw` gemerged
- ein `local_site`-Block mit `partner_id`, `area_id` und `generated_at` wird angereichert

## Local-Site-Textquellen

`lib/local-site-text-merge.ts` laedt parallel:

- `partner_local_site_texts`
- `report_texts`

und baut daraus pro Gebiet eine Section-Map. Nur freigegebene Inhalte ueberschreiben den Rohtext.

## Partner-i18n

`app/api/partner/i18n/texts/route.ts` ist die zentrale Partner-API fuer Uebersetzungen.

### Unterstuetzte Kanaele

- `portal`
- `local_site`
- `marketing`

### Laufzeitmerkmale

- source snapshot hashes pro Text
- stale detection ueber Quellhash und Zeitstempel
- limitierte Auto-Sync-Batches
- optionale Mock-Uebersetzung
- Kosten- und Provider-Preview

### Governance-Anbindung

Die Route laedt:

- globale LLM-Konfiguration
- aktive globale Provider
- Secret-Daten aus verschluesselten Auth-Configs
- Outbound-URL-Validierung
- Usage-Tracking mit Kosten-/Token-Schaetzung

## Portal-CMS-AI-Sync

`lib/portal-cms-sync.ts` nutzt denselben Governance-Unterbau fuer das Admin-CMS:

- Prompt-Vorlagen
- globale Budgetpruefung
- Provider-/Modellwahl
- Secret-Handling
- Usage-Tracking
- Source-Snapshot-Management

Damit ist AI-Uebersetzung kein isolierter Feature-Block, sondern Teil einer zentralen Governance-Schicht.
