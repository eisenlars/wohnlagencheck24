import { NextResponse } from "next/server";

import { createAdminClient } from "@/utils/supabase/admin";
import { normalizeCrmSyncSelection } from "@/lib/integrations/settings";
import { requireAdmin } from "@/lib/security/admin-auth";
import { checkAdminApiRateLimit, extractClientIpFromHeaders } from "@/lib/security/rate-limit";
import { writeSecurityAuditLog } from "@/lib/security/audit-log";
import { buildStructuredDebugPayload, syncIntegrationResources } from "@/lib/providers";
import type { CrmSyncResource, PartnerIntegration } from "@/lib/providers/types";

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

function readPreviewRuntime(settings: Record<string, unknown>, resource: Exclude<CrmSyncResource, "all"> | "all") {
  if (resource === "all") return settings;
  return asObject(asObject(settings.preview_resources)[resource]);
}

function writePreviewRuntime(
  settings: Record<string, unknown>,
  resource: Exclude<CrmSyncResource, "all"> | "all",
  patch: Record<string, unknown>,
) {
  const nextSettings: Record<string, unknown> = {
    ...settings,
    ...patch,
  };
  if (resource !== "all") {
    const previews = { ...asObject(settings.preview_resources) };
    previews[resource] = {
      ...asObject(previews[resource]),
      ...patch,
    };
    nextSettings.preview_resources = previews;
  }
  return nextSettings;
}

function formatPreviewResourceLabel(resource: Exclude<CrmSyncResource, "all"> | "all"): string {
  if (resource === "offers") return "Angebote";
  if (resource === "references") return "Referenzen";
  if (resource === "requests") return "Gesuche";
  return "CRM";
}

function buildOnOfficePreviewDebug(
  integration: PartnerIntegration,
  resource: Exclude<CrmSyncResource, "all"> | "all",
  result: Awaited<ReturnType<typeof syncIntegrationResources>>,
) {
  const settings = asObject(integration.settings);
  const resourceFilters = asObject(settings.resource_filters);
  const offers = asObject(resourceFilters.listings);
  return {
    provider: integration.provider,
    resource,
    settings_snapshot: {
      offers: {
        status_field_key: offers.status_field_key ?? null,
        active_status_values: Array.isArray(offers.active_status_values) ? offers.active_status_values : [],
        exclude_sold: offers.exclude_sold ?? null,
      },
    },
    result_counts: {
      offers: result.offers.length,
      raw_offers: result.listings.length,
      references: result.references.length,
      requests: result.requests.length,
    },
    diagnostics: result.diagnostics ?? null,
    notes: result.notes ?? [],
  };
}

function buildPreviewPayload(
  integration: PartnerIntegration,
  resource: Exclude<CrmSyncResource, "all"> | "all",
  traceId: string,
  result: Awaited<ReturnType<typeof syncIntegrationResources>>,
) {
  return buildStructuredDebugPayload(
    integration,
    resource,
    "guarded",
    new Date().toISOString(),
    result,
    { trace_id: traceId },
  );
}

function buildResourcePreview(
  resource: Exclude<CrmSyncResource, "all"> | "all",
  result: Awaited<ReturnType<typeof syncIntegrationResources>>,
) {
  const preview: Record<string, unknown> = {};

  if (resource === "all" || resource === "offers") {
    preview.offers_count = result.offers.length;
    preview.raw_offers_count = result.listings.length;
    preview.offers_preview = result.offers.slice(0, 5).map((offer) => ({
      external_id: offer.external_id,
      title: offer.title,
      offer_type: offer.offer_type,
      object_type: offer.object_type,
      address: offer.address,
    }));
    preview.raw_offers_preview = result.listings.slice(0, 5).map((rawOffer) => ({
      external_id: rawOffer.external_id,
      title: rawOffer.title,
      source_updated_at: rawOffer.source_updated_at,
      status: rawOffer.status,
    }));
  }

  if (resource === "all" || resource === "references") {
    preview.references_count = result.references.length;
    preview.references_fetched = result.referencesFetched;
    preview.references_preview = result.references.slice(0, 5).map((reference) => ({
      external_id: reference.external_id,
      title: reference.title,
      source_updated_at: reference.source_updated_at,
      status: reference.status,
    }));
  }

  if (resource === "all" || resource === "requests") {
    preview.requests_count = result.requests.length;
    preview.requests_fetched = result.requestsFetched;
    preview.requests_preview = result.requests.slice(0, 5).map((request) => ({
      external_id: request.external_id,
      title: request.title,
      source_updated_at: request.source_updated_at,
      status: request.status,
    }));
  }

  return preview;
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
  resource: Exclude<CrmSyncResource, "all"> | "all",
  patch: Record<string, unknown>,
) {
  const prev = asObject(integration.settings);
  const nextSettings = writePreviewRuntime(prev, resource, patch);
  const { error } = await admin
    .from("partner_integrations")
    .update({ settings: nextSettings })
    .eq("id", integration.id);

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
  resource: Exclude<CrmSyncResource, "all"> | "all",
  status: "ok" | "warning" | "error",
  message: string,
  diagnostics: Record<string, unknown>,
  step: string,
) {
  const prev = asObject(integration.settings);
  const finishedAt = new Date().toISOString();
  const nextSettings = writePreviewRuntime(prev, resource, {
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
    last_preview_log: appendIntegrationLog(readPreviewRuntime(prev, resource).last_preview_log, {
      at: finishedAt,
      step,
      status,
      message,
    }),
  });
  const { error } = await admin
    .from("partner_integrations")
    .update({ settings: nextSettings })
    .eq("id", integration.id);

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

export async function POST(
  req: Request,
  ctx: { params: Promise<{ integration_id: string }> },
) {
  try {
    const adminUser = await requireAdmin(["admin_super", "admin_ops"]);
    const adminRate = await checkAdminApiRateLimit(req, adminUser.userId);
    if (!adminRate.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(adminRate.retryAfterSec) } },
      );
    }

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
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Integration not found" }, { status: 404 });

    const integration = data as PartnerIntegration;
    const body = await req.json().catch(() => null);
    const resource = normalizeCrmSyncSelection(body).resource;
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
      await persistPreviewResult(admin, integration, resource, status, message, diagnostics, step);
      await writeSecurityAuditLog({
        actorUserId: adminUser.userId,
        actorRole: adminUser.role,
        eventType: "other",
        entityType: "partner_integration",
        entityId: integration.id,
        payload: {
          action: "admin_preview_sync",
          integration_id: integration.id,
          provider: integration.provider,
          resource,
          status,
          step,
          diagnostics,
        },
        ip: extractClientIpFromHeaders(req.headers),
        userAgent: req.headers.get("user-agent"),
      });
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

    await patchIntegrationSettings(admin, integration, resource, {
      last_preview_trace_id: traceId,
      last_preview_resource: resource,
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
      last_preview_payload: null,
      last_preview_log: appendIntegrationLog(readPreviewRuntime(asObject(integration.settings), resource).last_preview_log, {
        at: new Date(startedAtMs).toISOString(),
        step: "started",
        status: "running",
        message: `${formatPreviewResourceLabel(resource)}-Abruf-Test gestartet.`,
      }),
    });

    if (String(integration.kind ?? "").toLowerCase() !== "crm") {
      return NextResponse.json({ error: "Nur CRM-Anbindungen können geprüft werden." }, { status: 400 });
    }

    await patchIntegrationSettings(admin, integration, resource, {
      last_preview_step: "integration_loaded",
      last_preview_log: appendIntegrationLog(readPreviewRuntime(asObject(integration.settings), resource).last_preview_log, {
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
      await patchIntegrationSettings(admin, integration, resource, {
        last_preview_step: "provider_request_started",
        last_preview_request_count: 0,
        last_preview_pages_fetched: 0,
        last_preview_log: appendIntegrationLog(readPreviewRuntime(asObject(integration.settings), resource).last_preview_log, {
          at: new Date().toISOString(),
          step: "provider_request_started",
          status: "running",
          message: `${formatPreviewResourceLabel(resource)}-Preview startet mit guardiertem Ressourcenlauf.`,
        }),
      });
    }

    if (isPropstack) {
      try {
        const result = await withTimeout(
          syncIntegrationResources(integration, { resource, mode: "guarded" }),
          PREVIEW_MAX_RUNTIME_MS,
          `CRM-Abrufbudget überschritten (max. ${PREVIEW_MAX_RUNTIME_MS}ms).`,
        );
        requestCount = result.diagnostics?.provider_request_count ?? 0;
        pagesFetched = result.diagnostics?.provider_pages_fetched ?? 0;
        const previewPayload = buildPreviewPayload(integration, resource, traceId, result);
        await patchIntegrationSettings(admin, integration, resource, {
          last_preview_step: "provider_request_finished",
          last_preview_request_count: requestCount,
          last_preview_pages_fetched: pagesFetched,
          last_preview_payload: previewPayload,
          last_preview_log: appendIntegrationLog(readPreviewRuntime(asObject(integration.settings), resource).last_preview_log, {
            at: new Date().toISOString(),
            step: "provider_request_finished",
            status: "ok",
            message: `Propstack-Preview erfolgreich geladen (${result.offers.length} Angebote, ${result.references.length} Referenzen, ${result.requests.length} Gesuche).`,
          }),
        });

        return finish(
          "ok",
          `CRM-Abruf erfolgreich (${result.offers.length} Angebote, ${result.references.length} Referenzen, ${result.requests.length} Gesuche).`,
          "completed",
          {
            skipped: false,
            provider: integration.provider,
            diagnostic_mode: "propstack_guarded_sync",
            notes: result.notes ?? [],
            provider_breakdown: result.diagnostics?.provider_breakdown ?? null,
            guarded_limits: result.diagnostics?.guarded_limits ?? null,
            ...buildResourcePreview(resource, result),
          },
          200,
          {
            stopped_due_to_budget: false,
            provider_http_status: 200,
            max_requests: Math.max(requestCount, PREVIEW_MAX_REQUESTS),
            max_pages: Math.max(pagesFetched, PREVIEW_MAX_PAGES),
            per_page: result.diagnostics?.guarded_limits?.units?.per_page ?? PREVIEW_PER_PAGE,
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

    await patchIntegrationSettings(admin, integration, resource, {
      last_preview_step: "provider_request_started",
      last_preview_request_count: PREVIEW_MAX_REQUESTS,
      last_preview_pages_fetched: PREVIEW_MAX_PAGES,
      last_preview_log: appendIntegrationLog(readPreviewRuntime(asObject(integration.settings), resource).last_preview_log, {
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
        syncIntegrationResources(integration, { resource, mode: "guarded" }),
        PREVIEW_MAX_RUNTIME_MS,
        `CRM-Abrufbudget überschritten (max. ${PREVIEW_MAX_RUNTIME_MS}ms).`,
      );
      const previewPayload = buildPreviewPayload(integration, resource, traceId, result);
      if (String(integration.provider ?? "").toLowerCase() === "onoffice") {
        await patchIntegrationSettings(admin, integration, resource, {
          last_preview_debug: buildOnOfficePreviewDebug(integration, resource, result),
          last_preview_payload: previewPayload,
        });
      } else {
        await patchIntegrationSettings(admin, integration, resource, {
          last_preview_payload: previewPayload,
        });
      }
      return finish(
        "ok",
        `CRM-Abruf erfolgreich (${result.offers.length} Angebote).`,
        "completed",
        {
          skipped: false,
          provider: integration.provider,
          notes: result.notes ?? [],
          debug:
            String(integration.provider ?? "").toLowerCase() === "onoffice"
              ? buildOnOfficePreviewDebug(integration, resource, result)
              : null,
          ...buildResourcePreview(resource, result),
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
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
