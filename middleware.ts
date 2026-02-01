import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const BASIC_USER = process.env.BASIC_AUTH_USER ?? "";
const BASIC_PASS = process.env.BASIC_AUTH_PASS ?? "";

function unauthorized() {
  return new NextResponse("Unauthorized", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Protected"',
    },
  });
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith("/api/local-site-report") ||
    pathname.startsWith("/api/local-site-texts") ||
    pathname.startsWith("/api/local-site-package")
  ) {
    return NextResponse.next();
  }

  if (!BASIC_USER || !BASIC_PASS) {
    return NextResponse.next();
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Basic ")) {
    return unauthorized();
  }

  const encoded = authHeader.split(" ")[1] ?? "";
  let decoded = "";
  try {
    decoded = Buffer.from(encoded, "base64").toString("utf-8");
  } catch {
    return unauthorized();
  }

  const [user, pass] = decoded.split(":");
  if (user !== BASIC_USER || pass !== BASIC_PASS) {
    return unauthorized();
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/:path*",
};
