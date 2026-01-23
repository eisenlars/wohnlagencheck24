import { TabNav } from "@/features/immobilienmarkt/shared/TabNav";
import { HeroOverlayActions } from "@/features/immobilienmarkt/shared/HeroOverlayActions";
import { RegionHero } from "@/components/region-hero";
import { RightEdgeControls } from "@/components/right-edge-controls";

import type { PlaceholderVM } from "@/features/immobilienmarkt/selectors/shared/types/placeholder";
import type { SectionPropsBase } from "@/features/immobilienmarkt/sections/types";

export function TabPlaceholderSection(
  props: SectionPropsBase & {
    vm: PlaceholderVM;
    overlayVariant?: "immo" | "miete" | null;
  },
) {
  const { vm, tabs, activeTabId, tocItems, overlayVariant } = props;

  const basePath = props.basePath ?? vm.basePath;

  const rightOverlay =
    overlayVariant === "immo" ? (
      <HeroOverlayActions variant="immo" />
    ) : overlayVariant === "miete" ? (
      <HeroOverlayActions variant="miete" />
    ) : null;

  const rightOverlayMode = rightOverlay ? "buttons" : undefined;

  return (
    <div className="text-dark">
      {tocItems.length > 0 ? <RightEdgeControls tocItems={tocItems} /> : null}

      <div className="container immobilienmarkt-container position-relative">
        <TabNav
          tabs={tabs}
          activeTabId={activeTabId}
          basePath={basePath}
          parentBasePath={props.parentBasePath}
          ctx={props.ctx}
          names={{ regionName: vm.regionName }}
        />

        {props.assets?.heroImageSrc ? (
          <RegionHero
            title={vm.regionName}
            subtitle={vm.heroSubtitle}
            imageSrc={props.assets.heroImageSrc}
            rightOverlay={rightOverlay}
            rightOverlayMode={rightOverlayMode}
          />
        ) : null}

        <section className="mb-4" id="einleitung">
          <h1 className="mt-3 mb-2">
            {tabs.find((t) => t.id === activeTabId)?.label ?? activeTabId} – {vm.regionName}
          </h1>
          <p className="small text-muted mb-0">
            Dieser Bereich ist bereits über die URL-Struktur erreichbar und serverseitig gerendert. Inhalte, Kennzahlen
            und Visualisierungen werden in einem nächsten Schritt ergänzt.
          </p>
        </section>
      </div>
    </div>
  );
}
