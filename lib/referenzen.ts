import { createClient } from "@/utils/supabase/server";
import { loadPublicVisiblePartnerIdsForAreaIds } from "@/lib/public-partner-mappings";

export type RegionalReference = {
  id: string;
  partnerId: string;
  provider: string;
  externalId: string;
  title: string;
  description: string;
  imageUrl: string | null;
  city: string | null;
  district: string | null;
  updatedAt: string | null;
};

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export async function getRandomReferencesForKreis(args: {
  bundeslandSlug: string;
  kreisSlug: string;
  limit?: number;
}): Promise<RegionalReference[]> {
  const limit = Math.max(1, Math.min(args.limit ?? 6, 12));
  const supabase = createClient();

  const { data: areaRows, error: areaError } = await supabase
    .from("areas")
    .select("id")
    .eq("bundesland_slug", args.bundeslandSlug)
    .or(`slug.eq.${args.kreisSlug},parent_slug.eq.${args.kreisSlug}`);
  if (areaError) return [];

  const areaIds = (areaRows ?? [])
    .map((row) => String((row as { id?: unknown }).id ?? ""))
    .filter(Boolean);
  if (areaIds.length === 0) return [];

  let partnerIds: string[] = [];
  try {
    partnerIds = await loadPublicVisiblePartnerIdsForAreaIds(supabase, areaIds);
  } catch {
    return [];
  }
  if (partnerIds.length === 0) return [];

  const { data: refRows, error: refError } = await supabase
    .from("partner_references")
    .select("id, partner_id, provider, external_id, title, normalized_payload, updated_at")
    .in("partner_id", partnerIds)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(60);
  if (refError) return [];

  const baseRows = (refRows ?? []) as Array<Record<string, unknown>>;

  const keyRows = baseRows.map((row) => ({
    partnerId: String(row.partner_id ?? ""),
    provider: String(row.provider ?? ""),
    externalId: String(row.external_id ?? ""),
  }));

  const { data: overrideRows } = await supabase
    .from("partner_reference_overrides")
    .select("partner_id, source, external_id, seo_h1, short_description, long_description, seo_description")
    .in("partner_id", keyRows.map((k) => k.partnerId));

  const overrideMap = new Map<string, Record<string, unknown>>();
  for (const row of (overrideRows ?? []) as Array<Record<string, unknown>>) {
    const key = `${String(row.partner_id ?? "")}::${String(row.source ?? "")}::${String(row.external_id ?? "")}`;
    overrideMap.set(key, row);
  }

  const mapped: RegionalReference[] = baseRows.map((row) => {
    const payload = (row.normalized_payload ?? {}) as Record<string, unknown>;
    const key = `${String(row.partner_id ?? "")}::${String(row.provider ?? "")}::${String(row.external_id ?? "")}`;
    const ov = overrideMap.get(key);

    const title =
      asText(ov?.seo_h1) ||
      asText(row.title) ||
      asText(payload.title) ||
      "Erfolgreich vermittelt";
    const description =
      asText(ov?.short_description) ||
      asText(ov?.long_description) ||
      asText(ov?.seo_description) ||
      asText(payload.description) ||
      asText(payload.reference_text_seed);

    return {
      id: String(row.id ?? ""),
      partnerId: String(row.partner_id ?? ""),
      provider: String(row.provider ?? ""),
      externalId: String(row.external_id ?? ""),
      title,
      description,
      imageUrl: asText(payload.image_url) || null,
      city: asText(payload.city) || null,
      district: asText(payload.district) || null,
      updatedAt: asText(row.updated_at) || null,
    };
  });

  return shuffle(mapped).slice(0, limit);
}
