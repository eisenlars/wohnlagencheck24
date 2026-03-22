import Link from "next/link";

import { buildLocalizedHref, normalizePublicLocale } from "@/lib/public-locale-routing";
import type { PortalSystemTextMap } from "@/lib/portal-system-text-definitions";
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
  compact?: boolean;
  rootIconSrc?: string;
  texts: PortalSystemTextMap;
  locale?: string;
}) {
  const { tabs, activeTabId, basePath, parentBasePath, ctx, names, compact, rootIconSrc, texts, locale } = props;
  const siteUrl = "https://www.wohnlagencheck24.de";
  const normalizedLocale = normalizePublicLocale(locale);
  const localizeHref = (path: string) =>
    normalizedLocale === "de" ? path : buildLocalizedHref(normalizedLocale, path);

  const activeTabLabel = tabs.find((tab) => tab.id === activeTabId)?.label ?? activeTabId;
  const activeTabHref =
    activeTabId === "uebersicht"
      ? (parentBasePath ?? basePath)
      : `${basePath}/${activeTabId}`;

  const breadcrumbItems: BreadcrumbItem[] = [
    { label: texts.market_profiles, href: localizeHref("/immobilienmarkt") },
  ];

  if (ctx?.bundeslandSlug) {
    breadcrumbItems.push({
      label: names?.bundeslandName ?? formatRegionFallback(ctx.bundeslandSlug),
      href: localizeHref(`/immobilienmarkt/${ctx.bundeslandSlug}`),
    });
  }

  if (ctx?.kreisSlug) {
    const kreisHref = ctx.bundeslandSlug
      ? `/immobilienmarkt/${ctx.bundeslandSlug}/${ctx.kreisSlug}`
      : `/immobilienmarkt/${ctx.kreisSlug}`;

    breadcrumbItems.push({
      label: names?.kreisName ?? formatRegionFallback(ctx.kreisSlug),
      href: localizeHref(kreisHref),
    });
  }

  if (ctx?.ortSlug) {
    const ortHref = ctx.bundeslandSlug && ctx.kreisSlug
      ? `/immobilienmarkt/${ctx.bundeslandSlug}/${ctx.kreisSlug}/${ctx.ortSlug}`
      : `/immobilienmarkt/${ctx.ortSlug}`;

    breadcrumbItems.push({
      label: names?.regionName ?? formatRegionFallback(ctx.ortSlug),
      href: localizeHref(ortHref),
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
    <nav aria-label="Breadcrumb" className={compact ? "breadcrumb-compact" : "mt-3"}>
      <ol className={`breadcrumb small mb-3${compact ? " mb-0" : ""}`}>
        {breadcrumbItems.map((item, index) => {
          const isLast = index === breadcrumbItems.length - 1;
          const isRoot = index === 0;
          return (
            <li
              key={`${item.href}-${item.label}`}
              className={`breadcrumb-item${isLast ? " active" : ""}`}
              aria-current={isLast ? "page" : undefined}
            >
              {isLast ? (
                item.label
              ) : (
                <Link
                  href={item.href}
                  className="breadcrumb-link"
                  aria-label={isRoot && rootIconSrc ? item.label : undefined}
                >
                  {isRoot && rootIconSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={rootIconSrc} alt="" aria-hidden="true" className="breadcrumb-root-icon" />
                  ) : (
                    item.label
                  )}
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
