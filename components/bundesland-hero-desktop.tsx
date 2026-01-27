"use client";

import React from "react";
import type { FormatContext, FormatKind, UnitKey } from "@/utils/format";
import { InteractiveMap } from "@/components/interactive-map";
import { BundeslandHeroSlideshow } from "@/components/bundesland-hero-slideshow";

type MapMode = "singleValue" | "overview";
type MapFormatKind = FormatKind | "kaufpreisfaktor";

type BundeslandHeroDesktopProps = {
  imageSrc: string;
  imageSrcs?: string[];
  mapSvg?: string | null;
  mapTheme?: string;
  mapMode?: MapMode;
  mapKind?: MapFormatKind;
  mapUnitKey?: UnitKey;
  mapCtx?: FormatContext;
  mapFractionDigits?: number;
  mapNote?: string;
  cta?: React.ReactNode;
};

export function BundeslandHeroDesktop({
  imageSrc,
  imageSrcs,
  mapSvg,
  mapTheme = "kreisuebersicht",
  mapMode = "singleValue",
  mapKind,
  mapUnitKey,
  mapCtx = "kpi",
  mapFractionDigits,
  mapNote,
  cta,
}: BundeslandHeroDesktopProps) {
  const slides = imageSrcs && imageSrcs.length > 0 ? imageSrcs : null;
  const mediaClasses = ["bundesland-hero-media", slides ? "has-slideshow" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="bundesland-hero-slider">
      <div className="bundesland-hero-slider-frame">
        <div
          className={mediaClasses}
          style={slides ? undefined : { backgroundImage: `url(${imageSrc})` }}
        >
          {slides ? <BundeslandHeroSlideshow slides={slides} /> : null}

          <div className="region-hero-gradient" />

          <div className="region-hero-content d-flex flex-column justify-content-start">
            {cta ? (
              <div className="mt-auto pb-3 px-3 px-md-4 d-flex justify-content-start">
                {cta}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {mapSvg ? (
        <div className="bundesland-hero-map">
          <div className="bundesland-hero-map-card">
            <div className="bundesland-hero-map-body">
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
          </div>
        </div>
      ) : null}
    </div>
  );
}
