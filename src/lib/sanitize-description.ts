// Making a product description safe to render as HTML.
//
// Descriptions are written in a rich-text editor and stored as markup, then
// rendered with dangerouslySetInnerHTML. Nothing cleaned them on the way in
// or out, so whatever was in the field was handed to the browser verbatim —
// including a <script> tag, or an onerror= on an image.
//
// That is admin-only input, so it is not an open door: someone would already
// need the admin to plant it. But it is exactly the thing that turns a single
// compromised admin account into every visitor's browser running an
// attacker's code, and the Excel importer is a plausible way for markup
// nobody wrote by hand to arrive in that field.
//
// Sanitising happens on the server: at render, so descriptions already in the
// database are covered, and again on save, so the stored value is clean too.
// Belt and braces, because the cost is one function call and the failure mode
// is other people's customers.

import sanitizeHtml from "sanitize-html";

// What a garment description legitimately contains: paragraphs, emphasis,
// lists, the occasional link. No images, no iframes, no styles, no scripts.
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ["p", "br", "strong", "b", "em", "i", "u", "s", "ul", "ol", "li", "h3", "h4", "blockquote", "a", "span"],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    // The editor writes colour and font-family as inline styles; those are
    // allowed through the styles allowlist below, which parses and validates
    // them rather than trusting the string.
    span: ["style"],
    p: ["style"],
  },
  allowedStyles: {
    "*": {
      color: [/^#[0-9a-fA-F]{3,8}$/, /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/],
      "font-family": [/^[\w\s"',-]+$/],
      "text-align": [/^(left|right|center|justify)$/],
    },
  },
  // Only these, so no javascript: or data: URL can hide in an href.
  allowedSchemes: ["http", "https", "mailto"],
  // A link that opens a new tab without this lets the opened page reach back
  // and redirect the tab it came from.
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }),
  },
  // Text inside a disallowed tag is kept; the tag itself goes. A <script>'s
  // contents are dropped entirely — they are code, not prose.
  nonTextTags: ["style", "script", "textarea", "option", "noscript"],
};

export function sanitizeDescription(html: string | null | undefined): string {
  if (!html) return "";
  return sanitizeHtml(html, OPTIONS);
}
