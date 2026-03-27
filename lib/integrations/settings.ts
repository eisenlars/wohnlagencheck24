import type { CrmSyncMode, CrmSyncResource } from "@/lib/providers/types";

export type RequestFreshnessBasis = "source_updated_at" | "last_seen_at";

export type NormalizedRequestFreshnessSettings = {
  enabled: boolean;
  basis: RequestFreshnessBasis;
  max_age_days_buy: number | null;
  max_age_days_rent: number | null;
  fallback_to_last_seen: boolean;
};

export type NormalizedCrmResourceLimits = {
  target_objects: number | null;
  max_pages: number | null;
  per_page: number | null;
  max_runtime_ms: number | null;
};

export type NormalizedCrmResourceSettings = {
  enabled: boolean;
  guarded: NormalizedCrmResourceLimits;
  sync: NormalizedCrmResourceLimits;
  freshness: NormalizedRequestFreshnessSettings | null;
};

type NormalizeSettingsResult =
  | { ok: true; value: Record<string, unknown> | null }
  | { ok: false; error: string };

type NormalizeFreshnessResult =
  | { ok: true; value: NormalizedRequestFreshnessSettings | null }
  | { ok: false; error: string };

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "ja"].includes(normalized)) return true;
    if (["false", "0", "no", "nein"].includes(normalized)) return false;
  }
  return null;
}

function asPositiveInteger(value: unknown): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim().length > 0
        ? Number(value)
        : NaN;
  if (!Number.isFinite(parsed)) return null;
  const normalized = Math.floor(parsed);
  return normalized > 0 ? normalized : null;
}

function normalizeRequestFreshnessValue(value: unknown): NormalizeFreshnessResult {
  const raw = asObject(value);
  if (!raw) return { ok: true, value: null };

  const rawBasis = String(raw.basis ?? "").trim().toLowerCase();
  const basis: RequestFreshnessBasis =
    rawBasis === "last_seen_at" ? "last_seen_at" : "source_updated_at";
  const maxAgeBuy = asPositiveInteger(raw.max_age_days_buy);
  const maxAgeRent = asPositiveInteger(raw.max_age_days_rent);
  const fallbackToLastSeen = asBoolean(raw.fallback_to_last_seen) ?? false;
  const explicitEnabled = asBoolean(raw.enabled);
  const enabled = explicitEnabled ?? (maxAgeBuy !== null || maxAgeRent !== null);

  if (enabled && maxAgeBuy === null && maxAgeRent === null) {
    return {
      ok: false,
      error:
        "Für request_freshness muss bei aktivierter Freshness mindestens max_age_days_buy oder max_age_days_rent gesetzt sein.",
    };
  }

  return {
    ok: true,
    value: {
      enabled,
      basis,
      max_age_days_buy: maxAgeBuy,
      max_age_days_rent: maxAgeRent,
      fallback_to_last_seen: fallbackToLastSeen,
    },
  };
}

function normalizeResourceLimits(value: unknown): NormalizedCrmResourceLimits {
  const raw = asObject(value);
  return {
    target_objects: asPositiveInteger(raw?.target_objects),
    max_pages: asPositiveInteger(raw?.max_pages),
    per_page: asPositiveInteger(raw?.per_page),
    max_runtime_ms: asPositiveInteger(raw?.max_runtime_ms),
  };
}

function toResourceEnabled(
  settings: Record<string, unknown> | null | undefined,
  resource: Exclude<CrmSyncResource, "all">,
): boolean {
  const resources = asObject(settings?.resources);
  const resourceSettings = asObject(resources?.[resource]);
  const direct = asBoolean(resourceSettings?.enabled);
  if (direct !== null) return direct;

  const capabilities = asObject(settings?.capabilities);
  const legacyKey = resource === "offers" ? "listings" : resource;
  return asBoolean(capabilities?.[legacyKey]) ?? true;
}

function readLegacyGuardedSettings(
  settings: Record<string, unknown> | null | undefined,
  resource: Exclude<CrmSyncResource, "all">,
): Record<string, unknown> | null {
  const guarded = asObject(settings?.guarded);
  if (!guarded) return null;
  if (resource === "offers") return asObject(guarded.units);
  if (resource === "references") return asObject(guarded.references);
  return asObject(guarded.saved_queries);
}

function readLegacyRequestFreshness(
  settings: Record<string, unknown> | null | undefined,
): NormalizedRequestFreshnessSettings | null {
  const normalized = normalizeRequestFreshnessValue(settings?.request_freshness);
  return normalized.ok ? normalized.value : null;
}

export function readRequestFreshnessSettings(
  settings: Record<string, unknown> | null | undefined,
): NormalizedRequestFreshnessSettings | null {
  const resources = asObject(settings?.resources);
  const requestSettings = asObject(resources?.requests);
  const normalized = normalizeRequestFreshnessValue(requestSettings?.freshness);
  if (normalized.ok && normalized.value) return normalized.value;
  return readLegacyRequestFreshness(settings);
}

export function readCrmResourceSettings(
  settings: Record<string, unknown> | null | undefined,
  resource: Exclude<CrmSyncResource, "all">,
): NormalizedCrmResourceSettings {
  const resources = asObject(settings?.resources);
  const resourceSettings = asObject(resources?.[resource]);
  const legacyGuarded = readLegacyGuardedSettings(settings, resource);
  const guarded = normalizeResourceLimits(resourceSettings?.guarded ?? legacyGuarded);
  const sync = normalizeResourceLimits(resourceSettings?.sync);
  const freshness =
    resource === "requests"
      ? readRequestFreshnessSettings(settings)
      : null;

  return {
    enabled: toResourceEnabled(settings, resource),
    guarded,
    sync,
    freshness,
  };
}

export function readCrmResourceLimits(
  settings: Record<string, unknown> | null | undefined,
  resource: Exclude<CrmSyncResource, "all">,
  mode: CrmSyncMode,
): NormalizedCrmResourceLimits {
  const resourceSettings = readCrmResourceSettings(settings, resource);
  return mode === "full" ? resourceSettings.sync : resourceSettings.guarded;
}

export function normalizeCrmSyncSelection(
  value: unknown,
): { resource: CrmSyncResource; mode: CrmSyncMode } {
  const raw = asObject(value);
  const resourceValue = String(raw?.resource ?? "").trim().toLowerCase();
  const modeValue = String(raw?.mode ?? "").trim().toLowerCase();
  const resource: CrmSyncResource =
    resourceValue === "offers"
      ? "offers"
      : resourceValue === "references"
        ? "references"
        : resourceValue === "requests"
          ? "requests"
          : "all";
  const mode: CrmSyncMode = modeValue === "full" ? "full" : "guarded";
  return { resource, mode };
}

export function normalizeCrmIntegrationSettings(
  settings: Record<string, unknown> | null | undefined,
): NormalizeSettingsResult {
  if (!settings || typeof settings !== "object") return { ok: true, value: null };

  const out: Record<string, unknown> = { ...settings };
  const resources = asObject(out.resources) ?? {};
  const normalizedResources: Record<string, unknown> = {};

  for (const resource of ["offers", "references", "requests"] as const) {
    const rawResource = asObject(resources[resource]) ?? {};
    const current = readCrmResourceSettings(out, resource);
    const normalizedResource: Record<string, unknown> = {
      ...rawResource,
      enabled: current.enabled,
    };

    if (current.guarded.target_objects !== null || current.guarded.max_pages !== null || current.guarded.per_page !== null || current.guarded.max_runtime_ms !== null) {
      normalizedResource.guarded = current.guarded;
    } else {
      delete normalizedResource.guarded;
    }

    if (current.sync.target_objects !== null || current.sync.max_pages !== null || current.sync.per_page !== null || current.sync.max_runtime_ms !== null) {
      normalizedResource.sync = current.sync;
    } else {
      delete normalizedResource.sync;
    }

    if (resource === "requests") {
      const normalizedFreshness = normalizeRequestFreshnessValue(rawResource.freshness ?? out.request_freshness);
      if (!normalizedFreshness.ok) return normalizedFreshness;
      if (normalizedFreshness.value) {
        normalizedResource.freshness = normalizedFreshness.value;
      } else {
        delete normalizedResource.freshness;
      }
    }

    normalizedResources[resource] = normalizedResource;
  }

  out.resources = normalizedResources;

  // Keep legacy settings for compatibility with older readers already in the repo.
  const requestFreshness = (normalizedResources.requests as Record<string, unknown> | undefined)?.freshness;
  if (requestFreshness && typeof requestFreshness === "object") {
    out.request_freshness = requestFreshness;
  } else {
    delete out.request_freshness;
  }

  return { ok: true, value: out };
}
