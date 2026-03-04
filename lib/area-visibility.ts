import { VISIBILITY_INDEX_STORAGE_PATH, type VisibilityIndex } from "@/lib/visibility-index";
import { buildVisibilityIndexFromDb } from "@/lib/visibility-index";
import { createAdminClient } from "@/utils/supabase/admin";
import { REPORTS_VISIBILITY_TAG } from "@/lib/cache-tags";

const SUPABASE_PUBLIC_BASE_URL = process.env.SUPABASE_PUBLIC_BASE_URL ?? "";
const SUPABASE_BUCKET = "immobilienmarkt";
const SUPABASE_ROOT = SUPABASE_PUBLIC_BASE_URL
  ? `${SUPABASE_PUBLIC_BASE_URL.replace(/\/+$/, "")}/${SUPABASE_BUCKET}`
  : "";
const DEFAULT_REVALIDATE_SECONDS = 60;

function joinPath(...parts: string[]): string {
  return parts
    .map((part) => part.replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/");
}

function buildSupabaseUrl(...parts: string[]): string | null {
  if (!SUPABASE_ROOT) return null;
  const rel = joinPath(...parts);
  return `${SUPABASE_ROOT}/${rel}`;
}

function key2(a: string, b: string): string {
  return `${a}::${b}`;
}

async function fetchVisibilityIndex(): Promise<VisibilityIndex | null> {
  const url = buildSupabaseUrl(VISIBILITY_INDEX_STORAGE_PATH);
  if (!url) {
    try {
      const admin = createAdminClient();
      return await buildVisibilityIndexFromDb(admin as never);
    } catch {
      return null;
    }
  }
  try {
    const res = await fetch(url, {
      next: { revalidate: DEFAULT_REVALIDATE_SECONDS, tags: [REPORTS_VISIBILITY_TAG] },
    });
    if (!res.ok) {
      try {
        const admin = createAdminClient();
        return await buildVisibilityIndexFromDb(admin as never);
      } catch {
        return null;
      }
    }
    return (await res.json()) as VisibilityIndex;
  } catch {
    try {
      const admin = createAdminClient();
      return await buildVisibilityIndexFromDb(admin as never);
    } catch {
      return null;
    }
  }
}

export async function getActiveKreisSlugsForBundesland(bundeslandSlug: string): Promise<Set<string>> {
  const index = await fetchVisibilityIndex();
  const kreise = index?.bundeslaender?.[bundeslandSlug]?.kreise ?? [];
  return new Set(kreise);
}

export async function getActiveOrtSlugsForKreis(
  bundeslandSlug: string,
  kreisSlug: string,
): Promise<Set<string>> {
  const index = await fetchVisibilityIndex();
  const compositeKey = key2(bundeslandSlug, kreisSlug);
  const orte =
    index?.kreise?.[compositeKey]?.orte ??
    // backward compatibility for older manifests keyed only by kreis slug
    index?.kreise?.[kreisSlug]?.orte ??
    [];
  return new Set(orte);
}

export async function isBundeslandVisible(bundeslandSlug: string): Promise<boolean> {
  const activeKreise = await getActiveKreisSlugsForBundesland(bundeslandSlug);
  return activeKreise.size > 0;
}

export async function isKreisVisible(bundeslandSlug: string, kreisSlug: string): Promise<boolean> {
  const activeKreise = await getActiveKreisSlugsForBundesland(bundeslandSlug);
  return activeKreise.has(kreisSlug);
}

export async function isOrtslageVisible(
  bundeslandSlug: string,
  kreisSlug: string,
  ortSlug: string,
): Promise<boolean> {
  const isKreisActive = await isKreisVisible(bundeslandSlug, kreisSlug);
  if (!isKreisActive) return false;
  const activeOrte = await getActiveOrtSlugsForKreis(bundeslandSlug, kreisSlug);
  if (activeOrte.size === 0) {
    // If no explicit ort mappings exist, a released Kreis exposes all Ortslagen.
    return true;
  }
  return activeOrte.has(ortSlug);
}
