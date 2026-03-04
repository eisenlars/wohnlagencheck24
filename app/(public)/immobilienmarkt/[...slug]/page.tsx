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
import { formatValueCtx } from "@/utils/format";
import { toNumberOrNull } from "@/utils/toNumberOrNull";
import { getApprovedMarketingTexts, getReportBySlugs, type SupabaseClientLike } from "@/lib/data";
import { createAdminClient } from "@/utils/supabase/admin";
import { buildMarketingDefaults, type MarketingContext } from "@/lib/marketing-defaults";
import {
  isBundeslandVisible,
  isKreisVisible,
  isOrtslageVisible,
} from "@/lib/area-visibility";

export const revalidate = 3600;

type PageParams = { slug?: string[] };
type PageProps = { params: Promise<PageParams> };

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
  const { data: activePartnerMappings } = await admin
    .from("partner_area_map")
    .select("auth_user_id")
    .eq("area_id", areaId)
    .eq("is_active", true);
  const partnerIds = Array.from(
    new Set(
      (activePartnerMappings ?? [])
        .map((row) => asString((row as { auth_user_id?: string | null }).auth_user_id) ?? "")
        .filter((value) => value.length > 0),
    ),
  );
  const activePartnerId = partnerIds.length === 1 ? partnerIds[0] : undefined;

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

export default async function ImmobilienmarktHierarchiePage({ params }: PageProps) {
  const resolvedParams = await params;
  const slugs = resolvedParams.slug ?? [];
  const route = resolveRoute(slugs);
  const pageModel = await buildPageModel(route);

  if (!pageModel) notFound();

  const entry = IMMOBILIENMARKT_REGISTRY[route.level]?.[pageModel.activeTabId];
  if (!entry) notFound();

  const { report, tabs, tocItems, activeTabId, basePath, ctx, assets, parentBasePath } = pageModel;
  const reportData = asRecord(report?.data) ?? {};
  const immobilienKaufpreisRow = asRecord(asArray(reportData["immobilien_kaufpreis"])[0]) ?? null;
  const averagePrice = toNumberOrNull(immobilienKaufpreisRow?.["kaufpreis_immobilien"]);
  const averagePriceLabel =
    averagePrice === null ? "---" : formatValueCtx(averagePrice, "kaufpreis_qm", "kpi");

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

  // Bestimmung des Kontext-Labels für den Wizard
  const locationName = ctx.ortSlug || ctx.kreisSlug || "Ihrer Region";
  const level = ctx.ortSlug ? 'ort' : 'kreis';

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
        ctx={ctx}
        assets={assets}
      />

      {/* LOKALER CTA: Kontext-Bewertung */}
      <section className="py-5 bg-dark text-white mt-5 overflow-hidden">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-lg-8 text-center mb-5">
              <h2 className="display-5 fw-bold mb-3">
                Wieviel ist Ihr Objekt in {locationName} wert?
              </h2>
              <p className="lead text-secondary">
                Nutzen Sie den aktuellen Durchschnittspreis von 
                <strong> {averagePriceLabel} €/m²</strong> als Basis für Ihre KI-Bewertung.
              </p>
            </div>
            
            <div className="col-lg-10">
              <ValuationWizard 
                ctx={valuationCtx}
                basePrice={averagePrice ?? undefined}
                level={level}
              />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
