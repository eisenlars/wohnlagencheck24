import { notFound } from "next/navigation";

import { getApprovedReportTexts, getReportBySlugs, type SupabaseClientLike } from "@/lib/data";
import { ImmobilienberatungSection } from "@/features/immobilienmarkt/sections/ImmobilienberatungSection";
import { KontaktContextSetter } from "@/components/kontakt/KontaktContextSetter";
import { asRecord, asString } from "@/utils/records";
import { formatRegionFallback } from "@/utils/regionName";
import { TabNav } from "@/features/immobilienmarkt/shared/TabNav";
import { IMMOBILIENMARKT_THEME } from "@/features/immobilienmarkt/config/theme";
import { createAdminClient } from "@/utils/supabase/admin";
import { resolveMandatoryMediaSrc } from "@/lib/mandatory-media";

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
    const partnerMapRes = (await admin
      .from("partner_area_map")
      .select("auth_user_id")
      .eq("area_id", areaId)
      .eq("is_active", true)) as { data?: Array<{ auth_user_id?: string | null }> | null };
    const partnerIds = Array.from(
      new Set(
        (partnerMapRes?.data ?? [])
          .map((row) => String(row?.auth_user_id ?? "").trim())
          .filter(Boolean),
      ),
    );
    const partnerId = partnerIds.length === 1 ? partnerIds[0] : null;
    if (partnerId) {
      const overrides = await getApprovedReportTexts(admin, areaId, partnerId);
      if (overrides.length > 0) {
        const textBase = asRecord(report["text"]) ?? {};
        const berater = asRecord(textBase["berater"]) ?? {};
        for (const entry of overrides) {
          const key = String(entry.section_key ?? "");
          const value = String(entry.optimized_content ?? "");
          if (key === "media_berater_avatar" && value) {
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
      <TabNav
        tabs={tabs}
        activeTabId="uebersicht"
        basePath={basePath}
        ctx={{ bundeslandSlug, kreisSlug }}
        names={{ regionName: kreisName, bundeslandName, kreisName }}
      />
      <ImmobilienberatungSection
        report={reportWithMedia}
        bundeslandSlug={bundeslandSlug}
        kreisSlug={kreisSlug}
      />
    </>
  );
}
