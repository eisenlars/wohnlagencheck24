import type { MappedOffer, PartnerIntegration } from "@/lib/providers/types";

type PropstackImage = {
  id?: number;
  url?: string;
  title?: string;
  position?: number;
};

type PropstackUnit = {
  id: number | string;
  exposee_id?: string | null;
  marketing_type?: string | null;
  rs_type?: string | null;
  title?: string | null;
  description_note?: string | null;
  location_note?: string | null;
  furnishing_note?: string | null;
  street?: string | null;
  house_number?: string | null;
  zip_code?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  lat?: number | null;
  lng?: number | null;
  hide_address?: boolean | null;
  purchase_price?: number | null;
  rent_net?: number | null;
  living_space?: number | null;
  number_of_rooms?: number | null;
  energy_certificate_type?: string | null;
  energy_consumption_value?: number | null;
  construction_year?: number | null;
  custom_fields?: Record<string, unknown> | null;
  updated_at?: string | null;
  images?: PropstackImage[] | null;
};

function normalizeOfferType(marketingType?: string | null): "kauf" | "miete" {
  if (!marketingType) return "kauf";
  const value = marketingType.toUpperCase();
  if (value === "RENT" || value === "LET") return "miete";
  return "kauf";
}

function normalizeObjectType(rsType?: string | null): "haus" | "wohnung" {
  if (!rsType) return "wohnung";
  const value = rsType.toUpperCase();
  if (value.includes("HOUSE")) return "haus";
  return "wohnung";
}

function buildAddress(unit: PropstackUnit): string | null {
  if (unit.hide_address) return null;
  const parts = [
    unit.street?.trim(),
    unit.house_number?.trim(),
    unit.zip_code?.trim(),
    unit.city?.trim(),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}

function buildDetailUrl(template: string | null, unit: PropstackUnit): string | null {
  if (!template) return null;
  const exposeeId = unit.exposee_id ?? "";
  const id = unit.id ?? "";
  return template
    .replace("{exposee_id}", String(exposeeId))
    .replace("{id}", String(id));
}

function normalizeImages(images?: PropstackImage[] | null): string[] {
  if (!Array.isArray(images)) return [];
  return images
    .map((img) => img.url)
    .filter((url): url is string => typeof url === "string" && url.length > 0);
}

export function mapPropstackUnit(
  partnerId: string,
  integration: PartnerIntegration,
  unit: PropstackUnit,
): MappedOffer {
  const gallery = normalizeImages(unit.images);
  const address = buildAddress(unit);

  return {
    partner_id: partnerId,
    source: "propstack",
    external_id: String(unit.id),
    offer_type: normalizeOfferType(unit.marketing_type),
    object_type: normalizeObjectType(unit.rs_type),
    title: unit.title ?? null,
    price: unit.purchase_price ?? null,
    rent: unit.rent_net ?? null,
    area_sqm: unit.living_space ?? null,
    rooms: unit.number_of_rooms ?? null,
    address,
    image_url: gallery[0] ?? null,
    detail_url: buildDetailUrl(integration.detail_url_template, unit),
    is_top: false,
    updated_at: unit.updated_at ?? null,
    raw: {
      exposee_id: unit.exposee_id ?? null,
      description: unit.description_note ?? null,
      location: unit.location_note ?? null,
      features_note: unit.furnishing_note ?? null,
      energy: {
        type: unit.energy_certificate_type ?? null,
        demand: unit.energy_consumption_value ?? null,
        year: unit.construction_year ?? null,
      },
      gallery,
      lat: unit.lat ?? null,
      lng: unit.lng ?? null,
      custom_fields: unit.custom_fields ?? null,
      region: unit.region ?? null,
      country: unit.country ?? null,
    },
  };
}

export async function fetchPropstackUnits(
  integration: PartnerIntegration,
  apiKey: string,
): Promise<PropstackUnit[]> {
  const base = integration.base_url?.trim() || "https://api.propstack.de/v1";
  const units: PropstackUnit[] = [];
  const perPage = 50;
  let page = 1;

  while (true) {
    const url = new URL(`${base.replace(/\/+$/, "")}/units`);
    url.searchParams.set("expand", "1");
    url.searchParams.set("page", String(page));
    url.searchParams.set("per", String(perPage));

    const res = await fetch(url.toString(), {
      headers: {
        "X-API-KEY": apiKey,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Propstack fetch failed (${res.status}): ${body}`);
    }

    const json = await res.json();
    const batch = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : [];

    if (!Array.isArray(batch) || batch.length === 0) break;

    units.push(...(batch as PropstackUnit[]));

    if (batch.length < perPage) break;
    page += 1;
  }

  return units;
}
