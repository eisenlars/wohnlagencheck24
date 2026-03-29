import { createAdminClient } from "@/utils/supabase/admin";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asNonEmpty(value: unknown): string | null {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

export async function assertNetworkPartnerOwnsBooking(
  networkPartnerId: string,
  bookingId: string,
): Promise<void> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("network_partner_bookings")
    .select("id, network_partner_id")
    .eq("id", bookingId)
    .maybeSingle();

  if (error) throw new Error(error.message ?? "BOOKING_LOOKUP_FAILED");
  if (!isRecord(data)) throw new Error("NOT_FOUND");

  const ownerId = asNonEmpty(data.network_partner_id);
  if (!ownerId || ownerId !== networkPartnerId) {
    throw new Error("FORBIDDEN");
  }
}

export async function assertNetworkPartnerOwnsContent(
  networkPartnerId: string,
  contentItemId: string,
): Promise<void> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("network_content_items")
    .select("id, network_partner_id")
    .eq("id", contentItemId)
    .maybeSingle();

  if (error) throw new Error(error.message ?? "NETWORK_CONTENT_LOOKUP_FAILED");
  if (!isRecord(data)) throw new Error("NOT_FOUND");

  const ownerId = asNonEmpty(data.network_partner_id);
  if (!ownerId || ownerId !== networkPartnerId) {
    throw new Error("FORBIDDEN");
  }
}
