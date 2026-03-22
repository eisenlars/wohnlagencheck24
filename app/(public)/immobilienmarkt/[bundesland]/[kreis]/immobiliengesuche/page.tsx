import { GesuchePage } from "@/components/gesuche/GesuchePage";
import { IMMOBILIENMARKT_THEME } from "@/features/immobilienmarkt/config/theme";
import { getReportBySlugs } from "@/lib/data";
import { getRegionalRequestsForKreis } from "@/lib/gesuche";
import { getPortalSystemTexts } from "@/lib/portal-system-texts";
import { buildLocalizedHref, normalizePublicLocale } from "@/lib/public-locale-routing";
import { formatRegionFallback, getRegionDisplayName } from "@/utils/regionName";
import { asArray, asRecord, asString } from "@/utils/records";

type PageParams = { bundesland: string; kreis: string };
type PageProps = { params: Promise<PageParams> };
type ContentProps = { bundesland: string; kreis: string; locale?: string };

export async function ImmobiliengesucheKreisPageContent({
  bundesland,
  kreis,
  locale = "de",
}: ContentProps) {
  const normalizedLocale = normalizePublicLocale(locale);
  const texts = await getPortalSystemTexts(normalizedLocale);
  const localizeHref = (path: string) =>
    normalizedLocale === "de" ? path : buildLocalizedHref(normalizedLocale, path);
  const { requests, sourceCount } = await getRegionalRequestsForKreis({
    bundeslandSlug: bundesland,
    kreisSlug: kreis,
    mode: "kauf",
    locale: normalizedLocale,
  });

  const report = await getReportBySlugs([bundesland, kreis]);
  const meta = asRecord(asArray(report?.meta)[0] ?? report?.meta) ?? {};
  const kreisName = getRegionDisplayName({ meta, level: "kreis", fallbackSlug: kreis });
  const bundeslandName = asString(meta["bundesland_name"]) ?? formatRegionFallback(bundesland);
  const rawBasePath = `/immobilienmarkt/${bundesland}/${kreis}`;
  const germanListPath = `${rawBasePath}/immobiliengesuche`;
  const basePath = localizeHref(rawBasePath);
  const tabs = [...IMMOBILIENMARKT_THEME.tabsByLevel.kreis, { id: "immobiliengesuche", label: texts.buy_requests }];
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
      heading={`${texts.buy_requests} ${kreisName}`}
      requests={requests}
      mode="kauf"
      tabs={tabs}
      activeTabId="immobiliengesuche"
      basePath={basePath}
      ctx={{ bundeslandSlug: bundesland, kreisSlug: kreis }}
      names={{ bundeslandName, kreisName, regionName: kreisName }}
      locale={normalizedLocale}
      availabilityNotice={availabilityNotice}
    />
  );
}

export default async function ImmobiliengesucheKreisPage({ params }: PageProps) {
  const { bundesland, kreis } = await params;
  return ImmobiliengesucheKreisPageContent({ bundesland, kreis, locale: "de" });
}
