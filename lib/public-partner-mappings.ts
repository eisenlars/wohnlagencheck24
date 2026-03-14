export function isMissingPublicLiveColumn(error: unknown): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return msg.includes("partner_area_map.is_public_live") && msg.includes("does not exist");
}

type MappingClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: unknown) => QueryBuilder;
      in: (column: string, values: unknown[]) => QueryBuilder;
    };
  };
};

type QueryBuilder = Promise<{
  data?: Array<Record<string, unknown>> | null;
  error?: { message?: string } | null;
}> & {
  eq: (column: string, value: unknown) => QueryBuilder;
  in: (column: string, values: unknown[]) => QueryBuilder;
};

function asMappingClient(client: unknown): MappingClient {
  return client as MappingClient;
}

export async function loadPublicVisibleAreaIds(client: unknown): Promise<string[]> {
  const mappingClient = asMappingClient(client);
  let { data, error } = await mappingClient
    .from("partner_area_map")
    .select("area_id")
    .eq("is_public_live", true);

  if (error && isMissingPublicLiveColumn(error)) {
    const fallback = await mappingClient
      .from("partner_area_map")
      .select("area_id")
      .eq("is_active", true);
    data = fallback.data;
    error = fallback.error;
  }

  if (error) throw new Error(String(error.message ?? "partner_area_map visibility lookup failed"));

  return Array.from(
    new Set(
      (data ?? [])
        .map((row) => String(row.area_id ?? "").trim())
        .filter((value) => value.length > 0),
    ),
  );
}

export async function loadPublicVisiblePartnerIdsForAreaIds(client: unknown, areaIds: string[]): Promise<string[]> {
  const normalizedIds = Array.from(new Set(areaIds.map((id) => String(id ?? "").trim()).filter(Boolean)));
  if (normalizedIds.length === 0) return [];

  const mappingClient = asMappingClient(client);
  let { data, error } = await mappingClient
    .from("partner_area_map")
    .select("auth_user_id")
    .in("area_id", normalizedIds)
    .eq("is_public_live", true);

  if (error && isMissingPublicLiveColumn(error)) {
    const fallback = await mappingClient
      .from("partner_area_map")
      .select("auth_user_id")
      .in("area_id", normalizedIds)
      .eq("is_active", true);
    data = fallback.data;
    error = fallback.error;
  }

  if (error) throw new Error(String(error.message ?? "partner_area_map partner visibility lookup failed"));

  return Array.from(
    new Set(
      (data ?? [])
        .map((row) => String(row.auth_user_id ?? "").trim())
        .filter((value) => value.length > 0),
    ),
  );
}

export async function loadSinglePublicVisiblePartnerIdForArea(client: unknown, areaId: string): Promise<string | null> {
  const partnerIds = await loadPublicVisiblePartnerIdsForAreaIds(client, [areaId]);
  return partnerIds.length === 1 ? partnerIds[0] : null;
}
