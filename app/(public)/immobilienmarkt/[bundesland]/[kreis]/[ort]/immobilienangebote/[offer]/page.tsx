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

type PageParams = { bundesland: string; kreis: string; ort: string; offer: string };
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

export default async function ImmobilienangebotOrtDetailPage({ params }: PageProps) {
  const { bundesland, kreis, ort, offer } = await params;
  const { id } = parseOfferParam(offer);
  const offerData = await getOfferById(id);

  if (!offerData) notFound();

  const effectiveSource = (offerData.source ?? "").trim() || "manual";
  const effectiveExternalId = (offerData.externalId ?? "").trim() || offerData.id;
  const overrides =
    offerData.partnerId && effectiveSource && effectiveExternalId
      ? await getOfferOverrides(offerData.partnerId, effectiveSource, effectiveExternalId)
      : null;

  const kreisReport = await getReportBySlugs([bundesland, kreis]);
  const kreisMeta = asRecord(asArray(kreisReport?.meta)[0] ?? kreisReport?.meta) ?? {};
  const kreisName = getRegionDisplayName({ meta: kreisMeta, level: "kreis", fallbackSlug: kreis });
  const bundeslandName =
    asString(kreisMeta["bundesland_name"]) ?? formatRegionFallback(bundesland);
  const ortReport = await getReportBySlugs([bundesland, kreis, ort]);
  const ortMeta = asRecord(asArray(ortReport?.meta)[0] ?? ortReport?.meta) ?? {};
  const ortName = getRegionDisplayName({ meta: ortMeta, level: "ort", fallbackSlug: ort });
  const basePath = `/immobilienmarkt/${bundesland}/${kreis}/${ort}`;
  const listPath = `${basePath}/immobilienangebote`;
  const tabs = [
    ...IMMOBILIENMARKT_THEME.tabsByLevel.ort,
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
        parentBasePath: `/immobilienmarkt/${bundesland}/${kreis}`,
        ctx: { bundeslandSlug: bundesland, kreisSlug: kreis, ortSlug: ort },
        names: { bundeslandName, kreisName, regionName: ortName },
      }}
    />
  );
}
