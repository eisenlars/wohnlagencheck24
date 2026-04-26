# Public-Portal

## Route-Struktur

### Deutsche Public-Flaeche

- `/`
  Landingpage
- `/kontakt`
  Konzept-/Strukturseite mit Einstiegslinks
- `/impressum`
- `/datenschutz`
- `/immobilienmarkt`
  Uebersicht der freigegebenen Regionen
- `/immobilienmarkt/[...slug]`
  hierarchische Detailrouten fuer Bundesland, Kreis, Ortslage und Section-Tails

### Lokalisierte Public-Flaeche

- `/[locale]`
- `/[locale]/kontakt`
- `/[locale]/impressum`
- `/[locale]/datenschutz`
- `/[locale]/immobilienmarkt`
- `/[locale]/immobilienmarkt/[...slug]`

Die lokalisierte Auslieferung wird in `app/[locale]/layout.tsx` nur freigeschaltet, wenn das Locale
in `portal_locale_config` als `is_active = true` und `status = live` gefuehrt wird.

### Preview-Flaeche

- `/preview/immobilienmarkt/[...slug]`

Preview nutzt denselben Page-Builder wie Public, arbeitet aber mit `audience = preview`,
einem separaten Path-Prefix und vorgeschalteter Access-Pruefung.

## Route-Aufloesung

Der Resolver in `features/immobilienmarkt/routes/resolveRoute.ts` leitet den Level im Wesentlichen
aus der Slug-Tiefe ab:

- 0 Slugs -> Deutschland-Einstieg
- 1 Slug -> Bundesland
- 2 Slugs -> Kreis
- 3 Slugs -> Ortslage

Ein optionales finales Slugsegment kann als Section interpretiert werden, sofern es zu den erlaubten
`ReportSection`-Werten gehoert.

## Sichtbarkeitsmodell

### Quelle der Public-Sichtbarkeit

Die Public-Sichtbarkeit wird aus `partner_area_map` abgeleitet und als `visibility_index.json`
publiziert. Der Public-Layer liest nicht direkt die Reports als Freigabequelle.

### Sichtbarkeitsregeln

- Ein Bundesland ist sichtbar, wenn mindestens ein Kreis freigegeben ist.
- Ein Kreis ist sichtbar, wenn sein Slug im Visibility-Index aktiv ist.
- Eine Ortslage ist sichtbar, wenn der Kreis sichtbar ist und:
  - entweder die Ortslage explizit im Index steht
  - oder fuer den Kreis keine explizite Ortslagenliste existiert; dann sind alle Ortslagen sichtbar

Diese Fallback-Regel ist Teil von `lib/area-visibility.ts` und relevant fuer Routing, Navigation
und SEO-Projektionen.

## Page-Builder

`features/immobilienmarkt/page/buildPageModel.ts` ist der zentrale Public-Assembler. Er liefert:

- `report`
- `tabs` und `activeTabId`
- `tocItems`
- `ctx` mit Bundesland-, Kreis- und Ortslagenkontext
- `assets` wie Karten, Hero-Bilder und Legenden
- `kontakt` fuer Portal- oder Beraterkontakt
- `flags`, aktuell unter anderem fuer Systempartner-Kontext

Der Builder ist fuer Bundesland, Kreis und Ortslage unterschiedlich verzweigt:

- Bundesland:
  sichtbare Kreise, Berater-/Maklerlisten, Bundesland-Hero, Kreisuebersichtskarte
- Kreis:
  sichtbare Ortslagen, Marktkarten, Legenden, Hero, Kontaktkontext
- Ortslage:
  Kreis-Assets plus Ortslagenkontext und Kontakt-/Fallback-Textlogik

## Text- und Kontaktquellen im Public-Layer

Die exakte Overlay-Reihenfolge steht in `data-text-pipeline.md`. Fuer das Public-Portal relevant ist:

- Reports sind nur die Basisschicht.
- Systempartner-, Admin-, Runtime-, Generated- und Partner-Overrides wirken im Renderpfad direkt auf den Textbestand.
- Kontaktinformationen koennen auf Ortslagenebene aus dem Kreisprofil geerbt werden.

## Statische Seiten und CMS

Die Landingpage und die Konzept-/Kontaktseite lesen strukturierte Inhalte ueber `portal_content_entries`.
Zusatzlich greifen sie direkt auf die Report-Hierarchie fuer Einstiegslinks und Strukturvisualisierung zu.

Beobachtete statische Public-Seiten:

- Home
- Kontakt/Konzept
- Impressum
- Datenschutz

## SEO- und Metadatenflaechen

### Detailseiten

Die Metadaten fuer `immobilienmarkt/[...slug]` kombinieren:

- Sichtbarkeitspruefung
- Report-Meta
- aktive Partnerkontexte
- freigegebene Marketing-Texte aus `partner_marketing_texts`
- Default-Marketingtexte aus `lib/marketing-defaults.ts`

### Sitemap

Die Sitemap wird in `app/sitemap.ts` generiert. Aktuell implementiert sie:

- statische Pfade `/`, `/immobilienmarkt`, `/impressum`, `/datenschutz`
- sichtbare Bundeslaender, Kreise und Ortslagen der deutschen Public-Flaeche

Die Sitemap ist damit derzeit eine Teilprojektion des Portals und nicht automatisch deckungsgleich
mit allen statischen und lokalisierten Public-Routen.

## Lead-Generatoren

Public und Preview binden im Immobilienmarkt-Bereich derzeit den Bewertungsflow ein.
Die Flow-Aufloesung erfolgt ueber:

- `features/lead-generators/core/resolver.ts`
- `features/lead-generators/valuation/*`

Der Flow bekommt je nach Audience:

- `public`
  mit `canSubmit` nur bei aktivem Public-Partnerkontext
- `preview`
  mit `previewMode` und ohne produktive Submission

## Gesuche: Immobilienwert pruefen

Im Gesuche-Detail wird die Verfeinerung `Immobilienwert pruefen` aktuell als eigener Public-/
Preview-Prototyp im Gesuchebereich betrieben. Die technische Kette ist derzeit:

- Zielregion des Gesuchs wird serverseitig auf eine passende Ortslage oder einen Kreis-Fallback
  aufgeloest
- Lagecluster werden ueber eine kompakte Runtime-Datei pro Gebiet geladen
- die vom Nutzer eingegebene Adresse wird serverseitig geokodiert
- die geokodierte Koordinate wird gegen die Lagecluster-Polygone geprueft
- die gefundene Lagequalitaet beeinflusst anschliessend `min/avg/max` der ausgegebenen
  Preisspanne

### Aktueller Testmodus

Die aktuelle Testimplementierung nutzt fuer die Adressaufloesung serverseitig Nominatim/OSM.
Das ist fuer Prototyping und fachliche Validierung ausreichend, ist aber nicht als finale
Produktivloesung zu verstehen.

### Produktionshinweis

Vor einem produktiven Rollout dieser Mikrolagen-/Adresslogik muss fuer den Live-Betrieb ein
leistungsfaehigeres Setup eingeplant werden. Dazu gehoert je nach Zielbild:

- Umstieg auf belastbarere Geocoding-/Autocomplete-Tools
- oder ein eigener, kontrollierter Infrastrukturpfad mit Caching/Rate-Limit-Steuerung

Gruende dafuer sind insbesondere:

- oeffentliche Rate-Limits freier Dienste
- schwankende Antwortqualitaet bei Autosuggest und Adressaufloesung
- Performance- und Stabilitaetsanforderungen im Live-Betrieb
- bessere Kontrolle ueber Monitoring, Fehlerverhalten und Lastspitzen

## Beobachtete Implementierungsnotizen

- Die Public-Immobilienmarkt-Uebersicht nutzt die Visibility-Schicht bereits explizit.
- Andere oeffentliche Einstiegsseiten lesen Teile der Report-Geografie direkt aus `lib/data`.
- Die Kreis-zu-Ortslagen-Fallbackregel aus `lib/area-visibility.ts` muss bei Navigation und Sitemap
  konsistent mitgedacht werden, weil ein live freigegebener Kreis auch ohne explizite Ortslagenliste
  alle Ortslagen ausliefern kann.
