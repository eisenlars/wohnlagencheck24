"use client";

import { useEffect, useMemo, useState } from "react";

import type { Offer, OfferMode, OfferObjectType } from "@/lib/angebote";
import { ImmobilienmarktBreadcrumb } from "@/features/immobilienmarkt/shared/ImmobilienmarktBreadcrumb";
import { slugifyOfferTitle } from "@/utils/slug";

type AngebotePageProps = {
  offersHeading?: string;
  offers: Offer[];
  topOffers: Offer[];
  mode: OfferMode;
  detailBasePath: string;
  totalWithTop?: number;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    basePath: string;
  };
  itemListJsonLd?: string;
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

export function AngebotePage(props: AngebotePageProps) {
  const {
    offersHeading,
    offers,
    topOffers,
    mode,
    detailBasePath,
    totalWithTop,
    pagination,
    itemListJsonLd,
    tabs,
    activeTabId,
    basePath,
    parentBasePath,
    ctx,
    names,
  } = props;
  const [filter, setFilter] = useState<"all" | OfferObjectType>("all");
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (topOffers.length <= 1) return;
    const id = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % topOffers.length);
    }, 5000);
    return () => window.clearInterval(id);
  }, [topOffers.length]);

  const filteredOffers = useMemo(() => {
    if (filter === "all") return offers;
    return offers.filter((offer) => offer.objectType === filter);
  }, [filter, offers]);

  const activeTopOffer = topOffers[activeIndex] ?? null;
  const priceLabel = mode === "miete" ? "Warmmiete" : "Kaufpreis";
  const priceSuffix = mode === "miete" ? "/Monat" : "";
  const buildDetailHref = (offer: Offer) =>
    `${detailBasePath}/${offer.id}_${slugifyOfferTitle(offer.title)}`;
  const totalPages = pagination
    ? Math.max(1, Math.ceil(pagination.total / pagination.pageSize))
    : 1;
  const kaufListPath = `${basePath}/immobilienangebote`;
  const mieteListPath = `${basePath}/mietangebote`;

  const headingCount = totalWithTop ?? pagination?.total;
  const headingWithCount =
    offersHeading && headingCount !== undefined
      ? `${headingCount} ${offersHeading}`
      : offersHeading;

  return (
    <div className="container text-dark">
      <div id="angebote-top" />
      <div className="breadcrumb-sticky mb-3">
        <ImmobilienmarktBreadcrumb
          tabs={tabs}
          activeTabId={activeTabId}
          basePath={basePath}
          parentBasePath={parentBasePath}
          ctx={ctx}
          names={names}
          compact
          rootIconSrc="/logo/wohnlagencheck24.svg"
        />
      </div>

      <div className="angebote-mode-toggle mb-5">
        <a
          className={`angebote-mode-btn ${mode === "kauf" ? "is-active" : ""}`}
          href={kaufListPath}
        >
          Kaufangebote
        </a>
        <a
          className={`angebote-mode-btn ${mode === "miete" ? "is-active" : ""}`}
          href={mieteListPath}
        >
          Mietangebote
        </a>
      </div>

      {headingWithCount ? (
        <div className="angebote-page-title">
          <h1 className="angebote-page-title-text">{headingWithCount}</h1>
        </div>
      ) : null}

      {topOffers.length > 0 && activeTopOffer ? (
        <section className="angebote-top mb-4">
          <div className="angebote-top-card">
            <div className="angebote-top-media">
              <a href={buildDetailHref(activeTopOffer)} className="angebote-media-link">
                {activeTopOffer.imageUrl ? (
                  <img
                    src={activeTopOffer.imageUrl}
                    alt={activeTopOffer.title}
                    loading="lazy"
                  />
                ) : (
                  <div className="angebote-top-placeholder">Kein Bild verfügbar</div>
                )}
              </a>
              <span className="angebote-image-label">Topobjekt</span>
              <div className="angebote-media-overlay" aria-hidden="true" />
            </div>
            <div className="angebote-top-body">
              <div className="angebote-pill-row">
                <span className="angebote-pill">{activeTopOffer.objectType}</span>
              </div>
              <h3 className="h5 mb-2">{activeTopOffer.title || "Objekt"}</h3>
              {activeTopOffer.address ? (
                <p className="angebote-address mb-3">{activeTopOffer.address}</p>
              ) : null}
              <div className="angebote-price-block">
                <div>
                  <span className="angebote-price-label">{priceLabel}</span>
                  <div className="angebote-price-value">
                    {formatCurrency(mode === "miete" ? activeTopOffer.rent : activeTopOffer.price)}
                    {priceSuffix ? <span className="angebote-price-suffix">{priceSuffix}</span> : null}
                  </div>
                </div>
              </div>
              <div className="angebote-facts">
                <div>
                  <span className="angebote-fact-label">Wohnfläche</span>
                  <strong className="angebote-fact-value">{formatArea(activeTopOffer.areaSqm)}</strong>
                </div>
                <div>
                  <span className="angebote-fact-label">Zimmer</span>
                  <strong className="angebote-fact-value">{formatRooms(activeTopOffer.rooms)}</strong>
                </div>
              </div>
              {activeTopOffer.detailUrl ? (
                <a
                  className="btn btn-dark btn-sm mt-3 angebote-top-cta"
                  href={buildDetailHref(activeTopOffer)}
                >
                  Zum Exposé
                </a>
              ) : null}
            </div>
          </div>
          <div className="angebote-top-controls-bar">
            <button
              type="button"
              className="angebote-slider-btn angebote-slider-btn--brand"
              onClick={() =>
                setActiveIndex(
                  (activeIndex - 1 + topOffers.length) % topOffers.length,
                )
              }
              aria-label="Vorheriges Topobjekt"
            >
              ‹
            </button>
            <button
              type="button"
              className="angebote-slider-btn angebote-slider-btn--brand"
              onClick={() => setActiveIndex((activeIndex + 1) % topOffers.length)}
              aria-label="Nächstes Topobjekt"
            >
              ›
            </button>
          </div>
        </section>
      ) : null}

      <section className="angebote-filter mb-4">
        <div className="angebote-filter-body" role="group" aria-label="Objektart filtern">
          <button
            type="button"
            className={`angebote-filter-btn ${filter === "all" ? "is-active" : ""}`}
            onClick={() => setFilter("all")}
          >
            Alle
          </button>
          <button
            type="button"
            className={`angebote-filter-btn ${filter === "haus" ? "is-active" : ""}`}
            onClick={() => setFilter("haus")}
          >
            Haus
          </button>
          <button
            type="button"
            className={`angebote-filter-btn ${filter === "wohnung" ? "is-active" : ""}`}
            onClick={() => setFilter("wohnung")}
          >
            Wohnung
          </button>
        </div>
      </section>

      <section className="angebote-list mb-5">
        {filteredOffers.length === 0 ? (
          <div className="alert alert-light border text-muted">
            Aktuell sind keine passenden Angebote verfügbar.
          </div>
        ) : (
          <div className="angebote-grid">
            {filteredOffers.map((offer) => (
              <article className="angebote-card" key={offer.id}>
                <div className="angebote-card-media">
                  <a href={buildDetailHref(offer)} className="angebote-media-link">
                    {offer.imageUrl ? (
                      <img src={offer.imageUrl} alt={offer.title} loading="lazy" />
                    ) : (
                      <div className="angebote-card-placeholder">Kein Bild</div>
                    )}
                  </a>
                  {offer.isTop ? (
                    <span className="angebote-pill angebote-pill--dark angebote-pill--floating">
                      Top
                    </span>
                  ) : null}
                </div>
                <div className="angebote-card-body">
                  <div className="angebote-card-meta">
                    <span className="angebote-pill">{offer.objectType}</span>
                    <span className="angebote-price">
                      {formatCurrency(mode === "miete" ? offer.rent : offer.price)}
                      {priceSuffix ? <span className="angebote-price-suffix">{priceSuffix}</span> : null}
                    </span>
                  </div>
                  <h3 className="h6 mb-2">{offer.title || "Objekt"}</h3>
                  {offer.address ? (
                    <p className="angebote-address mb-3">{offer.address}</p>
                  ) : null}
                  <div className="angebote-card-facts">
                    <span>{formatArea(offer.areaSqm)}</span>
                    <span>{formatRooms(offer.rooms)} Zimmer</span>
                  </div>
                  {offer.detailUrl ? (
                    <a
                      className="btn btn-outline-dark btn-sm angebote-card-cta"
                      href={buildDetailHref(offer)}
                    >
                      Zum Exposé
                    </a>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {pagination && totalPages > 1 ? (
        <nav className="angebote-pagination" aria-label="Seiten-Navigation">
          {pagination.page > 1 ? (
            <a
              className="angebote-page-btn"
              href={`${pagination.basePath}?page=${pagination.page - 1}#angebote-top`}
              aria-label="Vorherige Seite"
              rel="prev"
            >
              ‹
            </a>
          ) : null}
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((page) => {
              if (page === 1 || page === totalPages) return true;
              return Math.abs(page - pagination.page) <= 1;
            })
            .reduce<number[]>((acc, page) => {
              const last = acc[acc.length - 1];
              if (last && page - last > 1) {
                acc.push(-1);
              }
              acc.push(page);
              return acc;
            }, [])
            .map((page, index) =>
              page === -1 ? (
                <span key={`ellipsis-${index}`} className="angebote-page-ellipsis">
                  …
                </span>
              ) : (
                <a
                  key={`page-${page}`}
                  className={`angebote-page-btn${page === pagination.page ? " is-active" : ""}`}
                  href={`${pagination.basePath}?page=${page}#angebote-top`}
                  aria-current={page === pagination.page ? "page" : undefined}
                >
                  {page}
                </a>
              ),
            )}
          {pagination.page < totalPages ? (
            <a
              className="angebote-page-btn"
              href={`${pagination.basePath}?page=${pagination.page + 1}#angebote-top`}
              aria-label="Nächste Seite"
              rel="next"
            >
              ›
            </a>
          ) : null}
        </nav>
      ) : null}

      {itemListJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: itemListJsonLd }}
        />
      ) : null}
    </div>
  );
}
