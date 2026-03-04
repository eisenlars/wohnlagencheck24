export const REPORTS_TAG = "reports";
export const REPORTS_INDEX_TAG = "reports:index";
export const REPORTS_DEUTSCHLAND_TAG = "reports:de";
export const REPORTS_VISIBILITY_TAG = "reports:visibility";

type ScopeSlugs = {
  bundeslandSlug?: string | null;
  kreisSlug?: string | null;
  ortSlug?: string | null;
};

type AreaLike = {
  slug?: string | null;
  parent_slug?: string | null;
  bundesland_slug?: string | null;
};

function norm(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

export function reportBundeslandTag(bundeslandSlug: string): string {
  return `reports:bl:${norm(bundeslandSlug)}`;
}

export function reportKreisTag(bundeslandSlug: string, kreisSlug: string): string {
  return `reports:kr:${norm(bundeslandSlug)}/${norm(kreisSlug)}`;
}

export function reportOrtTag(bundeslandSlug: string, kreisSlug: string, ortSlug: string): string {
  return `reports:ort:${norm(bundeslandSlug)}/${norm(kreisSlug)}/${norm(ortSlug)}`;
}

function dedupe(tags: string[]): string[] {
  return Array.from(new Set(tags.filter(Boolean)));
}

export function reportScopeTagsFromSlugs(slugs: ScopeSlugs): string[] {
  const bundeslandSlug = norm(slugs.bundeslandSlug);
  const kreisSlug = norm(slugs.kreisSlug);
  const ortSlug = norm(slugs.ortSlug);

  const tags: string[] = [];
  if (bundeslandSlug) tags.push(reportBundeslandTag(bundeslandSlug));
  if (bundeslandSlug && kreisSlug) tags.push(reportKreisTag(bundeslandSlug, kreisSlug));
  if (bundeslandSlug && kreisSlug && ortSlug) tags.push(reportOrtTag(bundeslandSlug, kreisSlug, ortSlug));
  return dedupe(tags);
}

export function reportScopeTagsForRouteSlugs(slugs: string[]): string[] {
  const [bundeslandSlug, kreisSlug, ortSlug] = slugs;
  if (slugs.length <= 0) return [REPORTS_INDEX_TAG, REPORTS_DEUTSCHLAND_TAG];
  if (slugs.length === 1) return reportScopeTagsFromSlugs({ bundeslandSlug });
  if (slugs.length === 2) return reportScopeTagsFromSlugs({ bundeslandSlug, kreisSlug });
  return reportScopeTagsFromSlugs({ bundeslandSlug, kreisSlug, ortSlug });
}

export function reportScopeTagsForArea(area: AreaLike): string[] {
  const slug = norm(area.slug);
  const parentSlug = norm(area.parent_slug);
  const bundeslandSlug = norm(area.bundesland_slug);
  if (!slug || !bundeslandSlug) return [];

  const isKreis = parentSlug === bundeslandSlug;
  if (isKreis) {
    return reportScopeTagsFromSlugs({ bundeslandSlug, kreisSlug: slug });
  }
  if (parentSlug) {
    return reportScopeTagsFromSlugs({ bundeslandSlug, kreisSlug: parentSlug, ortSlug: slug });
  }
  return reportScopeTagsFromSlugs({ bundeslandSlug });
}

export function reportScopeTagsFromReportPath(path: string): string[] {
  const parts = String(path ?? "")
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);

  const deutschlandIdx = parts.findIndex((part) => part === "deutschland");
  if (deutschlandIdx < 0) return [];

  const bundeslandSlug = parts[deutschlandIdx + 1] ?? "";
  const maybeKreisOrFile = parts[deutschlandIdx + 2] ?? "";
  const maybeOrtFile = parts[deutschlandIdx + 3] ?? "";

  if (!bundeslandSlug) return [];

  const clean = (value: string) => value.replace(/\.json$/i, "");
  const level2 = clean(maybeKreisOrFile);
  const level3 = clean(maybeOrtFile);

  if (!level2) {
    return reportScopeTagsFromSlugs({ bundeslandSlug });
  }
  if (!level3) {
    return reportScopeTagsFromSlugs({ bundeslandSlug, kreisSlug: level2 });
  }
  return reportScopeTagsFromSlugs({ bundeslandSlug, kreisSlug: level2, ortSlug: level3 });
}

