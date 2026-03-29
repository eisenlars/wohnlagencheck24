# Daten- und Text-Pipeline

## Basisschicht: Reports

Reports werden aus dem Public Storage Bucket `immobilienmarkt` geladen. Relevante Loader sitzen in:

- `lib/data.ts`
- `features/immobilienmarkt/page/buildPageModel.ts`

Der Report ist die Rohquelle fuer:

- `meta`
- `data`
- Textbaeume unter `report.text` oder `report.data.text`
- Karten- und Assetableitungen

## Textquellen im Renderpfad

Die Laufzeit arbeitet nicht mit einer einzigen Textquelle. Im beobachteten Renderpfad fuer Kreis und Ortslage
wirken mehrere Ebenen nacheinander.

## Effektive Overlay-Reihenfolge in `buildPageModel()`

### 1. Rohreport harmonisieren

- `report.text` und `report.data.text` werden auf einen gemeinsamen Textbaum gezogen.

### 2. Systempartner-Default-Profil injizieren

Nur fuer Kreis/Ortslage und nur wenn der aktive Public-Partner als Systempartner markiert ist:

- `applySystempartnerDefaultProfileToReportText()`

### 3. Partner-Runtime-State anwenden

Falls fuer Partner/Gebiet ein Runtime-State existiert:

- `data_json` ueberschreibt Report-Daten
- `textgen_inputs_json` wird unter `data.textgen_inputs[scope]` verankert
- `helpers_json` erweitert `report.helpers`

### 4. Admin-Area-Overrides fuer Systempartner anwenden

Nur fuer Systempartner im Gebietsscope:

- freigegebene Admin-Texte
- bei `locale != de` zusaetzlich live Uebersetzungen dieser Admin-Texte

### 5. Datengetriebene Texte anwenden

`applyDataDrivenTexts()` erzeugt oder aktualisiert Texte aus Report-Daten und optional einer Ortslagen-Namensmap.

### 6. Partner-Generated-Texts anwenden

Falls fuer Partner/Gebiet generierte Texte gespeichert sind:

- `partner_area_generated_texts` ueberschreibt den aktuellen Textbaum

### 7. Freigegebene Partner-Overrides anwenden

`report_texts` mit `status = approved` ueberschreiben die bis dahin entstandenen Texte.

### 8. Ortslagen-Fallback aus dem Kreisprofil

Auf Ortslagenebene wird zusaetzlich der zugehoerige Kreisreport geladen. Danach werden:

- Systempartner-Defaults des Kreises
- Kreis-Admin-Overrides und Uebersetzungen
- freigegebene Kreis-`report_texts`

auf den Kreistext angewandt und anschliessend profilbezogene Schluessel wie `berater_*` und `makler_*`
als Fallback in den Ortslagentext eingezogen.

### 9. Bundesland-Fallbacks aus sichtbaren Kreisen

Auf Bundeslandebene werden:

- Admin-Overrides und Uebersetzungen
- sichtbare Kreise
- Kreis-Texte

genutzt, um Teaser, Makler- und Beraterlisten sowie Fallback-Texte auf Bundeslandebene zu erzeugen.

## Kontakt- und Medienschicht

Pflichtmedien und Kontaktinformationen sind Teil der Text-/Renderpipeline:

- Medien-URLs werden ueber `resolveMandatoryMediaSrc()` normalisiert
- Kontakttexte koennen vom Kreis in die Ortslage fallen
- Systempartner-Defaults wirken direkt auf Beraterfelder

## Rebuild-Region-Pipeline

`app/api/rebuild-region/route.ts` ist der operative Kern fuer den datengetriebenen Neuaufbau eines Gebiets.

### Eingang

- `area_id`
- `scope`
- `mode`
- `previous_factors`
- optional `debug`

### Verarbeitung

- Faktornormalisierung
- Skalierung zahlreicher Report-Kennzahlen ueber Jahres- und Vergleichsreihen
- Aktualisierung von Trend- und Indexwerten
- Erzeugung neuer Preistexte und Section-Signaturen ueber `lib/text-core`

### Persistenz

- Runtime-State pro Partner/Gebiet
- generierte Texte pro Partner/Gebiet
- Revalidierung von Report- und Routentags

Der Rebuild ist damit keine reine Textoperation, sondern ein kombinierter Daten- und Text-Neuaufbau.

## `text-core`

`lib/text-core/*` stellt unter anderem bereit:

- Preistext-Generierung fuer Kreis
- Preistext-Generierung fuer Ortslage
- Section-Signaturen
- datengetriebene Textanwendung

Der Text-Core ist damit die eigentliche Bruecke zwischen Kennzahlen, Templates und renderbaren Endtexten.

## Weitere Textquellen ausserhalb des Page-Builders

- `partner_marketing_texts`
  SEO-/Marketing-Metadaten fuer Public-Detailseiten
- `partner_local_site_texts`
  Local-Site-spezifische Overrides
- `partner_texts_i18n`
  kanalbezogene Uebersetzungen fuer `portal`, `local_site`, `marketing`
- `portal_content_entries`
  CMS-Texte fuer statische und lokalisierte Public-Seiten

## Lokales Merging fuer Local-Site

`lib/local-site-text-merge.ts` verwendet eine eigene Prioritaet:

1. freigegebene `partner_local_site_texts`
2. freigegebene `report_texts`
3. rohe Report-Texte

Dabei werden pro `section_key` Metadaten wie Quelle, Status und letzter Stand mitgefuehrt.
