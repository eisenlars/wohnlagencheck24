import type { CSSProperties } from "react";

import type { PublicNetworkContentItem } from "@/lib/network-partners/types";

type PublicPropertyRequestsSectionProps = {
  items: PublicNetworkContentItem[];
  locale?: string | null;
};

function cardStyle(): CSSProperties {
  return {
    border: "1px solid rgba(15, 23, 42, 0.08)",
    borderRadius: 20,
    padding: 24,
    background: "#ffffff",
    boxShadow: "0 14px 36px rgba(15, 23, 42, 0.06)",
    height: "100%",
  };
}

function buttonStyle(): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 40,
    padding: "0 16px",
    borderRadius: 999,
    background: "#1d4f3c",
    color: "#ffffff",
    textDecoration: "none",
    fontWeight: 700,
  };
}

function copy(locale: string | null | undefined) {
  const normalized = String(locale ?? "de").toLowerCase();
  if (normalized.startsWith("de")) {
    return {
      eyebrow: "Immobiliengesuche",
      title: "Aktuelle Suchprofile aus dem regionalen Netzwerk",
      fallbackCta: "Kontakt aufnehmen",
      budgetLabel: "Budget",
      areaLabel: "Fläche",
      regionLabel: "Suchregion",
    };
  }
  return {
    eyebrow: "Property requests",
    title: "Current search profiles from the regional network",
    fallbackCta: "Get in touch",
    budgetLabel: "Budget",
    areaLabel: "Area",
    regionLabel: "Search region",
  };
}

function formatRange(min: number | null, max: number | null, suffix = ""): string | null {
  if (min === null && max === null) return null;
  if (min !== null && max !== null) return `${min} – ${max}${suffix}`;
  if (min !== null) return `ab ${min}${suffix}`;
  return `bis ${max}${suffix}`;
}

export function PublicPropertyRequestsSection({
  items,
  locale = null,
}: PublicPropertyRequestsSectionProps) {
  if (items.length === 0) return null;
  const text = copy(locale);

  return (
    <section className="py-5 bg-light border-top">
      <div className="container">
        <div className="mb-4">
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "6px 10px",
              borderRadius: 999,
              background: "rgba(15, 23, 42, 0.06)",
              color: "#0f172a",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 0.3,
              textTransform: "uppercase",
            }}
          >
            {text.eyebrow}
          </div>
          <h2 className="h3 mt-3 mb-0">{text.title}</h2>
        </div>

        <div className="row g-4">
          {items.map((item) => {
            const request = item.property_request;
            const budgetText = formatRange(request?.budget_min ?? null, request?.budget_max ?? null, " EUR");
            const areaText = formatRange(request?.area_min ?? null, request?.area_max ?? null, " m²");
            return (
              <div key={item.id} className="col-12 col-lg-6">
                <article style={cardStyle()}>
                  <p className="small text-muted mb-1">{item.network_partner_name ?? "—"}</p>
                  <h3 className="h5 mb-2">{item.title}</h3>
                  {item.summary ? <p className="text-muted mb-3">{item.summary}</p> : null}

                  <div className="d-flex flex-wrap gap-3 small text-muted mb-3">
                    {request?.search_region ? <span>{text.regionLabel}: {request.search_region}</span> : null}
                    {budgetText ? <span>{text.budgetLabel}: {budgetText}</span> : null}
                    {areaText ? <span>{text.areaLabel}: {areaText}</span> : null}
                  </div>

                  {item.cta_url ? (
                    <a href={item.cta_url} style={buttonStyle()} target="_blank" rel="noreferrer">
                      {item.cta_label ?? text.fallbackCta}
                    </a>
                  ) : null}
                </article>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
