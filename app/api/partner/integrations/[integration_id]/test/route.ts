import { NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { checkRateLimitPersistent, extractClientIpFromHeaders } from "@/lib/security/rate-limit";

type IntegrationRow = {
  id: string;
  partner_id: string;
  kind: string;
  provider: string;
  base_url?: string | null;
  auth_type?: string | null;
  auth_config?: Record<string, unknown> | null;
  is_active?: boolean;
  settings?: Record<string, unknown> | null;
};

function asText(value: unknown): string | null {
  const v = String(value ?? "").trim();
  return v.length > 0 ? v : null;
}

async function requirePartnerUser(req: Request): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) throw new Error("UNAUTHORIZED");

  const ip = extractClientIpFromHeaders(req.headers);
  const limit = await checkRateLimitPersistent(
    `partner_integration_test:${user.id}:${ip}`,
    { windowMs: 60 * 1000, max: 20 },
  );
  if (!limit.allowed) throw new Error(`RATE_LIMIT:${limit.retryAfterSec}`);
  return user.id;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timer);
  }
}

async function persistTestResult(
  admin: ReturnType<typeof createAdminClient>,
  integration: IntegrationRow,
  result: { status: "ok" | "warning" | "error"; message: string; http_status?: number },
) {
  const prev = (integration.settings ?? {}) as Record<string, unknown>;
  const nextSettings: Record<string, unknown> = {
    ...prev,
    last_tested_at: new Date().toISOString(),
    last_test_status: result.status,
    last_test_message: result.message.slice(0, 300),
    last_test_http_status: result.http_status ?? null,
  };
  await admin
    .from("partner_integrations")
    .update({ settings: nextSettings })
    .eq("id", integration.id)
    .eq("partner_id", integration.partner_id);
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ integration_id: string }> },
) {
  try {
    const userId = await requirePartnerUser(req);
    const params = await ctx.params;
    const integrationId = String(params.integration_id ?? "").trim();
    if (!integrationId) {
      return NextResponse.json({ error: "Missing integration id" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("partner_integrations")
      .select("id, partner_id, kind, provider, base_url, auth_type, auth_config, is_active, settings")
      .eq("id", integrationId)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Integration not found" }, { status: 404 });

    const integration = data as IntegrationRow;
    if (String(integration.partner_id) !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!integration.is_active) {
      const result = {
        status: "warning" as const,
        message: "Integration ist deaktiviert.",
      };
      await persistTestResult(admin, integration, result);
      return NextResponse.json({
        ok: true,
        result,
      });
    }

    const baseUrl = asText(integration.base_url);
    const authConfig = (integration.auth_config ?? {}) as Record<string, unknown>;
    if (integration.kind === "local_site" && !baseUrl) {
      const hasTokenHash = Boolean(asText(authConfig.token_hash));
      const result = {
        status: (hasTokenHash ? "warning" : "error") as "warning" | "error",
        message: hasTokenHash
          ? "Token-Hash vorhanden, aber keine base_url konfiguriert."
          : "Weder base_url noch token_hash konfiguriert.",
      };
      await persistTestResult(admin, integration, result);
      return NextResponse.json({
        ok: true,
        result,
      });
    }

    if (!baseUrl) {
      const result = {
        status: "error" as const,
        message: "Keine base_url konfiguriert.",
      };
      await persistTestResult(admin, integration, result);
      return NextResponse.json({
        ok: true,
        result,
      });
    }

    const headers: HeadersInit = { accept: "application/json, text/plain, */*" };
    const authType = asText(integration.auth_type)?.toLowerCase() ?? "";
    const token = asText(authConfig.token);
    const apiKey = asText(authConfig.api_key);
    if (authType.includes("bearer") && token) {
      headers["authorization"] = `Bearer ${token}`;
    } else if (apiKey) {
      headers["x-api-key"] = apiKey;
    }

    let res: Response;
    try {
      res = await fetchWithTimeout(baseUrl, { method: "HEAD", headers });
      if (res.status === 405 || res.status === 501) {
        res = await fetchWithTimeout(baseUrl, { method: "GET", headers });
      }
    } catch (error) {
      const result = {
        status: "error" as const,
        message: `Verbindung fehlgeschlagen: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`,
      };
      await persistTestResult(admin, integration, result);
      return NextResponse.json({
        ok: true,
        result,
      });
    }

    if (res.ok) {
      const result = {
        status: "ok" as const,
        message: `Verbindung erfolgreich (${res.status}).`,
        http_status: res.status,
      };
      await persistTestResult(admin, integration, result);
      return NextResponse.json({
        ok: true,
        result,
      });
    }

    const result = {
      status: "warning" as const,
      message: `Server erreichbar, aber Antwort ist ${res.status}.`,
      http_status: res.status,
    };
    await persistTestResult(admin, integration, result);
    return NextResponse.json({
      ok: true,
      result,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message.startsWith("RATE_LIMIT:")) {
        const sec = Number(error.message.split(":")[1] ?? "60");
        return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(sec) } });
      }
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
