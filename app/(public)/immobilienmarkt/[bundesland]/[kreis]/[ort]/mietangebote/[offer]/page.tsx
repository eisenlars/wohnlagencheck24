import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { OfferDetailPage } from "@/components/angebote/OfferDetailPage";
import { IMMOBILIENMARKT_THEME } from "@/features/immobilienmarkt/config/theme";
import { getOfferById } from "@/lib/angebote";
import { getReportBySlugs } from "@/lib/data";
import { loadPortalFormatProfile } from "@/lib/portal-format-config";
import { getPortalSystemTexts } from "@/lib/portal-system-texts";
import { resolvePublicAdvisorContact } from "@/lib/public-advisor-contact";
import { formatRegionFallback, getRegionDisplayName } from "@/utils/regionName";
import { asArray, asRecord, asString } from "@/utils/records";
import { parseOfferParam } from "@/utils/slug";

type PageParams = { bundesland: string; kreis: string; ort: string; offer: string };
type PageProps = { params: Promise<PageParams> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { offer } = await params;
  const { id } = parseOfferParam(offer);
  const offerData = await getOfferById(id);
  if (!offerData) return {};
  const raw = (offerData.raw ?? {}) as Record<string, unknown>;
  const title =
    offerData.seoTitle ??
    offerData.seoH1 ??
    offerData.title ??
    "Mietangebot";
  const description =
    offerData.seoDescription ??
    offerData.shortDescription ??
    offerData.longDescription ??
    (typeof raw["description"] === "string" ? raw["description"] : undefined);
  const imageUrl =
    offerData.imageUrl && /^https?:\/\//i.test(offerData.imageUrl)
      ? offerData.imageUrl
      : undefined;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      images: imageUrl ? [{ url: imageUrl }] : undefined,
    },
    twitter: {
      card: imageUrl ? "summary_large_image" : "summary",
      title,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
  };
}

export default async function MietangebotOrtDetailPage({ params }: PageProps) {
  const { bundesland, kreis, ort, offer } = await params;
  const { id } = parseOfferParam(offer);
  const offerData = await getOfferById(id);

  if (!offerData) notFound();

  const kreisReport = await getReportBySlugs([bundesland, kreis]);
  const kreisMeta = asRecord(asArray(kreisReport?.meta)[0] ?? kreisReport?.meta) ?? {};
  const kreisName = getRegionDisplayName({ meta: kreisMeta, level: "kreis", fallbackSlug: kreis });
  const bundeslandName =
    asString(kreisMeta["bundesland_name"]) ?? formatRegionFallback(bundesland);
  const ortReport = await getReportBySlugs([bundesland, kreis, ort]);
  const ortMeta = asRecord(asArray(ortReport?.meta)[0] ?? ortReport?.meta) ?? {};
  const ortName = getRegionDisplayName({ meta: ortMeta, level: "ort", fallbackSlug: ort });
  const basePath = `/immobilienmarkt/${bundesland}/${kreis}/${ort}`;
  const listPath = `${basePath}/mietangebote`;
  const pagePath = `${basePath}/mietangebote/${offer}`;
  const tabs = [
    ...IMMOBILIENMARKT_THEME.tabsByLevel.ort,
    { id: "mietangebote", label: "Mietangebote" },
  ];
  const texts = await getPortalSystemTexts("de");
  const formatProfile = await loadPortalFormatProfile("de");
  const advisor = await resolvePublicAdvisorContact({ bundeslandSlug: bundesland, kreisSlug: kreis, ortSlug: ort });

  return (
    <OfferDetailPage
      offer={offerData}
      mode="miete"
      texts={texts}
      formatProfile={formatProfile}
      pagePath={pagePath}
      advisor={{
        name: advisor?.advisorName ?? null,
        phone: advisor?.advisorPhone ?? null,
        href: `/immobilienmarkt/${bundesland}/${kreis}/immobilienmakler`,
      }}
      listPath={listPath}
      breadcrumb={{
        tabs,
        activeTabId: "mietangebote",
        basePath,
        parentBasePath: `/immobilienmarkt/${bundesland}/${kreis}`,
        ctx: { bundeslandSlug: bundesland, kreisSlug: kreis, ortSlug: ort },
        names: { bundeslandName, kreisName, regionName: ortName },
      }}
    />
  );
}
