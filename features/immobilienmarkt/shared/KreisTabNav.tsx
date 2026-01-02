// features/immobilienmarkt/shared/KreisTabNav.tsx
import Link from "next/link";

export type KreisTabNavItem = {
  id: string;
  label: string;
  iconSrc?: string;
};

export function KreisTabNav(props: {
  tabs: KreisTabNavItem[];
  activeTabId: string;
  basePath: string;
}) {
  const { tabs, activeTabId, basePath } = props;

  return (
    <section className="kreis-subnav kreis-subnav-sticky mb-4">
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2">
        <div className="kreis-subnav-tabs-wrapper w-100">
          <ul className="nav nav-pills flex-nowrap small kreis-subnav-tabs">
            {tabs.map((tab) => {
              const isActive = tab.id === activeTabId;
              const href = tab.id === "uebersicht" ? basePath : `${basePath}/${tab.id}`;

              return (
                <li className="nav-item" key={tab.id}>
                  <Link
                    href={href}
                    className={
                      "nav-link d-flex flex-column align-items-center justify-content-center gap-2 rounded-pill kreis-subnav-link" +
                      (isActive
                        ? " active bg-dark text-white"
                        : " bg-light text-dark border-0")
                    }
                    aria-current={isActive ? "page" : undefined}
                  >
                    {tab.iconSrc ? (
                      <img
                        src={tab.iconSrc}
                        alt=""
                        aria-hidden="true"
                        className="subnav-icon-img"
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
