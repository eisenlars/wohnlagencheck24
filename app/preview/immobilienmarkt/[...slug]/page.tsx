import { notFound, redirect } from "next/navigation";
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
import { getReportBySlugs } from "@/lib/data";
import { createAdminClient } from "@/utils/supabase/admin";
import { loadPreviewAccessForArea } from "@/lib/public-partner-mappings";
import { createClient } from "@/utils/supabase/server";
import { getAdminRoleForUser } from "@/lib/security/admin-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageParams = { slug?: string[] };
type PageProps = { params: Promise<PageParams> };

export async function generateMetadata(): Promise<Metadata> {
  return {
    robots: { index: false, follow: false },
  };
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

  const locationName = ctx.ortSlug || ctx.kreisSlug || "Ihrer Region";
  const level = ctx.ortSlug ? "ort" : "kreis";

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
