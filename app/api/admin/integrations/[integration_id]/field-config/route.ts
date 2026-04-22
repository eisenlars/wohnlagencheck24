import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/security/admin-auth";
import { checkAdminApiRateLimit } from "@/lib/security/rate-limit";
import { fetchOnOfficeEstateFieldDiagnostics } from "@/lib/providers/onoffice";
import type { PartnerIntegration } from "@/lib/providers/types";
import { validateOutboundUrl } from "@/lib/security/outbound-url";
import { readSecretFromAuthConfig } from "@/lib/security/secret-crypto";
import { createAdminClient } from "@/utils/supabase/admin";

export async function GET(
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
      .select("id, partner_id, kind, provider, base_url, auth_config, is_active, settings")
      .eq("id", integrationId)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Integration not found" }, { status: 404 });

    const kind = String(data.kind ?? "").trim().toLowerCase();
    const provider = String(data.provider ?? "").trim().toLowerCase();
    if (kind !== "crm" || provider !== "onoffice") {
      return NextResponse.json({ error: "Field config only available for onOffice CRM integrations" }, { status: 400 });
    }

    const auth = (data.auth_config ?? {}) as Record<string, unknown>;
    const token = readSecretFromAuthConfig(auth, "token");
    const secret = readSecretFromAuthConfig(auth, "secret");
    if (!token || !secret) {
      return NextResponse.json({ error: "onOffice token/secret fehlt" }, { status: 400 });
    }

    const baseUrl = String(data.base_url ?? "").trim();
    if (!baseUrl) {
      return NextResponse.json({ error: "Base URL fehlt" }, { status: 400 });
    }
    const outboundCheck = await validateOutboundUrl(baseUrl);
    if (!outboundCheck.ok) {
      return NextResponse.json({ error: `Base URL blockiert (${outboundCheck.reason})` }, { status: 400 });
    }

    const integration: PartnerIntegration = {
      id: String(data.id),
      partner_id: String(data.partner_id),
      kind: "crm",
      provider: "onoffice",
      base_url: outboundCheck.url,
      auth_type: null,
      auth_config: auth,
      detail_url_template: null,
      is_active: Boolean(data.is_active),
      settings: (data.settings ?? null) as Record<string, unknown> | null,
    };

    const estateFieldDiagnostics = await fetchOnOfficeEstateFieldDiagnostics(integration, token, secret);
    const estateStatusConfig = estateFieldDiagnostics.status;
    const estateMarketingFieldConfig = estateFieldDiagnostics.marketing;

    return NextResponse.json({
      ok: true,
      estate_status_field_key: estateStatusConfig.field_key,
      estate_status_field_label: estateStatusConfig.field_label,
      estate_status_options: estateStatusConfig.options,
      has_reference_status_candidates: estateStatusConfig.has_reference_status_candidates,
      estate_marketing_field_targets: estateMarketingFieldConfig.target_terms,
      estate_marketing_field_candidates: estateMarketingFieldConfig.candidates,
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
