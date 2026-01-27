import React from "react";
import type { FormatContext, FormatKind, UnitKey } from "@/utils/format";
import { BundeslandHeroMedia } from "@/components/bundesland-hero-media";
import { BundeslandHeroSlideshow } from "@/components/bundesland-hero-slideshow";

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
  return (
    <section className="bundesland-hero">

        <BundeslandHeroMedia
          imageSrc={imageSrc}
          imageSrcs={imageSrcs}
          mapSvg={mapSvg}
          mapTheme={mapTheme}
          mapMode={mapMode}
          mapKind={mapKind}
          mapUnitKey={mapUnitKey}
          mapCtx={mapCtx}
          mapFractionDigits={mapFractionDigits}
          mapNote={mapNote}
          cta={cta}
        />
    
    </section>
  );
}
