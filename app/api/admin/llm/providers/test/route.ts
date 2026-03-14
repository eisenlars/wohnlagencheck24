import { NextResponse } from "next/server";

import { isMissingTable } from "@/lib/llm/provider-catalog";
import { requireAdmin } from "@/lib/security/admin-auth";
import { checkAdminApiRateLimit } from "@/lib/security/rate-limit";
import { readSecretFromAuthConfig } from "@/lib/security/secret-crypto";
import { validateOutboundUrl } from "@/lib/security/outbound-url";
import { createAdminClient } from "@/utils/supabase/admin";

type Body = {
  provider_model_id?: string;
  provider?: string;
  model?: string;
  base_url?: string;
  api_key?: string;
  api_version?: string;
};

function asText(value: unknown): string | null {
  const v = String(value ?? "").trim();
  return v.length > 0 ? v : null;
}

function defaultBaseUrl(provider: string): string {
  const p = String(provider ?? "").trim().toLowerCase();
  if (p === "anthropic") return "https://api.anthropic.com/v1";
  if (p === "google_gemini") return "https://generativelanguage.googleapis.com/v1beta";
  if (p === "mistral") return "https://api.mistral.ai/v1";
  return "https://api.openai.com/v1";
}

function usesCompletionTokens(provider: string, model: string | null): boolean {
  const normalizedProvider = String(provider ?? "").trim().toLowerCase();
  const normalizedModel = String(model ?? "").trim().toLowerCase();
  if (!normalizedModel) return false;
  if (normalizedProvider !== "openai" && normalizedProvider !== "azure_openai") return false;
  return normalizedModel.startsWith("gpt-5");
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 10_000): Promise<Response> {
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

async function readErrorBody(res: Response): Promise<string> {
  try {
    const json = await res.json();
    if (typeof json?.error?.message === "string" && json.error.message.trim()) return json.error.message.trim();
    const text = JSON.stringify(json);
    return text.slice(0, 300);
  } catch {
    try {
      const text = await res.text();
      return text.slice(0, 300);
    } catch {
      return `HTTP ${res.status}`;
    }
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin(["admin_super", "admin_ops"]);
    const limit = await checkAdminApiRateLimit(req, admin.userId);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } });
    }

    const body = (await req.json()) as Body;
    const providerModelId = asText(body.provider_model_id);
    let provider = String(body.provider ?? "").trim().toLowerCase();
    let model = asText(body.model);
    let apiKey = asText(body.api_key);
    let baseUrl = asText(body.base_url);
    let apiVersion = asText(body.api_version);

    if (providerModelId) {
      const admin = createAdminClient();
      const { data: modelRow, error: modelError } = await admin
        .from("llm_provider_models")
        .select("id, model, provider_account_id")
        .eq("id", providerModelId)
        .maybeSingle();
      if (modelError) {
        if (isMissingTable(modelError, "llm_provider_models")) {
          return NextResponse.json({ error: "Tabelle `llm_provider_models` fehlt. Bitte Migration ausführen." }, { status: 409 });
        }
        return NextResponse.json({ error: modelError.message }, { status: 500 });
      }
      if (!modelRow) return NextResponse.json({ error: "Modell für Verbindungstest nicht gefunden." }, { status: 404 });

      const providerAccountId = asText(modelRow.provider_account_id);
      if (!providerAccountId) {
        return NextResponse.json({ error: "Dem Modell fehlt ein Provider-Account." }, { status: 409 });
      }

      const { data: accountRow, error: accountError } = await admin
        .from("llm_provider_accounts")
        .select("provider, base_url, api_version, auth_config")
        .eq("id", providerAccountId)
        .maybeSingle();
      if (accountError) {
        if (isMissingTable(accountError, "llm_provider_accounts")) {
          return NextResponse.json({ error: "Tabelle `llm_provider_accounts` fehlt. Bitte Migration ausführen." }, { status: 409 });
        }
        return NextResponse.json({ error: accountError.message }, { status: 500 });
      }
      if (!accountRow) return NextResponse.json({ error: "Provider-Account für Verbindungstest nicht gefunden." }, { status: 404 });

      provider = provider || String(accountRow.provider ?? "").trim().toLowerCase();
      model = model ?? asText(modelRow.model);
      baseUrl = baseUrl ?? asText(accountRow.base_url);
      apiVersion = apiVersion ?? asText(accountRow.api_version);
      apiKey = apiKey ?? readSecretFromAuthConfig((accountRow.auth_config as Record<string, unknown> | null) ?? null, "api_key");
    }

    baseUrl = baseUrl ?? defaultBaseUrl(provider);
    apiVersion = apiVersion ?? "2024-10-21";

    if (!provider) return NextResponse.json({ error: "Provider fehlt." }, { status: 400 });
    if (!model) return NextResponse.json({ error: "Modell fehlt." }, { status: 400 });
    if (!apiKey) return NextResponse.json({ error: "API-Key fehlt." }, { status: 400 });

    const baseUrlCheck = await validateOutboundUrl(baseUrl);
    if (!baseUrlCheck.ok) {
      return NextResponse.json({
        ok: true,
        result: { status: "error", message: `Base URL ist nicht erlaubt (${baseUrlCheck.reason}).` },
      });
    }

    const p = provider;
    let res: Response;

    if (p === "anthropic") {
      const url = `${baseUrlCheck.url.replace(/\/+$/, "")}/messages`;
      const targetCheck = await validateOutboundUrl(url);
      if (!targetCheck.ok) {
        return NextResponse.json({ ok: true, result: { status: "error", message: `Ziel-URL blockiert (${targetCheck.reason}).` } });
      }
      res = await fetchWithTimeout(targetCheck.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 8,
          messages: [{ role: "user", content: "ping" }],
        }),
      });
    } else if (p === "google_gemini") {
      const url = `${baseUrlCheck.url.replace(/\/+$/, "")}/models`;
      const targetCheck = await validateOutboundUrl(url);
      if (!targetCheck.ok) {
        return NextResponse.json({ ok: true, result: { status: "error", message: `Ziel-URL blockiert (${targetCheck.reason}).` } });
      }
      res = await fetchWithTimeout(targetCheck.url, {
        method: "GET",
        headers: {
          accept: "application/json",
          "x-goog-api-key": apiKey,
        },
      });
    } else if (p === "azure_openai") {
      const normalized = baseUrlCheck.url.replace(/\/+$/, "");
      const url = `${normalized}/openai/deployments/${encodeURIComponent(model)}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`;
      const targetCheck = await validateOutboundUrl(url);
      if (!targetCheck.ok) {
        return NextResponse.json({ ok: true, result: { status: "error", message: `Ziel-URL blockiert (${targetCheck.reason}).` } });
      }
      res = await fetchWithTimeout(targetCheck.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "api-key": apiKey,
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: "ping" }],
          ...(usesCompletionTokens(provider, model)
            ? { max_completion_tokens: 8 }
            : { max_tokens: 8 }),
          temperature: 0,
        }),
      });
    } else {
      const url = `${baseUrlCheck.url.replace(/\/+$/, "")}/chat/completions`;
      const targetCheck = await validateOutboundUrl(url);
      if (!targetCheck.ok) {
        return NextResponse.json({ ok: true, result: { status: "error", message: `Ziel-URL blockiert (${targetCheck.reason}).` } });
      }
      res = await fetchWithTimeout(targetCheck.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: "ping" }],
          ...(usesCompletionTokens(provider, model)
            ? { max_completion_tokens: 8 }
            : { max_tokens: 8 }),
          temperature: 0,
        }),
      });
    }

    if (!res.ok) {
      const reason = await readErrorBody(res);
      return NextResponse.json({
        ok: true,
        result: {
          status: "error",
          message: `Verbindung fehlgeschlagen (${res.status}): ${reason}`,
          http_status: res.status,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      result: {
        status: "ok",
        message: "Verbindung erfolgreich. Provider, Modell und API-Key sind nutzbar.",
        http_status: res.status,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
