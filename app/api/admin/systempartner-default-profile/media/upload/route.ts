import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/security/admin-auth";
import { checkAdminApiRateLimit } from "@/lib/security/rate-limit";
import {
  MANDATORY_MEDIA_SPECS,
  getMandatoryMediaLabel,
} from "@/lib/mandatory-media";
import {
  downloadSystempartnerDefaultProfile,
  uploadSystempartnerDefaultAvatar,
  uploadSystempartnerDefaultProfile,
} from "@/lib/systempartner-default-profile";
import { createAdminClient } from "@/utils/supabase/admin";

const MAX_RAW_FILE_BYTES = 6 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    const adminUser = await requireAdmin(["admin_super", "admin_ops"]);
    const limit = await checkAdminApiRateLimit(req, adminUser.userId);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }
    if (file.size <= 0 || file.size > MAX_RAW_FILE_BYTES) {
      return NextResponse.json({ error: "Datei zu groß" }, { status: 413 });
    }
    if (!String(file.type ?? "").toLowerCase().includes("webp")) {
      return NextResponse.json(
        {
          error: `Ungültiges Format. Bitte als WebP hochladen (${getMandatoryMediaLabel("media_berater_avatar")}).`,
        },
        { status: 422 },
      );
    }

    const spec = MANDATORY_MEDIA_SPECS.media_berater_avatar;
    if (file.size > spec.maxUploadBytes) {
      return NextResponse.json(
        { error: `Datei zu groß. Maximal ${Math.round(spec.maxUploadBytes / 1024)} KB nach Konvertierung.` },
        { status: 413 },
      );
    }

    const admin = createAdminClient();
    const current = await downloadSystempartnerDefaultProfile(admin);
    const url = await uploadSystempartnerDefaultAvatar(admin, file);
    const next = {
      ...current,
      media_berater_avatar: url,
    };
    await uploadSystempartnerDefaultProfile(admin, next);

    return NextResponse.json({
      ok: true,
      url,
      profile: next,
      max: { width: spec.maxWidth, height: spec.maxHeight, bytes: spec.maxUploadBytes },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
