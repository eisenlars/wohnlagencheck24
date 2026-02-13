# Textgen QA Process (Iterative Workflow)

This document defines the repeatable, optimized QA workflow for data‑driven text generation.
It is intentionally detailed so the agent can follow it consistently and so we can evolve the
process over time with minimal ambiguity.

---

## 1) Goal

Deliver **error‑free, high‑quality** data‑driven texts by running a repeatable cycle:

1. Generate variants for a single text key.
2. Run QA checks (grammar, flow, repetition, sentence breaks).
3. Propose minimal, targeted changes in the phrase catalog.
4. Apply changes after approval.
5. Re‑run until the text is clean and stable.

The process is designed for both **Kreis** and **Ortslage** levels.

---

## 2) Definitions

**Key**  
One text identifier to be optimized, e.g. `immobilienmarkt_beschreibung_01`.

**Variant**  
One fully expanded version of a text template after combining all verb constructions.

**Preview Mode**  
Controlled via environment variables; used to write variants to log without affecting production.

---

## 3) Tools and Scripts

### 3.1 Trigger generation

**Default trigger (script)**  
`scripts/textgen-trigger.sh`

Defaults:
- token: `butterling_14713`
- bundesland: `sachsen`
- kreis: `leipzig`

Run:
```bash
bash scripts/textgen-trigger.sh
```

Override defaults:
```bash
TOKEN=... BUNDESLAND=... KREIS=... bash scripts/textgen-trigger.sh
```

---

### 3.2 Start dev server (preview)

**Helper (script)**  
`scripts/textgen-dev.sh`

Defaults:
- `TEXTGEN_PREVIEW=1`
- `TEXTGEN_PREVIEW_ALL=1`
- `TEXTGEN_PREVIEW_KEY=immobilienmarkt_beschreibung_01`

Run:
```bash
bash scripts/textgen-dev.sh
```

Override key:
```bash
TEXTGEN_PREVIEW_KEY=immobilienmarkt_beschreibung_02 bash scripts/textgen-dev.sh
```

### 3.2a Restart dev server (preview)

**Helper (script)**  
`scripts/textgen-restart.sh`

This stops an existing `next dev` process and starts a new one with the preview env.

Run:
```bash
bash scripts/textgen-restart.sh
```

Override key:
```bash
TEXTGEN_PREVIEW_KEY=immobilienmarkt_beschreibung_02 bash scripts/textgen-restart.sh
```

---

### 3.3 QA report for a key

**QA script**  
`scripts/textgen-qa.js`

Run:
```bash
node scripts/textgen-qa.js --key immobilienmarkt_beschreibung_01
```

Optional limit:
```bash
node scripts/textgen-qa.js --key immobilienmarkt_beschreibung_01 --limit 10
```

---

## 4) Environment Flags

These are required for preview variants:

- `TEXTGEN_PREVIEW=1` (enable logging)
- `TEXTGEN_PREVIEW_ALL=1` (log all variants for a key)
- `TEXTGEN_PREVIEW_KEY=<text_key>` (key to test)

The log file is written to:
```
tmp/textgen-preview.log
```

The log is reset on first write after server start (no append of old content).

---

## 5) Standard Iteration Flow

### Step 1 — Start preview server
```bash
TEXTGEN_PREVIEW=1 TEXTGEN_PREVIEW_ALL=1 TEXTGEN_PREVIEW_KEY=<KEY> npm run dev
```
Or:
```bash
TEXTGEN_PREVIEW_KEY=<KEY> bash scripts/textgen-dev.sh
```

### Step 2 — Trigger generation
```bash
bash scripts/textgen-trigger.sh
```

### Step 3 — Run QA report
```bash
node scripts/textgen-qa.js --key <KEY>
```

### Step 4 — Review & Fix
Agent proposes minimal changes in phrase catalogs.
Apply changes **only after approval**.

### Step 5 — Repeat
Re‑run Steps 2–4 until QA issues are zero.

---

## 5a) Stop‑Kriterium (“Optimal”)

Der Prozess gilt als **optimal**, wenn alle folgenden Punkte erfüllt sind:

1. **QA‑Script meldet 0 Issues** für den getesteten Key.  
2. **Stichprobe von 50 Varianten** zeigt keine Grammatik‑/Stilfehler.  
3. **Keine doppelten Formulierungen** im gleichen Absatz.  

Wenn diese drei Punkte erfüllt sind, wird eine **Abschluss‑Stichprobe** ausgegeben (siehe 5b).

---

## 5b) Abschluss‑Stichprobe

Nach Erreichen des Stop‑Kriteriums gibt der Agent **5–10 zufällige Varianten** aus
dem zuletzt generierten Log aus.  
Diese dienen der **manuellen Endkontrolle**.

Wenn die manuelle Kontrolle Auffälligkeiten ergibt, wird:
1. weiter optimiert, oder
2. der Prozessablauf in dieser Datei erweitert.

---

## 6) QA Rules (Current)

These are the baseline checks; extend as needed:

### Grammar
- Singular/plural mismatch (e.g. *„Durchschnittsmieten ... beträgt“*)
- Wrong pronoun (e.g. *„Damit liegt sie ...“* for plural subject)

### Sentence breaks
- Fragmented sentences (e.g. *„... 530 €/m². sind die Preise ...“*)

### Repetition
- Same word repeated in close proximity (e.g. *„Durchschnitt ... Durchschnitt ...“*)

---

## 7) Phrase Catalog Change Guidelines

When editing phrases:

1. **Change only what is required** for correctness.
2. **Preserve meaning** of the sentence.
3. **Avoid global refactors** unless agreed.
4. **Keep keys stable** (`phrases_*`, `verbkonstrukt_*`, `auxiliar`, `phrase`).
5. **No hidden fallbacks** that mask real issues.

---

## 8) Start Process from Chat

You can start the process with any of these:

```
textgen-qa key=immobilienmarkt_beschreibung_01
```

or:

```
Starte Textgen-QA für key=immobilienmarkt_beschreibung_01
```

The agent will follow this document and proceed with:
1) trigger, 2) QA report, 3) fix proposals, 4) apply after approval.

---

## 9) Notes

- This flow works for both **Kreis** and **Ortslage** (variants supported in both).
- For Ortslage, just pass a key from the Ortslage phrase catalog.

---

## 10) Pattern‑Learnings (strukturierter Ansatz)

Keep this section short. Add only if a new, reusable lesson was learned.

## 10a) Template‑Regeln (verbindlich)

- **Keine Fließtexte in `templates`:**  
  In `templates` stehen **nur Platzhalter** (`{{ ... }}`) und Verbkonstrukte‑Hooks.  
  **Alle Formulierungen** (Einleitungen, Übergänge, Vergleiche, Trends) müssen in den
  jeweiligen Bausteinen liegen:  
  `verbkonstrukt_trendText_*`, `phrases_trendText_*`, `phrases_staticText_*`.

- **3‑Varianten‑Pflicht (alle Bausteine):**  
  Für **jede Kategorie** gilt:  
  - `verbkonstrukt_trendText_*` → **3 Varianten**  
  - `phrases_trendText_*` → **3 Varianten**  
  - `phrases_staticText_*` → **3 Varianten**  
  **Zusatz:** Varianten müssen **unterschiedliche Wortgruppen** verwenden (z. B. Auxiliar nicht identisch).

**Referenz‑Satz für neue Keys:**  
„Bitte gemäß `docs/textgen_qa_process.md` arbeiten: keine Fließtexte in `templates`, 3‑Varianten‑Pflicht für alle Bausteine, danach QA‑Sampling.“

### Pattern‑Learnings
- **Standard‑Regel:** Jeder Textbaustein (Patterns **und** Phrases) hat **genau 3 Varianten**.  
  **Zusatz:** Varianten müssen **unterschiedliche Wortgruppen** enthalten (z. B. Auxiliar **nicht** identisch).  
  **Begründung:** Reproduzierbare Varianz, klare Kombinatorik, konsistente QA.

- **Pattern:** `In {{ kreis_name }} {{ auxiliar }} der Durchschnitt {{ phrase }}.`  
  **Regel:** Nur singular‑Auxiliar zulassen (`liegt`, `beträgt`).  
  **Kollision:** Phrase darf **nicht** mit „bei“ beginnen (sonst „beträgt … bei …“).

- **Pattern:** `Ein Blick auf die Mieten ... In {{ kreis_name }} {{ auxiliar }} die Durchschnittsmieten {{ phrase }}.`  
  **Regel:** Nur plural‑Auxiliar zulassen (`liegen`, `betragen`).  
  **Kollision:** Phrase darf keinen zusätzlichen Artikel/Prädikat enthalten.

- **Pattern:** `Für Grundstücke ...`  
  **Regel:** keine Formulierung mit „Durchschnitt“ + „Durchschnitt von ...“ im selben Absatz.  
  **Fix:** Pattern auf „aktueller Wert“ umstellen, wenn später ein Vergleichssatz folgt.

- **Pattern:** `Im Vorjahresvergleich {{ auxiliar }} die Preise {{ phrase }}.`  
  **Regel:** Auxiliar + Phrase als feste Paare behandeln.  
  **Kombis:**  
  - `sind` → „… gestiegen/gesunken geblieben“  
  - `haben sich` → „… erhöht/verringert“  
  - `zeigen` → „einen (leichten/deutlichen) Anstieg/Rückgang …“

### Kollisionsregeln
- **Punkt‑Kollision:** Punkt im Verbkonstrukt + Punkt im Template erzeugt `..`  
  **Fix:** Punkt im Verbkonstrukt entfernen, wenn Template bereits punktiert.
