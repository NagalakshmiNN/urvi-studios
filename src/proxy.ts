import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

/**
 * The key every session cookie is signed with.
 *
 * This used to fall back to the string "dev-only-secret" when the variable
 * was unset. That fallback is in this repository, so anyone reading it could
 * mint a token saying {"kind":"admin"} and the site would believe it — the
 * whole admin, from a text editor. It failed open, and silently, which is the
 * worst way for a thing like this to fail.
 *
 * Now a missing secret throws. Deliberately when a session is signed or read,
 * not when this module loads: the production build evaluates every route's
 * module graph, and the environment variable is not present at build time
 * (it is scoped to the running functions, which is where it belongs). Failing
 * at import would make the build fall over; failing at use makes requests
 * fail closed, which is the behaviour actually wanted.
 */
function sessionSecret(): Uint8Array {
  const value = process.env.SESSION_SECRET;
  if (value && value.length >= 32) return new TextEncoder().encode(value);

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET is missing or shorter than 32 characters. Set it in the hosting environment — " +
        "sessions cannot be signed safely without it."
    );
  }
  // Development and the test suite only, and never reachable in production.
  return new TextEncoder().encode("dev-only-secret-not-for-production-use");
}

async function hasValidSession(request: NextRequest, cookieName: string, kind: "customer" | "admin") {
  const token = request.cookies.get(cookieName)?.value;
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, sessionSecret());
    return payload.kind === kind;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ---------------------------------------------------------- /account/*
  if (pathname.startsWith("/account")) {
    const isAuthPage = pathname === "/account/login" || pathname === "/account/register";
    const loggedIn = await hasValidSession(request, "urvi_session", "customer");
    if (!isAuthPage && !loggedIn) {
      const url = new URL("/account/login", request.url);
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    if (isAuthPage && loggedIn) {
      return NextResponse.redirect(new URL("/account", request.url));
    }
  }

  // ------------------------------------------------------------ /admin/*
  if (pathname.startsWith("/admin")) {
    const isAdminLogin = pathname === "/admin/login";
    const loggedIn = await hasValidSession(request, "urvi_admin_session", "admin");
    if (!isAdminLogin && !loggedIn) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    if (isAdminLogin && loggedIn) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/account/:path*", "/admin/:path*"],
};
