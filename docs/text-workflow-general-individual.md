# Text-Workflow General + Individual (Next.js)

Stand: 2026-02-23

Diese Doku beschreibt den aktuellen Soll-Prozess fuer
- `general` Texte (allgemeine Einleitungs-/Erklaertexte)
- `individual` Texte (persoenliche Berater-/Maklertexte)

Wichtig:
- Data-driven Textgen (preis-/datengetrieben) ist **separat** geregelt.
- Der alte Python-Flow fuer Promptgenerierung/Textlauf wird fuer diesen Scope in TS/Next.js ersetzt.

---

## 1) Scope und Ziel

Ziel ist ein einheitlicher Textprozess in Next.js/TypeScript:
- Standardtexte kommen aus Storage.
- Partner koennen pro Feld weiter manuell bearbeiten (bestehende Feld-Buttons bleiben).
- Zusaetzlich gibt es globale KI-Hilfslaeufe fuer GENERAL-Texte pro Themenblock.
- Gebietsfreischaltung (Go-Live) wird ueber Mandatory-INDIVIDUAL-Felder validiert.

Nicht Ziel in Phase 1:
- automatische Internet-Recherche im LLM-Lauf.
- globale KI-Laeufe fuer `data_driven` oder `individual`.

---

## 2) Quelle der Standardtexte

Storage-Pfad (Bucket `immobilienmarkt`):
- `text-standards/kreis/text_standard_kreis.json`

API im Frontend:
- `GET /api/fetch-text-standards`
- Implementierung: `app/api/fetch-text-standards/route.ts`

Verwendung im Editor:
- `app/dashboard/TextEditorForm.tsx`
- Fallback-Reihenfolge je Key:
  1. DB-Override (`optimized_content`)
  2. Report-JSON (`/api/fetch-json`)
  3. Standarddatei (`/api/fetch-text-standards`)

Damit sind auch fehlende Keys in einzelnen Reports sauber vorbelegt.

---

## 3) Text-Key-Klassen (Registry)

Zentrale Registry:
- `lib/text-key-registry.ts`
- `TEXT_KEY_REGISTRY_VERSION = "v1"`

### 3.1 `GENERAL_STANDARD_KEYS`
General-Standardtexte ohne Pflichtcharakter fuer Aktivierung.

### 3.2 `GENERAL_REGION_FOCUS_KEYS`
Spezielle Fokus-Keys mit regionalem Charakter:
- `wohnlagencheck_allgemein`
- `wohnlagencheck_lage`

Hinweis: Diese Keys sind **nicht** Aktivierungs-Pflicht, aber Teil der General-Optimierungslogik.

### 3.3 `INDIVIDUAL_MANDATORY_KEYS`
Diese Felder sind Pflicht fuer Gebietsfreischaltung (`is_active=true`):
- `immobilienmarkt_individuell_01`
- `immobilienmarkt_individuell_02`
- `immobilienmarkt_zitat`
- `immobilienmarkt_maklerempfehlung`
- alle relevanten `berater_*` Felder (Kontakt + Profil)
- alle relevanten `makler_*` Felder (Kontakt + Profil)

Konkrete Liste ist in `lib/text-key-registry.ts` verbindlich gepflegt.

---

## 4) Go-Live-Gate (einmalige Gebietsfreischaltung)

Trigger:
- `PATCH /api/admin/partners/[id]/areas/[area_id]`
- nur beim Aktivieren: `is_active = true`
- Partner-Submit vor Admin-Freigabe:
  - `POST /api/partner/areas/[area_id]/submit-review`

Implementierung:
- `app/api/admin/partners/[id]/areas/[area_id]/route.ts`

Regel:
- Geprueft werden **nur** `INDIVIDUAL_MANDATORY_KEYS`.
- Ein Key gilt als fehlend, wenn
  - kein effektiver Text vorhanden ist (`missing`) oder
  - nur Standardtext unveraendert verwendet wird (`default`).

Effektiver Text je Key:
1. approved Override aus `report_texts`
2. sonst Report-Text

Scope-safe Ausnahme:
- Wenn ein Key weder im Report noch im passenden Standardzweig existiert, wird er fuer diesen Scope nicht als Pflichtfeld gewertet.

Fehlerantwort bei Block:
- HTTP `409`
- `missing_keys`
- `gate: "INDIVIDUAL_MANDATORY"`

Wichtig:
- Dieses Gate ist **separat** vom Preisfaktoren/Rebuild-Prozess.
- Keine Kopplung an „Neu berechnen & live schalten“.

Statusfluss:
1. Zuweisung: `assigned` (inaktiv)
2. Bearbeitung Partner: `in_progress`
3. Partner klickt `Freigabe anfordern`: `ready_for_review`
4. Admin aktiviert: `active`

---

## 5) KI-Optimierung im Editor (GENERAL only)

UI:
- `app/dashboard/TextEditorForm.tsx`

Bestehende Einzel-Feld-Buttons bleiben unveraendert.

Neue globale Hilfsbuttons (Fast-Start), nur auf `report_texts`:
1. `KI optimiert GENERAL im Themenblock`
2. `GLOBAL Kreis + Ortslagen (GENERAL)`

Filter fuer globale Verarbeitung:
- nur Sektionen mit `type === "general"`
- Key muss in `GENERAL_STANDARD_KEYS` oder `GENERAL_REGION_FOCUS_KEYS` liegen

### 5.1 Themenblock-Lauf
- Bearbeitet GENERAL-Keys des aktiven Tabs.
- Pro Key ein KI-Request.
- Ergebnis wird fuer aktuelle Region gespeichert.

### 5.2 GLOBAL Kreis + Ortslagen
- Nur auf Kreis-Ebene startbar.
- Pro Key:
  1. ein individueller Kreistext
  2. ein Ortslagen-Template
- Danach Verteilung des Templates auf alle Ortslagen des Kreises
  - Platzhalterersetzung via `{ortsname}` und `[[ORTSLAGE_NAME]]`.

Damit entsteht ein kontrollierter Massenstart ohne individuellen Request pro Ortslage.

---

## 6) Prompt-Prefill (TS statt Python)

Datei:
- `lib/text-prompt-generator.ts`

API:
- `buildGlobalPromptPrefill(tabId, variant, areaName)`

Varianten:
- `tab_general`
- `kreis_text`
- `ort_template`

UI:
- Global-Prompt-Panel in `TextEditorForm`
- Prompts sind vorbelegt, aber editierbar.

Nutzen:
- Promptkontrolle liegt beim Nutzer.
- Python-Promptgenerator ist fuer diesen Scope nicht mehr erforderlich.

---

## 7) Laufbericht und Fehlertransparenz

Im globalen Lauf wird ein Report gefuehrt:
- `processed`
- `skipped`
- `failed`

Anzeige direkt im UI (kompakter Laufbericht), inkl. Fehlerliste.

Typische Skip-/Fail-Gruende:
- kein Quelltext vorhanden
- leere KI-Antwort
- Speichern/Upsert fehlgeschlagen

---

## 8) Performance-Hinweise

Aktuelle Strategie reduziert Requests bereits deutlich:
- Kreis+Ortslagen-Modus arbeitet mit 2 KI-Requests pro Key (statt pro Ortslage).

Weitere Optimierungen (spaeter):
- serverseitige Queue/Batches
- Concurrency-Limit + Retry/Backoff
- idempotente Job-IDs + Resume

---

## 9) Abgrenzung zu anderen Prozessen

- Local-Site-Textkanal (falls `partner_local_site_texts` in eurer Umgebung aktiviert ist) ist fuer das Aktivierungs-Gate nicht relevant.
- Data-driven Text-Rebuild bleibt in `docs/rebuild-region.md`.
- Mandatory-Gate fuer Gebietsfreischaltung bleibt ein eigener Admin-Flow.
