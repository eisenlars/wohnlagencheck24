import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { RequestDetailPage } from "@/components/gesuche/RequestDetailPage";
import { IMMOBILIENMARKT_THEME } from "@/features/immobilienmarkt/config/theme";
import { getReportBySlugs } from "@/lib/data";
import { loadPortalFormatProfile } from "@/lib/portal-format-config";
import { getPortalSystemTexts } from "@/lib/portal-system-texts";
import { buildLocalizedHref, normalizePublicLocale } from "@/lib/public-locale-routing";
import { getRegionalRequestByIdForOrtslage } from "@/lib/request-detail";
import { formatRegionFallback, getRegionDisplayName } from "@/utils/regionName";
import { asArray, asRecord, asString } from "@/utils/records";
import { parseRequestParam } from "@/utils/slug";

type PageParams = { bundesland: string; kreis: string; ort: string; request: string };
type PageProps = { params: Promise<PageParams> };
type ContentProps = { bundesland: string; kreis: string; ort: string; requestParam: string; locale?: string };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { bundesland, kreis, ort, request } = await params;
  const { id } = parseRequestParam(request);
  const requestData = await getRegionalRequestByIdForOrtslage({
    bundeslandSlug: bundesland,
    kreisSlug: kreis,
    ortSlug: ort,
    requestId: id,
    mode: "kauf",
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

async function ImmobiliengesuchOrtDetailPageContent({
  bundesland,
  kreis,
  ort,
  requestParam,
  locale = "de",
}: ContentProps) {
  const normalizedLocale = normalizePublicLocale(locale);
  const { id } = parseRequestParam(requestParam);
  const requestData = await getRegionalRequestByIdForOrtslage({
    bundeslandSlug: bundesland,
    kreisSlug: kreis,
    ortSlug: ort,
    requestId: id,
    mode: "kauf",
    locale: normalizedLocale,
  });
  if (!requestData) notFound();

  const kreisReport = await getReportBySlugs([bundesland, kreis]);
  const kreisMeta = asRecord(asArray(kreisReport?.meta)[0] ?? kreisReport?.meta) ?? {};
  const kreisName = getRegionDisplayName({ meta: kreisMeta, level: "kreis", fallbackSlug: kreis });
  const bundeslandName = asString(kreisMeta["bundesland_name"]) ?? formatRegionFallback(bundesland);
  const ortReport = await getReportBySlugs([bundesland, kreis, ort]);
  const ortMeta = asRecord(asArray(ortReport?.meta)[0] ?? ortReport?.meta) ?? {};
  const ortName = getRegionDisplayName({ meta: ortMeta, level: "ort", fallbackSlug: ort });

  const rawBasePath = `/immobilienmarkt/${bundesland}/${kreis}/${ort}`;
  const rawParentBasePath = `/immobilienmarkt/${bundesland}/${kreis}`;
  const basePath = normalizedLocale === "de" ? rawBasePath : buildLocalizedHref(normalizedLocale, rawBasePath);
  const listPath = `${basePath}/immobiliengesuche`;
  const tabs = [...IMMOBILIENMARKT_THEME.tabsByLevel.ort, { id: "immobiliengesuche", label: normalizedLocale === "de" ? "Kaufgesuche" : "Buy requests" }];
  const texts = await getPortalSystemTexts(normalizedLocale);
  const formatProfile = await loadPortalFormatProfile(normalizedLocale);

  return (
    <RequestDetailPage
      request={requestData}
      mode="kauf"
      texts={texts}
      formatProfile={formatProfile}
      locale={normalizedLocale}
      listPath={listPath}
      breadcrumb={{
        tabs,
        activeTabId: "immobiliengesuche",
        basePath,
        parentBasePath: normalizedLocale === "de" ? rawParentBasePath : buildLocalizedHref(normalizedLocale, rawParentBasePath),
        ctx: { bundeslandSlug: bundesland, kreisSlug: kreis, ortSlug: ort },
        names: { bundeslandName, kreisName, regionName: ortName },
      }}
    />
  );
}

export default async function ImmobiliengesuchOrtDetailPage({ params }: PageProps) {
  const { bundesland, kreis, ort, request } = await params;
  return ImmobiliengesuchOrtDetailPageContent({ bundesland, kreis, ort, requestParam: request, locale: "de" });
}
