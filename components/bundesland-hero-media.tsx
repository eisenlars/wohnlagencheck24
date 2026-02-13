import React from "react";
import type { FormatContext, FormatKind, UnitKey } from "@/utils/format";
import { BundeslandHeroDesktop } from "@/components/bundesland-hero-desktop";
import { BundeslandHeroMobile } from "@/components/bundesland-hero-mobile";

type MapMode = "singleValue" | "overview";
type MapFormatKind = FormatKind | "kaufpreisfaktor";

type BundeslandHeroMediaProps = {
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

export function BundeslandHeroMedia(props: BundeslandHeroMediaProps) {
  return (
    <>
      <div className="d-none d-md-block">
        <BundeslandHeroDesktop
          imageSrc={props.imageSrc}
          imageSrcs={props.imageSrcs}
          mapSvg={props.mapSvg}
          mapTheme={props.mapTheme}
          mapMode={props.mapMode}
          mapKind={props.mapKind}
          mapUnitKey={props.mapUnitKey}
          mapCtx={props.mapCtx}
          mapFractionDigits={props.mapFractionDigits}
          mapNote={props.mapNote}
          cta={props.cta}
        />
      </div>
      <div className="d-md-none">
        <BundeslandHeroMobile
          mapSvg={props.mapSvg}
          mapTheme={props.mapTheme}
          mapMode={props.mapMode}
          mapKind={props.mapKind}
          mapUnitKey={props.mapUnitKey}
          mapCtx={props.mapCtx}
          mapFractionDigits={props.mapFractionDigits}
          mapNote={props.mapNote}
        />
      </div>
    </>
  );
}
