export type RequestFreshnessBasis = "source_updated_at" | "last_seen_at";

export type NormalizedRequestFreshnessSettings = {
  enabled: boolean;
  basis: RequestFreshnessBasis;
  max_age_days_buy: number | null;
  max_age_days_rent: number | null;
  fallback_to_last_seen: boolean;
};

type NormalizeSettingsResult =
  | { ok: true; value: Record<string, unknown> | null }
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

function normalizeRequestFreshnessValue(
  value: unknown,
): { ok: true; value: NormalizedRequestFreshnessSettings | null } | { ok: false; error: string } {
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
      error: "Für settings.request_freshness muss bei aktivierter Freshness mindestens max_age_days_buy oder max_age_days_rent gesetzt sein.",
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

export function readRequestFreshnessSettings(
  settings: Record<string, unknown> | null | undefined,
): NormalizedRequestFreshnessSettings | null {
  const normalized = normalizeRequestFreshnessValue(settings?.request_freshness);
  return normalized.ok ? normalized.value : null;
}

export function normalizeCrmIntegrationSettings(
  settings: Record<string, unknown> | null | undefined,
): NormalizeSettingsResult {
  if (!settings || typeof settings !== "object") return { ok: true, value: null };

  const out: Record<string, unknown> = { ...settings };
  const normalizedFreshness = normalizeRequestFreshnessValue(out.request_freshness);
  if (!normalizedFreshness.ok) return normalizedFreshness;

  if (normalizedFreshness.value) {
    out.request_freshness = normalizedFreshness.value;
  } else {
    delete out.request_freshness;
  }

  return { ok: true, value: out };
}
