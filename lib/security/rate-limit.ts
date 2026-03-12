import { createHash } from "crypto";
import { createAdminClient } from "@/utils/supabase/admin";

type RateLimitConfig = {
  windowMs: number;
  max: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
};

const ADMIN_API_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60_000,
  max: 20,
};

const store = new Map<string, Bucket>();

function now() {
  return Date.now();
}

function cleanupExpired(ts: number) {
  for (const [key, bucket] of store.entries()) {
    if (bucket.resetAt <= ts) {
      store.delete(key);
    }
  }
}

export function extractClientIpFromHeaders(headers: Headers): string {
  const xForwardedFor = headers.get("x-forwarded-for");
  if (xForwardedFor) {
    const first = xForwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  const xRealIp = headers.get("x-real-ip")?.trim();
  if (xRealIp) return xRealIp;
  return "unknown";
}

export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const ts = now();
  cleanupExpired(ts);

  const existing = store.get(key);
  if (!existing || existing.resetAt <= ts) {
    const resetAt = ts + config.windowMs;
    store.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: Math.max(0, config.max - 1),
      retryAfterSec: Math.ceil(config.windowMs / 1000),
    };
  }

  if (existing.count >= config.max) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - ts) / 1000)),
    };
  }

  existing.count += 1;
  store.set(key, existing);
  return {
    allowed: true,
    remaining: Math.max(0, config.max - existing.count),
    retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - ts) / 1000)),
  };
}

function hashKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

// Optional persistent backend via Supabase table "security_rate_limits".
// Falls nicht konfiguriert oder bei Fehlern, wird auf in-memory fallback genutzt.
export async function checkRateLimitPersistent(
  key: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const backend = process.env.RATE_LIMIT_BACKEND ?? "";
  if (backend !== "supabase") {
    return checkRateLimit(key, config);
  }

  try {
    const admin = createAdminClient();
    const ts = now();
    const keyHash = hashKey(key);
    const nowIso = new Date(ts).toISOString();
    const resetAtTs = ts + config.windowMs;
    const resetAtIso = new Date(resetAtTs).toISOString();

    const { data: row, error: selectError } = await admin
      .from("security_rate_limits")
      .select("key_hash, count, reset_at")
      .eq("key_hash", keyHash)
      .maybeSingle();

    if (selectError) {
      return checkRateLimit(key, config);
    }

    const resetAtMs = row?.reset_at ? Date.parse(String(row.reset_at)) : Number.NaN;
    const expired = !row || Number.isNaN(resetAtMs) || resetAtMs <= ts;

    if (expired) {
      await admin.from("security_rate_limits").upsert(
        {
          key_hash: keyHash,
          count: 1,
          reset_at: resetAtIso,
          updated_at: nowIso,
        },
        { onConflict: "key_hash" },
      );
      return {
        allowed: true,
        remaining: Math.max(0, config.max - 1),
        retryAfterSec: Math.ceil(config.windowMs / 1000),
      };
    }

    const count = Number(row.count ?? 0);
    if (count >= config.max) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSec: Math.max(1, Math.ceil((resetAtMs - ts) / 1000)),
      };
    }

    const { data: updatedRows, error: updateError } = await admin
      .from("security_rate_limits")
      .update({ count: count + 1, updated_at: nowIso })
      .eq("key_hash", keyHash)
      .lt("count", config.max)
      .gt("reset_at", nowIso)
      .select("count, reset_at");

    if (updateError) {
      return checkRateLimit(key, config);
    }

    if (!updatedRows || updatedRows.length === 0) {
      const { data: latestRow } = await admin
        .from("security_rate_limits")
        .select("count, reset_at")
        .eq("key_hash", keyHash)
        .maybeSingle();
      const latestCount = Number(latestRow?.count ?? config.max);
      const latestResetMs = latestRow?.reset_at ? Date.parse(String(latestRow.reset_at)) : ts + config.windowMs;
      if (latestCount >= config.max || latestResetMs <= ts) {
        return {
          allowed: false,
          remaining: 0,
          retryAfterSec: Math.max(1, Math.ceil((latestResetMs - ts) / 1000)),
        };
      }
      return checkRateLimit(key, config);
    }

    const nextCount = Number(updatedRows[0]?.count ?? count + 1);

    return {
      allowed: true,
      remaining: Math.max(0, config.max - nextCount),
      retryAfterSec: Math.max(1, Math.ceil((resetAtMs - ts) / 1000)),
    };
  } catch {
    return checkRateLimit(key, config);
  }
}

export async function checkAdminApiRateLimit(
  req: Request,
  userId: string,
): Promise<RateLimitResult> {
  const ip = extractClientIpFromHeaders(req.headers);
  const key = `admin_api:${userId}:${ip}`;
  return checkRateLimitPersistent(key, ADMIN_API_RATE_LIMIT);
}
