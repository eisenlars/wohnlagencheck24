import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

import { resolveRoute } from "@/features/immobilienmarkt/routes/resolveRoute";
import { buildPageModel } from "@/features/immobilienmarkt/page/buildPageModel";
import { IMMOBILIENMARKT_REGISTRY } from "@/features/immobilienmarkt/page/registry";
import { KontaktContextSetter } from "@/components/kontakt/KontaktContextSetter";
import type { SectionComponent } from "@/features/immobilienmarkt/sections/types";
import { ValuationWizard } from "@/features/valuation/components/ValuationWizard";
import { asArray, asRecord, asString } from "@/utils/records";
import { toNumberOrNull } from "@/utils/toNumberOrNull";
import { getReportBySlugs } from "@/lib/data";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  loadPreviewAccessForArea,
  loadPreviewAreaOptionsForPartner,
} from "@/lib/public-partner-mappings";
import { getPortalSystemTexts } from "@/lib/portal-system-texts";
import { createClient } from "@/utils/supabase/server";
import { getAdminRoleForUser } from "@/lib/security/admin-auth";
import { resolveLeadGeneratorConfig } from "@/features/lead-generators/core/resolver";
import { VALUATION_RANGE_FLOW } from "@/features/lead-generators/valuation/flow";
import type { ValuationPriceContext } from "@/features/lead-generators/valuation/pricing";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageParams = { slug?: string[] };
type PageProps = { params: Promise<PageParams> };

export async function generateMetadata(): Promise<Metadata> {
  return {
    robots: { index: false, follow: false },
  };
}

function toPriceRange(
  row: Record<string, unknown> | null,
  keys: { min: string; avg: string; max: string },
) {
  if (!row) return null;
  const min = toNumberOrNull(row[keys.min]);
  const avg = toNumberOrNull(row[keys.avg]);
  const max = toNumberOrNull(row[keys.max]);
  if (min === null || avg === null || max === null) return null;
  return { min, avg, max };
}

async function requirePreviewAccess(route: ReturnType<typeof resolveRoute>, userId: string): Promise<void> {
  if (route.level !== "kreis" && route.level !== "ort") {
    notFound();
  }

  const report = await getReportBySlugs(route.regionSlugs);
  if (!report) notFound();

  const meta = asRecord(asArray(report.meta)[0] ?? report.meta) ?? {};
  const scopedAreaId = route.level === "ort"
    ? (asString(meta["kreis_schluessel"]) ?? asString(meta["ortslage_schluessel"]) ?? "")
    : (asString(meta["kreis_schluessel"]) ?? asString(meta["ortslage_schluessel"]) ?? "");

  if (!scopedAreaId) notFound();

  const adminRole = getAdminRoleForUser(userId);
  const admin = createAdminClient();
  const previewAccess = await loadPreviewAccessForArea(admin, scopedAreaId);
  if (previewAccess.status !== "preview" || !previewAccess.partnerId) {
    notFound();
  }

  if (!adminRole && previewAccess.partnerId !== userId) {
    notFound();
  }
}

export default async function ImmobilienmarktPreviewPage({ params }: PageProps) {
  const resolvedParams = await params;
  const slugs = resolvedParams.slug ?? [];
  const route = resolveRoute(slugs);

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    redirect("/partner/login");
  }

  await requirePreviewAccess(route, user.id);

  const pageModel = await buildPageModel(route, {
    audience: "preview",
    pathPrefix: "/preview/immobilienmarkt",
  });

  if (!pageModel) notFound();

  const entry = IMMOBILIENMARKT_REGISTRY[route.level]?.[pageModel.activeTabId];
  if (!entry) notFound();

  const { report, tabs, tocItems, activeTabId, basePath, ctx, assets, parentBasePath } = pageModel;
  const reportData = asRecord(report?.data) ?? {};
  const meta = asRecord(asArray(report.meta)[0] ?? report.meta) ?? {};
  const immobilienKaufpreisRow = asRecord(asArray(reportData["immobilien_kaufpreis"])[0]) ?? null;
  const averagePrice = toNumberOrNull(immobilienKaufpreisRow?.["kaufpreis_immobilien"]);
  const areaId = (
    asString(meta["ortslage_schluessel"])
    ?? asString(meta["kreis_schluessel"])
    ?? ""
  ).trim();
  const texts = await getPortalSystemTexts("de");

  const vm = entry.buildVM({
    report,
    bundeslandSlug: ctx.bundeslandSlug,
    kreisSlug: ctx.kreisSlug,
    ortSlug: ctx.ortSlug,
    mietpreisMapSvg: assets?.mietpreisMapSvg ?? null,
    immobilienpreisMapSvg: assets?.immobilienpreisMapSvg ?? null,
    heroImageSrc: assets?.heroImageSrc ?? null,
  });

  const Component = entry.Component as SectionComponent<typeof vm>;
  const valuationCtx: Record<string, string | undefined> = {
    bundeslandSlug: ctx.bundeslandSlug,
    kreisSlug: ctx.kreisSlug,
    ortSlug: ctx.ortSlug,
  };

  const locationName = ctx.ortSlug || ctx.kreisSlug || "Ihrer Region";
  const level = ctx.ortSlug ? "ort" : "kreis";
  const admin = createAdminClient();
  const previewAccess = areaId
    ? await loadPreviewAccessForArea(admin, areaId)
    : { partnerId: null, status: "none" as const };
  const previewAreaOptionsRaw = previewAccess.partnerId
    ? await loadPreviewAreaOptionsForPartner(admin, previewAccess.partnerId)
    : [];
  const previewAreaOptions = previewAreaOptionsRaw.length > 1
    ? [
        ...previewAreaOptionsRaw.filter((option) => option.areaId === areaId),
        ...previewAreaOptionsRaw.filter((option) => option.areaId !== areaId),
      ]
    : [];
  const valuationConfig = resolveLeadGeneratorConfig({
    generatorType: VALUATION_RANGE_FLOW.generatorType,
    flowKey: VALUATION_RANGE_FLOW.key,
    variantKey: VALUATION_RANGE_FLOW.defaultVariantKey,
    locale: "de",
    audience: "preview",
    placementKey: VALUATION_RANGE_FLOW.placementKey,
    routeLevel: route.level,
    sourceAreaId: areaId || null,
    partnerId: previewAccess.partnerId,
    regionLabel: locationName,
    leadRecipientLabel: pageModel.kontakt?.name ?? "Wohnlagencheck24",
    allowPartnerWideAreaSelection: previewAreaOptions.length > 1,
    partnerAreaOptions: previewAreaOptions,
    canSubmit: false,
  });
  const valuationPriceContext: ValuationPriceContext | null = valuationConfig
    ? {
        averagePricePerSqm: averagePrice,
        housePriceRange: toPriceRange(
          asRecord(asArray(reportData["haus_kaufpreisspanne"])[0]) ?? null,
          { min: "preis_haus_min", avg: "preis_haus_avg", max: "preis_haus_max" },
        ),
        apartmentPriceRange: toPriceRange(
          asRecord(asArray(reportData["wohnung_kaufpreisspanne"])[0]) ?? null,
          { min: "preis_wohnung_min", avg: "preis_wohnung_avg", max: "preis_wohnung_max" },
        ),
      }
    : null;

  return (
    <>
      {pageModel.kontakt ? <KontaktContextSetter vm={pageModel.kontakt} /> : null}

      <Component
        vm={vm}
        tabs={tabs}
        tocItems={tocItems}
        activeTabId={activeTabId}
        basePath={basePath}
        parentBasePath={parentBasePath}
        texts={texts}
        ctx={ctx}
        assets={assets}
      />

      {valuationConfig && valuationPriceContext ? (
        <section className="py-5 bg-dark text-white mt-5 overflow-hidden">
          <div className="container">
            <div className="row justify-content-center">
              <div className="col-lg-10">
                <ValuationWizard
                  ctx={valuationCtx}
                  basePrice={averagePrice ?? undefined}
                  level={level}
                  locale="de"
                  pagePath={basePath}
                  generatorConfig={valuationConfig}
                  priceContext={valuationPriceContext}
                  previewMode
                />
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
