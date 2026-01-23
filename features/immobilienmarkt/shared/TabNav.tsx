// features/immobilienmarkt/shared/TabNav.tsx

import Link from "next/link";
import Image from "next/image";
import { ImmobilienmarktBreadcrumb } from "@/features/immobilienmarkt/shared/ImmobilienmarktBreadcrumb";

export type TabNavItem = {
  id: string;
  label: string;
  iconSrc?: string;
};

export function TabNav(props: {
  tabs: TabNavItem[];
  activeTabId: string;
  basePath: string;

  // NEU: für Ort-Ebene (Übersicht soll auf Kreis-Ebene verlinken)
  parentBasePath?: string;
  ctx?: {
    bundeslandSlug?: string;
    kreisSlug?: string;
    ortSlug?: string;
  };
  names?: {
    regionName?: string;
    bundeslandName?: string;
    kreisName?: string;
  };
}) {
  const { tabs, activeTabId, basePath, parentBasePath, ctx, names } = props;

  return (
    <section className="kreis-subnav kreis-subnav-sticky mb-4">
      <div className="breadcrumb-sticky">
        <ImmobilienmarktBreadcrumb
          tabs={tabs}
          activeTabId={activeTabId}
          basePath={basePath}
          parentBasePath={parentBasePath}
          ctx={ctx}
          names={names}
          compact
          rootIconSrc="/logo/wohnlagencheck24.svg"
        />
      </div>
      <div className="kreis-subnav-tabs-wrapper w-100">
        <ul className="nav nav-pills flex-nowrap small kreis-subnav-tabs">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;

            // Übersicht: auf basePath – aber wenn parentBasePath gesetzt ist, dorthin.
            const href =
              tab.id === "uebersicht"
                ? (parentBasePath ?? basePath)
                : `${basePath}/${tab.id}`;

            return (
              <li className="nav-item" key={tab.id}>
                <Link
                  href={href}
                  className={
                    "nav-link d-flex flex-column align-items-center justify-content-center gap-2 rounded-pill kreis-subnav-link" +
                    (isActive ? " active bg-dark text-white" : " bg-light text-dark border-0")
                  }
                  aria-current={isActive ? "page" : undefined}
                >
                  {tab.iconSrc ? (
                    <Image
                      src={tab.iconSrc}
                      alt=""
                      aria-hidden="true"
                      className="subnav-icon-img"
                      width={36}
                      height={36}
                    />
                  ) : null}
                  <span className="subnav-label">{tab.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
