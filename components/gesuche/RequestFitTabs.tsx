"use client";

import { useState, type CSSProperties } from "react";

import type { RequestMode } from "@/lib/gesuche";
import type { RequestMarketRangeContext } from "@/lib/request-market-range";
import { RequestMarketRangeBox } from "./RequestMarketRangeBox";
import { RequestOfferLeadInlineForm } from "./RequestOfferLeadInlineForm";

type Props = {
  locale?: string;
  mode: RequestMode;
  pagePath: string;
  regionLabel: string;
  request: {
    id: string;
    title: string;
    objectType: string | null;
  };
  context: {
    bundeslandSlug?: string;
    kreisSlug?: string;
    ortSlug?: string;
  };
  marketRangeContext: RequestMarketRangeContext | null;
  initialAreaSqm?: number | null;
  initialRooms?: number | null;
  numberLocale: string;
  currencyCode: string;
  hasReferences: boolean;
};

type TabKey = "contact" | "valuation";

function resolveObjectKind(objectType: string | null): "house" | "apartment" | null {
  const normalized = String(objectType ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (["haus", "house", "einfamilienhaus", "mehrfamilienhaus", "reihenhaus", "doppelhaus"].includes(normalized)) {
    return "house";
  }
  if (["wohnung", "apartment", "flat", "etw", "eigentumswohnung"].includes(normalized)) {
    return "apartment";
  }
  return null;
}

export function RequestFitTabs({
  locale = "de",
  mode,
  pagePath,
  regionLabel,
  request,
  context,
  marketRangeContext,
  initialAreaSqm,
  initialRooms,
  numberLocale,
  currencyCode,
  hasReferences,
}: Props) {
  const normalizedLocale = locale === "en" ? "en" : "de";
  const objectKind = resolveObjectKind(request.objectType);
  const hasValuationRange = objectKind
    ? mode === "miete"
      ? Boolean(marketRangeContext?.rent[objectKind])
      : Boolean(marketRangeContext?.purchase[objectKind])
    : false;
  const [activeTab, setActiveTab] = useState<TabKey>("contact");
  const copy = normalizedLocale === "en"
    ? {
        title: "Does your property fit?",
        contact: "Meet the interested party",
        valuation: "Check property value",
        references: "Track record",
      }
    : {
        title: "Passt Ihre Immobilie?",
        contact: "Interessent kennenlernen",
        valuation: "Immobilienwert prüfen",
        references: "Erfahrungswerte",
      };

  return (
    <section style={sectionStyle}>
      <div>
        <h2 style={titleStyle}>{copy.title}</h2>
      </div>

      <div style={tabsStyle} role="tablist" aria-label={copy.title}>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "contact"}
          onClick={() => setActiveTab("contact")}
          style={activeTab === "contact" ? activeTabStyle : tabStyle}
        >
          {copy.contact}
        </button>
        {hasValuationRange ? (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "valuation"}
            onClick={() => setActiveTab("valuation")}
            style={activeTab === "valuation" ? activeTabStyle : tabStyle}
          >
            {copy.valuation}
          </button>
        ) : null}
        {hasReferences ? (
          <a href="#request-reference-map" style={tabLinkStyle}>
            {copy.references}
          </a>
        ) : null}
      </div>

      <div style={panelStyle}>
        {activeTab === "contact" || !hasValuationRange ? (
          <RequestOfferLeadInlineForm
            locale={normalizedLocale}
            mode={mode}
            pagePath={pagePath}
            regionLabel={regionLabel}
            request={request}
            context={context}
            hideHeading
          />
        ) : (
          <RequestMarketRangeBox
            mode={mode}
            objectType={request.objectType}
            marketRangeContext={marketRangeContext}
            regionLabel={regionLabel}
            initialAreaSqm={initialAreaSqm}
            initialRooms={initialRooms}
            locale={normalizedLocale}
            numberLocale={numberLocale}
            currencyCode={currencyCode}
            embedded
            hideCta
          />
        )}
      </div>

    </section>
  );
}

const sectionStyle: CSSProperties = {
  border: "1px solid #dbe4ea",
  borderRadius: 20,
  background: "#fff",
  padding: 24,
  display: "grid",
  gap: 30,
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: "clamp(1.6rem, 2.5vw, 2.2rem)",
  lineHeight: 1.15,
  color: "#0f172a",
};

const tabsStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

const tabStyle: CSSProperties = {
  border: "1px solid #dbe4ea",
  borderRadius: 999,
  padding: "10px 14px",
  background: "#fff",
  color: "#475569",
  fontWeight: 800,
  cursor: "pointer",
};

const activeTabStyle: CSSProperties = {
  ...tabStyle,
  borderColor: "#486b7a",
  background: "#486b7a",
  color: "#fff",
};

const tabLinkStyle: CSSProperties = {
  ...tabStyle,
  display: "inline-flex",
  alignItems: "center",
  textDecoration: "none",
};

const panelStyle: CSSProperties = {
  minHeight: 220,
};
