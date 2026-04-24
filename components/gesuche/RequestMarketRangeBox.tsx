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
    purchaseEyebrow: "Preisspanne in der Zielregion",
    rentEyebrow: "Mietspanne in der Zielregion",
    purchaseTitle: "Was in dieser Zielregion realistisch ist",
    rentTitle: "Welche Miete in dieser Zielregion realistisch ist",
    comparablePrefix: "Die Spanne bezieht sich auf vergleichbare",
    comparableInLocality: "in der Ortslage",
    comparableInRegion: "in der Zielregion",
    comparableSuffix: "und dient als erste Orientierung.",
    housePlural: "Häuser",
    apartmentPlural: "Wohnungen",
    livingArea: "Wohnfläche",
    areaHint: "Für die erste Einordnung genügt die Wohnfläche. Weitere Merkmale können später ergänzt werden.",
    purchaseResult: "Orientierungsrange für Ihre Wohnfläche",
    rentResult: "Orientierungsrange für Ihre Wohnfläche",
    perMonth: " / Monat",
    resultHintLocality: "Die Spanne bezieht sich auf die Zielregion und liefert eine erste Orientierung für diese Ortslage.",
    resultHintRegion: "Die Spanne bezieht sich auf die Zielregion und liefert eine erste Orientierung für diesen Marktbereich.",
    areaBadgeSuffix: "Wohnfläche",
    cta: "Immobilie zu diesem Gesuch anbieten",
  },
  en: {
    purchaseEyebrow: "Price range in the target area",
    rentEyebrow: "Rent range in the target area",
    purchaseTitle: "What is realistic in this target area",
    rentTitle: "What rent is realistic in this target area",
    comparablePrefix: "This range is based on comparable",
    comparableInLocality: "in the locality",
    comparableInRegion: "in the target area",
    comparableSuffix: "and provides a first orientation.",
    housePlural: "houses",
    apartmentPlural: "apartments",
    livingArea: "Living area",
    areaHint: "Living area is enough for the first estimate. Further property details can follow later.",
    purchaseResult: "Indicative range for your living area",
    rentResult: "Indicative range for your living area",
    perMonth: " / month",
    resultHintLocality: "This range is based on the target area and gives an initial orientation for this locality.",
    resultHintRegion: "This range is based on the target area and gives an initial orientation for this market area.",
    areaBadgeSuffix: "living area",
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
  regionScope = "ortslage",
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
  const isLocalityScope = regionScope === "ortslage";
  const objectLabel = objectKind === "house" ? copy.housePlural : copy.apartmentPlural;

  return (
    <div style={embedded ? embeddedBoxStyle : boxStyle}>
      <div style={eyebrowStyle}>{isRent ? copy.rentEyebrow : copy.purchaseEyebrow}</div>
      <h3 style={titleStyle}>
        {isRent ? copy.rentTitle : copy.purchaseTitle}
      </h3>
      <p style={introStyle}>
        {copy.comparablePrefix} {objectLabel.toLowerCase()} {isLocalityScope ? copy.comparableInLocality : copy.comparableInRegion} {regionLabel} {copy.comparableSuffix}
      </p>

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

      {computedActiveRange ? (
        <div style={resultStyle}>
          <div style={areaBadgeStyle}>
            {Math.round(area)} m² {copy.areaBadgeSuffix}
          </div>
          <div style={resultLabelStyle}>{isRent ? copy.rentResult : copy.purchaseResult}</div>
          <div style={resultValueStyle}>
            {totalLabel(computedActiveRange.total, locale, numberLocale, currencyCode, isRent ? copy.perMonth : "")}
          </div>
          <div style={resultHintStyle}>
            {isLocalityScope ? copy.resultHintLocality : copy.resultHintRegion}
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
};

const resultLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: "0.05em",
  textTransform: "uppercase" as const,
  color: "#486b7a",
};

const areaBadgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "6px 10px",
  borderRadius: 999,
  background: "#486b7a",
  color: "#fff",
  fontSize: 12,
  fontWeight: 800,
  marginBottom: 12,
};

const resultValueStyle: CSSProperties = {
  marginTop: 8,
  fontSize: 28,
  fontWeight: 800,
  lineHeight: 1.15,
};

const resultHintStyle: CSSProperties = {
  marginTop: 10,
  fontSize: 13,
  lineHeight: 1.5,
  color: "#475569",
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
