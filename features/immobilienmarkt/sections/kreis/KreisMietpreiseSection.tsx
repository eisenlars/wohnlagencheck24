// features/immobilienmarkt/sections/kreis/KreisMietpreiseSection.tsx

import Link from "next/link";

import { KreisTabNav } from "@/features/immobilienmarkt/shared/KreisTabNav";
import { HeroOverlayActions } from "@/features/immobilienmarkt/shared/HeroOverlayActions";
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
      <KreisTabNav tabs={tabs} activeTabId={activeTabId} basePath={vm.basePath} />

      <RegionHero
        title={vm.hero.title}
        subtitle={vm.hero.subtitle}
        imageSrc={vm.hero.imageSrc}
        rightOverlay={<HeroOverlayActions variant="miete" />}
        rightOverlayMode="buttons"
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
