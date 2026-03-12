import { NextResponse } from "next/server";
import { createHmac } from "node:crypto";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { checkRateLimitPersistent, extractClientIpFromHeaders } from "@/lib/security/rate-limit";
import { validateOutboundUrl } from "@/lib/security/outbound-url";
import { loadPartnerLlmPolicy } from "@/lib/llm/partner-policy";
import { readSecretFromAuthConfig } from "@/lib/security/secret-crypto";

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

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
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

function buildOnOfficeHmacV2(
  args: { timestamp: string; token: string; resourceType: string; actionId: string },
  secret: string,
): string {
  const payload = `${args.timestamp}${args.token}${args.resourceType}${args.actionId}`;
  return createHmac("sha256", secret).update(payload).digest("base64");
}

function buildOnOfficeReadRequest(
  token: string,
  secret: string,
  resourceType: string,
  fields: string[],
) {
  const actionId = "urn:onoffice-de-ns:smart:2.5:smartml:action:read";
  const timestamp = String(Math.floor(Date.now() / 1000));
  const hmac = buildOnOfficeHmacV2({ timestamp, token, resourceType, actionId }, secret);
  return {
    token,
    request: {
      actions: [
        {
          actionid: actionId,
          resourceid: "",
          resourcetype: resourceType,
          timestamp,
          hmac,
          hmac_version: 2,
          parameters: {
            data: fields,
            listlimit: 1,
            listoffset: 0,
            filter: {
              status: [{ op: "=", val: 1 }],
            },
          },
        },
      ],
    },
  };
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
    if (integration.kind === "llm") {
      const policy = await loadPartnerLlmPolicy(admin, userId);
      if (!policy.llm_partner_managed_allowed) {
        return NextResponse.json(
          { error: "LLM-Anbindungen sind für diesen Partner nicht freigeschaltet." },
          { status: 403 },
        );
      }
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
    if (integration.kind === "local_site") {
      const hasTokenHash = Boolean(asText(authConfig.token_hash));
      const { data: activeArea } = await admin
        .from("partner_area_map")
        .select("id")
        .eq("auth_user_id", integration.partner_id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (!hasTokenHash) {
        const result = {
          status: "error" as const,
          message: "Kein API-Key hinterlegt. Bitte zuerst im Schritt 'API-Key und Verbindungstest' speichern.",
        };
        await persistTestResult(admin, integration, result);
        return NextResponse.json({ ok: true, result });
      }

      if (!activeArea?.id) {
        const result = {
          status: "warning" as const,
          message: "Zugangsschluessel ist gespeichert, aber es ist noch kein aktives Gebiet zugeordnet.",
        };
        await persistTestResult(admin, integration, result);
        return NextResponse.json({ ok: true, result });
      }

      const result = {
        status: "ok" as const,
        message: "Konfiguration ist bereit: Zugangsschluessel gespeichert und aktives Gebiet vorhanden.",
      };
      await persistTestResult(admin, integration, result);
      return NextResponse.json({ ok: true, result });
    }

    const defaultLlmBaseUrlByProvider: Record<string, string> = {
      openai: "https://api.openai.com/v1",
      azure_openai: "https://api.openai.com/v1",
      mistral: "https://api.mistral.ai/v1",
      generic_llm: "https://api.openai.com/v1",
      anthropic: "https://api.anthropic.com/v1",
      google_gemini: "https://generativelanguage.googleapis.com/v1beta",
    };
    const llmSettings = (integration.settings ?? {}) as Record<string, unknown>;
    const resolvedBaseUrl =
      baseUrl ??
      asText(llmSettings.base_url) ??
      (integration.kind === "llm" ? defaultLlmBaseUrlByProvider[integration.provider] ?? null : null);

    if (!resolvedBaseUrl) {
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
    const baseUrlCheck = await validateOutboundUrl(resolvedBaseUrl);
    if (!baseUrlCheck.ok) {
      const result = {
        status: "error" as const,
        message: `Base URL blockiert (${baseUrlCheck.reason}).`,
      };
      await persistTestResult(admin, integration, result);
      return NextResponse.json({ ok: true, result });
    }

    const authType = asText(integration.auth_type)?.toLowerCase() ?? "";
    const token = readSecretFromAuthConfig(authConfig, "token");
    const apiKey = readSecretFromAuthConfig(authConfig, "api_key");
    const model = asText(integration.settings?.model) ?? asText(integration.settings?.model_name);

    let res: Response;
    try {
      if (integration.kind === "crm" && integration.provider === "propstack") {
        if (!apiKey) {
          const result = {
            status: "error" as const,
            message: "Propstack API-Key fehlt (Secret api_key).",
          };
          await persistTestResult(admin, integration, result);
          return NextResponse.json({ ok: true, result });
        }
        const url = `${resolvedBaseUrl.replace(/\/+$/, "")}/units?per=1&page=1`;
        const targetCheck = await validateOutboundUrl(url);
        if (!targetCheck.ok) {
          const result = {
            status: "error" as const,
            message: `Ziel-URL blockiert (${targetCheck.reason}).`,
          };
          await persistTestResult(admin, integration, result);
          return NextResponse.json({ ok: true, result });
        }
        res = await fetchWithTimeout(url, {
          method: "GET",
          headers: {
            accept: "application/json, text/plain, */*",
            "x-api-key": apiKey,
          },
        });
      } else if (integration.kind === "crm" && integration.provider === "onoffice") {
        const secret = readSecretFromAuthConfig(authConfig, "secret");
        if (!token || !secret) {
          const result = {
            status: "error" as const,
            message: "onOffice Zugangsdaten fehlen (Token + Secret erforderlich).",
          };
          await persistTestResult(admin, integration, result);
          return NextResponse.json({ ok: true, result });
        }
        const targetCheck = await validateOutboundUrl(resolvedBaseUrl);
        if (!targetCheck.ok) {
          const result = {
            status: "error" as const,
            message: `Ziel-URL blockiert (${targetCheck.reason}).`,
          };
          await persistTestResult(admin, integration, result);
          return NextResponse.json({ ok: true, result });
        }
        const body = buildOnOfficeReadRequest(token, secret, "estate", ["Id"]);
        res = await fetchWithTimeout(targetCheck.url, {
          method: "POST",
          headers: {
            accept: "application/json, text/plain, */*",
            "content-type": "application/json",
          },
          body: JSON.stringify(body),
        });
      } else if (integration.kind === "llm") {
        if (!apiKey) {
          const result = {
            status: "error" as const,
            message: "LLM API-Key fehlt (Secret api_key).",
          };
          await persistTestResult(admin, integration, result);
          return NextResponse.json({ ok: true, result });
        }
        if (!model) {
          const result = {
            status: "error" as const,
            message: "LLM Modell fehlt (settings.model).",
          };
          await persistTestResult(admin, integration, result);
          return NextResponse.json({ ok: true, result });
        }

        if (integration.provider === "google_gemini") {
          const normalizedBase = resolvedBaseUrl.replace(/\/+$/, "");
          const url = `${normalizedBase}/models`;
          const targetCheck = await validateOutboundUrl(url);
          if (!targetCheck.ok) {
            const result = {
              status: "error" as const,
              message: `Ziel-URL blockiert (${targetCheck.reason}).`,
            };
            await persistTestResult(admin, integration, result);
            return NextResponse.json({ ok: true, result });
          }
          res = await fetchWithTimeout(url, {
            method: "GET",
            headers: {
              accept: "application/json, text/plain, */*",
              "x-goog-api-key": apiKey,
            },
          });
        } else if (integration.provider === "anthropic") {
          const normalizedBase = resolvedBaseUrl.replace(/\/+$/, "");
          const url = `${normalizedBase}/messages`;
          const targetCheck = await validateOutboundUrl(url);
          if (!targetCheck.ok) {
            const result = {
              status: "error" as const,
              message: `Ziel-URL blockiert (${targetCheck.reason}).`,
            };
            await persistTestResult(admin, integration, result);
            return NextResponse.json({ ok: true, result });
          }
          res = await fetchWithTimeout(url, {
            method: "POST",
            headers: {
              accept: "application/json, text/plain, */*",
              "content-type": "application/json",
              "x-api-key": apiKey,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model,
              max_tokens: Math.max(1, Math.floor(asFiniteNumber(llmSettings.max_tokens) ?? 64)),
              messages: [{ role: "user", content: "ping" }],
            }),
          });
        } else if (integration.provider === "azure_openai") {
          const normalizedBase = resolvedBaseUrl.replace(/\/+$/, "");
          const apiVersion = asText(llmSettings.api_version) ?? "2024-10-21";
          const url = `${normalizedBase}/openai/deployments/${encodeURIComponent(model)}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`;
          const targetCheck = await validateOutboundUrl(url);
          if (!targetCheck.ok) {
            const result = {
              status: "error" as const,
              message: `Ziel-URL blockiert (${targetCheck.reason}).`,
            };
            await persistTestResult(admin, integration, result);
            return NextResponse.json({ ok: true, result });
          }
          res = await fetchWithTimeout(url, {
            method: "POST",
            headers: {
              accept: "application/json, text/plain, */*",
              "content-type": "application/json",
              "api-key": apiKey,
            },
            body: JSON.stringify({
              messages: [{ role: "user", content: "ping" }],
              max_tokens: Math.max(1, Math.floor(asFiniteNumber(llmSettings.max_tokens) ?? 16)),
              temperature: asFiniteNumber(llmSettings.temperature) ?? 0,
            }),
          });
        } else {
          const normalizedBase = resolvedBaseUrl.replace(/\/+$/, "");
          const url = `${normalizedBase}/models`;
          const targetCheck = await validateOutboundUrl(url);
          if (!targetCheck.ok) {
            const result = {
              status: "error" as const,
              message: `Ziel-URL blockiert (${targetCheck.reason}).`,
            };
            await persistTestResult(admin, integration, result);
            return NextResponse.json({ ok: true, result });
          }
          res = await fetchWithTimeout(url, {
            method: "GET",
            headers: {
              accept: "application/json, text/plain, */*",
              authorization: `Bearer ${apiKey}`,
            },
          });
        }
      } else {
        const headers: HeadersInit = { accept: "application/json, text/plain, */*" };
        if (authType.includes("bearer") && token) {
          headers.authorization = `Bearer ${token}`;
        } else if (apiKey) {
          headers["x-api-key"] = apiKey;
        }
        res = await fetchWithTimeout(resolvedBaseUrl, { method: "HEAD", headers });
        if (res.status === 405 || res.status === 501) {
          res = await fetchWithTimeout(resolvedBaseUrl, { method: "GET", headers });
        }
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
