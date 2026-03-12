import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { checkRateLimitPersistent, extractClientIpFromHeaders } from "@/lib/security/rate-limit";
import { sendAdminInviteResendRequestEmail } from "@/lib/notifications/admin-review-email";
import { resolveAppBaseUrl, resolvePartnerInviteRedirectUrl } from "@/lib/auth/resolve-app-base-url";

function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
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

      if (aud === "partner") {
        const admin = createAdminClient();
        const { data: partner } = await admin
          .from("partners")
          .select("id, company_name, contact_email, is_active")
          .eq("contact_email", email)
          .maybeSingle();

        const partnerId = String((partner as { id?: string } | null)?.id ?? "").trim();
        const partnerIsActive = Boolean((partner as { is_active?: boolean } | null)?.is_active);

        if (partnerId) {
          const { data: authUserRes, error: authUserError } = await admin.auth.admin.getUserById(partnerId);
          if (authUserError || !authUserRes.user) {
            throw authUserError ?? new Error("Auth user not found");
          }
          if (!partnerIsActive) {
            const invite = await admin.auth.admin.inviteUserByEmail(email, {
              redirectTo: resolvePartnerInviteRedirectUrl(req.headers),
              data: {
                role: "partner",
                company_name: String((partner as { company_name?: string | null } | null)?.company_name ?? "").trim(),
                activation_pending: true,
              },
            });
            if (invite.error) throw invite.error;
          } else {
            const reset = await supabase.auth.resetPasswordForEmail(email, {
              redirectTo: `${baseUrl}/auth/setup?aud=partner`,
            });
            if (reset.error) throw reset.error;
          }
        } else {
          const reset = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${baseUrl}/auth/setup?aud=partner`,
          });
          if (reset.error) throw reset.error;
        }
      } else {
        const reset = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${baseUrl}/auth/setup?aud=admin`,
        });
        if (reset.error) throw reset.error;
      }
    } catch {
      try {
        await sendAdminInviteResendRequestEmail({
          email,
          audience: aud,
          requestedAtIso: new Date().toISOString(),
        });
      } catch {
        // Kein Detailfehler nach außen; der Endpoint bleibt absichtlich best-effort.
      }
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
