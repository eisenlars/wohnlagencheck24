# Partner Offboarding & Gebietsuebergabe (Runbook)

## Zweck

Dieses Runbook beschreibt den aktuellen Admin-Prozess, wenn ein Kreisgebiet von einem bestehenden Partner auf einen neuen Partner uebergeben wird.

Ziele:

- keine aktive Doppelvergabe von Gebieten
- reproduzierbarer Admin-Workflow
- gezielte Uebernahme von Inhalts- und Sprachbloecken
- keine unbeabsichtigte Migration von kanalgebundenen Daten
- lueckenlose Nachvollziehbarkeit im Audit-Log

## Aktueller Systemstand

Die Gebietsuebergabe laeuft produktiv ueber:

- Admin-UI: `Partnerverwaltung > Uebergabe`
- API: `POST /api/admin/handovers`

Wichtige technische Leitlinien des aktuellen Codes:

- Kreis plus zugehoerige Ortslagen werden gemeinsam uebertragen.
- Alte Integrationen des Altpartners werden deaktiviert.
- Der Altpartner bleibt als Konto bestehen.
- Die neue Gebietszurodnung wird beim Zielpartner immer als `assigned` und `is_active = false` angelegt.
- Die inhaltliche Uebernahme ist jetzt **granular steuerbar**.
- `partner_local_site_texts` und `partner_texts_i18n` fuer `channel = local_site` bleiben bewusst unberuehrt.

## Fachliche Leitlinie

- Gebietszuordnung ist operativ exklusiv: ein Gebiet darf nur einen aktiven Besitzer haben.
- Berichtindividualisierung, SEO/GEO, Blog und Sprachen sind getrennte Inhaltsbloecke.
- Secrets und Integrationen werden nie zwischen Partnern uebertragen.
- Die lokale Website ist ein eigener Ausspielkanal und wird bei der Gebietsuebergabe bewusst nicht migriert.
- Sprachinhalte und Sprachfreigabe sind getrennte Dinge:
  - Inhalte koennen kopiert werden
  - oeffentliche Verfuegbarkeit entsteht erst durch die Partner-Sprachfreigabe

## Betroffene Tabellen/Objekte

### Pflicht bei jeder Gebietsuebergabe

1. `public.partners`
2. `public.partner_area_map`
3. `public.partner_integrations`
4. `public.security_audit_log`

### Berichtindividualisierung

1. `public.data_value_settings`
2. `public.report_texts`
3. `public.partner_area_runtime_states`
4. `public.partner_area_generated_texts`
5. `public.partner_texts_i18n` mit `channel = 'portal'`

### SEO & GEO

1. `public.partner_marketing_texts`
2. `public.partner_texts_i18n` mit `channel = 'marketing'`

### Blogarchiv

1. `public.partner_blog_posts`
2. `public.partner_blog_post_i18n`

### Sprachen / Freischaltung

1. `public.partner_feature_overrides`
2. `public.billing_feature_catalog`
3. `public.portal_locale_config`

### Bewusst nicht Teil der Gebietsuebergabe

1. `public.partner_local_site_texts`
2. `public.partner_texts_i18n` mit `channel = 'local_site'`
3. `public.partner_property_offers`
4. `public.partner_property_overrides`
5. `public.partner_requests`
6. `public.partner_references`
7. `public.partner_integrations` Secrets / Tokens / Teststatus

## Standardprozess im Admin

1. Altpartner im Admin oeffnen
2. Tab `Uebergabe` waehlen
3. Kreisgebiet waehlen
4. Zielpartner waehlen
5. Inhaltsbloecke festlegen:
   - Berichtindividualisierung
   - SEO & GEO
   - Blogarchiv
   - Sprachen
6. Sprachmatrix pro bisher verfuegbarer Sprache festlegen
7. Uebergabe bestaetigen
8. Der Zielpartner bekommt:
   - neue Zuordnung `assigned`
   - gewaehlte Inhaltsbloecke
   - gewaehlte Sprachfreigaben
9. Danach normale Aktivierung/Freigabepruefung fuer das Gebiet beim Zielpartner

## Uebergabeoptionen

### 1. Berichtindividualisierung mitnehmen

Wenn aktiv, werden uebernommen:

- `data_value_settings`
- `report_texts`
- `partner_area_runtime_states`
- `partner_area_generated_texts`
- `partner_texts_i18n` mit `channel = 'portal'`

Fachlich bedeutet das:

- faktorisierte Daten
- partnerbezogene Runtime-Snapshots
- data-driven Texte
- manuelle Berichtstexte
- Portal-Uebersetzungen der Berichtstexte

Wenn deaktiviert:

- der Zielpartner startet fuer diesen Block auf Basiszustand

### 2. SEO & GEO Texte mitnehmen

Wenn aktiv, werden uebernommen:

- `partner_marketing_texts`
- `partner_texts_i18n` mit `channel = 'marketing'`

Das betrifft vor allem:

- Title
- Description
- Keywords / Entities
- sonstige marketingbezogene Geo-/SEO-Texte

Wenn deaktiviert:

- der Zielpartner startet fuer diesen Block ohne SEO/GEO-Overrides

### 3. Lokale Website bleibt unberuehrt

Bewusst **nicht** uebernommen werden:

- `partner_local_site_texts`
- `partner_texts_i18n` mit `channel = 'local_site'`
- Local-Site-Integrationen / Tokens

Begruendung:

- die lokale Website ist ein eigener Produktkanal
- nach dem Umzug zieht sie sich ihre Inhalte wieder aus:
  - `partner_local_site_texts` (falls spaeter neu gepflegt)
  - `report_texts`
  - Standard-/Basistexten

### 4. Blogarchiv

Es gibt drei Modi:

1. `Beim alten Partner lassen`
2. `Zum neuen Partner als Entwurf kopieren`
3. `Zum neuen Partner wie bisher uebernehmen`

Bei Blog-Uebernahme werden genutzt:

- `partner_blog_posts`
- `partner_blog_post_i18n`

Empfohlener Standard:

- `als Entwurf kopieren`

Begruendung:

- Inhalte wechseln damit nicht ungeprueft live den Verantwortlichen
- der neue Partner kann die Texte pruefen, anpassen und gezielt aktivieren

### 5. Sprachen

Die Sprachmatrix wird pro bisher verfuegbarer Gebietssprache festgelegt.

Moegliche Modi:

1. `nicht uebernehmen`
2. `uebernehmen, deaktiviert`
3. `uebernehmen und aktivieren`

Bedeutung:

- `nicht uebernehmen`
  - keine Uebersetzungen kopieren
  - keine Sprachfreigabe beim Zielpartner aktivieren

- `uebernehmen, deaktiviert`
  - Uebersetzungsinhalte kopieren
  - Sprachfeature beim Zielpartner deaktiviert lassen
  - Sprache bleibt damit intern erhalten, aber nicht oeffentlich verfuegbar

- `uebernehmen und aktivieren`
  - Uebersetzungsinhalte kopieren
  - Sprachfeature beim Zielpartner aktivieren

Wichtig:

- die oeffentliche Verfuegbarkeit einer Sprache haengt nicht nur von kopierten Uebersetzungen ab
- sie haengt zusaetzlich an der Partner-Sprachfreigabe ueber `partner_feature_overrides`

## Audit-Log

Wichtige Events:

1. `handover_start`
2. `assign_new_mapping`
3. `handover_done`
4. Partner-Mail-Event:
   - `mail_admin_handover_partner_notify`

Im Audit-Payload werden aktuell mitprotokolliert:

- `transfer_mode`
- `include_report_customization`
- `include_seo_geo`
- `blog_transfer_mode`
- kopierte Mengen je Inhaltskanal

## Rollback-Leitlinie

Wenn eine Uebergabe fachlich rueckgaengig gemacht werden muss:

1. Zielpartner-Zuordnung deaktivieren oder loeschen
2. Altpartner-Zuordnung wiederherstellen
3. je nach Uebergabefall gezielt ruecksetzen:
   - Berichtindividualisierung
   - SEO/GEO
   - Blog
   - Sprachfreigaben
4. Integrationen beim Altpartner bei Bedarf reaktivieren
5. Incident im Audit-Log dokumentieren

Hinweis:

- ein vollautomatischer Transaktions-Rollback ueber alle Tabellen ist nicht der Standardprozess
- Korrekturen erfolgen kontrolliert ueber Admin und Datenpflege

## Manuelles SQL-Fallback

Direkte SQL-Eingriffe sind nur noch Incident-/Recovery-Fallback.

Der fachliche Standardprozess ist der Admin-Wizard.

Wenn SQL notwendig wird, muessen mindestens geprueft werden:

- `partner_area_map`
- `partner_integrations`
- die je Uebergabeblock betroffenen Tabellen aus diesem Runbook

Die alte Minimal-SQL-Variante reicht fuer den aktuellen Produktstand fachlich nicht mehr aus, weil sie:

- keine Inhaltsbloecke
- keine Sprachmatrix
- kein Blogarchiv
- keine kanalgetrennten Uebersetzungen

abbildet.

## Implementierungs-Checkliste (Ist-Stand)

Vorhanden:

1. API-Endpunkt `POST /api/admin/handovers`
2. Admin-GUIs fuer:
   - Berichtindividualisierung
   - SEO & GEO
   - Blogarchiv
   - Sprachen
3. serverseitige Guards:
   - nur Kreis-ID erlaubt
   - keine operative Doppelvergabe
   - Admin-Rolle erforderlich
4. Audit-Events fuer Start/Abschluss
5. Partner-Benachrichtigung nach erfolgreicher Uebergabe

Offene fachliche Restthemen:

1. `public-area-locale-availability` zaehlt aktuell Uebersetzungen kanaluebergreifend; fuer den granularen Handover ist ein engerer Channel-Fokus sinnvoll.
2. Falls spaeter weitere Inhaltskanaele uebergeben werden sollen, muessen sie explizit als eigener Handover-Block modelliert werden.
