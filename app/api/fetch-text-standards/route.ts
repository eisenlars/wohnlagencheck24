import { NextResponse } from "next/server";

const SUPABASE_PUBLIC_BASE_URL = process.env.SUPABASE_PUBLIC_BASE_URL ?? "";
const SUPABASE_BUCKET = "immobilienmarkt";
const STANDARD_PATH = ["text-standards", "kreis", "text_standard_kreis.json"] as const;

function buildSupabaseUrl(pathParts: readonly string[]): string | null {
  if (!SUPABASE_PUBLIC_BASE_URL) return null;
  const base = SUPABASE_PUBLIC_BASE_URL.replace(/\/+$/, "");
  const rel = pathParts
    .map((part) => part.replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/");
  return `${base}/${SUPABASE_BUCKET}/${rel}`;
}

type StandardPayload = {
  text?: Record<string, Record<string, string>>;
  kreisname?: { text?: Record<string, Record<string, string>> };
  ortslagenname?: { text?: Record<string, Record<string, string>> };
};

function asTextTree(value: unknown): Record<string, Record<string, string>> | null {
  if (!value || typeof value !== "object") return null;
  const out: Record<string, Record<string, string>> = {};
  for (const [groupKey, groupVal] of Object.entries(value as Record<string, unknown>)) {
    if (!groupVal || typeof groupVal !== "object") continue;
    const group: Record<string, string> = {};
    for (const [k, v] of Object.entries(groupVal as Record<string, unknown>)) {
      if (typeof v === "string") group[k] = v;
    }
    if (Object.keys(group).length > 0) out[groupKey] = group;
  }
  return Object.keys(out).length > 0 ? out : null;
}

export async function GET(req: Request) {
  const url = buildSupabaseUrl(STANDARD_PATH);
  if (!url) {
    return NextResponse.json({ error: "SUPABASE_PUBLIC_BASE_URL fehlt" }, { status: 500 });
  }

  try {
    const res = await fetch(url);
    if (!res.ok) {
      return NextResponse.json({ error: "Standarddatei nicht gefunden" }, { status: 404 });
    }

    const scopeParam = new URL(req.url).searchParams.get("scope");
    const scope = scopeParam === "ortslage" ? "ortslage" : "kreis";
    const payload = (await res.json()) as StandardPayload;
    const normalized = asTextTree(payload?.text);
    const text =
      normalized ??
      (scope === "ortslage"
        ? asTextTree(payload?.ortslagenname?.text) ?? asTextTree(payload?.kreisname?.text)
        : asTextTree(payload?.kreisname?.text) ?? asTextTree(payload?.ortslagenname?.text));
    if (!text) {
      return NextResponse.json({ error: "Ungültige Standardstruktur" }, { status: 422 });
    }

    return NextResponse.json({ text });
  } catch {
    return NextResponse.json({ error: "Standarddatei konnte nicht geladen werden" }, { status: 500 });
  }
}
