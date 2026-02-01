import { ImmobilienmarktBreadcrumb } from "@/features/immobilienmarkt/shared/ImmobilienmarktBreadcrumb";
import type { Offer, OfferMode, OfferOverrides } from "@/lib/angebote";
import { asRecord } from "@/utils/records";

type OfferDetailPageProps = {
  offer: Offer;
  overrides?: OfferOverrides | null;
  mode: OfferMode;
  breadcrumb: {
    tabs: { id: string; label: string }[];
    activeTabId: string;
    basePath: string;
    parentBasePath?: string;
    ctx?: {
      bundeslandSlug?: string;
      kreisSlug?: string;
      ortSlug?: string;
    };
    names?: {
      regionName?: string;
      bundeslandName?: string;
      kreisName?: string;
    };
  };
  listPath: string;
};

const priceFormatter = new Intl.NumberFormat("de-DE");

function formatCurrency(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${priceFormatter.format(value)} €`;
}

function formatArea(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${priceFormatter.format(value)} m²`;
}

function formatRooms(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${priceFormatter.format(value)}`;
}

export function OfferDetailPage(props: OfferDetailPageProps) {
  const { offer, overrides, mode, breadcrumb, listPath } = props;
  const priceLabel = mode === "miete" ? "Warmmiete" : "Kaufpreis";
  const priceSuffix = mode === "miete" ? "/Monat" : "";
  const raw = asRecord(offer.raw) ?? {};
  const gallery = Array.isArray(raw["gallery"]) ? (raw["gallery"] as string[]) : [];
  const galleryImages =
    gallery.length > 0
      ? gallery
      : offer.imageUrl
        ? [offer.imageUrl]
        : [];
  const [heroImage, ...thumbImages] = galleryImages;
  const hasThumbs = thumbImages.length > 0;
  const floorplanUrl = typeof raw["floorplan_url"] === "string" ? raw["floorplan_url"] : null;
  const mapUrl = typeof raw["map_url"] === "string" ? raw["map_url"] : null;
  const features = Array.isArray(raw["features"]) ? (raw["features"] as string[]) : [];
  const energy = asRecord(raw["energy"]) ?? {};

  const title = overrides?.seo_h1 || offer.title || "Immobilienangebot";
  const description =
    overrides?.long_description ??
    (typeof raw["description"] === "string" ? raw["description"] : null);
  const locationText =
    overrides?.location_text ??
    (typeof raw["location"] === "string" ? raw["location"] : null);
  const featuresText =
    overrides?.features_text ??
    (typeof raw["features_note"] === "string" ? raw["features_note"] : null);
  const highlights =
    overrides?.highlights ?? (Array.isArray(raw["highlights"]) ? (raw["highlights"] as string[]) : []);
  const imageAltTexts = overrides?.image_alt_texts ?? [];

  return (
    <div className="container text-dark">
      <div className="breadcrumb-sticky mb-3">
        <ImmobilienmarktBreadcrumb
          tabs={breadcrumb.tabs}
          activeTabId={breadcrumb.activeTabId}
          basePath={breadcrumb.basePath}
          parentBasePath={breadcrumb.parentBasePath}
          ctx={breadcrumb.ctx}
          names={breadcrumb.names}
          compact
          rootIconSrc="/logo/wohnlagencheck24.svg"
        />
      </div>

      <section className="offer-detail-hero">
        <div className="offer-detail-hero-main">
          <span className="offer-detail-chip">{offer.objectType}</span>
          <h1 className="offer-detail-title">{title}</h1>
          {offer.address ? <p className="offer-detail-address">{offer.address}</p> : null}
          <div className="offer-detail-keyfacts">
            <div>
              <span className="offer-detail-label">{priceLabel}</span>
              <div className="offer-detail-price">
                {formatCurrency(mode === "miete" ? offer.rent : offer.price)}
                {priceSuffix ? <span className="offer-detail-suffix">{priceSuffix}</span> : null}
              </div>
            </div>
            <div>
              <span className="offer-detail-label">Wohnfläche</span>
              <strong>{formatArea(offer.areaSqm)}</strong>
            </div>
            <div>
              <span className="offer-detail-label">Zimmer</span>
              <strong>{formatRooms(offer.rooms)}</strong>
            </div>
          </div>
        </div>
        <aside className="offer-detail-cta">
          <div className="offer-detail-cta-card">
            <h2 className="h6 mb-2">Interesse an diesem Objekt?</h2>
            <p className="small text-muted mb-3">
              Das Exposé wird exklusiv vom Partner bereitgestellt.
            </p>
            {offer.detailUrl ? (
              <a
                className="btn btn-dark w-100"
                href={offer.detailUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Zum Partner‑Exposé
              </a>
            ) : (
              <span className="text-muted small">Kein Exposé-Link verfügbar.</span>
            )}
            <a className="btn btn-outline-dark w-100 mt-2" href={listPath}>
              Zurück zur Übersicht
            </a>
          </div>
        </aside>
      </section>

      <section className="offer-detail-gallery">
        <h2 className="h5 mb-3">Bildergalerie</h2>
        {heroImage ? (
          <div className={`offer-detail-gallery-layout${hasThumbs ? "" : " is-single"}`}>
            <div className="offer-detail-gallery-hero">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={heroImage}
                alt={imageAltTexts[0] ?? `${title} Titelbild`}
                loading="lazy"
              />
            </div>
            {hasThumbs ? (
              <div className="offer-detail-gallery-thumbs">
                {thumbImages.map((src, index) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={`${src}-${index}`}
                    src={src}
                    alt={imageAltTexts[index + 1] ?? `${title} Bild ${index + 2}`}
                    loading="lazy"
                  />
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="offer-detail-placeholder">Keine Bilder verfügbar.</div>
        )}
      </section>

      {description ? (
        <section className="offer-detail-panel" style={{ marginBottom: "2rem" }}>
          <h2 className="h5 mb-3">Objektbeschreibung</h2>
          <p className="mb-0">{description}</p>
        </section>
      ) : null}

      {locationText ? (
        <section className="offer-detail-panel" style={{ marginBottom: "2rem" }}>
          <h2 className="h5 mb-3">Lage</h2>
          <p className="mb-0">{locationText}</p>
        </section>
      ) : null}

      {highlights.length > 0 ? (
        <section className="offer-detail-panel" style={{ marginBottom: "2rem" }}>
          <h2 className="h5 mb-3">Highlights</h2>
          <ul className="offer-detail-list">
            {highlights.map((item, index) => (
              <li key={`${item}-${index}`}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="offer-detail-grid">
        <div className="offer-detail-panel">
          <h3 className="h6 mb-3">Grundriss</h3>
          {floorplanUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={floorplanUrl} alt="Grundriss" />
          ) : (
            <div className="offer-detail-placeholder">Grundriss folgt</div>
          )}
        </div>

        <div className="offer-detail-panel">
          <h3 className="h6 mb-3">Lagekarte</h3>
          {mapUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mapUrl} alt="Lagekarte" />
          ) : (
            <div className="offer-detail-placeholder">Lagekarte folgt</div>
          )}
        </div>
      </section>

      <section className="offer-detail-grid">
        <div className="offer-detail-panel">
          <h3 className="h6 mb-3">Ausstattung</h3>
          {featuresText ? (
            <p className="small text-muted mb-0">{featuresText}</p>
          ) : features.length > 0 ? (
            <ul className="offer-detail-list">
              {features.map((item, index) => (
                <li key={`${item}-${index}`}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="small text-muted mb-0">Ausstattungsdetails werden ergänzt.</p>
          )}
        </div>

        <div className="offer-detail-panel">
          <h3 className="h6 mb-3">Energie</h3>
          <dl className="offer-detail-energy">
            <div>
              <dt>Energieklasse</dt>
              <dd>{String(energy["class"] ?? "—")}</dd>
            </div>
            <div>
              <dt>Endenergiebedarf</dt>
              <dd>{String(energy["demand"] ?? "—")}</dd>
            </div>
            <div>
              <dt>Wesentlicher Energieträger</dt>
              <dd>{String(energy["fuel"] ?? "—")}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="offer-detail-contact">
        <div className="offer-detail-contact-card">
          <div>
            <h3 className="h6 mb-2">Kontakt &amp; Anfrage</h3>
            <p className="small text-muted mb-0">
              Für eine Besichtigung oder weitere Informationen kontaktieren Sie bitte den Anbieter.
            </p>
          </div>
          {offer.detailUrl ? (
            <a
              className="btn btn-dark"
              href={offer.detailUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Jetzt Anfrage stellen
            </a>
          ) : null}
        </div>
      </section>
    </div>
  );
}
