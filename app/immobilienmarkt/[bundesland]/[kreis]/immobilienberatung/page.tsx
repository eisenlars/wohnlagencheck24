import { notFound } from "next/navigation";

import { getReportBySlugs } from "@/lib/data";
import { buildWebAssetUrl } from "@/utils/assets";
import { ImmobilienberatungSection } from "@/features/immobilienmarkt/sections/ImmobilienberatungSection";
import { KontaktContextSetter } from "@/components/kontakt/KontaktContextSetter";
import { asRecord, asString } from "@/utils/records";
import { formatRegionFallback } from "@/utils/regionName";
import { TabNav } from "@/features/immobilienmarkt/shared/TabNav";
import { IMMOBILIENMARKT_THEME } from "@/features/immobilienmarkt/config/theme";

type PageParams = { bundesland?: string; kreis?: string };
type PageProps = { params: Promise<PageParams> };

export default async function ImmobilienberatungPage({ params }: PageProps) {
  const resolvedParams = await params;
  const bundeslandSlug = resolvedParams.bundesland ?? "";
  const kreisSlug = resolvedParams.kreis ?? "";

  if (!bundeslandSlug || !kreisSlug) notFound();

  const report = await getReportBySlugs([bundeslandSlug, kreisSlug]);
  if (!report) notFound();

  const meta = asRecord(report.meta) ?? {};
  const kreisName = asString(meta["kreis_name"]) ?? formatRegionFallback(kreisSlug);
  const bundeslandNameRaw = asString(meta["bundesland_name"]) ?? "";
  const bundeslandName = bundeslandNameRaw ? formatRegionFallback(bundeslandNameRaw) : formatRegionFallback(bundeslandSlug);
  const text = asRecord(report["text"]) ?? {};
  const berater = asRecord(text["berater"]) ?? {};
  const name = asString(berater["berater_name"]) ?? "Berater";
  const email =
    asString(berater["berater_email"]) ??
    "kontakt@wohnlagencheck24.de";
  const phone =
    asString(berater["berater_telefon"]) ??
    "";

  const basePath = `/immobilienmarkt/${bundeslandSlug}/${kreisSlug}`;
  const tabs = IMMOBILIENMARKT_THEME.tabsByLevel.kreis ?? [];

  return (
    <>
      <KontaktContextSetter
        vm={{
          scope: "berater",
          title: "Beraterkontakt",
          name,
          email,
          phone,
          imageSrc: buildWebAssetUrl(
            `/images/immobilienmarkt/${bundeslandSlug}/${kreisSlug}/immobilienberatung-${kreisSlug}.png`,
          ),
          regionLabel: `Standort- / Immobilienberatung – ${kreisName}`,
          subjectDefault: `Kontaktanfrage – ${kreisName}`,
        }}
      />
      <TabNav
        tabs={tabs}
        activeTabId="uebersicht"
        basePath={basePath}
        ctx={{ bundeslandSlug, kreisSlug }}
        names={{ regionName: kreisName, bundeslandName, kreisName }}
      />
      <ImmobilienberatungSection
        report={report}
        bundeslandSlug={bundeslandSlug}
        kreisSlug={kreisSlug}
      />
    </>
  );
}
