export function isMissingPublicLiveColumn(error: unknown): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return msg.includes("partner_area_map.is_public_live") && msg.includes("does not exist");
}

function isMissingPartnerSystemDefaultColumn(error: unknown): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return msg.includes("partners.is_system_default") && msg.includes("does not exist");
}

function isMissingActivationStatusColumn(error: unknown): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return msg.includes("partner_area_map.activation_status") && msg.includes("does not exist");
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

export async function loadPublicVisiblePartnerContextForArea(
  client: unknown,
  areaId: string,
): Promise<{ partnerId: string | null; isSystemDefault: boolean }> {
  const partnerId = await loadSinglePublicVisiblePartnerIdForArea(client, areaId);
  return loadPartnerContextByPartnerId(client, partnerId);
}

async function loadPartnerContextByPartnerId(
  client: unknown,
  partnerId: string | null,
): Promise<{ partnerId: string | null; isSystemDefault: boolean }> {
  if (!partnerId) {
    return { partnerId: null, isSystemDefault: false };
  }

  const partnerClient = client as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: unknown) => {
          maybeSingle: () => Promise<{
            data?: Record<string, unknown> | null;
            error?: { message?: string } | null;
          }>;
        };
      };
    };
  };

  let { data, error } = await partnerClient
    .from("partners")
    .select("id, is_system_default")
    .eq("id", partnerId)
    .maybeSingle();

  if (error && isMissingPartnerSystemDefaultColumn(error)) {
    const fallback = await partnerClient
      .from("partners")
      .select("id")
      .eq("id", partnerId)
      .maybeSingle();
    data = fallback.data;
    error = fallback.error;
  }

  if (error) throw new Error(String(error.message ?? "partner system-default lookup failed"));

  return {
    partnerId,
    isSystemDefault: Boolean(data?.is_system_default),
  };
}

export async function loadPreviewPartnerContextForArea(
  client: unknown,
  areaId: string,
): Promise<{ partnerId: string | null; isSystemDefault: boolean; status: PreviewAccessStatus }> {
  const previewAccess = await loadPreviewAccessForArea(client, areaId);
  const partnerContext = await loadPartnerContextByPartnerId(client, previewAccess.partnerId);
  return {
    ...partnerContext,
    status: previewAccess.status,
  };
}

export async function loadPublicVisibleAreaOptionsForPartner(client: unknown, partnerId: string): Promise<AreaOption[]> {
  const normalizedPartnerId = String(partnerId ?? "").trim();
  if (!normalizedPartnerId) return [];

  const mappingClient = asMappingClient(client);
  let { data, error } = await mappingClient
    .from("partner_area_map")
    .select("area_id")
    .eq("auth_user_id", normalizedPartnerId)
    .eq("is_public_live", true);

  if (error && isMissingPublicLiveColumn(error)) {
    const fallback = await mappingClient
      .from("partner_area_map")
      .select("area_id")
      .eq("auth_user_id", normalizedPartnerId)
      .eq("is_active", true);
    data = fallback.data;
    error = fallback.error;
  }

  if (error) throw new Error(String(error.message ?? "partner_area_map partner area lookup failed"));

  const areaIds = Array.from(
    new Set(
      (data ?? [])
        .map((row) => String(row.area_id ?? "").trim())
        .filter((value) => value.length > 0),
    ),
  );

  return loadAreaOptions(client, areaIds);
}

type PreviewAccessStatus = "none" | "preview" | "live";

type PreviewAccessResult = {
  partnerId: string | null;
  status: PreviewAccessStatus;
};

export type AreaOption = {
  areaId: string;
  label: string;
  href?: string;
};

type AreaLookupClient = {
  from: (table: string) => {
    select: (columns: string) => {
      in: (column: string, values: string[]) => Promise<{
        data?: Array<Record<string, unknown>> | null;
        error?: { message?: string } | null;
      }>;
    };
  };
};

async function loadAreaOptions(client: unknown, areaIds: string[]): Promise<AreaOption[]> {
  if (areaIds.length === 0) return [];

  const areaClient = client as AreaLookupClient;
  const { data, error } = await areaClient
    .from("areas")
    .select("id, name, slug, parent_slug, bundesland_slug")
    .in("id", areaIds);

  if (error) throw new Error(String(error.message ?? "areas lookup failed"));

  const optionMap = new Map<string, AreaOption>();
  for (const row of data ?? []) {
    const id = String(row.id ?? "").trim();
    const label = String(row.name ?? "").trim();
    if (!id) continue;
    optionMap.set(id, {
      areaId: id,
      label: label || id,
      href: buildAreaHref(row),
    });
  }

  return areaIds.map((areaId) => ({
    areaId,
    label: optionMap.get(areaId)?.label ?? areaId,
    href: optionMap.get(areaId)?.href,
  }));
}

function buildAreaHref(row: Record<string, unknown>): string | undefined {
  const slug = String(row.slug ?? "").trim();
  const bundeslandSlug = String(row.bundesland_slug ?? "").trim();
  const parentSlug = String(row.parent_slug ?? "").trim();
  if (!slug || !bundeslandSlug) return undefined;

  if (slug === bundeslandSlug) {
    return `/immobilienmarkt/${bundeslandSlug}`;
  }

  if (parentSlug && parentSlug !== bundeslandSlug) {
    return `/immobilienmarkt/${bundeslandSlug}/${parentSlug}/${slug}`;
  }

  return `/immobilienmarkt/${bundeslandSlug}/${slug}`;
}

function normalizePreviewStatus(row: Record<string, unknown>): PreviewAccessStatus {
  const isPublicLive = Boolean(row.is_public_live);
  if (isPublicLive) return "live";

  const raw = String(row.activation_status ?? "").trim().toLowerCase();
  if (
    raw === "approved_preview"
    || raw === "live"
    || raw === "active"
    || Boolean(row.is_active)
  ) {
    return "preview";
  }

  return "none";
}

export async function loadPreviewAccessForArea(client: unknown, areaId: string): Promise<PreviewAccessResult> {
  const normalizedAreaId = String(areaId ?? "").trim();
  if (!normalizedAreaId) return { partnerId: null, status: "none" };

  const mappingClient = asMappingClient(client);
  let { data, error } = await mappingClient
    .from("partner_area_map")
    .select("auth_user_id, is_active, is_public_live, activation_status")
    .eq("area_id", normalizedAreaId);

  if (error && (isMissingPublicLiveColumn(error) || isMissingActivationStatusColumn(error))) {
    const fallback = await mappingClient
      .from("partner_area_map")
      .select("auth_user_id, is_active")
      .eq("area_id", normalizedAreaId);
    data = (fallback.data ?? []).map((row) => ({
      ...row,
      is_public_live: null,
      activation_status: null,
    }));
    error = fallback.error;
  }

  if (error) throw new Error(String(error.message ?? "partner_area_map preview lookup failed"));

  const normalizedRows = (data ?? [])
    .map((row) => ({
      auth_user_id: String(row.auth_user_id ?? "").trim(),
      status: normalizePreviewStatus(row),
    }))
    .filter((row) => row.auth_user_id.length > 0 && row.status !== "none");

  if (normalizedRows.length === 0) {
    return { partnerId: null, status: "none" };
  }

  const partnerIds = Array.from(new Set(normalizedRows.map((row) => row.auth_user_id)));
  if (partnerIds.length !== 1) {
    return { partnerId: null, status: "none" };
  }

  const status = normalizedRows.some((row) => row.status === "live") ? "live" : "preview";
  return { partnerId: partnerIds[0], status };
}

export async function loadPreviewAreaOptionsForPartner(client: unknown, partnerId: string): Promise<AreaOption[]> {
  const normalizedPartnerId = String(partnerId ?? "").trim();
  if (!normalizedPartnerId) return [];

  const mappingClient = asMappingClient(client);
  let { data, error } = await mappingClient
    .from("partner_area_map")
    .select("area_id, is_active, is_public_live, activation_status")
    .eq("auth_user_id", normalizedPartnerId);

  if (error && (isMissingPublicLiveColumn(error) || isMissingActivationStatusColumn(error))) {
    const fallback = await mappingClient
      .from("partner_area_map")
      .select("area_id, is_active")
      .eq("auth_user_id", normalizedPartnerId);
    data = (fallback.data ?? []).map((row) => ({
      ...row,
      is_public_live: null,
      activation_status: null,
    }));
    error = fallback.error;
  }

  if (error) throw new Error(String(error.message ?? "partner_area_map preview area lookup failed"));

  const areaIds = Array.from(
    new Set(
      (data ?? [])
        .filter((row) => normalizePreviewStatus(row) !== "none")
        .map((row) => String(row.area_id ?? "").trim())
        .filter((value) => value.length > 0),
    ),
  );

  return loadAreaOptions(client, areaIds);
}
