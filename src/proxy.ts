import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(process.env.SESSION_SECRET || "dev-only-secret");

async function hasValidSession(request: NextRequest, cookieName: string, kind: "customer" | "admin") {
  const token = request.cookies.get(cookieName)?.value;
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, SECRET);
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
