# Partner‑Onboarding (CRM, LLM, Lokale Website)

Stand: 2026-01-31

Kurzes Template für die Anbindung neuer Partner‑Anbindungen (CRM, LLM, Lokale Website).  
Ziel: Alle benötigten Zugangsdaten und Schritte kompakt dokumentieren.

---

## 1) Propstack

### Benötigte Daten vom Partner
- **API‑Key**
- **Expose‑URL‑Template** (optional, empfohlen)  
  z. B. `https://partner.de/expose/{exposee_id}`
- **Gebiete** (Kreis/Ort) zur Ausspielung

### Interne Einrichtung (Supabase)
```sql
-- Partner (falls nicht vorhanden)
insert into public.partners (id, company_name, contact_email, contact_first_name, contact_last_name)
values ('<partner-uuid>', 'Partner GmbH', 'kontakt@partner.de', 'Max', 'Mustermann');

-- CRM‑Integration
insert into public.partner_integrations (
  partner_id, kind, provider, base_url, auth_type, auth_config, detail_url_template, is_active
) values (
  '<partner-uuid>',
  'crm',
  'propstack',
  'https://api.propstack.de/v1',
  'api_key',
  '{"api_key": "PROPSTACK_API_KEY"}',
  'https://partner.de/expose/{exposee_id}',
  true
);

-- Gebiet zuordnen
insert into public.partner_area_map (auth_user_id, area_id, is_active, activation_status)
values ('<partner-uuid>', '<kreis-area-id>', false, 'assigned');
```

Migrations‑Snippets:  
- `docs/sql/partner_integrations.sql`  
- `docs/sql/partner_listings.sql`
- `docs/sql/partner_references.sql`
- `docs/sql/partner_requests.sql`
- `docs/sql/partner_requests_region_targets_debug.sql`
- `docs/sql/partner_property_offers_extensions.sql`  
- `docs/sql/partner_property_overrides.sql`

### Sicherheit (zwingend)
- API‑Keys **niemals** im Client/Browser verwenden.
- Keys nur serverseitig in ENV/Supabase (`auth_config`) speichern.
- Sync ausschließlich über Server‑Routen (Cron), nicht aus dem Frontend.

### SEO‑Overrides (Partner‑Mehrwert)
- Optional können Exposé‑Texte/SEO‑Felder individuell überschrieben werden.
- Dafür wird `partner_property_overrides` genutzt (siehe Architektur‑Doku).
- KI‑Hilfsmodus: Vorschläge generieren (Freigabe erfolgt im Partnerbereich).

---

## 2) onOffice

### Benötigte Daten vom Partner
- **API‑Token**
- **API‑Secret**
- **Expose‑URL‑Template** (optional, empfohlen)  
  z. B. `https://partner.de/expose/{exposee_id}`
- **Gebiete** (Kreis/Ort) zur Ausspielung

### Interne Einrichtung (Supabase)
```sql
-- Partner (falls nicht vorhanden)
insert into public.partners (id, company_name, contact_email, contact_first_name, contact_last_name)
values ('<partner-uuid>', 'Partner GmbH', 'kontakt@partner.de', 'Max', 'Mustermann');

-- CRM‑Integration
insert into public.partner_integrations (
  partner_id, kind, provider, base_url, auth_type, auth_config, detail_url_template, is_active
) values (
  '<partner-uuid>',
  'crm',
  'onoffice',
  'https://api.onoffice.de/api/stable/api.php',
  'basic',
  '{"token": "ONOFFICE_TOKEN", "secret": "ONOFFICE_SECRET"}',
  'https://partner.de/expose/{exposee_id}',
  true
);

-- Gebiet zuordnen
insert into public.partner_area_map (auth_user_id, area_id, is_active, activation_status)
values ('<partner-uuid>', '<kreis-area-id>', false, 'assigned');
```

Migrations‑Snippets:  
- `docs/sql/partner_integrations.sql`  
- `docs/sql/partner_listings.sql`
- `docs/sql/partner_references.sql`
- `docs/sql/partner_requests.sql`
- `docs/sql/partner_requests_region_targets_debug.sql`
- `docs/sql/partner_property_offers_extensions.sql`  
- `docs/sql/partner_property_overrides.sql`

### Sicherheit (zwingend)
- Token/Secret **niemals** im Client/Browser verwenden.
- Keys nur serverseitig in ENV/Supabase (`auth_config`) speichern.
- Sync ausschließlich über Server‑Routen (Cron), nicht aus dem Frontend.

---

## 3) Check nach dem Setup

1. Cron‑Sync auslösen  
   `/api/partner-sync?token=<CRON_SECRET>`
2. Pruefen: `partner_listings` gefuellt (Rohdaten-Sync)
3. Optional je Capability pruefen: `partner_references`, `partner_requests`
4. Pruefen: `partner_property_offers` gefuellt (Portal-Readmodell)
5. Pruefen: `public_offer_entries` gefuellt (regionale Ausspielung)
6. Frontend:  
   - Listen: `/immobilienangebote` / `/mietangebote`  
   - Detail: `/immobilienangebote/<id>_<slug>`
7. Partner-Login pruefen:
   - Zugriff auf `/dashboard` nur mit vorhandenem Datensatz in `public.partners` (`partners.id = auth_user_id`)
   - fehlt das Profil, erfolgt Redirect auf `/partner/login?message=Kein-Partnerprofil`
8. Betriebsregel:
   - Admin- und Partner-Login nicht parallel im selben Browser-Kontext testen
   - fuer parallele Tests getrennte Browser-Profile/Incognito verwenden

Lifecycle-Hinweis (Angebote):
- Identitaet ueber `(partner_id, provider/source, external_id)`.
- Sync aktualisiert Raw/Readmodell; bestehende Inhalte in `partner_property_overrides` werden nicht ueberschrieben.
- `partner_property_offers` ist das kanonische partnergebundene Angebots-Readmodell mit `raw`.
- `source_payload` ist derzeit kein erwartetes Write-Feld fuer `partner_property_offers`.
- die regionale Ausspielung erfolgt aktuell ueber `public_offer_entries.visible_area_id`.
- relevante Geo-/Adresssignale aus dem CRM bleiben im Angebots-`raw` erhalten (u. a. `zip_code`, `city`, `region`, `lat`, `lng`) und dienen als Basis fuer lokale Gebietszurodnung.
- `partner_offer_area_targets` materialisiert das lokale Matching pro Angebot.
- `partner_area_map.offer_visibility_mode` steuert je Gebiet:
  - `partner_wide` = alle Partner-Angebote im Gebiet
  - `strict_local` = nur lokal gematchte Angebote im Gebiet
- fuer die Public-Detailseite kommen Texte/SEO aus `public_offer_entries`, Medien und Energie weiter aus `partner_property_offers.raw`.

Lifecycle-Hinweis (Referenzen):
- In `partner_references.normalized_payload` keine exakte Adresse und keine Preisangaben fuehren.
- Erlaubt fuer Ausspielung: `title`, `image_url`, kurzer Beschreibungstext (z. B. `reference_text_seed`) sowie grobe Lage (`city`, optional `district`).
- Zielausgabe Portal: genau 1 Bild + Titel + Beschreibung.

Lifecycle-Hinweis (Gesuche):
- Propstack-Quelle: `saved_queries` (Suchprofile)
- onOffice-Quelle: `searchcriteria`
- In `partner_requests.normalized_payload` regionale Angaben strukturiert als Liste speichern:
  - `region_targets: [{ city, district, label }]`
  - `region_target_keys: ["city::district", ...]`
- Hintergrund: Gesuche koennen mehrere Zielregionen enthalten und muessen pro Ortslage adressierbar sein.

Hinweis (Partnerbereich – Faktoren):
- Faktoren/Resets schreiben zuerst nur nach `data_value_settings`.
- Sichtbar auf der Website werden Änderungen erst nach „Neu berechnen & live schalten“ (Rebuild).

---

## 4) LLM‑Anbindung (KI‑API pro Partner)

### Ziel
Hybridbetrieb mit zwei Modi:
1) `central_managed` (primaer): Nutzung zentraler Portal-LLM-Provider
2) `partner_managed` (Ausnahme): Partner nutzt eigene LLM-Integration

Falls kein aktiver LLM-Provider verfuegbar ist:
1) Default‑LLM (ENV)
2) Fallback‑Stub (interner Default‑Text)

### Benötigte Daten vom Partner
- **LLM‑Provider** (z. B. `openai`, `azure`, `anthropic`, `mistral`, `gemini`)
- **API‑Key** (serverseitig)
- **Model‑Name** (z. B. `gpt-4o-mini` o. ä.)
- Optional: **Base‑URL**, **Temperature**, **Max Tokens**
- **Betriebsmodus**: `settings.llm_mode` (`central_managed` | `partner_managed`)
- Compliance-Nachweise (Pflicht fuer `partner_managed`): DPA, no-training/no-retention, Region

### Interne Einrichtung (Supabase)
```sql
-- LLM‑Integration
insert into public.partner_integrations (
  partner_id, kind, provider, base_url, auth_type, auth_config, settings, is_active
) values (
  '<partner-uuid>',
  'llm',
  'openai',
  'https://api.openai.com/v1',
  'api_key',
  '{"api_key": "PARTNER_LLM_API_KEY"}',
  '{"model": "gpt-4o-mini", "temperature": 0.4, "max_tokens": 800, "llm_mode": "partner_managed"}',
  true
);
```

Mehrere LLM-Integrationen pro Partner:
- vorgesehen (z. B. OpenAI + Anthropic parallel)
- Voraussetzung in DB:
```sql
drop index if exists public.partner_integrations_kind_unique;
create unique index if not exists partner_integrations_kind_unique_non_llm
  on public.partner_integrations (partner_id, kind)
  where kind <> 'llm';
```

### Default‑LLM (Fallback via ENV)
Wenn ein Partner **keine** LLM‑Integration hat, wird der Default‑LLM genutzt:
```
DEFAULT_LLM_PROVIDER=openai
DEFAULT_LLM_API_KEY=...
DEFAULT_LLM_MODEL=...
DEFAULT_LLM_BASE_URL=https://api.openai.com/v1
DEFAULT_LLM_TEMPERATURE=0.4
DEFAULT_LLM_MAX_TOKENS=800
```

### Sicherheit (zwingend)
- Keys nur serverseitig (Supabase `auth_config` oder ENV).
- RLS verhindert Client‑Zugriff auf `partner_integrations`.
- Standardmodus ist zentral verwaltet; partnereigene LLMs nur nach Compliance-Pruefung freigeben.
- Bei `partner_managed` muessen no-training/no-retention und Region-Vorgaben dokumentiert sein.
- Admin-Governance je Partner erfolgt ueber:
  - `partners.llm_partner_managed_allowed`
  - `partners.llm_mode_default`
- Migration: `docs/sql/partner_llm_governance.sql`
- Globale zentrale LLM-Steuerung (Provider/Fallback/Budgets/Monitoring):
  - `docs/sql/llm_global_management.sql`

### Crawler-Policy (SEO/GEO sichtbar, Trainingsnutzung begrenzen)
- Datei: `public/robots.txt`
- Erlaubt: klassische Suchindexierung und Suchcrawler mit Discovery-Zweck
- Blockiert: bekannte Trainings-/Dataset-Crawler (`GPTBot`, `Google-Extended`, `ClaudeBot`, `CCBot`)
- Hinweis: `robots.txt` ist ein Signal und ersetzt keine technischen Access-Controls fuer API/Exports.

---

## 4.1) Gebietsfreischaltung: Mandatory-Textgate

Bei der **einmaligen Aktivierung** einer Gebietszuordnung (`is_active=true`) wird ein Mandatory-Check ausgefuehrt.

API:
- `PATCH /api/admin/partners/[id]/areas/[area_id]`
- `POST /api/partner/areas/[area_id]/submit-review` (Partner meldet Gebiet freigabebereit)

Gate-Regel:
- geprueft werden ausschliesslich `INDIVIDUAL_MANDATORY_KEYS` (siehe `lib/text-key-registry.ts`)
- wenn Pflichtfelder fehlen oder nur auf Standard stehen, wird Aktivierung mit `409` blockiert

Status-Workflow:
1. Admin weist Gebiet zu: `is_active=false`, `activation_status=assigned`
2. Partner bearbeitet Pflichttexte und klickt `Freigabe anfordern`
3. System prueft Mandatory und setzt bei Erfolg `activation_status=ready_for_review`
4. Admin aktiviert Gebiet (`is_active=true`) nach finaler Pruefung

Wichtig:
- Das Gate ist **nicht** Teil von Preisfaktoren/Rebuild (`Neu berechnen & live schalten`), sondern ein separater Admin-Aktivierungsprozess.

Details:
- `docs/text-workflow-general-individual.md`

---

## 4.2) Erstinitialisierung `report.text` fuer neue Gebiete (TS)

Wenn Python neue Reports/Visuals in den Storage synced, aber keine Texte mehr vorbefuellt,
wird die Textbasis in Next.js initialisiert.

Endpoint:
- `POST /api/admin/bootstrap-area-texts`
- Auth:
  - Admin-Session (`admin_super`/`admin_ops`) oder
  - Service-Token `AREA_BOOTSTRAP_TOKEN` via Header `x-area-bootstrap-token` (oder `?token=...`)

Body-Beispiele:
```json
{
  "area_id": "14-6-27",
  "include_ortslagen": true,
  "mode": "missing_only"
}
```

```json
{
  "include_ortslagen": true,
  "mode": "all",
  "dry_run": false
}
```

Was der TS-Bootstrap macht:
1. laedt Standardtexte aus `text-standards/kreis/text_standard_kreis.json`
2. initialisiert `report.text` / `report.data.text`
3. setzt alle Mandatory-Keys (`INDIVIDUAL_MANDATORY_KEYS`) leer
4. rendert data-driven Texte mit `applyDataDrivenTexts`
5. schreibt Report-JSON zurueck in den Storage

Damit ist Python fuer Textgenerierung/Partnertexte nicht mehr erforderlich.

---

## 5) Lokale Website (Texte + Export)

### Ziel
Die lokale Maklerwebsite nutzt dieselbe **Report‑Struktur** wie das Portal.  
Partner können **Texte individuell anpassen** und **freigeben**, danach werden sie per API im Original‑JSON‑Schema ausgeliefert.
Local Site ist dabei ein **Ausspielkanal** (Consumer der Portal-API), keine eingehende CRM-Datenquelle.

### Datenmodell
Aktueller Schema-Snapshot enthaelt **keine** Tabelle `partner_local_site_texts`.
Falls ihr den separaten Local-Site-Channel nutzen wollt, zuerst Migration ausfuehren:
- `docs/sql/partner_local_site_texts.sql`

Ohne diese Migration greift der Local-Site-Export automatisch auf `report_texts` (approved) und sonst auf Rohtexte aus dem Report zurueck.

### Interne Einrichtung (Supabase)
```sql
-- Lokale Website: Integrationstoken für API‑Zugriff
insert into public.partner_integrations (
  partner_id, kind, provider, base_url, auth_type, auth_config, is_active
) values (
  '<partner-uuid>',
  'local_site',
  'local_site',
  'https://www.deine-website.de',
  'token',
  '{"token_hash": "<SHA256_HEX_DES_TOKENS>", "token_encrypted": "<APP_SEITIG_VERSCHLUESSELT>"}',
  true
);
```

**Wichtig:** Der Token ist ein **frei gewählter geheimer Schlüssel**.  
`LOCAL_SITE_TOKEN` ist nur ein Platzhalter. Dieser Token muss geheim bleiben.
Der Abruf erfolgt ausschließlich per `Authorization: Bearer <token>`.
`base_url` enthält die URL der lokalen Website und dient als Pflicht-Kennung der Anbindung im Partnerbereich.
Damit der API-Key im Partnerbereich erneut angezeigt werden kann, muss die App-Umgebung `LOCAL_SITE_TOKEN_ENCRYPTION_KEY` gesetzt haben.

### Freigabe‑Flow (Partnerbereich)
- Texte bearbeiten → `draft`
- Button „Texte freigeben“ setzt alle geänderten Texte der Region auf `approved`

### Export‑API (nur freigegebene Texte)
**A) Texte‑Only**  
`GET /api/local-site-texts?bundesland=...&kreis=...&ortslage=...`

Antwort (gekürzt):
```json
{
  "partner_id": "...",
  "area_id": "...",
  "generated_at": "2026-02-01T12:00:00.000Z",
  "text": {
    "wohnlagencheck": {
      "wohnlagencheck_allgemein": "..."
    }
  },
  "meta": {
    "wohnlagencheck_allgemein": {
      "status": "approved",
      "last_updated": "2026-02-01T11:30:00.000Z",
      "text_type": "general",
      "source": "local_site_override"
    }
  }
}
```

**B) Kombinierter Report (empfohlen)**  
`GET /api/local-site-report?bundesland=...&kreis=...&ortslage=...`

Antwort:
```json
{
  "meta": { "...": "..." },
  "data": { "...": "..." },
  "text": { "...": "..." },
  "local_site": {
    "partner_id": "...",
    "area_id": "...",
    "generated_at": "2026-02-01T12:00:00.000Z"
  }
}
```

### Hinweise
- Prioritaet der Textquellen: `partner_local_site_texts` (approved) → `report_texts` (approved) → Rohtext aus Report.
- `text` ist bereits gemerged (approved → optimized, sonst raw).
- `meta` (Texte-Only Endpoint) enthält Status/Last‑Updated pro `section_key`.
- `meta.source` ist einer von: `local_site_override`, `report_texts`, `raw`.
- Partner kann die JSON 1:1 in die lokale Website‑Struktur übernehmen.

**C) ZIP‑Package (Kreis + alle Ortslagen)**  
`GET /api/local-site-package?bundesland=...&kreis=...`

Inhalt:
- `kreis.json`
- `ortslagen/<ortslug>.json`

### Checkliste für Partner
1. Token erhalten und sicher speichern.
2. Erstabruf testen (curl) und JSON‑Schema prüfen.
3. Zeitplan festlegen (z. B. 1× täglich oder stündlich).
4. Bei Bedarf nur `local_site_report` nutzen (alles in einem Request).
5. Fehlerfälle (401/404) loggen und melden.

### Beispiel‑Abrufe (curl)
**Texte‑Only**
```bash
curl -s \
  -H "Authorization: Bearer S3HR_GEHEIM_123" \
  "https://<domain>/api/local-site-texts?bundesland=sachsen&kreis=leipzig"
```

**Kombinierter Report**
```bash
curl -s \
  -H "Authorization: Bearer S3HR_GEHEIM_123" \
  "https://<domain>/api/local-site-report?bundesland=sachsen&kreis=leipzig"
```

**ZIP‑Package (Download)**
```bash
curl -s \
  -H "Authorization: Bearer S3HR_GEHEIM_123" \
  "https://<domain>/api/local-site-package?bundesland=sachsen&kreis=leipzig" \
  -o local-site-package.zip
```
