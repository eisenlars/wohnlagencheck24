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

export const revalidate = 3600;

type PageParams = { slug?: string[] };
type PageProps = { params: Promise<PageParams> };

function getValueByPath(root: unknown, pathParts: string[]): unknown {
  let current: unknown = root;
  for (const part of pathParts) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const slugs = resolvedParams.slug ?? [];
  const route = resolveRoute(slugs);
  const report = await getReportBySlugs(route.regionSlugs);
  if (!report) return {};

  const baseText =
    asRecord(report.text ?? asRecord(asRecord(report.data)?.text) ?? {}) ?? {};
  const meta = asRecord(asArray(report.meta)[0] ?? report.meta) ?? {};
  const areaId =
    (asString(meta["ortslage_schluessel"]) ??
      asString(meta["kreis_schluessel"]) ??
      "") || "";

  const marketingSection =
    route.section === "uebersicht" ? "immobilienmarkt_ueberblick" : route.section;

  const overrides =
    areaId.length > 0
      ? await getApprovedMarketingTexts(createAdminClient() as unknown as SupabaseClientLike, areaId)
      : [];

  const getOverride = (field: string) =>
    overrides.find(
      (entry) => entry.section_key === `marketing.${marketingSection}.${field}`,
    )?.optimized_content ?? null;

  const getBase = (field: string) => {
    const value = getValueByPath(baseText, [
      "marketing",
      marketingSection,
      field,
    ]);
    return typeof value === "string" ? value : null;
  };

  const title =
    getOverride("title") ??
    getBase("title") ??
    "Immobilienmarkt & Standortprofile";
  const description =
    getOverride("description") ??
    getBase("description") ??
    "Wohnlagencheck24 bietet strukturierte Informationen zu Wohnlagen, Standorten und Märkten in Deutschland.";

  return {
    title,
    description,
    openGraph: { title, description },
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
