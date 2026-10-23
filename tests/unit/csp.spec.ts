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
