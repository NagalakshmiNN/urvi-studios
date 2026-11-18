import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ─── Known Bot User-Agent Patterns ──────────────────────────────────
// These are matched case-insensitively against the request's User-Agent.
// Well-behaved bots respect robots.txt; this catches the ones that don't.

const BLOCKED_BOTS = [
  // AI scrapers
  "gptbot",
  "chatgpt-user",
  "ccbot",
  "anthropic-ai",
  "claude-web",
  "google-extended",
  "bytespider",
  "perplexitybot",
  "cohere-ai",
  "applebot-extended",

  // SEO scrapers (not needed for our site)
  "ahrefsbot",
  "semrushbot",
  "mj12bot",
  "dotbot",
  "petalbot",
  "blexbot",
  "dataforseo",

  // Aggressive crawlers
  "megaindex",
  "barkrowler",
  "aspiegelbot",
  "zoominfobot",

  // Generic scraper signatures
  "scrapy",
  "python-requests",
  "go-http-client",
  "java/",
  "wget/",
  "libwww-perl",
  "httpclient",
  "php/",
  "curl/",
];

// Paths that should never be accessed by bots
const PROTECTED_PATHS = ["/admin", "/api"];

// ─── Middleware ──────────────────────────────────────────────────────

export function middleware(request: NextRequest) {
  const ua = (request.headers.get("user-agent") || "").toLowerCase();
  const { pathname } = request.nextUrl;

  // 1. Block known bad bots entirely
  if (BLOCKED_BOTS.some((bot) => ua.includes(bot))) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // 2. Block empty user-agents on protected paths
  //    (legitimate browsers always send a User-Agent)
  if (!ua && PROTECTED_PATHS.some((p) => pathname.startsWith(p))) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // 3. Add extra headers for admin routes
  if (pathname.startsWith("/admin")) {
    const response = NextResponse.next();
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    return response;
  }

  return NextResponse.next();
}

// Only run middleware on page and API routes, skip static files
export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, icons, images
     * - robots.txt, sitemap.xml
     */
    "/((?!_next/static|_next/image|favicon\\.ico|icons/|images/|robots\\.txt|sitemap\\.xml|admin\\.webmanifest).*)",
  ],
};
