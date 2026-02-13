import { createHash } from "crypto";

type IntegrationLookupRow = {
  partner_id?: string | null;
};

type IntegrationLookupResponse = {
  data?: IntegrationLookupRow | null;
  error?: { message?: string } | null;
};

type IntegrationLookupQuery = {
  eq: (column: string, value: unknown) => IntegrationLookupQuery;
  contains: (column: string, value: Record<string, unknown>) => IntegrationLookupQuery;
  maybeSingle: () => Promise<IntegrationLookupResponse>;
};

export type LocalSiteIntegrationLookupClient = {
  from: (table: string) => {
    select: (columns: string) => IntegrationLookupQuery;
  };
};

export function extractLocalSiteToken(req: Request): string {
  const authHeader = req.headers.get("authorization") ?? "";
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }
  return "";
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function loadLocalSiteIntegrationByToken(
  supabase: LocalSiteIntegrationLookupClient,
  token: string,
): Promise<{ partner_id: string } | null> {
  const trimmed = String(token ?? "").trim();
  if (!trimmed) return null;

  const tokenHash = hashToken(trimmed);

  const hashedRes = await supabase
    .from("partner_integrations")
    .select("partner_id, auth_config")
    .eq("kind", "local_site")
    .eq("is_active", true)
    .contains("auth_config", { token_hash: tokenHash })
    .maybeSingle();

  if (!hashedRes?.error && hashedRes?.data?.partner_id) {
    return { partner_id: String(hashedRes.data.partner_id) };
  }

  // Legacy fallback: plaintext token in auth_config.token
  const plainRes = await supabase
    .from("partner_integrations")
    .select("partner_id, auth_config")
    .eq("kind", "local_site")
    .eq("is_active", true)
    .contains("auth_config", { token: trimmed })
    .maybeSingle();

  if (!plainRes?.error && plainRes?.data?.partner_id) {
    return { partner_id: String(plainRes.data.partner_id) };
  }

  return null;
}

export function buildLocalSiteTokenHash(token: string): string {
  return hashToken(token);
}
