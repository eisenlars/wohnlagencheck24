import Link from "next/link";

import { ImmobilienmarktBreadcrumb } from "@/features/immobilienmarkt/shared/ImmobilienmarktBreadcrumb";
import type { TabItem } from "@/features/immobilienmarkt/sections/types";
import type { RegionalRequest, RequestMode } from "@/lib/gesuche";
import { getPortalSystemTexts } from "@/lib/portal-system-texts";
import { normalizePublicLocale } from "@/lib/public-locale-routing";

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
  locale?: string;
};

function formatMoney(value: number | null, locale: string): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "de-DE").format(value) + " €";
}

export function GesuchePage(props: GesuchePageProps) {
  const { heading, requests, mode, tabs, activeTabId, basePath, parentBasePath, ctx, names, locale } = props;
  const normalizedLocale = normalizePublicLocale(locale);
  const texts = getPortalSystemTexts(normalizedLocale);
  const kaufPath = `${basePath}/immobiliengesuche`;
  const mietePath = `${basePath}/mietgesuche`;

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
          {requests.length} {heading}
        </h1>
      </div>

      {requests.length === 0 ? (
        <div className="alert alert-light border text-muted">
          {texts.no_matching_requests_available}
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
                  <span className="angebote-price">{formatMoney(request.maxPrice, normalizedLocale)}</span>
                </div>
                <h2 className="h6 mb-2">{request.title}</h2>
                <p className="angebote-address mb-2">
                  {request.regionTargets.map((target) => target.label).join(", ") || texts.region_not_specified}
                </p>
                <div className="angebote-card-facts">
                  <span>{request.requestType === "miete" ? texts.rent_request : texts.purchase_request}</span>
                  <span>{request.minRooms ?? "—"} {texts.rooms_min}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
