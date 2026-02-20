import { GesuchePage } from "@/components/gesuche/GesuchePage";
import { IMMOBILIENMARKT_THEME } from "@/features/immobilienmarkt/config/theme";
import { getReportBySlugs } from "@/lib/data";
import { getRegionalRequestsForOrtslage } from "@/lib/gesuche";
import { formatRegionFallback, getRegionDisplayName } from "@/utils/regionName";
import { asArray, asRecord, asString } from "@/utils/records";

type PageParams = { bundesland: string; kreis: string; ort: string };
type PageProps = { params: Promise<PageParams> };

export default async function MietgesucheOrtPage({ params }: PageProps) {
  const { bundesland, kreis, ort } = await params;

  const requests = await getRegionalRequestsForOrtslage({
    bundeslandSlug: bundesland,
    kreisSlug: kreis,
    ortSlug: ort,
    mode: "miete",
  });

  const kreisReport = await getReportBySlugs([bundesland, kreis]);
  const kreisMeta = asRecord(asArray(kreisReport?.meta)[0] ?? kreisReport?.meta) ?? {};
  const kreisName = getRegionDisplayName({ meta: kreisMeta, level: "kreis", fallbackSlug: kreis });
  const bundeslandName = asString(kreisMeta["bundesland_name"]) ?? formatRegionFallback(bundesland);

  const ortReport = await getReportBySlugs([bundesland, kreis, ort]);
  const ortMeta = asRecord(asArray(ortReport?.meta)[0] ?? ortReport?.meta) ?? {};
  const ortName = getRegionDisplayName({ meta: ortMeta, level: "ort", fallbackSlug: ort });

  const basePath = `/immobilienmarkt/${bundesland}/${kreis}/${ort}`;
  const tabs = [...IMMOBILIENMARKT_THEME.tabsByLevel.ort, { id: "mietgesuche", label: "Mietgesuche" }];

  return (
    <GesuchePage
      heading={`Mietgesuche ${ortName}`}
      requests={requests}
      mode="miete"
      tabs={tabs}
      activeTabId="mietgesuche"
      basePath={basePath}
      parentBasePath={`/immobilienmarkt/${bundesland}/${kreis}`}
      ctx={{ bundeslandSlug: bundesland, kreisSlug: kreis, ortSlug: ort }}
      names={{ bundeslandName, kreisName, regionName: ortName }}
    />
  );
}
