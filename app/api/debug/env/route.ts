import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY_VERCEL ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    "";
  return NextResponse.json({
    SUPABASE_URL: Boolean(process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL),
    SUPABASE_SERVICE_ROLE_KEY: {
      present: Boolean(serviceKey),
      length: serviceKey.length,
    },
    SUPABASE_PUBLIC_BASE_URL: Boolean(process.env.SUPABASE_PUBLIC_BASE_URL),
    TEST_ENV: process.env.TEST_ENV ?? null,
  });
}
