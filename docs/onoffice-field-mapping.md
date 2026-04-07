# onOffice Feldmapping

Technische Referenz fuer die aktuelle onOffice-Integration.

Ziel:
- nachvollziehbar machen, welche `estate`-Felder wir lesen
- nachvollziehbar machen, wie `searchcriterias` fuer Gesuche gelesen werden
- zeigen, wie `source_payload`, `normalized_payload` und `offer.raw` zusammenhaengen
- spaetere Erweiterungen gegen einen dokumentierten Stand abgleichen

## Discovery

Die onOffice-Feldnamen werden nicht geraten, sondern ueber den `fields`-Call des Moduls `estate` ermittelt.

Beispiel:

```json
{
  "actionid": "urn:onoffice-de-ns:smart:2.5:smartml:action:get",
  "resourceid": "",
  "identifier": "",
  "resourcetype": "fields",
  "parameters": {
    "modules": ["estate"],
    "labels": true,
    "language": "DEU"
  }
}
```

Massgeblich fuer die API ist immer der Feldschluessel, nicht das UI-Label.

Fuer Gesuche gilt derselbe Grundsatz:
- Feld-Discovery ueber `searchCriteriaFields`
- echter Datensatzabruf ueber `searchcriterias`
- Mapping immer gegen Discovery plus echten Payload pruefen

## Payload-Ebenen

### `source_payload`

Der rohe onOffice-Datensatz, wie er aus dem `estate`-Read kommt.

Typisch:

```json
{
  "id": 1234,
  "type": "estate",
  "elements": {
    "Id": "1234",
    "objekttitel": "Beispielobjekt",
    "status2": "aktive_vermarktung"
  }
}
```

### `normalized_payload`

Der interne, vereinheitlichte Rohzustand in `partner_listings`.

Bei onOffice ist `normalized_payload` aktuell in weiten Teilen identisch zu `offer.raw`.
Es ist also bereits eine portalnahe Struktur und kein blosses 1:1-Abbild von `source_payload`.

### `offer.raw`

Die strukturierte Rohsicht fuer Angebotsverarbeitung, Workspace und Projektionen.

Aktuelle Top-Level-Schluessel:

```json
{
  "exposee_id": "...",
  "description": "...",
  "long_description": "...",
  "location": "...",
  "features_note": "...",
  "misc_note": "...",
  "details": {},
  "details_extra": {},
  "energy": {},
  "energy_meta": {},
  "pricing": {},
  "equipment": {},
  "marketing": {},
  "gallery": [],
  "lat": null,
  "lng": null,
  "geaendert_am": "...",
  "status": "...",
  "status2": "...",
  "verkauft": "...",
  "reserviert": "...",
  "veroeffentlichen": "...",
  "objektstatus": "...",
  "vermietet": "..."
}
```

## Bloecke

### Identitaet

Gelesene Felder:
- `Id`
- `objektnr_extern`
- `objekttitel`
- `geaendert_am`

### Status / Vermarktung

Gelesene Felder:
- `status`
- `status2`
- `verkauft`
- `vermietet`
- `reserviert`
- `veroeffentlichen`
- `vermarktungsart`

Zusaetzliche Vermarktungsflags:
- `objekt_der_woche`
- `courtage_frei`
- `objekt_des_tages`

Normalisiert in `raw`:

```json
{
  "status": "1",
  "status2": "aktive_vermarktung",
  "verkauft": "0",
  "reserviert": "0",
  "veroeffentlichen": "1",
  "vermietet": "0",
  "marketing": {
    "publish": true,
    "property_of_the_week": false,
    "free_commission": false,
    "property_of_the_day": false
  }
}
```

### Texte

Mandantenbestaetigte Textfelder:
- `objektbeschreibung`
- `ausstatt_beschr`
- `lage`
- `sonstige_angaben`

Normalisiert in `raw`:

```json
{
  "description": "Beschreibung",
  "long_description": "Beschreibung",
  "location": "Lage",
  "features_note": "Ausstattung",
  "misc_note": "Sonstige Angaben"
}
```

### Preise

Gelesene Felder:
- `waehrung`
- `kaufpreis`
- `kaltmiete`
- `warmmiete`
- `nebenkosten`
- `heizkosten`
- `heizkosten_in_nebenkosten`
- `kaution`
- `zzgl_mehrwertsteuer`
- `aussen_courtage`
- `innen_courtage`

Normalisiert in `raw.pricing`:

```json
{
  "currency": "EUR",
  "purchase_price": 350000,
  "cold_rent": null,
  "warm_rent": null,
  "additional_costs": null,
  "heating_costs": null,
  "heating_costs_in_additional_costs": "N",
  "deposit": null,
  "vat_on_commission": "0",
  "external_commission": "3,57 %",
  "internal_commission": null
}
```

### Flaechen / Raeume

Gelesene Felder:
- `wohnflaeche`
- `nutzflaeche`
- `anzahl_zimmer`
- `anzahl_schlafzimmer`
- `anzahl_badezimmer`
- `anzahl_sep_wc`
- `anzahl_balkone`
- `anzahl_terrassen`

Normalisiert:
- `raw.details`
- `raw.details_extra`

### Ausstattung

Gelesene Felder:
- `internetAccessType`
- `befeuerung`
- `heizungsart`
- `etagen_zahl`
- `fahrstuhl`
- `kabel_sat_tv`
- `multiParkingLot`
- `balkon`
- `terrasse`

Normalisiert in `raw.equipment`.

### Zustand / Energie

Gelesene Felder:
- `baujahr`
- `zustand`
- `energieausweistyp`
- `endenergiebedarf`
- `energieverbrauchskennwert`
- `energieausweis_gueltig_bis`
- `energieausweisBaujahr`
- `energietraeger`
- `energyClass`
- `warmwasserEnthalten`
- `energiepassJahrgang`
- `energiepassAusstelldatum`

Normalisiert:
- `raw.energy`
- `raw.energy_meta`

Beispiel:

```json
{
  "energy": {
    "certificate_type": "Bedarfsausweis",
    "value": 93.4,
    "value_kind": "bedarf",
    "construction_year": 1998,
    "heating_energy_source": "gas",
    "efficiency_class": "C",
    "certificate_availability": "vorhanden",
    "certificate_start_date": "2024-02-01",
    "certificate_end_date": "2034-01-31",
    "warm_water_included": true,
    "demand": 93.4,
    "year": 1998
  },
  "energy_meta": {
    "certificate_year": "2014",
    "issue_date": "2024-02-01",
    "valid_until": "2034-01-31"
  }
}
```

### Gesuche

Gesuche werden nicht ueber `estate`, sondern ueber den dokumentierten Gesuchspfad gelesen:
- Discovery: `searchCriteriaFields`
- Payload: `searchcriterias` mit `mode=filter` und `status = 1`

Warum:
- `searchCriteriaFields` liefert die im Mandanten aktivierten Gesuchsfelder
- `searchcriterias` zeigt die reale Datenform inklusive `_meta`, Range-Werten und befuellten Feldern

Typischer `source_payload` fuer ein Gesuch:

```json
{
  "id": 4711,
  "bezeichnung": "Kaufgesuch Innenstadt",
  "vermarktungsart": "kauf",
  "objektart": "wohnung",
  "range_kaufpreis": [250000, 450000],
  "range_wohnflaeche": [70, 120],
  "regionaler_zusatz": "Muenchen Maxvorstadt",
  "_meta": {
    "status": "1",
    "editdate": "2026-04-07 08:15:00",
    "publicnote": "Suche zentrale Lage"
  }
}
```

Aktuell normalisiert in `partner_requests.normalized_payload`:

```json
{
  "title": "Kaufgesuch Innenstadt",
  "request_type": "kauf",
  "object_type": "wohnung",
  "object_subtype": null,
  "marketing_type": "kauf",
  "min_rooms": null,
  "max_rooms": null,
  "min_purchase_price": 250000,
  "max_purchase_price": 450000,
  "min_rent": null,
  "max_rent": null,
  "max_price": 450000,
  "min_area_sqm": 70,
  "max_area_sqm": 120,
  "region": "Muenchen Maxvorstadt",
  "region_targets": [
    {
      "city": "Muenchen",
      "district": "Maxvorstadt",
      "label": "Muenchen Maxvorstadt"
    }
  ],
  "range_center": {
    "land": null,
    "plz": null,
    "ort": null,
    "strasse": null,
    "hausnummer": null
  },
  "parentaddress": null,
  "characteristic": null,
  "publicnote": "Suche zentrale Lage",
  "status": "1",
  "active": "1"
}
```

Wichtig:
- Range-Felder koennen je nach onOffice-Antwort als `range_<feld>` oder in `range`/`Range` auftauchen
- fuer Erweiterungen deshalb immer zuerst den kompletten Debug-Payload des letzten Gesuchslaufs gegenpruefen
- Discovery allein reicht bei Gesuchen nicht, weil `_meta` und reale Range-Werte erst im echten Payload sichtbar werden

## Aktuelle technische Abbildung

- `source_payload` bleibt der originale API-Record
- `normalized_payload` bei `partner_listings` wird aus `offer.raw` aufgebaut
- `offer.raw` ist die wichtigste interne Debug- und Projektionssicht

## Offene Punkte fuer spaeter

- Bilder/Dateien sauber ueber die dafuer vorgesehenen onOffice-Calls ziehen
- weitere Objektuntertypen und Sonderflaechen nur bei Bedarf nachziehen
- Feldsets anderer Mandanten immer wieder gegen den `fields`-Discovery-Call pruefen
