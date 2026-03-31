// features/immobilienmarkt/sections/types.ts

import type { MarketExplanationFaqMap } from "@/lib/market-explanation-faqs";
import type { ComponentType } from "react";
import type { MarketExplanationStaticTextMap } from "@/lib/market-explanation-static-text-definitions";
import type { PortalSystemTextMap } from "@/lib/portal-system-text-definitions";

export type TabItem = {
  id: string;
  label: string;
  iconSrc?: string;
};

export type TocItem = {
  id: string;
  label: string;
};

export type OrtsRef = {
  slug: string;
  name: string;
};

export type MaklerRef = {
  slug: string;
  name: string;
  imageSrc: string;
  kontaktHref: string;
};

export type SectionCtx = {
  bundeslandSlug?: string;
  kreisSlug?: string;
  ortSlug?: string;
  orte?: OrtsRef[];
  berater?: Array<{ slug: string; name: string; imageSrc: string; kontaktHref: string }>;
  makler?: MaklerRef[];
};

export type SectionAssets = {
  heroImageSrc?: string;
  immobilienpreisMapSvg?: string | null;
  immobilienpreisLegendHtml?: string | null;
  mietpreisMapSvg?: string | null;
  mietpreisLegendHtml?: string | null;
  grundstueckspreisMapSvg?: string | null;
  grundstueckspreisLegendHtml?: string | null;
  kreisuebersichtMapSvg?: string | null;
  kaufpreisfaktorMapSvg?: string | null;
  kaufpreisfaktorLegendHtml?: string | null;
  kaufkraftindexMapSvg?: string | null;
  kaufkraftindexLegendHtml?: string | null;
  flaechennutzungGewerbeImageSrc?: string | null;
  flaechennutzungGewerbeUsesKreisFallback?: boolean;
  flaechennutzungWohnbauImageSrc?: string | null;
  flaechennutzungWohnbauUsesKreisFallback?: boolean;
  wohnungssaldoMapSvg?: string | null;
  wohnungssaldoLegendHtml?: string | null;
  wohnlagencheckMapSvgs?: Partial<Record<string, string | null>>;
  wohnlagencheckLegendHtml?: Partial<Record<string, string | null>>;
};

export type SectionPropsBase = {
  tabs: TabItem[];
  activeTabId: string;
  tocItems: TocItem[];
  basePath: string;
  parentBasePath?: string;
  texts: PortalSystemTextMap;
  marketExplanationTexts: MarketExplanationStaticTextMap;
  marketExplanationFaqs: MarketExplanationFaqMap;
  ctx?: SectionCtx;
  assets?: SectionAssets;
};

export type SectionComponent<VM = unknown> = ComponentType<SectionPropsBase & { vm: VM }>;
