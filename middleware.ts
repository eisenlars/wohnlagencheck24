import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { normalizePublicLocale, stripLeadingLocale } from "@/lib/public-locale-routing";

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const { locale } = stripLeadingLocale(pathname);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-wc24-locale", normalizePublicLocale(locale));

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico|robots.txt|sitemap.xml).*)"],
};
