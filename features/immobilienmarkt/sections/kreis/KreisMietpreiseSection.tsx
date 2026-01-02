import Link from "next/link";
import { RegionHero } from "@/components/region-hero";
import { BeraterBlock } from "@/components/advisor-avatar";
import { RightEdgeControls } from "@/components/right-edge-controls";
import { KpiValue } from "@/components/KpiValue";
import { InteractiveMap } from "@/components/interactive-map";

import type { TocItem } from "../../config/kreisSections";
import type { KreisMietpreiseVM } from "../../selectors/kreis/mietpreise";

export function KreisMietpreiseSection(props: {
  vm: KreisMietpreiseVM;
  tocItems: TocItem[];
  tabs: { id: string; label: string; iconSrc: string }[];
  activeTabId: string;
}) {
  const { vm, tocItems, tabs, activeTabId } = props;

  return (
    <div className="text-dark">
      {tocItems.length > 0 && <RightEdgeControls tocItems={tocItems} />}

      {/* Subnavigation */}
      <section className="kreis-subnav kreis-subnav-sticky mb-4">
        <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2">
          <div className="kreis-subnav-tabs-wrapper w-100">
            <ul className="nav nav-pills flex-nowrap small kreis-subnav-tabs">
              {tabs.map((tab) => {
                const isActive = tab.id === activeTabId;
                const href = tab.id === "uebersicht" ? vm.basePath : `${vm.basePath}/${tab.id}`;

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
                      <img src={tab.iconSrc} alt="" aria-hidden="true" className="subnav-icon-img" />
                      <span className="subnav-label">{tab.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>

      <RegionHero
        title={vm.hero.title}
        subtitle={vm.hero.subtitle}
        imageSrc={vm.hero.imageSrc}
        rightOverlay={null}
      />

      {/* Einleitung */}
      <section className="mb-3" id="einleitung">
        <h1 className="mt-3 mb-1">Mietpreise 2025 – {vm.kreisName}</h1>
        <p className="small text-muted mb-4">Aktualisiert am: {vm.kreisName}</p>

        {vm.teaser && <p className="teaser-text">{vm.teaser}</p>}

        <BeraterBlock
          name={vm.berater.name}
          taetigkeit={vm.berater.taetigkeit}
          imageSrc={vm.berater.imageSrc}
        />
      </section>

      {/* Leitkennzahl + Karte */}
      <section className="mb-5" id="leitkennzahl">
        <div className="row g-4 align-items-stretch">
          <div className="col-12 col-lg-6">
            <div className="h-100" style={{ width: "90%", margin: "0 auto" }}>
              {vm.assets.mietpreisMapSvg ? (
                <InteractiveMap
                  svg={vm.assets.mietpreisMapSvg}
                  theme="mietpreis"
                  mode="singleValue"
                  kind="miete_qm"
                  unitKey="eur_per_sqm"
                  ctx="kpi"
                />
              ) : (
                <p className="small text-muted mb-0">
                  Für diesen Landkreis liegt aktuell noch keine interaktive Mietpreis-Karte vor.
                </p>
              )}
            </div>
          </div>

          {/* Rechte Spalte: Hauptindikator */}
          <div className="col-12 col-lg-6 d-flex align-items-center">
            <div className="w-100 text-center">
              {vm.kpis.kaltmiete !== null ? (
                <>
                  <KpiValue
                    value={vm.kpis.kaltmiete}
                    kind="miete_qm"
                    unitKey="eur_per_sqm"
                    ctx="kpi"
                    size="ultra"
                    showUnit={true}
                    // optional: dezenter CI-Farbton (wie in deinem Bestand)
                    highlightValueColor="#486b7a"
                    normalValueColor="#486b7a"
                  />
                  <p className="mb-0 mt-2">Ø Kaltmiete – {vm.kreisName}</p>
                </>
              ) : (
                <p className="small text-muted mb-0">Keine Mietpreisdaten verfügbar.</p>
              )}
            </div>
          </div>
          
        </div>

        <div className="d-flex justify-content-center align-items-end gap-4 mb-4 mt-3">
          <KpiValue
            icon="/icons/ws24_marktbericht_mietpreise.svg"
            items={[
              { label: "Ø Nebenkosten", value: vm.kpis.nebenkosten, kind: "miete_qm", unitKey: "eur_per_sqm" },
              { label: "Ø Warmmiete", value: vm.kpis.warmmiete, kind: "miete_qm", unitKey: "eur_per_sqm" },
            ]}
            ctx="kpi"
            size="md"
          />
        </div>
      </section>

      {/* TODO: FAQ/weitere Blöcke folgen – bleiben hier gekapselt */}
    </div>
  );
}
