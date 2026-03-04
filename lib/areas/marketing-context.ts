import type { MarketingContext } from "@/lib/marketing-defaults";

const BUNDESLAND_NAMES: Record<string, string> = {
  "baden-wuerttemberg": "Baden-Württemberg",
  "bayern": "Bayern",
  "berlin": "Berlin",
  "brandenburg": "Brandenburg",
  "bremen": "Bremen",
  "hamburg": "Hamburg",
  "hessen": "Hessen",
  "mecklenburg-vorpommern": "Mecklenburg-Vorpommern",
  "niedersachsen": "Niedersachsen",
  "nordrhein-westfalen": "Nordrhein-Westfalen",
  "rheinland-pfalz": "Rheinland-Pfalz",
  "saarland": "Saarland",
  "sachsen": "Sachsen",
  "sachsen-anhalt": "Sachsen-Anhalt",
  "schleswig-holstein": "Schleswig-Holstein",
  "thueringen": "Thüringen",
};

type AreaRow = {
  id: string;
  name?: string | null;
  slug?: string | null;
  parent_slug?: string | null;
  bundesland_slug?: string | null;
  regionale_zuordnung?: string | null;
};

function normalize(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function slugToName(slug: string): string {
  return normalize(slug)
    .split("-")
    .filter(Boolean)
    .map((part) => (part.length ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}

function resolveBundeslandName(slug: string): string {
  const key = normalize(slug).toLowerCase();
  return BUNDESLAND_NAMES[key] ?? slugToName(key);
}

export async function resolveMarketingContextForArea(args: {
  admin: unknown;
  areaId: string;
}): Promise<MarketingContext | null> {
  const { admin, areaId } = args;
  type AreaQueryBuilder = {
    eq: (column: string, value: unknown) => AreaQueryBuilder;
    maybeSingle: () => Promise<{ data?: AreaRow | null }>;
  };
  const adminClient = admin as {
    from: (table: string) => {
      select: (columns: string) => AreaQueryBuilder;
    };
  };

  const { data: area } = await (adminClient
    .from("areas")
    .select("id, name, slug, parent_slug, bundesland_slug")
    .eq("id", areaId)).maybeSingle();

  if (!area) return null;

  const bundeslandSlug = normalize(area.bundesland_slug);
  const bundeslandName = resolveBundeslandName(bundeslandSlug);
  const isOrtslage = normalize(area.parent_slug).length > 0;

  if (!isOrtslage) {
    const kreisName = normalize(area.name) || slugToName(normalize(area.slug));
    const kreisType = kreisName.toLowerCase().startsWith("landkreis") ? "landkreis" : null;
    return {
      level: "kreis",
      kreisName,
      bundeslandName,
      regionaleZuordnungKreis: kreisType,
    };
  }

  const parentSlug = normalize(area.parent_slug);
  const { data: parent } = await (adminClient
    .from("areas")
    .select("id, name, slug, parent_slug, bundesland_slug")
    .eq("bundesland_slug", bundeslandSlug)
    .eq("slug", parentSlug)).maybeSingle();

  const kreisName = normalize(parent?.name) || slugToName(parentSlug);
  const ortslageName = normalize(area.name) || slugToName(normalize(area.slug));
  const kreisType = kreisName.toLowerCase().startsWith("landkreis") ? "landkreis" : null;

  return {
    level: "ortslage",
    kreisName,
    ortslageName,
    bundeslandName,
    regionaleZuordnungKreis: kreisType,
  };
}
