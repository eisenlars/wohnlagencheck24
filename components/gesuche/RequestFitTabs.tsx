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
        eyebrow: "Owner options",
        title: "Does your property fit?",
        intro: "Choose whether you want to contact the interested party, first estimate your property, or review local transaction experience.",
        contact: "Meet the interested party",
        valuation: "Property estimate",
        references: "Track record",
        referencesIntro: "Review comparable transactions from the region before you make contact.",
        referencesCta: "View track record",
      }
    : {
        eyebrow: "Eigentümerbereich",
        title: "Passt Ihre Immobilie?",
        intro: "Wählen Sie, ob Sie den Interessenten kennenlernen, Ihre Immobilie zuerst preislich einordnen oder die Vermittlungserfahrung prüfen möchten.",
        contact: "Interessent kennenlernen",
        valuation: "Preiseinschätzung Ihrer Immobilie",
        references: "Vermittlungserfahrung",
        referencesIntro: "Prüfen Sie vergleichbare Vermittlungen aus der Region, bevor Sie Kontakt aufnehmen.",
        referencesCta: "Vermittlungserfahrung ansehen",
      };

  return (
    <section style={sectionStyle}>
      <div>
        <div style={eyebrowStyle}>{copy.eyebrow}</div>
        <h2 style={titleStyle}>{copy.title}</h2>
        <p style={introStyle}>{copy.intro}</p>
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

      {hasReferences ? (
        <div style={referencesHintStyle}>
          <span>{copy.referencesIntro}</span>
          <a href="#request-reference-map" style={referencesLinkStyle}>{copy.referencesCta}</a>
        </div>
      ) : null}
    </section>
  );
}

const sectionStyle: CSSProperties = {
  border: "1px solid #dbe4ea",
  borderRadius: 20,
  background: "#fff",
  padding: 24,
  display: "grid",
  gap: 18,
};

const eyebrowStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#486b7a",
};

const titleStyle: CSSProperties = {
  margin: "4px 0 8px",
  fontSize: "clamp(1.6rem, 2.5vw, 2.2rem)",
  lineHeight: 1.15,
  color: "#0f172a",
};

const introStyle: CSSProperties = {
  margin: 0,
  color: "#475569",
  lineHeight: 1.7,
};

const tabsStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  padding: 6,
  borderRadius: 999,
  background: "#f1f5f9",
};

const tabStyle: CSSProperties = {
  border: 0,
  borderRadius: 999,
  padding: "10px 14px",
  background: "transparent",
  color: "#475569",
  fontWeight: 800,
  cursor: "pointer",
};

const activeTabStyle: CSSProperties = {
  ...tabStyle,
  background: "#0f172a",
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

const referencesHintStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  padding: "14px 16px",
  borderRadius: 16,
  background: "#f8fafc",
  color: "#475569",
  fontSize: 14,
};

const referencesLinkStyle: CSSProperties = {
  color: "#486b7a",
  fontWeight: 800,
  whiteSpace: "nowrap",
  textDecoration: "none",
};
