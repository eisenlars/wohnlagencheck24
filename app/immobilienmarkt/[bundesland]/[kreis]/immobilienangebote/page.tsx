import { AngebotePage } from "@/components/angebote/AngebotePage";
import { IMMOBILIENMARKT_THEME } from "@/features/immobilienmarkt/config/theme";
import { getOffers } from "@/lib/angebote";
import { getReportBySlugs } from "@/lib/data";
import { formatRegionFallback, getRegionDisplayName } from "@/utils/regionName";
import { asArray, asRecord, asString } from "@/utils/records";
import { slugifyOfferTitle } from "@/utils/slug";

type PageParams = { bundesland: string; kreis: string };
type PageProps = { params: Promise<PageParams>; searchParams?: Promise<{ page?: string }> };

const PAGE_SIZE = 10;

export default async function ImmobilienangebotePage({
  params,
  searchParams,
}: PageProps) {
  const { bundesland, kreis } = await params;
  const rawPage = await (await searchParams)?.page;
  const page = rawPage ? Number(rawPage) : 1;
  const { offers, topOffers, total, totalWithTop } = await getOffers({
    bundeslandSlug: bundesland,
    kreisSlug: kreis,
    mode: "kauf",
    page,
    pageSize: PAGE_SIZE,
  });

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
  const itemListJsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListOrder: "https://schema.org/ItemListOrderDescending",
    name: `Kaufangebote ${kreisName}`,
      itemListElement: offers.map((offer, index) => ({
        "@type": "ListItem",
        position: index + 1 + (Math.max(page, 1) - 1) * PAGE_SIZE,
        url: `${listPath}/${offer.id}_${slugifyOfferTitle(offer.title)}`,
        name: offer.title || "Immobilienangebot",
      })),
  });

  return (
    <AngebotePage
      offersHeading={`Kaufangebote ${kreisName}`}
      offers={offers}
      topOffers={topOffers}
      mode="kauf"
      detailBasePath={listPath}
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
    />
  );
}
