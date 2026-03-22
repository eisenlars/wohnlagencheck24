'use client';

import { useMemo, useState } from "react";
import { ImmobilienmarktBreadcrumb } from "@/features/immobilienmarkt/shared/ImmobilienmarktBreadcrumb";
import type { Offer, OfferMode, OfferOverrides } from "@/lib/angebote";
import type { PortalFormatProfile } from "@/lib/portal-format-config";
import type { PortalSystemTextMap } from "@/lib/portal-system-text-definitions";
import { formatMetric } from "@/utils/format";
import { asRecord } from "@/utils/records";

type MediaAssetKind = "image" | "floorplan" | "location_map" | "document";

type MediaAsset = {
  url: string;
  title: string | null;
  position: number | null;
  kind: MediaAssetKind;
};

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

function asText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseMediaAssets(value: unknown): MediaAsset[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const record = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : null;
      if (!record) return null;
      const url = asText(record.url);
      if (!url) return null;
      const normalizedKind = String(record.kind ?? "").trim().toLowerCase();
      const kind: MediaAssetKind = normalizedKind === "floorplan"
        ? "floorplan"
        : normalizedKind === "location_map"
          ? "location_map"
          : normalizedKind === "document"
            ? "document"
            : "image";
      return {
        url,
        title: asText(record.title),
        position: asNumber(record.position),
        kind,
      } satisfies MediaAsset;
    })
    .filter((entry): entry is MediaAsset => Boolean(entry))
    .sort((left, right) => {
      if (left.position == null && right.position == null) return left.url.localeCompare(right.url);
      if (left.position == null) return 1;
      if (right.position == null) return -1;
      return left.position - right.position;
    });
}

function uniqByUrl(items: MediaAsset[]): MediaAsset[] {
  const seen = new Set<string>();
  const out: MediaAsset[] = [];
  for (const item of items) {
    if (seen.has(item.url)) continue;
    seen.add(item.url);
    out.push(item);
  }
  return out;
}

export function OfferDetailPage(props: OfferDetailPageProps) {
  const { offer, mode, texts, formatProfile, breadcrumb, listPath } = props;
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
  const raw = useMemo(() => asRecord(offer.raw) ?? {}, [offer.raw]);
  const gallery = useMemo(
    () => (Array.isArray(raw["gallery"]) ? (raw["gallery"] as string[]) : []),
    [raw],
  );
  const galleryAssets = useMemo(() => parseMediaAssets(raw["gallery_assets"]), [raw]);
  const fallbackPhotoAssets = useMemo(
    () =>
      gallery.length > 0
        ? gallery.map((url, index) => ({
            url,
            title: null,
            position: index + 1,
            kind: "image" as const,
          }))
        : offer.imageUrl
          ? [{ url: offer.imageUrl, title: null, position: 1, kind: "image" as const }]
          : [],
    [gallery, offer.imageUrl],
  );
  const photoAssets = useMemo(() => {
    const explicitPhotos = galleryAssets.filter((asset) => asset.kind === "image");
    return uniqByUrl(explicitPhotos.length > 0 ? explicitPhotos : fallbackPhotoAssets);
  }, [fallbackPhotoAssets, galleryAssets]);
  const floorplanAssets = useMemo(() => {
    const explicit = galleryAssets.filter((asset) => asset.kind === "floorplan");
    const legacyFloorplanUrl = asText(raw["floorplan_url"]);
    const legacy = legacyFloorplanUrl
      ? [{ url: legacyFloorplanUrl, title: texts.floor_plan, position: null, kind: "floorplan" as const }]
      : [];
    return uniqByUrl([...explicit, ...legacy]);
  }, [galleryAssets, raw, texts.floor_plan]);
  const locationMapAssets = useMemo(() => {
    const explicit = galleryAssets.filter((asset) => asset.kind === "location_map");
    const legacyMapUrl = asText(raw["map_url"]);
    const legacy = legacyMapUrl
      ? [{ url: legacyMapUrl, title: texts.location_map, position: null, kind: "location_map" as const }]
      : [];
    return uniqByUrl([...explicit, ...legacy]);
  }, [galleryAssets, raw, texts.location_map]);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [activeFloorplanIndex, setActiveFloorplanIndex] = useState(0);
  const [activeLocationMapIndex, setActiveLocationMapIndex] = useState(0);
  const resolvedPhotoIndex = activePhotoIndex < photoAssets.length ? activePhotoIndex : 0;
  const resolvedFloorplanIndex = activeFloorplanIndex < floorplanAssets.length ? activeFloorplanIndex : 0;
  const resolvedLocationMapIndex =
    activeLocationMapIndex < locationMapAssets.length ? activeLocationMapIndex : 0;
  const activePhoto = photoAssets[resolvedPhotoIndex] ?? null;
  const activeFloorplan = floorplanAssets[resolvedFloorplanIndex] ?? null;
  const activeLocationMap = locationMapAssets[resolvedLocationMapIndex] ?? null;
  const features = Array.isArray(raw["features"]) ? (raw["features"] as string[]) : [];
  const energy = asRecord(raw["energy"]) ?? {};

  const title = offer.seoH1 || offer.title || texts.object_generic;
  const teaserText = offer.shortDescription || null;
  const description =
    offer.longDescription ??
    (typeof raw["description"] === "string" ? raw["description"] : null);
  const locationText =
    offer.locationText ??
    (typeof raw["location"] === "string" ? raw["location"] : null);
  const featuresText =
    offer.featuresText ??
    (typeof raw["features_note"] === "string" ? raw["features_note"] : null);
  const highlights =
    offer.highlights ?? (Array.isArray(raw["highlights"]) ? (raw["highlights"] as string[]) : []);
  const imageAltTexts = offer.imageAltTexts ?? [];

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
        {activePhoto ? (
          <div className="offer-detail-slideshow">
            <div className="offer-detail-slideshow-stage">
              <button
                type="button"
                className="offer-detail-slideshow-nav"
                onClick={() => setActivePhotoIndex((current) => (current <= 0 ? photoAssets.length - 1 : current - 1))}
                aria-label="Vorheriges Bild anzeigen"
              >
                ‹
              </button>
              <div className="offer-detail-gallery-hero">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  key={activePhoto.url}
                  src={activePhoto.url}
                  alt={imageAltTexts[resolvedPhotoIndex] ?? activePhoto.title ?? `${title} Bild ${resolvedPhotoIndex + 1}`}
                  loading="eager"
                  decoding="async"
                />
              </div>
              <button
                type="button"
                className="offer-detail-slideshow-nav"
                onClick={() => setActivePhotoIndex((current) => (current >= photoAssets.length - 1 ? 0 : current + 1))}
                aria-label="Nächstes Bild anzeigen"
              >
                ›
              </button>
            </div>
            <div className="offer-detail-slideshow-meta">
                <div className="offer-detail-slideshow-caption">
                  {activePhoto.title ?? `${title} Bild ${resolvedPhotoIndex + 1}`}
                </div>
                <div className="offer-detail-slideshow-counter">
                  {resolvedPhotoIndex + 1} / {photoAssets.length}
                </div>
              </div>
              {photoAssets.length > 1 ? (
                <div className="offer-detail-gallery-thumbs">
                  {photoAssets.map((asset, index) => (
                    <button
                      key={`${asset.url}-${index}`}
                      type="button"
                      className={`offer-detail-gallery-thumb${index === resolvedPhotoIndex ? " is-active" : ""}`}
                      onClick={() => setActivePhotoIndex(index)}
                      aria-label={`Bild ${index + 1} anzeigen`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={asset.url}
                        alt={imageAltTexts[index] ?? asset.title ?? `${title} Bild ${index + 1}`}
                        loading="lazy"
                        decoding="async"
                      />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="offer-detail-placeholder">{texts.no_images_available}</div>
        )}
      </section>

      {teaserText ? (
        <section className="offer-detail-panel" style={{ marginBottom: "2rem" }}>
          <h2 className="h5 mb-3">Teaser</h2>
          <p className="mb-0">{teaserText}</p>
        </section>
      ) : null}

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

      {featuresText ? (
        <section className="offer-detail-panel" style={{ marginBottom: "2rem" }}>
          <h2 className="h5 mb-3">{texts.features_label}</h2>
          <p className="mb-0">{featuresText}</p>
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
          {activeFloorplan ? (
            <div className="offer-detail-panel-media">
              <div className="offer-detail-panel-media-frame is-floorplan">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  key={activeFloorplan.url}
                  src={activeFloorplan.url}
                  alt={activeFloorplan.title ?? texts.floor_plan}
                  loading="lazy"
                  decoding="async"
                />
              </div>
              {floorplanAssets.length > 1 ? (
                <div className="offer-detail-panel-thumbs">
                  {floorplanAssets.map((asset, index) => (
                    <button
                      key={`${asset.url}-${index}`}
                      type="button"
                      className={`offer-detail-panel-thumb${index === resolvedFloorplanIndex ? " is-active" : ""}`}
                      onClick={() => setActiveFloorplanIndex(index)}
                      aria-label={`Grundriss ${index + 1} anzeigen`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={asset.url}
                        alt={asset.title ?? `${texts.floor_plan} ${index + 1}`}
                        loading="lazy"
                        decoding="async"
                      />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="offer-detail-placeholder">{texts.floor_plan_pending}</div>
          )}
        </div>

        <div className="offer-detail-panel">
          <h3 className="h6 mb-3">{texts.location_map}</h3>
          {activeLocationMap ? (
            <div className="offer-detail-panel-media">
              <div className="offer-detail-panel-media-frame">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  key={activeLocationMap.url}
                  src={activeLocationMap.url}
                  alt={activeLocationMap.title ?? texts.location_map}
                  loading="lazy"
                  decoding="async"
                />
              </div>
              {locationMapAssets.length > 1 ? (
                <div className="offer-detail-panel-thumbs">
                  {locationMapAssets.map((asset, index) => (
                    <button
                      key={`${asset.url}-${index}`}
                      type="button"
                      className={`offer-detail-panel-thumb${index === resolvedLocationMapIndex ? " is-active" : ""}`}
                      onClick={() => setActiveLocationMapIndex(index)}
                      aria-label={`Lagegrafik ${index + 1} anzeigen`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={asset.url}
                        alt={asset.title ?? `${texts.location_map} ${index + 1}`}
                        loading="lazy"
                        decoding="async"
                      />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="offer-detail-placeholder">{texts.location_map_pending}</div>
          )}
        </div>
      </section>

      <section className="offer-detail-grid">
        <div className="offer-detail-panel">
          <h3 className="h6 mb-3">{texts.features_label}</h3>
          {features.length > 0 ? (
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
