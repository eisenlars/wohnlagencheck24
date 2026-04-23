import { notFound } from "next/navigation";

import { getApprovedReportTexts, getReportBySlugs, type SupabaseClientLike } from "@/lib/data";
import { ImmobilienberatungSection } from "@/features/immobilienmarkt/sections/ImmobilienberatungSection";
import { KontaktContextSetter } from "@/components/kontakt/KontaktContextSetter";
import { asRecord, asString } from "@/utils/records";
import { formatRegionFallback } from "@/utils/regionName";
import { ImmobilienmarktBreadcrumb } from "@/features/immobilienmarkt/shared/ImmobilienmarktBreadcrumb";
import { IMMOBILIENMARKT_THEME } from "@/features/immobilienmarkt/config/theme";
import { createAdminClient } from "@/utils/supabase/admin";
import { resolveMandatoryMediaSrc } from "@/lib/mandatory-media";
import {
  loadPublicVisibleAreaOptionsForPartner,
  loadPublicVisiblePartnerContextForArea,
} from "@/lib/public-partner-mappings";
import { getPortalSystemTexts } from "@/lib/portal-system-texts";

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
  let reportWithMedia = report;
  let advisorRegionLinks: Array<{ label: string; href: string }> = [];
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
      const areaOptions = await loadPublicVisibleAreaOptionsForPartner(admin, partnerContext.partnerId);
      advisorRegionLinks = areaOptions.flatMap((option) => (
        option.href ? [{ label: option.label, href: option.href }] : []
      ));
      if (overrides.length > 0) {
        const textBase = asRecord(report["text"]) ?? {};
        const berater = asRecord(textBase["berater"]) ?? {};
        for (const entry of overrides) {
          const key = String(entry.section_key ?? "");
          const value = String(entry.optimized_content ?? "");
          if ((key.startsWith("berater_") || key === "media_berater_avatar") && value) {
            berater[key] = value;
          }
        }
        reportWithMedia = {
          ...report,
          text: {
            ...textBase,
            berater,
          },
        };
      }
    }
  }

  const text = asRecord(reportWithMedia["text"]) ?? {};
  const berater = asRecord(text["berater"]) ?? {};
  const name = asString(berater["berater_name"]) ?? "Berater";
  const avatarOverride = asString(berater["media_berater_avatar"]) ?? "";
  const email =
    asString(berater["berater_email"]) ??
    "kontakt@wohnlagencheck24.de";
  const phone =
    asString(berater["berater_telefon_mobil"]) ??
    asString(berater["berater_telefon_fest"]) ??
    asString(berater["berater_telefon"]) ??
    "";

  const basePath = `/immobilienmarkt/${bundeslandSlug}/${kreisSlug}`;
  const tabs = IMMOBILIENMARKT_THEME.tabsByLevel.kreis ?? [];
  const breadcrumbTabs = [
    ...tabs,
    { id: "immobilienberatung", label: "Immobilienberatung" },
  ];
  const texts = await getPortalSystemTexts("de");

  return (
    <>
      <KontaktContextSetter
        vm={{
          scope: "berater",
          title: "Beraterkontakt",
          name,
          email,
          phone,
          imageSrc: resolveMandatoryMediaSrc("media_berater_avatar", avatarOverride),
          regionLabel: `Standort- / Immobilienberatung – ${kreisName}`,
          subjectDefault: `Kontaktanfrage – ${kreisName}`,
        }}
      />
      <div className="container text-dark">
        <div className="breadcrumb-sticky mb-3">
          <ImmobilienmarktBreadcrumb
            tabs={breadcrumbTabs}
            activeTabId="immobilienberatung"
            basePath={basePath}
            texts={texts}
            ctx={{ bundeslandSlug, kreisSlug }}
            names={{ regionName: kreisName, bundeslandName, kreisName }}
            compact
            rootIconSrc="/logo/wohnlagencheck24.svg"
          />
        </div>
        <ImmobilienberatungSection
          report={reportWithMedia}
          bundeslandSlug={bundeslandSlug}
          kreisSlug={kreisSlug}
          regionLinks={advisorRegionLinks}
        />
      </div>
    </>
  );
}
