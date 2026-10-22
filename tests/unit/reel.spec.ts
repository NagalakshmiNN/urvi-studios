// The reel maker's arithmetic: the timeline, the camera crops and the mask tools.
import { test, expect } from "@playwright/test";
import {
  ASPECT, TOTAL_SECONDS, cropRect, defaultShots, layersAt, planTimeline, stageFor,
} from "../../src/lib/reel/plan";
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
