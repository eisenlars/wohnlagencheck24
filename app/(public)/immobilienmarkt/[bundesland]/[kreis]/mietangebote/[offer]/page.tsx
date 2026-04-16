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

type PageParams = { bundesland: string; kreis: string; offer: string };
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

export default async function MietangebotDetailPage({ params }: PageProps) {
  const { bundesland, kreis, offer } = await params;
  const { id } = parseOfferParam(offer);
  const offerData = await getOfferById(id);

  if (!offerData) notFound();

  const report = await getReportBySlugs([bundesland, kreis]);
  const meta = asRecord(asArray(report?.meta)[0] ?? report?.meta) ?? {};
  const kreisName = getRegionDisplayName({ meta, level: "kreis", fallbackSlug: kreis });
  const bundeslandName =
    asString(meta["bundesland_name"]) ?? formatRegionFallback(bundesland);
  const basePath = `/immobilienmarkt/${bundesland}/${kreis}`;
  const listPath = `${basePath}/mietangebote`;
  const pagePath = `${basePath}/mietangebote/${offer}`;
  const tabs = [
    ...IMMOBILIENMARKT_THEME.tabsByLevel.kreis,
    { id: "mietangebote", label: "Mietangebote" },
  ];
  const texts = await getPortalSystemTexts("de");
  const formatProfile = await loadPortalFormatProfile("de");
  const advisor = await resolvePublicAdvisorContact({ bundeslandSlug: bundesland, kreisSlug: kreis });

  return (
    <OfferDetailPage
      offer={offerData}
      mode="miete"
      texts={texts}
      formatProfile={formatProfile}
      pagePath={pagePath}
      advisor={{
        name: advisor?.brokerName ?? null,
        phone: advisor?.brokerPhone ?? null,
        logoUrl: advisor?.brokerLogoUrl ?? null,
        href: `${basePath}/immobilienmakler`,
      }}
      listPath={listPath}
      breadcrumb={{
        tabs,
        activeTabId: "mietangebote",
        basePath,
        ctx: { bundeslandSlug: bundesland, kreisSlug: kreis },
        names: { bundeslandName, kreisName, regionName: kreisName },
      }}
    />
  );
}
