import { NextResponse } from "next/server";

import { loadResolvedLageclusterRuntime } from "@/lib/lagecluster-runtime";
import {
  buildRequestValuationStateLabel,
  geocodeRequestValuationAddress,
  matchRequestValuationLocation,
} from "@/lib/request-valuation-location";

type RequestValuationLocationPayload = {
  bundeslandSlug?: string | null;
  kreisSlug?: string | null;
  ortSlug?: string | null;
  regionLabel?: string | null;
  postalCode?: string | null;
  street?: string | null;
  houseNumber?: string | null;
  marketType?: string | null;
};

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isMarketType(value: string): value is "apartment_sell" | "apartment_rent" | "house_sell" | "house_rent" {
  return ["apartment_sell", "apartment_rent", "house_sell", "house_rent"].includes(value);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as RequestValuationLocationPayload;
    const bundeslandSlug = asText(body.bundeslandSlug);
    const kreisSlug = asText(body.kreisSlug);
    const ortSlug = asText(body.ortSlug);
    const regionLabel = asText(body.regionLabel);
    const postalCode = asText(body.postalCode);
    const street = asText(body.street);
    const houseNumber = asText(body.houseNumber);
    const marketType = asText(body.marketType);

    if (!bundeslandSlug || !kreisSlug || !ortSlug || !regionLabel || !street || !isMarketType(marketType)) {
      return NextResponse.json({ ok: false, error: "INVALID_REQUEST" }, { status: 400 });
    }

    const runtime = await loadResolvedLageclusterRuntime(bundeslandSlug, kreisSlug, ortSlug);
    if (!runtime) {
      return NextResponse.json({ ok: false, error: "LAGECLUSTER_UNAVAILABLE" }, { status: 404 });
    }

    const geocoded = await geocodeRequestValuationAddress({
      street,
      houseNumber,
      city: regionLabel,
      state: buildRequestValuationStateLabel(bundeslandSlug),
      postalCode: postalCode || null,
    });
    if (!geocoded) {
      return NextResponse.json({ ok: false, status: "geocode_not_found" });
    }

    const match = matchRequestValuationLocation({
      runtime,
      marketType,
      lat: geocoded.lat,
      lng: geocoded.lng,
      displayName: geocoded.displayName,
    });
    if (!match) {
      return NextResponse.json({
        ok: false,
        status: "polygon_not_found",
        geocoded: {
          lat: geocoded.lat,
          lng: geocoded.lng,
          displayName: geocoded.displayName,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      status: "matched",
      geocoded: {
        lat: match.lat,
        lng: match.lng,
        displayName: match.displayName,
      },
      quality: match.quality,
      qualityLabel: match.qualityLabel,
      relationSource: match.relationSource,
      relation: match.relation,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
