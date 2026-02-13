import React from "react";
import dynamic from "next/dynamic";
import type { FormatContext, FormatKind, UnitKey } from "@/utils/format";

const InteractiveMapLazy = dynamic(
  () => import("@/components/interactive-map").then((m) => m.InteractiveMap),
  {
    ssr: false,
    loading: () => (
      <div className="bundesland-hero-map-placeholder" aria-hidden="true">
        Karte wird geladen...
      </div>
    ),
  },
);

type MapMode = "singleValue" | "overview";
type MapFormatKind = FormatKind | "kaufpreisfaktor";

type BundeslandHeroMobileProps = {
  mapSvg?: string | null;
  mapTheme?: string;
  mapMode?: MapMode;
  mapKind?: MapFormatKind;
  mapUnitKey?: UnitKey;
  mapCtx?: FormatContext;
  mapFractionDigits?: number;
  mapNote?: string;
};

export function BundeslandHeroMobile({
  mapSvg,
  mapTheme = "kreisuebersicht",
  mapMode = "singleValue",
  mapKind,
  mapUnitKey,
  mapCtx = "kpi",
  mapFractionDigits,
  mapNote,
}: BundeslandHeroMobileProps) {
  if (!mapSvg) return null;

  return (
    <div className="bundesland-hero-map">
      <InteractiveMapLazy
        svg={mapSvg}
        theme={mapTheme}
        mode={mapMode}
        kind={mapKind}
        unitKey={mapUnitKey}
        ctx={mapCtx}
        fractionDigits={mapFractionDigits}
        note={mapNote}
      />
    </div>
  );
}
