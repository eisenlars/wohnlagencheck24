import { NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { checkRateLimitPersistent, extractClientIpFromHeaders } from "@/lib/security/rate-limit";

type ProfilePatchBody = {
  company_name?: string;
  contact_email?: string | null;
  contact_person?: string | null;
  website_url?: string | null;
};

function normNullable(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const v = String(value).trim();
  return v.length > 0 ? v : null;
}

async function requirePartnerUser(req: Request): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    throw new Error("UNAUTHORIZED");
  }

  const ip = extractClientIpFromHeaders(req.headers);
  const limit = await checkRateLimitPersistent(
    `partner_settings:${user.id}:${ip}`,
    { windowMs: 60 * 1000, max: 60 },
  );
  if (!limit.allowed) {
    throw new Error(`RATE_LIMIT:${limit.retryAfterSec}`);
  }
  return user.id;
}

export async function GET(req: Request) {
  try {
    const userId = await requirePartnerUser(req);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("partners")
      .select("id, company_name, contact_email, contact_person, website_url, created_at")
      .eq("id", userId)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Partner profile not found" }, { status: 404 });
    return NextResponse.json({ ok: true, profile: data });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message.startsWith("RATE_LIMIT:")) {
        const sec = Number(error.message.split(":")[1] ?? "60");
        return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(sec) } });
      }
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const userId = await requirePartnerUser(req);
    const body = (await req.json()) as ProfilePatchBody;
    const patch: Record<string, unknown> = {};
    if (body.company_name !== undefined) {
      const companyName = normNullable(body.company_name);
      if (!companyName) return NextResponse.json({ error: "company_name cannot be empty" }, { status: 400 });
      patch.company_name = companyName;
    }
    if (body.contact_email !== undefined) patch.contact_email = normNullable(body.contact_email);
    if (body.contact_person !== undefined) patch.contact_person = normNullable(body.contact_person);
    if (body.website_url !== undefined) patch.website_url = normNullable(body.website_url);

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No update fields provided" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("partners")
      .update(patch)
      .eq("id", userId)
      .select("id, company_name, contact_email, contact_person, website_url, created_at")
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Partner profile not found" }, { status: 404 });

    return NextResponse.json({ ok: true, profile: data });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message.startsWith("RATE_LIMIT:")) {
        const sec = Number(error.message.split(":")[1] ?? "60");
        return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(sec) } });
      }
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}

