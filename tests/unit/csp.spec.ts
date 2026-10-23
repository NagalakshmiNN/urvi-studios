import { test, expect } from "@playwright/test";
import { cspForPath } from "../../src/lib/csp";

test("admin pages, including the reel maker, may run WebAssembly and play blob: video", () => {
  for (const p of ["/admin", "/admin/reels", "/admin/products", "/admin/login"]) {
    const csp = cspForPath(p);
    expect(csp, p).toContain("'wasm-unsafe-eval'");
    expect(csp, p).toContain("media-src 'self' blob:");
    expect(csp, p).not.toContain("'unsafe-eval'");
  }
});

test("the public site keeps the strict policy", () => {
  for (const p of ["/", "/shop", "/administrator", "/account", "/checkout", "/product/x"]) {
    const csp = cspForPath(p);
    expect(csp, p).not.toContain("wasm-unsafe-eval");
    expect(csp, p).not.toContain("unsafe-eval");
    expect(csp, p).not.toContain("media-src");
  }
});

test("Google Analytics is allowed, and only the hosts it needs", () => {
  for (const p of ["/", "/admin/products"]) {
    const csp = cspForPath(p);
    expect(csp, p).toContain("script-src 'self' 'unsafe-inline'");
    expect(csp, p).toContain("https://www.googletagmanager.com");
    expect(csp, p).toContain("connect-src 'self'");
    expect(csp, p).toContain("https://www.google-analytics.com");
    expect(csp, p).not.toContain("https:;");
    expect(csp, p).not.toMatch(/script-src[^;]*\*(\s|;|$)/);
  }
});
