import { NextResponse } from "next/server";
import { createHmac } from "node:crypto";

import { createAdminClient } from "@/utils/supabase/admin";
import { requireNetworkPartnerActorContext } from "@/lib/network-partners/auth";
import { requireNetworkPartnerRole } from "@/lib/network-partners/roles";
import { getIntegrationByIdForNetworkPartner } from "@/lib/network-partners/repositories/integrations";
import { readSecretFromAuthConfig } from "@/lib/security/secret-crypto";
import { validateOutboundUrl } from "@/lib/security/outbound-url";

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
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
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

function buildOnOfficeReadRequest(token: string, secret: string) {
  const actionId = "urn:onoffice-de-ns:smart:2.5:smartml:action:read";
  const timestamp = String(Math.floor(Date.now() / 1000));
  const hmac = buildOnOfficeHmacV2({ timestamp, token, resourceType: "estate", actionId }, secret);
  return {
    token,
    request: {
      actions: [
        {
          actionid: actionId,
          resourceid: "",
          resourcetype: "estate",
          timestamp,
          hmac,
          hmac_version: 2,
          parameters: {
            data: ["Id"],
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

async function patchIntegrationTestState(
  integrationId: string,
  networkPartnerId: string,
  patch: Record<string, unknown>,
) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("network_partner_integrations")
    .select("settings")
    .eq("id", integrationId)
    .eq("network_partner_id", networkPartnerId)
    .maybeSingle();

  if (error) return;
  const prev = asObject(data && typeof data === "object" ? (data as Record<string, unknown>).settings : null);
  const nextSettings = { ...prev, ...patch };
  await admin
    .from("network_partner_integrations")
    .update({
      settings: nextSettings,
      last_test_at: new Date().toISOString(),
    })
    .eq("id", integrationId)
    .eq("network_partner_id", networkPartnerId);
}

function mapTestError(error: Error) {
  if (error.message === "UNAUTHORIZED") return { status: 401, error: "Unauthorized" };
  if (error.message === "FORBIDDEN") return { status: 403, error: "Forbidden" };
  if (error.message === "NOT_FOUND") return { status: 404, error: "Integration not found" };
  return { status: 500, error: error.message || "Unexpected error" };
}

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const actor = requireNetworkPartnerRole(
      await requireNetworkPartnerActorContext(),
      ["network_owner", "network_editor"],
    );
    const params = await ctx.params;
    const integrationId = asText(params.id);
    if (!integrationId) {
      return NextResponse.json({ error: "Missing integration id" }, { status: 400 });
    }

    const integration = await getIntegrationByIdForNetworkPartner(integrationId, actor.networkPartnerId);
    if (!integration) {
      return NextResponse.json({ error: "Integration not found" }, { status: 404 });
    }

    const traceId = crypto.randomUUID();
    const startedAtMs = Date.now();
    let requestCount = 0;
    let targetPath: string | null = null;

    const finish = async (result: TestResultPayload, step: string) => {
      const finishedAt = new Date().toISOString();
      await patchIntegrationTestState(integration.id, actor.networkPartnerId, {
        last_test_trace_id: traceId,
        last_test_step: step,
        last_test_status: result.status,
        last_test_message: result.message.slice(0, 300),
        last_test_http_status: result.http_status ?? null,
        last_test_request_count: requestCount,
        last_test_target_path: targetPath,
        last_test_timeout_ms: TEST_TIMEOUT_MS,
        last_test_finished_at: finishedAt,
        last_test_duration_ms: Date.now() - startedAtMs,
        last_test_log: appendIntegrationLog(integration.settings?.last_test_log, {
          at: finishedAt,
          step,
          status: result.status,
          message: result.message,
        }),
      });

      return NextResponse.json({
        ok: true,
        result,
        diagnostics: {
          trace_id: traceId,
          duration_ms: Date.now() - startedAtMs,
          request_count: requestCount,
          target_path: targetPath,
          timeout_ms: TEST_TIMEOUT_MS,
          provider_http_status: result.http_status ?? null,
        },
      });
    };

    await patchIntegrationTestState(integration.id, actor.networkPartnerId, {
      last_test_trace_id: traceId,
      last_test_step: "started",
      last_test_started_at: new Date(startedAtMs).toISOString(),
      last_test_finished_at: null,
      last_test_duration_ms: null,
      last_test_request_count: 0,
      last_test_target_path: null,
      last_test_timeout_ms: TEST_TIMEOUT_MS,
      last_test_log: appendIntegrationLog(integration.settings?.last_test_log, {
        at: new Date(startedAtMs).toISOString(),
        step: "started",
        status: "running",
        message: "Verbindungstest gestartet.",
      }),
    });

    if (!integration.is_active) {
      return finish({ status: "warning", message: "Integration ist deaktiviert." }, "completed");
    }

    const resolvedBaseUrl = asText(integration.base_url);
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

    const authConfig = integration.auth_config ?? {};
    let res: Response;
    try {
      if (integration.provider === "propstack") {
        const apiKey = readSecretFromAuthConfig(authConfig, "api_key");
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
        res = await fetchWithTimeout(url, {
          method: "GET",
          headers: {
            accept: "application/json, text/plain, */*",
            "x-api-key": apiKey,
          },
        });
      } else if (integration.provider === "onoffice") {
        const token = readSecretFromAuthConfig(authConfig, "token");
        const secret = readSecretFromAuthConfig(authConfig, "secret");
        if (!token || !secret) {
          return finish(
            { status: "error", message: "onOffice Zugangsdaten fehlen (Token + Secret erforderlich)." },
            "config_error",
          );
        }

        targetPath = "/onoffice/estate/read";
        requestCount = 1;
        const body = buildOnOfficeReadRequest(token, secret);
        res = await fetchWithTimeout(baseUrlCheck.url, {
          method: "POST",
          headers: {
            accept: "application/json, text/plain, */*",
            "content-type": "application/json",
          },
          body: JSON.stringify(body),
        });
      } else {
        return finish(
          { status: "error", message: `Provider nicht unterstützt: ${integration.provider}` },
          "config_error",
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Provider request failed";
      return finish({ status: "error", message }, "provider_request_failed");
    }

    if (!res.ok) {
      return finish(
        {
          status: res.status >= 500 ? "warning" : "error",
          message: `Provider antwortet mit HTTP ${res.status}.`,
          http_status: res.status,
        },
        "provider_response",
      );
    }

    return finish(
      { status: "ok", message: "Verbindungstest erfolgreich.", http_status: res.status },
      "completed",
    );
  } catch (error) {
    const mapped = mapTestError(error as Error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
