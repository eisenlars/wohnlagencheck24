import { NextResponse } from "next/server";

import { createAdminClient } from "@/utils/supabase/admin";
import { applyDataDrivenTexts } from "@/lib/text-core";

export const runtime = "nodejs";

const SUPABASE_PUBLIC_BASE_URL = process.env.SUPABASE_PUBLIC_BASE_URL ?? "";
const SUPABASE_BUCKET = "immobilienmarkt";

type ZipEntry = {
  name: string;
  data: Buffer;
};

let crcTable: number[] | null = null;

function getCrcTable() {
  if (crcTable) return crcTable;
  const table: number[] = [];
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  crcTable = table;
  return table;
}

function crc32(buf: Buffer): number {
  const table = getCrcTable();
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i += 1) {
    c = table[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function buildZip(entries: ZipEntry[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  entries.forEach((entry) => {
    const nameBuf = Buffer.from(entry.name);
    const dataBuf = entry.data;
    const crc = crc32(dataBuf);
    const localHeader = Buffer.alloc(30 + nameBuf.length);
    let p = 0;
    localHeader.writeUInt32LE(0x04034b50, p); p += 4;
    localHeader.writeUInt16LE(20, p); p += 2;
    localHeader.writeUInt16LE(0, p); p += 2;
    localHeader.writeUInt16LE(0, p); p += 2;
    localHeader.writeUInt16LE(0, p); p += 2;
    localHeader.writeUInt16LE(0, p); p += 2;
    localHeader.writeUInt32LE(crc, p); p += 4;
    localHeader.writeUInt32LE(dataBuf.length, p); p += 4;
    localHeader.writeUInt32LE(dataBuf.length, p); p += 4;
    localHeader.writeUInt16LE(nameBuf.length, p); p += 2;
    localHeader.writeUInt16LE(0, p); p += 2;
    nameBuf.copy(localHeader, p);

    localParts.push(localHeader, dataBuf);

    const centralHeader = Buffer.alloc(46 + nameBuf.length);
    p = 0;
    centralHeader.writeUInt32LE(0x02014b50, p); p += 4;
    centralHeader.writeUInt16LE(20, p); p += 2;
    centralHeader.writeUInt16LE(20, p); p += 2;
    centralHeader.writeUInt16LE(0, p); p += 2;
    centralHeader.writeUInt16LE(0, p); p += 2;
    centralHeader.writeUInt16LE(0, p); p += 2;
    centralHeader.writeUInt16LE(0, p); p += 2;
    centralHeader.writeUInt32LE(crc, p); p += 4;
    centralHeader.writeUInt32LE(dataBuf.length, p); p += 4;
    centralHeader.writeUInt32LE(dataBuf.length, p); p += 4;
    centralHeader.writeUInt16LE(nameBuf.length, p); p += 2;
    centralHeader.writeUInt16LE(0, p); p += 2;
    centralHeader.writeUInt16LE(0, p); p += 2;
    centralHeader.writeUInt16LE(0, p); p += 2;
    centralHeader.writeUInt16LE(0, p); p += 2;
    centralHeader.writeUInt32LE(0, p); p += 4;
    centralHeader.writeUInt32LE(offset, p); p += 4;
    nameBuf.copy(centralHeader, p);
    centralParts.push(centralHeader);

    offset += localHeader.length + dataBuf.length;
  });

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const centralOffset = offset;
  const end = Buffer.alloc(22);
  let p = 0;
  end.writeUInt32LE(0x06054b50, p); p += 4;
  end.writeUInt16LE(0, p); p += 2;
  end.writeUInt16LE(0, p); p += 2;
  end.writeUInt16LE(entries.length, p); p += 2;
  end.writeUInt16LE(entries.length, p); p += 2;
  end.writeUInt32LE(centralSize, p); p += 4;
  end.writeUInt32LE(centralOffset, p); p += 4;
  end.writeUInt16LE(0, p);

  return Buffer.concat([...localParts, ...centralParts, end]);
}

function buildSupabaseReportUrl(pathParts: string[]): string | null {
  if (!SUPABASE_PUBLIC_BASE_URL) return null;
  const base = SUPABASE_PUBLIC_BASE_URL.replace(/\/+$/, "");
  const rel = pathParts
    .map((part) => part.replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/");
  return `${base}/${SUPABASE_BUCKET}/${rel}`;
}

function stripGroups(
  baseTexts: Record<string, Record<string, string>>,
  groupsToRemove: string[],
) {
  const cleaned: Record<string, Record<string, string>> = {};
  Object.entries(baseTexts || {}).forEach(([groupKey, group]) => {
    if (groupsToRemove.includes(groupKey)) return;
    cleaned[groupKey] = group;
  });
  return cleaned;
}

type OverrideRow = {
  optimized_content?: string | null;
  status?: string | null;
};

type OverrideMap = Record<string, OverrideRow>;

function mergeTexts(
  baseTexts: Record<string, Record<string, string>>,
  overrides: OverrideMap,
) {
  const merged: Record<string, Record<string, string>> = {};
  Object.entries(baseTexts || {}).forEach(([groupKey, group]) => {
    merged[groupKey] = {};
    Object.entries(group || {}).forEach(([sectionKey, rawValue]) => {
      const override = overrides[sectionKey];
      const approved = override?.status === "approved";
      const value = approved && override?.optimized_content ? override.optimized_content : rawValue;
      merged[groupKey][sectionKey] = value;
    });
  });
  return merged;
}

async function fetchReportJson(pathParts: string[]) {
  const reportUrl = buildSupabaseReportUrl(pathParts);
  if (!reportUrl) return null;
  const res = await fetch(reportUrl);
  if (!res.ok) return null;
  return res.json();
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const bundesland = url.searchParams.get("bundesland") ?? "";
  const kreis = url.searchParams.get("kreis") ?? "";

  if (!token || !bundesland || !kreis) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: integration, error: integrationError } = await supabase
    .from("partner_integrations")
    .select("partner_id, auth_config")
    .eq("kind", "local_site")
    .eq("is_active", true)
    .contains("auth_config", { token })
    .maybeSingle();

  if (integrationError || !integration?.partner_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: kreisArea } = await supabase
    .from("areas")
    .select("id")
    .eq("bundesland_slug", bundesland)
    .eq("slug", kreis)
    .maybeSingle();

  const kreisAreaId = kreisArea?.id ?? null;
  if (!kreisAreaId) {
    return NextResponse.json({ error: "Area not found" }, { status: 404 });
  }

  const { data: orts } = await supabase
    .from("areas")
    .select("id, slug")
    .eq("bundesland_slug", bundesland)
    .eq("parent_slug", kreis);

  const entries: ZipEntry[] = [];
  const generatedAt = new Date().toISOString();

  const kreisReportJson = await fetchReportJson(["reports", "deutschland", bundesland, `${kreis}.json`]);
  if (kreisReportJson) {
    const reportJson = applyDataDrivenTexts(kreisReportJson, kreisAreaId);
    const baseTexts = stripGroups(
      (reportJson.text ?? {}) as Record<string, Record<string, string>>,
      ["berater", "makler"],
    );
    const { data: kreisOverrides } = await supabase
      .from("partner_local_site_texts")
      .select("section_key, optimized_content, status")
      .eq("partner_id", integration.partner_id)
      .eq("area_id", kreisAreaId);

    const overrideMap = (kreisOverrides ?? []).reduce<OverrideMap>((acc, row) => {
      acc[String(row.section_key)] = row;
      return acc;
    }, {});

    const mergedText = mergeTexts(baseTexts, overrideMap);
    const kreisPayload = {
      ...reportJson,
      text: mergedText,
      local_site: {
        partner_id: integration.partner_id,
        area_id: kreisAreaId,
        generated_at: generatedAt,
      },
    };
    entries.push({
      name: `${kreis}.json`,
      data: Buffer.from(JSON.stringify(kreisPayload)),
    });
  }

  for (const ort of orts ?? []) {
    const ortSlug = String(ort.slug ?? "");
    if (!ortSlug) continue;
    const reportJsonRaw = await fetchReportJson(["reports", "deutschland", bundesland, kreis, `${ortSlug}.json`]);
    if (!reportJsonRaw) continue;
    const reportJson = applyDataDrivenTexts(reportJsonRaw, ort.id);

    const baseTexts = stripGroups(
      (reportJson.text ?? {}) as Record<string, Record<string, string>>,
      ["berater", "makler"],
    );
    const { data: ortOverrides } = await supabase
      .from("partner_local_site_texts")
      .select("section_key, optimized_content, status")
      .eq("partner_id", integration.partner_id)
      .eq("area_id", ort.id);

    const overrideMap = (ortOverrides ?? []).reduce<OverrideMap>((acc, row) => {
      acc[String(row.section_key)] = row;
      return acc;
    }, {});

    const mergedText = mergeTexts(baseTexts, overrideMap);
    const payload = {
      ...reportJson,
      text: mergedText,
      local_site: {
        partner_id: integration.partner_id,
        area_id: ort.id,
        generated_at: generatedAt,
      },
    };

    entries.push({
      name: `ortslagen/${ortSlug}.json`,
      data: Buffer.from(JSON.stringify(payload)),
    });
  }

  const zip = buildZip(entries);
  return new NextResponse(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": "attachment; filename=\"local-site-package.zip\"",
    },
  });
}
