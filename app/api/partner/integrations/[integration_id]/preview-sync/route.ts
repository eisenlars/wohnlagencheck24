import { NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { checkRateLimitPersistent, extractClientIpFromHeaders } from "@/lib/security/rate-limit";
import { syncIntegrationResources } from "@/lib/providers";
import type { PartnerIntegration } from "@/lib/providers/types";
import { fetchPropstackUnits } from "@/lib/providers/propstack";
import { readSecretFromAuthConfig } from "@/lib/security/secret-crypto";

type IntegrationStepLogEntry = {
  at: string;
  step: string;
  status: "running" | "ok" | "warning" | "error";
  message: string;
};

const PREVIEW_LOG_LIMIT = 12;
const PREVIEW_MAX_RUNTIME_MS = 10000;
const PREVIEW_MAX_REQUESTS = 1;
const PREVIEW_MAX_PAGES = 1;
const PREVIEW_PER_PAGE = 10;

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return {};
  return value as Record<string, unknown>;
}

function appendIntegrationLog(
  value: unknown,
  entry: IntegrationStepLogEntry,
  limit = PREVIEW_LOG_LIMIT,
): IntegrationStepLogEntry[] {
  const current = Array.isArray(value)
    ? value.filter((item): item is IntegrationStepLogEntry => Boolean(item) && typeof item === "object")
    : [];
  return [...current, entry].slice(-limit);
}

async function patchIntegrationSettings(
  admin: ReturnType<typeof createAdminClient>,
  integration: PartnerIntegration,
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

function buildPreviewDiagnostics(
  traceId: string,
  startedAtMs: number,
  requestCount: number,
  pagesFetched: number,
  extra?: Record<string, unknown>,
) {
  return {
    trace_id: traceId,
    duration_ms: Date.now() - startedAtMs,
    request_count: requestCount,
    pages_fetched: pagesFetched,
    budget_applied: true,
    max_runtime_ms: PREVIEW_MAX_RUNTIME_MS,
    max_requests: PREVIEW_MAX_REQUESTS,
    max_pages: PREVIEW_MAX_PAGES,
    per_page: PREVIEW_PER_PAGE,
    ...extra,
  };
}

async function persistPreviewResult(
  admin: ReturnType<typeof createAdminClient>,
  integration: PartnerIntegration,
  status: "ok" | "warning" | "error",
  message: string,
  diagnostics: Record<string, unknown>,
  step: string,
) {
  const prev = asObject(integration.settings);
  const finishedAt = new Date().toISOString();
  const nextSettings: Record<string, unknown> = {
    ...prev,
    last_previewed_at: finishedAt,
    last_preview_status: status,
    last_preview_message: message.slice(0, 300),
    last_preview_trace_id: diagnostics.trace_id ?? null,
    last_preview_step: step,
    last_preview_duration_ms: diagnostics.duration_ms ?? null,
    last_preview_request_count: diagnostics.request_count ?? null,
    last_preview_pages_fetched: diagnostics.pages_fetched ?? null,
    last_preview_budget_applied: diagnostics.budget_applied ?? true,
    last_preview_max_runtime_ms: diagnostics.max_runtime_ms ?? PREVIEW_MAX_RUNTIME_MS,
    last_preview_max_requests: diagnostics.max_requests ?? PREVIEW_MAX_REQUESTS,
    last_preview_max_pages: diagnostics.max_pages ?? PREVIEW_MAX_PAGES,
    last_preview_finished_at: finishedAt,
    last_preview_log: appendIntegrationLog(prev.last_preview_log, {
      at: finishedAt,
      step,
      status,
      message,
    }),
  };
  const { error } = await admin
    .from("partner_integrations")
    .update({ settings: nextSettings })
    .eq("id", integration.id)
    .eq("partner_id", integration.partner_id);

  if (!error) integration.settings = nextSettings;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function requirePartnerUser(req: Request): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) throw new Error("UNAUTHORIZED");

  const ip = extractClientIpFromHeaders(req.headers);
  const limit = await checkRateLimitPersistent(
    `partner_integration_preview_sync:${user.id}:${ip}`,
    { windowMs: 60 * 1000, max: 10 },
  );
  if (!limit.allowed) throw new Error(`RATE_LIMIT:${limit.retryAfterSec}`);
  return user.id;
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
      .select("id, partner_id, kind, provider, base_url, auth_type, auth_config, detail_url_template, is_active, settings")
      .eq("id", integrationId)
      .eq("partner_id", userId)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Integration not found" }, { status: 404 });

    const integration = data as PartnerIntegration;
    const traceId = crypto.randomUUID();
    const startedAtMs = Date.now();
    let requestCount = 0;
    let pagesFetched = 0;

    const finish = async (
      status: "ok" | "warning" | "error",
      message: string,
      step: string,
      preview: Record<string, unknown>,
      responseStatus = 200,
      extraDiagnostics?: Record<string, unknown>,
    ) => {
      const diagnostics = buildPreviewDiagnostics(
        traceId,
        startedAtMs,
        requestCount,
        pagesFetched,
        extraDiagnostics,
      );
      await persistPreviewResult(admin, integration, status, message, diagnostics, step);
      return NextResponse.json(
        {
          ok: status !== "error",
          preview: {
            ...preview,
            diagnostics,
          },
        },
        { status: responseStatus },
      );
    };

    await patchIntegrationSettings(admin, integration, {
      last_preview_trace_id: traceId,
      last_preview_step: "started",
      last_preview_started_at: new Date(startedAtMs).toISOString(),
      last_preview_finished_at: null,
      last_preview_duration_ms: null,
      last_preview_request_count: 0,
      last_preview_pages_fetched: 0,
      last_preview_budget_applied: true,
      last_preview_max_runtime_ms: PREVIEW_MAX_RUNTIME_MS,
      last_preview_max_requests: PREVIEW_MAX_REQUESTS,
      last_preview_max_pages: PREVIEW_MAX_PAGES,
      last_preview_log: appendIntegrationLog(asObject(integration.settings).last_preview_log, {
        at: new Date(startedAtMs).toISOString(),
        step: "started",
        status: "running",
        message: "CRM-Abruf-Test gestartet.",
      }),
    });

    if (String(integration.kind ?? "").toLowerCase() !== "crm") {
      return NextResponse.json({ error: "Nur CRM-Anbindungen können geprüft werden." }, { status: 400 });
    }

    await patchIntegrationSettings(admin, integration, {
      last_preview_step: "integration_loaded",
      last_preview_log: appendIntegrationLog(asObject(integration.settings).last_preview_log, {
        at: new Date().toISOString(),
        step: "integration_loaded",
        status: "ok",
        message: `CRM-Integration ${integration.provider} geladen.`,
      }),
    });

    if (!integration.is_active) {
      return finish(
        "warning",
        "Die CRM-Anbindung ist deaktiviert.",
        "completed",
        {
          skipped: true,
          reason: "integration inactive",
        },
      );
    }

    const isPropstack = String(integration.provider ?? "").toLowerCase() === "propstack";
    if (isPropstack) {
      const auth = (integration.auth_config ?? {}) as Record<string, unknown>;
      const apiKey =
        readSecretFromAuthConfig(auth, "api_key")
        ?? readSecretFromAuthConfig(auth, "token");

      if (!apiKey) {
        return finish(
          "error",
          "API-Key fehlt für Provider propstack.",
          "config_error",
          {
            skipped: true,
            reason: "missing api key",
          },
          400,
        );
      }

      requestCount = 1;
      pagesFetched = 1;
      await patchIntegrationSettings(admin, integration, {
        last_preview_step: "provider_request_started",
        last_preview_request_count: requestCount,
        last_preview_pages_fetched: pagesFetched,
        last_preview_log: appendIntegrationLog(asObject(integration.settings).last_preview_log, {
          at: new Date().toISOString(),
          step: "provider_request_started",
          status: "running",
          message: "Propstack-Preview mit erster Units-Seite gestartet.",
        }),
      });

      try {
        const units = await withTimeout(
          fetchPropstackUnits(integration, apiKey, { maxPages: PREVIEW_MAX_PAGES, perPage: PREVIEW_PER_PAGE }),
          PREVIEW_MAX_RUNTIME_MS,
          `CRM-Abrufbudget überschritten (max. ${PREVIEW_MAX_RUNTIME_MS}ms).`,
        );
        await patchIntegrationSettings(admin, integration, {
          last_preview_step: "provider_request_finished",
          last_preview_request_count: requestCount,
          last_preview_pages_fetched: pagesFetched,
          last_preview_log: appendIntegrationLog(asObject(integration.settings).last_preview_log, {
            at: new Date().toISOString(),
            step: "provider_request_finished",
            status: "ok",
            message: `Propstack-Preview erfolgreich geladen (${units.length} Datensaetze).`,
          }),
        });

        return finish(
          "ok",
          `CRM-Abruf erfolgreich (${units.length} Datensaetze).`,
          "completed",
          {
            skipped: false,
            provider: integration.provider,
            diagnostic_mode: "propstack_first_page",
            offers_count: units.length,
            listings_count: units.length,
            references_count: null,
            requests_count: null,
            references_fetched: null,
            requests_fetched: null,
            notes: [
              "Preview nutzt bei Propstack nur die erste Units-Seite mit with_meta=1.",
            ],
            offers_preview: units.slice(0, 5).map((unit) => ({
              external_id: String(unit.exposee_id ?? unit.id ?? ""),
              title: unit.title ?? null,
              offer_type: unit.marketing_type ?? null,
              object_type: unit.rs_type ?? null,
              address: [unit.street, unit.house_number, unit.zip_code, unit.city].filter(Boolean).join(" ") || null,
            })),
            listings_preview: units.slice(0, 5).map((unit) => ({
              external_id: String(unit.exposee_id ?? unit.id ?? ""),
              title: unit.title ?? null,
              source_updated_at: unit.updated_at ?? null,
              status: unit.status ?? null,
            })),
          },
          200,
          {
            stopped_due_to_budget: false,
            provider_http_status: 200,
          },
        );
      } catch (previewError) {
        const message = previewError instanceof Error ? previewError.message : "Unbekannter Preview-Fehler";
        const isBudgetError = message.includes("CRM-Abrufbudget überschritten");
        return finish(
          "error",
          message,
          isBudgetError ? "budget_exceeded" : "failed",
          {
            skipped: true,
            reason: isBudgetError ? "budget exceeded" : "preview failed",
          },
          isBudgetError ? 504 : 500,
          {
            stopped_due_to_budget: isBudgetError,
          },
        );
      }
    }

    await patchIntegrationSettings(admin, integration, {
      last_preview_step: "provider_request_started",
      last_preview_request_count: PREVIEW_MAX_REQUESTS,
      last_preview_pages_fetched: PREVIEW_MAX_PAGES,
      last_preview_log: appendIntegrationLog(asObject(integration.settings).last_preview_log, {
        at: new Date().toISOString(),
        step: "provider_request_started",
        status: "running",
        message: "Generischer CRM-Preview-Abruf gestartet.",
      }),
    });
    requestCount = PREVIEW_MAX_REQUESTS;
    pagesFetched = PREVIEW_MAX_PAGES;

    try {
      const result = await withTimeout(
        syncIntegrationResources(integration),
        PREVIEW_MAX_RUNTIME_MS,
        `CRM-Abrufbudget überschritten (max. ${PREVIEW_MAX_RUNTIME_MS}ms).`,
      );
      return finish(
        "ok",
        `CRM-Abruf erfolgreich (${result.offers.length} Angebote).`,
        "completed",
        {
          skipped: false,
          provider: integration.provider,
          offers_count: result.offers.length,
          listings_count: result.listings.length,
          references_count: result.references.length,
          requests_count: result.requests.length,
          references_fetched: result.referencesFetched,
          requests_fetched: result.requestsFetched,
          notes: result.notes ?? [],
          offers_preview: result.offers.slice(0, 5).map((offer) => ({
            external_id: offer.external_id,
            title: offer.title,
            offer_type: offer.offer_type,
            object_type: offer.object_type,
            address: offer.address,
          })),
          listings_preview: result.listings.slice(0, 5).map((listing) => ({
            external_id: listing.external_id,
            title: listing.title,
            source_updated_at: listing.source_updated_at,
            status: listing.status,
          })),
        },
        200,
        {
          stopped_due_to_budget: false,
        },
      );
    } catch (previewError) {
      const message = previewError instanceof Error ? previewError.message : "Unbekannter Preview-Fehler";
      const isBudgetError = message.includes("CRM-Abrufbudget überschritten");
      return finish(
        "error",
        message,
        isBudgetError ? "budget_exceeded" : "failed",
        {
          skipped: true,
          reason: isBudgetError ? "budget exceeded" : "preview failed",
        },
        isBudgetError ? 504 : 500,
        {
          stopped_due_to_budget: isBudgetError,
        },
      );
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (error.message.startsWith("RATE_LIMIT:")) {
        const sec = Number(error.message.split(":")[1] ?? "60");
        return NextResponse.json(
          { error: "Too many requests" },
          { status: 429, headers: { "Retry-After": String(sec) } },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
