"use client";

import React, { useEffect, useState } from "react";
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
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(max-width: 767.98px)");
    const updateIsMobile = () => setIsMobile(mediaQuery.matches);

    updateIsMobile();

    mediaQuery.addEventListener("change", updateIsMobile);
    return () => mediaQuery.removeEventListener("change", updateIsMobile);
  }, []);

  if (isMobile === null) return null;

  return isMobile ? (
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
  ) : (
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
  );
}
