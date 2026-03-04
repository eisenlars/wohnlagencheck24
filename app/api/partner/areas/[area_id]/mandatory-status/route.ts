import { NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { checkRateLimitPersistent, extractClientIpFromHeaders } from "@/lib/security/rate-limit";
import { checkPartnerAreaMandatoryTexts } from "@/lib/partner-area-mandatory";
import { INDIVIDUAL_MANDATORY_KEYS } from "@/lib/text-key-registry";
import { MANDATORY_MEDIA_KEYS } from "@/lib/mandatory-media";

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
    `partner_mandatory_status:${user.id}:${ip}`,
    { windowMs: 60 * 1000, max: 600 },
  );
  if (!limit.allowed) {
    throw new Error(`RATE_LIMIT:${limit.retryAfterSec}`);
  }
  return user.id;
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ area_id: string }> },
) {
  try {
    const userId = await requirePartnerUser(req);
    const params = await ctx.params;
    const areaId = String(params.area_id ?? "").trim();
    if (!areaId) {
      return NextResponse.json({ error: "Missing area id" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: mapping, error: mappingError } = await admin
      .from("partner_area_map")
      .select("id")
      .eq("auth_user_id", userId)
      .eq("area_id", areaId)
      .maybeSingle();

    if (mappingError) {
      return NextResponse.json({ error: mappingError.message }, { status: 500 });
    }
    if (!mapping) {
      return NextResponse.json({ error: "Area assignment not found" }, { status: 404 });
    }

    const mandatoryCheck = await checkPartnerAreaMandatoryTexts({
      admin,
      partnerId: userId,
      areaId,
    });

    if (!mandatoryCheck.ok && mandatoryCheck.status !== 409) {
      return NextResponse.json(
        {
          ok: false,
          error: mandatoryCheck.error,
          scope: mandatoryCheck.scope,
          missing_keys: mandatoryCheck.missing ?? [],
          progress: {
            completed: 0,
            total: INDIVIDUAL_MANDATORY_KEYS.length + MANDATORY_MEDIA_KEYS.length,
            percent: 0,
          },
        },
        { status: mandatoryCheck.status },
      );
    }

    const total = INDIVIDUAL_MANDATORY_KEYS.length + MANDATORY_MEDIA_KEYS.length;
    const missing = mandatoryCheck.ok ? [] : (mandatoryCheck.missing ?? []);
    const missingUnique = new Set(missing.map((item) => item.key).filter(Boolean));
    const completed = Math.max(0, total - missingUnique.size);
    const percent = total > 0 ? Math.max(0, Math.min(100, Math.round((completed / total) * 100))) : 0;

    return NextResponse.json({
      ok: mandatoryCheck.ok,
      error: mandatoryCheck.ok ? null : mandatoryCheck.error,
      scope: mandatoryCheck.scope,
      missing_keys: missing,
      progress: {
        completed,
        total,
        percent,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
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
