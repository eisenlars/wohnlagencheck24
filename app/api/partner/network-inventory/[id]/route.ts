import { NextResponse } from "next/server";

import { requireNetworkPartnerActorContext } from "@/lib/network-partners/auth";
import { requirePortalPartnerRole } from "@/lib/network-partners/roles";
import {
  getInventoryEntryByIdForPartner,
  updateInventoryEntry,
} from "@/lib/network-partners/repositories/inventory";

type InventoryPatchBody = {
  slot_limit?: number;
  is_active?: boolean;
};

function asRequiredText(value: unknown): string | null {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
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
  if (error.message === "NOT_FOUND") return { status: 404, error: "Inventory entry not found" };
  return { status: 500, error: error.message || "Unexpected error" };
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const actor = requirePortalPartnerRole(
      await requireNetworkPartnerActorContext(),
      ["partner_owner", "partner_manager", "partner_billing"],
    );
    const params = await ctx.params;
    const inventoryId = asRequiredText(params.id);
    if (!inventoryId) {
      return NextResponse.json({ error: "Missing inventory id" }, { status: 400 });
    }

    const entry = await getInventoryEntryByIdForPartner(inventoryId, actor.partnerId);
    if (!entry) {
      return NextResponse.json({ error: "Inventory entry not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, inventory_entry: entry });
  } catch (error) {
    const mapped = mapInventoryError(error as Error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const actor = requirePortalPartnerRole(
      await requireNetworkPartnerActorContext(),
      ["partner_owner", "partner_manager"],
    );
    const params = await ctx.params;
    const inventoryId = asRequiredText(params.id);
    if (!inventoryId) {
      return NextResponse.json({ error: "Missing inventory id" }, { status: 400 });
    }

    const body = (await req.json()) as InventoryPatchBody;
    const patch: {
      id: string;
      partner_id: string;
      slot_limit?: number;
      is_active?: boolean;
    } = {
      id: inventoryId,
      partner_id: actor.partnerId,
    };

    if (body.slot_limit !== undefined) {
      const slotLimit = asPositiveInteger(body.slot_limit);
      if (!slotLimit) {
        return NextResponse.json({ error: "slot_limit must be a positive integer" }, { status: 400 });
      }
      patch.slot_limit = slotLimit;
    }
    if (body.is_active !== undefined) {
      patch.is_active = body.is_active === true;
    }

    const entry = await updateInventoryEntry(patch);
    return NextResponse.json({ ok: true, inventory_entry: entry });
  } catch (error) {
    const mapped = mapInventoryError(error as Error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
