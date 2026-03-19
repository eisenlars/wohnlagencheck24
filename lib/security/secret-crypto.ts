import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ENCRYPTION_KEY_ENV = "LOCAL_SITE_TOKEN_ENCRYPTION_KEY";
const INTEGRATION_SECRETS_KEY_ENV = "INTEGRATION_SECRETS_ENCRYPTION_KEY";
const ALGO = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;

function getKey(envName: string): Buffer | null {
  const raw = String(process.env[envName] ?? "").trim();
  if (!raw) return null;
  return createHash("sha256").update(raw).digest();
}

function encryptWithEnv(plain: string, envName: string): string | null {
  const token = String(plain ?? "").trim();
  if (!token) return null;
  const key = getKey(envName);
  if (!key) return null;

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

function decryptWithEnv(payload: unknown, envName: string): string | null {
  const serialized = String(payload ?? "").trim();
  if (!serialized) return null;

  const parts = serialized.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return null;

  const key = getKey(envName);
  if (!key) return null;

  try {
    const iv = Buffer.from(parts[1], "base64url");
    const tag = Buffer.from(parts[2], "base64url");
    const encrypted = Buffer.from(parts[3], "base64url");
    if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES || encrypted.length === 0) return null;

    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8").trim();
    return plain.length > 0 ? plain : null;
  } catch {
    return null;
  }
}

function resolveIntegrationSecretsEnvName(): string {
  const explicit = String(process.env[INTEGRATION_SECRETS_KEY_ENV] ?? "").trim();
  if (explicit) return INTEGRATION_SECRETS_KEY_ENV;
  return ENCRYPTION_KEY_ENV;
}

export function encryptLocalSiteToken(plain: string): string | null {
  return encryptWithEnv(plain, ENCRYPTION_KEY_ENV);
}

export function decryptLocalSiteToken(payload: unknown): string | null {
  const primary = decryptWithEnv(payload, ENCRYPTION_KEY_ENV);
  if (primary) return primary;
  const fallbackEnv = resolveIntegrationSecretsEnvName();
  if (fallbackEnv === ENCRYPTION_KEY_ENV) return null;
  return decryptWithEnv(payload, fallbackEnv);
}

export function encryptIntegrationSecret(plain: string): string | null {
  return encryptWithEnv(plain, resolveIntegrationSecretsEnvName());
}

export function decryptIntegrationSecret(payload: unknown): string | null {
  return decryptWithEnv(payload, resolveIntegrationSecretsEnvName());
}

export function readSecretFromAuthConfig(authConfig: Record<string, unknown> | null | undefined, key: "api_key" | "token" | "secret"): string | null {
  const auth = authConfig ?? {};
  const encrypted = decryptIntegrationSecret(auth[`${key}_encrypted`]);
  if (encrypted) return encrypted;
  const plain = String(auth[key] ?? "").trim();
  return plain.length > 0 ? plain : null;
}
