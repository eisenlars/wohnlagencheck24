import { createAdminClient } from "@/utils/supabase/admin";
import type {
  NetworkContentMediaKind,
  NetworkContentMediaRecord,
} from "@/lib/network-partners/types";

function asText(value: unknown): string {
  return String(value ?? "").trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asRowArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord);
}

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function normalizeMediaKind(value: unknown): NetworkContentMediaKind {
  const kind = asText(value);
  if (kind === "logo" || kind === "hero" || kind === "document") return kind;
  return "gallery";
}

function mapMediaRow(row: Record<string, unknown>): NetworkContentMediaRecord {
  return {
    id: asText(row.id),
    content_item_id: asText(row.content_item_id),
    kind: normalizeMediaKind(row.kind),
    url: asText(row.url),
    sort_order: Math.max(0, Math.floor(asNumber(row.sort_order))),
    created_at: asText(row.created_at),
  };
}

function assertUrl(value: string) {
  const normalized = asText(value);
  if (!normalized) throw new Error("INVALID_MEDIA_URL");
  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("INVALID_MEDIA_URL");
    }
  } catch {
    throw new Error("INVALID_MEDIA_URL");
  }
}

export async function listMediaForContent(contentItemId: string): Promise<NetworkContentMediaRecord[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("network_content_media")
    .select("id, content_item_id, kind, url, sort_order, created_at")
    .eq("content_item_id", contentItemId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message ?? "NETWORK_CONTENT_MEDIA_LIST_FAILED");
  return asRowArray(data).map((row) => mapMediaRow(row));
}

export async function createMediaForContent(args: {
  contentItemId: string;
  kind: NetworkContentMediaKind;
  url: string;
  sort_order?: number | null;
}): Promise<NetworkContentMediaRecord> {
  assertUrl(args.url);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("network_content_media")
    .insert({
      content_item_id: args.contentItemId,
      kind: args.kind,
      url: asText(args.url),
      sort_order: Math.max(0, Math.floor(args.sort_order ?? 0)),
    })
    .select("id, content_item_id, kind, url, sort_order, created_at")
    .maybeSingle();

  if (error) throw new Error(error.message ?? "NETWORK_CONTENT_MEDIA_CREATE_FAILED");
  if (!isRecord(data)) throw new Error("NETWORK_CONTENT_MEDIA_CREATE_FAILED");
  return mapMediaRow(data);
}

export async function deleteMediaById(mediaId: string, contentItemId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("network_content_media")
    .delete()
    .eq("id", mediaId)
    .eq("content_item_id", contentItemId);

  if (error) throw new Error(error.message ?? "NETWORK_CONTENT_MEDIA_DELETE_FAILED");
}
