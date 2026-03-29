import Image from "next/image";
import type { CSSProperties } from "react";

import type { PublicNetworkContentItem } from "@/lib/network-partners/types";

type PublicPropertyOffersSectionProps = {
  items: PublicNetworkContentItem[];
  locale?: string | null;
};

function cardStyle(): CSSProperties {
  return {
    border: "1px solid rgba(15, 23, 42, 0.08)",
    borderRadius: 20,
    overflow: "hidden",
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
    background: "#0f172a",
    color: "#ffffff",
    textDecoration: "none",
    fontWeight: 700,
  };
}

function copy(locale: string | null | undefined) {
  const normalized = String(locale ?? "de").toLowerCase();
  if (normalized.startsWith("de")) {
    return {
      eyebrow: "Immobilienangebote",
      title: "Aktuelle Angebote aus dem regionalen Netzwerk",
      fallbackCta: "Zum Angebot",
      priceLabel: "Preis",
      areaLabel: "Wohnfläche",
      roomsLabel: "Zimmer",
      placeLabel: "Lage",
    };
  }
  return {
    eyebrow: "Property offers",
    title: "Current offers from the regional network",
    fallbackCta: "View offer",
    priceLabel: "Price",
    areaLabel: "Living area",
    roomsLabel: "Rooms",
    placeLabel: "Location",
  };
}

function formatCurrency(value: number | null): string | null {
  if (value === null || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}

function findPreferredImage(item: PublicNetworkContentItem): string | null {
  return (
    item.media.find((media) => media.kind === "hero")?.url
    ?? item.media.find((media) => media.kind === "gallery")?.url
    ?? item.media[0]?.url
    ?? null
  );
}

export function PublicPropertyOffersSection({
  items,
  locale = null,
}: PublicPropertyOffersSectionProps) {
  if (items.length === 0) return null;
  const text = copy(locale);

  return (
    <section className="py-5 border-top">
      <div className="container">
        <div className="mb-4">
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "6px 10px",
              borderRadius: 999,
              background: "rgba(29, 79, 60, 0.08)",
              color: "#1d4f3c",
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
            const imageSrc = findPreferredImage(item);
            const offer = item.property_offer;
            return (
              <div key={item.id} className="col-12 col-xl-4 col-md-6">
                <article style={cardStyle()}>
                  {imageSrc ? (
                    <div style={{ aspectRatio: "16 / 10", background: "#e2e8f0" }}>
                      <Image
                        src={imageSrc}
                        alt={item.title}
                        width={800}
                        height={500}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    </div>
                  ) : null}
                  <div style={{ padding: 22, display: "grid", gap: 12 }}>
                    <div>
                      <p className="small text-muted mb-1">{item.network_partner_name ?? "—"}</p>
                      <h3 className="h5 mb-2">{item.title}</h3>
                      {item.summary ? <p className="text-muted mb-0">{item.summary}</p> : null}
                    </div>

                    <div className="d-flex flex-wrap gap-3 small text-muted">
                      {formatCurrency(offer?.price ?? null) ? <span>{text.priceLabel}: {formatCurrency(offer?.price ?? null)}</span> : null}
                      {offer?.living_area ? <span>{text.areaLabel}: {offer.living_area} m²</span> : null}
                      {offer?.rooms ? <span>{text.roomsLabel}: {offer.rooms}</span> : null}
                      {offer?.location_label ? <span>{text.placeLabel}: {offer.location_label}</span> : null}
                    </div>

                    {item.cta_url ? (
                      <a href={item.cta_url} style={buttonStyle()} target="_blank" rel="noreferrer">
                        {item.cta_label ?? text.fallbackCta}
                      </a>
                    ) : null}
                  </div>
                </article>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
