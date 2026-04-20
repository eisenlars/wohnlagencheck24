import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

import { ImmobilienmaklerSection } from "@/features/immobilienmarkt/sections/ImmobilienmaklerSection";
import { KontaktContextSetter } from "@/components/kontakt/KontaktContextSetter";
import { asArray, asRecord, asString } from "@/utils/records";
import { formatRegionFallback } from "@/utils/regionName";
import { ImmobilienmarktBreadcrumb } from "@/features/immobilienmarkt/shared/ImmobilienmarktBreadcrumb";
import { IMMOBILIENMARKT_THEME } from "@/features/immobilienmarkt/config/theme";
import { getVisibleReferencesForKreis } from "@/lib/referenzen";
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

export default async function PreviewImmobilienmaklerPage({ params }: PageProps) {
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
  const tabs = IMMOBILIENMARKT_THEME.tabsByLevel.kreis ?? [];
  const breadcrumbTabs = [
    ...tabs,
    { id: "immobilienmakler", label: "Immobilienmakler" },
  ];
  const references = await getVisibleReferencesForKreis({
    bundeslandSlug,
    kreisSlug,
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
      <div className="container text-dark">
        <div className="breadcrumb-sticky mb-3">
          <ImmobilienmarktBreadcrumb
            tabs={breadcrumbTabs}
            activeTabId="immobilienmakler"
            basePath={pageModel.basePath}
            texts={texts}
            ctx={{ bundeslandSlug, kreisSlug }}
            names={{ regionName: kreisName, bundeslandName, kreisName }}
            compact
            rootIconSrc="/logo/wohnlagencheck24.svg"
          />
        </div>
        <ImmobilienmaklerSection
          report={pageModel.report}
          kreisSlug={kreisSlug}
          references={references}
        />
      </div>
    </>
  );
}
