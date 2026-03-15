import { createAdminClient } from "@/utils/supabase/admin";

const STORAGE_BUCKET = "immobilienmarkt";
const PURGE_DUMP_BUCKET = String(process.env.ADMIN_PURGE_DUMP_BUCKET ?? "").trim();

const PARTNER_PURGE_TABLES: Array<{ table: string; column: string }> = [
  { table: "partner_blog_posts", column: "partner_id" },
  { table: "partner_billing_settings", column: "partner_id" },
  { table: "partner_feature_overrides", column: "partner_id" },
  { table: "partner_texts_i18n", column: "partner_id" },
  { table: "partner_local_site_texts", column: "partner_id" },
  { table: "partner_marketing_texts", column: "partner_id" },
  { table: "partner_listings", column: "partner_id" },
  { table: "partner_property_overrides", column: "partner_id" },
  { table: "partner_property_offers", column: "partner_id" },
  { table: "partner_reference_overrides", column: "partner_id" },
  { table: "partner_references", column: "partner_id" },
  { table: "partner_request_overrides", column: "partner_id" },
  { table: "partner_requests", column: "partner_id" },
  { table: "report_texts", column: "partner_id" },
  { table: "llm_partner_budget_overrides", column: "partner_id" },
  { table: "llm_usage_events", column: "partner_id" },
  { table: "data_value_settings", column: "auth_user_id" },
  { table: "partner_area_map", column: "auth_user_id" },
  { table: "partner_integrations", column: "partner_id" },
];

function isMissingRelationError(error: unknown, table: string): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return msg.includes("does not exist") && msg.includes(table.toLowerCase());
}

function isMissingColumnError(error: unknown, table: string, column: string): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return msg.includes("does not exist") && msg.includes(`${table.toLowerCase()}.${column.toLowerCase()}`);
}

function isUserNotFoundError(error: unknown): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return msg.includes("user not found");
}

async function countRows(
  admin: ReturnType<typeof createAdminClient>,
  args: { table: string; column: string; value: string; activeOnly?: boolean; pendingOnly?: boolean },
): Promise<{ count: number; skipped: boolean; reason?: string }> {
  let query = admin
    .from(args.table)
    .select("*", { count: "exact", head: true })
    .eq(args.column, args.value);
  if (args.activeOnly) query = query.eq("is_active", true);
  if (args.pendingOnly) query = query.in("activation_status", ["ready_for_review", "in_review", "changes_requested"]);

  const { count, error } = await query;
  if (!error) return { count: Number(count ?? 0), skipped: false };
  if (isMissingRelationError(error, args.table)) {
    return { count: 0, skipped: true, reason: `${args.table} missing` };
  }
  if (args.pendingOnly && isMissingColumnError(error, args.table, "activation_status")) {
    return { count: 0, skipped: true, reason: `${args.table}.activation_status missing` };
  }
  if (args.activeOnly && isMissingColumnError(error, args.table, "is_active")) {
    return { count: 0, skipped: true, reason: `${args.table}.is_active missing` };
  }
  throw new Error(String((error as { message?: string } | null)?.message ?? `Count failed for ${args.table}`));
}

async function listStorageFilesRecursive(
  admin: ReturnType<typeof createAdminClient>,
  bucket: string,
  startPrefix: string,
): Promise<string[]> {
  const files: string[] = [];
  const queue: string[] = [startPrefix.replace(/^\/+|\/+$/g, "")];

  while (queue.length > 0) {
    const current = String(queue.shift() ?? "");
    let offset = 0;
    const limit = 100;
    while (true) {
      const { data, error } = await admin.storage.from(bucket).list(current, { limit, offset });
      if (error) {
        throw new Error(`storage_list_failed:${error.message}`);
      }
      const entries = Array.isArray(data) ? data : [];
      for (const entry of entries) {
        const name = String((entry as { name?: string }).name ?? "").trim();
        if (!name) continue;
        const childPath = current ? `${current}/${name}` : name;
        const id = (entry as { id?: string | null }).id;
        if (!id) {
          queue.push(childPath);
          continue;
        }
        files.push(childPath);
      }
      if (entries.length < limit) break;
      offset += limit;
    }
  }

  return files;
}

async function deleteStorageFiles(
  admin: ReturnType<typeof createAdminClient>,
  bucket: string,
  paths: string[],
): Promise<void> {
  if (!paths.length) return;
  const chunkSize = 100;
  for (let i = 0; i < paths.length; i += chunkSize) {
    const chunk = paths.slice(i, i + chunkSize);
    const { error } = await admin.storage.from(bucket).remove(chunk);
    if (error) {
      throw new Error(`storage_delete_failed:${error.message}`);
    }
  }
}

export type PartnerPurgeCheckResult = {
  partner: { id: string; company_name: string | null; is_system_default: boolean };
  canPurge: boolean;
  blockers: string[];
  summary: {
    areaMappingsTotal: number;
    areaMappingsActive: number;
    areaMappingsPending: number;
    integrationsTotal: number;
    integrationsActive: number;
    storageFiles: number;
  };
  affectedCounts: Record<string, number>;
};

export async function getPartnerPurgeCheck(admin: ReturnType<typeof createAdminClient>, partnerId: string): Promise<PartnerPurgeCheckResult> {
  const { data: partner, error: partnerError } = await admin
    .from("partners")
    .select("id, company_name, is_system_default")
    .eq("id", partnerId)
    .maybeSingle();
  if (partnerError) throw new Error(partnerError.message);
  if (!partner) throw new Error("PARTNER_NOT_FOUND");

  const [mapTotal, mapActive, mapPending, integrationsTotal, integrationsActive] = await Promise.all([
    countRows(admin, { table: "partner_area_map", column: "auth_user_id", value: partnerId }),
    countRows(admin, { table: "partner_area_map", column: "auth_user_id", value: partnerId, activeOnly: true }),
    countRows(admin, { table: "partner_area_map", column: "auth_user_id", value: partnerId, pendingOnly: true }),
    countRows(admin, { table: "partner_integrations", column: "partner_id", value: partnerId }),
    countRows(admin, { table: "partner_integrations", column: "partner_id", value: partnerId, activeOnly: true }),
  ]);

  const storagePrefix = `media/partner/${partnerId}`;
  let storageFiles: string[] = [];
  try {
    storageFiles = await listStorageFilesRecursive(admin, STORAGE_BUCKET, storagePrefix);
  } catch {
    storageFiles = [];
  }

  const affectedCounts: Record<string, number> = {};
  for (const def of PARTNER_PURGE_TABLES) {
    const res = await countRows(admin, { table: def.table, column: def.column, value: partnerId });
    affectedCounts[def.table] = res.count;
  }
  affectedCounts.partners = 1;
  affectedCounts.storage_files = storageFiles.length;

  const blockers: string[] = [];
  const isSystemDefault = Boolean((partner as { is_system_default?: boolean | null }).is_system_default);
  if (isSystemDefault) {
    blockers.push("Der Portalpartner ist ein Systempartner und kann nicht endgültig gelöscht werden.");
  }
  if (mapTotal.count > 0) {
    blockers.push(`Es bestehen noch ${mapTotal.count} Gebietszuordnung(en) zum Partner.`);
  }

  return {
    partner: {
      id: String((partner as { id?: string }).id ?? partnerId),
      company_name: String((partner as { company_name?: string | null }).company_name ?? "").trim() || null,
      is_system_default: isSystemDefault,
    },
    canPurge: blockers.length === 0,
    blockers,
    summary: {
      areaMappingsTotal: mapTotal.count,
      areaMappingsActive: mapActive.count,
      areaMappingsPending: mapPending.count,
      integrationsTotal: integrationsTotal.count,
      integrationsActive: integrationsActive.count,
      storageFiles: storageFiles.length,
    },
    affectedCounts,
  };
}

export async function purgePartnerData(
  admin: ReturnType<typeof createAdminClient>,
  partnerId: string,
): Promise<{ deletedCounts: Record<string, number>; dumpPath: string; dumpBucket: string }> {
  if (!PURGE_DUMP_BUCKET) {
    throw new Error("ADMIN_PURGE_DUMP_BUCKET is not configured");
  }
  if (PURGE_DUMP_BUCKET.toLowerCase() === STORAGE_BUCKET.toLowerCase()) {
    throw new Error("ADMIN_PURGE_DUMP_BUCKET must be different from storage bucket");
  }

  const storagePrefix = `media/partner/${partnerId}`;
  const storageFiles = await listStorageFilesRecursive(admin, STORAGE_BUCKET, storagePrefix);

  const dumpTables: Record<string, unknown[]> = {};
  for (const def of PARTNER_PURGE_TABLES) {
    const { data, error } = await admin
      .from(def.table)
      .select("*")
      .eq(def.column, partnerId);
    if (error && !isMissingRelationError(error, def.table)) {
      throw new Error(`${def.table} dump failed: ${error.message}`);
    }
    dumpTables[def.table] = Array.isArray(data) ? data : [];
  }

  const dumpPath = `admin/purge_dumps/${partnerId}/${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  const dumpPayload = {
    generated_at: new Date().toISOString(),
    partner_id: partnerId,
    storage_files: storageFiles,
    tables: dumpTables,
  };
  const encoder = new TextEncoder();
  const dumpBytes = encoder.encode(JSON.stringify(dumpPayload, null, 2));
  const { error: dumpError } = await admin.storage.from(PURGE_DUMP_BUCKET).upload(dumpPath, dumpBytes, {
    contentType: "application/json",
    upsert: false,
  });
  if (dumpError) {
    throw new Error(`dump upload failed: ${dumpError.message}`);
  }

  await deleteStorageFiles(admin, STORAGE_BUCKET, storageFiles);

  const deletedCounts: Record<string, number> = {
    storage_files: storageFiles.length,
  };

  for (const def of PARTNER_PURGE_TABLES) {
    const countRes = await countRows(admin, { table: def.table, column: def.column, value: partnerId });
    deletedCounts[def.table] = countRes.count;
    const { error } = await admin
      .from(def.table)
      .delete()
      .eq(def.column, partnerId);
    if (error && !isMissingRelationError(error, def.table)) {
      throw new Error(`${def.table} delete failed: ${error.message}`);
    }
  }

  const { error: partnerDeleteError } = await admin.from("partners").delete().eq("id", partnerId);
  if (partnerDeleteError && !isMissingRelationError(partnerDeleteError, "partners")) {
    throw new Error(`partners delete failed: ${partnerDeleteError.message}`);
  }
  deletedCounts.partners = 1;

  const { error: authDeleteError } = await admin.auth.admin.deleteUser(partnerId);
  if (authDeleteError && !isUserNotFoundError(authDeleteError)) {
    throw new Error(`auth delete failed: ${authDeleteError.message}`);
  }
  deletedCounts.auth_user = authDeleteError ? 0 : 1;

  return { deletedCounts, dumpPath, dumpBucket: PURGE_DUMP_BUCKET };
}
