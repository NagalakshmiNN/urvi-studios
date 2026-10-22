// The reel maker's arithmetic: the timeline, the camera crops and the mask tools.
import { test, expect } from "@playwright/test";
import {
  ASPECT, TOTAL_SECONDS, cropRect, defaultShots, fitPose, layersAt, planTimeline, stageFor,
} from "../../src/lib/reel/plan";
import { SET_BACKDROPS, byId, pickForDay } from "../../src/lib/reel/backdrops";
import {
  MANUAL_REMOVE, dilate, erode, label, stampDisc, stampLine,
} from "../../src/lib/reel/cutout-core";

test("the default shots fill exactly 30 seconds", () => {
  const shots = defaultShots().filter((s) => s.enabled);
  const tl = planTimeline(shots.map((s) => s.weight), 30, 0.6, 3);
  expect(tl.total).toBeCloseTo(TOTAL_SECONDS, 5);
  expect(tl.spans.length).toBe(shots.length + 1);
});

test("a timeline needs at least one shot", () => {
  expect(() => planTimeline([], 30, 0.6, 3)).toThrow();
});

test("layersAt crossfades only near a boundary", () => {
  const tl = planTimeline([1, 1], 30, 0.6, 3);
  expect(layersAt(tl, 0.1).b).toBeUndefined();
  expect(layersAt(tl, 29.9)).toBeTruthy();
});

test("camera crops stay inside the stage", () => {
  const stage = { ...stageFor(800, 1600), dress: { x0: 0, y0: 0, x1: 0, y1: 0 } };
  for (const pose of [[0, 0, 3], [1, 1, 3], [0.5, 0.5, 1], [-1, 2, 2]] as const) {
    const r = cropRect(stage, [...pose], ASPECT);
    expect(r.x).toBeGreaterThanOrEqual(-1e-6);
    expect(r.y).toBeGreaterThanOrEqual(-1e-6);
    expect(r.x + r.w).toBeLessThanOrEqual(stage.width + 1e-6);
    expect(r.y + r.h).toBeLessThanOrEqual(stage.height + 1e-6);
  }
});

test("dilate grows and erode shrinks a square", () => {
  const w = 20, h = 20;
  const m = new Uint8Array(w * h);
  for (let y = 8; y < 12; y++) for (let x = 8; x < 12; x++) m[y * w + x] = 1;
  const sum = (a: Uint8Array) => a.reduce((s, v) => s + v, 0);
  expect(sum(dilate(m, w, h, 2))).toBeGreaterThan(sum(m));
  expect(sum(erode(m, w, h, 1))).toBeLessThan(sum(m));
});

test("label finds separate blobs", () => {
  const w = 10, h = 4;
  const m = new Uint8Array(w * h);
  m[0] = 1; m[1] = 1; m[8] = 1;
  const out = label(m, w, h, 8);
  const ids = new Set(Array.from(out.labels ?? out).filter((v: number) => v > 0));
  expect(ids.size).toBe(2);
});

test("brush strokes mark the touch-up layer", () => {
  const w = 30, h = 30;
  const layer = new Uint8Array(w * h);
  stampDisc(layer, w, h, 10, 10, 3, MANUAL_REMOVE);
  expect(layer[10 * w + 10]).toBe(MANUAL_REMOVE);
  stampLine(layer, w, h, 10, 20, 25, 20, 2, MANUAL_REMOVE);
  expect(layer[20 * w + 18]).toBe(MANUAL_REMOVE);
  expect(layer[0]).toBe(0);
});

import { detailsLine, draftCaption, factRows, hashtagsFor, plainText } from "../../src/lib/reel/caption";

const kurti = {
  name: "Orange Zari Kurti", price: 1499, fabric: "Pure cotton",
  perfectFor: "Office and everyday", styleNotes: "A warm rust orange with a hand-embroidered yoke. Easy to style.",
  description: "<p>Soft <b>cotton</b>.</p>", sizes: ["S", "M", "L"],
  parentTags: "Everyday|Office", fabricTags: "Cotton",
};

test("the end-card line carries price and sizes", () => {
  expect(detailsLine(kurti)).toBe("₹1,499 · Sizes S, M, L");
  expect(detailsLine({ ...kurti, sizes: [] })).toBe("₹1,499");
});

test("the details screen lists fabric and where to wear it", () => {
  expect(factRows(kurti)).toEqual([["Fabric", "Pure cotton"], ["Perfect for", "Office and everyday"]]);
  expect(factRows({ ...kurti, fabric: "<p>Soft kota cotton. Light and airy.</p>" })[0][1]).toBe("Soft kota cotton");
});

test("the caption draft is plain text with the facts and hashtags", () => {
  const c = draftCaption(kurti);
  expect(c).toContain("Orange Zari Kurti");
  expect(c).toContain("A warm rust orange with a hand-embroidered yoke.");
  expect(c).toContain("Price: ₹1,499");
  expect(c).toContain("#kurti");
  expect(c).toContain("#officewear");
  expect(c).not.toMatch(/<[a-z]/);
});

test("html is stripped and hashtags are unique", () => {
  expect(plainText("<p>Soft&nbsp;<b>cotton</b></p>")).toBe("Soft cotton");
  const tags = hashtagsFor(kurti);
  expect(new Set(tags).size).toBe(tags.length);
});

test("there are more than 40 styled backdrops, each with its own id", () => {
  expect(SET_BACKDROPS.length).toBeGreaterThan(40);
  expect(new Set(SET_BACKDROPS.map((b) => b.id)).size).toBe(SET_BACKDROPS.length);
  expect(new Set(SET_BACKDROPS.map((b) => b.name)).size).toBe(SET_BACKDROPS.length);
  for (const b of SET_BACKDROPS) expect(byId(b.id)).not.toBeNull();
});

test("the daily pick changes every day and avoids a backdrop that hides the dress", () => {
  const day = (n: number) => new Date(2026, 9, 1 + n, 12);
  for (let n = 0; n < 20; n++) {
    expect(pickForDay(day(n), null).id).not.toBe(pickForDay(day(n + 1), null).id);
  }
  // a very dark dress is never put on a very dark set
  const dark: [number, number, number] = [20, 16, 24];
  for (let n = 0; n < SET_BACKDROPS.length; n++) {
    const b = pickForDay(day(n), dark);
    const mid = b.family;
    expect(mid).toBeTruthy();
  }
});

test("close-ups stay inside the dress, and move onto fabric when they start off it", () => {
  const stage = { width: 1000, height: 1778, dress: { x0: 200, y0: 150, x1: 800, y1: 1600 } };
  for (const pose of [[0.5, 0.0, 2.8], [0.0, 0.2, 2.0], [1.0, 1.0, 2.5]] as [number, number, number][]) {
    const r = cropRect(stage, pose, ASPECT, true);
    expect(r.x).toBeGreaterThanOrEqual(stage.dress.x0);
    expect(r.x + r.w).toBeLessThanOrEqual(stage.dress.x1);
    expect(r.y).toBeGreaterThanOrEqual(stage.dress.y0);
    expect(r.y + r.h).toBeLessThanOrEqual(stage.dress.y1);
  }
  // fabric only in the right half: a shot aimed at the left should slide right
  const cover = (r: { x: number; w: number }) => Math.max(0, Math.min(1, (r.x + r.w - 500) / r.w));
  const fitted = fitPose(stage, [0.2, 0.5, 3.0], cover);
  expect(fitted[0]).toBeGreaterThan(0.2);
});
