## Projektkontext

Aufbau Webportal für Immobilienmarkt und Standortprofile

Dieses Repository enthält die Portalentwicklung mit der Primäraufgabe der Präsentation von im Backend analysierten-/berechneten  wohnlagen- und marktbezogenen Standortindikatoren-/Daten auf Ortslagen- Kreis- und Bundeslandebene. Ziel ist ein technischer Aufbau, der optimal den aktuellen Anforderungen von SEO (Google), GEO (LLMs) aber auch dem Nutzer (nutzerfreundliche UI) entspricht. 

Navigationsstrukt
- Immobilienmarkt & Standortprofile
-- Bayern
-- Niedersachsen
-- weitere erfasste Bundesländer
- Konzept
- Weitere Inhalte (Immobilienangebote, Immobiliengesuche)

Die Datenverarbeitung erfolgt überwiegend JSON-basiert und ist strukturell komplex. Fehlerhafte Strukturänderungen können die gesamte Pipeline unbrauchbar machen.

Perspektivisch werden folgende Punkte im Projekt relevant:
1. Mehrsprachigkeit 
2. Login, personalisierter Bereich 
3. neue CTA Bereiche, basierend auf Daten
4. Import von Objekt- und Gesuchedaten per API  oder OpenImmo aus verschiedenen Immobilien CRM (integrierte Datenbank)



---

## Projektstruktur & Modulorganisation
- App-Router-Seiten und Layouts befinden sich in `app/`.
- Funktionsspezifische Logik ist unter `features/` organisiert, insbesondere in
  `features/immobilienmarkt/` für Routenauflösung, View-Model-Builder und Sections.
- Wiederverwendbare UI-Komponenten liegen in `components/`.
- Daten und Assets sind dateibasiert abgelegt: Reports in `data/json/reports/`,
  SVG-Karten in `data/visuals/` und statische Assets in `public/`.
- Utilities und Formatierungshelfer befinden sich in `utils/` und `lib/`
  (z. B. `lib/data.ts` zum Laden von Reports).
- die Projektstruktur kann wenn notwendig erweitert bzw. modifiziert werden, aber immer nach Rücksprache

---

## Arbeitsregeln

### 1. Schreibrechte / Sicherheit
- Änderungen an Dateien dürfen **niemals automatisch** durchgeführt werden.
- Vor jeder Änderung sind:
  - betroffene Dateien,
  - Ziel der Änderung,
  - und ein zusammengefasster Diff zu präsentieren.
- Shell-Befehle dürfen nur nach expliziter Bestätigung ausgeführt werden.

### 2. Git-Workflow
- Das Projekt ist ein Git-Repository.
- Vor strukturellen Änderungen ist stets darauf hinzuweisen, falls ein Commit sinnvoll wäre.
- Codex erstellt **keine Commits** selbstständig.

### 3. JSON-Strukturen (kritisch)
- Bestehende Schlüssel, Hierarchien und Suffix-Konventionen (z. B. `_01` = aktuelles Jahr, `_05` = Vergleichsjahr) dürfen **nicht verändert** werden.

### 4. Analyse vor Aktion
- Vor jeder Code-Änderung ist zunächst zu erklären:
  - welche Logik aktuell besteht,
  - welche Seiteneffekte zu erwarten sind,
  - welche Alternativen bestehen.

### 5. Tests & Validierung
- Nach Änderungen an Berechnungslogiken ist immer vorzuschlagen:
  - welche Tests ergänzt oder angepasst werden sollten,
  - wie die fachliche Validierung erfolgen kann.

### Coding Style & Benennung

- TypeScript / JavaScript, JSON ist das primäre Austauschformat.
- Keine Umbenennung bestehender Felder oder Funktionen ohne explizite Anweisung.
- Neue Funktionen müssen sprechend, fachlich eindeutig und konsistent benannt werden.

---

## Infrastruktur

### Lokale Entwicklung

- `npm run dev` – startet lokale Entwicklungsumgebung
- `npm run build` – Produktionsbuild
- `npm run lint` – Linting / Qualitätsprüfung


Vor Ausführung eines dieser Befehle ist immer Rückfrage zu halten.

### GitHub
- Repository ist die primäre Quelle der Wahrheit.
- Pull-Requests und Reviews erfolgen extern in GitHub.

### Vercel
- Projekt wird über Vercel deployt.
- Build- und Deploy-Konfigurationen dürfen nicht ohne Rücksprache verändert werden.

---

## Kommunikationsstil
- Antworten präzise, technisch und ohne vereinfachende Verkürzungen.
- Bei Unsicherheit immer Rückfragen stellen, statt Annahmen zu treffen.