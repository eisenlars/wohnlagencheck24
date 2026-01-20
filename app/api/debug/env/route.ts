import { NextResponse } from "next/server";

export const runtime = "edge";

export function GET() {
  return NextResponse.json({
    hasNextPublicUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    hasNextPublicKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    hasUrl: Boolean(process.env.SUPABASE_URL),
    hasAnonKey: Boolean(process.env.SUPABASE_ANON_KEY),
  });
}
