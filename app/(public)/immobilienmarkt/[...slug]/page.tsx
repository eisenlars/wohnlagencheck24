// app/immobilienmarkt/[...slug]/page.tsx

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { resolveRoute } from "@/features/immobilienmarkt/routes/resolveRoute";
import { buildPageModel } from "@/features/immobilienmarkt/page/buildPageModel";
import { IMMOBILIENMARKT_REGISTRY } from "@/features/immobilienmarkt/page/registry";
import { KontaktContextSetter } from "@/components/kontakt/KontaktContextSetter";
import type { SectionComponent } from "@/features/immobilienmarkt/sections/types";
import { ValuationWizard } from "@/features/valuation/components/ValuationWizard";
import { asArray, asRecord, asString } from "@/utils/records";
import { toNumberOrNull } from "@/utils/toNumberOrNull";
import { getApprovedMarketingTexts, getReportBySlugs, type SupabaseClientLike } from "@/lib/data";
import { createAdminClient } from "@/utils/supabase/admin";
import { buildMarketingDefaults, type MarketingContext } from "@/lib/marketing-defaults";
import {
  isBundeslandVisible,
  isKreisVisible,
  isOrtslageVisible,
} from "@/lib/area-visibility";
import {
  loadPublicVisibleAreaOptionsForPartner,
  loadSinglePublicVisiblePartnerIdForArea,
} from "@/lib/public-partner-mappings";
import { buildLocalizedHref, normalizePublicLocale } from "@/lib/public-locale-routing";
import { getMarketExplanationStaticTexts } from "@/lib/market-explanation-static-texts";
import { getPortalSystemTexts } from "@/lib/portal-system-texts";
import { resolveLeadGeneratorConfig } from "@/features/lead-generators/core/resolver";
import { VALUATION_RANGE_FLOW } from "@/features/lead-generators/valuation/flow";
import type { ValuationPriceContext } from "@/features/lead-generators/valuation/pricing";

export const revalidate = 3600;

type PageParams = { slug?: string[] };
type PageProps = { params: Promise<PageParams>; locale?: string | null };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const slugs = resolvedParams.slug ?? [];
  const route = resolveRoute(slugs);
  const [bundeslandSlug, kreisSlug, ortSlug] = route.regionSlugs;
  if (route.level === "bundesland" && bundeslandSlug) {
    if (!(await isBundeslandVisible(bundeslandSlug))) {
      return { robots: { index: false, follow: false } };
    }
  }
  if (route.level === "kreis" && bundeslandSlug && kreisSlug) {
    if (!(await isKreisVisible(bundeslandSlug, kreisSlug))) {
      return { robots: { index: false, follow: false } };
    }
  }
  if (route.level === "ort" && bundeslandSlug && kreisSlug && ortSlug) {
    if (!(await isOrtslageVisible(bundeslandSlug, kreisSlug, ortSlug))) {
      return { robots: { index: false, follow: false } };
    }
  }

  const report = await getReportBySlugs(route.regionSlugs);
  if (!report) return {};

  const meta = asRecord(asArray(report.meta)[0] ?? report.meta) ?? {};
  const areaId =
    (asString(meta["ortslage_schluessel"]) ??
      asString(meta["kreis_schluessel"]) ??
      "") || "";

  const marketingSection =
    route.section === "uebersicht" ? "immobilienmarkt_ueberblick" : route.section;

  const admin = createAdminClient();
  const activePartnerId = areaId.length > 0
    ? (await loadSinglePublicVisiblePartnerIdForArea(admin, areaId)) ?? undefined
    : undefined;

  const overrides =
    areaId.length > 0
      ? await getApprovedMarketingTexts(
          admin as unknown as SupabaseClientLike,
          areaId,
          activePartnerId,
        )
      : [];

  const routeLevel = route.level === "ort" ? "ortslage" : "kreis";
  const kreisName = asString(meta["kreis_name"]) ?? asString(meta["amtlicher_name"]) ?? route.regionSlugs[1] ?? "";
  const ortslageName =
    routeLevel === "ortslage"
      ? (asString(meta["ortslage_name"]) ?? asString(meta["amtlicher_name"]) ?? route.regionSlugs[2] ?? "")
      : undefined;
  const bundeslandName = asString(meta["bundesland_name"]) ?? route.regionSlugs[0] ?? "";
  const marketingCtx: MarketingContext = {
    level: routeLevel,
    kreisName,
    ortslageName,
    bundeslandName,
    regionaleZuordnungKreis: asString(meta["regionale_zuordnung"]) ?? null,
  };
  const defaults = buildMarketingDefaults(marketingCtx);
  const defaultEntry = defaults[marketingSection as keyof typeof defaults] ?? defaults.immobilienmarkt_ueberblick;

  const getOverride = (field: string) =>
    overrides.find(
      (entry) => entry.section_key === `marketing.${marketingSection}.${field}`,
    )?.optimized_content ?? null;

  const title =
    getOverride("title") ??
    defaultEntry.title ??
    "Immobilienmarkt & Standortprofile";
  const description =
    getOverride("description") ??
    defaultEntry.description ??
    "Wohnlagencheck24 bietet strukturierte Informationen zu Wohnlagen, Standorten und Märkten in Deutschland.";
  const primaryKeyword = getOverride("primary_keyword") ?? defaultEntry.primary_keyword;
  const secondaryKeywords = getOverride("secondary_keywords") ?? defaultEntry.secondary_keywords;
  const entities = getOverride("entities") ?? defaultEntry.entities;
  const keywords = Array.from(
    new Set(
      [primaryKeyword, secondaryKeywords, entities]
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        .flatMap((value) => value.split(","))
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ),
  );
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
  const pagePath = `/immobilienmarkt/${route.regionSlugs.join("/")}`;
  const pageUrl = siteUrl ? `${siteUrl}${pagePath}` : undefined;

  return {
    title,
    description,
    keywords: keywords.length > 0 ? keywords : undefined,
    openGraph: {
      title,
      description,
      type: "website",
      url: pageUrl,
      siteName: "Wohnlagencheck24",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
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

export default async function ImmobilienmarktHierarchiePage({ params, locale = null }: PageProps) {
  const resolvedParams = await params;
  const slugs = resolvedParams.slug ?? [];
  const route = resolveRoute(slugs);
  const normalizedLocale = normalizePublicLocale(locale);
  const pageModel = await buildPageModel(route, { locale: normalizedLocale });

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
  const [texts, marketExplanationTexts] = await Promise.all([
    getPortalSystemTexts(normalizedLocale),
    getMarketExplanationStaticTexts(normalizedLocale),
  ]);
  const slugPath = route.regionSlugs.join("/");
  const pagePath = buildLocalizedHref(
    locale,
    slugPath ? `/immobilienmarkt/${slugPath}` : "/immobilienmarkt",
  );

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
  const level = ctx.ortSlug ? 'ort' : 'kreis';
  const admin = createAdminClient();
  const activePartnerId = areaId.length > 0 && (route.level === "kreis" || route.level === "ort")
    ? await loadSinglePublicVisiblePartnerIdForArea(admin, areaId)
    : null;
  const partnerAreaOptionsRaw = activePartnerId
    ? await loadPublicVisibleAreaOptionsForPartner(admin, activePartnerId)
    : [];
  const partnerAreaOptions = partnerAreaOptionsRaw.length > 1
    ? [
        ...partnerAreaOptionsRaw.filter((option) => option.areaId === areaId),
        ...partnerAreaOptionsRaw.filter((option) => option.areaId !== areaId),
      ]
    : [];
  const valuationConfig = resolveLeadGeneratorConfig({
    generatorType: VALUATION_RANGE_FLOW.generatorType,
    flowKey: VALUATION_RANGE_FLOW.key,
    variantKey: VALUATION_RANGE_FLOW.defaultVariantKey,
    locale: normalizedLocale,
    audience: "public",
    placementKey: VALUATION_RANGE_FLOW.placementKey,
    routeLevel: route.level,
    sourceAreaId: areaId || null,
    partnerId: activePartnerId,
    regionLabel: locationName,
    leadRecipientLabel: pageModel.kontakt?.name ?? "Wohnlagencheck24",
    allowPartnerWideAreaSelection: partnerAreaOptions.length > 1,
    partnerAreaOptions,
    canSubmit: Boolean(activePartnerId),
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
        marketExplanationTexts={marketExplanationTexts}
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
                  locale={normalizedLocale}
                  pagePath={pagePath}
                  generatorConfig={valuationConfig}
                  priceContext={valuationPriceContext}
                />
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
