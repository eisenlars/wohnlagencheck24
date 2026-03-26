# Architektur – Immobilienmarkt & Standortprofile

Stand: 2026-02-06

Diese Dokumentation beschreibt die aktuelle Zielarchitektur für das Portal *Immobilienmarkt & Standortprofile*.
Ziel ist ein skalierbarer, SEO‑fähiger Aufbau ohne Vercel‑Bundle‑Limit‑Probleme durch große Assets/JSONs.

---

## 1) Überblick

Die Daten- und Asset‑Quellen sind aufgeteilt in:

1. **Supabase Storage (public)** – dynamische Inhalte
   - Report‑JSONs (Kreis/Ort etc.)
   - Interaktive SVG‑Karten
   - Legend‑HTML
   - (Landuse‑Images sind auf dem Webserver)

2. **Eigener Webserver** – statische, selten wechselnde Assets
   - `images/immobilienmarkt` (Hero‑Bilder, Berater, Makler, Teaser etc.)
   - `visuals/map_poi_availabilities` (POI‑Karten)

Dadurch werden große Dateien aus dem Vercel Function‑Bundle entfernt.

---

## 2) Datenquellen & Pfadlayout

### 2.1 Supabase Storage (Bucket: `immobilienmarkt`)

**Public URL‑Basis**
```
https://<project-ref>.supabase.co/storage/v1/object/public/immobilienmarkt
```

**Reports** (JSON, analog zur bisherigen FS‑Struktur)
```
immobilienmarkt/
  reports/
    index.json
    deutschland.json
    deutschland/<bundesland>.json
    deutschland/<bundesland>/<kreis>.json
    deutschland/<bundesland>/<kreis>/<ort>.json
```

**Zusatzfelder in Report‑JSON (Phase‑1 Textgen)**
- `data.textgen_inputs.kreis|ortslage` → Inputs für die Next.js‑Textgenerierung
- `helpers.applied_factors` → angewendeter Faktorstand (Rebuild)
- `helpers.textgen_last_aktualisierung` → zuletzt verarbeiteter Stand
- `helpers.textgen_signatures` → Signaturen je `scope` für Textgen

**Interaktive Karten (SVG)**
```
immobilienmarkt/
  visuals/
    map_interactive/
      deutschland/<bundesland>/kreisuebersicht_<bundesland>.svg
      deutschland/<bundesland>/<kreis>/immobilienpreis/immobilienpreis_<kreis>.svg
      deutschland/<bundesland>/<kreis>/mietpreis/mietpreis_<kreis>.svg
      deutschland/<bundesland>/<kreis>/<theme>/<theme>_<kreis>.svg
      deutschland/<bundesland>/<kreis>/grundstueckspreis/grundstueckspreis_<kreis>.svg
      deutschland/<bundesland>/<kreis>/kaufpreisfaktor/kaufpreisfaktor_<kreis>.svg
      deutschland/<bundesland>/<kreis>/wohnungssaldo/wohnungssaldo_<kreis>.svg
      deutschland/<bundesland>/<kreis>/kaufkraftindex/kaufkraftindex_<kreis>.svg
```

**Legends (HTML)**
```
immobilienmarkt/
  visuals/
    legend/
      legend_<theme>.html
```

**Landuse (WebP)**
```
fileadmin/visuals/map_landuse/
  deutschland/<bundesland>/<kreis>/flaechennutzung/
    flaechennutzung_<kreis>_industrie_gewerbe.webp
    flaechennutzung_<kreis>_<ort>_industrie_gewerbe.webp
    flaechennutzung_<kreis>_wohnbau.webp
    flaechennutzung_<kreis>_<ort>_wohnbau.webp
```

### 2.2 Webserver (statische Assets)

**Basis**
```
https://www.praxiswissen-immobilien.de/fileadmin/user_upload/immobilienmarkt

POI‑Basis (separat):

https://www.praxiswissen-immobilien.de/fileadmin
```

**Images (WebP bevorzugt)**
```
/immobilienmarkt/<bundesland>/<kreis>/immobilienmarktbericht-<kreis>.webp
/immobilienmarkt/<bundesland>/<kreis>/immobilienberatung-<kreis>.png
/immobilienmarkt/<bundesland>/<kreis>/makler-<kreis>-logo.webp
/immobilienmarkt/<bundesland>/<kreis>/immobilienmarktbericht-<kreis>-preview.webp
/immobilienmarkt/<bundesland>/<kreis>/<ort>/immobilienmarktbericht-<ort>-standortcheck-01.webp
...
```

**POI‑Karten**
```
/immobilienmarkt/visuals/map_poi_availabilities/deutschland/<bundesland>/<kreis>/<folder>/<file>.webp
```

> Hinweis: Alle Webserver‑Assets erhalten ein Cache‑Busting via `?v=<ASSET_VERSION>`.

---

## 3) Zentrale Loader‑Logik

### 3.1 Report‑Loader (Supabase)

- Datei: `lib/data.ts`
- Funktionen:
  - `getReportsIndex()` → `reports/index.json`
  - `getReportBySlugs([...])` → Report‑JSON
  - `getKreisUebersichtMapSvg(...)` → SVG‑Fetch
  - `getLegendHtml(theme)` → Legend‑HTML
  - `getFlaechennutzung*` → Landuse‑Images (prüft Ort/Kreis via `HEAD`)

Alle Loader sind **async**.
Aktuell (Stabilisierungsphase Preisfaktoren) laden Report-JSON/Text in `lib/data.ts` mit
`cache: "no-store"`, damit DB/Storage/Frontend sofort konsistent bleiben.

### 3.2 Index/Manifest

- `reports/index.json` wird **im Python‑Export** generiert.
- Enthält die Hierarchie Bundesland → Kreis → Ortslagen.
- Wird für Navigation, Seitenlisten und Sitemap genutzt.

Beispiel (verkürzt):
```json
{
  "bundeslaender": [
    {
      "slug": "sachsen",
      "name": "Sachsen",
      "kreise": [
        {
          "slug": "leipzig",
          "name": "Leipzig",
          "orte": [
            { "slug": "connewitz", "name": "Connewitz" }
          ]
        }
      ]
    }
  ]
}
```

### 3.3 Asset‑URLs (Webserver)

- Helper: `utils/assets.ts`
- `buildWebAssetUrl('/images/immobilienmarkt/...')`
  → mapped auf Webserver‑Basis + `?v=<ASSET_VERSION>`

Damit können Bilder/Poi‑Maps überschrieben werden, ohne dass Browser alte Caches behalten.

---

## 4) Rendering‑Flow (App Router)

**Entry**
- `app/immobilienmarkt/[...slug]/page.tsx`
  - `resolveRoute` → `buildPageModel` → Section Rendering

**Page Model**
- `features/immobilienmarkt/page/buildPageModel.ts`
  - lädt Report via `getReportBySlugs`
  - lädt Index‑Infos, Karten, Legends, Landuse
  - erzeugt `assets` + `tabs` + `toc` + `kontakt`

**Sections/VMs**
- Builders arbeiten auf `Report` + `text` + `data`.
- Images/Assets werden aus `buildWebAssetUrl` geliefert.

---

## 5) Sitemap

Datei: `app/sitemap.ts`

Ablauf:
1. `getBundeslaender()` → Index
2. Für jedes Bundesland: 1 Report‑Fetch → `lastModified` (Konfiguration)
3. Für jeden Kreis: 1 Report‑Fetch → `lastModified`
4. Für Ortslagen: **kein Report‑Fetch**, nutzt `kreisLastMod`

Damit bleibt die Sitemap schnell, auch bei vielen Ortslagen.

---

## 5.1) Text-Workflow (General + Individual)

Der operative Textprozess fuer General/Individual liegt in Next.js und ist getrennt vom Data-Driven-Rebuild.

Details und verbindliche Key-Definitionen:
- `docs/text-workflow-general-individual.md`

Kernaussagen:
- Standardtexte aus Storage: `immobilienmarkt/text-standards/kreis/text_standard_kreis.json`
- Key-Klassen in `lib/text-key-registry.ts`
- Aktivierungs-Gate bei `PATCH /api/admin/partners/[id]/areas/[area_id]` nur auf `INDIVIDUAL_MANDATORY_KEYS`
- Global-KI-Hilfslaeufe nur fuer `general` im aktiven Themenblock

---

## 6) Updates (monatlich)

**Workflow (Python)**
1. Python berechnet Reports + Texte
2. Erzeugt `reports/index.json`
3. Schreibt zusätzlich `data.textgen_inputs.{kreis|ortslage}` in die JSONs
4. Upload nach Supabase Storage
5. (Optional) Upload der statischen Assets auf Webserver
6. (Optional später) Revalidate‑API call

### 6.1 Partner-Faktorisierung (Next.js-Rebuild)

Separater Online-Flow (ohne Python-Lauf) für Partneränderungen:
1. Partner setzt Faktoren im Dashboard (`data_value_settings`)
2. `POST /api/rebuild-region` lädt Ziel-Report aus Storage
3. Faktoren werden als **Delta** angewendet (`target/previous`), `previous` kommt aus `helpers.applied_factors` (fallback Request `previous_factors`)
4. `data.*`, `data.textgen_inputs.*` und Preis-Texte werden aktualisiert
5. Report wird in Storage upserted (`cacheControl: "0"`)
6. `helpers.applied_factors` wird auf Zielstand gesetzt
7. `helpers.textgen_signatures` werden aktualisiert; bei Änderungen werden `report_texts` für die betroffenen `section_key`s gelöscht

Wichtig: Änderungen/Resets der Faktoren im Dashboard wirken **zuerst nur in `data_value_settings`**.  
Die Website/Reports werden **erst nach „Neu berechnen & live schalten“** aktualisiert (Rebuild).

API-Optionen:
- `mode = "textgen_only"` berechnet nur Texte neu (keine Faktor-Anwendung).
- `debug = true` liefert Debug-Payload (Vorher/Nachher + Pfade/Links).

Faktorisierung (aktuell):
- Markttrend-Indizes werden additiv angepasst und auf `[-100, 100]` geclamped.
- Zeitreihen werden jahrbezogen skaliert, Basis ist `year01` (`f01..f06`).

### 6.2 Data-Driven Text Lifecycle (global)

Gilt für alle datengenerierten Texte:
- Quelle: strukturierte Inputs aus Report-JSON (`data.textgen_inputs.*` bzw. fachliche Input-Blöcke)
- Ausgabe: `text.*` im Report
- Optionaler DB-Override: `report_texts` / `partner_marketing_texts` (Status `approved`)

Regelmodell:
1. **Auto-Modus**: Rebuild darf Text neu generieren.
2. **Manual-Modus**: Override bleibt führend; Rebuild ändert nur Zahlenbereiche außerhalb des Overrides.
3. UI zeigt bei manueller Bearbeitung einen Kontext-Hinweis (Kontext kann vom Datenstand abweichen).

SEO/GEO-Qualität:
- Ziel ist hohe Textdiversität bei stabiler Fachlogik:
  - deterministische Variation pro Region/Abschnitt/Aktualisierung
  - keine zufälligen Sprünge bei identischer Datenlage

Separater Partner‑Sync (nur bei Änderungen an Partnern/Gebieten):
- Script: `_NEONBLUE/_pwi/Import_Portale/Hilfsscripte/supabase/sync_partner_db.py`
- Synct `partners`, `areas`, `partner_area_map` aus `partner.json` + Report‑JSON

**Vorteile**
- Keine Vercel‑Builds pro Update
- Voller SEO‑Render
- Skalierbar bis 15k+ Seiten

---

## 7) Konfiguration

### 7.1 Environment

In `.env.local`:
```
SUPABASE_PUBLIC_BASE_URL=https://<project-ref>.supabase.co/storage/v1/object/public
ASSET_VERSION=YYYY-MM-DD
```

Zusätzlich (Server‑only, nicht im Client verwenden):
```
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
CRON_SECRET=<optional für /api/partner-sync>
```

Optional:
```
WEB_ASSET_BASE_URL=https://www.praxiswissen-immobilien.de/fileadmin/user_upload/immobilienmarkt
WEB_POI_BASE_URL=https://www.praxiswissen-immobilien.de/fileadmin
WEB_LANDUSE_BASE_URL=https://www.praxiswissen-immobilien.de/fileadmin/visuals/map_landuse

POI‑Basis (separat):

https://www.praxiswissen-immobilien.de/fileadmin
```

### 7.2 Next.js Image Domains

In `next.config.ts`:
- `www.praxiswissen-immobilien.de`
- `<project-ref>.supabase.co`

### 7.3 Access Gates & Session Scope (Admin/Partner)

Routen sind serverseitig hart getrennt:
- `/admin/*`: nur fuer Admin-User (z. B. `ADMIN_SUPER_USER_IDS`)
- `/dashboard/*`: nur fuer User mit vorhandenem `public.partners`-Profil (`partners.id = auth.user.id`)

Redirect-Verhalten:
- Keine Session auf `/dashboard/*` -> `/partner/login`
- Session vorhanden, aber kein Partnerprofil -> `/partner/login?message=Kein-Partnerprofil`
- Keine Admin-Berechtigung auf `/admin/*` -> `/admin/login`

Wichtig zur Session-Isolation:
- Admin- und Partner-Login teilen im selben Browser standardmaessig denselben Supabase-Session-Kontext.
- Parallelbetrieb (Admin + Partner gleichzeitig) daher in getrennten Browser-Profilen/Incognito durchfuehren.

---

## 8) Erweiterungspunkte

- **Neue Bundesländer/Kreise/Orte**: Nur `index.json` + Reports in Storage aktualisieren.
- **Neue Tabs/Sections**: Keine Änderung am Storage‑Layout nötig, nur Builder/Sections.
- **Multi‑Language**: Entweder je Sprache eigene Reports (`reports/<lang>/...`) oder `lang` in JSON.
- **Partner‑Texte (Supabase DB)**: Später Merge‑Logik ergänzen (JSON‑Text überschreiben).
- **Revalidate‑API**: Bei wachsendem Traffic sinnvoll, um Cache gezielt zu refreshen.

---

## 8.1) Partner‑Daten (Supabase DB)

- **data_value_settings** ersetzt `partner_area_modification_factors`.
- `auth_user_id` entspricht **Supabase Auth UID** und ist der Join‑Schlüssel aus dem Dashboard.
- `area_id` referenziert `areas.id` (Kreis oder Ortslage).

---

## 9) Partner‑Integrationen & CRM‑Sync

Ziel: Mehrere Partner mit unterschiedlichen CRMs (Propstack, onOffice, …).  
Pro Partner sind mehrere Integrationen moeglich (z. B. CRM + LLM + Local Site; bei Bedarf auch mehrere CRM-Provider).

Weitere Details: `docs/partner-onboarding.md`
Settings-Vertrag fuer `partner_integrations.settings`: `docs/integration_settings_schema.md`
Offboarding/Uebergabe-Runbook: `docs/partner_handover_process.md`
Aktueller Stand: die Gebietsuebergabe ist nicht mehr nur Mapping-Wechsel, sondern ein granularer Inhaltsworkflow fuer Berichtindividualisierung, SEO/GEO, Blog und Sprachen. Local Site bleibt bewusst separat.

### 9.1 Datenmodell (Supabase)

**`partner_integrations`** – Konfiguration je Partner/Integration (CRM + weitere APIs)
```sql
create table if not exists public.partner_integrations (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id),
  kind text not null,              -- 'crm' | 'llm' | 'local_site' | 'other'
  provider text not null,          -- 'propstack' | 'onoffice' | ...
  base_url text,
  auth_type text,
  auth_config jsonb,
  detail_url_template text,        -- z. B. https://partner.de/expose/{exposee_id}
  is_active boolean default true,
  settings jsonb,
  last_sync_at timestamptz
);

-- Mehrere LLM-Integrationen erlaubt:
-- unique nur fuer kinds ungleich 'llm'
drop index if exists public.partner_integrations_kind_unique;
create unique index if not exists partner_integrations_kind_unique_non_llm
  on public.partner_integrations (partner_id, kind)
  where kind <> 'llm';
```

Migrations‑Snippets:  
- `docs/sql/partner_integrations.sql`

**RLS (geschützt, nur Service‑Role darf lesen/schreiben):**
```sql
alter table public.partner_integrations enable row level security;

create policy "partner_integrations_deny_select"
  on public.partner_integrations for select using (false);
create policy "partner_integrations_deny_insert"
  on public.partner_integrations for insert with check (false);
create policy "partner_integrations_deny_update"
  on public.partner_integrations for update using (false);
create policy "partner_integrations_deny_delete"
  on public.partner_integrations for delete using (false);
```

**`partner_listings`** – CRM‑Rohdaten: Angebote/Objekte
```sql
create table if not exists public.partner_listings (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id),
  provider text not null,
  external_id text not null,
  title text,
  status text,
  source_updated_at timestamptz,
  normalized_payload jsonb not null default '{}'::jsonb,
  source_payload jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  sync_status text not null default 'ok',
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists partner_listings_partner_provider_external_unique
  on public.partner_listings (partner_id, provider, external_id);
```

**`partner_references`** – CRM‑Rohdaten: Referenzobjekte
```sql
create table if not exists public.partner_references (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id),
  provider text not null,
  external_id text not null,
  title text,
  status text,
  source_updated_at timestamptz,
  normalized_payload jsonb not null default '{}'::jsonb,
  source_payload jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  sync_status text not null default 'ok',
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists partner_references_partner_provider_external_unique
  on public.partner_references (partner_id, provider, external_id);
```

**`partner_requests`** – CRM‑Rohdaten: Immobiliengesuche
```sql
create table if not exists public.partner_requests (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id),
  provider text not null,
  external_id text not null,
  title text,
  status text,
  source_updated_at timestamptz,
  normalized_payload jsonb not null default '{}'::jsonb,
  source_payload jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  sync_status text not null default 'ok',
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists partner_requests_partner_provider_external_unique
  on public.partner_requests (partner_id, provider, external_id);
```

Migrations‑Snippets:
- `docs/sql/partner_listings.sql`
- `docs/sql/partner_references.sql`
- `docs/sql/partner_requests.sql`

**`partner_property_offers`** – Portal‑Readmodell (kanonisches partnergebundenes Angebotsmodell fuer Rendering/SEO)
```sql
alter table public.partner_property_offers
  add column if not exists source text,
  add column if not exists external_id text;

create unique index if not exists partner_property_offers_ext_idx
  on public.partner_property_offers (partner_id, source, external_id);

create index if not exists partner_property_offers_partner_offer_idx
  on public.partner_property_offers (partner_id, offer_type, updated_at);
```

Migrations‑Snippets:  
- `docs/sql/partner_property_offers_extensions.sql`

Aktuell wird `partner_property_offers` im Sync als schlankes Readmodell beschrieben. Erwartete Sync-Felder sind:
- `partner_id`
- `source`
- `external_id`
- `offer_type`
- `object_type`
- `title`
- `price`
- `rent`
- `area_sqm`
- `rooms`
- `address`
- `image_url`
- `detail_url`
- `is_top`
- `raw`
- `updated_at`

Wichtig:
- `source_payload` gehoert aktuell **nicht** zum Write-Modell von `partner_property_offers`
- providernahe Rohdaten fuer Angebote liegen im Feld `raw`
- regionale Ausspielung erfolgt nachgelagert ueber `public_offer_entries.visible_area_id`, nicht ueber ein hartes `area_id` im Angebots-Kernmodell
- fuer spaetere lokale Gebietszuordnung werden Geo-/Adresssignale im `raw` des Angebots mitgefuehrt (z. B. `zip_code`, `city`, `region`, `lat`, `lng`)

**RLS (öffentlich lesen, schreiben nur Service‑Role):**
```sql
alter table public.partner_property_offers enable row level security;

create policy "offers_public_read"
  on public.partner_property_offers for select using (true);

create policy "offers_deny_insert"
  on public.partner_property_offers for insert with check (false);
create policy "offers_deny_update"
  on public.partner_property_offers for update using (false);
create policy "offers_deny_delete"
  on public.partner_property_offers for delete using (false);
```

### 9.2 URL‑Struktur Angebote

**Listen (Kreis/Ort):**
```
/immobilienmarkt/<bundesland>/<kreis>/immobilienangebote
/immobilienmarkt/<bundesland>/<kreis>/mietangebote
/immobilienmarkt/<bundesland>/<kreis>/<ort>/immobilienangebote
/immobilienmarkt/<bundesland>/<kreis>/<ort>/mietangebote
```

**Details (SEO‑Slug):**
```
/immobilienmarkt/<bundesland>/<kreis>/immobilienangebote/<offerId>_<titel>
/immobilienmarkt/<bundesland>/<kreis>/mietangebote/<offerId>_<titel>
```

### 9.3 Propstack Mapping (Units → Offers)

Propstack liefert `GET /v1/units` (mit `expand=1` empfohlen).  
Mapping (Beispiel):

| Propstack Feld            | Zielspalte / raw                               |
|--------------------------|-------------------------------------------------|
| `id`                     | `external_id`                                   |
| `marketing_type`         | `offer_type` (`BUY`→`kauf`, `RENT`→`miete`)      |
| `rs_type`                | `object_type` (`APARTMENT`→`wohnung`, `HOUSE`→`haus`) |
| `title`                  | `title`                                         |
| `purchase_price`         | `price`                                         |
| `rent_net`               | `rent`                                          |
| `living_space`           | `area_sqm`                                      |
| `number_of_rooms`        | `rooms`                                         |
| `street/house_number/zip_code/city` | `address`                           |
| `street` / `house_number` / `zip_code` / `city` / `region` / `country` | `raw` (Geo-/Adressbasis) |
| `lat` / `lng`            | `raw.lat`, `raw.lng`                            |
| `hide_address`           | `raw.hide_address`                              |
| `images[]`               | `image_url` (erstes echtes Bild), `raw.gallery`, `raw.gallery_urls`, `raw.gallery_assets` |
| `exposee_id`             | `raw.exposee_id`                                |
| `description_note`       | `raw.description`                               |
| `location_note`          | `raw.location`                                  |
| `furnishing_note`        | `raw.features_note`                             |
| `energy_*`               | `raw.energy` (normierter Snapshot)              |
| `custom_fields`          | `raw.custom_fields`                             |
| `status` / `sub_status`  | `raw.status`, `raw.sub_status`                  |

Hinweis:
- Angebots-Sync schreibt fuer `partner_property_offers` nur das Readmodell inkl. `raw`
- `source_payload` wird dort aktuell nicht geschrieben
- `raw` ist damit die kanonische Auswertebasis fuer Medien, Energie, Geo-Signale und Detailfelder
- die Geo-/Adressfelder in `raw` sind die Grundlage fuer die lokale Angebotszuordnung und `strict_local`

**Aktuelle Angebots-Gebietszuordnung:**
- interne Matching-Signale werden aus Angebots-`raw` gelesen:
  - `lat/lng`
  - `zip_code`
  - `city`
  - `region`
  - `country`
- Matching-Prioritaet:
  1. `lat/lng` vorhanden (Grundlage fuer spaeteres Polygon-/Map-Matching)
  2. `zip_code + city`
  3. `city + region`
  4. `city`
  5. `region`
- die Zuordnung wird in `partner_offer_area_targets` materialisiert
- `partner_area_map.offer_visibility_mode` steuert die aktuelle Public-Ausspielung:
  - `partner_wide`: alle Partner-Angebote innerhalb des zugewiesenen Gebiets
  - `strict_local`: nur lokal gematchte Angebote innerhalb des zugewiesenen Gebiets
- die physische Objektlage und das Ausspielgebiet bleiben bewusst getrennt

**Partner‑Exposé‑URL (optional):**  
`detail_url = detail_url_template` mit Platzhaltern:
```
https://partner.de/expose/{exposee_id}
https://partner.de/expose/{id}
```

### 9.3.1 onOffice Mapping (estate → Offers)

onOffice nutzt eine RPC‑API (Single‑Endpoint) und liefert Daten über `actionid`/`resourceid`.

**Endpoint**
```
POST https://api.onoffice.de/api/stable/api.php
```

**Parameter (Beispiel)**
```json
{
  "token": "<TOKEN>",
  "secret": "<SECRET>",
  "actionid": "urn:onoffice-de-ns:smart:2.5:smartml:action:read",
  "resourceid": "estate",
  "parameters": {
    "data": ["Id", "objekttitel", "vermarktungsart", "objektart", "kaufpreis", "kaltmiete", "warmmiete", "wohnflaeche", "anzahl_zimmer", "plz", "ort", "strasse", "hausnummer", "energiepass_art", "energieverbrauchkennwert", "freitext_lage", "freitext_ausstattung", "img"],
    "listlimit": 50,
    "filter": { "status": [{ "op": "=", "val": 1 }] }
  }
}
```

**Mapping (Beispiel):**

| onOffice Feld            | Zielspalte / raw                               |
|--------------------------|-------------------------------------------------|
| `elements.Id`            | `external_id`                                   |
| `elements.vermarktungsart` | `offer_type` (`kauf`/`miete`)                 |
| `elements.objektart`     | `object_type` (`wohnung`/`haus`)               |
| `elements.objekttitel`   | `title`                                         |
| `elements.kaufpreis`     | `price`                                         |
| `elements.warmmiete/kaltmiete` | `rent`                                   |
| `elements.wohnflaeche`   | `area_sqm`                                      |
| `elements.anzahl_zimmer` | `rooms`                                         |
| `elements.strasse/hausnummer/plz/ort` | `address`                        |
| `elements.img.url`       | `image_url` (erstes), `raw.gallery` (alle)      |
| `elements.objektnr_extern` | `raw.exposee_id`                              |
| `elements.freitext_lage` | `raw.location`                                  |
| `elements.freitext_ausstattung` | `raw.features_note`                     |
| `elements.energiepass_art` | `raw.energy.type`                             |
| `elements.energieverbrauchkennwert` | `raw.energy.demand`                  |

**Hinweis:**  
onOffice liefert Bilder teils in separaten Requests. Falls `img` fehlt, muss ein zusätzlicher Bild‑Request ergänzt werden.

### 9.4 Cron‑Sync (Next.js)

Server‑Route:
```
GET /api/partner-sync?token=<CRON_SECRET>
```

Flow:
1. `partner_integrations` (kind=`crm`) laden
2. Provider‑Adapter (Propstack, onOffice)
3. Raw-Sync je Ressource:
   - Angebote -> `partner_listings`
   - Referenzen -> `partner_references`
   - Gesuche -> `partner_requests`
4. Nachgelagerte Transformation ins Portal‑Readmodell `partner_property_offers` (nur Angebote)
5. Regionale Ausspielung in `public_*_entries` ueber `visible_area_id`
6. Upserts auf eindeutige Keys `(partner_id, provider|source, external_id)`

Verbindliche Schichtung:
1. Raw-Sync (`partner_listings`, `partner_references`, `partner_requests`)
2. Portal-Readmodell (`partner_property_offers`)
3. Angebots-Gebietszuordnung (`partner_offer_area_targets`)
4. Regionale Projection-Layer (`public_offer_entries`, `public_request_entries`, `public_reference_entries`)
5. Redaktioneller Layer (`partner_property_overrides`)
6. Freigegebene Uebersetzungen (`partner_property_offer_i18n` und analoge Tabellen)

Ergaenzung zur Angebotslogik:
- `partner_property_offers` bleibt kanonisch partnergebunden
- lokale Angebotszuordnung wird nicht hart im Kernmodell gespeichert, sondern separat in `partner_offer_area_targets`
- dadurch koennen `partner_wide` und `strict_local` parallel unterstuetzt werden
- dieselbe Zuordnungsschicht ist spaeter auch fuer Karten, Geo-Filter und KI-Suchagenten nutzbar

**Wichtig:**  
`SUPABASE_SERVICE_ROLE_KEY` darf **nie** im Client verwendet werden.

**Sicherheit (CRM‑Zugänge):**
- API‑Keys/Secrets ausschließlich serverseitig verwenden.
- Keine CRM‑Zugänge im Browser oder Client‑JS.

### 9.5 Beispiel: Integration anlegen

```sql
insert into public.partner_integrations (
  partner_id,
  kind,
  provider,
  base_url,
  auth_type,
  auth_config,
  detail_url_template,
  is_active
) values (
  '25d4a8b1-9b7d-4a99-9915-9da83a3b891d',
  'crm',
  'propstack',
  'https://api.propstack.de/v1',
  'api_key',
  '{"api_key": "YOUR_PROPSTACK_KEY"}',
  'https://partner-domain.de/expose/{exposee_id}',
  true
);
```

### 9.6 Onboarding‑Checkliste (neuer Partner)

1. **Partner anlegen**  
   - `partners` Tabelle (Name, Kontakt etc.)
2. **Gebiete zuordnen**  
   - `areas` + `partner_area_map` (Kreis/Ort)
3. **CRM‑Integration konfigurieren**  
   - `partner_integrations` (provider, auth_config, detail_url_template)
4. **Sync testen**  
   - `/api/partner-sync?token=<CRON_SECRET>`  
   - Pruefen: neue Eintraege in `partner_listings` (und je nach Capabilities auch `partner_references`/`partner_requests`)
   - Pruefen: Angebote wurden in `partner_property_offers` uebernommen
   - Pruefen: regionale Ausspielung wurde in `public_offer_entries` erzeugt
5. **Frontend prüfen**  
   - Liste: `/immobilienangebote` bzw. `/mietangebote`  
   - Detailseite: `/immobilienangebote/<id>_<slug>`
6. **Texte/SEO**  
   - Optional: individualisierte Texte/LLM‑Inhalte ergänzen

### 9.7 Fehler‑Diagnose (Sync & Angebote)

**Keine Angebote sichtbar**
- Prüfen: `partner_area_map` enthält den Kreis/Ort und `is_active = true`
- Prüfen: `partner_integrations` aktiv (`is_active = true`) + korrekter `provider`
- Pruefen: `partner_listings` enthaelt Datensaetze mit passendem `partner_id/provider`
- Prüfen: `partner_property_offers` enthaelt partnergebundene Datensaetze mit passendem `offer_type`
- Prüfen: `public_offer_entries` wurde fuer das sichtbare Gebiet erzeugt (`visible_area_id`)

**Sync schlägt fehl (HTTP 401/403)**
- `auth_config.api_key` korrekt?
- `CRON_SECRET` stimmt?
- API‑Key hat Zugriff auf `/v1/units`?

**Detailseiten leer**
- `external_id`/`source` gesetzt?
- `detail_url_template` vorhanden (optional, nur CTA)
- `raw.gallery` befüllt? (ansonsten nur 1 Bild)

**Pagination leer/fehlerhaft**
- `partner_property_offers_partner_offer_idx` vorhanden?
- `offer_type`‑Werte korrekt (`kauf` / `miete`)

### 9.7.1 Gebietsbezogene Sichtbarkeitsmodi

`partner_area_map` steuert nicht nur, **wo** ein Partner aktiv/public-live ist, sondern auch, **wie** Assets je Gebiet ausgespielt werden.

Vorbereitete Felder:
- `offer_visibility_mode`
- `request_visibility_mode`

Gueltige Werte:
- `partner_wide`
  - auf Seiten dieses Gebiets werden alle Assets des Partners ausgespielt
- `strict_local`
  - auf Seiten dieses Gebiets werden nur lokal passende Assets ausgespielt

Aktueller Betriebsstand:
- Default fuer beide Modi ist `partner_wide`
- die oeffentliche Ausspielung bleibt derzeit unveraendert breit
- `strict_local` fuer Angebote wird erst aktiviert, wenn `partner_offer_area_targets` belastbar genug befuellt ist
- `strict_local` fuer Gesuche kann spaeter frueher greifen, weil `region_targets` bereits explizite Zielgebiete liefern

### 9.7.2 Angebots-Matching und Debugging

Fuer Angebote gilt bewusst eine Schichtung in drei Ebenen:

1. `partner_property_offers`
   - kanonisches, partnergebundenes Angebots-Readmodell
2. `partner_offer_area_targets`
   - interne Gebietszuordnung je Angebot auf Basis von Geo-/Adresssignalen
3. `public_offer_entries`
   - tatsaechliche Ausspielung pro `visible_area_id`

Die Matching-Logik arbeitet aktuell auf Basis von:
- `zip_code`
- `city`
- `region`
- `lat` / `lng`

Wichtig:
- Nicht jedes Angebot muss lokal zu einem aktiven Partnergebiet matchen.
- Solange `offer_visibility_mode = 'partner_wide'`, bleibt ein fehlender Match **kein** Ausspielungsfehler.
- Die Debug-Queries in `docs/sql/partner_offer_area_matching_debug.sql` sind der operative Einstieg fuer:
  - aktive Partnergebiete
  - Angebots-Geosignale
  - persistierte `partner_offer_area_targets`
  - Angebote ohne Match

### 9.8 Objekt-Lifecycle (verbindlich)

Schluessel:
- fachlich stabil ueber `(partner_id, provider/source, external_id)`

Regeln:
1. Neues Objekt im CRM -> Raw upsert -> Readmodell upsert; Override optional `draft`.
2. Update im CRM -> Raw/Readmodell aktualisieren; Override bleibt unangetastet.
3. Objekt nicht mehr im CRM gesehen -> `is_active=false` (oder `sync_status`) auf Raw/Readmodell, kein Hard-Delete im Standardsync.
4. Objekt kommt spaeter mit gleicher `external_id` zurueck -> vorhandenen Override reaktivieren.

---

## 10) SEO‑Overrides für Exposés (Partner‑Mehrwert)

Ziel: Duplicate Content vermeiden und redaktionelle Mehrwerte bieten.  
Partner können Texte/SEO‑Elemente **pro Objekt** überschreiben (optional mit KI‑Hilfe).

### 10.1 Datenmodell (Supabase)

**`partner_property_overrides`** – Overrides pro Angebot
```sql
create table if not exists public.partner_property_overrides (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id),
  source text not null,            -- 'propstack' | 'onoffice'
  external_id text not null,
  is_active_override boolean,
  is_top_override boolean,
  seo_title text,
  seo_description text,
  seo_h1 text,
  short_description text,
  long_description text,
  location_text text,
  features_text text,
  highlights jsonb,                -- array of strings
  image_alt_texts jsonb,           -- array of strings
  status text default 'draft',
  last_updated timestamptz default now()
);

create unique index if not exists partner_property_overrides_unique
  on public.partner_property_overrides (partner_id, source, external_id);
```

Migrations‑Snippets:  
- `docs/sql/partner_property_overrides.sql`

**RLS (Partner darf eigene Overrides pflegen, öffentlich lesbar):**
```sql
alter table public.partner_property_overrides enable row level security;

create policy "overrides_public_read"
  on public.partner_property_overrides for select using (true);

create policy "overrides_partner_write"
  on public.partner_property_overrides
  for insert with check (auth.uid() = partner_id);

create policy "overrides_partner_update"
  on public.partner_property_overrides
  for update using (auth.uid() = partner_id);

create policy "overrides_partner_delete"
  on public.partner_property_overrides
  for delete using (auth.uid() = partner_id);
```

### 10.2 Render‑Logik (Fallback)

Priorität:
1. Override‑Feld (falls gesetzt)  
2. Readmodell‑Feld (`partner_property_offers`)  
3. Raw‑Feld (`normalized_payload`)  
4. Fallback/Leer

Beispiel:
```
seo_title = override.seo_title ?? offer.title ?? raw.title
long_description = override.long_description ?? offer.long_description ?? raw.description
```

### 10.3 KI‑Hilfsmodus (Empfehlung)

- KI erstellt Vorschläge auf Basis von CRM‑Daten + Standortprofilen
- Partner prüft und setzt `status = approved`
- Nur freigegebene Texte werden im Frontend angezeigt

## 8.2) Partner‑Sync Flow (Stammdaten vs. Gebietszuordnung)

Quelle der Wahrheit ist `partner.json`:

```
partner.json
  ├─ Partner‑Stammdaten (Firma, Kontakt, E‑Mail)
  └─ partner_gebiete[] (kreis_schluessel → Gebietszuordnung)

Sync‑Flow:
  partner.json
    → Auth‑User anlegen/finden (Supabase Auth)
    → partners (Stammdaten)
    → partner_area_map (Zuweisung Partner ↔ Gebiet)
    → data_value_settings (nur wenn Overrides gesetzt werden)
```

Kurzlogik:
- `partners` = *wer der Partner ist*
- `partner_area_map` = *wo der Partner aktiv ist*
- `data_value_settings` = *welche Werte abweichen*
  - Legacy‑Spalten entfernt (2026‑02‑05): `price_factor_houses`, `price_factor_apartments`, `custom_intro_text`, `custom_market_report`

---

## 8.3) Sync-Guardrails (Reports + Visuals + Texte)

### Problemursache (bereits behoben)
- Die Textstruktur wird seit der Umstellung in Next.js verwaltet (nicht mehr durch Python erzeugt).
- Beim Python-Upload konnten Reports ohne `text`/`data.text*` vorhandene Inhalte im Storage überschreiben.
- Folge: General-/Standard- und Data-driven-Texte verschwanden im Frontend, obwohl Routen/Daten vorhanden waren.

### Verbindliche Guardrails für den Python-Sync
- `visuals/map_interactive/**` muss immer vollständig mitdeployt werden.
- Bei Report-Upload gilt Merge statt Blind-Overwrite:
  - Wenn lokal nicht vorhanden, aus Remote beibehalten:
    - top-level `text`
    - `data.textgen_inputs`
    - `data.text`
    - `helpers`
- Nur fachliche Report-Daten aktualisieren; Textstrukturen nie implizit löschen.

### Recovery / Bootstrap (nach historischem Verlust)
- Endpoint: `POST /api/admin/bootstrap-area-texts`
- Zweck: fehlende Textstruktur robust aus Standardtexten + Inputs neu aufbauen.
- Beispiel (lokal):

```bash
curl -X POST "http://localhost:3000/api/admin/bootstrap-area-texts?token=wc24_bootstrap_2026_very_secret" \
  -H "Content-Type: application/json" \
  -d '{"area_id":"14-6-27","include_ortslagen":true,"mode":"all","dry_run":false}'
```

### Smoke-Checks nach jedem Sync
- Storage-Spotcheck: Report enthält top-level `text`.
- Frontend-Check Bundesland/Kreis/Ort:
  - General-/Standardtexte sichtbar.
  - Data-driven-Texte sichtbar.
- Karte:
  - `kreisuebersicht_<bundesland>.svg` enthält alle aktiven Kreise (Href-Slugs prüfen).

## 9) Risiken & Tradeoffs

- `HEAD`‑Checks für Landuse‑Images können je nach Storage‑Policy blockiert sein.
  - Alternative: Manifest mit `hasOrtLanduse` pro Ort.
- Sitemap‑`lastModified` basiert aktuell auf Kreis‑Report (gilt für Ortslagen).
  - Das ist korrekt solange Ort/Kreis immer gemeinsam aktualisiert werden.
- Cache‑Busting erfordert manuelles `ASSET_VERSION`‑Update bei neuen Uploads (lokal `.env.local`, Vercel Env + Redeploy).

---

## 10) Text‑Merge (DB → JSON)

Öffentliche Seiten verwenden **DB‑Overrides**, wenn vorhanden:
- Quelle: `report_texts`
- Filter: `status = 'approved'`
- Priorität: `optimized_content` überschreibt JSON‑Text
- Fallback: JSON‑Text aus Report

Implementierung:
- Merge in `features/immobilienmarkt/page/buildPageModel.ts`
- DB‑Fetch in `lib/data.ts` (`getApprovedReportTexts`)

### RLS‑Policy (Supabase)
```sql
alter table public.report_texts enable row level security;

drop policy if exists "report_texts_select_approved" on public.report_texts;
create policy "report_texts_select_approved"
on public.report_texts
for select
using (status = 'approved');
```

### SQL‑Checkliste
```sql
-- Gibt es approved Texte für eine Area?
select area_id, count(*)
from public.report_texts
where area_id = '14-7-13' and status = 'approved'
group by area_id;

-- Welche Keys sind überschrieben?
select section_key, optimized_content
from public.report_texts
where area_id = '14-7-13' and status = 'approved'
order by section_key;

-- Policies prüfen
select policyname, cmd
from pg_policies
where schemaname = 'public' and tablename = 'report_texts';
```

---

## 11) Quick Debug Checklist

- `SUPABASE_PUBLIC_BASE_URL` gesetzt?
- `reports/index.json` öffentlich erreichbar?
- `reports/deutschland/<bundesland>/<kreis>.json` erreichbar?
- Webserver‑Assets unter `.../fileadmin/user_upload/immobilienmarkt/...` vorhanden?
- `ASSET_VERSION` aktualisiert nach Upload?

---

## 12) Referenzdateien (Code)

- `lib/data.ts`
- `utils/assets.ts`
- `app/immobilienmarkt/[...slug]/page.tsx`
- `features/immobilienmarkt/page/buildPageModel.ts`
- `app/sitemap.ts`
- `app/api/fetch-json/route.ts`
