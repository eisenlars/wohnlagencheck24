import { NextResponse } from "next/server";

import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import {
  buildMandatoryMediaStoragePath,
  getMandatoryMediaLabel,
  isMandatoryMediaKey,
  MANDATORY_MEDIA_SPECS,
} from "@/lib/mandatory-media";

const SUPABASE_PUBLIC_BASE_URL = process.env.SUPABASE_PUBLIC_BASE_URL ?? "";
const SUPABASE_BUCKET = "immobilienmarkt";
const MAX_RAW_FILE_BYTES = 6 * 1024 * 1024;

function buildPublicStorageUrl(relPath: string): string | null {
  if (!SUPABASE_PUBLIC_BASE_URL) return null;
  const base = SUPABASE_PUBLIC_BASE_URL.replace(/\/+$/, "");
  const rel = relPath.replace(/^\/+/, "");
  return `${base}/${SUPABASE_BUCKET}/${rel}`;
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ area_id: string }> },
) {
  try {
    const params = await ctx.params;
    const areaId = String(params.area_id ?? "").trim();
    if (!areaId) return NextResponse.json({ error: "Missing area id" }, { status: 400 });

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminClient();
    const { data: assignment, error: assignmentError } = await admin
      .from("partner_area_map")
      .select("id")
      .eq("auth_user_id", user.id)
      .eq("area_id", areaId)
      .maybeSingle();
    if (assignmentError) {
      return NextResponse.json({ error: assignmentError.message }, { status: 500 });
    }
    if (!assignment) {
      return NextResponse.json({ error: "Area assignment not found" }, { status: 404 });
    }

    const formData = await req.formData();
    const assetKey = String(formData.get("asset_key") ?? "").trim();
    if (!isMandatoryMediaKey(assetKey)) {
      return NextResponse.json({ error: "Invalid asset_key" }, { status: 400 });
    }
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
          error: `Ungültiges Format. Bitte als WebP hochladen (${getMandatoryMediaLabel(assetKey)}).`,
        },
        { status: 422 },
      );
    }

    const spec = MANDATORY_MEDIA_SPECS[assetKey];
    if (file.size > spec.maxUploadBytes) {
      return NextResponse.json(
        { error: `Datei zu groß. Maximal ${Math.round(spec.maxUploadBytes / 1024)} KB nach Konvertierung.` },
        { status: 413 },
      );
    }

    const storagePath = buildMandatoryMediaStoragePath({
      partnerId: user.id,
      areaId,
      key: assetKey,
    });
    const uploadRes = await admin.storage.from(SUPABASE_BUCKET).upload(storagePath, file, {
      upsert: true,
      contentType: "image/webp",
      cacheControl: "3600",
    });
    if (uploadRes.error) {
      return NextResponse.json({ error: uploadRes.error.message }, { status: 500 });
    }

    const publicUrl = buildPublicStorageUrl(storagePath);
    if (!publicUrl) {
      return NextResponse.json({ error: "SUPABASE_PUBLIC_BASE_URL fehlt" }, { status: 500 });
    }

    const { error: upsertError } = await admin
      .from("report_texts")
      .upsert(
        {
          partner_id: user.id,
          area_id: areaId,
          section_key: assetKey,
          text_type: "individual",
          raw_content: "",
          optimized_content: publicUrl,
          status: "draft",
          last_updated: new Date().toISOString(),
        },
        { onConflict: "partner_id,area_id,section_key" },
      );
    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      asset_key: assetKey,
      label: getMandatoryMediaLabel(assetKey),
      url: publicUrl,
      status: "draft",
      max: { width: spec.maxWidth, height: spec.maxHeight, bytes: spec.maxUploadBytes },
    });
  } catch {
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
