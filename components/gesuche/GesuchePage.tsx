import Link from "next/link";

import { ImmobilienmarktBreadcrumb } from "@/features/immobilienmarkt/shared/ImmobilienmarktBreadcrumb";
import type { TabItem } from "@/features/immobilienmarkt/sections/types";
import type { RegionalRequest, RequestMode } from "@/lib/gesuche";

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
};

function formatMoney(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("de-DE").format(value) + " €";
}

export function GesuchePage(props: GesuchePageProps) {
  const { heading, requests, mode, tabs, activeTabId, basePath, parentBasePath, ctx, names } = props;
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
        />
      </div>

      <div className="angebote-mode-toggle mb-5">
        <Link className={`angebote-mode-btn ${mode === "kauf" ? "is-active" : ""}`} href={kaufPath}>
          Kaufgesuche
        </Link>
        <Link className={`angebote-mode-btn ${mode === "miete" ? "is-active" : ""}`} href={mietePath}>
          Mietgesuche
        </Link>
      </div>

      <div className="angebote-page-title">
        <h1 className="angebote-page-title-text">
          {requests.length} {heading}
        </h1>
      </div>

      {requests.length === 0 ? (
        <div className="alert alert-light border text-muted">
          Aktuell sind keine passenden Gesuche für diese Ortslage verfügbar.
        </div>
      ) : (
        <div className="angebote-grid">
          {requests.map((request) => (
            <article className="angebote-card" key={request.id}>
              <div className="angebote-card-body">
                <div className="angebote-card-meta">
                  <span className="angebote-pill">{request.objectType ?? "objekt"}</span>
                  <span className="angebote-price">{formatMoney(request.maxPrice)}</span>
                </div>
                <h2 className="h6 mb-2">{request.title}</h2>
                <p className="angebote-address mb-2">
                  {request.regionTargets.map((target) => target.label).join(", ") || "Region nicht hinterlegt"}
                </p>
                <div className="angebote-card-facts">
                  <span>{request.requestType === "miete" ? "Mietgesuch" : "Kaufgesuch"}</span>
                  <span>{request.minRooms ?? "—"} Zimmer min.</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
