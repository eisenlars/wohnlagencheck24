import { NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { checkRateLimitPersistent, extractClientIpFromHeaders } from "@/lib/security/rate-limit";
import { maskIntegrationForResponse } from "@/lib/security/integration-mask";
import { validateIntegrationConfig } from "@/lib/integrations/providers";

type IntegrationBody = {
  kind?: string;
  provider?: string;
  base_url?: string | null;
  auth_type?: string | null;
  detail_url_template?: string | null;
  is_active?: boolean;
  settings?: Record<string, unknown> | null;
};

const ALLOWED_KINDS = new Set(["crm", "llm", "local_site", "other"]);

function norm(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const v = String(value).trim();
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

    const payload = {
      partner_id: userId,
      kind,
      provider: validation.provider,
      base_url: validation.baseUrl,
      auth_type: validation.authType,
      detail_url_template: norm(body.detail_url_template),
      is_active: body.is_active === false ? false : true,
      settings: body.settings ?? null,
    };

    const { data, error } = await admin
      .from("partner_integrations")
      .upsert(payload, { onConflict: "partner_id,kind" })
      .select("id, partner_id, kind, provider, base_url, auth_type, auth_config, detail_url_template, is_active, settings, last_sync_at")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      ok: true,
      integration: maskIntegrationForResponse(data as Record<string, unknown>),
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
