import { NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/server";
import { checkRateLimitPersistent, extractClientIpFromHeaders } from "@/lib/security/rate-limit";

async function requirePartnerUser(req: Request): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) throw new Error("UNAUTHORIZED");

  const ip = extractClientIpFromHeaders(req.headers);
  const limit = await checkRateLimitPersistent(
    `partner_integration_preview_sync:${user.id}:${ip}`,
    { windowMs: 60 * 1000, max: 10 },
  );
  if (!limit.allowed) throw new Error(`RATE_LIMIT:${limit.retryAfterSec}`);
}

export async function POST(req: Request) {
  try {
    await requirePartnerUser(req);
    return NextResponse.json(
      { error: "CRM-Abruf-Tests sind nur im Admin-Bereich verfügbar." },
      { status: 403 },
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message.startsWith("RATE_LIMIT:")) {
        const sec = Number(error.message.split(":")[1] ?? "60");
        return NextResponse.json(
          { error: "Too many requests" },
          { status: 429, headers: { "Retry-After": String(sec) } },
        );
      }
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
