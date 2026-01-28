// app/api/fetch-json/route.ts

import { NextResponse } from 'next/server';
const SUPABASE_PUBLIC_BASE_URL = process.env.SUPABASE_PUBLIC_BASE_URL ?? "";
const SUPABASE_BUCKET = "immobilienmarkt";

function buildSupabaseReportUrl(pathParts: string[]): string | null {
  if (!SUPABASE_PUBLIC_BASE_URL) return null;
  const base = SUPABASE_PUBLIC_BASE_URL.replace(/\/+$/, "");
  const rel = pathParts
    .map((part) => part.replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/");
  return `${base}/${SUPABASE_BUCKET}/${rel}`;
}

export async function POST(req: Request) {
  try {
    const { bundesland, kreis, ortslage } = await req.json();

    // Pfad-Logik basierend auf deiner Struktur
    // immobilienmarkt/reports/deutschland/sachsen/leipzig.json
    // immobilienmarkt/reports/deutschland/sachsen/leipzig/eutritzsch.json

    const reportPath = ortslage
      ? ["reports", "deutschland", bundesland, kreis, `${ortslage}.json`]
      : ["reports", "deutschland", bundesland, `${kreis}.json`];

    const url = buildSupabaseReportUrl(reportPath);
    if (!url) {
      return NextResponse.json(
        { error: "SUPABASE_PUBLIC_BASE_URL fehlt" },
        { status: 500 },
      );
    }

    const res = await fetch(url);
    if (!res.ok) {
      return NextResponse.json({ error: "Datei nicht gefunden" }, { status: 404 });
    }

    const jsonData = await res.json();
    return NextResponse.json(jsonData.text);
  } catch (error) {
    return NextResponse.json({ error: 'Datei nicht gefunden' }, { status: 404 });
  }
}
