import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

import { ImmobilienberatungSection } from "@/features/immobilienmarkt/sections/ImmobilienberatungSection";
import { KontaktContextSetter } from "@/components/kontakt/KontaktContextSetter";
import { asArray, asRecord, asString } from "@/utils/records";
import { formatRegionFallback } from "@/utils/regionName";
import { TabNav } from "@/features/immobilienmarkt/shared/TabNav";
import { IMMOBILIENMARKT_THEME } from "@/features/immobilienmarkt/config/theme";
import { createAdminClient } from "@/utils/supabase/admin";
import { resolveMandatoryMediaSrc } from "@/lib/mandatory-media";
import { getPortalSystemTexts } from "@/lib/portal-system-texts";
import { createClient } from "@/utils/supabase/server";
import { getAdminRoleForUser } from "@/lib/security/admin-auth";
import { getReportBySlugs } from "@/lib/data";
import { loadPreviewAccessForArea } from "@/lib/public-partner-mappings";
import { buildPageModel } from "@/features/immobilienmarkt/page/buildPageModel";
import type { RouteModel } from "@/features/immobilienmarkt/types/route";

type PageParams = { bundesland?: string; kreis?: string };
type PageProps = { params: Promise<PageParams> };

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
  return {
    robots: { index: false, follow: false },
  };
}

async function requirePreviewAccess(route: RouteModel, userId: string): Promise<void> {
  const report = await getReportBySlugs(route.regionSlugs);
  if (!report) notFound();

  const meta = asRecord(asArray(report.meta)[0] ?? report.meta) ?? {};
  const areaId = (asString(meta["kreis_schluessel"]) ?? asString(meta["ortslage_schluessel"]) ?? "").trim();
  if (!areaId) notFound();

  const adminRole = getAdminRoleForUser(userId);
  const admin = createAdminClient();
  const previewAccess = await loadPreviewAccessForArea(admin, areaId);
  if (previewAccess.status !== "preview" || !previewAccess.partnerId) {
    notFound();
  }

  if (!adminRole && previewAccess.partnerId !== userId) {
    notFound();
  }
}

export default async function PreviewImmobilienberatungPage({ params }: PageProps) {
  const resolvedParams = await params;
  const bundeslandSlug = resolvedParams.bundesland ?? "";
  const kreisSlug = resolvedParams.kreis ?? "";

  if (!bundeslandSlug || !kreisSlug) notFound();

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    redirect("/partner/login");
  }

  const route: RouteModel = {
    level: "kreis",
    section: "uebersicht",
    regionSlugs: [bundeslandSlug, kreisSlug],
    fullSlugs: [bundeslandSlug, kreisSlug],
  };

  await requirePreviewAccess(route, user.id);

  const pageModel = await buildPageModel(route, {
    audience: "preview",
    pathPrefix: "/preview/immobilienmarkt",
    locale: "de",
  });
  if (!pageModel || pageModel.flags?.isSystemDefaultPartner) notFound();

  const meta = asRecord(asArray(pageModel.report.meta)[0] ?? pageModel.report.meta) ?? {};
  const text = asRecord(pageModel.report["text"]) ?? asRecord(asRecord(pageModel.report.data)?.["text"]) ?? {};
  const berater = asRecord(text["berater"]) ?? {};
  const kreisName = asString(meta["kreis_name"]) ?? formatRegionFallback(kreisSlug);
  const bundeslandNameRaw = asString(meta["bundesland_name"]) ?? "";
  const bundeslandName = bundeslandNameRaw ? formatRegionFallback(bundeslandNameRaw) : formatRegionFallback(bundeslandSlug);
  const name = asString(berater["berater_name"]) ?? "Berater";
  const avatarOverride = asString(berater["media_berater_avatar"]) ?? "";
  const email = asString(berater["berater_email"]) ?? "kontakt@wohnlagencheck24.de";
  const phone =
    asString(berater["berater_telefon_mobil"]) ??
    asString(berater["berater_telefon_fest"]) ??
    asString(berater["berater_telefon"]) ??
    "";
  const tabs = IMMOBILIENMARKT_THEME.tabsByLevel.kreis ?? [];
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
      <TabNav
        tabs={tabs}
        activeTabId="uebersicht"
        basePath={pageModel.basePath}
        texts={texts}
        ctx={{ bundeslandSlug, kreisSlug }}
        names={{ regionName: kreisName, bundeslandName, kreisName }}
      />
      <ImmobilienberatungSection
        report={pageModel.report}
        bundeslandSlug={bundeslandSlug}
        kreisSlug={kreisSlug}
      />
    </>
  );
}
