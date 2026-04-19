import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { RequestDetailPage } from "@/components/gesuche/RequestDetailPage";
import { IMMOBILIENMARKT_THEME } from "@/features/immobilienmarkt/config/theme";
import { getReportBySlugs } from "@/lib/data";
import { loadPortalFormatProfile } from "@/lib/portal-format-config";
import { getPortalSystemTexts } from "@/lib/portal-system-texts";
import { buildLocalizedHref, normalizePublicLocale } from "@/lib/public-locale-routing";
import { buildRequestMarketRangeContext } from "@/lib/request-market-range";
import { getRegionalRequestByIdForKreis } from "@/lib/request-detail";
import { formatRegionFallback, getRegionDisplayName } from "@/utils/regionName";
import { asArray, asRecord, asString } from "@/utils/records";
import { parseRequestParam } from "@/utils/slug";

type PageParams = { bundesland: string; kreis: string; request: string };
type PageProps = { params: Promise<PageParams> };
type ContentProps = { bundesland: string; kreis: string; requestParam: string; locale?: string };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { bundesland, kreis, request } = await params;
  const { id } = parseRequestParam(request);
  const requestData = await getRegionalRequestByIdForKreis({
    bundeslandSlug: bundesland,
    kreisSlug: kreis,
    requestId: id,
    mode: "miete",
    locale: "de",
  });
  if (!requestData) return {};
  const title = requestData.seoTitle ?? requestData.seoH1 ?? requestData.title;
  const description = requestData.seoDescription ?? requestData.description ?? undefined;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      images: requestData.imageUrl ? [{ url: requestData.imageUrl }] : undefined,
    },
    twitter: {
      card: requestData.imageUrl ? "summary_large_image" : "summary",
      title,
      description,
      images: requestData.imageUrl ? [requestData.imageUrl] : undefined,
    },
  };
}

export async function MietgesuchKreisDetailPageContent({
  bundesland,
  kreis,
  requestParam,
  locale = "de",
}: ContentProps) {
  const normalizedLocale = normalizePublicLocale(locale);
  const { id } = parseRequestParam(requestParam);
  const requestData = await getRegionalRequestByIdForKreis({
    bundeslandSlug: bundesland,
    kreisSlug: kreis,
    requestId: id,
    mode: "miete",
    locale: normalizedLocale,
  });
  if (!requestData) notFound();

  const report = await getReportBySlugs([bundesland, kreis]);
  const marketRangeContext = buildRequestMarketRangeContext(report);
  const meta = asRecord(asArray(report?.meta)[0] ?? report?.meta) ?? {};
  const kreisName = getRegionDisplayName({ meta, level: "kreis", fallbackSlug: kreis });
  const bundeslandName = asString(meta["bundesland_name"]) ?? formatRegionFallback(bundesland);
  const rawBasePath = `/immobilienmarkt/${bundesland}/${kreis}`;
  const basePath = normalizedLocale === "de" ? rawBasePath : buildLocalizedHref(normalizedLocale, rawBasePath);
  const listPath = `${basePath}/mietgesuche`;
  const tabs = [...IMMOBILIENMARKT_THEME.tabsByLevel.kreis, { id: "mietgesuche", label: normalizedLocale === "de" ? "Mietgesuche" : "Rental requests" }];
  const texts = await getPortalSystemTexts(normalizedLocale);
  const formatProfile = await loadPortalFormatProfile(normalizedLocale);

  return (
    <RequestDetailPage
      request={requestData}
      marketRangeContext={marketRangeContext}
      mode="miete"
      texts={texts}
      formatProfile={formatProfile}
      locale={normalizedLocale}
      listPath={listPath}
      breadcrumb={{
        tabs,
        activeTabId: "mietgesuche",
        basePath,
        ctx: { bundeslandSlug: bundesland, kreisSlug: kreis },
        names: { bundeslandName, kreisName, regionName: kreisName },
      }}
    />
  );
}

export default async function MietgesuchKreisDetailPage({ params }: PageProps) {
  const { bundesland, kreis, request } = await params;
  return MietgesuchKreisDetailPageContent({ bundesland, kreis, requestParam: request, locale: "de" });
}
