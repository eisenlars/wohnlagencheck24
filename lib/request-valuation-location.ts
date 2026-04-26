import type {
  LageclusterMarketType,
  LageclusterQuality,
  LageclusterRelation,
  ResolvedLageclusterRuntime,
} from "@/lib/lagecluster-runtime";

type GeocodeCandidate = {
  lat: number;
  lng: number;
  displayName: string;
};

export type RequestValuationLocationMatch = {
  lat: number;
  lng: number;
  displayName: string;
  quality: LageclusterQuality;
  relation: LageclusterRelation;
  relationSource: "ortslage" | "kreis";
  qualityLabel: string;
};

type GeocodeArgs = {
  street: string;
  houseNumber?: string | null;
  city: string;
  state?: string | null;
  postalCode?: string | null;
};

function asText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function slugToLabel(slug: string | null | undefined): string | null {
  const value = asText(slug);
  if (!value) return null;
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildStreetValue(street: string, houseNumber?: string | null): string {
  const normalizedStreet = street.trim();
  const normalizedHouseNumber = asText(houseNumber);
  return normalizedHouseNumber ? `${normalizedHouseNumber} ${normalizedStreet}` : normalizedStreet;
}

async function searchNominatimStructured(args: GeocodeArgs): Promise<GeocodeCandidate[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "5");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("countrycodes", "de");
  url.searchParams.set("street", buildStreetValue(args.street, args.houseNumber));
  url.searchParams.set("city", args.city);
  if (args.state) url.searchParams.set("state", args.state);
  if (args.postalCode) url.searchParams.set("postalcode", args.postalCode);

  const res = await fetch(url.toString(), {
    headers: {
      "Accept-Language": "de",
      "User-Agent": "wohnlagencheck24-request-valuation/1.0",
    },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const rows = (await res.json()) as Array<Record<string, unknown>>;
  return rows
    .map((row) => {
      const lat = Number(row.lat);
      const lng = Number(row.lon);
      const displayName = asText(row.display_name);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || !displayName) return null;
      return { lat, lng, displayName };
    })
    .filter((row): row is GeocodeCandidate => row !== null);
}

async function searchNominatimFreeform(args: GeocodeArgs): Promise<GeocodeCandidate[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "5");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("countrycodes", "de");
  url.searchParams.set(
    "q",
    [
      buildStreetValue(args.street, args.houseNumber),
      args.postalCode ? `${args.postalCode} ${args.city}` : args.city,
      args.state ?? null,
      "Deutschland",
    ]
      .filter(Boolean)
      .join(", "),
  );

  const res = await fetch(url.toString(), {
    headers: {
      "Accept-Language": "de",
      "User-Agent": "wohnlagencheck24-request-valuation/1.0",
    },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const rows = (await res.json()) as Array<Record<string, unknown>>;
  return rows
    .map((row) => {
      const lat = Number(row.lat);
      const lng = Number(row.lon);
      const displayName = asText(row.display_name);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || !displayName) return null;
      return { lat, lng, displayName };
    })
    .filter((row): row is GeocodeCandidate => row !== null);
}

export async function geocodeRequestValuationAddress(args: GeocodeArgs): Promise<GeocodeCandidate | null> {
  const structured = await searchNominatimStructured(args);
  if (structured[0]) return structured[0];
  const freeform = await searchNominatimFreeform(args);
  return freeform[0] ?? null;
}

function pointInRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]?.[0];
    const yi = ring[i]?.[1];
    const xj = ring[j]?.[0];
    const yj = ring[j]?.[1];
    if (
      typeof xi !== "number"
      || typeof yi !== "number"
      || typeof xj !== "number"
      || typeof yj !== "number"
    ) {
      continue;
    }
    const intersects = ((yi > lat) !== (yj > lat))
      && (lng < ((xj - xi) * (lat - yi)) / ((yj - yi) || Number.EPSILON) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInPolygon(lng: number, lat: number, polygon: number[][][]): boolean {
  const outer = polygon[0];
  if (!outer || !pointInRing(lng, lat, outer)) return false;
  for (let i = 1; i < polygon.length; i += 1) {
    if (pointInRing(lng, lat, polygon[i] ?? [])) return false;
  }
  return true;
}

function pointInMultiPolygon(lng: number, lat: number, multiPolygon: number[][][][]): boolean {
  return multiPolygon.some((polygon) => pointInPolygon(lng, lat, polygon));
}

function pointInBBox(lng: number, lat: number, bbox: [number, number, number, number]): boolean {
  return lng >= bbox[0] && lat >= bbox[1] && lng <= bbox[2] && lat <= bbox[3];
}

function qualityToLabel(quality: LageclusterQuality): string {
  switch (quality) {
    case "LOW":
      return "eher einfache Lage";
    case "MIDDLE":
      return "einfache bis mittlere Lage";
    case "GOOD":
      return "mittlere bis gute Lage";
    case "VERY_GOOD":
      return "gute bis sehr gute Lage";
    case "EXCELLENT":
      return "sehr gute Lage";
  }
}

export function matchRequestValuationLocation(args: {
  runtime: ResolvedLageclusterRuntime;
  marketType: LageclusterMarketType;
  lat: number;
  lng: number;
  displayName: string;
}): RequestValuationLocationMatch | null {
  const item = args.runtime.items.find((entry) =>
    pointInBBox(args.lng, args.lat, entry.bbox) && pointInMultiPolygon(args.lng, args.lat, entry.poly),
  );
  if (!item) return null;

  const ortRelation = args.runtime.relations[args.marketType]?.[item.q] ?? null;
  const countyRelation = args.runtime.countyRelations[args.marketType]?.[item.q] ?? null;
  const relation = ortRelation ?? countyRelation;
  if (!relation) return null;

  return {
    lat: args.lat,
    lng: args.lng,
    displayName: args.displayName,
    quality: item.q,
    relation,
    relationSource: ortRelation ? "ortslage" : "kreis",
    qualityLabel: qualityToLabel(item.q),
  };
}

export function buildRequestValuationStateLabel(bundeslandSlug: string | null | undefined): string | null {
  return slugToLabel(bundeslandSlug);
}
