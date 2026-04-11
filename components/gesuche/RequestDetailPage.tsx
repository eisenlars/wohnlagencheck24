import Image from "next/image";
import Link from "next/link";

import { ImmobilienmarktBreadcrumb } from "@/features/immobilienmarkt/shared/ImmobilienmarktBreadcrumb";
import type { PortalFormatProfile } from "@/lib/portal-format-config";
import type { PortalSystemTextMap } from "@/lib/portal-system-text-definitions";
import type { RequestMode } from "@/lib/gesuche";
import type { RequestDetail } from "@/lib/request-detail";
import { formatMetric } from "@/utils/format";
import { RequestOfferLeadButton } from "./RequestOfferLeadButton";

type Props = {
  request: RequestDetail;
  mode: RequestMode;
  texts: PortalSystemTextMap;
  formatProfile: PortalFormatProfile;
  locale?: string;
  listPath: string;
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
};

function formatDateLabel(value: string | null | undefined, locale: string): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsed);
}

export function RequestDetailPage(props: Props) {
  const { request, mode, texts, formatProfile, locale = "de", listPath, breadcrumb } = props;
  const isGerman = locale === "de";
  const introText = request.description
    ? request.description.length > 220
      ? `${request.description.slice(0, 219).trimEnd()}…`
      : request.description
    : null;
  const labels = isGerman
    ? {
        profile: "Gesuchprofil",
        criteria: "Suchkriterien",
        regions: "Zielregionen",
        persona: "Suchprofil",
        environment: "Umfeld",
        signals: "Hinweissignale",
        radius: "Suchradius",
        subtype: "Objekt-Untertyp",
        requestType: "Gesuchstyp",
      }
    : {
        profile: "Request profile",
        criteria: "Search criteria",
        regions: "Target regions",
        persona: "Search profile",
        environment: "Environment",
        signals: "Signals",
        radius: "Search radius",
        subtype: "Object subtype",
        requestType: "Request type",
      };

  const formatMoney = (value: number | null) =>
    formatMetric(value, {
      kind: "currency",
      ctx: "kpi",
      unit: "eur",
      locale,
      numberLocale: formatProfile.intlLocale,
      currencyCode: formatProfile.currencyCode,
      fractionDigits: 0,
    });
  const formatArea = (value: number | null) =>
    formatMetric(value, {
      kind: "flaeche",
      ctx: "kpi",
      unit: "none",
      locale,
      numberLocale: formatProfile.intlLocale,
      fractionDigits: 0,
    });
  const formatRooms = (value: number | null) =>
    formatMetric(value, {
      kind: "anzahl",
      ctx: "kpi",
      unit: "none",
      locale,
      numberLocale: formatProfile.intlLocale,
      fractionDigits: 0,
    });

  const objectLabel =
    request.objectType === "haus"
      ? texts.house
      : request.objectType === "wohnung"
        ? texts.apartment
        : request.objectType ?? texts.object_generic;
  const budgetLabel = request.maxPrice !== null
    ? `${formatMoney(request.maxPrice)}${mode === "miete" ? texts.per_month : ""}`
    : "—";
  const areaLabel =
    request.minAreaSqm !== null || request.maxAreaSqm !== null
      ? `${request.minAreaSqm !== null ? formatArea(request.minAreaSqm) : "—"} bis ${request.maxAreaSqm !== null ? formatArea(request.maxAreaSqm) : "—"} m²`
      : "—";
  const roomsLabel =
    request.minRooms !== null || request.maxRooms !== null
      ? `${request.minRooms !== null ? formatRooms(request.minRooms) : "—"} bis ${request.maxRooms !== null ? formatRooms(request.maxRooms) : "—"} ${texts.rooms}`
      : "—";
  const locationLabel = request.regionTargets.map((target) => target.label).join(", ") || texts.region_not_specified;

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
          locale={locale}
        />
      </div>

      <div style={{ marginBottom: 20 }}>
        <Link href={listPath} style={{ color: "#486b7a", fontWeight: 600, textDecoration: "none" }}>
          ← {texts.back_to_overview}
        </Link>
      </div>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.3fr) minmax(260px, 0.7fr)",
          gap: 24,
          alignItems: "start",
          marginBottom: 28,
        }}
      >
        <div
          style={{
            border: "1px solid #dbe4ea",
            borderRadius: 20,
            background: "#fff",
            padding: 24,
            display: "grid",
            gap: 18,
            alignContent: "start",
          }}
        >
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "6px 12px",
                borderRadius: 999,
                background: "#eef4f8",
                color: "#486b7a",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {objectLabel}
            </span>
            <span style={{ marginLeft: "auto", color: "#475569", fontSize: 13 }}>
              <strong>{texts.updated_label}:</strong> {formatDateLabel(request.updatedAt, locale)}
            </span>
          </div>

          <div>
            <h1 style={{ margin: "0 0 10px", fontSize: "clamp(2rem, 3vw, 2.8rem)", lineHeight: 1.08 }}>
              {request.title}
            </h1>
            {introText ? (
              <p style={{ margin: 0, color: "#334155", fontSize: 16, lineHeight: 1.7 }}>
                {introText}
              </p>
            ) : null}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 14,
              padding: 18,
              borderRadius: 16,
              background: "#f8fbfd",
            }}
          >
            <div>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>{mode === "miete" ? texts.warm_rent : texts.purchase_price}</div>
              <div style={{ fontWeight: 700 }}>{budgetLabel}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>{texts.living_area}</div>
              <div style={{ fontWeight: 700 }}>{areaLabel}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>{texts.rooms}</div>
              <div style={{ fontWeight: 700 }}>{roomsLabel}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>{labels.radius}</div>
              <div style={{ fontWeight: 700 }}>{request.radiusKm !== null ? `${request.radiusKm} km` : "—"}</div>
            </div>
          </div>

          <RequestOfferLeadButton
            label={texts.offer_property_to_request}
            locale={locale}
            pagePath={listPath}
            regionLabel={breadcrumb.names?.regionName ?? request.title}
            request={{ id: request.id, title: request.title, objectType: request.objectType }}
            context={breadcrumb.ctx ?? {}}
          />
        </div>

        <aside
          style={{
            display: "grid",
            gap: 18,
          }}
        >
          <div
            style={{
              position: "relative",
              aspectRatio: "4 / 3",
              borderRadius: 18,
              overflow: "hidden",
              background: "#dbe4ea",
              border: "1px solid #dbe4ea",
            }}
          >
            <Image
              src={request.imageUrl ?? "/images/requests/default_request.jpg"}
              alt={request.imageAlt ?? request.imageTitle ?? request.title}
              fill
              sizes="(max-width: 991px) 100vw, 28vw"
              style={{ objectFit: "cover" }}
              priority
            />
          </div>
          <div
            style={{
              border: "1px solid #dbe4ea",
              borderRadius: 18,
              background: "#f8fbfd",
              padding: 18,
              color: "#475569",
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            {isGerman
              ? "Das Motiv visualisiert den Suchtyp dezent und ergänzt das Gesuchprofil, ohne ein konkretes Objekt vorwegzunehmen."
              : "The motif subtly visualizes the search profile and supports the request without implying a specific property."}
          </div>
        </aside>
      </section>

      {request.description ? (
        <section
          style={{
            border: "1px solid #dbe4ea",
            borderRadius: 20,
            background: "#fff",
            padding: 24,
            marginBottom: 28,
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 14 }}>{isGerman ? "Beschreibung" : "Description"}</h2>
          <div style={{ color: "#334155", fontSize: 16, lineHeight: 1.8 }}>
            {request.description}
          </div>
        </section>
      ) : null}

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(320px, 380px)",
          gap: 24,
          marginBottom: 32,
        }}
      >
        <div
          style={{
            border: "1px solid #dbe4ea",
            borderRadius: 20,
            background: "#fff",
            padding: 24,
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 16 }}>{labels.criteria}</h2>
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "180px minmax(0, 1fr)", gap: 12 }}>
              <div style={{ color: "#64748b" }}>{labels.requestType}</div>
              <div style={{ fontWeight: 600 }}>{mode === "miete" ? texts.rent_request : texts.purchase_request}</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "180px minmax(0, 1fr)", gap: 12 }}>
              <div style={{ color: "#64748b" }}>{texts.object_generic}</div>
              <div style={{ fontWeight: 600 }}>{objectLabel}</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "180px minmax(0, 1fr)", gap: 12 }}>
              <div style={{ color: "#64748b" }}>{labels.subtype}</div>
              <div style={{ fontWeight: 600 }}>{request.objectSubtype ?? "—"}</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "180px minmax(0, 1fr)", gap: 12 }}>
              <div style={{ color: "#64748b" }}>{mode === "miete" ? texts.warm_rent : texts.purchase_price}</div>
              <div style={{ fontWeight: 600 }}>{budgetLabel}</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "180px minmax(0, 1fr)", gap: 12 }}>
              <div style={{ color: "#64748b" }}>{texts.living_area}</div>
              <div style={{ fontWeight: 600 }}>{areaLabel}</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "180px minmax(0, 1fr)", gap: 12 }}>
              <div style={{ color: "#64748b" }}>{texts.rooms}</div>
              <div style={{ fontWeight: 600 }}>{roomsLabel}</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "180px minmax(0, 1fr)", gap: 12 }}>
              <div style={{ color: "#64748b" }}>{labels.radius}</div>
              <div style={{ fontWeight: 600 }}>{request.radiusKm !== null ? `${request.radiusKm} km` : "—"}</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "180px minmax(0, 1fr)", gap: 12 }}>
              <div style={{ color: "#64748b" }}>{labels.regions}</div>
              <div style={{ fontWeight: 600 }}>{locationLabel}</div>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 20 }}>
          <div
            style={{
              border: "1px solid #dbe4ea",
              borderRadius: 20,
              background: "#fff",
              padding: 24,
            }}
          >
            <h2 style={{ marginTop: 0, marginBottom: 16 }}>{labels.profile}</h2>
            <div style={{ display: "grid", gap: 14 }}>
              <div>
                <div style={{ color: "#64748b", fontSize: 13, marginBottom: 4 }}>{labels.persona}</div>
                <div style={{ fontWeight: 600 }}>{request.audiencePersona.join(", ") || "—"}</div>
              </div>
              <div>
                <div style={{ color: "#64748b", fontSize: 13, marginBottom: 4 }}>{labels.environment}</div>
                <div style={{ fontWeight: 600 }}>{request.audienceEnvironment.join(", ") || "—"}</div>
              </div>
              <div>
                <div style={{ color: "#64748b", fontSize: 13, marginBottom: 4 }}>{labels.signals}</div>
                <div style={{ fontWeight: 600 }}>{request.audienceSignals.slice(0, 8).join(", ") || "—"}</div>
              </div>
            </div>
          </div>

          <div
            style={{
              border: "1px solid #dbe4ea",
              borderRadius: 20,
              background: "#f8fbfd",
              padding: 24,
            }}
          >
            <h2 style={{ marginTop: 0, marginBottom: 10 }}>{texts.offer_property_to_request}</h2>
            <p style={{ margin: "0 0 14px", color: "#475569", lineHeight: 1.6 }}>
              {isGerman
                ? "Sie haben ein passendes Objekt für dieses Gesuch? Nutzen Sie die Anfragefunktion und senden Sie dem zuständigen Berater die Eckdaten Ihrer Immobilie."
                : "Do you have a suitable property for this request? Use the inquiry form to send the key details of your property to the responsible advisor."}
            </p>
            <RequestOfferLeadButton
              label={texts.offer_property_to_request}
              locale={locale}
              pagePath={listPath}
              regionLabel={breadcrumb.names?.regionName ?? request.title}
              request={{ id: request.id, title: request.title, objectType: request.objectType }}
              context={breadcrumb.ctx ?? {}}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
