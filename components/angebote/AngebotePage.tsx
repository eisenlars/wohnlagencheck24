"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

import type { Offer, OfferMode, OfferObjectType } from "@/lib/angebote";
import { ImmobilienmarktBreadcrumb } from "@/features/immobilienmarkt/shared/ImmobilienmarktBreadcrumb";
import type { PortalSystemTextMap } from "@/lib/portal-system-text-definitions";
import { normalizePublicLocale } from "@/lib/public-locale-routing";
import { slugifyOfferTitle } from "@/utils/slug";

type AngebotePageProps = {
  offersHeading?: string;
  offers: Offer[];
  topOffers: Offer[];
  mode: OfferMode;
  detailBasePath?: string | null;
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
  texts: PortalSystemTextMap;
  locale?: string;
  availabilityNotice?: {
    title: string;
    body: string;
    ctaHref: string;
    ctaLabel: string;
  } | null;
};
const passthroughLoader = ({ src }: { src: string }) => src;

function sanitizeImageUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const compact = value.replace(/\s+/g, "").trim();
  if (!compact) return null;
  try {
    const parsed = new URL(compact);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
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
    texts,
    locale,
    availabilityNotice,
  } = props;
  const [filter, setFilter] = useState<"all" | OfferObjectType>("all");
  const [activeIndex, setActiveIndex] = useState(0);
  const normalizedLocale = normalizePublicLocale(locale);

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

  function formatCurrency(value: number | null): string {
    if (value === null || !Number.isFinite(value)) return "—";
    return `${new Intl.NumberFormat(normalizedLocale === "en" ? "en-US" : "de-DE").format(value)} €`;
  }

  function formatArea(value: number | null): string {
    if (value === null || !Number.isFinite(value)) return "—";
    return `${new Intl.NumberFormat(normalizedLocale === "en" ? "en-US" : "de-DE").format(value)} m²`;
  }

  function formatRooms(value: number | null): string {
    if (value === null || !Number.isFinite(value)) return "—";
    return `${new Intl.NumberFormat(normalizedLocale === "en" ? "en-US" : "de-DE").format(value)}`;
  }

  function formatObjectType(value: OfferObjectType | string): string {
    if (value === "haus") return texts.house;
    if (value === "wohnung") return texts.apartment;
    return value || texts.object_generic;
  }

  const activeTopOffer = topOffers[activeIndex] ?? null;
  const buildDetailHref = (offer: Offer) =>
    detailBasePath ? `${detailBasePath}/${offer.id}_${slugifyOfferTitle(offer.title)}` : null;
  const activeTopImageUrl = sanitizeImageUrl(activeTopOffer?.imageUrl ?? null);
  const activeTopDetailHref = activeTopOffer ? buildDetailHref(activeTopOffer) : null;
  const priceLabel = mode === "miete" ? texts.warm_rent : texts.purchase_price;
  const priceSuffix = mode === "miete" ? texts.per_month : "";
  const totalPages = pagination
    ? Math.max(1, Math.ceil(pagination.total / pagination.pageSize))
    : 1;
  const kaufListPath = `${basePath}/immobilienangebote`;
  const mieteListPath = `${basePath}/mietangebote`;

  const headingCount = totalWithTop ?? pagination?.total;
  const headingWithCount =
    availabilityNotice
      ? offersHeading
      : offersHeading && headingCount !== undefined
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
          locale={normalizedLocale}
        />
      </div>

      <div className="angebote-mode-toggle mb-5">
        <a
          className={`angebote-mode-btn ${mode === "kauf" ? "is-active" : ""}`}
          href={kaufListPath}
        >
          {texts.buy_offers}
        </a>
        <a
          className={`angebote-mode-btn ${mode === "miete" ? "is-active" : ""}`}
          href={mieteListPath}
        >
          {texts.rent_offers}
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
              {activeTopDetailHref ? (
                <a href={activeTopDetailHref} className="angebote-media-link">
                  {activeTopImageUrl ? (
                    <Image
                      src={activeTopImageUrl}
                      alt={activeTopOffer.title}
                      fill
                      sizes="(max-width: 1200px) 100vw, 60vw"
                      loader={passthroughLoader}
                      unoptimized
                      style={{ objectFit: "cover" }}
                      loading="lazy"
                    />
                  ) : (
                    <div className="angebote-top-placeholder">{texts.no_image_available}</div>
                  )}
                </a>
              ) : activeTopImageUrl ? (
                <Image
                  src={activeTopImageUrl}
                  alt={activeTopOffer.title}
                  fill
                  sizes="(max-width: 1200px) 100vw, 60vw"
                  loader={passthroughLoader}
                  unoptimized
                  style={{ objectFit: "cover" }}
                  loading="lazy"
                />
              ) : (
                <div className="angebote-top-placeholder">{texts.no_image_available}</div>
              )}
              <span className="angebote-image-label">{texts.top_property}</span>
              <div className="angebote-media-overlay" aria-hidden="true" />
            </div>
            <div className="angebote-top-body">
              <div className="angebote-pill-row">
                <span className="angebote-pill">{formatObjectType(activeTopOffer.objectType)}</span>
              </div>
              <h3 className="h5 mb-2">{activeTopOffer.title || texts.object_generic}</h3>
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
                  <span className="angebote-fact-label">{texts.living_area}</span>
                  <strong className="angebote-fact-value">{formatArea(activeTopOffer.areaSqm)}</strong>
                </div>
                <div>
                  <span className="angebote-fact-label">{texts.rooms}</span>
                  <strong className="angebote-fact-value">{formatRooms(activeTopOffer.rooms)}</strong>
                </div>
              </div>
              {activeTopOffer.detailUrl && activeTopDetailHref ? (
                <a
                  className="btn btn-dark btn-sm mt-3 angebote-top-cta"
                  href={activeTopDetailHref}
                >
                  {texts.to_expose}
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
              aria-label={texts.previous_top_offer}
            >
              ‹
            </button>
            <button
              type="button"
              className="angebote-slider-btn angebote-slider-btn--brand"
              onClick={() => setActiveIndex((activeIndex + 1) % topOffers.length)}
              aria-label={texts.next_top_offer}
            >
              ›
            </button>
          </div>
        </section>
      ) : null}

      <section className="angebote-filter mb-4">
        <div className="angebote-filter-body" role="group" aria-label={texts.filter_object_type}>
          <button
            type="button"
            className={`angebote-filter-btn ${filter === "all" ? "is-active" : ""}`}
            onClick={() => setFilter("all")}
          >
            {texts.all}
          </button>
          <button
            type="button"
            className={`angebote-filter-btn ${filter === "haus" ? "is-active" : ""}`}
            onClick={() => setFilter("haus")}
          >
            {texts.house}
          </button>
          <button
            type="button"
            className={`angebote-filter-btn ${filter === "wohnung" ? "is-active" : ""}`}
            onClick={() => setFilter("wohnung")}
          >
            {texts.apartment}
          </button>
        </div>
      </section>

      <section className="angebote-list mb-5">
        {filteredOffers.length === 0 ? (
          <div className="alert alert-light border text-muted">
            {availabilityNotice ? (
              <div style={{ display: "grid", gap: 10 }}>
                <strong style={{ color: "#0f172a" }}>{availabilityNotice.title}</strong>
                <span>{availabilityNotice.body}</span>
                <a href={availabilityNotice.ctaHref} className="btn btn-outline-dark btn-sm" style={{ justifySelf: "start" }}>
                  {availabilityNotice.ctaLabel}
                </a>
              </div>
            ) : (
              texts.no_matching_offers_available
            )}
          </div>
        ) : (
          <div className="angebote-grid">
            {filteredOffers.map((offer) => {
              const imageUrl = sanitizeImageUrl(offer.imageUrl);
              const detailHref = buildDetailHref(offer);
              return (
                <article className="angebote-card" key={offer.id}>
                  <div className="angebote-card-media">
                    {detailHref ? (
                      <a href={detailHref} className="angebote-media-link">
                        {imageUrl ? (
                          <Image
                            src={imageUrl}
                            alt={offer.title}
                            fill
                            sizes="(max-width: 1200px) 100vw, 33vw"
                            loader={passthroughLoader}
                            unoptimized
                            style={{ objectFit: "cover" }}
                            loading="lazy"
                          />
                        ) : (
                          <div className="angebote-card-placeholder">{texts.no_image}</div>
                        )}
                      </a>
                    ) : imageUrl ? (
                      <Image
                        src={imageUrl}
                        alt={offer.title}
                        fill
                        sizes="(max-width: 1200px) 100vw, 33vw"
                        loader={passthroughLoader}
                        unoptimized
                        style={{ objectFit: "cover" }}
                        loading="lazy"
                      />
                    ) : (
                      <div className="angebote-card-placeholder">{texts.no_image}</div>
                    )}
                    {offer.isTop ? (
                      <span className="angebote-pill angebote-pill--dark angebote-pill--floating">
                        Top
                      </span>
                    ) : null}
                  </div>
                  <div className="angebote-card-body">
                    <div className="angebote-card-meta">
                      <span className="angebote-pill">{formatObjectType(offer.objectType)}</span>
                      <span className="angebote-price">
                        {formatCurrency(mode === "miete" ? offer.rent : offer.price)}
                        {priceSuffix ? <span className="angebote-price-suffix">{priceSuffix}</span> : null}
                      </span>
                    </div>
                    <h3 className="h6 mb-2">{offer.title || texts.object_generic}</h3>
                    {offer.address ? (
                      <p className="angebote-address mb-3">{offer.address}</p>
                    ) : null}
                    <div className="angebote-card-facts">
                      <span>{formatArea(offer.areaSqm)}</span>
                      <span>{formatRooms(offer.rooms)} {texts.rooms}</span>
                    </div>
                    {offer.detailUrl && detailHref ? (
                      <a
                        className="btn btn-outline-dark btn-sm angebote-card-cta"
                        href={detailHref}
                      >
                        {texts.to_expose}
                      </a>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {pagination && totalPages > 1 ? (
        <nav className="angebote-pagination" aria-label={texts.page_navigation}>
          {pagination.page > 1 ? (
            <a
              className="angebote-page-btn"
              href={`${pagination.basePath}?page=${pagination.page - 1}#angebote-top`}
              aria-label={texts.previous_page}
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
              aria-label={texts.next_page}
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
