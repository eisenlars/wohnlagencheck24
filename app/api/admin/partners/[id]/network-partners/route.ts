import { NextResponse } from "next/server";

import { createAdminClient } from "@/utils/supabase/admin";
import { requireAdmin } from "@/lib/security/admin-auth";
import { checkAdminApiRateLimit } from "@/lib/security/rate-limit";
import { listNetworkPartnersByPortalPartner } from "@/lib/network-partners/repositories/network-partners";
import { maskIntegrationForResponse } from "@/lib/security/integration-mask";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function enrichStoredSecretFlags(row: Record<string, unknown>) {
  const auth = isRecord(row.auth_config) ? row.auth_config : {};
  const settings = isRecord(row.settings) ? row.settings : {};
  const trigger = isRecord(settings.trigger) ? settings.trigger : {};
  return {
    ...row,
    has_api_key: Boolean(String(auth.api_key ?? auth.api_key_encrypted ?? "").trim()),
    has_token: Boolean(String(auth.token ?? auth.token_encrypted ?? "").trim()),
    has_secret: Boolean(String(auth.secret ?? auth.secret_encrypted ?? "").trim()),
    has_trigger_token: Boolean(String(trigger.token ?? settings.webhook_token ?? "").trim()),
    has_trigger_secret: Boolean(
      String(auth.webhook_secret ?? auth.webhook_secret_encrypted ?? "").trim(),
    ),
  };
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
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

    const params = await ctx.params;
    const partnerId = String(params.id ?? "").trim();
    if (!partnerId) {
      return NextResponse.json({ error: "Missing partner id" }, { status: 400 });
    }

    const [networkPartners, integrationsResult] = await Promise.all([
      listNetworkPartnersByPortalPartner(partnerId),
      createAdminClient()
        .from("network_partner_integrations")
        .select(
          "id, portal_partner_id, network_partner_id, kind, provider, base_url, auth_type, auth_config, detail_url_template, is_active, settings, last_test_at, last_preview_sync_at, last_sync_at, created_at, updated_at",
        )
        .eq("portal_partner_id", partnerId)
        .order("network_partner_id", { ascending: true })
        .order("provider", { ascending: true }),
    ]);

    if (integrationsResult.error) {
      return NextResponse.json({ error: integrationsResult.error.message }, { status: 500 });
    }

    const integrationsByPartner = new Map<string, Record<string, unknown>[]>();
    for (const rawRow of Array.isArray(integrationsResult.data) ? integrationsResult.data : []) {
      if (!isRecord(rawRow)) continue;
      const networkPartnerId = String(rawRow.network_partner_id ?? "").trim();
      if (!networkPartnerId) continue;
      const current = integrationsByPartner.get(networkPartnerId) ?? [];
      current.push(maskIntegrationForResponse(enrichStoredSecretFlags(rawRow)));
      integrationsByPartner.set(networkPartnerId, current);
    }

    return NextResponse.json({
      ok: true,
      network_partners: networkPartners.map((partner) => ({
        ...partner,
        integrations: integrationsByPartner.get(partner.id) ?? [],
      })),
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
