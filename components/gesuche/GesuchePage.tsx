"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";

import { ImmobilienmarktBreadcrumb } from "@/features/immobilienmarkt/shared/ImmobilienmarktBreadcrumb";
import type { TabItem } from "@/features/immobilienmarkt/sections/types";
import type { RegionalRequest, RequestMode } from "@/lib/gesuche";
import { formatRequestObjectTypeLabel } from "@/lib/request-labels";
import type { PortalFormatProfile } from "@/lib/portal-format-config";
import type { PortalSystemTextMap } from "@/lib/portal-system-text-definitions";
import { normalizePublicLocale } from "@/lib/public-locale-routing";
import { slugifyRequestTitle } from "@/utils/slug";
import { RequestOfferLeadButton } from "./RequestOfferLeadButton";

type GesuchePageProps = {
  heading: string;
  requests: RegionalRequest[];
  mode: RequestMode;
  detailBasePath?: string | null;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    basePath: string;
  };
  tabs: TabItem[];
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
  formatProfile: PortalFormatProfile;
  locale?: string;
  availabilityNotice?: {
    title: string;
    body: string;
    ctaHref: string;
    ctaLabel: string;
  } | null;
};

export function GesuchePage(props: GesuchePageProps) {
  const { heading, requests, mode, detailBasePath, pagination, tabs, activeTabId, basePath, parentBasePath, ctx, names, texts, formatProfile, locale, availabilityNotice } = props;
  const normalizedLocale = normalizePublicLocale(locale);
  const [filter, setFilter] = useState<"all" | "haus" | "wohnung">("all");
  const kaufPath = `${basePath}/immobiliengesuche`;
  const mietePath = `${basePath}/mietgesuche`;
  const formatUpdatedAt = (value: string | null) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat(normalizedLocale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date);
  };
  const formatObjectType = (request: RegionalRequest) => {
    return formatRequestObjectTypeLabel(request.objectType, texts);
  };
  const totalPages = pagination
    ? Math.max(1, Math.ceil(pagination.total / pagination.pageSize))
    : 1;
  const headingCount = pagination?.total ?? requests.length;
  const currentListPath = mode === "kauf" ? kaufPath : mietePath;
  const qualifiedHeading = mode === "miete"
    ? `${headingCount} qualifizierte Mietgesuche ${names?.regionName ?? ""}`.trim()
    : `${headingCount} qualifizierte Kaufgesuche ${names?.regionName ?? ""}`.trim();
  const buildDetailHref = (request: RegionalRequest) =>
    detailBasePath ? `${detailBasePath}/${request.id}_${slugifyRequestTitle(request.title)}` : null;
  const filteredRequests = useMemo(
    () =>
      requests.filter((request) => {
        if (filter === "all") return true;
        return String(request.objectType ?? "").trim().toLowerCase() === filter;
      }),
    [filter, requests],
  );

  return (
    <div className="container text-dark">
      <div id="gesuche-top" />
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
          texts={texts}
          locale={normalizedLocale}
        />
      </div>

      <div className="angebote-mode-toggle mb-5">
        <Link className={`angebote-mode-btn ${mode === "kauf" ? "is-active" : ""}`} href={kaufPath}>
          {texts.buy_requests}
        </Link>
        <Link className={`angebote-mode-btn ${mode === "miete" ? "is-active" : ""}`} href={mietePath}>
          {texts.rent_requests}
        </Link>
      </div>

      <div className="angebote-page-title">
        <h1 className="angebote-page-title-text">
          {availabilityNotice ? heading : qualifiedHeading}
        </h1>
      </div>

      <section className="angebote-filter mb-4">
        <div
          className="angebote-filter-body"
          role="group"
          aria-label={texts.filter_object_type}
          style={{ justifyContent: "center" }}
        >
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

      {filteredRequests.length === 0 ? (
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
            texts.no_matching_requests_available
          )}
        </div>
      ) : (
        <section className="angebote-list mb-5">
          <div className="angebote-grid">
            {filteredRequests.map((request) => (
              <article className="angebote-card list-card request-list-card" key={request.id}>
                {request.imageUrl ? (
                  <div className="angebote-card-media list-card__media">
                    {buildDetailHref(request) ? (
                      <Link href={buildDetailHref(request)!} aria-label={request.title} className="angebote-media-link">
                        <Image
                          src={request.imageUrl}
                          alt={request.imageAlt ?? request.imageTitle ?? request.title}
                          fill
                          sizes="(max-width: 767px) 100vw, (max-width: 1199px) 50vw, 33vw"
                          style={{ objectFit: "cover" }}
                        />
                      </Link>
                    ) : (
                      <Image
                        src={request.imageUrl}
                        alt={request.imageAlt ?? request.imageTitle ?? request.title}
                        fill
                        sizes="(max-width: 767px) 100vw, (max-width: 1199px) 50vw, 33vw"
                        style={{ objectFit: "cover" }}
                      />
                    )}
                  </div>
                ) : null}
                <div className="angebote-card-body list-card__body">
                  <div className="angebote-card-meta list-card__meta request-list-card__meta">
                    <span className="angebote-pill">{formatObjectType(request)}</span>
                    <span className="request-list-card__updated">
                      <span className="request-list-card__updated-label">{texts.updated_label}</span>
                      <span>{formatUpdatedAt(request.updatedAt) ?? "—"}</span>
                    </span>
                  </div>
                  <h2 className="h6 mb-2 list-card__title">
                    {buildDetailHref(request) ? (
                      <Link href={buildDetailHref(request)!} className="list-card__title-link">
                        {request.title}
                      </Link>
                    ) : (
                      request.title
                    )}
                  </h2>
                  <div className="list-card__subtitle request-list-card__subtitle">
                    {`Suchregion: ${request.regionTargets.map((target) => target.label).join(", ") || texts.region_not_specified}`}
                  </div>
                  <div className="list-card__actions request-list-card__actions">
                    {buildDetailHref(request) ? (
                      <Link
                        href={buildDetailHref(request)!}
                        className="btn btn-sm request-list-card__action request-list-card__action--secondary"
                      >
                        {texts.details}
                      </Link>
                    ) : null}
                    <RequestOfferLeadButton
                      label={texts.offer_property_to_request}
                      locale={normalizedLocale}
                      className="btn btn-sm request-list-card__action request-list-card__action--primary"
                      pagePath={currentListPath}
                      regionLabel={names?.regionName ?? heading}
                      request={{
                        id: request.id,
                        title: request.title,
                        objectType: request.objectType,
                      }}
                      context={{
                        bundeslandSlug: ctx?.bundeslandSlug,
                        kreisSlug: ctx?.kreisSlug,
                        ortSlug: ctx?.ortSlug,
                      }}
                    />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {pagination && totalPages > 1 ? (
        <nav className="angebote-pagination" aria-label={texts.page_navigation}>
          {pagination.page > 1 ? (
            <Link
              className="angebote-page-btn"
              href={`${pagination.basePath}?page=${pagination.page - 1}#gesuche-top`}
              aria-label={texts.previous_page}
              rel="prev"
            >
              ‹
            </Link>
          ) : null}
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((page) => {
              if (page === 1 || page === totalPages) return true;
              return Math.abs(page - pagination.page) <= 1;
            })
            .reduce<number[]>((acc, page) => {
              const last = acc[acc.length - 1];
              if (last && page - last > 1) acc.push(-1);
              acc.push(page);
              return acc;
            }, [])
            .map((page, index) =>
              page === -1 ? (
                <span key={`ellipsis-${index}`} className="angebote-page-ellipsis">
                  …
                </span>
              ) : (
                <Link
                  key={`page-${page}`}
                  className={`angebote-page-btn${page === pagination.page ? " is-active" : ""}`}
                  href={`${pagination.basePath}?page=${page}#gesuche-top`}
                  aria-current={page === pagination.page ? "page" : undefined}
                >
                  {page}
                </Link>
              ),
            )}
          {pagination.page < totalPages ? (
            <Link
              className="angebote-page-btn"
              href={`${pagination.basePath}?page=${pagination.page + 1}#gesuche-top`}
              aria-label={texts.next_page}
              rel="next"
            >
              ›
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
