// The words that go with a reel: the line on the end card, and a draft Instagram
// caption with hashtags. Written from the product record; the admin edits both.

export type CaptionSource = {
  name: string;
  price: number;
  fabric: string;
  perfectFor?: string | null;
  bestWeather?: string | null;
  styleNotes?: string | null;
  description?: string | null;
  sizes: string[]; // sizes with stock
  parentTags?: string | null; // "Everyday|Office|Occasion"
  fabricTags?: string | null; // "Cotton|Georgette"
};

const inr = (n: number) => "₹" + Number(n).toLocaleString("en-IN");

/** Rich-text descriptions are HTML; captions are plain. */
export function plainText(html: string | null | undefined): string {
  return (html ?? "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|li|h\d)>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function firstSentence(text: string, max = 160): string {
  const t = plainText(text);
  const m = /^(.+?[.!?])(\s|$)/.exec(t);
  const s = m ? m[1] : t;
  return s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;
}

/** "₹1,499 · Sizes S, M, L" for the end card (the fabric has its own row). */
export function detailsLine(p: CaptionSource): string {
  const parts = [inr(p.price)];
  if (p.sizes.length) parts.push(`Sizes ${p.sizes.join(", ")}`);
  return parts.join(" · ");
}

function brief(text: string, max = 44): string {
  const t = plainText(text).replace(/[.;]+$/, "");
  const first = t.split(/[.;]\s/)[0];
  return first.length > max ? first.slice(0, max - 1).trimEnd() + "…" : first;
}

/** The rows of the "details" screen near the end of the reel. */
export function factRows(p: CaptionSource): [string, string][] {
  const rows: [string, string][] = [];
  if (p.fabric) rows.push(["Fabric", brief(p.fabric)]);
  if (p.perfectFor) rows.push(["Perfect for", brief(p.perfectFor)]);
  if (p.bestWeather) rows.push(["Best weather", brief(p.bestWeather)]);
  return rows;
}

export function hashtagsFor(p: CaptionSource): string[] {
  const tags = ["#urvistudios", "#bangalorefashion", "#womensclothing", "#indianwear", "#ootd"];
  const parents = (p.parentTags ?? "").split("|").map((s) => s.trim().toLowerCase());
  if (parents.includes("everyday")) tags.push("#everydaywear");
  if (parents.includes("office")) tags.push("#officewear");
  if (parents.includes("occasion")) tags.push("#occasionwear");
  for (const f of (p.fabricTags ?? "").split("|").map((s) => s.trim()).filter(Boolean)) {
    tags.push("#" + f.toLowerCase().replace(/[^a-z0-9]/g, "") + "fabric");
  }
  const n = p.name.toLowerCase();
  if (/kurt[ia]/.test(n)) tags.push("#kurti", "#kurtisofinstagram");
  if (/saree|sari/.test(n)) tags.push("#saree");
  if (/dress/.test(n)) tags.push("#dress");
  return [...new Set(tags)].slice(0, 12);
}

export function draftCaption(p: CaptionSource): string {
  const lines: string[] = [p.name];
  const hook = p.styleNotes ? firstSentence(p.styleNotes) : firstSentence(p.description ?? "");
  if (hook) lines.push("", hook);
  const facts: string[] = [];
  if (p.fabric) facts.push(`Fabric: ${plainText(p.fabric)}`);
  if (p.perfectFor) facts.push(`Perfect for: ${plainText(p.perfectFor)}`);
  if (p.sizes.length) facts.push(`Sizes: ${p.sizes.join(", ")}`);
  facts.push(`Price: ${inr(p.price)}`);
  lines.push("", ...facts, "", "DM us to order. Link in bio.", "", hashtagsFor(p).join(" "));
  return lines.join("\n");
}
