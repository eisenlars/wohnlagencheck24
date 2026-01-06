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
  plz?: string;
};

export type SectionCtx = {
  bundeslandSlug?: string;
  kreisSlug?: string;
  ortSlug?: string;
  orte?: OrtsRef[];
};

export type SectionAssets = {
  heroImageSrc?: string;
  immobilienpreisMapSvg?: string | null;
  mietpreisMapSvg?: string | null;
  kreisuebersichtMapSvg?: string | null;
};

export type SectionPropsBase = {
  tabs: TabItem[];
  activeTabId: string;
  tocItems: TocItem[];
  basePath: string;
  parentBasePath?: string;
  ctx?: SectionCtx;
  assets?: SectionAssets;
};
