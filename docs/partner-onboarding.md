# Partner‑Onboarding (CRM, LLM, Lokale Website)

Stand: 2026-01-31

Kurzes Template für die Anbindung neuer Partner‑Integrationen (CRM, LLM, Lokale Website).  
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
insert into public.partners (id, company_name, contact_email)
values ('<partner-uuid>', 'Partner GmbH', 'kontakt@partner.de');

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
insert into public.partner_area_map (auth_user_id, area_id, is_active)
values ('<partner-uuid>', '<kreis-area-id>', true);
```

Migrations‑Snippets:  
- `docs/sql/partner_integrations.sql`  
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
insert into public.partners (id, company_name, contact_email)
values ('<partner-uuid>', 'Partner GmbH', 'kontakt@partner.de');

-- CRM‑Integration
insert into public.partner_integrations (
  partner_id, kind, provider, base_url, auth_type, auth_config, detail_url_template, is_active
) values (
  '<partner-uuid>',
  'crm',
  'onoffice',
  'https://api.onoffice.de/api/stable/api.php',
  'token_secret',
  '{"token": "ONOFFICE_TOKEN", "secret": "ONOFFICE_SECRET"}',
  'https://partner.de/expose/{exposee_id}',
  true
);

-- Gebiet zuordnen
insert into public.partner_area_map (auth_user_id, area_id, is_active)
values ('<partner-uuid>', '<kreis-area-id>', true);
```

Migrations‑Snippets:  
- `docs/sql/partner_integrations.sql`  
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
2. Prüfen: `partner_property_offers` gefüllt
3. Frontend:  
   - Listen: `/immobilienangebote` / `/mietangebote`  
   - Detail: `/immobilienangebote/<id>_<slug>`
4. Partner-Login pruefen:
   - Zugriff auf `/dashboard` nur mit vorhandenem Datensatz in `public.partners` (`partners.id = auth_user_id`)
   - fehlt das Profil, erfolgt Redirect auf `/partner/login?message=Kein-Partnerprofil`
5. Betriebsregel:
   - Admin- und Partner-Login nicht parallel im selben Browser-Kontext testen
   - fuer parallele Tests getrennte Browser-Profile/Incognito verwenden

Hinweis (Partnerbereich – Faktoren):
- Faktoren/Resets schreiben zuerst nur nach `data_value_settings`.
- Sichtbar auf der Website werden Änderungen erst nach „Neu berechnen & live schalten“ (Rebuild).

---

## 4) LLM‑Anbindung (KI‑API pro Partner)

### Ziel
Partner kann **eigene LLM‑API** nutzen. Falls nicht vorhanden:
1) Default‑LLM (ENV)  
2) Fallback‑Stub (interner Default‑Text)

### Benötigte Daten vom Partner
- **LLM‑Provider** (z. B. `openai`, `azure`, `anthropic`, `mistral`, `gemini`)
- **API‑Key** (serverseitig)
- **Model‑Name** (z. B. `gpt-4o-mini` o. ä.)
- Optional: **Base‑URL**, **Temperature**, **Max Tokens**

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
  '{"model": "gpt-4o-mini", "temperature": 0.4, "max_tokens": 800}',
  true
);
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

---

## 5) Lokale Website (Texte + Export)

### Ziel
Die lokale Maklerwebsite nutzt dieselbe **Report‑Struktur** wie das Portal.  
Partner können **Texte individuell anpassen** und **freigeben**, danach werden sie per API im Original‑JSON‑Schema ausgeliefert.

### Datenmodell
Neue Tabelle: `partner_local_site_texts`  
Speichert Texte analog zu `report_texts`, aber **separat** für den lokalen Website‑Channel.

### Interne Einrichtung (Supabase)
```sql
-- Lokale Website: Integrationstoken für API‑Zugriff
insert into public.partner_integrations (
  partner_id, kind, provider, auth_type, auth_config, is_active
) values (
  '<partner-uuid>',
  'local_site',
  'token',
  'token',
  '{"token": "S3HR_GEHEIM_123"}',
  true
);
```

**Wichtig:** Der Token ist ein **frei gewählter geheimer Schlüssel**.  
`LOCAL_SITE_TOKEN` ist nur ein Platzhalter. Dieser Token muss geheim bleiben.

### Freigabe‑Flow (Partnerbereich)
- Texte bearbeiten → `draft`
- Button „Texte freigeben“ setzt alle geänderten Texte der Region auf `approved`

### Export‑API (nur freigegebene Texte)
**A) Texte‑Only**  
`GET /api/local-site-texts?token=...&bundesland=...&kreis=...&ortslage=...`

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
      "source": "override"
    }
  }
}
```

**B) Kombinierter Report (empfohlen)**  
`GET /api/local-site-report?token=...&bundesland=...&kreis=...&ortslage=...`

Antwort:
```json
{
  "meta": { "...": "..." },
  "data": { "...": "..." },
  "text": { "...": "..." },
  "local_site_meta": { "...": "..." },
  "local_site": {
    "partner_id": "...",
    "area_id": "...",
    "generated_at": "2026-02-01T12:00:00.000Z"
  }
}
```

### Hinweise
- `text` ist bereits gemerged (approved → optimized, sonst raw).
- `local_site_meta` enthält Status/Last‑Updated pro `section_key`.
- Partner kann die JSON 1:1 in die lokale Website‑Struktur übernehmen.

**C) ZIP‑Package (Kreis + alle Ortslagen)**  
`GET /api/local-site-package?token=...&bundesland=...&kreis=...`

Inhalt:
- `kreis.json`
- `orte/<ortslug>.json`
- `manifest.json`

`manifest.json` enthält:
- `generated_at` (Zeitpunkt der Erstellung)
- `partner_id`
- Kreis‑Info (`slug`, `area_id`)
- Liste aller Ortslagen (`slug`, `area_id`)

### Checkliste für Partner
1. Token erhalten und sicher speichern.
2. Erstabruf testen (curl) und JSON‑Schema prüfen.
3. Zeitplan festlegen (z. B. 1× täglich oder stündlich).
4. Bei Bedarf nur `local_site_report` nutzen (alles in einem Request).
5. Fehlerfälle (401/404) loggen und melden.

### Beispiel‑Abrufe (curl)
**Texte‑Only**
```bash
curl -s "https://<domain>/api/local-site-texts?token=S3HR_GEHEIM_123&bundesland=sachsen&kreis=leipzig"
```

**Kombinierter Report**
```bash
curl -s "https://<domain>/api/local-site-report?token=S3HR_GEHEIM_123&bundesland=sachsen&kreis=leipzig"
```

**ZIP‑Package (Download)**
```bash
curl -s "https://<domain>/api/local-site-package?token=S3HR_GEHEIM_123&bundesland=sachsen&kreis=leipzig" -o local-site-package.zip
```
