import { AngebotePage } from "@/components/angebote/AngebotePage";
import { IMMOBILIENMARKT_THEME } from "@/features/immobilienmarkt/config/theme";
import { getOffers } from "@/lib/angebote";
import { getReportBySlugs } from "@/lib/data";
import { getPortalSystemTexts } from "@/lib/portal-system-texts";
import { buildLocalizedHref, normalizePublicLocale } from "@/lib/public-locale-routing";
import { formatRegionFallback, getRegionDisplayName } from "@/utils/regionName";
import { asArray, asRecord, asString } from "@/utils/records";
import { slugifyOfferTitle } from "@/utils/slug";

type PageParams = { bundesland: string; kreis: string; ort: string };
type PageProps = { params: Promise<PageParams>; searchParams?: Promise<{ page?: string }> };
type ContentProps = {
  bundesland: string;
  kreis: string;
  ort: string;
  page?: number;
  locale?: string;
};

const PAGE_SIZE = 10;

export async function MietangeboteOrtPageContent({
  bundesland,
  kreis,
  ort,
  page = 1,
  locale = "de",
}: ContentProps) {
  const normalizedLocale = normalizePublicLocale(locale);
  const texts = await getPortalSystemTexts(normalizedLocale);
  const localizeHref = (path: string) =>
    normalizedLocale === "de" ? path : buildLocalizedHref(normalizedLocale, path);
  const { offers, topOffers, total, totalWithTop, sourceTotal } = await getOffers({
    bundeslandSlug: bundesland,
    kreisSlug: kreis,
    mode: "miete",
    page,
    pageSize: PAGE_SIZE,
    locale: normalizedLocale,
  });

  const kreisReport = await getReportBySlugs([bundesland, kreis]);
  const kreisMeta = asRecord(asArray(kreisReport?.meta)[0] ?? kreisReport?.meta) ?? {};
  const kreisName = getRegionDisplayName({ meta: kreisMeta, level: "kreis", fallbackSlug: kreis });
  const bundeslandName =
    asString(kreisMeta["bundesland_name"]) ?? formatRegionFallback(bundesland);
  const ortReport = await getReportBySlugs([bundesland, kreis, ort]);
  const ortMeta = asRecord(asArray(ortReport?.meta)[0] ?? ortReport?.meta) ?? {};
  const ortName = getRegionDisplayName({ meta: ortMeta, level: "ort", fallbackSlug: ort });
  const rawBasePath = `/immobilienmarkt/${bundesland}/${kreis}/${ort}`;
  const rawParentBasePath = `/immobilienmarkt/${bundesland}/${kreis}`;
  const germanListPath = `${rawBasePath}/mietangebote`;
  const basePath = localizeHref(rawBasePath);
  const listPath = `${basePath}/mietangebote`;
  const availabilityNotice = normalizedLocale !== "de" && total === 0 && sourceTotal > 0
    ? {
        title: texts.offers_unavailable_title,
        body: texts.offers_unavailable_body,
        ctaHref: germanListPath,
        ctaLabel: texts.view_german_offers,
      }
    : null;
  const tabs = [
    ...IMMOBILIENMARKT_THEME.tabsByLevel.ort,
    { id: "mietangebote", label: texts.rent_offers },
  ];
  const itemListJsonLd = normalizedLocale === "de"
    ? JSON.stringify({
        "@context": "https://schema.org",
        "@type": "ItemList",
        itemListOrder: "https://schema.org/ItemListOrderDescending",
        name: `${texts.rent_offers} ${kreisName}`,
        itemListElement: offers.map((offer, index) => ({
          "@type": "ListItem",
          position: index + 1 + (Math.max(page, 1) - 1) * PAGE_SIZE,
          url: `${listPath}/${offer.id}_${slugifyOfferTitle(offer.title)}`,
          name: offer.title || texts.object_generic,
        })),
      })
    : undefined;

  return (
    <AngebotePage
      offersHeading={`${texts.rent_offers} ${kreisName}`}
      offers={offers}
      topOffers={topOffers}
      mode="miete"
      detailBasePath={normalizedLocale === "de" ? listPath : null}
      pagination={{
        page: Math.max(page, 1),
        pageSize: PAGE_SIZE,
        total,
        basePath: listPath,
      }}
      totalWithTop={totalWithTop}
      itemListJsonLd={itemListJsonLd}
      tabs={tabs}
      activeTabId="mietangebote"
      basePath={basePath}
      parentBasePath={localizeHref(rawParentBasePath)}
      ctx={{ bundeslandSlug: bundesland, kreisSlug: kreis, ortSlug: ort }}
      names={{ bundeslandName, kreisName, regionName: ortName }}
      texts={texts}
      locale={normalizedLocale}
      availabilityNotice={availabilityNotice}
    />
  );
}

export default async function MietangeboteOrtPage({
  params,
  searchParams,
}: PageProps) {
  const { bundesland, kreis, ort } = await params;
  const rawPage = await (await searchParams)?.page;
  const page = rawPage ? Number(rawPage) : 1;
  return MietangeboteOrtPageContent({ bundesland, kreis, ort, page, locale: "de" });
}
