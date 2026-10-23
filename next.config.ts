import type { NextConfig } from "next";

// Headers the browser enforces on our behalf.
//
// None of these were set. Each closes a different door:
//
//  * nosniff — a file served with the wrong content type is otherwise
//    re-interpreted by the browser, which is how an "image" becomes a script.
//  * frame-ancestors / X-Frame-Options — without them this site can be framed
//    invisibly over an attacker's page and its buttons clicked by a customer
//    who thinks they are clicking something else.
//  * HSTS — pins the browser to https, so a first request over http on a
//    hostile network cannot be intercepted before the redirect.
//  * CSP (built in src/lib/csp.ts, applied by src/proxy.ts) — decides where scripts may come from. It is the reason a script
//    injected into a product description would not run, and it is what makes
//    the unsanitised rich text a contained problem rather than an open one.
//
// The CSP is written against what this site actually loads: Razorpay's
// checkout, its API and its frame; Google Fonts; images from our own
// /api/images route and data: URIs. 'unsafe-inline' for styles is required by
// the inline style attributes throughout the app and by Next's own injected
// styles; 'unsafe-eval' is deliberately NOT granted.


const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  // The version number of a framework is free reconnaissance; it names the
  // CVEs worth trying.
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
