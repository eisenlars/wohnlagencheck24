import Image from "next/image";
import type { CSSProperties } from "react";

import type { PublicNetworkContentItem } from "@/lib/network-partners/types";

type PublicCompanyProfilesSectionProps = {
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

function imageStyle(): CSSProperties {
  return {
    width: 56,
    height: 56,
    borderRadius: 14,
    objectFit: "cover",
    border: "1px solid rgba(15, 23, 42, 0.08)",
    background: "#f8fafc",
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
      eyebrow: "Regionale Netzwerkpartner",
      title: "Unternehmen aus dem regionalen Immobiliennetzwerk",
      fallbackCta: "Mehr erfahren",
      providerLabel: "Anbieter",
      sectorLabel: "Bereich",
      regionLabel: "Leistungsregion",
    };
  }
  return {
    eyebrow: "Regional network partners",
    title: "Businesses from the regional real-estate network",
    fallbackCta: "Learn more",
    providerLabel: "Provider",
    sectorLabel: "Sector",
    regionLabel: "Service region",
  };
}

function findPreferredImage(item: PublicNetworkContentItem): string | null {
  return (
    item.media.find((media) => media.kind === "logo")?.url
    ?? item.media.find((media) => media.kind === "hero")?.url
    ?? item.media[0]?.url
    ?? null
  );
}

export function PublicCompanyProfilesSection({
  items,
  locale = null,
}: PublicCompanyProfilesSectionProps) {
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
            const imageSrc = findPreferredImage(item);
            const profile = item.company_profile;
            return (
              <div key={item.id} className="col-12 col-lg-6">
                <article style={cardStyle()}>
                  <div className="d-flex gap-3 align-items-start">
                    {imageSrc ? (
                      <Image
                        src={imageSrc}
                        alt={item.title}
                        width={56}
                        height={56}
                        style={imageStyle()}
                      />
                    ) : null}
                    <div className="flex-grow-1">
                      <p className="small text-muted mb-1">{text.providerLabel}: {item.network_partner_name ?? "—"}</p>
                      <h3 className="h5 mb-2">{item.title}</h3>
                      {item.summary ? <p className="text-muted mb-3">{item.summary}</p> : null}
                    </div>
                  </div>

                  <div className="d-flex flex-wrap gap-3 small text-muted mb-3 mt-3">
                    {profile?.industry_type ? <span>{text.sectorLabel}: {profile.industry_type}</span> : null}
                    {profile?.service_region ? <span>{text.regionLabel}: {profile.service_region}</span> : null}
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
