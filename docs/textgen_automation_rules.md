# Textgen Automation Rules (Opt‑In)

Diese Regeln sind eine **explizite Ausnahme** zu den allgemeinen Vorgaben aus `AGENTS.md`.
Sie gelten **nur** für den Textgen‑Workflow und nur für die unten genannten Dateien/Skripte.

## 1) Gültigkeitsbereich (Scope)

**Erlaubt ohne Rückfragen**:
- `lib/text-core/phrases/**/*.json`
- `lib/text-core/generate-*.ts`
- `lib/text-core/apply-data-driven.ts`
- `scripts/textgen-*.sh`
- `scripts/textgen-*.js`
- `docs/textgen_qa_process.md`
- `docs/textgen_automation_rules.md`

**Nicht erlaubt ohne Rückfragen**:
- alle anderen Dateien
- Build/Deploy‑Konfiguration (Vercel)
- produktive Daten/Syncs außerhalb des lokalen QA‑Modus

## 2) Erlaubte Aktionen (ohne Rückfragen)

- Phrasen‑/Verbkonstrukt‑Optimierung im Scope  
- QA‑Sampling (50 gleichverteilte Varianten)  
- Iterationen bis zur Zielqualität  
- **Server‑Restart im QA‑Modus**  
- Triggern der lokalen QA‑Endpoints  

## 3) Verbindliche Regeln

- **Keine Fließtexte in `templates`** (nur Platzhalter/Verbkonstrukte)
- **3‑Varianten‑Pflicht** für:
  - `verbkonstrukt_trendText_*`
  - `phrases_trendText_*`
  - `phrases_staticText_*`
- Varianten müssen **unterschiedliche Wortgruppen** haben (Auxiliar nicht identisch).

## 4) Standard‑Ablauf (Automatisiert)

1. `TEXTGEN_PREVIEW_KEY=<key>` setzen  
2. Restart → Trigger → QA (50 Samples)  
3. Fehler beheben, erneut QA  
4. Wenn keine Issues + Stichprobe ok → fertig

## 5) Stop‑Kriterien

Automatisierung endet, wenn **alle** erfüllt sind:
- QA‑Issues = 0
- 50 Sample‑Varianten geprüft, keine Grammatik‑/Doppelungsfehler
- Mind. 3 Stichproben manuell angezeigt

## 6) Dokumentation von Learnings

Neue wiederkehrende Fehler/Regeln werden **kurz** in `docs/textgen_qa_process.md`
unter „Pattern‑Learnings“ ergänzt.
