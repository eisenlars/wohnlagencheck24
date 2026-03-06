import { NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { checkRateLimitPersistent, extractClientIpFromHeaders } from "@/lib/security/rate-limit";
import { maskIntegrationForResponse } from "@/lib/security/integration-mask";
import { validateIntegrationConfig } from "@/lib/integrations/providers";

type IntegrationBody = {
  integration_id?: string;
  kind?: string;
  provider?: string;
  base_url?: string | null;
  auth_type?: string | null;
  detail_url_template?: string | null;
  is_active?: boolean;
  settings?: Record<string, unknown> | null;
};

const ALLOWED_KINDS = new Set(["crm", "llm", "local_site", "other"]);
const ON_CONFLICT_MISSING_CONSTRAINT_RE = /no unique or exclusion constraint matching the ON CONFLICT specification/i;

function norm(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const v = String(value).trim();
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

function isMissingOnConflictConstraint(error: { message?: string; code?: string } | null | undefined) {
  if (!error) return false;
  if (String(error.code ?? "") === "42P10") return true;
  return ON_CONFLICT_MISSING_CONSTRAINT_RE.test(String(error.message ?? ""));
}

function normalizeSettings(kind: string, settings: Record<string, unknown> | null | undefined) {
  if (!settings || typeof settings !== "object") return null;
  if (kind !== "llm") return settings;

  const model = norm(settings.model) ?? norm(settings.model_name);
  const baseUrl = norm(settings.base_url);
  const temperature = asFiniteNumber(settings.temperature);
  const maxTokens = asFiniteNumber(settings.max_tokens);

  if (!model) {
    return { error: "Für LLM-Integrationen ist settings.model erforderlich." } as const;
  }

  const out: Record<string, unknown> = { model };
  if (baseUrl) out.base_url = baseUrl;
  if (temperature !== null) out.temperature = temperature;
  if (maxTokens !== null) out.max_tokens = Math.max(1, Math.floor(maxTokens));
  return out;
}

async function requirePartnerUser(req: Request): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) throw new Error("UNAUTHORIZED");

  const ip = extractClientIpFromHeaders(req.headers);
  const limit = await checkRateLimitPersistent(
    `partner_integrations:${user.id}:${ip}`,
    { windowMs: 60 * 1000, max: 60 },
  );
  if (!limit.allowed) throw new Error(`RATE_LIMIT:${limit.retryAfterSec}`);
  return user.id;
}

export async function GET(req: Request) {
  try {
    const userId = await requirePartnerUser(req);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("partner_integrations")
      .select("id, partner_id, kind, provider, base_url, auth_type, auth_config, detail_url_template, is_active, settings, last_sync_at")
      .eq("partner_id", userId)
      .order("kind", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({
      ok: true,
      integrations: (data ?? []).map((row) => maskIntegrationForResponse(row as Record<string, unknown>)),
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

export async function POST(req: Request) {
  try {
    const userId = await requirePartnerUser(req);
    const body = (await req.json()) as IntegrationBody;
    const kind = norm(body.kind)?.toLowerCase() ?? null;
    const provider = norm(body.provider);
    if (!kind || !provider) {
      return NextResponse.json({ error: "Missing required fields: kind, provider" }, { status: 400 });
    }
    if (!ALLOWED_KINDS.has(kind)) {
      return NextResponse.json({ error: "Invalid integration kind" }, { status: 400 });
    }

    const admin = createAdminClient();
    const validation = validateIntegrationConfig({
      kind,
      provider,
      authType: body.auth_type,
      baseUrl: body.base_url,
    });
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const normalizedSettings = normalizeSettings(kind, body.settings ?? null);
    if (normalizedSettings && "error" in normalizedSettings) {
      return NextResponse.json({ error: normalizedSettings.error }, { status: 400 });
    }

    const payload = {
      partner_id: userId,
      kind,
      provider: validation.provider,
      base_url: validation.baseUrl,
      auth_type: validation.authType,
      detail_url_template: norm(body.detail_url_template),
      is_active: body.is_active === false ? false : true,
      settings: normalizedSettings,
    };
    const integrationId = norm(body.integration_id);
    let data: Record<string, unknown> | null = null;
    let error: { message: string } | null = null;

    if (kind === "llm") {
      if (integrationId) {
        const result = await admin
          .from("partner_integrations")
          .update(payload)
          .eq("id", integrationId)
          .eq("partner_id", userId)
          .select("id, partner_id, kind, provider, base_url, auth_type, auth_config, detail_url_template, is_active, settings, last_sync_at")
          .maybeSingle();
        data = (result.data as Record<string, unknown> | null) ?? null;
        error = result.error ? { message: result.error.message } : null;
      } else {
        const result = await admin
          .from("partner_integrations")
          .insert(payload)
          .select("id, partner_id, kind, provider, base_url, auth_type, auth_config, detail_url_template, is_active, settings, last_sync_at")
          .single();
        data = (result.data as Record<string, unknown> | null) ?? null;
        error = result.error ? { message: result.error.message } : null;
      }
    } else {
      const upsertResult = await admin
        .from("partner_integrations")
        .upsert(payload, { onConflict: "partner_id,kind" })
        .select("id, partner_id, kind, provider, base_url, auth_type, auth_config, detail_url_template, is_active, settings, last_sync_at")
        .single();

      if (!upsertResult.error) {
        data = (upsertResult.data as Record<string, unknown> | null) ?? null;
      } else if (isMissingOnConflictConstraint(upsertResult.error)) {
        // Defensive fallback for environments missing the partial unique index.
        const existing = await admin
          .from("partner_integrations")
          .select("id")
          .eq("partner_id", userId)
          .eq("kind", kind)
          .maybeSingle();
        if (existing.error) {
          error = { message: existing.error.message };
        } else if (existing.data?.id) {
          const updateResult = await admin
            .from("partner_integrations")
            .update(payload)
            .eq("id", existing.data.id)
            .eq("partner_id", userId)
            .select("id, partner_id, kind, provider, base_url, auth_type, auth_config, detail_url_template, is_active, settings, last_sync_at")
            .single();
          data = (updateResult.data as Record<string, unknown> | null) ?? null;
          error = updateResult.error ? { message: updateResult.error.message } : null;
        } else {
          const insertResult = await admin
            .from("partner_integrations")
            .insert(payload)
            .select("id, partner_id, kind, provider, base_url, auth_type, auth_config, detail_url_template, is_active, settings, last_sync_at")
            .single();
          data = (insertResult.data as Record<string, unknown> | null) ?? null;
          error = insertResult.error ? { message: insertResult.error.message } : null;
        }
      } else {
        error = { message: upsertResult.error.message };
      }
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Integration konnte nicht gespeichert werden." }, { status: 500 });

    return NextResponse.json({
      ok: true,
      integration: maskIntegrationForResponse(data),
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
