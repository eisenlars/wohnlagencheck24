"use client";

import { useState } from "react";
import type { CSSProperties } from "react";

import type { RequestMode } from "@/lib/gesuche";
import type { RequestMarketRange, RequestMarketRangeContext } from "@/lib/request-market-range";
import { formatMetric } from "@/utils/format";

type Props = {
  mode: RequestMode;
  objectType: string | null;
  marketRangeContext: RequestMarketRangeContext | null;
  regionLabel: string;
  regionScope?: "ortslage" | "kreis";
  initialAreaSqm?: number | null;
  locale?: string;
  numberLocale: string;
  currencyCode: string;
  embedded?: boolean;
  hideCta?: boolean;
};

type ObjectKind = "house" | "apartment";
type ConditionKey = "renovation_needed" | "simple" | "well_kept" | "modernized" | "as_new";
type EquipmentKey =
  | "terrace"
  | "garden"
  | "garage"
  | "bathroom"
  | "energy"
  | "heating"
  | "balcony"
  | "elevator"
  | "parking"
  | "kitchen";

type ObjectProfile = {
  equipmentKeys: EquipmentKey[];
  roomOptions: number[];
  defaultArea: string;
  expectedRooms: (area: number) => number;
  roomFactor: (area: number, rooms: number) => number;
  equipmentFactor: (equipment: Record<EquipmentKey, boolean>) => number;
  equipmentTitle: string;
  roomNoteGood: string;
  roomNoteCompact: string;
  roomNoteGenerous: string;
};

const COPY = {
  de: {
    orientationTitle: "Preisspanne zur Orientierung",
    housePlural: "Häuser",
    apartmentPlural: "Wohnungen",
    houseSingular: "Häuser",
    apartmentSingular: "Wohnungen",
    livingArea: "Wohnfläche",
    areaHint: "Die Wohnfläche bildet die Basis. Weitere Angaben verfeinern die Orientierung live.",
    rooms: "Zimmer",
    condition: "Zustand",
    addressTitle: "Adresse präzisieren",
    street: "Straße",
    houseNumber: "Hausnummer",
    addressHint: "Mit genauer Adresse können wir später die Mikrolage genauer einordnen.",
    houseEquipment: "Ausstattung am Haus",
    apartmentEquipment: "Ausstattung der Wohnung",
    purchaseResult: "Orientierungsrahmen",
    rentResult: "Orientierungsrahmen",
    perMonth: " / Monat",
    orientationHintPrefix: "Die Preisspanne beruht auf unseren aktuellen Erhebungen für",
    orientationHintIn: "in",
    orientationHintSuffix: "Sie dient als erste Orientierung und sollte weiter verfeinert werden.",
    refineActionClosed: "Preisspanne verfeinern",
    refineActionOpen: "Verfeinerung ausblenden",
    summaryTitle: "Aktuell berücksichtigt",
    notesTitle: "Einordnung",
    houseRoomsNoteGood: "Die Zimmeranzahl wirkt für dieses Haus stimmig.",
    houseRoomsNoteCompact: "Die Zimmeranzahl spricht eher für einen kompakten Hausgrundriss.",
    houseRoomsNoteGenerous: "Die Zimmeranzahl deutet eher auf einen großzügigen Familiengrundriss hin.",
    apartmentRoomsNoteGood: "Die Zimmeranzahl wirkt für diese Wohnungsgröße stimmig.",
    apartmentRoomsNoteCompact: "Die Zimmeranzahl spricht eher für einen kompakten Wohnungsgrundriss.",
    apartmentRoomsNoteGenerous: "Die Zimmeranzahl deutet eher auf großzügige Zimmerzuschnitte hin.",
    addressNoteMissing: "Mit Straße und Hausnummer kann die Lage später genauer verfeinert werden.",
    addressNotePresent: "Die angegebene Adresse kann später für eine präzisere Mikrolagen-Einordnung genutzt werden.",
    prototypeHint: "Die aktuelle Verfeinerung ist ein Prototyp und wird später um Lagecluster und weitere Marktfaktoren ergänzt.",
    conditionOptions: {
      renovation_needed: "Sanierungsbedürftig",
      simple: "Einfach / älter",
      well_kept: "Gepflegt",
      modernized: "Modernisiert",
      as_new: "Neuwertig",
    },
    equipmentOptions: {
      terrace: "Terrasse",
      garden: "Garten",
      garage: "Garage / Carport",
      bathroom: "Modernisiertes Bad",
      energy: "Energetisch modernisiert",
      heating: "Modernisierte Heizung",
      balcony: "Balkon / Loggia",
      elevator: "Aufzug",
      parking: "Stellplatz / Tiefgarage",
      kitchen: "Einbauküche",
    },
    cta: "Immobilie zu diesem Gesuch anbieten",
  },
  en: {
    orientationTitle: "Indicative price range",
    housePlural: "houses",
    apartmentPlural: "apartments",
    houseSingular: "houses",
    apartmentSingular: "apartments",
    livingArea: "Living area",
    areaHint: "Living area is the basis. Additional details refine the orientation live.",
    rooms: "Rooms",
    condition: "Condition",
    addressTitle: "Refine address",
    street: "Street",
    houseNumber: "House number",
    addressHint: "With a precise address, we can later classify the micro-location more accurately.",
    houseEquipment: "House features",
    apartmentEquipment: "Apartment features",
    purchaseResult: "Indicative range",
    rentResult: "Indicative range",
    perMonth: " / month",
    orientationHintPrefix: "This price range is based on our current market observations for",
    orientationHintIn: "in",
    orientationHintSuffix: "It gives an initial orientation and should be refined further.",
    refineActionClosed: "Refine price range",
    refineActionOpen: "Hide refinement",
    summaryTitle: "Currently considered",
    notesTitle: "Assessment",
    houseRoomsNoteGood: "The room count looks fitting for this house size.",
    houseRoomsNoteCompact: "The room count suggests a rather compact house layout.",
    houseRoomsNoteGenerous: "The room count suggests a more generous family layout.",
    apartmentRoomsNoteGood: "The room count looks fitting for this apartment size.",
    apartmentRoomsNoteCompact: "The room count suggests a rather compact apartment layout.",
    apartmentRoomsNoteGenerous: "The room count suggests rather generous room sizes.",
    addressNoteMissing: "With street and house number, the location can later be refined more precisely.",
    addressNotePresent: "The provided address can later be used for a more precise micro-location assessment.",
    prototypeHint: "The current refinement is a prototype and will later be extended by location clusters and additional market factors.",
    conditionOptions: {
      renovation_needed: "Needs renovation",
      simple: "Simple / older",
      well_kept: "Well kept",
      modernized: "Modernized",
      as_new: "As new",
    },
    equipmentOptions: {
      terrace: "Terrace",
      garden: "Garden",
      garage: "Garage / carport",
      bathroom: "Modernized bathroom",
      energy: "Energy modernization",
      heating: "Modernized heating",
      balcony: "Balcony / loggia",
      elevator: "Elevator",
      parking: "Parking / underground parking",
      kitchen: "Fitted kitchen",
    },
    cta: "Offer property for this request",
  },
};

function resolveObjectKind(objectType: string | null): ObjectKind | null {
  const normalized = String(objectType ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (["haus", "house", "einfamilienhaus", "mehrfamilienhaus", "reihenhaus", "doppelhaus"].includes(normalized)) {
    return "house";
  }
  if (["wohnung", "apartment", "flat", "etw", "eigentumswohnung"].includes(normalized)) {
    return "apartment";
  }
  return null;
}

function round(value: number): number {
  return Math.round(value);
}

function applyArea(range: RequestMarketRange, area: number): RequestMarketRange {
  return {
    min: round(range.min * area),
    avg: round(range.avg * area),
    max: round(range.max * area),
  };
}

function applyFactor(range: RequestMarketRange, factor: number): RequestMarketRange {
  return {
    min: round(range.min * factor),
    avg: round(range.avg * factor),
    max: round(range.max * factor),
  };
}

function totalLabel(
  range: RequestMarketRange,
  locale: string | undefined,
  numberLocale: string,
  currencyCode: string,
  suffix = "",
): string {
  return `${formatMetric(range.min, { kind: "currency", ctx: "kpi", unit: "eur", locale, numberLocale, currencyCode, fractionDigits: 0 })} bis ${formatMetric(range.max, { kind: "currency", ctx: "kpi", unit: "eur", locale, numberLocale, currencyCode, fractionDigits: 0 })}${suffix}`;
}

function resolveInitialArea(value: number | null | undefined, kind: ObjectKind): string {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return String(Math.round(value));
  }
  return kind === "house" ? "135" : "82";
}

function resolveInitialRooms(kind: ObjectKind, area: number | null): string {
  if (kind === "house") {
    if (area !== null && area >= 165) return "6";
    if (area !== null && area >= 125) return "5";
    return "4";
  }
  if (area !== null && area >= 110) return "5";
  if (area !== null && area >= 78) return "3";
  return "2";
}

function getHouseExpectedRooms(area: number): number {
  if (area < 115) return 4;
  if (area < 165) return 5;
  return 6;
}

function getConditionFactor(condition: ConditionKey): number {
  switch (condition) {
    case "renovation_needed":
      return 0.91;
    case "simple":
      return 0.96;
    case "modernized":
      return 1.05;
    case "as_new":
      return 1.08;
    default:
      return 1;
  }
}

function getApartmentExpectedRooms(area: number): number {
  if (area < 58) return 2;
  if (area < 98) return 3;
  return 4;
}

const HOUSE_EQUIPMENT_KEYS: EquipmentKey[] = ["terrace", "garden", "garage", "bathroom", "energy", "heating"];
const APARTMENT_EQUIPMENT_KEYS: EquipmentKey[] = ["balcony", "elevator", "parking", "bathroom", "kitchen", "energy"];

function getObjectProfile(copy: typeof COPY.de | typeof COPY.en, kind: ObjectKind): ObjectProfile {
  if (kind === "house") {
    return {
      equipmentKeys: HOUSE_EQUIPMENT_KEYS,
      roomOptions: [3, 4, 5, 6, 7, 8],
      defaultArea: "135",
      expectedRooms: getHouseExpectedRooms,
      roomFactor: (area, rooms) => {
        const difference = rooms - getHouseExpectedRooms(area);
        if (difference <= -2) return 0.975;
        if (difference === -1) return 0.988;
        if (difference === 0) return 1;
        if (difference === 1) return 1.012;
        return 1.008;
      },
      equipmentFactor: (equipment) => {
        let factor = 1;
        if (equipment.terrace) factor += 0.015;
        if (equipment.garden) factor += 0.025;
        if (equipment.garage) factor += 0.018;
        if (equipment.bathroom) factor += 0.018;
        if (equipment.energy) factor += 0.028;
        if (equipment.heating) factor += 0.02;
        return Math.min(1.09, factor);
      },
      equipmentTitle: copy.houseEquipment,
      roomNoteGood: copy.houseRoomsNoteGood,
      roomNoteCompact: copy.houseRoomsNoteCompact,
      roomNoteGenerous: copy.houseRoomsNoteGenerous,
    };
  }

  return {
    equipmentKeys: APARTMENT_EQUIPMENT_KEYS,
    roomOptions: [1, 2, 3, 4, 5, 6],
    defaultArea: "82",
    expectedRooms: getApartmentExpectedRooms,
    roomFactor: (area, rooms) => {
      const difference = rooms - getApartmentExpectedRooms(area);
      if (difference <= -2) return 0.972;
      if (difference === -1) return 0.986;
      if (difference === 0) return 1;
      if (difference === 1) return 1.014;
      return 1.007;
    },
    equipmentFactor: (equipment) => {
      let factor = 1;
      if (equipment.balcony) factor += 0.018;
      if (equipment.elevator) factor += 0.015;
      if (equipment.parking) factor += 0.015;
      if (equipment.bathroom) factor += 0.02;
      if (equipment.kitchen) factor += 0.012;
      if (equipment.energy) factor += 0.025;
      return Math.min(1.08, factor);
    },
    equipmentTitle: copy.apartmentEquipment,
    roomNoteGood: copy.apartmentRoomsNoteGood,
    roomNoteCompact: copy.apartmentRoomsNoteCompact,
    roomNoteGenerous: copy.apartmentRoomsNoteGenerous,
  };
}

function createInitialEquipmentState(): Record<EquipmentKey, boolean> {
  return {
    terrace: false,
    garden: false,
    garage: false,
    bathroom: false,
    energy: false,
    heating: false,
    balcony: false,
    elevator: false,
    parking: false,
    kitchen: false,
  };
}

function buildSummaryItems(
  copy: typeof COPY.de,
  area: number,
  rooms: number,
  condition: ConditionKey,
): string[] {
  return [
    `${Math.round(area)} m²`,
    `${rooms} ${copy.rooms}`,
    copy.conditionOptions[condition],
  ];
}

export function RequestMarketRangeBox({
  mode,
  objectType,
  marketRangeContext,
  regionLabel,
  initialAreaSqm,
  locale = "de",
  numberLocale,
  currencyCode,
  embedded = false,
  hideCta = false,
}: Props) {
  const copy = locale === "en" ? COPY.en : COPY.de;
  const objectKind = resolveObjectKind(objectType);
  const profile = objectKind ? getObjectProfile(copy, objectKind) : null;
  const activeRange = objectKind
    ? mode === "miete"
      ? marketRangeContext?.rent[objectKind] ?? null
      : marketRangeContext?.purchase[objectKind] ?? null
    : null;

  const initialArea = objectKind
    ? Number(resolveInitialArea(initialAreaSqm, objectKind).replace(",", "."))
    : null;
  const [areaDraft, setAreaDraft] = useState(() => objectKind ? resolveInitialArea(initialAreaSqm, objectKind) : "80");
  const [roomsDraft, setRoomsDraft] = useState(() => objectKind ? resolveInitialRooms(objectKind, initialArea) : "3");
  const [condition, setCondition] = useState<ConditionKey>("well_kept");
  const [street, setStreet] = useState("");
  const [houseNumber, setHouseNumber] = useState("");
  const [equipment, setEquipment] = useState<Record<EquipmentKey, boolean>>(() => createInitialEquipmentState());
  const [showRefinement, setShowRefinement] = useState(false);
  const area = Number(areaDraft.replace(",", "."));
  const rooms = Number(roomsDraft.replace(",", "."));

  const computedActiveRange = (() => {
    if (!activeRange || !profile || !Number.isFinite(area) || area <= 10) return null;
    const baseTotal = applyArea(activeRange, area);
    const roomsFactor = Number.isFinite(rooms) && rooms > 0 && objectKind
      ? profile.roomFactor(area, rooms)
      : 1;
    const conditionFactor = getConditionFactor(condition);
    const equipmentFactor = profile.equipmentFactor(equipment);
    const total = applyFactor(baseTotal, roomsFactor * conditionFactor * equipmentFactor);
    return {
      total,
    };
  })();

  if (!objectKind || !activeRange || !profile) return null;

  const isRent = mode === "miete";
  const objectLabel = objectKind === "house" ? copy.houseSingular : copy.apartmentSingular;
  const orientationHint = `${copy.orientationHintPrefix} ${objectLabel.toLowerCase()} ${copy.orientationHintIn} ${regionLabel}. ${copy.orientationHintSuffix}`;
  const roomsNote = (() => {
    if (!Number.isFinite(rooms) || rooms <= 0 || !Number.isFinite(area) || area <= 10) return profile.roomNoteGood;
    const expectedRooms = profile.expectedRooms(area);
    const difference = rooms - expectedRooms;
    if (difference <= -1) return profile.roomNoteCompact;
    if (difference >= 1) return profile.roomNoteGenerous;
    return profile.roomNoteGood;
  })();
  const addressNote = street.trim().length > 0 ? copy.addressNotePresent : copy.addressNoteMissing;
  const selectedEquipmentLabels = profile.equipmentKeys
    .filter((key) => equipment[key])
    .map((key) => copy.equipmentOptions[key]);
  const summaryItems = buildSummaryItems(copy, Number.isFinite(area) && area > 10 ? area : initialArea ?? 80, Number.isFinite(rooms) && rooms > 0 ? rooms : 3, condition);

  return (
    <div style={embedded ? embeddedBoxStyle : boxStyle}>
      {computedActiveRange ? (
        <div style={resultStyle}>
          <div style={resultLabelStyle}>{copy.orientationTitle}</div>
          <div style={resultValueStyle}>
            {totalLabel(computedActiveRange.total, locale, numberLocale, currencyCode, isRent ? copy.perMonth : "")}
          </div>
          <p style={resultHintStyle}>{orientationHint}</p>
          <div style={summaryWrapStyle}>
            <div style={summaryTitleStyle}>{copy.summaryTitle}</div>
            <div style={summaryItemsStyle}>
              {summaryItems.map((item) => (
                <span key={item} style={summaryChipStyle}>{item}</span>
              ))}
            </div>
            {selectedEquipmentLabels.length > 0 ? (
              <div style={summaryMetaStyle}>{selectedEquipmentLabels.join(" · ")}</div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div style={refinementWrapStyle}>
        <button
          type="button"
          onClick={() => setShowRefinement((current) => !current)}
          style={refinementToggleStyle}
          aria-expanded={showRefinement}
        >
          <span>{showRefinement ? copy.refineActionOpen : copy.refineActionClosed}</span>
          <span aria-hidden="true" style={refinementToggleIconStyle}>{showRefinement ? "−" : "+"}</span>
        </button>
        {showRefinement ? (
          <>
            <div style={fieldCardStyle}>
              <div style={fieldGridStyle}>
                <label style={fieldStyle}>
                  <span style={fieldLabelStyle}>{copy.livingArea}</span>
                  <input
                    value={areaDraft}
                    onChange={(event) => setAreaDraft(event.target.value)}
                    inputMode="decimal"
                    style={inputStyle}
                  />
                  <span style={fieldHintStyle}>{copy.areaHint}</span>
                </label>
                <label style={fieldStyle}>
                  <span style={fieldLabelStyle}>{copy.rooms}</span>
                  <select
                    value={roomsDraft}
                    onChange={(event) => setRoomsDraft(event.target.value)}
                    style={inputStyle}
                  >
                    {profile.roomOptions.map((value) => (
                      <option key={value} value={String(value)}>
                        {value}
                      </option>
                    ))}
                  </select>
                  <span style={fieldHintStyle}>{roomsNote}</span>
                </label>
              </div>
            </div>

            <div style={fieldCardStyle}>
              <div style={sectionLabelStyle}>{copy.condition}</div>
              <div style={choiceGridStyle}>
                {(Object.keys(copy.conditionOptions) as ConditionKey[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setCondition(key)}
                    style={condition === key ? selectedChoiceStyle : choiceStyle}
                  >
                    {copy.conditionOptions[key]}
                  </button>
                ))}
              </div>
            </div>

            <div style={fieldCardStyle}>
              <div style={sectionLabelStyle}>{copy.addressTitle}</div>
              <div style={fieldGridStyle}>
                <label style={fieldStyle}>
                  <span style={fieldLabelStyle}>{copy.street}</span>
                  <input
                    value={street}
                    onChange={(event) => setStreet(event.target.value)}
                    style={inputStyle}
                    placeholder={locale === "en" ? "Street" : "Straßenname"}
                  />
                </label>
                <label style={fieldStyle}>
                  <span style={fieldLabelStyle}>{copy.houseNumber}</span>
                  <input
                    value={houseNumber}
                    onChange={(event) => setHouseNumber(event.target.value)}
                    style={inputStyle}
                    placeholder={locale === "en" ? "No." : "Nr."}
                  />
                </label>
              </div>
              <div style={fieldHintStyle}>{copy.addressHint}</div>
            </div>

            <div style={fieldCardStyle}>
              <div style={sectionLabelStyle}>{profile.equipmentTitle}</div>
              <div style={choiceGridStyle}>
                {profile.equipmentKeys.map((key) => (
                  <label key={key} style={equipmentChoiceLabelStyle}>
                    <input
                      type="checkbox"
                      checked={equipment[key]}
                      onChange={(event) => setEquipment((current) => ({ ...current, [key]: event.target.checked }))}
                    />
                    <span>{copy.equipmentOptions[key]}</span>
                  </label>
                ))}
              </div>
            </div>

            <div style={notesCardStyle}>
              <div style={notesTitleStyle}>{copy.notesTitle}</div>
              <ul style={notesListStyle}>
                <li>{roomsNote}</li>
                <li>{addressNote}</li>
                <li>{copy.prototypeHint}</li>
              </ul>
            </div>
          </>
        ) : null}
      </div>

      {!hideCta ? (
        <a href="#request-offer-form" style={ctaStyle}>
          {copy.cta}
        </a>
      ) : null}
    </div>
  );
}

const boxStyle: CSSProperties = {
  marginTop: 24,
  paddingTop: 24,
  borderTop: "1px solid #e2e8f0",
  display: "grid",
  gap: 14,
};

const embeddedBoxStyle: CSSProperties = {
  display: "grid",
  gap: 14,
};

const fieldCardStyle: CSSProperties = {
  padding: "14px 16px",
  borderRadius: 16,
  background: "#f8fafc",
  border: "1px solid #dbe4ea",
  display: "grid",
  gap: 14,
};

const fieldStyle: CSSProperties = {
  display: "grid",
  gap: 5,
};

const fieldGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 14,
};

const fieldLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "#475569",
  marginBottom: 5,
};

const fieldHintStyle: CSSProperties = {
  fontSize: 12,
  lineHeight: 1.5,
  color: "#64748b",
};

const inputStyle: CSSProperties = {
  width: "100%",
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  padding: "9px 10px",
  fontSize: 14,
  color: "#0f172a",
  background: "#fff",
};

const resultStyle: CSSProperties = {
  padding: "18px 18px",
  borderRadius: 18,
  background: "linear-gradient(135deg, #f7fbfd 0%, #eef5f8 100%)",
  border: "1px solid #dbe4ea",
  color: "#0f172a",
  textAlign: "center",
};

const resultLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: "0.05em",
  textTransform: "uppercase" as const,
  color: "#486b7a",
};

const resultValueStyle: CSSProperties = {
  marginTop: 8,
  fontSize: 28,
  fontWeight: 800,
  lineHeight: 1.15,
};

const resultHintStyle: CSSProperties = {
  margin: "12px auto 0",
  fontSize: 13,
  lineHeight: 1.5,
  color: "#475569",
  maxWidth: 520,
};

const summaryWrapStyle: CSSProperties = {
  marginTop: 18,
  display: "grid",
  gap: 10,
  justifyItems: "center",
};

const summaryTitleStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "#64748b",
};

const summaryItemsStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "center",
  gap: 8,
};

const summaryChipStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "7px 11px",
  borderRadius: 999,
  background: "#fff",
  border: "1px solid #dbe4ea",
  fontSize: 12,
  fontWeight: 700,
  color: "#334155",
};

const summaryMetaStyle: CSSProperties = {
  fontSize: 12,
  lineHeight: 1.5,
  color: "#64748b",
  textAlign: "center",
};

const refinementWrapStyle: CSSProperties = {
  display: "grid",
  gap: 12,
};

const refinementToggleStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  width: "100%",
  padding: "14px 16px",
  borderRadius: 16,
  border: "1px solid #dbe4ea",
  background: "#fff",
  color: "#0f172a",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
  textAlign: "left",
};

const refinementToggleIconStyle: CSSProperties = {
  fontSize: 20,
  lineHeight: 1,
  color: "#486b7a",
};

const sectionLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: "0.04em",
  textTransform: "uppercase" as const,
  color: "#486b7a",
};

const choiceGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 10,
};

const choiceStyle: CSSProperties = {
  border: "1px solid #dbe4ea",
  borderRadius: 12,
  background: "#fff",
  color: "#334155",
  fontSize: 13,
  fontWeight: 700,
  padding: "10px 12px",
  textAlign: "left",
  cursor: "pointer",
};

const selectedChoiceStyle: CSSProperties = {
  ...choiceStyle,
  borderColor: "#486b7a",
  background: "#eef4f8",
  color: "#0f172a",
};

const equipmentChoiceLabelStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "16px minmax(0, 1fr)",
  gap: 10,
  alignItems: "start",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #dbe4ea",
  background: "#fff",
  color: "#334155",
  fontSize: 13,
  fontWeight: 600,
};

const notesCardStyle: CSSProperties = {
  padding: "14px 16px",
  borderRadius: 16,
  background: "#fff",
  border: "1px solid #dbe4ea",
  display: "grid",
  gap: 10,
};

const notesTitleStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: "0.04em",
  textTransform: "uppercase" as const,
  color: "#486b7a",
};

const notesListStyle: CSSProperties = {
  margin: 0,
  paddingLeft: 18,
  color: "#475569",
  fontSize: 13,
  lineHeight: 1.6,
};

const ctaStyle: CSSProperties = {
  display: "inline-flex",
  justifyContent: "center",
  alignItems: "center",
  padding: "11px 14px",
  borderRadius: 999,
  background: "#486b7a",
  color: "#fff",
  fontWeight: 800,
  textDecoration: "none",
};
