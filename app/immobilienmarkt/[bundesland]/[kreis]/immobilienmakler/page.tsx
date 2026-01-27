import { notFound } from "next/navigation";

import { getReportBySlugs } from "@/lib/data";
import { ImmobilienmaklerSection } from "@/features/immobilienmarkt/sections/ImmobilienmaklerSection";
import { KontaktContextSetter } from "@/components/kontakt/KontaktContextSetter";
import { asRecord, asString } from "@/utils/records";
import { formatRegionFallback } from "@/utils/regionName";
import { TabNav } from "@/features/immobilienmarkt/shared/TabNav";
import { IMMOBILIENMARKT_THEME } from "@/features/immobilienmarkt/config/theme";

type PageParams = { bundesland?: string; kreis?: string };
type PageProps = { params: Promise<PageParams> };

export default async function ImmobilienmaklerPage({ params }: PageProps) {
  const resolvedParams = await params;
  const bundeslandSlug = resolvedParams.bundesland ?? "";
  const kreisSlug = resolvedParams.kreis ?? "";

  if (!bundeslandSlug || !kreisSlug) notFound();

  const report = getReportBySlugs([bundeslandSlug, kreisSlug]);
  if (!report) notFound();

  const meta = asRecord(report.meta) ?? {};
  const text = asRecord(report["text"]) ?? {};
  const makler = asRecord(text["makler"]) ?? {};
  const berater = asRecord(text["berater"]) ?? {};
  const kreisName = asString(meta["kreis_name"]) ?? formatRegionFallback(kreisSlug);
  const bundeslandNameRaw = asString(meta["bundesland_name"]) ?? "";
  const bundeslandName = bundeslandNameRaw ? formatRegionFallback(bundeslandNameRaw) : formatRegionFallback(bundeslandSlug);
  const name = asString(makler["makler_name"]) ?? "Maklerempfehlung";
  const email =
    asString(makler["makler_email"]) ??
    asString(berater["berater_email"]) ??
    "kontakt@wohnlagencheck24.de";

  const basePath = `/immobilienmarkt/${bundeslandSlug}/${kreisSlug}`;
  const tabs = IMMOBILIENMARKT_THEME.tabsByLevel.kreis ?? [];

  return (
    <>
      <KontaktContextSetter
        vm={{
          scope: "makler",
          title: "Maklerkontakt",
          name,
          email,
          imageSrc: `/images/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/makler-${kreisSlug}-logo.jpg`,
          regionLabel: `Maklerempfehlung – ${kreisSlug}`,
          subjectDefault: `Makleranfrage – ${kreisSlug}`,
        }}
      />
      <TabNav
        tabs={tabs}
        activeTabId="uebersicht"
        basePath={basePath}
        ctx={{ bundeslandSlug, kreisSlug }}
        names={{ regionName: kreisName, bundeslandName, kreisName }}
      />
      <ImmobilienmaklerSection
        report={report}
        bundeslandSlug={bundeslandSlug}
        kreisSlug={kreisSlug}
      />
    </>
  );
}
