import Link from "next/link";

import { formatRegionFallback } from "@/utils/regionName";

import type { SectionCtx, TabItem } from "@/features/immobilienmarkt/sections/types";

type BreadcrumbNames = {
  regionName?: string;
  bundeslandName?: string;
  kreisName?: string;
};

type BreadcrumbItem = {
  label: string;
  href: string;
};

export function ImmobilienmarktBreadcrumb(props: {
  tabs: TabItem[];
  activeTabId: string;
  basePath: string;
  parentBasePath?: string;
  ctx?: SectionCtx;
  names?: BreadcrumbNames;
}) {
  const { tabs, activeTabId, basePath, parentBasePath, ctx, names } = props;
  const siteUrl = "https://www.wohnlagencheck24.de";

  const activeTabLabel = tabs.find((tab) => tab.id === activeTabId)?.label ?? activeTabId;
  const activeTabHref =
    activeTabId === "uebersicht"
      ? (parentBasePath ?? basePath)
      : `${basePath}/${activeTabId}`;

  const breadcrumbItems: BreadcrumbItem[] = [
    { label: "Immobilienmarkt & Standortprofile", href: "/immobilienmarkt" },
  ];

  if (ctx?.bundeslandSlug) {
    breadcrumbItems.push({
      label: names?.bundeslandName ?? formatRegionFallback(ctx.bundeslandSlug),
      href: `/immobilienmarkt/${ctx.bundeslandSlug}`,
    });
  }

  if (ctx?.kreisSlug) {
    const kreisHref = ctx.bundeslandSlug
      ? `/immobilienmarkt/${ctx.bundeslandSlug}/${ctx.kreisSlug}`
      : `/immobilienmarkt/${ctx.kreisSlug}`;

    breadcrumbItems.push({
      label: names?.kreisName ?? formatRegionFallback(ctx.kreisSlug),
      href: kreisHref,
    });
  }

  if (ctx?.ortSlug) {
    const ortHref = ctx.bundeslandSlug && ctx.kreisSlug
      ? `/immobilienmarkt/${ctx.bundeslandSlug}/${ctx.kreisSlug}/${ctx.ortSlug}`
      : `/immobilienmarkt/${ctx.ortSlug}`;

    breadcrumbItems.push({
      label: names?.regionName ?? formatRegionFallback(ctx.ortSlug),
      href: ortHref,
    });
  }

  breadcrumbItems.push({
    label: activeTabLabel,
    href: activeTabHref,
  });

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbItems.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      item: `${siteUrl}${item.href}`,
    })),
  };

  return (
    <nav aria-label="Breadcrumb" className="mt-3">
      <ol className="breadcrumb small mb-3">
        {breadcrumbItems.map((item, index) => {
          const isLast = index === breadcrumbItems.length - 1;
          return (
            <li
              key={`${item.href}-${item.label}`}
              className={`breadcrumb-item${isLast ? " active" : ""}`}
              aria-current={isLast ? "page" : undefined}
            >
              {isLast ? item.label : (
                <Link href={item.href} style={{ color: "#486b7a" }}>
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
    </nav>
  );
}
