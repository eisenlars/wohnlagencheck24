import { NextResponse } from "next/server";
import { checkRateLimitPersistent, extractClientIpFromHeaders } from "@/lib/security/rate-limit";
import {
  normalizePartnerInviteRequestEmail,
  notifyAdminAboutPartnerInviteRequest,
} from "@/lib/auth/partner-invite-request";
import { notifyPortalPartnerAboutNetworkPartnerInviteRequest } from "@/lib/auth/network-partner-invite-request";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { email?: string; aud?: string };
    const email = normalizePartnerInviteRequestEmail(body.email);
    const audience = String(body.aud ?? "").trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ ok: false, error: "EMAIL_REQUIRED" }, { status: 400 });
    }

    const ip = extractClientIpFromHeaders(req.headers);
    const limit = await checkRateLimitPersistent(`auth_access_link_legacy:${audience || "partner"}:${ip}:${email}`, {
      windowMs: 15 * 60 * 1000,
      max: 5,
    });
    if (!limit.allowed) {
      return NextResponse.json(
        { ok: false, error: "RATE_LIMIT", retry_after_sec: limit.retryAfterSec },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
      );
    }

    if (audience === "network_partner") {
      await notifyPortalPartnerAboutNetworkPartnerInviteRequest({
        email,
        headers: req.headers,
      });
    } else {
      await notifyAdminAboutPartnerInviteRequest({
        email,
        headers: req.headers,
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
