import { ImmobilienmarktBreadcrumb } from "@/features/immobilienmarkt/shared/ImmobilienmarktBreadcrumb";
import type { Offer, OfferMode, OfferOverrides } from "@/lib/angebote";
import type { PortalFormatProfile } from "@/lib/portal-format-config";
import type { PortalSystemTextMap } from "@/lib/portal-system-text-definitions";
import { formatMetric } from "@/utils/format";
import { asRecord } from "@/utils/records";

type OfferDetailPageProps = {
  offer: Offer;
  overrides?: OfferOverrides | null;
  mode: OfferMode;
  texts: PortalSystemTextMap;
  formatProfile: PortalFormatProfile;
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

export function OfferDetailPage(props: OfferDetailPageProps) {
  const { offer, overrides, mode, texts, formatProfile, breadcrumb, listPath } = props;
  const priceLabel = mode === "miete" ? texts.warm_rent : texts.purchase_price;
  const priceSuffix = mode === "miete" ? texts.per_month : "";
  const formatCurrency = (value: number | null) => formatMetric(value, {
    kind: "currency",
    ctx: "kpi",
    unit: "eur",
    locale: formatProfile.locale,
    numberLocale: formatProfile.intlLocale,
    currencyCode: formatProfile.currencyCode,
    fractionDigits: 0,
  });
  const formatArea = (value: number | null) => formatMetric(value, {
    kind: "flaeche",
    ctx: "kpi",
    unit: "none",
    locale: formatProfile.locale,
    numberLocale: formatProfile.intlLocale,
    fractionDigits: 0,
  });
  const formatRooms = (value: number | null) => formatMetric(value, {
    kind: "anzahl",
    ctx: "kpi",
    unit: "none",
    locale: formatProfile.locale,
    numberLocale: formatProfile.intlLocale,
    fractionDigits: 0,
  });
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

  const title = overrides?.seo_h1 || offer.title || texts.object_generic;
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
          texts={texts}
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
              <span className="offer-detail-label">{texts.living_area}</span>
              <strong>{`${formatArea(offer.areaSqm)} m²`}</strong>
            </div>
            <div>
              <span className="offer-detail-label">{texts.rooms}</span>
              <strong>{formatRooms(offer.rooms)}</strong>
            </div>
          </div>
        </div>
        <aside className="offer-detail-cta">
          <div className="offer-detail-cta-card">
            <h2 className="h6 mb-2">{texts.interested_in_property}</h2>
            <p className="small text-muted mb-3">
              {texts.partner_expose_provided}
            </p>
            {offer.detailUrl ? (
              <a
                className="btn btn-dark w-100"
                href={offer.detailUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {texts.to_partner_expose}
              </a>
            ) : (
              <span className="text-muted small">{texts.no_expose_link_available}</span>
            )}
            <a className="btn btn-outline-dark w-100 mt-2" href={listPath}>
              {texts.back_to_overview}
            </a>
          </div>
        </aside>
      </section>

      <section className="offer-detail-gallery">
        <h2 className="h5 mb-3">{texts.image_gallery}</h2>
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
          <div className="offer-detail-placeholder">{texts.no_images_available}</div>
        )}
      </section>

      {description ? (
        <section className="offer-detail-panel" style={{ marginBottom: "2rem" }}>
          <h2 className="h5 mb-3">{texts.property_description}</h2>
          <p className="mb-0">{description}</p>
        </section>
      ) : null}

      {locationText ? (
        <section className="offer-detail-panel" style={{ marginBottom: "2rem" }}>
          <h2 className="h5 mb-3">{texts.location_label}</h2>
          <p className="mb-0">{locationText}</p>
        </section>
      ) : null}

      {highlights.length > 0 ? (
        <section className="offer-detail-panel" style={{ marginBottom: "2rem" }}>
          <h2 className="h5 mb-3">{texts.highlights_label}</h2>
          <ul className="offer-detail-list">
            {highlights.map((item, index) => (
              <li key={`${item}-${index}`}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="offer-detail-grid">
        <div className="offer-detail-panel">
          <h3 className="h6 mb-3">{texts.floor_plan}</h3>
          {floorplanUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={floorplanUrl} alt={texts.floor_plan} />
          ) : (
            <div className="offer-detail-placeholder">{texts.floor_plan_pending}</div>
          )}
        </div>

        <div className="offer-detail-panel">
          <h3 className="h6 mb-3">{texts.location_map}</h3>
          {mapUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mapUrl} alt={texts.location_map} />
          ) : (
            <div className="offer-detail-placeholder">{texts.location_map_pending}</div>
          )}
        </div>
      </section>

      <section className="offer-detail-grid">
        <div className="offer-detail-panel">
          <h3 className="h6 mb-3">{texts.features_label}</h3>
          {featuresText ? (
            <p className="small text-muted mb-0">{featuresText}</p>
          ) : features.length > 0 ? (
            <ul className="offer-detail-list">
              {features.map((item, index) => (
                <li key={`${item}-${index}`}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="small text-muted mb-0">{texts.features_details_pending}</p>
          )}
        </div>

        <div className="offer-detail-panel">
          <h3 className="h6 mb-3">{texts.energy_label}</h3>
          <dl className="offer-detail-energy">
            <div>
              <dt>{texts.energy_class}</dt>
              <dd>{String(energy["class"] ?? "—")}</dd>
            </div>
            <div>
              <dt>{texts.energy_demand}</dt>
              <dd>{String(energy["demand"] ?? "—")}</dd>
            </div>
            <div>
              <dt>{texts.primary_energy_source}</dt>
              <dd>{String(energy["fuel"] ?? "—")}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="offer-detail-contact">
        <div className="offer-detail-contact-card">
          <div>
            <h3 className="h6 mb-2">{texts.contact_request}</h3>
            <p className="small text-muted mb-0">
              {texts.contact_request_hint}
            </p>
          </div>
          {offer.detailUrl ? (
            <a
              className="btn btn-dark"
              href={offer.detailUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {texts.request_now}
            </a>
          ) : null}
        </div>
      </section>
    </div>
  );
}
