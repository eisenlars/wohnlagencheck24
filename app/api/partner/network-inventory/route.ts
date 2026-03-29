import { NextResponse } from "next/server";

import { requireNetworkPartnerActorContext } from "@/lib/network-partners/auth";
import {
  assertPortalPartnerOwnsArea,
  requirePortalPartnerRole,
} from "@/lib/network-partners/roles";
import {
  createInventoryEntry,
  listInventoryByPartner,
  listPlacementCatalog,
} from "@/lib/network-partners/repositories/inventory";
import type { PlacementCode } from "@/lib/network-partners/types";

type InventoryBody = {
  area_id?: string;
  placement_code?: PlacementCode;
  slot_limit?: number;
  is_active?: boolean;
};

function asRequiredText(value: unknown): string | null {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

function asPlacementCode(value: unknown): PlacementCode | null {
  const normalized = String(value ?? "").trim();
  if (
    normalized === "company_profile"
    || normalized === "property_offer"
    || normalized === "property_request"
  ) {
    return normalized;
  }
  return null;
}

function asPositiveInteger(value: unknown): number | null {
  const numeric =
    typeof value === "number" ? value
      : typeof value === "string" && value.trim().length > 0 ? Number(value)
        : NaN;
  if (!Number.isInteger(numeric) || numeric <= 0) return null;
  return numeric;
}

function mapInventoryError(error: Error) {
  if (error.message === "UNAUTHORIZED") return { status: 401, error: "Unauthorized" };
  if (error.message === "FORBIDDEN") return { status: 403, error: "Forbidden" };
  if (error.message === "NO_UPDATE_FIELDS") return { status: 400, error: "No update fields provided" };
  if (error.message === "INVALID_SLOT_LIMIT") return { status: 400, error: "slot_limit must be a positive integer" };
  if (error.message === "INVALID_PLACEMENT_CODE") return { status: 400, error: "Invalid placement_code" };
  if (error.message === "NOT_FOUND") return { status: 404, error: "Inventory entry not found" };
  return { status: 500, error: error.message || "Unexpected error" };
}

export async function GET() {
  try {
    const actor = requirePortalPartnerRole(
      await requireNetworkPartnerActorContext(),
      ["partner_owner", "partner_manager", "partner_billing"],
    );

    const [inventory, placementCatalog] = await Promise.all([
      listInventoryByPartner(actor.partnerId),
      listPlacementCatalog(),
    ]);

    return NextResponse.json({
      ok: true,
      inventory,
      placement_catalog: placementCatalog,
    });
  } catch (error) {
    const mapped = mapInventoryError(error as Error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

export async function POST(req: Request) {
  try {
    const actor = requirePortalPartnerRole(
      await requireNetworkPartnerActorContext(),
      ["partner_owner", "partner_manager"],
    );
    const body = (await req.json()) as InventoryBody;

    const areaId = asRequiredText(body.area_id);
    const placementCode = asPlacementCode(body.placement_code);
    const slotLimit = asPositiveInteger(body.slot_limit);

    if (!areaId) {
      return NextResponse.json({ error: "area_id is required" }, { status: 400 });
    }
    if (!placementCode) {
      return NextResponse.json({ error: "Invalid placement_code" }, { status: 400 });
    }
    if (!slotLimit) {
      return NextResponse.json({ error: "slot_limit must be a positive integer" }, { status: 400 });
    }

    await assertPortalPartnerOwnsArea(actor.partnerId, areaId);

    const entry = await createInventoryEntry({
      partner_id: actor.partnerId,
      area_id: areaId,
      placement_code: placementCode,
      slot_limit: slotLimit,
      is_active: body.is_active !== false,
    });

    return NextResponse.json({ ok: true, inventory_entry: entry }, { status: 201 });
  } catch (error) {
    const mapped = mapInventoryError(error as Error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
