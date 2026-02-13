type JsonObject = Record<string, unknown>;

const SENSITIVE_KEYS = new Set([
  "api_key",
  "token",
  "token_hash",
  "secret",
  "password",
  "authorization",
]);

function maskValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((v) => maskValue(v));
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const out: JsonObject = {};
  for (const [k, v] of Object.entries(value as JsonObject)) {
    if (SENSITIVE_KEYS.has(k.toLowerCase())) {
      out[k] = "[MASKED]";
      continue;
    }
    out[k] = maskValue(v);
  }
  return out;
}

export function maskIntegrationForResponse<T extends JsonObject>(integration: T): T {
  const clone: JsonObject = { ...integration };
  if ("auth_config" in clone) {
    clone.auth_config = maskValue((clone.auth_config as JsonObject | null) ?? null);
  }
  return clone as T;
}
