import { createAdminClient } from "@/utils/supabase/admin";
import type {
  PartnerAreaInventoryCreateInput,
  PartnerAreaInventoryRecord,
  PartnerAreaInventoryUpdateInput,
  PlacementCatalogRecord,
  PlacementCode,
} from "@/lib/network-partners/types";

function asText(value: unknown): string {
  return String(value ?? "").trim();
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asRowArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord);
}

function normalizePlacementCode(value: unknown): PlacementCode {
  const code = asText(value);
  if (code === "property_offer" || code === "property_request") return code;
  return "company_profile";
}

function mapPlacementCatalogRow(row: Record<string, unknown>): PlacementCatalogRecord {
  return {
    code: normalizePlacementCode(row.code),
    label: asText(row.label),
    content_type: normalizePlacementCode(row.content_type),
    billing_mode: "monthly_fixed",
    is_active: asBoolean(row.is_active),
  };
}

function mapInventoryRow(row: Record<string, unknown>): PartnerAreaInventoryRecord {
  return {
    id: asText(row.id),
    partner_id: asText(row.partner_id),
    area_id: asText(row.area_id),
    placement_code: normalizePlacementCode(row.placement_code),
    slot_limit: Math.max(0, Math.floor(asNumber(row.slot_limit))),
    is_active: asBoolean(row.is_active),
    created_at: asText(row.created_at),
    updated_at: asText(row.updated_at),
  };
}

function assertPositiveInteger(value: number, field: string) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`INVALID_${field.toUpperCase()}`);
  }
}

async function ensurePlacementIsActive(code: PlacementCode): Promise<void> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("placement_catalog")
    .select("code, is_active")
    .eq("code", code)
    .maybeSingle();

  if (error) throw new Error(error.message ?? "PLACEMENT_LOOKUP_FAILED");
  if (!data || data.is_active !== true) {
    throw new Error("INVALID_PLACEMENT_CODE");
  }
}

export async function assertPlacementIsActive(code: PlacementCode): Promise<void> {
  await ensurePlacementIsActive(code);
}

export async function listPlacementCatalog(): Promise<PlacementCatalogRecord[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("placement_catalog")
    .select("code, label, content_type, billing_mode, is_active")
    .eq("is_active", true)
    .order("label", { ascending: true });

  if (error) throw new Error(error.message ?? "PLACEMENT_CATALOG_LIST_FAILED");
  return asRowArray(data).map((row) => mapPlacementCatalogRow(row));
}

export async function listInventoryByPartner(
  partnerId: string,
): Promise<PartnerAreaInventoryRecord[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("partner_area_inventory")
    .select("id, partner_id, area_id, placement_code, slot_limit, is_active, created_at, updated_at")
    .eq("partner_id", partnerId)
    .order("area_id", { ascending: true });

  if (error) throw new Error(error.message ?? "INVENTORY_LIST_FAILED");
  return asRowArray(data).map((row) => mapInventoryRow(row));
}

export async function getInventoryEntryByIdForPartner(
  id: string,
  partnerId: string,
): Promise<PartnerAreaInventoryRecord | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("partner_area_inventory")
    .select("id, partner_id, area_id, placement_code, slot_limit, is_active, created_at, updated_at")
    .eq("id", id)
    .eq("partner_id", partnerId)
    .maybeSingle();

  if (error) throw new Error(error.message ?? "INVENTORY_LOOKUP_FAILED");
  return isRecord(data) ? mapInventoryRow(data) : null;
}

export async function createInventoryEntry(
  input: PartnerAreaInventoryCreateInput,
): Promise<PartnerAreaInventoryRecord> {
  assertPositiveInteger(input.slot_limit, "slot_limit");
  await ensurePlacementIsActive(input.placement_code);

  const admin = createAdminClient();
  const payload = {
    partner_id: input.partner_id,
    area_id: input.area_id,
    placement_code: input.placement_code,
    slot_limit: input.slot_limit,
    is_active: input.is_active !== false,
  };

  const { data, error } = await admin
    .from("partner_area_inventory")
    .insert(payload)
    .select("id, partner_id, area_id, placement_code, slot_limit, is_active, created_at, updated_at")
    .maybeSingle();

  if (error) throw new Error(error.message ?? "INVENTORY_CREATE_FAILED");
  if (!isRecord(data)) throw new Error("INVENTORY_CREATE_FAILED");
  return mapInventoryRow(data);
}

export async function updateInventoryEntry(
  input: PartnerAreaInventoryUpdateInput,
): Promise<PartnerAreaInventoryRecord> {
  const patch: Record<string, unknown> = {};
  if (input.slot_limit !== undefined) {
    assertPositiveInteger(input.slot_limit, "slot_limit");
    patch.slot_limit = input.slot_limit;
  }
  if (input.is_active !== undefined) {
    patch.is_active = input.is_active === true;
  }
  if (Object.keys(patch).length === 0) {
    throw new Error("NO_UPDATE_FIELDS");
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("partner_area_inventory")
    .update(patch)
    .eq("id", input.id)
    .eq("partner_id", input.partner_id)
    .select("id, partner_id, area_id, placement_code, slot_limit, is_active, created_at, updated_at")
    .maybeSingle();

  if (error) throw new Error(error.message ?? "INVENTORY_UPDATE_FAILED");
  if (!isRecord(data)) throw new Error("NOT_FOUND");
  return mapInventoryRow(data);
}

export async function hasActiveInventoryForAreaAndPlacement(
  partnerId: string,
  areaId: string,
  placementCode: PlacementCode,
): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("partner_area_inventory")
    .select("id")
    .eq("partner_id", partnerId)
    .eq("area_id", areaId)
    .eq("placement_code", placementCode)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw new Error(error.message ?? "INVENTORY_LOOKUP_FAILED");
  return Boolean(data);
}
