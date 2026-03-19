import { createAdminClient } from "@/utils/supabase/admin";
import { rebuildAllPublicAssetEntriesForPartner } from "@/lib/public-asset-projections";

type AdminClient = ReturnType<typeof createAdminClient>;
type PostgrestErrorLike = { message?: string } | null | undefined;
type SelectQuery = {
  eq: (column: string, value: unknown) => SelectQuery;
  in: (column: string, values: readonly unknown[]) => SelectQuery;
  then: PromiseLike<{ data: unknown[] | null; error: PostgrestErrorLike }>["then"];
};
type CountQuery = {
  eq: (column: string, value: unknown) => CountQuery;
  in: (column: string, values: readonly unknown[]) => CountQuery;
  then: PromiseLike<{ count: number | null; error: PostgrestErrorLike }>["then"];
};
type DeleteQuery = {
  eq: (column: string, value: unknown) => DeleteQuery;
  in: (column: string, values: readonly unknown[]) => DeleteQuery;
  then: PromiseLike<{ error: PostgrestErrorLike }>["then"];
};

export type CrmIntegrationPurgeResult = {
  deletedCounts: {
    partner_listings: number;
    partner_property_offers: number;
    partner_property_offer_i18n: number;
    partner_property_overrides: number;
    partner_references: number;
    partner_reference_i18n: number;
    partner_reference_overrides: number;
    partner_requests: number;
    partner_request_i18n: number;
    partner_request_overrides: number;
  };
  rebuiltProjections: {
    offers: number;
    requests: number;
    references: number;
  };
};

function isMissingRelationError(error: unknown, table: string): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return msg.includes("does not exist") && msg.includes(table.toLowerCase());
}

async function selectRowsSafe<T extends Record<string, unknown>>(
  admin: AdminClient,
  table: string,
  columns: string,
  apply: (query: SelectQuery) => PromiseLike<{ data: unknown[] | null; error: PostgrestErrorLike }>,
): Promise<T[]> {
  const query = apply(admin.from(table).select(columns) as unknown as SelectQuery);
  const { data, error } = await query;
  if (error) {
    if (isMissingRelationError(error, table)) return [];
    throw new Error(String(error.message ?? `select failed for ${table}`));
  }
  return (data ?? []) as T[];
}

async function countRowsSafe(
  admin: AdminClient,
  table: string,
  apply: (query: CountQuery) => PromiseLike<{ count: number | null; error: PostgrestErrorLike }>,
): Promise<number> {
  const query = apply(admin.from(table).select("*", { count: "exact", head: true }) as unknown as CountQuery);
  const { count, error } = await query;
  if (error) {
    if (isMissingRelationError(error, table)) return 0;
    throw new Error(String(error.message ?? `count failed for ${table}`));
  }
  return Number(count ?? 0);
}

async function deleteRowsSafe(
  admin: AdminClient,
  table: string,
  apply: (query: DeleteQuery) => PromiseLike<{ error: PostgrestErrorLike }>,
): Promise<void> {
  const query = apply(admin.from(table).delete() as unknown as DeleteQuery);
  const { error } = await query;
  if (error) {
    if (isMissingRelationError(error, table)) return;
    throw new Error(String(error.message ?? `delete failed for ${table}`));
  }
}

export async function purgeCrmIntegrationData(args: {
  admin: AdminClient;
  partnerId: string;
  provider: string;
}): Promise<CrmIntegrationPurgeResult> {
  const { admin, partnerId, provider } = args;

  const [offerRows, referenceRows, requestRows] = await Promise.all([
    selectRowsSafe<{ id?: string | null }>(
      admin,
      "partner_property_offers",
      "id",
      (query) => query.eq("partner_id", partnerId).eq("source", provider),
    ),
    selectRowsSafe<{ id?: string | null }>(
      admin,
      "partner_references",
      "id",
      (query) => query.eq("partner_id", partnerId).eq("provider", provider),
    ),
    selectRowsSafe<{ id?: string | null }>(
      admin,
      "partner_requests",
      "id",
      (query) => query.eq("partner_id", partnerId).eq("provider", provider),
    ),
  ]);

  const offerIds = offerRows.map((row) => String(row.id ?? "").trim()).filter(Boolean);
  const referenceIds = referenceRows.map((row) => String(row.id ?? "").trim()).filter(Boolean);
  const requestIds = requestRows.map((row) => String(row.id ?? "").trim()).filter(Boolean);

  const deletedCounts = {
    partner_listings: await countRowsSafe(
      admin,
      "partner_listings",
      (query) => query.eq("partner_id", partnerId).eq("provider", provider),
    ),
    partner_property_offers: offerIds.length,
    partner_property_offer_i18n: offerIds.length > 0
      ? await countRowsSafe(admin, "partner_property_offer_i18n", (query) => query.in("offer_id", offerIds))
      : 0,
    partner_property_overrides: await countRowsSafe(
      admin,
      "partner_property_overrides",
      (query) => query.eq("partner_id", partnerId).eq("source", provider),
    ),
    partner_references: referenceIds.length,
    partner_reference_i18n: referenceIds.length > 0
      ? await countRowsSafe(admin, "partner_reference_i18n", (query) => query.in("reference_id", referenceIds))
      : 0,
    partner_reference_overrides: await countRowsSafe(
      admin,
      "partner_reference_overrides",
      (query) => query.eq("partner_id", partnerId).eq("source", provider),
    ),
    partner_requests: requestIds.length,
    partner_request_i18n: requestIds.length > 0
      ? await countRowsSafe(admin, "partner_request_i18n", (query) => query.in("request_id", requestIds))
      : 0,
    partner_request_overrides: await countRowsSafe(
      admin,
      "partner_request_overrides",
      (query) => query.eq("partner_id", partnerId).eq("source", provider),
    ),
  };

  if (offerIds.length > 0) {
    await deleteRowsSafe(admin, "partner_property_offer_i18n", (query) => query.in("offer_id", offerIds));
  }
  await deleteRowsSafe(
    admin,
    "partner_property_overrides",
    (query) => query.eq("partner_id", partnerId).eq("source", provider),
  );
  await deleteRowsSafe(
    admin,
    "partner_property_offers",
    (query) => query.eq("partner_id", partnerId).eq("source", provider),
  );

  if (referenceIds.length > 0) {
    await deleteRowsSafe(admin, "partner_reference_i18n", (query) => query.in("reference_id", referenceIds));
  }
  await deleteRowsSafe(
    admin,
    "partner_reference_overrides",
    (query) => query.eq("partner_id", partnerId).eq("source", provider),
  );
  await deleteRowsSafe(
    admin,
    "partner_references",
    (query) => query.eq("partner_id", partnerId).eq("provider", provider),
  );

  if (requestIds.length > 0) {
    await deleteRowsSafe(admin, "partner_request_i18n", (query) => query.in("request_id", requestIds));
  }
  await deleteRowsSafe(
    admin,
    "partner_request_overrides",
    (query) => query.eq("partner_id", partnerId).eq("source", provider),
  );
  await deleteRowsSafe(
    admin,
    "partner_requests",
    (query) => query.eq("partner_id", partnerId).eq("provider", provider),
  );

  await deleteRowsSafe(
    admin,
    "partner_listings",
    (query) => query.eq("partner_id", partnerId).eq("provider", provider),
  );

  const rebuiltProjections = await rebuildAllPublicAssetEntriesForPartner(partnerId, admin);

  return {
    deletedCounts,
    rebuiltProjections,
  };
}
