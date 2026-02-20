import { GesuchePage } from "@/components/gesuche/GesuchePage";
import { IMMOBILIENMARKT_THEME } from "@/features/immobilienmarkt/config/theme";
import { getReportBySlugs } from "@/lib/data";
import { getRegionalRequestsForKreis } from "@/lib/gesuche";
import { formatRegionFallback, getRegionDisplayName } from "@/utils/regionName";
import { asArray, asRecord, asString } from "@/utils/records";

type PageParams = { bundesland: string; kreis: string };
type PageProps = { params: Promise<PageParams> };

export default async function MietgesucheKreisPage({ params }: PageProps) {
  const { bundesland, kreis } = await params;
  const requests = await getRegionalRequestsForKreis({
    bundeslandSlug: bundesland,
    kreisSlug: kreis,
    mode: "miete",
  });

  const report = await getReportBySlugs([bundesland, kreis]);
  const meta = asRecord(asArray(report?.meta)[0] ?? report?.meta) ?? {};
  const kreisName = getRegionDisplayName({ meta, level: "kreis", fallbackSlug: kreis });
  const bundeslandName = asString(meta["bundesland_name"]) ?? formatRegionFallback(bundesland);
  const basePath = `/immobilienmarkt/${bundesland}/${kreis}`;
  const tabs = [...IMMOBILIENMARKT_THEME.tabsByLevel.kreis, { id: "mietgesuche", label: "Mietgesuche" }];

  return (
    <GesuchePage
      heading={`Mietgesuche ${kreisName}`}
      requests={requests}
      mode="miete"
      tabs={tabs}
      activeTabId="mietgesuche"
      basePath={basePath}
      ctx={{ bundeslandSlug: bundesland, kreisSlug: kreis }}
      names={{ bundeslandName, kreisName, regionName: kreisName }}
    />
  );
}
