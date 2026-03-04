import { revalidateTag } from "next/cache";
import { REPORTS_VISIBILITY_TAG } from "@/lib/cache-tags";

const BUCKET = "immobilienmarkt";
const VISIBILITY_INDEX_PATH = "reports/visibility_index.json";

type AdminClient = {
  from: (table: string) => {
    select: (columns: string) => QueryBuilder;
  };
  storage: {
    from: (bucket: string) => {
      upload: (
        path: string,
        body: string | Blob | ArrayBuffer | Uint8Array,
        options?: { upsert?: boolean; contentType?: string; cacheControl?: string },
      ) => Promise<{ data?: unknown; error?: { message: string } | null }>;
    };
  };
};

type QueryResult = { data?: unknown; error?: { message: string } | null };
type QueryBuilder = Promise<QueryResult> & {
  eq: (column: string, value: unknown) => QueryBuilder;
};

type AreaRow = {
  id?: string | null;
  slug?: string | null;
  parent_slug?: string | null;
  bundesland_slug?: string | null;
};

type ActiveMappingRow = {
  area_id?: string | null;
};

export type VisibilityIndex = {
  generated_at: string;
  bundeslaender: Record<string, { kreise: string[] }>;
  kreise: Record<string, { bundesland_slug: string; kreis_slug: string; orte: string[] }>;
};

function key2(a: string, b: string): string {
  return `${a}::${b}`;
}

export async function buildVisibilityIndexFromDb(admin: AdminClient): Promise<VisibilityIndex> {
  const { data: activeMappings, error: activeError } = await admin
    .from("partner_area_map")
    .select("area_id")
    .eq("is_active", true);
  if (activeError) throw new Error(activeError.message);

  const activeAreaIds = new Set(
    ((activeMappings ?? []) as ActiveMappingRow[])
      .map((row) => String(row.area_id ?? "").trim())
      .filter(Boolean),
  );

  const { data: areasRaw, error: areasError } = await admin
    .from("areas")
    .select("id, slug, parent_slug, bundesland_slug");
  if (areasError) throw new Error(areasError.message);

  const areas = (areasRaw ?? []) as AreaRow[];

  const kreisById = new Map<string, { slug: string; bundeslandSlug: string }>();
  const ortById = new Map<string, { slug: string; bundeslandSlug: string; kreisSlug: string }>();

  for (const row of areas) {
    const id = String(row.id ?? "").trim();
    const slug = String(row.slug ?? "").trim();
    const parentSlug = String(row.parent_slug ?? "").trim();
    const bundeslandSlug = String(row.bundesland_slug ?? "").trim();
    if (!id || !slug || !bundeslandSlug) continue;

    if (parentSlug === bundeslandSlug) {
      kreisById.set(id, { slug, bundeslandSlug });
      continue;
    }

    if (parentSlug) {
      ortById.set(id, { slug, bundeslandSlug, kreisSlug: parentSlug });
    }
  }

  const bundeslaender = new Map<string, Set<string>>();
  const kreise = new Map<string, { bundeslandSlug: string; kreisSlug: string; orte: Set<string> }>();

  for (const areaId of activeAreaIds) {
    const kreis = kreisById.get(areaId);
    if (kreis) {
      const blSet = bundeslaender.get(kreis.bundeslandSlug) ?? new Set<string>();
      blSet.add(kreis.slug);
      bundeslaender.set(kreis.bundeslandSlug, blSet);

      const kreisKey = key2(kreis.bundeslandSlug, kreis.slug);
      const kEntry =
        kreise.get(kreisKey) ??
        { bundeslandSlug: kreis.bundeslandSlug, kreisSlug: kreis.slug, orte: new Set<string>() };
      kreise.set(kreisKey, kEntry);
      continue;
    }

    const ort = ortById.get(areaId);
    if (ort) {
      const blSet = bundeslaender.get(ort.bundeslandSlug) ?? new Set<string>();
      blSet.add(ort.kreisSlug);
      bundeslaender.set(ort.bundeslandSlug, blSet);

      const kreisKey = key2(ort.bundeslandSlug, ort.kreisSlug);
      const kEntry =
        kreise.get(kreisKey) ??
        { bundeslandSlug: ort.bundeslandSlug, kreisSlug: ort.kreisSlug, orte: new Set<string>() };
      kEntry.orte.add(ort.slug);
      kreise.set(kreisKey, kEntry);
    }
  }

  const visibilityIndex: VisibilityIndex = {
    generated_at: new Date().toISOString(),
    bundeslaender: Object.fromEntries(
      Array.from(bundeslaender.entries()).map(([bl, kreisSet]) => [bl, { kreise: Array.from(kreisSet).sort() }]),
    ),
    kreise: Object.fromEntries(
      Array.from(kreise.entries()).map(([kreisKey, entry]) => [
        kreisKey,
        {
          bundesland_slug: entry.bundeslandSlug,
          kreis_slug: entry.kreisSlug,
          orte: Array.from(entry.orte).sort(),
        },
      ]),
    ),
  };

  return visibilityIndex;
}

export async function publishVisibilityIndex(admin: AdminClient): Promise<VisibilityIndex> {
  const index = await buildVisibilityIndexFromDb(admin);
  const payload = JSON.stringify(index, null, 2);

  const { error } = await admin.storage.from(BUCKET).upload(VISIBILITY_INDEX_PATH, payload, {
    upsert: true,
    contentType: "application/json",
    cacheControl: "60",
  });
  if (error) throw new Error(error.message);

  revalidateTag(REPORTS_VISIBILITY_TAG, "max");
  return index;
}

export const VISIBILITY_INDEX_STORAGE_PATH = VISIBILITY_INDEX_PATH;
