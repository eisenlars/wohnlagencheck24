// app/immobilienmarkt/[...slug]/page.tsx

import { notFound } from "next/navigation";

import { resolveRoute } from "@/features/immobilienmarkt/routes/resolveRoute";
import { buildPageModel } from "@/features/immobilienmarkt/page/buildPageModel";
import { IMMOBILIENMARKT_REGISTRY } from "@/features/immobilienmarkt/page/registry";
import { KontaktContextSetter } from "@/components/kontakt/KontaktContextSetter";

type PageParams = { slug?: string[] };
type PageProps = { params: Promise<PageParams> };

export default async function ImmobilienmarktHierarchiePage({ params }: PageProps) {
  const resolvedParams = await params;
  const slugs = resolvedParams.slug ?? [];

  const route = resolveRoute(slugs);

  const pageModel = buildPageModel(route);
  if (!pageModel) notFound();

  const entry = IMMOBILIENMARKT_REGISTRY[route.level]?.[pageModel.activeTabId];
  if (!entry) notFound();

  const { report, tabs, tocItems, activeTabId, basePath, ctx, assets, parentBasePath } = pageModel;

  const vm = entry.buildVM({
    report,
    bundeslandSlug: ctx.bundeslandSlug,
    kreisSlug: ctx.kreisSlug,
    ortSlug: ctx.ortSlug,

    // optional: falls Builder mal Assets braucht
    mietpreisMapSvg: assets?.mietpreisMapSvg ?? null,
    immobilienpreisMapSvg: assets?.immobilienpreisMapSvg ?? null,
    heroImageSrc: assets?.heroImageSrc ?? null,
  });

  const Component = entry.Component;

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
    </>
  );
}
