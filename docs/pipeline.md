## Pipeline und Partnerdaten (Supabase -> JSON -> Frontend)

Dieser Leitfaden beschreibt den aktuellen Datenfluss fuer Partneranpassungen
und die JSON-Pipeline. Ziel ist, dass neue Teammitglieder die Logik schnell
verstehen und sicher erweitern koennen.

### 1) Quelle der Wahrheit fuer das Portal
- Frontend liest weiterhin nur aus den JSON-Reports unter `data/json/reports/`.
- Partnerdaten wirken erst, nachdem das Python-Skript die JSON-Dateien neu
  generiert/aktualisiert hat.

### 2) Supabase dient als Eingabeschicht
- Partner pflegen Faktoren und Texte im Dashboard (`/dashboard`).
- Tabellen in Supabase (Auszug):
  - `partners`
  - `areas`
  - `partner_area_config` (Faktoren, Trends, Rendite)
  - `report_texts` (optimierte Texte pro Bereich)
- Supabase ist damit *nicht* direkte Datenquelle fuer das Frontend, sondern
  Speicherschicht fuer das Python-Update.

### 3) Python-Update (JSON-Generator)
Der Generator:
1. Ermittelt die Region (Kreis/Ort) aus dem Datenbestand.
2. Sucht den Partner fuer die Region (z. B. `kreis_schluessel`).
3. Synchronisiert Partner und Areas nach Supabase (falls noch nicht vorhanden).
4. Liest bzw. erstellt `partner_area_config` mit Default-Faktoren.
5. Wendet Faktoren auf Preise, KPIs, Tabellen, Texte und Charts an.
6. Schreibt die finalen Werte in die JSON-Reports unter `data/json/reports/`.

Wichtig: Das Frontend reflektiert Partneraenderungen erst nach einem
erfolgreichen Lauf dieses Skripts.

### 4) Schluessel- und Mapping-Konventionen
- `area_id` basiert auf Schluesseln wie `bundesland-kreis-ort` mit Bindestrichen.
- Dashboard nutzt `area_id` direkt (z. B. `config.area_id`) und leitet daraus
  Kreis/Ort ab.
- Diese Konvention muss stabil bleiben, damit JSON, Supabase und Python
  synchron sind.

### 5) Texte (Unique Content)
- Partner koennen Texte via Dashboard (und KI) individualisieren.
- Die Texte liegen zuerst in `report_texts`, werden dann durch das Python-Update
  in die JSON-Reports ueberfuehrt.
- Die JSON bleibt dadurch einzige Quelle fuer die Ausgabe.

### 6) Geplante Erweiterungen
- CTA-Daten fuer KI-Immobilienbewertung
- Immobilien der Partner
Diese Daten sollten ebenfalls ueber den Python-Export in die JSON-Pipeline
ueberfuehrt werden, damit der Renderpfad konsistent bleibt.

### 7) Hinweise fuer Weiterentwicklung
- Schema-Aenderungen in Supabase sollten in `supabase/schema.sql` dokumentiert
  werden.
- Neue Felder brauchen ein klares Mapping: Supabase -> Python -> JSON -> UI.
- Sicherheitskritisch: RLS-Policies muessen aktiv sein, weil das Dashboard
  direkt gegen Supabase schreibt.
