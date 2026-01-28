// app/immobilienmarkt/[...slug]/page.tsx

import { notFound } from "next/navigation";
import { resolveRoute } from "@/features/immobilienmarkt/routes/resolveRoute";
import { buildPageModel } from "@/features/immobilienmarkt/page/buildPageModel";
import { IMMOBILIENMARKT_REGISTRY } from "@/features/immobilienmarkt/page/registry";
import { KontaktContextSetter } from "@/components/kontakt/KontaktContextSetter";
import type { SectionComponent } from "@/features/immobilienmarkt/sections/types";
import { ValuationWizard } from "@/features/valuation/components/ValuationWizard";
import { asArray, asRecord } from "@/utils/records";
import { formatValueCtx } from "@/utils/format";
import { toNumberOrNull } from "@/utils/toNumberOrNull";

type PageParams = { slug?: string[] };
type PageProps = { params: Promise<PageParams> };

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
                ctx={ctx}
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
