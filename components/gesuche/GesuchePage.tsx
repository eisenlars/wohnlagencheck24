import Image from "next/image";
import Link from "next/link";

import { ImmobilienmarktBreadcrumb } from "@/features/immobilienmarkt/shared/ImmobilienmarktBreadcrumb";
import type { TabItem } from "@/features/immobilienmarkt/sections/types";
import type { RegionalRequest, RequestMode } from "@/lib/gesuche";
import type { PortalFormatProfile } from "@/lib/portal-format-config";
import type { PortalSystemTextMap } from "@/lib/portal-system-text-definitions";
import { normalizePublicLocale } from "@/lib/public-locale-routing";
import { formatMetric } from "@/utils/format";
import { RequestOfferLeadButton } from "./RequestOfferLeadButton";

type GesuchePageProps = {
  heading: string;
  requests: RegionalRequest[];
  mode: RequestMode;
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
  const { heading, requests, mode, pagination, tabs, activeTabId, basePath, parentBasePath, ctx, names, texts, formatProfile, locale, availabilityNotice } = props;
  const normalizedLocale = normalizePublicLocale(locale);
  const kaufPath = `${basePath}/immobiliengesuche`;
  const mietePath = `${basePath}/mietgesuche`;
  const formatMoney = (value: number | null) => formatMetric(value, {
    kind: "currency",
    ctx: "kpi",
    unit: "eur",
    locale: normalizedLocale,
    numberLocale: formatProfile.intlLocale,
    currencyCode: formatProfile.currencyCode,
    fractionDigits: 0,
  });
  const truncateText = (value: string | null, maxLength = 220) => {
    const text = String(value ?? '').trim();
    if (!text) return null;
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength - 1).trimEnd()}…`;
  };
  const formatAreaRange = (min: number | null, max: number | null) => {
    if (min !== null && max !== null) return `${formatMetric(min, { kind: "flaeche", ctx: "kpi", unit: "none", locale: normalizedLocale, numberLocale: formatProfile.intlLocale, fractionDigits: 0 })} - ${formatMetric(max, { kind: "flaeche", ctx: "kpi", unit: "none", locale: normalizedLocale, numberLocale: formatProfile.intlLocale, fractionDigits: 0 })} m²`;
    if (min !== null) return `${formatMetric(min, { kind: "flaeche", ctx: "kpi", unit: "none", locale: normalizedLocale, numberLocale: formatProfile.intlLocale, fractionDigits: 0 })} m²`;
    if (max !== null) return `${formatMetric(max, { kind: "flaeche", ctx: "kpi", unit: "none", locale: normalizedLocale, numberLocale: formatProfile.intlLocale, fractionDigits: 0 })} m²`;
    return null;
  };
  const formatRoomRange = (min: number | null, max: number | null) => {
    const roomLabel = texts.rooms;
    if (min !== null && max !== null) return `${formatMetric(min, { kind: "anzahl", ctx: "kpi", unit: "none", locale: normalizedLocale, numberLocale: formatProfile.intlLocale, fractionDigits: 0 })} - ${formatMetric(max, { kind: "anzahl", ctx: "kpi", unit: "none", locale: normalizedLocale, numberLocale: formatProfile.intlLocale, fractionDigits: 0 })} ${roomLabel}`;
    if (min !== null) return `${formatMetric(min, { kind: "anzahl", ctx: "kpi", unit: "none", locale: normalizedLocale, numberLocale: formatProfile.intlLocale, fractionDigits: 0 })} ${roomLabel}`;
    if (max !== null) return `${formatMetric(max, { kind: "anzahl", ctx: "kpi", unit: "none", locale: normalizedLocale, numberLocale: formatProfile.intlLocale, fractionDigits: 0 })} ${roomLabel}`;
    return null;
  };
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
    const baseLabel =
      request.objectType === "haus"
        ? texts.house
        : request.objectType === "wohnung"
          ? texts.apartment
          : request.objectType ?? texts.object_generic;
    const subtype = String(request.objectSubtype ?? "").trim().replace(/_/g, " ");
    return subtype ? `${baseLabel} · ${subtype}` : baseLabel;
  };
  const totalPages = pagination
    ? Math.max(1, Math.ceil(pagination.total / pagination.pageSize))
    : 1;
  const headingCount = pagination?.total ?? requests.length;
  const currentListPath = mode === "kauf" ? kaufPath : mietePath;

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
          {availabilityNotice ? heading : `${headingCount} ${heading}`}
        </h1>
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
              <article className="angebote-card" key={request.id}>
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
                    <Image
                      src={request.imageUrl}
                      alt={request.imageAlt ?? request.imageTitle ?? request.title}
                      fill
                      sizes="(max-width: 767px) 100vw, (max-width: 1199px) 50vw, 33vw"
                      style={{ objectFit: "cover" }}
                    />
                  </div>
                ) : null}
                <div className="angebote-card-body">
                  <div className="angebote-card-meta" style={{ alignItems: "flex-start", gap: 12 }}>
                    <span className="angebote-pill">{formatObjectType(request)}</span>
                    <span style={{ marginLeft: "auto", textAlign: "right", color: "#475569", fontSize: "0.8rem", lineHeight: 1.35 }}>
                      <span style={{ display: "block", fontWeight: 600 }}>{texts.updated_label}</span>
                      <span>{formatUpdatedAt(request.updatedAt) ?? "—"}</span>
                    </span>
                  </div>
                  <h2 className="h6 mb-2">{request.title}</h2>
                  {request.description ? (
                    <p className="mb-3" style={{ color: '#334155' }}>
                      {truncateText(request.description)}
                    </p>
                  ) : null}
                  <div className="angebote-card-facts" style={{ marginBottom: 16 }}>
                    {request.maxPrice !== null ? (
                      <span>
                        {formatMoney(request.maxPrice)}
                        {mode === "miete" ? <span className="angebote-price-suffix">{texts.per_month}</span> : null}
                      </span>
                    ) : null}
                    {formatAreaRange(request.minAreaSqm, request.maxAreaSqm) ? (
                      <span>{formatAreaRange(request.minAreaSqm, request.maxAreaSqm)}</span>
                    ) : null}
                    {formatRoomRange(request.minRooms, request.maxRooms) ? (
                      <span>{formatRoomRange(request.minRooms, request.maxRooms)}</span>
                    ) : null}
                    {request.radiusKm !== null ? <span>{`${request.radiusKm} km`}</span> : null}
                    <span>{request.regionTargets.map((target) => target.label).join(", ") || texts.region_not_specified}</span>
                  </div>
                  <RequestOfferLeadButton
                    label={texts.offer_property_to_request}
                    locale={normalizedLocale}
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
