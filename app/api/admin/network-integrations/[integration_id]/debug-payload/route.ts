import { NextResponse } from "next/server";

import { createAdminClient } from "@/utils/supabase/admin";
import { normalizeCrmSyncSelection } from "@/lib/integrations/settings";
import type { CrmSyncResource } from "@/lib/providers/types";
import { requireAdmin } from "@/lib/security/admin-auth";
import { checkAdminApiRateLimit } from "@/lib/security/rate-limit";

type ScopedSyncResource = Exclude<CrmSyncResource, "all"> | "all";

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readScopedRuntime(
  settings: Record<string, unknown>,
  scopeKey: "preview_resources" | "sync_resources",
  resource: ScopedSyncResource,
): Record<string, unknown> {
  if (resource === "all") return settings;
  return asObject(asObject(settings[scopeKey])[resource]);
}

function buildFilename(
  provider: string,
  resource: ScopedSyncResource,
  kind: "preview" | "sync",
  generatedAt: string,
) {
  const normalizedProvider = asText(provider).toLowerCase() || "crm";
  const normalizedResource = resource === "all" ? "all" : resource;
  const normalizedGeneratedAt = (asText(generatedAt) || new Date().toISOString()).replace(/[:.]/g, "-");
  return `${normalizedProvider}-${normalizedResource}-network-${kind}-payload-${normalizedGeneratedAt}.json`;
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ integration_id: string }> },
) {
  try {
    const adminUser = await requireAdmin(["admin_super", "admin_ops", "admin_billing"]);
    const adminRate = await checkAdminApiRateLimit(req, adminUser.userId);
    if (!adminRate.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(adminRate.retryAfterSec) } },
      );
    }

    const { searchParams } = new URL(req.url);
    const resource = normalizeCrmSyncSelection({ resource: searchParams.get("resource") }).resource;
    const kind: "preview" | "sync" = asText(searchParams.get("kind")) === "preview" ? "preview" : "sync";
    const params = await ctx.params;
    const integrationId = asText(params.integration_id);

    if (!integrationId) {
      return NextResponse.json({ error: "Missing integration id" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("network_partner_integrations")
      .select("id, kind, provider, settings")
      .eq("id", integrationId)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Integration not found" }, { status: 404 });
    if (String(data.kind ?? "").toLowerCase() !== "crm") {
      return NextResponse.json({ error: "Nur CRM-Anbindungen unterstützen Debug-Payloads." }, { status: 400 });
    }

    const settings = asObject(data.settings);
    const runtime = readScopedRuntime(settings, kind === "preview" ? "preview_resources" : "sync_resources", resource);
    const payload =
      kind === "preview"
        ? runtime.last_preview_payload ?? settings.last_preview_payload ?? null
        : runtime.sync_debug_payload ?? settings.sync_debug_payload ?? null;

    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return NextResponse.json({ error: "Kein Debug-Payload für den letzten Lauf vorhanden." }, { status: 404 });
    }

    const payloadRecord = payload as Record<string, unknown>;
    const filename = buildFilename(String(data.provider ?? ""), resource, kind, asText(payloadRecord.generated_at));

    return new NextResponse(JSON.stringify(payloadRecord, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename=\"${filename}\"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
