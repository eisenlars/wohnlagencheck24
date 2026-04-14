import { GesuchePage } from "@/components/gesuche/GesuchePage";
import { IMMOBILIENMARKT_THEME } from "@/features/immobilienmarkt/config/theme";
import { getReportBySlugs } from "@/lib/data";
import { getRegionalRequestsForKreis } from "@/lib/gesuche";
import { loadPortalFormatProfile } from "@/lib/portal-format-config";
import { getPortalSystemTexts } from "@/lib/portal-system-texts";
import { buildLocalizedHref, normalizePublicLocale } from "@/lib/public-locale-routing";
import { formatRegionFallback, getRegionDisplayName } from "@/utils/regionName";
import { asArray, asRecord, asString } from "@/utils/records";

type PageParams = { bundesland: string; kreis: string };
type PageProps = { params: Promise<PageParams>; searchParams?: Promise<{ page?: string }> };
type ContentProps = { bundesland: string; kreis: string; page?: number; locale?: string };

const PAGE_SIZE = 12;

export async function ImmobiliengesucheKreisPageContent({
  bundesland,
  kreis,
  page = 1,
  locale = "de",
}: ContentProps) {
  const normalizedLocale = normalizePublicLocale(locale);
  const texts = await getPortalSystemTexts(normalizedLocale);
  const formatProfile = await loadPortalFormatProfile(normalizedLocale);
  const localizeHref = (path: string) =>
    normalizedLocale === "de" ? path : buildLocalizedHref(normalizedLocale, path);
  const { requests, sourceCount, total } = await getRegionalRequestsForKreis({
    bundeslandSlug: bundesland,
    kreisSlug: kreis,
    mode: "kauf",
    page,
    pageSize: PAGE_SIZE,
    locale: normalizedLocale,
  });

  const report = await getReportBySlugs([bundesland, kreis]);
  const meta = asRecord(asArray(report?.meta)[0] ?? report?.meta) ?? {};
  const kreisName = getRegionDisplayName({ meta, level: "kreis", fallbackSlug: kreis });
  const bundeslandName = asString(meta["bundesland_name"]) ?? formatRegionFallback(bundesland);
  const rawBasePath = `/immobilienmarkt/${bundesland}/${kreis}`;
  const germanListPath = `${rawBasePath}/immobiliengesuche`;
  const basePath = localizeHref(rawBasePath);
  const listPath = `${basePath}/immobiliengesuche`;
  const tabs = [...IMMOBILIENMARKT_THEME.tabsByLevel.kreis, { id: "immobiliengesuche", label: texts.buy_requests }];
  const availabilityNotice = normalizedLocale !== "de" && total === 0 && sourceCount > 0
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
      detailBasePath={listPath}
      pagination={{
        page: Math.max(page, 1),
        pageSize: PAGE_SIZE,
        total,
        basePath: listPath,
      }}
      tabs={tabs}
      activeTabId="immobiliengesuche"
      basePath={basePath}
      ctx={{ bundeslandSlug: bundesland, kreisSlug: kreis }}
      names={{ bundeslandName, kreisName, regionName: kreisName }}
      texts={texts}
      formatProfile={formatProfile}
      locale={normalizedLocale}
      availabilityNotice={availabilityNotice}
    />
  );
}

export default async function ImmobiliengesucheKreisPage({ params, searchParams }: PageProps) {
  const { bundesland, kreis } = await params;
  const rawPage = await (await searchParams)?.page;
  const parsedPage = rawPage ? Number(rawPage) : 1;
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  return ImmobiliengesucheKreisPageContent({ bundesland, kreis, page, locale: "de" });
}
