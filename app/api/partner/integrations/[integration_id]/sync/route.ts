import { NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/server";
import { checkRateLimitPersistent, extractClientIpFromHeaders } from "@/lib/security/rate-limit";

async function requirePartnerUser(req: Request, mode: "status" | "start" | "cancel"): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) throw new Error("UNAUTHORIZED");

  const ip = extractClientIpFromHeaders(req.headers);
  const max = mode === "status" ? 60 : mode === "cancel" ? 20 : 10;
  const limit = await checkRateLimitPersistent(
    `partner_integration_sync:${mode}:${user.id}:${ip}`,
    { windowMs: 60 * 1000, max },
  );
  if (!limit.allowed) throw new Error(`RATE_LIMIT:${limit.retryAfterSec}`);
}

function adminOnlyResponse() {
  return NextResponse.json(
    { error: "CRM-Synchronisierungen sind nur im Admin-Bereich verfügbar." },
    { status: 403 },
  );
}

export async function GET(req: Request) {
  try {
    await requirePartnerUser(req, "status");
    return adminOnlyResponse();
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

export async function POST(req: Request) {
  try {
    await requirePartnerUser(req, "start");
    return adminOnlyResponse();
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

export async function DELETE(req: Request) {
  try {
    await requirePartnerUser(req, "cancel");
    return adminOnlyResponse();
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
