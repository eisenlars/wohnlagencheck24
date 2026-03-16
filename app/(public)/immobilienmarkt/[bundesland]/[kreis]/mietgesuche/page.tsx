import { GesuchePage } from "@/components/gesuche/GesuchePage";
import { IMMOBILIENMARKT_THEME } from "@/features/immobilienmarkt/config/theme";
import { getReportBySlugs } from "@/lib/data";
import { getRegionalRequestsForKreis } from "@/lib/gesuche";
import { getPortalSystemTexts } from "@/lib/portal-system-texts";
import { buildLocalizedHref, normalizePublicLocale } from "@/lib/public-locale-routing";
import { formatRegionFallback, getRegionDisplayName } from "@/utils/regionName";
import { asArray, asRecord, asString } from "@/utils/records";

type PageParams = { bundesland: string; kreis: string };
type PageProps = { params: Promise<PageParams> };
type ContentProps = { bundesland: string; kreis: string; locale?: string };

export async function MietgesucheKreisPageContent({
  bundesland,
  kreis,
  locale = "de",
}: ContentProps) {
  const normalizedLocale = normalizePublicLocale(locale);
  const texts = getPortalSystemTexts(normalizedLocale);
  const localizeHref = (path: string) =>
    normalizedLocale === "de" ? path : buildLocalizedHref(normalizedLocale, path);
  const requests = await getRegionalRequestsForKreis({
    bundeslandSlug: bundesland,
    kreisSlug: kreis,
    mode: "miete",
    locale: normalizedLocale,
  });

  const report = await getReportBySlugs([bundesland, kreis]);
  const meta = asRecord(asArray(report?.meta)[0] ?? report?.meta) ?? {};
  const kreisName = getRegionDisplayName({ meta, level: "kreis", fallbackSlug: kreis });
  const bundeslandName = asString(meta["bundesland_name"]) ?? formatRegionFallback(bundesland);
  const basePath = localizeHref(`/immobilienmarkt/${bundesland}/${kreis}`);
  const tabs = [...IMMOBILIENMARKT_THEME.tabsByLevel.kreis, { id: "mietgesuche", label: texts.rent_requests }];

  return (
    <GesuchePage
      heading={`${texts.rent_requests} ${kreisName}`}
      requests={requests}
      mode="miete"
      tabs={tabs}
      activeTabId="mietgesuche"
      basePath={basePath}
      ctx={{ bundeslandSlug: bundesland, kreisSlug: kreis }}
      names={{ bundeslandName, kreisName, regionName: kreisName }}
      locale={normalizedLocale}
    />
  );
}

export default async function MietgesucheKreisPage({ params }: PageProps) {
  const { bundesland, kreis } = await params;
  return MietgesucheKreisPageContent({ bundesland, kreis, locale: "de" });
}
