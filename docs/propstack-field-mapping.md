# Propstack field mapping

## Objektimport

Quelle:
- `GET /v1/units`
- Parameter `with_meta=1`
- Parameter `expand=1`
- Parameter `new=1`

`expand=1` liefert laut Propstack-Dokumentation das ausfuehrliche JSON inklusive Custom Fields. `new=1` wird von Propstack empfohlen, wenn Felder am Objekt-Endpunkt fehlen.

## Marketingflags

Propstack hat fuer frei definierte Vermarktungskennzeichen keine feste, onOffice-aehnliche Standardliste. Deshalb werden Marketingflags aus drei Quellen abgeleitet:

- direkte Felder im Objektpayload, sofern vorhanden
- `custom_fields`
- `property_groups` bzw. `groups` als Objekt-Merkmale

Unterstuetzte normalisierte Flags:

- `new`
- `top`
- `featured`
- `exclusive`
- `price_reduction`
- `free_commission`
- `property_of_the_day`
- `property_of_the_week`

Die Erkennung ist namenbasiert und akzeptiert deutsche und englische Varianten wie `neu`, `top_angebot`, `preisreduktion`, `courtage_frei`, `objekt_des_tages` oder `objekt_der_woche`.
