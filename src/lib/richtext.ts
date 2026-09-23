// Shared helpers for the rich-text Description field. Every description
// written from here on is saved as real HTML (from the TipTap editor on
// the admin product forms) — these helpers keep that compatible with the
// large number of existing products whose description is still the old
// plain text (typed into a plain textarea, newlines and all).

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Heuristic: does this look like it already contains real markup (saved
// from the rich editor), or is it old-style plain text?
export function looksLikeHtml(s: string) {
  return /<[a-z][\s\S]*>/i.test(s);
}

// Turns old plain text (blank-line-separated paragraphs, single newlines
// as soft breaks) into the same shape of HTML the rich editor would have
// produced, so legacy descriptions open in the editor — and render on the
// product page — with their paragraph breaks intact instead of collapsing
// into one run-on block (which is what plain HTML does with bare \n).
export function plainTextToHtml(s: string) {
  return s
    .split(/\n{2,}/)
    .map((para) => `<p>${para.split("\n").map(escapeHtml).join("<br>")}</p>`)
    .join("");
}

// What to actually feed the editor / render on the page — pass real HTML
// through untouched, convert plain text on the way in.
//
// This does NOT sanitise, and must not: it runs in the browser (the editor
// and the product page both call it), and pulling a sanitiser into the client
// bundle to clean markup the client was handed anyway protects nobody.
// Cleaning happens on the server — see src/lib/sanitize-description.ts, used
// where the product is loaded and where the description is saved.
export function toDisplayHtml(s: string | null | undefined) {
  if (!s) return "";
  return looksLikeHtml(s) ? s : plainTextToHtml(s);
}

// A description consisting only of empty tags (e.g. "<p></p>") is still
// "blank" for validation purposes — strip tags and check what's left.
export function isBlankHtml(s: string) {
  return !s.replace(/<[^>]*>/g, "").replace(/&nbsp;/gi, " ").trim();
}
