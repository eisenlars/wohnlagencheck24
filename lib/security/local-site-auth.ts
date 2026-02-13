import { createHash } from "crypto";

type IntegrationRow = {
  partner_id?: string | null;
  auth_config?: Record<string, unknown> | null;
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
  supabase: {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: unknown) => unknown;
      };
    };
  },
  token: string,
): Promise<{ partner_id: string } | null> {
  const trimmed = String(token ?? "").trim();
  if (!trimmed) return null;

  const tokenHash = hashToken(trimmed);

  const hashedRes = await (supabase as any)
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
  const plainRes = await (supabase as any)
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
