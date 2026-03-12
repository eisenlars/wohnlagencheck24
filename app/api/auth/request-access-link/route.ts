import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { checkRateLimitPersistent, extractClientIpFromHeaders } from "@/lib/security/rate-limit";
import { resolveAppBaseUrl } from "@/lib/auth/resolve-app-base-url";

function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function isPendingActivation(meta: Record<string, unknown> | null | undefined): boolean {
  const value = meta?.activation_pending;
  if (value === true) return true;
  return String(value ?? "").trim().toLowerCase() === "true";
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { email?: string; aud?: string };
    const email = normalizeEmail(body.email);
    const aud = String(body.aud ?? "partner").trim().toLowerCase() === "admin" ? "admin" : "partner";

    if (!email) {
      return NextResponse.json({ ok: false, error: "EMAIL_REQUIRED" }, { status: 400 });
    }

    const ip = extractClientIpFromHeaders(req.headers);
    const limit = await checkRateLimitPersistent(`auth_access_link:${aud}:${ip}:${email}`, {
      windowMs: 15 * 60 * 1000,
      max: 5,
    });
    if (!limit.allowed) {
      return NextResponse.json(
        { ok: false, error: "RATE_LIMIT", retry_after_sec: limit.retryAfterSec },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
      );
    }

    try {
      const baseUrl = resolveAppBaseUrl(req.headers);
      const supabase = createClient();
      const admin = createAdminClient();

      if (aud === "partner") {
        const { data: partner } = await admin
          .from("partners")
          .select("id, contact_email, is_active")
          .eq("contact_email", email)
          .maybeSingle();

        const isActive = Boolean((partner as { is_active?: boolean } | null)?.is_active);
        const partnerId = String((partner as { id?: string } | null)?.id ?? "").trim();
        if (!isActive && partnerId) {
          const { data: authUser } = await admin.auth.admin.getUserById(partnerId);
          const meta = (authUser.user?.user_metadata as Record<string, unknown> | undefined) ?? null;
          if (isPendingActivation(meta)) {
            const inviteRedirectTo = String(process.env.PARTNER_INVITE_REDIRECT_URL ?? "").trim()
              || `${baseUrl}/auth/setup?aud=partner`;
            await admin.auth.admin.inviteUserByEmail(email, {
              redirectTo: inviteRedirectTo,
              data: {
                role: "partner",
                company_name: String(meta?.company_name ?? ""),
                activation_pending: true,
              },
            });
          }
        }
      } else {
        const redirectTo = `${baseUrl}/auth/setup?aud=${aud}`;
        await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      }
    } catch {
      // Keine Detailfehler zurückgeben (User-Enumeration vermeiden).
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
