import { NextResponse } from "next/server";
import { checkRateLimitPersistent, extractClientIpFromHeaders } from "@/lib/security/rate-limit";
import {
  normalizePartnerInviteRequestEmail,
  notifyAdminAboutPartnerInviteRequest,
} from "@/lib/auth/partner-invite-request";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { email?: string };
    const email = normalizePartnerInviteRequestEmail(body.email);

    if (!email) {
      return NextResponse.json({ ok: false, error: "EMAIL_REQUIRED" }, { status: 400 });
    }

    const ip = extractClientIpFromHeaders(req.headers);
    const limit = await checkRateLimitPersistent(`auth_access_link_legacy:partner:${ip}:${email}`, {
      windowMs: 15 * 60 * 1000,
      max: 5,
    });
    if (!limit.allowed) {
      return NextResponse.json(
        { ok: false, error: "RATE_LIMIT", retry_after_sec: limit.retryAfterSec },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
      );
    }

    await notifyAdminAboutPartnerInviteRequest({
      email,
      headers: req.headers,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
