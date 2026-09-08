// Product descriptions are stored as HTML now (the rich-text editor), but
// descriptions written before that change are still plain text in the
// database. These helpers are what stop old descriptions collapsing into one
// run-on block, and what stop an "empty" editor passing validation.

import { test, expect } from "@playwright/test";
import { looksLikeHtml, plainTextToHtml, toDisplayHtml, isBlankHtml } from "../../src/lib/richtext";

test.describe("telling HTML from plain text", () => {
  test("recognises real editor output as HTML", () => {
    expect(looksLikeHtml("<p>Hello</p>")).toBe(true);
    expect(looksLikeHtml('<p><strong>Bold</strong> bit</p>')).toBe(true);
  });

  test("treats ordinary prose as plain text", () => {
    expect(looksLikeHtml("A soft cotton kurta, cut for everyday.")).toBe(false);
    expect(looksLikeHtml("Sizes S-XL. 100% cotton.")).toBe(false);
  });
});

test.describe("converting legacy plain text", () => {
  test("turns blank-line-separated text into real paragraphs", () => {
    const html = plainTextToHtml("First paragraph.\n\nSecond paragraph.");
    expect(html).toBe("<p>First paragraph.</p><p>Second paragraph.</p>");
  });

  test("keeps single newlines as line breaks inside one paragraph", () => {
    expect(plainTextToHtml("Line one\nLine two")).toBe("<p>Line one<br>Line two</p>");
  });

  test("escapes characters that would otherwise inject markup", () => {
    const html = plainTextToHtml('Cotton & silk <not a tag>');
    expect(html).toContain("&amp;");
    expect(html).toContain("&lt;not a tag&gt;");
    expect(html).not.toContain("<not a tag>");
  });

  test("passes real HTML through untouched but converts plain text", () => {
    expect(toDisplayHtml("<p>Already rich</p>")).toBe("<p>Already rich</p>");
    expect(toDisplayHtml("Plain line")).toBe("<p>Plain line</p>");
    expect(toDisplayHtml(null)).toBe("");
    expect(toDisplayHtml(undefined)).toBe("");
    expect(toDisplayHtml("")).toBe("");
  });
});

test.describe("blank detection", () => {
  test("an untouched editor counts as blank, so validation still catches it", () => {
    // TipTap submits <p></p> for an empty box — a plain "is it an empty
    // string" check would have let that through as a valid description.
    expect(isBlankHtml("<p></p>")).toBe(true);
    expect(isBlankHtml("")).toBe(true);
    expect(isBlankHtml("   ")).toBe(true);
    expect(isBlankHtml("<p><br></p>")).toBe(true);
    expect(isBlankHtml("<p>&nbsp;</p>")).toBe(true);
  });

  test("real content is not blank", () => {
    expect(isBlankHtml("<p>Something</p>")).toBe(false);
    expect(isBlankHtml("<p><strong>Bold</strong></p>")).toBe(false);
  });
});
