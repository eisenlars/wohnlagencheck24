import React from "react";
import type { FormatContext, FormatKind, UnitKey } from "@/utils/format";
import { InteractiveMap } from "@/components/interactive-map";

type MapMode = "singleValue" | "overview";
type MapFormatKind = FormatKind | "kaufpreisfaktor";

type BundeslandHeroProps = {
  title: string;
  subtitle?: string;
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

export function BundeslandHero({
  title,
  subtitle,
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
}: BundeslandHeroProps) {
  const slides = imageSrcs && imageSrcs.length > 0 ? imageSrcs : null;
  const mediaClasses = [
    "bundesland-hero-media",
    slides ? "has-slideshow" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className="bundesland-hero">
      <div className="bundesland-hero-grid">
        <div className="bundesland-hero-slider">
          <div className="bundesland-hero-slider-frame">
            <div
              className={mediaClasses}
              style={slides ? undefined : { backgroundImage: `url(${imageSrc})` }}
            >
              {slides ? (
                <div className="region-hero-slideshow" aria-hidden="true">
                  {slides.map((src, index) => (
                    <div
                      key={`${src}-${index}`}
                      className="region-hero-slide"
                      style={{
                        backgroundImage: `url(${src})`,
                        animationDelay: `${index * 10}s`,
                      }}
                    />
                  ))}
                </div>
              ) : null}

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
      </div>
    </section>
  );
}
