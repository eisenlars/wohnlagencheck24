# Rebuild Region (Preisfaktoren + Textgenerierung)

Stand: 2026-02-06

## 1) Ziel

Der Rebuild-Prozess aktualisiert für eine konkrete Region:
- preisrelevante Datenfelder in `data.*`
- Text-Inputs in `data.textgen_inputs.*`
- datengenerierte Preis-Texte in `text.*`

und schreibt das Ergebnis zurück nach Supabase Storage (`immobilienmarkt/reports/...`).

Rebuild bedeutet hier: bestehende Report-JSONs werden anhand der aktuellen Partner-Faktoren neu skaliert und Texte neu generiert. Es ist kein Python-Rohdatenlauf und ersetzt keine monatliche Datenpipeline.

---

## 2) Aktuelle Quellen der Wahrheit

1. **DB (`data_value_settings`)**
   - enthält Partner-Faktoren (z. B. `kauf_haus.f01`)
   - wird im Dashboard gepflegt
   - Legacy‑Spalten entfernt (2026‑02‑05): `price_factor_houses`, `price_factor_apartments`, `custom_intro_text`, `custom_market_report`
2. **Storage Report-JSON**
   - ist die Quelle für Frontend-KPIs/Charts/Basistexte
   - `helpers` ist Pflichtfeld für Rebuild (applied_factors, textgen_signatures, textgen_last_aktualisierung)
3. **DB Text-Overrides**
   - `report_texts` und `partner_marketing_texts` überschreiben nur Textbereiche, nicht numerische KPIs

---

## 2.1) Minimalstruktur Report-JSON (Rebuild)

Pflichtfelder:
- `data`
- `meta`
- `helpers`

Pflichtfelder je Scope:
- `data.textgen_inputs.kreis` für Kreis-Rebuild
- `data.textgen_inputs.ortslage` für Ortslage-Rebuild

Pflichtfelder in `helpers`:
- `helpers.applied_factors`
- `helpers.textgen_signatures`
- `helpers.textgen_last_aktualisierung`

Fehlen diese Felder, bricht der Rebuild ab.

---

## 3) UI-Flow im Partnerbereich (aktuell)

In `Preisfaktoren` gibt es einen kombinierten Button:
- **`Neu berechnen & live schalten`**

Ablauf:
1. Faktorwerte in `data_value_settings` speichern
2. Rebuild API aufrufen
3. Storage-JSON aktualisieren
4. Erfolgsmeldung anzeigen
5. optional: Button **`Ergebnisse jetzt neu laden`** (öffnet Seite mit `?refresh=<timestamp>`)

Zusätzlich:
- Direkt an jedem Feld läuft eine **Vorschau**: `Basiswert -> Faktor -> neuer Wert`.

---

## 4) API: `POST /api/rebuild-region`

Datei: `app/api/rebuild-region/route.ts`

Body:
```json
{
  "area_id": "14-7-13",
  "scope": "kreis",
  "mode": "full",
  "previous_factors": { "...": "..." },
  "debug": false
}
```

### Sicherheitsregeln
- `REBUILD_REGION_ENABLED=1` muss gesetzt sein
- nur eingeloggter Partner
- Partner muss Zugriff auf `area_id` in `partner_area_map` haben

### Ablauf
1. Region (`areas`) laden (`slug`, `parent_slug`, `bundesland_slug`)
2. Report aus Storage laden (`download`, nicht Public-URL-fetch)
3. Partner-Faktoren aus `data_value_settings` laden (`area_id` + `auth_user_id`)
4. Delta-Faktoren berechnen:
   - `target_factors` aus DB
   - `previous_factors` aus `helpers.applied_factors`, fallback `payload.previous_factors`
   - `delta = target / previous`
5. Delta auf `data.*` anwenden
6. Delta auf `data.textgen_inputs.{kreis|ortslage}` anwenden
7. Preis-Texte neu generieren (`lib/text-core/*`)
8. `helpers.applied_factors = target_factors` setzen
9. `helpers.textgen_last_aktualisierung = meta.aktualisierung` setzen
10. JSON mit `upsert` zurück in Storage schreiben (`cacheControl: "0"`)
11. `revalidateTag("reports", "max")`

Zusätzlich (API-Details):
- `mode = "textgen_only"` überspringt Faktor-Anwendung und berechnet nur Texte neu.
- `debug = true` liefert Debug-Payload (Vorher/Nachher + Pfade/Links).

---

## 5) Scope der Textgenerierung (Phase-1)

Regeneriert werden aktuell:
- `immobilienpreise`
- `mietpreise`
- `mietrendite`
- `grundstueckspreise`

Nicht in Phase-1:
- vollständiger `immobilienmarkt_ueberblick`-Neuaufbau in Next.js

---

## 6) Cache-Verhalten (wichtig)

- Frontend-Reportloader läuft derzeit mit `cache: "no-store"` in `lib/data.ts`.
- Ziel: während Stabilisierung maximale Konsistenz statt maximaler Cache-Performance.
- Trotz `cacheControl: "0"` kann Public-URL/CDN in Einzelfällen kurz verzögert reagieren.

---

## 7) Debug-Checkliste (DB vs Storage vs Frontend)

### A) Faktor in DB
```sql
select auth_user_id, area_id, kauf_haus->>'f01' as kauf_haus_f01, last_update
from public.data_value_settings
where area_id = '14-7-13';
```

### B) Storage-Report prüfen
Pfad:
`immobilienmarkt/reports/deutschland/sachsen/leipzig.json`

Relevante Keys:
- `helpers.applied_factors.kauf_haus.f01`
- `data.immobilien_kaufpreis[0].kaufpreis_immobilien`
- `data.haus_kaufpreis[0].kaufpreis_haus`
- `data.haus_kaufpreisspanne[0].preis_haus_avg`

### C) Frontend prüfen
Beispiel:
`/immobilienmarkt/sachsen/leipzig/immobilienpreise`

Hinweis:
- Hero-Leit-KPI basiert auf `immobilien_kaufpreis[0].kaufpreis_immobilien`
- Hauspreise-Block basiert auf `haus_kaufpreisspanne[0].preis_haus_avg`

---

## 8) Bekannte Grenzen / nächste Schritte

- Cache kann in Public-Auslieferung kurzfristig verzögert sein.
- Später optional:
  - kontrollierte Revalidate-Strategie statt dauerhaft `no-store`
  - optionaler Publish/Draft-Status für Rebuild-Ergebnisse
  - erweiterte Textgenerierung für weitere Themenbereiche

---

## 8.1) Report-JSON: helpers-Strang (aktuell)

- `helpers.applied_factors` ist der gespeicherte Zielstand der Faktoren (ehemals `meta.applied_factors`).
- `helpers.textgen_last_aktualisierung` ist der zuletzt verarbeitete `meta.aktualisierung`-Stand.
- `helpers.textgen_signatures` hält Signaturen je `scope` (`kreis|ortslage`).

Bei Signaturänderungen werden `report_texts` für die betroffenen `section_key`s gelöscht,
damit die Rebuild-Textgen wieder konsistent ist.

---

## 8.2) Markttrend & Zeitreihen-Faktorisierung

- Markttrend (additiv): `immobilienmarkt_situation.*_index` wird um den Trend-Delta-Wert additiv angepasst, Werte werden auf `[-100, 100]` geclamped.
- Zeitreihen (jahrbezogen): Zeitreihen werden pro Zeile anhand des Jahres skaliert. Basis ist `year01`: je weiter ein Jahr in der Vergangenheit liegt, desto höher ist der `f0x`‑Index (`f01..f06`).

---

## 9) Operator-Runbook (Tagesbetrieb)

### 9.1 Standardablauf Preisfaktor-Änderung
1. Region im Partnerbereich auswählen.
2. Faktor(e) anpassen (z. B. `kauf_haus.f01`).
3. Vorschau am Feld prüfen (Basis -> Faktor -> Neu).
4. `Neu berechnen & live schalten` klicken.
5. Erfolgsstatus abwarten.
6. Optional `Ergebnisse jetzt neu laden` klicken.

### 9.2 Sofort-Checks nach Änderung
- DB:
  - `data_value_settings.kauf_haus->>'f01'` entspricht Eingabe?
- Storage:
  - `helpers.applied_factors.kauf_haus.f01` entspricht Eingabe?
  - Zielwert in `data.*` aktualisiert?
- Frontend:
  - KPI/Tabellen/Charts auf Zielseite konsistent?

### 9.3 Wenn Werte nicht zusammenpassen
1. Prüfen, ob wirklich `Neu berechnen & live schalten` genutzt wurde
   (nur DB speichern reicht nicht).
2. Prüfen, ob in Storage derselbe Report-Pfad kontrolliert wurde.
3. Seite per `Ergebnisse jetzt neu laden` mit `?refresh=` öffnen.
4. Falls weiterhin Inkonsistenz: DB/Storage/Frontend-Werte parallel notieren und gegen die Checkliste aus Abschnitt 7 prüfen.

### 9.4 Wann Python-Lauf notwendig ist
- Bei neuen Rohdaten / Monatsupdate.
- Wenn die Storage-Basiswerte grundsätzlich neu gesetzt werden müssen.
- Partner-Rebuild in Next.js ist für laufende Faktoränderungen gedacht, nicht für Rohdaten-Neuberechnung.

---

## 10) Governance für alle datengenerierten Texte

Diese Regeln gelten für **alle** datengenerierten Textbereiche (nicht nur Preise).

### 10.1 Grundprinzip
- Datengenerierte Texte werden aus strukturierten Inputs erzeugt (Kontext + Zahlenbezug).
- Manuelle Bearbeitung ist erlaubt, kann aber den fachlichen Kontext entkoppeln.
- Deshalb wird manuelle Bearbeitung bewusst als Ausnahme behandelt.

### 10.2 Editor-Regeln (Partnerbereich)
- Datengenerierte Texte erhalten im UI einen eigenen Typ (`data_driven`).
- Vor Freischaltung einer manuellen Bearbeitung wird ein Hinweis angezeigt:
  - „Dieser Text ist datengeneriert. Manuelle Änderungen können den Kontext zur Datenlage verfälschen.“
- Bearbeitung bleibt **text-only** (keine numerischen Eingaben im Texteditor).
- Nach manueller Freigabe wird ein sichtbarer Status-Badge gesetzt:
  - „Manuell bearbeitet – Kontextprüfung empfohlen“.

### 10.3 Override-Regeln
- `approved`-Override hat Vorrang gegenüber Storage-Text (wie bisher).
- Für datengenerierte Texte soll es zwei Zustände geben:
  1) `auto` (Rebuild darf Text neu erzeugen)
  2) `manual` (Rebuild respektiert Override-Text)
- Empfohlene Felder (logisch, falls Schema erweitert wird):
  - `is_data_driven` (bool)
  - `override_mode` (`auto` | `manual`)
  - `context_warning_acknowledged` (bool)

### 10.4 Rebuild-Regeln
- Rebuild aktualisiert immer numerische Datenfelder.
- Textverhalten je Abschnitt:
  - `override_mode=auto`: datengenerierter Text wird neu geschrieben.
  - `override_mode=manual`: Text bleibt auf Override-Stand; UI warnt bei möglicher Kontextabweichung.

### 10.5 Unique-Text-Strategie (gegen Duplicate Content)
- Variation nicht rein zufällig pro Request, sondern stabil pro:
  - `area_id + section_key + meta.aktualisierung`
- Empfehlung:
  - deterministischer Seed für Phrasenauswahl
  - Rotation über Phrasenpools
  - optional Duplikat-Check über Hash gegen letzten Stand

### 10.6 Migration bestehender Overrides
- Bestehende `approved`-Einträge für datengenerierte `section_key`s klassifizieren:
  - fachlich gewollt manuell -> `manual`
  - nicht mehr gewollt -> auf `draft` oder `auto` zurück
- Vor Rollout eine Liste aller datengenerierten `section_key`s zentral pflegen.
