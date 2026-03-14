import { notFound } from "next/navigation";

import { getApprovedReportTexts, getReportBySlugs, type SupabaseClientLike } from "@/lib/data";
import { ImmobilienmaklerSection } from "@/features/immobilienmarkt/sections/ImmobilienmaklerSection";
import { KontaktContextSetter } from "@/components/kontakt/KontaktContextSetter";
import { asRecord, asString } from "@/utils/records";
import { formatRegionFallback } from "@/utils/regionName";
import { TabNav } from "@/features/immobilienmarkt/shared/TabNav";
import { IMMOBILIENMARKT_THEME } from "@/features/immobilienmarkt/config/theme";
import { getRandomReferencesForKreis } from "@/lib/referenzen";
import { createAdminClient } from "@/utils/supabase/admin";
import { resolveMandatoryMediaSrc } from "@/lib/mandatory-media";
import { loadSinglePublicVisiblePartnerIdForArea } from "@/lib/public-partner-mappings";

type PageParams = { bundesland?: string; kreis?: string };
type PageProps = { params: Promise<PageParams> };

export default async function ImmobilienmaklerPage({ params }: PageProps) {
  const resolvedParams = await params;
  const bundeslandSlug = resolvedParams.bundesland ?? "";
  const kreisSlug = resolvedParams.kreis ?? "";

  if (!bundeslandSlug || !kreisSlug) notFound();

  const report = await getReportBySlugs([bundeslandSlug, kreisSlug]);
  if (!report) notFound();

  const meta = asRecord(report.meta) ?? {};
  let reportWithMedia = report;
  const areaId = asString(meta["kreis_schluessel"]) ?? "";
  if (areaId) {
    const admin = createAdminClient() as unknown as SupabaseClientLike & {
      from: (table: string) => {
        select: (columns: string) => {
          eq: (column: string, value: unknown) => {
            eq: (column: string, value: unknown) => Promise<{ data?: Array<{ auth_user_id?: string | null }> | null }>;
          };
        };
      };
    };
    const partnerId = await loadSinglePublicVisiblePartnerIdForArea(admin, areaId);
    if (partnerId) {
      const overrides = await getApprovedReportTexts(admin, areaId, partnerId);
      if (overrides.length > 0) {
        const textBase = asRecord(report["text"]) ?? {};
        const makler = asRecord(textBase["makler"]) ?? {};
        for (const entry of overrides) {
          const key = String(entry.section_key ?? "");
          const value = String(entry.optimized_content ?? "");
          if ((key === "media_makler_logo" || key === "media_makler_bild_01" || key === "media_makler_bild_02") && value) {
            makler[key] = value;
          }
        }
        reportWithMedia = {
          ...report,
          text: {
            ...textBase,
            makler,
          },
        };
      }
    }
  }

  const text = asRecord(reportWithMedia["text"]) ?? {};
  const makler = asRecord(text["makler"]) ?? {};
  const berater = asRecord(text["berater"]) ?? {};
  const kreisName = asString(meta["kreis_name"]) ?? formatRegionFallback(kreisSlug);
  const bundeslandNameRaw = asString(meta["bundesland_name"]) ?? "";
  const bundeslandName = bundeslandNameRaw ? formatRegionFallback(bundeslandNameRaw) : formatRegionFallback(bundeslandSlug);
  const name = asString(makler["makler_name"]) ?? "Maklerempfehlung";
  const logoOverride = asString(makler["media_makler_logo"]) ?? "";
  const email =
    asString(makler["makler_email"]) ??
    asString(berater["berater_email"]) ??
    "kontakt@wohnlagencheck24.de";

  const basePath = `/immobilienmarkt/${bundeslandSlug}/${kreisSlug}`;
  const tabs = IMMOBILIENMARKT_THEME.tabsByLevel.kreis ?? [];
  const references = await getRandomReferencesForKreis({
    bundeslandSlug,
    kreisSlug,
    limit: 6,
  });

  return (
    <>
      <KontaktContextSetter
        vm={{
          scope: "makler",
          title: "Maklerkontakt",
          name,
          email,
          imageSrc: resolveMandatoryMediaSrc("media_makler_logo", logoOverride),
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
        report={reportWithMedia}
        kreisSlug={kreisSlug}
        references={references}
      />
    </>
  );
}
