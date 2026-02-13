import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

const BASIC_USER = process.env.BASIC_AUTH_USER ?? "";
const BASIC_PASS = process.env.BASIC_AUTH_PASS ?? "";
const BASIC_AUTH_DISABLED = process.env.BASIC_AUTH_DISABLED === "1";
const ADMIN_SUPER_USER_IDS = process.env.ADMIN_SUPER_USER_IDS ?? "";

function parseCsv(value: string): string[] {
  return String(value)
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

function unauthorized() {
  return new NextResponse("Unauthorized", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Protected"',
    },
  });
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdminLoginPath = pathname === "/admin/login";
  const needsDashboardAuth = pathname.startsWith("/dashboard");
  const needsAdminAuth = pathname.startsWith("/admin") && !isAdminLoginPath;
  if (
    pathname.startsWith("/api/local-site-report") ||
    pathname.startsWith("/api/local-site-texts") ||
    pathname.startsWith("/api/local-site-package")
  ) {
    return NextResponse.next();
  }

  if (!BASIC_AUTH_DISABLED && BASIC_USER && BASIC_PASS) {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Basic ")) {
      return unauthorized();
    }

    const encoded = authHeader.split(" ")[1] ?? "";
    let decoded = "";
    try {
      decoded = atob(encoded);
    } catch {
      return unauthorized();
    }

    const [user, pass] = decoded.split(":");
    if (user !== BASIC_USER || pass !== BASIC_PASS) {
      return unauthorized();
    }
  }

  if (needsDashboardAuth || needsAdminAuth) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      if (needsAdminAuth) {
        return NextResponse.redirect(new URL("/admin/login?message=Auth-Konfiguration-fehlt", request.url));
      }
      return NextResponse.redirect(new URL("/partner/login?message=Auth-Konfiguration-fehlt", request.url));
    }

    let response = NextResponse.next({
      request: { headers: request.headers },
    });

    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            request.cookies.set({ name, value, ...options });
            response = NextResponse.next({ request: { headers: request.headers } });
            response.cookies.set({ name, value, ...options });
          },
          remove(name: string, options: CookieOptions) {
            request.cookies.set({ name, value: "", ...options });
            response = NextResponse.next({ request: { headers: request.headers } });
            response.cookies.set({ name, value: "", ...options });
          },
        },
      },
    );

    const {
      data: { user: sessionUser },
    } = await supabase.auth.getUser();

    if (!sessionUser) {
      if (needsAdminAuth) {
        return NextResponse.redirect(new URL("/admin/login", request.url));
      }
      return NextResponse.redirect(new URL("/partner/login", request.url));
    }

    if (needsAdminAuth) {
      const superAdmins = new Set(parseCsv(ADMIN_SUPER_USER_IDS));
      if (!superAdmins.has(String(sessionUser.id ?? "").trim())) {
        return NextResponse.redirect(new URL("/admin/login?message=Kein-Admin-Zugriff", request.url));
      }
    }

    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/:path*",
};
