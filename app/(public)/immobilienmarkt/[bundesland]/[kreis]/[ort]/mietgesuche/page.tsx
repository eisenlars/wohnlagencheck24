import { GesuchePage } from "@/components/gesuche/GesuchePage";
import { IMMOBILIENMARKT_THEME } from "@/features/immobilienmarkt/config/theme";
import { getReportBySlugs } from "@/lib/data";
import { getRegionalRequestsForOrtslage } from "@/lib/gesuche";
import { loadPortalFormatProfile } from "@/lib/portal-format-config";
import { getPortalSystemTexts } from "@/lib/portal-system-texts";
import { buildLocalizedHref, normalizePublicLocale } from "@/lib/public-locale-routing";
import { formatRegionFallback, getRegionDisplayName } from "@/utils/regionName";
import { asArray, asRecord, asString } from "@/utils/records";

type PageParams = { bundesland: string; kreis: string; ort: string };
type PageProps = { params: Promise<PageParams> };
type ContentProps = { bundesland: string; kreis: string; ort: string; locale?: string };

export async function MietgesucheOrtPageContent({
  bundesland,
  kreis,
  ort,
  locale = "de",
}: ContentProps) {
  const normalizedLocale = normalizePublicLocale(locale);
  const texts = await getPortalSystemTexts(normalizedLocale);
  const formatProfile = await loadPortalFormatProfile(normalizedLocale);
  const localizeHref = (path: string) =>
    normalizedLocale === "de" ? path : buildLocalizedHref(normalizedLocale, path);

  const { requests, sourceCount } = await getRegionalRequestsForOrtslage({
    bundeslandSlug: bundesland,
    kreisSlug: kreis,
    ortSlug: ort,
    mode: "miete",
    locale: normalizedLocale,
  });

  const kreisReport = await getReportBySlugs([bundesland, kreis]);
  const kreisMeta = asRecord(asArray(kreisReport?.meta)[0] ?? kreisReport?.meta) ?? {};
  const kreisName = getRegionDisplayName({ meta: kreisMeta, level: "kreis", fallbackSlug: kreis });
  const bundeslandName = asString(kreisMeta["bundesland_name"]) ?? formatRegionFallback(bundesland);

  const ortReport = await getReportBySlugs([bundesland, kreis, ort]);
  const ortMeta = asRecord(asArray(ortReport?.meta)[0] ?? ortReport?.meta) ?? {};
  const ortName = getRegionDisplayName({ meta: ortMeta, level: "ort", fallbackSlug: ort });

  const rawBasePath = `/immobilienmarkt/${bundesland}/${kreis}/${ort}`;
  const rawParentBasePath = `/immobilienmarkt/${bundesland}/${kreis}`;
  const germanListPath = `${rawBasePath}/mietgesuche`;
  const basePath = localizeHref(rawBasePath);
  const tabs = [...IMMOBILIENMARKT_THEME.tabsByLevel.ort, { id: "mietgesuche", label: texts.rent_requests }];
  const availabilityNotice = normalizedLocale !== "de" && requests.length === 0 && sourceCount > 0
    ? {
        title: texts.requests_unavailable_title,
        body: texts.requests_unavailable_body,
        ctaHref: germanListPath,
        ctaLabel: texts.view_german_requests,
      }
    : null;

  return (
    <GesuchePage
      heading={`${texts.rent_requests} ${ortName}`}
      requests={requests}
      mode="miete"
      tabs={tabs}
      activeTabId="mietgesuche"
      basePath={basePath}
      parentBasePath={localizeHref(rawParentBasePath)}
      ctx={{ bundeslandSlug: bundesland, kreisSlug: kreis, ortSlug: ort }}
      names={{ bundeslandName, kreisName, regionName: ortName }}
      texts={texts}
      formatProfile={formatProfile}
      locale={normalizedLocale}
      availabilityNotice={availabilityNotice}
    />
  );
}

export default async function MietgesucheOrtPage({ params }: PageProps) {
  const { bundesland, kreis, ort } = await params;
  return MietgesucheOrtPageContent({ bundesland, kreis, ort, locale: "de" });
}
