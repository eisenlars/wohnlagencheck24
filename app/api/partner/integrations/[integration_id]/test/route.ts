import { NextResponse } from "next/server";
import { createHmac } from "node:crypto";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { checkRateLimitPersistent, extractClientIpFromHeaders } from "@/lib/security/rate-limit";
import { validateOutboundUrl } from "@/lib/security/outbound-url";
import { loadPartnerLlmPolicy } from "@/lib/llm/partner-policy";
import { readSecretFromAuthConfig } from "@/lib/security/secret-crypto";
import { buildOpenImmoRequestHeaders } from "@/lib/providers/openimmo";
import { parseOpenImmoDocument } from "@/lib/openimmo/parse";

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

type IntegrationStepLogEntry = {
  at: string;
  step: string;
  status: "running" | "ok" | "warning" | "error";
  message: string;
};

type TestResultPayload = {
  status: "ok" | "warning" | "error";
  message: string;
  http_status?: number;
};

const TEST_LOG_LIMIT = 12;
const TEST_TIMEOUT_MS = 8000;

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

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return {};
  return value as Record<string, unknown>;
}

function appendIntegrationLog(
  value: unknown,
  entry: IntegrationStepLogEntry,
  limit = TEST_LOG_LIMIT,
): IntegrationStepLogEntry[] {
  const current = Array.isArray(value)
    ? value.filter((item): item is IntegrationStepLogEntry => Boolean(item) && typeof item === "object")
    : [];
  return [...current, entry].slice(-limit);
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

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = TEST_TIMEOUT_MS) {
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

async function patchIntegrationSettings(
  admin: ReturnType<typeof createAdminClient>,
  integration: IntegrationRow,
  patch: Record<string, unknown>,
) {
  const prev = asObject(integration.settings);
  const nextSettings: Record<string, unknown> = {
    ...prev,
    ...patch,
  };
  const { error } = await admin
    .from("partner_integrations")
    .update({ settings: nextSettings })
    .eq("id", integration.id)
    .eq("partner_id", integration.partner_id);

  if (!error) integration.settings = nextSettings;
}

function buildDiagnostics(
  traceId: string,
  startedAtMs: number,
  requestCount: number,
  targetPath: string | null,
  extra?: Record<string, unknown>,
) {
  return {
    trace_id: traceId,
    duration_ms: Date.now() - startedAtMs,
    request_count: requestCount,
    target_path: targetPath,
    timeout_ms: TEST_TIMEOUT_MS,
    ...extra,
  };
}

async function persistTestResult(
  admin: ReturnType<typeof createAdminClient>,
  integration: IntegrationRow,
  result: TestResultPayload,
  diagnostics: Record<string, unknown>,
  step: string,
) {
  const prev = asObject(integration.settings);
  const finishedAt = new Date().toISOString();
  const nextSettings: Record<string, unknown> = {
    ...prev,
    last_tested_at: finishedAt,
    last_test_status: result.status,
    last_test_message: result.message.slice(0, 300),
    last_test_http_status: result.http_status ?? null,
    last_test_trace_id: diagnostics.trace_id ?? null,
    last_test_step: step,
    last_test_duration_ms: diagnostics.duration_ms ?? null,
    last_test_request_count: diagnostics.request_count ?? null,
    last_test_target_path: diagnostics.target_path ?? null,
    last_test_timeout_ms: diagnostics.timeout_ms ?? TEST_TIMEOUT_MS,
    last_test_finished_at: finishedAt,
    last_test_log: appendIntegrationLog(prev.last_test_log, {
      at: finishedAt,
      step,
      status: result.status,
      message: result.message,
    }),
  };

  const { error } = await admin
    .from("partner_integrations")
    .update({ settings: nextSettings })
    .eq("id", integration.id)
    .eq("partner_id", integration.partner_id);

  if (!error) integration.settings = nextSettings;
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
    const traceId = crypto.randomUUID();
    const startedAtMs = Date.now();
    let requestCount = 0;
    let targetPath: string | null = null;

    const finish = async (result: TestResultPayload, step: string) => {
      const diagnostics = buildDiagnostics(traceId, startedAtMs, requestCount, targetPath, {
        provider_http_status: result.http_status ?? null,
      });
      await persistTestResult(admin, integration, result, diagnostics, step);
      return NextResponse.json({ ok: true, result, diagnostics });
    };

    await patchIntegrationSettings(admin, integration, {
      last_test_trace_id: traceId,
      last_test_step: "started",
      last_test_started_at: new Date(startedAtMs).toISOString(),
      last_test_finished_at: null,
      last_test_duration_ms: null,
      last_test_request_count: 0,
      last_test_target_path: null,
      last_test_timeout_ms: TEST_TIMEOUT_MS,
      last_test_log: appendIntegrationLog(asObject(integration.settings).last_test_log, {
        at: new Date(startedAtMs).toISOString(),
        step: "started",
        status: "running",
        message: "Verbindungstest gestartet.",
      }),
    });

    if (String(integration.partner_id) !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await patchIntegrationSettings(admin, integration, {
      last_test_step: "integration_loaded",
      last_test_log: appendIntegrationLog(asObject(integration.settings).last_test_log, {
        at: new Date().toISOString(),
        step: "integration_loaded",
        status: "ok",
        message: `Integration ${integration.provider} geladen.`,
      }),
    });

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
      return finish({ status: "warning", message: "Integration ist deaktiviert." }, "completed");
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
        return finish(
          {
            status: "error",
            message: "Kein API-Key hinterlegt. Bitte zuerst im Schritt 'API-Key und Verbindungstest' speichern.",
          },
          "config_error",
        );
      }

      if (!activeArea?.id) {
        return finish(
          {
            status: "warning",
            message: "Zugangsschluessel ist gespeichert, aber es ist noch kein aktives Gebiet zugeordnet.",
          },
          "completed",
        );
      }

      return finish(
        {
          status: "ok",
          message: "Konfiguration ist bereit: Zugangsschluessel gespeichert und aktives Gebiet vorhanden.",
        },
        "completed",
      );
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
      baseUrl
      ?? asText(llmSettings.base_url)
      ?? (integration.kind === "llm" ? defaultLlmBaseUrlByProvider[integration.provider] ?? null : null);

    if (!resolvedBaseUrl) {
      return finish({ status: "error", message: "Keine base_url konfiguriert." }, "config_error");
    }

    const baseUrlCheck = await validateOutboundUrl(resolvedBaseUrl);
    if (!baseUrlCheck.ok) {
      return finish(
        { status: "error", message: `Base URL blockiert (${baseUrlCheck.reason}).` },
        "config_error",
      );
    }

    const authType = asText(integration.auth_type)?.toLowerCase() ?? "";
    const token = readSecretFromAuthConfig(authConfig, "token");
    const apiKey = readSecretFromAuthConfig(authConfig, "api_key");
    const model = asText(integration.settings?.model) ?? asText(integration.settings?.model_name);

    let res: Response;
    try {
      if (integration.kind === "crm" && integration.provider === "propstack") {
        if (!apiKey) {
          return finish(
            { status: "error", message: "Propstack API-Key fehlt (Secret api_key)." },
            "config_error",
          );
        }
        const url = `${resolvedBaseUrl.replace(/\/+$/, "")}/units?per=1&page=1`;
        const targetCheck = await validateOutboundUrl(url);
        if (!targetCheck.ok) {
          return finish(
            { status: "error", message: `Ziel-URL blockiert (${targetCheck.reason}).` },
            "config_error",
          );
        }
        targetPath = "/units?per=1&page=1";
        requestCount = 1;
        await patchIntegrationSettings(admin, integration, {
          last_test_step: "provider_request_started",
          last_test_request_count: requestCount,
          last_test_target_path: targetPath,
          last_test_log: appendIntegrationLog(asObject(integration.settings).last_test_log, {
            at: new Date().toISOString(),
            step: "provider_request_started",
            status: "running",
            message: "Propstack-Minimalabruf gestartet.",
          }),
        });
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
          return finish(
            { status: "error", message: "onOffice Zugangsdaten fehlen (Token + Secret erforderlich)." },
            "config_error",
          );
        }
        const targetCheck = await validateOutboundUrl(resolvedBaseUrl);
        if (!targetCheck.ok) {
          return finish(
            { status: "error", message: `Ziel-URL blockiert (${targetCheck.reason}).` },
            "config_error",
          );
        }
        targetPath = "/onoffice/estate/read";
        requestCount = 1;
        await patchIntegrationSettings(admin, integration, {
          last_test_step: "provider_request_started",
          last_test_request_count: requestCount,
          last_test_target_path: targetPath,
          last_test_log: appendIntegrationLog(asObject(integration.settings).last_test_log, {
            at: new Date().toISOString(),
            step: "provider_request_started",
            status: "running",
            message: "onOffice-Minimalabruf gestartet.",
          }),
        });
        const body = buildOnOfficeReadRequest(token, secret, "estate", ["Id"]);
        res = await fetchWithTimeout(targetCheck.url, {
          method: "POST",
          headers: {
            accept: "application/json, text/plain, */*",
            "content-type": "application/json",
          },
          body: JSON.stringify(body),
        });
      } else if (integration.kind === "crm" && integration.provider === "openimmo") {
        const targetCheck = await validateOutboundUrl(resolvedBaseUrl);
        if (!targetCheck.ok) {
          return finish(
            { status: "error", message: `Ziel-URL blockiert (${targetCheck.reason}).` },
            "config_error",
          );
        }
        targetPath = "/openimmo-feed";
        requestCount = 1;
        await patchIntegrationSettings(admin, integration, {
          last_test_step: "provider_request_started",
          last_test_request_count: requestCount,
          last_test_target_path: targetPath,
          last_test_log: appendIntegrationLog(asObject(integration.settings).last_test_log, {
            at: new Date().toISOString(),
            step: "provider_request_started",
            status: "running",
            message: "OpenImmo-Feedabruf gestartet.",
          }),
        });
        res = await fetchWithTimeout(targetCheck.url, {
          method: "GET",
          headers: buildOpenImmoRequestHeaders(integration),
        });
      } else if (integration.kind === "llm") {
        if (!apiKey) {
          return finish({ status: "error", message: "LLM API-Key fehlt (Secret api_key)." }, "config_error");
        }
        if (!model) {
          return finish({ status: "error", message: "LLM Modell fehlt (settings.model)." }, "config_error");
        }

        const markLlmRequestStarted = async () => {
          await patchIntegrationSettings(admin, integration, {
            last_test_step: "provider_request_started",
            last_test_request_count: requestCount,
            last_test_target_path: targetPath,
            last_test_log: appendIntegrationLog(asObject(integration.settings).last_test_log, {
              at: new Date().toISOString(),
              step: "provider_request_started",
              status: "running",
              message: "LLM-Minimalabruf gestartet.",
            }),
          });
        };

        if (integration.provider === "google_gemini") {
          const normalizedBase = resolvedBaseUrl.replace(/\/+$/, "");
          const url = `${normalizedBase}/models`;
          const targetCheck = await validateOutboundUrl(url);
          if (!targetCheck.ok) {
            return finish(
              { status: "error", message: `Ziel-URL blockiert (${targetCheck.reason}).` },
              "config_error",
            );
          }
          targetPath = "/models";
          requestCount = 1;
          await markLlmRequestStarted();
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
            return finish(
              { status: "error", message: `Ziel-URL blockiert (${targetCheck.reason}).` },
              "config_error",
            );
          }
          targetPath = "/messages";
          requestCount = 1;
          await markLlmRequestStarted();
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
            return finish(
              { status: "error", message: `Ziel-URL blockiert (${targetCheck.reason}).` },
              "config_error",
            );
          }
          targetPath = `/openai/deployments/${encodeURIComponent(model)}/chat/completions`;
          requestCount = 1;
          await markLlmRequestStarted();
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
            return finish(
              { status: "error", message: `Ziel-URL blockiert (${targetCheck.reason}).` },
              "config_error",
            );
          }
          targetPath = "/models";
          requestCount = 1;
          await markLlmRequestStarted();
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
        targetPath = "/";
        requestCount = 1;
        await patchIntegrationSettings(admin, integration, {
          last_test_step: "provider_request_started",
          last_test_request_count: requestCount,
          last_test_target_path: targetPath,
          last_test_log: appendIntegrationLog(asObject(integration.settings).last_test_log, {
            at: new Date().toISOString(),
            step: "provider_request_started",
            status: "running",
            message: "Minimaler Verbindungsaufruf gestartet.",
          }),
        });
        res = await fetchWithTimeout(resolvedBaseUrl, { method: "HEAD", headers });
        if (res.status === 405 || res.status === 501) {
          requestCount = 2;
          res = await fetchWithTimeout(resolvedBaseUrl, { method: "GET", headers });
        }
      }

      await patchIntegrationSettings(admin, integration, {
        last_test_step: "provider_request_finished",
        last_test_request_count: requestCount,
        last_test_target_path: targetPath,
        last_test_http_status: res.status,
        last_test_log: appendIntegrationLog(asObject(integration.settings).last_test_log, {
          at: new Date().toISOString(),
          step: "provider_request_finished",
          status: res.ok ? "ok" : "warning",
          message: `Provider antwortete mit HTTP ${res.status}.`,
        }),
      });
    } catch (error) {
      return finish(
        {
          status: "error",
          message: `Verbindung fehlgeschlagen: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`,
        },
        "failed",
      );
    }

    if (res.ok && integration.kind === "crm" && integration.provider === "openimmo") {
      const xml = await res.text().catch(() => "");
      const parsed = parseOpenImmoDocument(xml);
      return finish(
        {
          status: "ok",
          message: `OpenImmo-Feed erfolgreich geladen (${parsed.listings.length} Angebote erkannt).`,
          http_status: res.status,
        },
        "completed",
      );
    }

    if (res.ok) {
      return finish(
        {
          status: "ok",
          message: `Verbindung erfolgreich (${res.status}).`,
          http_status: res.status,
        },
        "completed",
      );
    }

    return finish(
      {
        status: "warning",
        message: `Server erreichbar, aber Antwort ist ${res.status}.`,
        http_status: res.status,
      },
      "completed",
    );
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
