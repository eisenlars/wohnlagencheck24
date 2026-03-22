import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { OfferDetailPage } from "@/components/angebote/OfferDetailPage";
import { IMMOBILIENMARKT_THEME } from "@/features/immobilienmarkt/config/theme";
import { getOfferById, getOfferOverrides } from "@/lib/angebote";
import { getReportBySlugs } from "@/lib/data";
import { getPortalSystemTexts } from "@/lib/portal-system-texts";
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
  const effectiveSource = (offerData.source ?? "").trim() || "manual";
  const effectiveExternalId = (offerData.externalId ?? "").trim() || offerData.id;
  const overrides =
    offerData.partnerId && effectiveSource && effectiveExternalId
      ? await getOfferOverrides(offerData.partnerId, effectiveSource, effectiveExternalId)
      : null;
  const raw = (offerData.raw ?? {}) as Record<string, unknown>;
  const title =
    overrides?.seo_title ??
    overrides?.seo_h1 ??
    offerData.title ??
    "Immobilienangebot";
  const description =
    overrides?.seo_description ??
    overrides?.short_description ??
    overrides?.long_description ??
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

export default async function ImmobilienangebotDetailPage({ params }: PageProps) {
  const { bundesland, kreis, offer } = await params;
  const { id } = parseOfferParam(offer);
  const offerData = await getOfferById(id);

  if (!offerData) notFound();

  const effectiveSource = (offerData.source ?? "").trim() || "manual";
  const effectiveExternalId = (offerData.externalId ?? "").trim() || offerData.id;
  const overrides =
    offerData.partnerId && effectiveSource && effectiveExternalId
      ? await getOfferOverrides(offerData.partnerId, effectiveSource, effectiveExternalId)
      : null;

  const report = await getReportBySlugs([bundesland, kreis]);
  const meta = asRecord(asArray(report?.meta)[0] ?? report?.meta) ?? {};
  const kreisName = getRegionDisplayName({ meta, level: "kreis", fallbackSlug: kreis });
  const bundeslandName =
    asString(meta["bundesland_name"]) ?? formatRegionFallback(bundesland);
  const basePath = `/immobilienmarkt/${bundesland}/${kreis}`;
  const listPath = `${basePath}/immobilienangebote`;
  const tabs = [
    ...IMMOBILIENMARKT_THEME.tabsByLevel.kreis,
    { id: "immobilienangebote", label: "Immobilienangebote" },
  ];
  const texts = await getPortalSystemTexts("de");

  return (
    <OfferDetailPage
      offer={offerData}
      overrides={overrides}
      mode="kauf"
      texts={texts}
      listPath={listPath}
      breadcrumb={{
        tabs,
        activeTabId: "immobilienangebote",
        basePath,
        ctx: { bundeslandSlug: bundesland, kreisSlug: kreis },
        names: { bundeslandName, kreisName, regionName: kreisName },
      }}
    />
  );
}
