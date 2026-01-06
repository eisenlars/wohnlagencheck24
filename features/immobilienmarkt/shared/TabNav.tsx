// features/immobilienmarkt/shared/TabNav.tsx

import Link from "next/link";
import Image from "next/image";

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
}) {
  const { tabs, activeTabId, basePath, parentBasePath } = props;

  return (
    <section className="kreis-subnav kreis-subnav-sticky mb-4">
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2">
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
      </div>
    </section>
  );
}
