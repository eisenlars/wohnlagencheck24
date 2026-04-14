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
  const buildDetailHref = (request: RegionalRequest) =>
    detailBasePath ? `${detailBasePath}/${request.id}_${slugifyRequestTitle(request.title)}` : null;

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

      <div className="angebote-page-title">
        <h1 className="angebote-page-title-text">
          {availabilityNotice ? heading : `${headingCount} ${heading}`}
        </h1>
      </div>

      <div className="angebote-mode-toggle mb-5">
        <Link className={`angebote-mode-btn ${mode === "kauf" ? "is-active" : ""}`} href={kaufPath}>
          {texts.buy_requests}
        </Link>
        <Link className={`angebote-mode-btn ${mode === "miete" ? "is-active" : ""}`} href={mietePath}>
          {texts.rent_requests}
        </Link>
      </div>

      {requests.length === 0 ? (
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
            {requests.map((request) => (
              <article className="angebote-card" key={request.id} style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                {request.imageUrl ? (
                  <div
                    style={{
                      position: "relative",
                      aspectRatio: "16 / 10",
                      overflow: "hidden",
                      borderBottom: "1px solid #e2e8f0",
                      background: "#e2e8f0",
                    }}
                  >
                    {buildDetailHref(request) ? (
                      <Link href={buildDetailHref(request)!} aria-label={request.title} style={{ display: "block", width: "100%", height: "100%" }}>
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
                <div className="angebote-card-body" style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                  <div className="angebote-card-meta" style={{ alignItems: "flex-start", gap: 12 }}>
                    <span className="angebote-pill">{formatObjectType(request)}</span>
                    <span style={{ marginLeft: "auto", textAlign: "right", color: "#475569", fontSize: "0.8rem", lineHeight: 1.35 }}>
                      <span style={{ display: "block", fontWeight: 600 }}>{texts.updated_label}</span>
                      <span>{formatUpdatedAt(request.updatedAt) ?? "—"}</span>
                    </span>
                  </div>
                  <h2 className="h6 mb-2">
                    {buildDetailHref(request) ? (
                      <Link href={buildDetailHref(request)!} style={{ color: "inherit", textDecoration: "none" }}>
                        {request.title}
                      </Link>
                    ) : (
                      request.title
                    )}
                  </h2>
                  <div style={{ color: "#334155", marginBottom: 18, lineHeight: 1.6 }}>
                    {`Suchregion: ${request.regionTargets.map((target) => target.label).join(", ") || texts.region_not_specified}`}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: "auto" }}>
                    {buildDetailHref(request) ? (
                      <Link
                        href={buildDetailHref(request)!}
                        className="btn btn-sm"
                        style={{
                          border: "1px solid #486b7a",
                          color: "#486b7a",
                          background: "#fff",
                          fontWeight: 700,
                        }}
                      >
                        {texts.details}
                      </Link>
                    ) : null}
                    <RequestOfferLeadButton
                      label={texts.offer_property_to_request}
                      locale={normalizedLocale}
                      className="btn btn-sm"
                      style={{
                        background: "#486b7a",
                        border: "1px solid #486b7a",
                        color: "#fff",
                        fontWeight: 700,
                      }}
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
