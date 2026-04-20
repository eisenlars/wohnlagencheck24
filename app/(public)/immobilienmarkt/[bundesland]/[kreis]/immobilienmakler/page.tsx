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
import { loadPublicVisiblePartnerContextForArea } from "@/lib/public-partner-mappings";
import { getPortalSystemTexts } from "@/lib/portal-system-texts";

type PageParams = { bundesland?: string; kreis?: string };
type PageProps = { params: Promise<PageParams> };

function firstNonEmpty(...values: Array<string | undefined | null>): string | null {
  for (const value of values) {
    const normalized = String(value ?? "").trim();
    if (normalized) return normalized;
  }
  return null;
}

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
    const partnerContext = await loadPublicVisiblePartnerContextForArea(admin, areaId);
    if (partnerContext.isSystemDefault) {
      notFound();
    }
    if (partnerContext.partnerId) {
      const overrides = await getApprovedReportTexts(admin, areaId, partnerContext.partnerId);
      if (overrides.length > 0) {
        const textBase = asRecord(report["text"]) ?? {};
        const makler = asRecord(textBase["makler"]) ?? {};
        for (const entry of overrides) {
          const key = String(entry.section_key ?? "");
          const value = String(entry.optimized_content ?? "");
          if ((key.startsWith("makler_") || key.startsWith("media_makler_")) && value) {
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
  const name = firstNonEmpty(asString(makler["makler_name"])) ?? "Maklerempfehlung";
  const logoOverride = asString(makler["media_makler_logo"]) ?? "";
  const email =
    firstNonEmpty(
      asString(makler["makler_email"]),
      asString(berater["berater_email"]),
    ) ??
    "kontakt@wohnlagencheck24.de";

  const basePath = `/immobilienmarkt/${bundeslandSlug}/${kreisSlug}`;
  const tabs = IMMOBILIENMARKT_THEME.tabsByLevel.kreis ?? [];
  const references = await getRandomReferencesForKreis({
    bundeslandSlug,
    kreisSlug,
    limit: 6,
  });
  const texts = await getPortalSystemTexts("de");

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
        texts={texts}
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
