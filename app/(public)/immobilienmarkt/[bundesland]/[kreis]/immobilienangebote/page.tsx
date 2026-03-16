import { AngebotePage } from "@/components/angebote/AngebotePage";
import { IMMOBILIENMARKT_THEME } from "@/features/immobilienmarkt/config/theme";
import { getOffers } from "@/lib/angebote";
import { getReportBySlugs } from "@/lib/data";
import { getPortalSystemTexts } from "@/lib/portal-system-texts";
import { buildLocalizedHref, normalizePublicLocale } from "@/lib/public-locale-routing";
import { formatRegionFallback, getRegionDisplayName } from "@/utils/regionName";
import { asArray, asRecord, asString } from "@/utils/records";
import { slugifyOfferTitle } from "@/utils/slug";

type PageParams = { bundesland: string; kreis: string };
type PageProps = { params: Promise<PageParams>; searchParams?: Promise<{ page?: string }> };
type ContentProps = {
  bundesland: string;
  kreis: string;
  page?: number;
  locale?: string;
};

const PAGE_SIZE = 10;

export async function ImmobilienangeboteKreisPageContent({
  bundesland,
  kreis,
  page = 1,
  locale = "de",
}: ContentProps) {
  const normalizedLocale = normalizePublicLocale(locale);
  const texts = getPortalSystemTexts(normalizedLocale);
  const localizeHref = (path: string) =>
    normalizedLocale === "de" ? path : buildLocalizedHref(normalizedLocale, path);
  const { offers, topOffers, total, totalWithTop, sourceTotal } = await getOffers({
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
  const bundeslandName =
    asString(meta["bundesland_name"]) ?? formatRegionFallback(bundesland);
  const rawBasePath = `/immobilienmarkt/${bundesland}/${kreis}`;
  const germanListPath = `${rawBasePath}/immobilienangebote`;
  const basePath = localizeHref(rawBasePath);
  const listPath = `${basePath}/immobilienangebote`;
  const availabilityNotice = normalizedLocale !== "de" && total === 0 && sourceTotal > 0
    ? {
        title: texts.offers_unavailable_title,
        body: texts.offers_unavailable_body,
        ctaHref: germanListPath,
        ctaLabel: texts.view_german_offers,
      }
    : null;
  const tabs = [
    ...IMMOBILIENMARKT_THEME.tabsByLevel.kreis,
    { id: "immobilienangebote", label: texts.buy_offers },
  ];
  const itemListJsonLd = normalizedLocale === "de"
    ? JSON.stringify({
        "@context": "https://schema.org",
        "@type": "ItemList",
        itemListOrder: "https://schema.org/ItemListOrderDescending",
        name: `${texts.buy_offers} ${kreisName}`,
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
      offersHeading={`${texts.buy_offers} ${kreisName}`}
      offers={offers}
      topOffers={topOffers}
      mode="kauf"
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
      activeTabId="immobilienangebote"
      basePath={basePath}
      ctx={{ bundeslandSlug: bundesland, kreisSlug: kreis }}
      names={{ bundeslandName, kreisName, regionName: kreisName }}
      locale={normalizedLocale}
      availabilityNotice={availabilityNotice}
    />
  );
}

export default async function ImmobilienangebotePage({
  params,
  searchParams,
}: PageProps) {
  const { bundesland, kreis } = await params;
  const rawPage = await (await searchParams)?.page;
  const page = rawPage ? Number(rawPage) : 1;
  return ImmobilienangeboteKreisPageContent({ bundesland, kreis, page, locale: "de" });
}
