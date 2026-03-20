import { normalizePublicLocale } from "@/lib/public-locale-routing";

type ValuationCopy = {
  badge: string;
  title: string;
  intro: string;
  modeIntro: string;
  modeDataTitle: string;
  modeDataHint: string;
  modeAssistantTitle: string;
  modeAssistantHint: string;
  modeAdvisorTitle: string;
  modeAdvisorHint: string;
  multiAreaLabel: string;
  multiAreaPlaceholder: string;
  stepMode: string;
  stepLocation: string;
  stepObject: string;
  stepEstimate: string;
  stepContact: string;
  entryModeLabel: string;
  entryModeAddress: string;
  entryModeAddressHint: string;
  entryModeSoft: string;
  entryModeSoftHint: string;
  postalCityLabel: string;
  postalCityPlaceholder: string;
  addressLabel: string;
  addressPlaceholder: string;
  continue: string;
  back: string;
  propertyTypeLabel: string;
  propertyTypeHouse: string;
  propertyTypeApartment: string;
  livingAreaLabel: string;
  roomsLabel: string;
  yearBuiltLabel: string;
  conditionLabel: string;
  conditionRenovation: string;
  conditionAverage: string;
  conditionGood: string;
  conditionModernized: string;
  estimateTitle: string;
  estimateHint: string;
  estimateUnavailable: string;
  estimateRangeLabel: string;
  estimateSqmLabel: string;
  detailsLabel: string;
  detailsPlaceholder: string;
  contactTitle: string;
  contactHint: string;
  nameLabel: string;
  emailLabel: string;
  phoneLabel: string;
  consentLabel: string;
  submit: string;
  submitting: string;
  successTitle: string;
  successBody: string;
  previewSuccessBody: string;
  retryLater: string;
  genericError: string;
  stepCounter: string;
};

const COPY: Record<string, ValuationCopy> = {
  de: {
    badge: "Immobilienbewertung",
    title: "Immobilie bewerten",
    intro: "Waehlen Sie den passenden Bewertungsweg fuer Ihr Objekt.",
    modeIntro: "Wie moechten Sie Ihre Bewertung erhalten?",
    modeDataTitle: "Sofort eine erste Preisspanne sehen",
    modeDataHint: "Datenbasierte Online-Einschaetzung mit direkter Orientierungsrange.",
    modeAssistantTitle: "Mit digitalem Bewertungsassistenten starten",
    modeAssistantHint: "Gefuehrter Einstieg mit mehr Rueckfragen fuer eine bessere Einordnung.",
    modeAdvisorTitle: "Direkt eine persoenliche Einschaetzung anfragen",
    modeAdvisorHint: "Ihre Anfrage geht ohne Umweg an den regional zustaendigen Ansprechpartner.",
    multiAreaLabel: "Welches Partnergebiet betrifft Ihre Immobilie?",
    multiAreaPlaceholder: "Bitte Gebiet waehlen",
    stepMode: "Bewertungsweg",
    stepLocation: "Standort",
    stepObject: "Objekt",
    stepEstimate: "Preisspanne",
    stepContact: "Kontakt",
    entryModeLabel: "Wie moechten Sie starten?",
    entryModeAddress: "Direkt mit Adresse",
    entryModeAddressHint: "Fuer eine spaetere Praezisierung der Mikrolage.",
    entryModeSoft: "Ohne exakte Adresse",
    entryModeSoftHint: "Sie starten mit einer unverbindlichen Orientierungsrange.",
    postalCityLabel: "PLZ, Ort oder Ortsteil",
    postalCityPlaceholder: "z. B. 01067 Dresden oder Neustadt",
    addressLabel: "Strasse und Hausnummer",
    addressPlaceholder: "z. B. Hauptstrasse 12",
    continue: "Weiter",
    back: "Zurueck",
    propertyTypeLabel: "Was soll bewertet werden?",
    propertyTypeHouse: "Haus",
    propertyTypeApartment: "Wohnung",
    livingAreaLabel: "Wohnflaeche in m²",
    roomsLabel: "Zimmer",
    yearBuiltLabel: "Baujahr",
    conditionLabel: "Zustand",
    conditionRenovation: "Renovierungsbeduerftig",
    conditionAverage: "Durchschnittlich",
    conditionGood: "Gepflegt",
    conditionModernized: "Modernisiert",
    estimateTitle: "Ihre erste Preisrange",
    estimateHint: "Diese Range ist eine erste Orientierung auf Basis regionaler Preisniveaus und Ihrer Angaben. Eine konkrete Marktpreiseinschaetzung erfolgt nach Prüfung durch den regionalen Experten.",
    estimateUnavailable: "Fuer diese Kombination liegt aktuell noch keine belastbare Preisrange vor. Sie koennen trotzdem eine Anfrage senden.",
    estimateRangeLabel: "Orientierungsrange",
    estimateSqmLabel: "Orientierungswert pro m²",
    detailsLabel: "Besonderheiten der Immobilie",
    detailsPlaceholder: "z. B. Balkon, Sanierung, Denkmalschutz, Vermietung, Grundstuecksgroesse",
    contactTitle: "Einschaetzung freischalten",
    contactHint: "Nach dem Absenden geht Ihre Anfrage ausschliesslich an den fuer dieses Gebiet zustaendigen Partner.",
    nameLabel: "Name",
    emailLabel: "E-Mail",
    phoneLabel: "Telefon",
    consentLabel: "Ich bin mit der Bearbeitung meiner Anfrage einverstanden.",
    submit: "Bewertungsanfrage senden",
    submitting: "Anfrage wird gesendet...",
    successTitle: "Anfrage uebermittelt",
    successBody: "Ihre Bewertungsanfrage wurde an den zustaendigen Ansprechpartner weitergeleitet.",
    previewSuccessBody: "Im Preview wurde keine echte Anfrage versendet.",
    retryLater: "Bitte versuchen Sie es spaeter erneut.",
    genericError: "Die Anfrage konnte gerade nicht verarbeitet werden.",
    stepCounter: "Schritt {current} von {total}",
  },
  en: {
    badge: "Property valuation",
    title: "Value your property",
    intro: "Choose the valuation path that fits your property.",
    modeIntro: "How would you like to receive your valuation?",
    modeDataTitle: "See an initial price range immediately",
    modeDataHint: "Data-based online estimate with an instant indicative range.",
    modeAssistantTitle: "Start with a digital valuation assistant",
    modeAssistantHint: "A guided flow with more questions for better classification.",
    modeAdvisorTitle: "Request a direct personal assessment",
    modeAdvisorHint: "Your inquiry is sent straight to the locally responsible contact.",
    multiAreaLabel: "Which partner area is your property located in?",
    multiAreaPlaceholder: "Please select an area",
    stepMode: "Valuation path",
    stepLocation: "Location",
    stepObject: "Property",
    stepEstimate: "Range",
    stepContact: "Contact",
    entryModeLabel: "How would you like to start?",
    entryModeAddress: "Start with the address",
    entryModeAddressHint: "For a later micro-location refinement.",
    entryModeSoft: "Start without the exact address",
    entryModeSoftHint: "You begin with a non-binding indicative range.",
    postalCityLabel: "ZIP code, city or district",
    postalCityPlaceholder: "e.g. 01067 Dresden or Neustadt",
    addressLabel: "Street and house number",
    addressPlaceholder: "e.g. Main Street 12",
    continue: "Continue",
    back: "Back",
    propertyTypeLabel: "What should be valued?",
    propertyTypeHouse: "House",
    propertyTypeApartment: "Apartment",
    livingAreaLabel: "Living area in sqm",
    roomsLabel: "Rooms",
    yearBuiltLabel: "Year built",
    conditionLabel: "Condition",
    conditionRenovation: "Needs renovation",
    conditionAverage: "Average",
    conditionGood: "Well kept",
    conditionModernized: "Modernized",
    estimateTitle: "Your first price range",
    estimateHint: "This range is an initial orientation based on regional price levels and your inputs. A more precise assessment is provided after review by the local expert.",
    estimateUnavailable: "There is currently no reliable indicative range for this combination. You can still submit your inquiry.",
    estimateRangeLabel: "Indicative range",
    estimateSqmLabel: "Indicative price per sqm",
    detailsLabel: "Special features of the property",
    detailsPlaceholder: "e.g. balcony, refurbishment, listed building, tenancy, plot size",
    contactTitle: "Unlock your assessment",
    contactHint: "After submitting, your inquiry is sent exclusively to the partner responsible for this area.",
    nameLabel: "Name",
    emailLabel: "Email",
    phoneLabel: "Phone",
    consentLabel: "I agree to the processing of my inquiry.",
    submit: "Send valuation inquiry",
    submitting: "Sending inquiry...",
    successTitle: "Inquiry submitted",
    successBody: "Your valuation inquiry has been forwarded to the responsible contact.",
    previewSuccessBody: "No real inquiry was sent in preview mode.",
    retryLater: "Please try again later.",
    genericError: "The inquiry could not be processed right now.",
    stepCounter: "Step {current} of {total}",
  },
};

export function getValuationCopy(locale: string | null | undefined): ValuationCopy {
  const normalized = normalizePublicLocale(locale);
  return COPY[normalized] ?? COPY.de;
}
