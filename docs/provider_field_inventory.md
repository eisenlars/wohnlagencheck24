# Provider Field Inventory

## Zweck

Diese Datei beschreibt das kanonische Zielmodell fuer CRM-gebundene Angebotsdaten
und ordnet die heute bekannten Provider-Felder dagegen ein.

Ziel:
- kein feldweises Ratespiel in den Adaptern
- provider-neutrale Erweiterung von `partner_property_offers.raw`
- klare Trennung zwischen:
  - im Code verifiziert
  - ueber offizielle Provider-Doku ableitbar
  - noch unbestaetigt / spaeter mit Live-Payload zu pruefen

## Status-Level

- `code_verified`
  - Feld ist im aktuellen Adapter bereits vorhanden oder sicher im Code referenziert
- `docs_verified`
  - Feld ist ueber offizielle Anbieter-Doku oder Feldkonfiguration belastbar ableitbar
- `pending_live_check`
  - Feld ist fachlich gewuenscht, aber fuer den konkreten Mandanten noch nicht validiert

## Angebots-Zielmodell

### Kern

| Kanonisches Feld | Zweck |
|---|---|
| `external_id` | provider-stabile Objektidentitaet |
| `offer_type` | `kauf` / `miete` |
| `object_type` | `wohnung` / `haus` / spaeter weitere Kategorien |
| `title` | Objekttitel |
| `price` | Kaufpreis |
| `rent` | Miete |
| `area_sqm` | kanonische Wohnflaeche fuer Listen |
| `rooms` | Zimmer |
| `address` | lesbare Adressdarstellung |
| `image_url` | Hauptbild |
| `detail_url` | Partner-Exposé-URL |

### `raw.details`

| Kanonisches Feld | Zweck |
|---|---|
| `living_area_sqm` | Wohnflaeche |
| `usable_area_sqm` | Nutzflaeche |
| `plot_area_sqm` | Grundstuecksflaeche |
| `rooms` | Zimmer |
| `bedrooms` | Schlafzimmer |
| `bathrooms` | Badezimmer |
| `floor` | Etage |
| `construction_year` | Baujahr |
| `condition` | Zustand / Sanierungsstand |
| `availability` | verfuegbar / frei ab |
| `parking` | Stellplatz/Garage |
| `balcony` | Balkon vorhanden |
| `terrace` | Terrasse vorhanden |
| `garden` | Garten vorhanden |
| `elevator` | Aufzug vorhanden |
| `address_hidden` | Adresse im Portal verbergen |

### `raw.energy`

| Kanonisches Feld | Zweck |
|---|---|
| `certificate_type` | Art des Ausweises |
| `value` | Kennwert |
| `value_kind` | `bedarf` / `verbrauch` |
| `construction_year` | Baujahr |
| `heating_energy_source` | wesentlicher Energietraeger |
| `efficiency_class` | Energieeffizienzklasse |
| `demand` | kompatibles Legacy-Feld |
| `year` | kompatibles Legacy-Feld |

### `raw.media`

| Kanonisches Feld | Zweck |
|---|---|
| `gallery` | Legacy-URL-Liste |
| `gallery_urls` | explizite URL-Liste |
| `gallery_assets` | strukturierte Medienliste |
| `documents` | spaeter echte Unterlagen / PDFs / Exposés |

## Anbieter-Mapping: Propstack

### Bereits verifiziert

| Kanonisches Feld | Provider-Feld | Status | Bemerkung |
|---|---|---|---|
| `title` | `title` | `code_verified` | wird auch als `{ label, value }` gelesen |
| `price` | `purchase_price` | `code_verified` | |
| `rent` | `rent_net` | `code_verified` | |
| `area_sqm` | `living_space` | `code_verified` | |
| `rooms` | `number_of_rooms` | `code_verified` | |
| `address` | `street`, `house_number`, `zip_code`, `city` | `code_verified` | |
| `raw.description` | `description_note` | `code_verified` | |
| `raw.location` | `location_note` | `code_verified` | |
| `raw.features_note` | `furnishing_note` | `code_verified` | |
| `raw.details.living_area_sqm` | `living_space` | `code_verified` | |
| `raw.details.rooms` | `number_of_rooms` | `code_verified` | |
| `raw.details.construction_year` | `construction_year` | `code_verified` | |
| `raw.details.address_hidden` | `hide_address` | `code_verified` | |
| `raw.energy.certificate_type` | `energy_certificate_type` | `code_verified` | |
| `raw.energy.value` | `energy_consumption_value` | `code_verified` | aktuell generischer Kennwert |
| `raw.energy.construction_year` | `construction_year` | `code_verified` | |
| `raw.gallery_assets` | `images[]` | `code_verified` | inkl. `kind`-Klassifizierung |

### Noch offen

| Kanonisches Feld | Erwartetes Provider-Feld | Status | Naechster Schritt |
|---|---|---|---|
| `raw.details.usable_area_sqm` | unbekannt | `pending_live_check` | echten Unit-Payload pruefen |
| `raw.details.plot_area_sqm` | unbekannt | `pending_live_check` | echten Unit-Payload pruefen |
| `raw.details.floor` | unbekannt | `pending_live_check` | echten Unit-Payload pruefen |
| `raw.details.condition` | unbekannt | `pending_live_check` | echten Unit-Payload pruefen |
| `raw.details.availability` | unbekannt | `pending_live_check` | echten Unit-Payload pruefen |
| `raw.energy.heating_energy_source` | unbekannt | `pending_live_check` | echten Unit-Payload pruefen |
| `raw.energy.efficiency_class` | unbekannt | `pending_live_check` | echten Unit-Payload pruefen |
| `raw.documents` | unbekannt | `pending_live_check` | echten Unit-/Attachment-Payload pruefen |

## Anbieter-Mapping: onOffice

### Bereits verifiziert

| Kanonisches Feld | Provider-Feld | Status | Bemerkung |
|---|---|---|---|
| `title` | `elements.objekttitel` | `code_verified` | |
| `price` | `elements.kaufpreis` | `code_verified` | |
| `rent` | `elements.warmmiete`, `elements.kaltmiete` | `code_verified` | |
| `area_sqm` | `elements.wohnflaeche` | `code_verified` | |
| `rooms` | `elements.anzahl_zimmer` | `code_verified` | |
| `address` | `elements.strasse`, `elements.hausnummer`, `elements.plz`, `elements.ort` | `code_verified` | |
| `raw.location` | `elements.freitext_lage` | `code_verified` | |
| `raw.features_note` | `elements.freitext_ausstattung` | `code_verified` | |
| `raw.details.living_area_sqm` | `elements.wohnflaeche` | `code_verified` | |
| `raw.details.rooms` | `elements.anzahl_zimmer` | `code_verified` | |
| `raw.details.construction_year` | `elements.baujahr` | `code_verified` | |
| `raw.energy.certificate_type` | `elements.energiepass_art` | `code_verified` | |
| `raw.energy.value` | `elements.energieverbrauchkennwert` | `code_verified` | |
| `raw.energy.construction_year` | `elements.baujahr` | `code_verified` | |

### Ueber Doku ableitbar

Verbindlicher Weg fuer onOffice:
- Estate-Daten ueber `estate`
- reale Feldnamen und Typen ueber die Feldkonfiguration des Moduls `estate`
- Dateien/Dokumente ueber die Estate-Files-Endpoints

Offizielle Referenz:
- `estate` lesen/bearbeiten
- Feldkonfiguration fuer `estate`
- Objektdateien / Estate files

### Noch offen

| Kanonisches Feld | Erwartetes Provider-Feld | Status | Naechster Schritt |
|---|---|---|---|
| `raw.details.usable_area_sqm` | voraussichtlich `nutzflaeche` | `pending_live_check` | Feldkonfiguration `estate` pruefen |
| `raw.details.plot_area_sqm` | voraussichtlich `grundstuecksflaeche` | `pending_live_check` | Feldkonfiguration `estate` pruefen |
| `raw.details.floor` | voraussichtlich `etage` | `pending_live_check` | Feldkonfiguration `estate` pruefen |
| `raw.details.condition` | voraussichtlich `zustand` | `pending_live_check` | Feldkonfiguration `estate` pruefen |
| `raw.details.availability` | voraussichtlich `verfuegbar_ab` oder aehnlich | `pending_live_check` | Feldkonfiguration `estate` pruefen |
| `raw.energy.heating_energy_source` | provider-spezifisch offen | `pending_live_check` | Feldkonfiguration / Live-Payload pruefen |
| `raw.energy.efficiency_class` | provider-spezifisch offen | `pending_live_check` | Feldkonfiguration / Live-Payload pruefen |
| `raw.documents` | Estate files | `docs_verified` | spaeter separaten Files-Pfad anbinden |

## Entscheidungsregeln fuer neue Felder

Ein Feld wird erst in den Produktivmapper aufgenommen, wenn mindestens eine dieser Bedingungen erfuellt ist:

1. `code_verified`
2. `docs_verified` und fachlich eindeutig
3. `pending_live_check` wurde ueber echten Payload oder Testfixture bestaetigt

Wenn ein Feld nur fuer einen Provider sicher ist:
- trotzdem ins kanonische Modell aufnehmen
- andere Provider liefern `null`

Wenn ein Feld unklar ist:
- nicht raten
- zuerst Inventar oder Payload erweitern

## Naechste Pruefschritte

1. Propstack:
- echten Unit-Payload fuer die offene Detailgruppe pruefen
- speziell:
  - `usable_area_sqm`
  - `plot_area_sqm`
  - `floor`
  - `condition`
  - `availability`
  - `heating_energy_source`
  - `efficiency_class`

2. onOffice:
- sobald ein Key verfuegbar ist:
  - Feldkonfiguration fuer `estate` laden
  - gewuenschte Zusatzfelder gegen den Mandanten pruefen
  - Estate-Files fuer Dokumente/Unterlagen testen

3. Danach:
- kanonisches Mapping erweitern
- Dashboard/Public gezielt um die neuen verifizierten Felder ausbauen
