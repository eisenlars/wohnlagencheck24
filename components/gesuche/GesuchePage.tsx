import Link from "next/link";

import { ImmobilienmarktBreadcrumb } from "@/features/immobilienmarkt/shared/ImmobilienmarktBreadcrumb";
import type { TabItem } from "@/features/immobilienmarkt/sections/types";
import type { RegionalRequest, RequestMode } from "@/lib/gesuche";
import type { PortalFormatProfile } from "@/lib/portal-format-config";
import type { PortalSystemTextMap } from "@/lib/portal-system-text-definitions";
import { normalizePublicLocale } from "@/lib/public-locale-routing";
import { formatMetric } from "@/utils/format";

type GesuchePageProps = {
  heading: string;
  requests: RegionalRequest[];
  mode: RequestMode;
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
  const { heading, requests, mode, tabs, activeTabId, basePath, parentBasePath, ctx, names, texts, formatProfile, locale, availabilityNotice } = props;
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

  return (
    <div className="container text-dark">
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
          {availabilityNotice ? heading : `${requests.length} ${heading}`}
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
        <div className="angebote-grid">
          {requests.map((request) => (
            <article className="angebote-card" key={request.id}>
              <div className="angebote-card-body">
                <div className="angebote-card-meta">
                  <span className="angebote-pill">
                    {request.objectType === "haus"
                      ? texts.house
                      : request.objectType === "wohnung"
                        ? texts.apartment
                        : request.objectType ?? texts.object_generic}
                  </span>
                  <span className="angebote-price">{formatMoney(request.maxPrice)}</span>
                </div>
                <h2 className="h6 mb-2">{request.title}</h2>
                <p className="angebote-address mb-2">
                  {request.regionTargets.map((target) => target.label).join(", ") || texts.region_not_specified}
                </p>
                {request.description ? (
                  <p className="mb-3" style={{ color: '#334155' }}>
                    {truncateText(request.description)}
                  </p>
                ) : null}
                <div className="angebote-card-facts">
                  <span>{request.requestType === "miete" ? texts.rent_request : texts.purchase_request}</span>
                  {request.minRooms !== null ? <span>{request.minRooms} {texts.rooms_min}</span> : null}
                  {request.locationText ? <span>{request.locationText}</span> : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
