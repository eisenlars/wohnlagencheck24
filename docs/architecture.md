# Architektur – Immobilienmarkt & Standortprofile

Stand: 2026-01-28

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

Alle Loader sind **async** und nutzen `fetch()` mit `revalidate` + `tags: ["reports"]`.

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

## 6) Updates (monatlich)

**Workflow (Python)**
1. Python berechnet Reports + Texte
2. Erzeugt `reports/index.json`
3. Upload nach Supabase Storage
4. (Optional) Upload der statischen Assets auf Webserver
5. (Optional später) Revalidate‑API call

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

---

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
