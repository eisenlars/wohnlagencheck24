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
type EquipmentKey = "balcony" | "garden" | "parking" | "elevator" | "bathroom" | "energy";

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
    equipment: "Ausstattungsmerkmale",
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
    roomsNoteGood: "Die Zimmeranzahl wirkt für diese Wohnfläche stimmig.",
    roomsNoteCompact: "Die Zimmeranzahl spricht eher für einen kompakten Grundriss.",
    roomsNoteGenerous: "Die Zimmeranzahl deutet eher auf großzügige Raumzuschnitte hin.",
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
      balcony: "Balkon / Terrasse",
      garden: "Garten",
      parking: "Stellplatz / Garage",
      elevator: "Aufzug",
      bathroom: "Modernisiertes Bad",
      energy: "Energetisch modernisiert",
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
    equipment: "Features",
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
    roomsNoteGood: "The room count looks fitting for this living area.",
    roomsNoteCompact: "The room count suggests a rather compact layout.",
    roomsNoteGenerous: "The room count suggests rather generous room sizes.",
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
      balcony: "Balcony / terrace",
      garden: "Garden",
      parking: "Parking / garage",
      elevator: "Elevator",
      bathroom: "Modernized bathroom",
      energy: "Energy modernization",
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
  return kind === "house" ? "120" : "80";
}

function resolveInitialRooms(kind: ObjectKind, area: number | null): string {
  if (kind === "house") {
    if (area !== null && area >= 150) return "6";
    if (area !== null && area >= 120) return "5";
    return "4";
  }
  if (area !== null && area >= 100) return "4";
  if (area !== null && area >= 70) return "3";
  return "2";
}

function getExpectedRooms(kind: ObjectKind, area: number): number {
  if (kind === "house") {
    if (area < 110) return 4;
    if (area < 150) return 5;
    return 6;
  }
  if (area < 55) return 2;
  if (area < 90) return 3;
  return 4;
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

function getRoomsFactor(kind: ObjectKind, area: number, rooms: number): number {
  const expectedRooms = getExpectedRooms(kind, area);
  const difference = rooms - expectedRooms;
  if (difference <= -2) return 0.97;
  if (difference === -1) return 0.985;
  if (difference === 0) return 1;
  if (difference === 1) return 1.015;
  return 1.01;
}

function getEquipmentFactor(equipment: Record<EquipmentKey, boolean>, kind: ObjectKind): number {
  let factor = 1;
  if (equipment.balcony) factor += kind === "apartment" ? 0.015 : 0.01;
  if (equipment.garden) factor += kind === "house" ? 0.025 : 0.01;
  if (equipment.parking) factor += 0.015;
  if (equipment.elevator) factor += kind === "apartment" ? 0.015 : 0.005;
  if (equipment.bathroom) factor += 0.02;
  if (equipment.energy) factor += 0.03;
  return Math.min(1.08, factor);
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
  const [equipment, setEquipment] = useState<Record<EquipmentKey, boolean>>({
    balcony: false,
    garden: false,
    parking: false,
    elevator: false,
    bathroom: false,
    energy: false,
  });
  const [showRefinement, setShowRefinement] = useState(false);
  const area = Number(areaDraft.replace(",", "."));
  const rooms = Number(roomsDraft.replace(",", "."));

  const computedActiveRange = (() => {
    if (!activeRange || !Number.isFinite(area) || area <= 10) return null;
    const baseTotal = applyArea(activeRange, area);
    const roomsFactor = Number.isFinite(rooms) && rooms > 0 && objectKind
      ? getRoomsFactor(objectKind, area, rooms)
      : 1;
    const conditionFactor = getConditionFactor(condition);
    const equipmentFactor = objectKind ? getEquipmentFactor(equipment, objectKind) : 1;
    const total = applyFactor(baseTotal, roomsFactor * conditionFactor * equipmentFactor);
    return {
      total,
      roomsFactor,
      conditionFactor,
      equipmentFactor,
    };
  })();

  if (!objectKind || !activeRange) return null;

  const isRent = mode === "miete";
  const objectLabel = objectKind === "house" ? copy.houseSingular : copy.apartmentSingular;
  const orientationHint = `${copy.orientationHintPrefix} ${objectLabel.toLowerCase()} ${copy.orientationHintIn} ${regionLabel}. ${copy.orientationHintSuffix}`;
  const roomsNote = (() => {
    if (!Number.isFinite(rooms) || rooms <= 0 || !Number.isFinite(area) || area <= 10) return copy.roomsNoteGood;
    const expectedRooms = getExpectedRooms(objectKind, area);
    const difference = rooms - expectedRooms;
    if (difference <= -1) return copy.roomsNoteCompact;
    if (difference >= 1) return copy.roomsNoteGenerous;
    return copy.roomsNoteGood;
  })();
  const addressNote = street.trim().length > 0 ? copy.addressNotePresent : copy.addressNoteMissing;
  const selectedEquipmentLabels = (
    Object.entries(equipment) as Array<[EquipmentKey, boolean]>
  )
    .filter(([, enabled]) => enabled)
    .map(([key]) => copy.equipmentOptions[key]);
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
                    {Array.from({ length: objectKind === "house" ? 8 : 6 }, (_, index) => index + 1).map((value) => (
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
              <div style={sectionLabelStyle}>{copy.equipment}</div>
              <div style={choiceGridStyle}>
                {(Object.keys(copy.equipmentOptions) as EquipmentKey[]).map((key) => (
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
