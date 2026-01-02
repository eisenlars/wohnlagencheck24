import { KreisTabNav } from "@/features/immobilienmarkt/shared/KreisTabNav";
import { HeroOverlayActions } from "@/features/immobilienmarkt/shared/HeroOverlayActions";
import { RegionHero } from "@/components/region-hero";
import { RightEdgeControls } from "@/components/right-edge-controls";

export type KreisTabItem = { id: string; label: string; iconSrc?: string };
export type TocItem = { id: string; label: string };

export function KreisTabPlaceholderSection(props: {
  kreisName: string;
  bundeslandSlug: string;
  kreisSlug: string;

  tabs: KreisTabItem[];
  activeTabId: string;
  tocItems: TocItem[];

  heroImageSrc: string;

  overlayVariant?: "immo" | "miete" | null;
}) {
  const { kreisName, bundeslandSlug, kreisSlug, tabs, activeTabId, tocItems, heroImageSrc, overlayVariant } = props;

  const basePath = `/immobilienmarkt/${bundeslandSlug}/${kreisSlug}`;

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
        <KreisTabNav tabs={tabs} activeTabId={activeTabId} basePath={basePath} />

        <RegionHero
          title={kreisName}
          subtitle="regionaler Standortberater"
          imageSrc={heroImageSrc}
          rightOverlay={rightOverlay}
          rightOverlayMode={rightOverlayMode}
        />

        <section className="mb-4" id="einleitung">
          <h1 className="mt-3 mb-2">
            {tabs.find((t) => t.id === activeTabId)?.label ?? activeTabId} – {kreisName}
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
