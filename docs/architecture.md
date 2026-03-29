# Architekturueberblick

## Systemcharakter

Das Repository ist kein einzelnes Portalmodul, sondern ein Mehrdomaeinen-System fuer:

- oeffentliche Immobilienmarkt- und Standortprofile
- lokalisierte Public-Routen
- Preview- und Live-Schaltung pro Gebiet
- Partner-Dashboard und Admin-Backoffice
- datengetriebene Report-/Text-Pipeline
- CRM-, LLM- und Local-Site-Integrationen

Die fachliche Primarstruktur ist geografisch: `bundesland -> kreis -> ortslage`.
Die technische Primarstruktur ist schichtenbasiert: Routing, Sichtbarkeit, Report-Laden,
Text-Overlays, View-Model-Building, Rendering, Publishing und Integrationen.

## Hauptmodule

### App-Router

- `app/(public)`
  deutsche Public-Flaeche
- `app/[locale]`
  lokalisierte Public-Flaeche mit eigenem Locale-Gate
- `app/preview`
  Preview-Routen fuer freigegebene Partner-/Admin-Zugriffe
- `app/admin`
  Admin-Flaeche
- `app/partner`, `app/dashboard`
  Partner-Zugaenge und Partner-UI
- `app/api`
  Admin-, Partner-, Public-, Rebuild-, Integrations- und Export-Endpunkte

### Fachlogik

- `features/immobilienmarkt`
  Route-Resolver, Registry, Theme, Section-Komponenten und zentraler Page-Builder
- `features/lead-generators`
  generische Lead-Generator-Aufloesung und Flow-Konfiguration
- `features/valuation`
  Bewertungs- und Preis-Leadflow

### Kernbibliotheken

- `lib/data.ts`
  Report- und Override-Laden aus Public Storage und Supabase
- `lib/area-visibility.ts`, `lib/visibility-index.ts`
  Live-Sichtbarkeit und Projektionsindex fuer Public-Routen
- `lib/public-partner-mappings.ts`
  Partner-/Gebietszuordnung fuer Public und Preview
- `lib/text-core/*`
  datengetriebene Textlogik, Signaturen und Textgenerierung
- `lib/portal-cms*.ts`, `lib/portal-*.ts`
  Portal-CMS, Locale-Registry, Systemtexte und CMS-Sync
- `lib/integrations/*`, `lib/providers/*`
  CRM- und Integrationsnormalisierung
- `lib/security/*`, `lib/auth/*`
  Rollen, Rate Limits, Audit Log, Secret-Handling und Token-Flows

## Zentrale Laufzeitfluesse

### 1. Public-Rendering

1. Route-Slugs werden in `features/immobilienmarkt/routes/resolveRoute.ts` in `level`, `regionSlugs` und `section` zerlegt.
2. `buildPageModel()` laedt den Report, prueft bei Public-Traffic die Sichtbarkeit und legt Text-/Asset-/Kontaktkontext an.
3. View-Models werden ueber die Registry in konkrete Section-Komponenten transformiert.
4. Zusatzmodule wie Lead-Generatoren oder Kontakt-Context werden im Seiten-Entry angedockt.

### 2. Preview und Live

1. Preview-Zugriff wird aus `partner_area_map` abgeleitet.
2. Partner geben Gebiete fuer Review frei und koennen danach einen Live-Request absetzen.
3. Admin prueft, publiziert das Gebiet, schreibt Audit Logs, baut den Visibility-Index neu und aktualisiert Public-Projektionen.

### 3. Rebuild und Textgen

1. Rebuild-Endpunkte normalisieren Faktoren und skalieren Report-Daten.
2. `text-core` erzeugt Signaturen und datengetriebene Texte.
3. Runtime-State und generierte Texte werden pro Partner/Gebiet gespeichert.
4. Revalidierung laesst Public-Pfade und Report-Tags neu ausliefern.

### 4. Locale- und CMS-Schicht

1. Public-Locale-Routen werden nur fuer live geschaltete Locales ausgeliefert.
2. CMS-Inhalte werden pro `page_key`, `section_key` und `locale` aus `portal_content_entries` gelesen.
3. Admin-CMS-Sync und AI-gestuetzte Uebersetzung bauen auf globaler LLM-Governance auf.

### 5. Integrationen

1. Partner-Integrationen werden ueber `partner_integrations` und normalisierte Settings gesteuert.
2. Local-Site-Pakete werden tokenbasiert exportiert und enthalten Kreis-/Ortslagen-JSON mit Text-Merging.
3. Partner-i18n unterstuetzt `portal`, `local_site` und `marketing` als getrennte Kanaele.

## Beobachtete Laufzeitdaten

Die Codebasis referenziert unter anderem folgende Tabellen und Speicherbereiche:

- `areas`
- `partner_area_map`
- `partners`
- `report_texts`
- `partner_area_runtime_states`
- `partner_area_generated_texts`
- `portal_content_entries`
- `portal_locale_config`
- `partner_integrations`
- `partner_texts_i18n`
- `security_audit_log`
- `security_rate_limits`
- Public Storage Bucket `immobilienmarkt`

Diese Liste ist als beobachteter Laufzeitausschnitt zu verstehen, nicht als vollstaendiges DB-Schema.

## Aktuelle Architekturentscheidungen

- Live-Sichtbarkeit wird nicht direkt aus Reports, sondern aus `partner_area_map` und dem daraus gebildeten Visibility-Index abgeleitet.
- Das Public-Portal arbeitet mit einer klaren Trennung zwischen Rohreport, Runtime-State, generierten Texten, Admin-Overrides und partnerbezogenen Overrides.
- Lokalisierung ist bereits strukturell vorbereitet und laeuft nicht als reine Textdatei-Loesung, sondern ueber CMS-, Locale- und i18n-Tabellen.
- Systempartner-Fallbacks sind produktiver Teil des Renderpfads und kein separater Sondermodus ausserhalb des Portals.

## Weiterfuehrende Doku

- `public-portal.md`
- `admin-partner-workflows.md`
- `data-text-pipeline.md`
- `integrations-local-site.md`
- `security-auth.md`
