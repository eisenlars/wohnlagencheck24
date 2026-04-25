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

const COPY = {
  de: {
    orientationTitle: "Preisspanne zur Orientierung",
    housePlural: "Häuser",
    apartmentPlural: "Wohnungen",
    houseSingular: "Häuser",
    apartmentSingular: "Wohnungen",
    livingArea: "Wohnfläche",
    areaHint: "Für die erste Einordnung genügt die Wohnfläche. Weitere Merkmale können später ergänzt werden.",
    purchaseResult: "Orientierungsrahmen",
    rentResult: "Orientierungsrahmen",
    perMonth: " / Monat",
    orientationHintPrefix: "Die Preisspanne beruht auf unseren aktuellen Erhebungen für",
    orientationHintIn: "in",
    orientationHintSuffix: "Sie dient als erste Orientierung und sollte weiter verfeinert werden.",
    refineActionClosed: "Preisspanne verfeinern",
    refineActionOpen: "Verfeinerung ausblenden",
    cta: "Immobilie zu diesem Gesuch anbieten",
  },
  en: {
    orientationTitle: "Indicative price range",
    housePlural: "houses",
    apartmentPlural: "apartments",
    houseSingular: "houses",
    apartmentSingular: "apartments",
    livingArea: "Living area",
    areaHint: "Living area is enough for the first estimate. Further property details can follow later.",
    purchaseResult: "Indicative range",
    rentResult: "Indicative range",
    perMonth: " / month",
    orientationHintPrefix: "This price range is based on our current market observations for",
    orientationHintIn: "in",
    orientationHintSuffix: "It gives an initial orientation and should be refined further.",
    refineActionClosed: "Refine price range",
    refineActionOpen: "Hide refinement",
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

  const [areaDraft, setAreaDraft] = useState(() => objectKind ? resolveInitialArea(initialAreaSqm, objectKind) : "80");
  const [showRefinement, setShowRefinement] = useState(false);
  const area = Number(areaDraft.replace(",", "."));

  const computedActiveRange = (() => {
    if (!activeRange || !Number.isFinite(area) || area <= 10) return null;
    const total = applyArea(activeRange, area);
    return {
      total,
    };
  })();

  if (!objectKind || !activeRange) return null;

  const isRent = mode === "miete";
  const objectLabel = objectKind === "house" ? copy.houseSingular : copy.apartmentSingular;
  const orientationHint = `${copy.orientationHintPrefix} ${objectLabel.toLowerCase()} ${copy.orientationHintIn} ${regionLabel}. ${copy.orientationHintSuffix}`;

  return (
    <div style={embedded ? embeddedBoxStyle : boxStyle}>
      {computedActiveRange ? (
        <div style={resultStyle}>
          <div style={resultLabelStyle}>{copy.orientationTitle}</div>
          <div style={resultValueStyle}>
            {totalLabel(computedActiveRange.total, locale, numberLocale, currencyCode, isRent ? copy.perMonth : "")}
          </div>
          <p style={resultHintStyle}>{orientationHint}</p>
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
          <div style={fieldCardStyle}>
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
          </div>
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
};

const fieldStyle: CSSProperties = {
  display: "grid",
  gap: 5,
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
