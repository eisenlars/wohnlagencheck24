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
  initialAreaSqm?: number | null;
  initialRooms?: number | null;
  locale?: string;
  numberLocale: string;
  currencyCode: string;
  embedded?: boolean;
  hideCta?: boolean;
};

type ObjectKind = "house" | "apartment";
type Condition = "renovierungsbeduerftig" | "durchschnitt" | "gepflegt" | "modernisiert";

const COPY = {
  de: {
    purchaseEyebrow: "Preisrahmen im Gebiet",
    rentEyebrow: "Mietpreisrahmen im Gebiet",
    purchaseTitle: "Passt Ihr Objekt preislich zum Gesuch?",
    rentTitle: "Miete realistisch einordnen",
    comparablePrefix: "Vergleichbare",
    comparableIn: "in",
    comparableSuffix: "liegen aktuell ungefähr bei:",
    housePlural: "Häuser",
    apartmentPlural: "Wohnungen",
    purchasePerSqm: "Kaufpreis pro m²",
    rentPerSqm: "Kaltmiete pro m²",
    livingArea: "Wohnfläche",
    rooms: "Zimmer",
    yearBuilt: "Baujahr",
    optional: "optional",
    condition: "Zustand",
    conditionRenovation: "Renovierungsbedürftig",
    conditionAverage: "Durchschnittlich",
    conditionGood: "Gepflegt",
    conditionModernized: "Modernisiert",
    purchaseResult: "Grobe Kaufpreis-Einordnung",
    rentResult: "Grobe Miet-Einordnung",
    perMonth: " / Monat",
    resultHint: "Orientierung auf Basis der Gebietsrange. Eine konkrete Einschätzung hängt von Mikrolage und Objektzustand ab.",
    saleResult: "Perspektivische Verkaufsrange",
    saleHint: "Für Eigentümer, die neben der Vermietung später auch einen Verkauf prüfen möchten.",
    cta: "Immobilie zu diesem Gesuch anbieten",
  },
  en: {
    purchaseEyebrow: "Area price range",
    rentEyebrow: "Area rent range",
    purchaseTitle: "Does your property match this request?",
    rentTitle: "Estimate the realistic rent range",
    comparablePrefix: "Comparable",
    comparableIn: "in",
    comparableSuffix: "currently sit at approximately:",
    housePlural: "houses",
    apartmentPlural: "apartments",
    purchasePerSqm: "Purchase price per sqm",
    rentPerSqm: "Cold rent per sqm",
    livingArea: "Living area",
    rooms: "Rooms",
    yearBuilt: "Year built",
    optional: "optional",
    condition: "Condition",
    conditionRenovation: "Needs renovation",
    conditionAverage: "Average",
    conditionGood: "Well kept",
    conditionModernized: "Modernized",
    purchaseResult: "Indicative purchase range",
    rentResult: "Indicative rent range",
    perMonth: " / month",
    resultHint: "Orientation based on the regional range. A concrete assessment depends on micro-location and property condition.",
    saleResult: "Potential sale range",
    saleHint: "For owners who may also consider selling later.",
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

function conditionFactor(condition: Condition): number {
  if (condition === "renovierungsbeduerftig") return 0.92;
  if (condition === "gepflegt") return 1.04;
  if (condition === "modernisiert") return 1.09;
  return 1;
}

function yearFactor(yearBuilt: number | null): number {
  if (!yearBuilt || !Number.isFinite(yearBuilt)) return 1;
  if (yearBuilt >= 2015) return 1.08;
  if (yearBuilt >= 2000) return 1.04;
  if (yearBuilt < 1950) return 0.96;
  return 1;
}

function roomFactor(kind: ObjectKind, rooms: number | null): number {
  if (kind !== "apartment" || !rooms || !Number.isFinite(rooms)) return 1;
  if (rooms <= 1) return 0.97;
  if (rooms >= 4) return 1.03;
  return 1;
}

function round(value: number): number {
  return Math.round(value);
}

function applyRange(range: RequestMarketRange, factor: number): RequestMarketRange {
  return {
    min: round(range.min * factor),
    avg: round(range.avg * factor),
    max: round(range.max * factor),
  };
}

function rangeLabel(
  range: RequestMarketRange,
  kind: "purchase" | "rent",
  locale: string | undefined,
  numberLocale: string,
  currencyCode: string,
): string {
  const metricKind = kind === "rent" ? "miete_qm" : "kaufpreis_qm";
  const digits = kind === "rent" ? 2 : 0;
  return `${formatMetric(range.min, { kind: metricKind, ctx: "kpi", unit: "eur_per_sqm", locale, numberLocale, currencyCode, fractionDigits: digits })} bis ${formatMetric(range.max, { kind: metricKind, ctx: "kpi", unit: "eur_per_sqm", locale, numberLocale, currencyCode, fractionDigits: digits })}`;
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

function resolveInitialRooms(value: number | null | undefined): string {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return String(Math.round(value * 10) / 10);
  }
  return "3";
}

export function RequestMarketRangeBox({
  mode,
  objectType,
  marketRangeContext,
  regionLabel,
  initialAreaSqm,
  initialRooms,
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
  const saleRange = objectKind ? marketRangeContext?.purchase[objectKind] ?? null : null;

  const [areaDraft, setAreaDraft] = useState(() => objectKind ? resolveInitialArea(initialAreaSqm, objectKind) : "80");
  const [roomsDraft, setRoomsDraft] = useState(() => resolveInitialRooms(initialRooms));
  const [yearDraft, setYearDraft] = useState("");
  const [condition, setCondition] = useState<Condition>("durchschnitt");

  const area = Number(areaDraft.replace(",", "."));
  const rooms = Number(roomsDraft.replace(",", "."));
  const yearBuilt = Number(yearDraft);
  const factor = objectKind
    ? conditionFactor(condition)
      * yearFactor(Number.isFinite(yearBuilt) ? yearBuilt : null)
      * roomFactor(objectKind, Number.isFinite(rooms) ? rooms : null)
    : 1;

  const computedActiveRange = (() => {
    if (!activeRange || !Number.isFinite(area) || area <= 10) return null;
    const sqm = applyRange(activeRange, factor);
    return {
      sqm,
      total: {
        min: round(sqm.min * area),
        avg: round(sqm.avg * area),
        max: round(sqm.max * area),
      },
    };
  })();

  const computedSaleRange = (() => {
    if (mode !== "miete" || !saleRange || !Number.isFinite(area) || area <= 10) return null;
    const sqm = applyRange(saleRange, factor);
    return {
      sqm,
      total: {
        min: round(sqm.min * area),
        avg: round(sqm.avg * area),
        max: round(sqm.max * area),
      },
    };
  })();

  if (!objectKind || !activeRange) return null;

  const isRent = mode === "miete";
  const objectLabel = objectKind === "house" ? copy.housePlural : copy.apartmentPlural;

  return (
    <div style={embedded ? embeddedBoxStyle : boxStyle}>
      <div style={eyebrowStyle}>{isRent ? copy.rentEyebrow : copy.purchaseEyebrow}</div>
      <h3 style={titleStyle}>
        {isRent ? copy.rentTitle : copy.purchaseTitle}
      </h3>
      <p style={introStyle}>
        {copy.comparablePrefix} {objectLabel.toLowerCase()} {copy.comparableIn} {regionLabel} {copy.comparableSuffix}
      </p>
      <div style={rangeCardStyle}>
        <div style={rangeLabelStyle}>{rangeLabel(activeRange, isRent ? "rent" : "purchase", locale, numberLocale, currencyCode)}</div>
        <div style={rangeHintStyle}>{isRent ? copy.rentPerSqm : copy.purchasePerSqm}</div>
      </div>

      <div style={formGridStyle}>
        <label style={fieldStyle}>
          <span style={fieldLabelStyle}>{copy.livingArea}</span>
          <input
            value={areaDraft}
            onChange={(event) => setAreaDraft(event.target.value)}
            inputMode="decimal"
            style={inputStyle}
          />
        </label>
        {objectKind === "apartment" ? (
          <label style={fieldStyle}>
            <span style={fieldLabelStyle}>{copy.rooms}</span>
            <input
              value={roomsDraft}
              onChange={(event) => setRoomsDraft(event.target.value)}
              inputMode="decimal"
              style={inputStyle}
            />
          </label>
        ) : null}
        <label style={fieldStyle}>
          <span style={fieldLabelStyle}>{copy.yearBuilt}</span>
          <input
            value={yearDraft}
            onChange={(event) => setYearDraft(event.target.value)}
            inputMode="numeric"
            placeholder={copy.optional}
            style={inputStyle}
          />
        </label>
        <label style={{ ...fieldStyle, gridColumn: "1 / -1" }}>
          <span style={fieldLabelStyle}>{copy.condition}</span>
          <select
            value={condition}
            onChange={(event) => setCondition(event.target.value as Condition)}
            style={inputStyle}
          >
            <option value="renovierungsbeduerftig">{copy.conditionRenovation}</option>
            <option value="durchschnitt">{copy.conditionAverage}</option>
            <option value="gepflegt">{copy.conditionGood}</option>
            <option value="modernisiert">{copy.conditionModernized}</option>
          </select>
        </label>
      </div>

      {computedActiveRange ? (
        <div style={resultStyle}>
          <div style={resultLabelStyle}>{isRent ? copy.rentResult : copy.purchaseResult}</div>
          <div style={resultValueStyle}>
            {totalLabel(computedActiveRange.total, locale, numberLocale, currencyCode, isRent ? copy.perMonth : "")}
          </div>
          <div style={resultHintStyle}>
            {copy.resultHint}
          </div>
        </div>
      ) : null}

      {computedSaleRange ? (
        <div style={saleHintStyle}>
          <div style={resultLabelStyle}>{copy.saleResult}</div>
          <div style={saleValueStyle}>{totalLabel(computedSaleRange.total, locale, numberLocale, currencyCode)}</div>
          <div style={resultHintStyle}>
            {copy.saleHint}
          </div>
        </div>
      ) : null}

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

const eyebrowStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  color: "#486b7a",
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 20,
  lineHeight: 1.25,
  color: "#0f172a",
};

const introStyle: CSSProperties = {
  margin: 0,
  color: "#475569",
  fontSize: 14,
  lineHeight: 1.6,
};

const rangeCardStyle: CSSProperties = {
  padding: "14px 16px",
  borderRadius: 16,
  background: "#f4f8fb",
  border: "1px solid #dbe4ea",
};

const rangeLabelStyle: CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
  color: "#0f172a",
};

const rangeHintStyle: CSSProperties = {
  marginTop: 4,
  fontSize: 12,
  color: "#64748b",
};

const formGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 10,
};

const fieldStyle: CSSProperties = {
  display: "grid",
  gap: 5,
};

const fieldLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "#475569",
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
  padding: "14px 16px",
  borderRadius: 16,
  background: "#0f172a",
  color: "#fff",
};

const resultLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: "0.05em",
  textTransform: "uppercase" as const,
  opacity: 0.8,
};

const resultValueStyle: CSSProperties = {
  marginTop: 5,
  fontSize: 20,
  fontWeight: 800,
};

const resultHintStyle: CSSProperties = {
  marginTop: 7,
  fontSize: 12,
  lineHeight: 1.5,
  opacity: 0.78,
};

const saleHintStyle: CSSProperties = {
  padding: "14px 16px",
  borderRadius: 16,
  background: "#fff7ed",
  border: "1px solid #fed7aa",
  color: "#7c2d12",
};

const saleValueStyle: CSSProperties = {
  marginTop: 5,
  fontSize: 18,
  fontWeight: 800,
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
