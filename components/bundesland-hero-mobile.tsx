"use client";

import React from "react";
import type { FormatContext, FormatKind, UnitKey } from "@/utils/format";
import { InteractiveMap } from "@/components/interactive-map";

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
      <InteractiveMap
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
