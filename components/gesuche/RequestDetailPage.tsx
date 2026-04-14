import Image from "next/image";
import Link from "next/link";

import { ImmobilienmarktBreadcrumb } from "@/features/immobilienmarkt/shared/ImmobilienmarktBreadcrumb";
import type { PortalFormatProfile } from "@/lib/portal-format-config";
import type { PortalSystemTextMap } from "@/lib/portal-system-text-definitions";
import type { RequestMode } from "@/lib/gesuche";
import { formatRequestObjectTypeLabel, formatRequestSubtypeLabel } from "@/lib/request-labels";
import type { RequestDetail } from "@/lib/request-detail";
import { formatMetric } from "@/utils/format";
import { RequestOfferLeadInlineForm } from "./RequestOfferLeadInlineForm";

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
  const labels = isGerman
    ? {
        criteria: "Suchkriterien",
        regions: "Zielregionen",
        radius: "Suchradius",
        subtype: "Objekt-Untertyp",
        description: "Beschreibung",
      }
    : {
        criteria: "Search criteria",
        regions: "Target regions",
        radius: "Search radius",
        subtype: "Object subtype",
        description: "Description",
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

  const objectLabel = formatRequestObjectTypeLabel(request.objectType, texts);
  const objectSubtypeLabel = formatRequestSubtypeLabel(request.objectSubtype);
  const objectMetaLabel = objectSubtypeLabel !== "—" ? `${objectLabel} · ${objectSubtypeLabel}` : objectLabel;
  const budgetLabel = request.maxPrice !== null || request.minPrice !== null
    ? `${
        request.minPrice !== null && request.maxPrice !== null
          ? `${formatMoney(request.minPrice)} bis ${formatMoney(request.maxPrice)}`
          : request.minPrice !== null
            ? `ab ${formatMoney(request.minPrice)}`
            : `bis ${formatMoney(request.maxPrice)}`
      }${mode === "miete" ? texts.per_month : ""}`
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
  const qualificationCopy = mode === "miete"
    ? "Ein qualifiziertes Gesuch basiert auf präzisen Suchkriterien und reduziert Streuverlust im Vermietungsprozess. Eigentümer erhalten schneller passende Anfragen und vermeiden unnötige Besichtigungstermine."
    : "Ein qualifiziertes Gesuch basiert auf präzisen Suchkriterien und reduziert Streuverlust im Vermarktungsprozess. Eigentümer erhalten schneller passende Anfragen und vermeiden unnötige Besichtigungstermine.";

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
              {objectMetaLabel}
            </span>
            <span style={{ marginLeft: "auto", color: "#475569", fontSize: 13 }}>
              <strong>{texts.updated_label}:</strong> {formatDateLabel(request.updatedAt, locale)}
            </span>
          </div>

          <div>
            <h1 style={{ margin: "0 0 10px", fontSize: "clamp(2rem, 3vw, 2.8rem)", lineHeight: 1.08 }}>
              {request.title}
            </h1>
            <div style={{ color: "#334155", fontSize: 16, lineHeight: 1.8 }}>
              {request.description ?? "—"}
            </div>
            <div
              style={{
                marginTop: 14,
                border: "1px solid #dbe4ea",
                borderRadius: 14,
                background: "#f8fafc",
                padding: "16px 18px",
                display: "grid",
                gap: 8,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: "#486b7a",
                }}
              >
                Warum dieses qualifizierte Gesuch für Eigentümer relevant ist
              </div>
              <div style={{ color: "#475569", fontSize: 14, lineHeight: 1.7 }}>
                {qualificationCopy}
              </div>
            </div>
          </div>

          <RequestOfferLeadInlineForm
            locale={locale}
            mode={mode}
            pagePath={listPath}
            regionLabel={breadcrumb.names?.regionName ?? request.title}
            request={{ id: request.id, title: request.title, objectType: request.objectType }}
            context={breadcrumb.ctx ?? {}}
          />
        </div>

        <aside
          style={{
            display: "grid",
            gap: 0,
            border: "1px solid #dbe4ea",
            borderRadius: 20,
            background: "#fff",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "relative",
              aspectRatio: "4 / 3",
              overflow: "hidden",
              background: "#dbe4ea",
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
              padding: 24,
            }}
          >
            <h2 style={{ marginTop: 0, marginBottom: 16 }}>{labels.criteria}</h2>
            <div style={{ display: "grid", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "180px minmax(0, 1fr)", gap: 12 }}>
                <div style={{ color: "#64748b" }}>{texts.object_generic}</div>
                <div style={{ fontWeight: 600 }}>{objectLabel}</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "180px minmax(0, 1fr)", gap: 12 }}>
                <div style={{ color: "#64748b" }}>{labels.subtype}</div>
                <div style={{ fontWeight: 600 }}>{objectSubtypeLabel}</div>
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
        </aside>
      </section>
    </div>
  );
}
