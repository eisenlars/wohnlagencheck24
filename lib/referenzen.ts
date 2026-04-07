import { createClient } from "@/utils/supabase/server";
import { normalizePublicLocale } from "@/lib/public-locale-routing";

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
  statusBadge: string | null;
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
  locale?: string;
}): Promise<RegionalReference[]> {
  const limit = Math.max(1, Math.min(args.limit ?? 6, 12));
  const supabase = createClient();
  const normalizedLocale = normalizePublicLocale(args.locale);

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

  const { data: refRows, error: refError } = await supabase
    .from("public_reference_entries")
    .select("reference_id, partner_id, provider, external_id, title, description, image_url, city, district, source_updated_at")
    .in("visible_area_id", areaIds)
    .eq("locale", normalizedLocale)
    .order("source_updated_at", { ascending: false })
    .limit(60);
  if (refError) return [];

  const baseRows = (refRows ?? []) as Array<Record<string, unknown>>;
  const referenceIds = Array.from(
    new Set(
      baseRows
        .map((row) => String(row.reference_id ?? row.id ?? ""))
        .filter(Boolean),
    ),
  );
  const normalizedByReferenceId = new Map<string, Record<string, unknown> | null>();
  if (referenceIds.length > 0) {
    const { data: normalizedRows, error: normalizedError } = await supabase
      .from("partner_references")
      .select("id, normalized_payload")
      .in("id", referenceIds);
    if (!normalizedError) {
      for (const row of (normalizedRows ?? []) as Array<Record<string, unknown>>) {
        normalizedByReferenceId.set(
          String(row.id ?? ""),
          (row.normalized_payload as Record<string, unknown> | null) ?? null,
        );
      }
    }
  }
  const seen = new Set<string>();
  const mapped: RegionalReference[] = [];
  for (const row of baseRows) {
    const referenceId = String(row.reference_id ?? row.id ?? "");
    if (!referenceId || seen.has(referenceId)) continue;
    seen.add(referenceId);
    const normalizedPayload = normalizedByReferenceId.get(referenceId) ?? null;
    const transactionResult = asText(normalizedPayload?.transaction_result);
    mapped.push({
      id: referenceId,
      partnerId: String(row.partner_id ?? ""),
      provider: String(row.provider ?? ""),
      externalId: String(row.external_id ?? ""),
      title: asText(row.title) || "Erfolgreich vermittelt",
      description: asText(row.description),
      imageUrl: asText(row.image_url) || null,
      city: asText(row.city) || null,
      district: asText(row.district) || null,
      updatedAt: asText(row.source_updated_at) || null,
      statusBadge: transactionResult === "reserviert" ? "Reserviert" : null,
    });
  }

  return shuffle(mapped).slice(0, limit);
}
