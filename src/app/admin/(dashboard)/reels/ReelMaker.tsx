"use client";

// The reel maker: a photo of a dress in, a 30-second vertical reel out.
// Everything happens in this browser tab — the cutout network, the painting
// and the video encoding — so it costs nothing to run and the photos are never
// uploaded anywhere. Steps are shown in the order they are done, and each one
// can be redone without starting again.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MANUAL_FILL, MANUAL_KEEP, MANUAL_REMOVE, stampLine,
} from "@/lib/reel/cutout-core";
import { SET_BACKDROPS, byId, pickForDay, type Backdrop } from "@/lib/reel/backdrops";
import {
  analysePhoto, buildStage, composeToCanvas, loadLogo, loadPhoto, parseColor, type Analysis,
} from "@/lib/reel/browser";
import {
  ASPECT, cropRect, defaultShots, softnessNotes, type Pose, type Shot, type Stage,
} from "@/lib/reel/plan";
import { ReelPainter, canMakeVideo, encodeReel } from "@/lib/reel/render";
import { loadSaved, saveSaved, type SavedReel } from "@/lib/reel/saved";

export type ReelProduct = {
  id: string; name: string; sku: string; imageUrl: string;
  /** "₹1,499 · Sizes S, M, L · Cotton" */
  details: string;
  /** Fabric and wearing details for the closing screens. */
  facts: [string, string][];
  /** Draft Instagram caption with hashtags. */
  caption: string;
};

type BrushMode = "remove" | "keep" | "fill";
const BRUSH_VALUE: Record<BrushMode, number> = { remove: MANUAL_REMOVE, keep: MANUAL_KEEP, fill: MANUAL_FILL };
const BRUSH_COLOUR: Record<BrushMode, string> = {
  remove: "rgba(210,40,40,0.5)", keep: "rgba(40,150,60,0.5)", fill: "rgba(40,90,220,0.5)",
};
const BRUSH_HELP: Record<BrushMode, string> = {
  remove: "Paint over anything that should not be there (books, shelf edges, a hanger outside the dress).",
  keep: "Paint over any part of the dress that was cut away by mistake.",
  fill: "Paint over a hanger or object lying across the dress. It is rebuilt from the fabric next to it.",
};

const PREVIEW_W = 216;
const PREVIEW_H = 384;

/** The site already loads these from Google Fonts; make sure they are ready before drawing. */
async function loadFonts() {
  const faces = [
    '400 60px "Allura"', 'italic 500 30px "Cormorant Garamond"', '600 40px "Cormorant Garamond"',
    '500 20px "Montserrat"', '600 20px "Montserrat"',
  ];
  await Promise.all(faces.map((f) => document.fonts.load(f).catch(() => undefined)));
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "dress";
}

function averageColour(c: HTMLCanvasElement): [number, number, number] {
  const t = document.createElement("canvas");
  t.width = 64; t.height = 114;
  const x = t.getContext("2d")!;
  x.drawImage(c, 0, 0, t.width, t.height);
  const d = x.getImageData(0, 0, t.width, t.height).data;
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 250) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
  return n ? [r / n, g / n, b / n] : [128, 128, 128];
}

export default function ReelMaker({
  products, brand, defaultContact, instagramHandle, instagramUrl, initialProductId,
}: {
  products: ReelProduct[];
  brand: string;
  /** Lines under "Contact us" on the last screen, one per line. */
  defaultContact: string;
  instagramHandle: string;
  instagramUrl: string;
  initialProductId?: string;
}) {
  // ---- what the person chose
  const [productId, setProductId] = useState(initialProductId ?? "");
  const [removeBg, setRemoveBg] = useState(false);
  // A photo is open and we are waiting for the person to say whether the
  // background should be cleared. Nothing is changed before they answer.
  const [awaiting, setAwaiting] = useState(false); // kept false: the flow no longer waits for an answer
  const [clearBg, setClearBg] = useState(true);
  const [autoMake, setAutoMake] = useState(false);
  const askRef = useRef<HTMLCanvasElement>(null);
  const [bgHex, setBgHex] = useState("#FFFFF0");
  const [backdropId, setBackdropId] = useState("today");
  const [title, setTitle] = useState("");
  const [tagline, setTagline] = useState("");
  const [contact, setContact] = useState(defaultContact);
  const [details, setDetails] = useState("");
  const [facts, setFacts] = useState<[string, string][]>([]);
  const [caption, setCaption] = useState("");
  const [copied, setCopied] = useState(false);
  const [, setSaved] = useState<SavedReel | null>(null);
  const [stageInfo, setStageInfo] = useState<Stage | null>(null);
  const [hasAnalysis, setHasAnalysis] = useState(false);
  const [shots, setShots] = useState<Shot[]>(defaultShots);
  const [selected, setSelected] = useState(0);
  const [clickSets, setClickSets] = useState<"from" | "to">("from");

  // ---- progress and results
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);
  const [method, setMethod] = useState<"colour" | "plain" | null>(null);
  const [stageVersion, setStageVersion] = useState(0);
  const [makeProgress, setMakeProgress] = useState<number | null>(null);
  const [video, setVideo] = useState<{ url: string; mb: number; name: string } | null>(null);
  const [playing, setPlaying] = useState(false);

  // ---- brush
  const [brush, setBrush] = useState<BrushMode>("remove");
  const [brushSize, setBrushSize] = useState(26);
  const [zoom, setZoom] = useState(1);
  const [canUndo, setCanUndo] = useState(false);

  // ---- heavy things live in refs, not state
  const photoRef = useRef<HTMLCanvasElement | null>(null);
  const analysisRef = useRef<Analysis | null>(null);
  const manualRef = useRef<Uint8Array | null>(null);
  const undoRef = useRef<Uint8Array[]>([]);
  const composedRef = useRef<{ canvas: HTMLCanvasElement; bbox: { x0: number; y0: number; x1: number; y1: number } } | null>(null);
  const stageRef = useRef<{ canvas: HTMLCanvasElement; stage: Stage } | null>(null);
  const strokeRef = useRef<{ pts: [number, number][]; r: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const playRef = useRef<number | null>(null);

  const viewRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const overviewRef = useRef<HTMLCanvasElement>(null);
  const fromRef = useRef<HTMLCanvasElement>(null);
  const toRef = useRef<HTMLCanvasElement>(null);
  const playCanvasRef = useRef<HTMLCanvasElement>(null);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- browser capability, only known on the client
  useEffect(() => { setSupported(canMakeVideo()); }, []);
  useEffect(() => () => { if (video) URL.revokeObjectURL(video.url); }, [video]);

  const hasStage = stageVersion > 0;

  // A styled backdrop needs the dress cut out on a see-through stage.
  const sceneRef = useRef(false);
  useEffect(() => { sceneRef.current = removeBg && backdropId !== "plain"; }, [removeBg, backdropId]);
  const dressRef = useRef<[number, number, number] | null>(null);
  function resolveBackdrop(): Backdrop | undefined {
    if (!sceneRef.current) return undefined;
    if (backdropId === "today") return pickForDay(new Date(), dressRef.current);
    return byId(backdropId) ?? pickForDay(new Date(), dressRef.current);
  }

  // -------------------------------------------------------------- pipeline

  const rebuildStage = useCallback((bgOverride?: string) => {
    const composed = composedRef.current;
    if (!composed) return;
    stageRef.current = buildStage(composed.canvas, composed.bbox, sceneRef.current ? null : bgOverride ?? bgHex);
    dressRef.current = sceneRef.current ? averageColour(stageRef.current.canvas) : null;
    setStageInfo(stageRef.current.stage);
    setStageVersion((v) => v + 1);
  }, [bgHex]);

  const recompose = useCallback((bgOverride?: string) => {
    const analysis = analysisRef.current;
    if (!analysis) return;
    const hex = bgOverride ?? bgHex;
    const { canvas, composed } = composeToCanvas(analysis, manualRef.current, sceneRef.current ? null : parseColor(hex));
    composedRef.current = { canvas, bbox: composed.bbox };
    const view = viewRef.current;
    if (view) {
      view.width = canvas.width;
      view.height = canvas.height;
      view.getContext("2d")!.drawImage(canvas, 0, 0);
    }
    const ov = overlayRef.current;
    if (ov) {
      ov.width = canvas.width;
      ov.height = canvas.height;
    }
    rebuildStage(hex);
  }, [bgHex, rebuildStage]);

  const process = useCallback(async (photo: HTMLCanvasElement, remove: boolean, restore?: SavedReel) => {
    setError(null);
    setVideo(null);
    setMethod(null);
    try {
      if (remove) {
        const analysis = await analysePhoto(photo, setStatus);
        analysisRef.current = analysis;
        setHasAnalysis(true);
        manualRef.current = new Uint8Array(analysis.w * analysis.h);
        undoRef.current = [];
        setCanUndo(false);
        setMethod(analysis.refined.method);
        if (restore?.manual && restore.w === analysis.w && restore.h === analysis.h) {
          manualRef.current = new Uint8Array(restore.manual);
        }
        recompose(restore?.bgHex);
      } else {
        analysisRef.current = null;
        setHasAnalysis(false);
        manualRef.current = null;
        composedRef.current = {
          canvas: photo,
          bbox: { x0: 0, y0: 0, x1: photo.width - 1, y1: photo.height - 1 },
        };
        rebuildStage(restore?.bgHex);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong preparing the photo.");
    } finally {
      setStatus(null);
    }
  }, [recompose, rebuildStage]);

  async function openPhoto(src: File | string, name?: string) {
    setError(null);
    setStatus("Opening the photo…");
    try {
      const photo = await loadPhoto(src);
      photoRef.current = photo;
      analysisRef.current = null;
      setHasAnalysis(false);
      manualRef.current = null;
      composedRef.current = null;
      stageRef.current = null;
      setStageVersion(0);
      setVideo(null);
      setMethod(null);
      if (name) setTitle(name);
      const prod = products.find((x) => x.id === productIdRef.current);
      if (prod) { setDetails(prod.details); setCaption(prod.caption); setFacts(prod.facts); } else { setFacts([]); }
      const saved2 = prod ? await loadSaved(prod.id) : null;
      setSaved(saved2);
      setStatus(null);
      // One step for the person: the photo goes straight through cutout, framing and rendering.
      const sv = saved2;
      await decide(sv ? sv.removeBg : clearBgRef.current, sv ?? undefined);
      setAutoMake(true);
    } catch {
      setError("That photo could not be opened. Try a JPG or PNG.");
      setStatus(null);
    }
  }

  // The person's answer to "clear the background?"
  async function decide(remove: boolean, restore?: SavedReel) {
    const photo = photoRef.current;
    if (!photo) return;
    setAwaiting(false);
    setRemoveBg(remove);
    sceneRef.current = remove && (restore?.backdropId ?? backdropId) !== "plain";
    if (restore) {
      setShots(restore.shots);
      setTitle(restore.title);
      setTagline(restore.tagline);
      setDetails(restore.details);
      setCaption(restore.caption);
      if (restore.contact.includes("\n")) setContact(restore.contact);
      setBgHex(restore.bgHex);
      if (restore.backdropId) setBackdropId(restore.backdropId);
    }
    await process(photo, remove, restore);
  }

  // show the untouched photo while the question is open
  useEffect(() => {
    const photo = photoRef.current;
    const c = askRef.current;
    if (!awaiting || !photo || !c) return;
    c.width = photo.width;
    c.height = photo.height;
    c.getContext("2d")!.drawImage(photo, 0, 0);
  }, [awaiting]);

  function chooseFile(f: File) {
    setProductId("");
    productIdRef.current = "";
    void openPhoto(f, f.name.replace(/\.[^.]+$/, ""));
  }

  function chooseProduct(id: string) {
    setProductId(id);
    productIdRef.current = id;
    const p = products.find((x) => x.id === id);
    if (p) void openPhoto(p.imageUrl, p.name);
  }

  // a product named in the address opens straight away
  const productIdRef = useRef(initialProductId ?? "");
  const clearBgRef = useRef(true);
  useEffect(() => { clearBgRef.current = clearBg; }, [clearBg]);
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current || !initialProductId) return;
    startedRef.current = true;
    const p = products.find((x) => x.id === initialProductId);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- open the product named in the address once
    if (p) void openPhoto(p.imageUrl, p.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Changing the backdrop or colour re-makes the reel on its own, after a short
  // pause so a run of clicks counts as one change. A reel still being made is
  // stopped first. The colour only matters when no styled backdrop is in use.
  const firstColour = useRef(true);
  const prevLook = useRef({ bgHex, backdropId });
  useEffect(() => {
    if (firstColour.current) { firstColour.current = false; return; }
    const prev = prevLook.current;
    prevLook.current = { bgHex, backdropId };
    const matters = sceneRef.current ? prev.backdropId !== backdropId : prev.bgHex !== bgHex || prev.backdropId !== backdropId;
    const t = setTimeout(() => {
      if (!photoRef.current || !composedRef.current) return; // nothing open yet
      if (analysisRef.current) recompose();
      else rebuildStage();
      if (matters) {
        abortRef.current?.abort();
        setAutoMake(true);
      }
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bgHex, backdropId]);

  // Ticking or unticking "Clear the background and hanger" redoes the photo that
  // is open, and then the reel.
  const firstTick = useRef(true);
  useEffect(() => {
    if (firstTick.current) { firstTick.current = false; return; }
    if (!photoRef.current) return;
    abortRef.current?.abort();
    void decide(clearBg).then(() => setAutoMake(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearBg]);

  // Remember this product's settings in this browser, a moment after each change.
  useEffect(() => {
    if (!productId || !hasStage || awaiting) return;
    const t = setTimeout(() => {
      const a = analysisRef.current;
      void saveSaved(productId, {
        shots, title, tagline, details, caption, contact, bgHex, backdropId, removeBg,
        manual: removeBg && manualRef.current ? new Uint8Array(manualRef.current) : null,
        w: a?.w ?? 0, h: a?.h ?? 0, savedAt: Date.now(),
      });
    }, 900);
    return () => clearTimeout(t);
  }, [productId, hasStage, awaiting, stageVersion, shots, title, tagline, details, caption, contact, bgHex, backdropId, removeBg]);

  // ----------------------------------------------------------------- brush

  function canvasPoint(e: React.PointerEvent<HTMLCanvasElement>): [number, number] {
    const c = e.currentTarget;
    const r = c.getBoundingClientRect();
    return [((e.clientX - r.left) * c.width) / r.width, ((e.clientY - r.top) * c.height) / r.height];
  }

  function brushRadius(c: HTMLCanvasElement) {
    const r = c.getBoundingClientRect();
    return Math.max(2, (brushSize / 2) * (c.width / r.width));
  }

  function drawStrokeSegment(a: [number, number], b: [number, number], r: number) {
    const ctx = overlayRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = BRUSH_COLOUR[brush];
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = r * 2;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  }

  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!analysisRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = canvasPoint(e);
    const r = brushRadius(e.currentTarget);
    strokeRef.current = { pts: [p], r };
    drawStrokeSegment(p, p, r);
  }

  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const s = strokeRef.current;
    if (!s) return;
    const p = canvasPoint(e);
    drawStrokeSegment(s.pts[s.pts.length - 1], p, s.r);
    s.pts.push(p);
  }

  function onUp() {
    const s = strokeRef.current;
    const a = analysisRef.current;
    const manual = manualRef.current;
    strokeRef.current = null;
    if (!s || !a || !manual) return;
    undoRef.current.push(new Uint8Array(manual));
    if (undoRef.current.length > 12) undoRef.current.shift();
    setCanUndo(true);
    const value = BRUSH_VALUE[brush];
    for (let i = 0; i < s.pts.length; i++) {
      const p = s.pts[i];
      const q = s.pts[Math.max(0, i - 1)];
      stampLine(manual, a.w, a.h, q[0], q[1], p[0], p[1], s.r, value);
    }
    setStatus("Updating…");
    setTimeout(() => {
      recompose();
      setStatus(null);
    }, 20);
  }

  function undo() {
    const prev = undoRef.current.pop();
    if (!prev) return;
    manualRef.current = prev;
    setCanUndo(undoRef.current.length > 0);
    setStatus("Updating…");
    setTimeout(() => { recompose(); setStatus(null); }, 20);
  }

  function resetTouchUps() {
    const a = analysisRef.current;
    if (!a) return;
    undoRef.current.push(new Uint8Array(manualRef.current ?? new Uint8Array(a.w * a.h)));
    manualRef.current = new Uint8Array(a.w * a.h);
    setCanUndo(true);
    setStatus("Updating…");
    setTimeout(() => { recompose(); setStatus(null); }, 20);
  }

  // ----------------------------------------------------------- shot editor

  function patchShot(i: number, patch: Partial<Shot>) {
    setShots((cur) => cur.map((s, j) => (j === i ? { ...s, ...patch } : s)));
    setVideo(null);
  }

  function setPose(i: number, which: "from" | "to", axis: 0 | 1 | 2, value: number) {
    const pose = [...shots[i][which]] as Pose;
    pose[axis] = value;
    patchShot(i, { [which]: pose } as Partial<Shot>);
  }

  const drawCrop = useCallback((canvas: HTMLCanvasElement | null, pose: Pose) => {
    const sr = stageRef.current;
    if (!canvas || !sr) return;
    canvas.width = PREVIEW_W;
    canvas.height = PREVIEW_H;
    const r = cropRect(sr.stage, pose, ASPECT);
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(sr.canvas, r.x, r.y, r.w, r.h, 0, 0, PREVIEW_W, PREVIEW_H);
  }, []);

  useEffect(() => {
    const sr = stageRef.current;
    const shot = shots[selected];
    if (!sr || !shot) return;
    drawCrop(fromRef.current, shot.from);
    drawCrop(toRef.current, shot.to);
    const ov = overviewRef.current;
    if (ov) {
      ov.width = PREVIEW_W;
      ov.height = PREVIEW_H;
      const ctx = ov.getContext("2d")!;
      ctx.drawImage(sr.canvas, 0, 0, PREVIEW_W, PREVIEW_H);
      const k = PREVIEW_W / sr.stage.width;
      for (const [pose, colour] of [[shot.from, "#A98238"], [shot.to, "#3F4827"]] as const) {
        const r = cropRect(sr.stage, pose, ASPECT);
        ctx.strokeStyle = colour;
        ctx.lineWidth = 2;
        ctx.strokeRect(r.x * k, r.y * k, r.w * k, r.h * k);
      }
    }
  }, [shots, selected, stageVersion, drawCrop]);

  function onOverviewClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const sr = stageRef.current;
    if (!sr) return;
    const c = e.currentTarget;
    const r = c.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * sr.stage.width;
    const sy = ((e.clientY - r.top) / r.height) * sr.stage.height;
    const d = sr.stage.dress;
    const px = Math.min(1, Math.max(0, (sx - d.x0) / (d.x1 - d.x0)));
    const py = Math.min(1, Math.max(0, (sy - d.y0) / (d.y1 - d.y0)));
    const pose = [...shots[selected][clickSets]] as Pose;
    pose[0] = Math.round(px * 100) / 100;
    pose[1] = Math.round(py * 100) / 100;
    patchShot(selected, { [clickSets]: pose } as Partial<Shot>);
  }

  // ------------------------------------------------------------ preview play

  function stopPlay() {
    if (playRef.current != null) cancelAnimationFrame(playRef.current);
    playRef.current = null;
    setPlaying(false);
  }

  async function play() {
    const sr = stageRef.current;
    const canvas = playCanvasRef.current;
    if (!sr || !canvas) return;
    setError(null);
    try {
      await loadFonts();
      const logo = await loadLogo();
      const painter = new ReelPainter({
        stageCanvas: sr.canvas, stage: sr.stage, shots, background: bgHex, logo, backdrop: resolveBackdrop(),
        text: reelText(), width: PREVIEW_W, height: PREVIEW_H,
      });
      canvas.width = PREVIEW_W;
      canvas.height = PREVIEW_H;
      const ctx = canvas.getContext("2d")!;
      // eslint-disable-next-line react-hooks/purity -- runs when the button is pressed, not during render
      const t0 = performance.now();
      setPlaying(true);
      const frame = () => {
        const t = (performance.now() - t0) / 1000;
        if (t >= painter.timeline.total) { stopPlay(); return; }
        painter.drawAt(ctx, t);
        playRef.current = requestAnimationFrame(frame);
      };
      playRef.current = requestAnimationFrame(frame);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The preview could not start.");
    }
  }

  useEffect(() => () => { if (playRef.current != null) cancelAnimationFrame(playRef.current); }, []);

  // everything the painter writes on screen
  function reelText() {
    return {
      brand, title, tagline, contact, details, facts, instagramHandle, instagramUrl,
      contactLines: contact.split("\n").map((l) => l.trim()).filter(Boolean),
    };
  }

  // ---------------------------------------------------------------- cover + caption

  async function downloadCover() {
    const sr = stageRef.current;
    if (!sr) return;
    setError(null);
    try {
      await loadFonts();
      const logo = await loadLogo();
      const painter = new ReelPainter({
        stageCanvas: sr.canvas, stage: sr.stage, shots, background: bgHex, logo, backdrop: resolveBackdrop(),
        text: reelText(), width: 1080, height: 1920,
      });
      const c = document.createElement("canvas");
      c.width = 1080;
      c.height = 1920;
      painter.drawCover(c.getContext("2d")!);
      const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.92));
      if (!blob) throw new Error("The cover image could not be made.");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slug(title || brand)}-cover.jpg`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The cover image could not be made.");
    }
  }

  async function copyCaption() {
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Copying was blocked. Select the text and copy it by hand.");
    }
  }

  // ---------------------------------------------------------------- make it

  async function make() {
    const sr = stageRef.current;
    if (!sr) return;
    stopPlay();
    setError(null);
    setVideo(null);
    setMakeProgress(0);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      await loadFonts();
      await document.fonts.load(`500 20px "Montserrat"`).catch(() => undefined);
      const logo = await loadLogo();
      const painter = new ReelPainter({
        stageCanvas: sr.canvas, stage: sr.stage, shots, background: bgHex, logo, backdrop: resolveBackdrop(),
        text: reelText(), width: 1080, height: 1920,
      });
      const blob = await encodeReel(painter, setMakeProgress, ac.signal);
      setVideo({
        url: URL.createObjectURL(blob),
        mb: blob.size / 1048576,
        name: `${slug(title || brand)}-reel.mp4`,
      });
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        setError(e instanceof Error ? e.message : "The reel could not be made.");
      }
    } finally {
      // a newer make may have started meanwhile; only the latest one clears the bar
      if (abortRef.current === ac) {
        setMakeProgress(null);
        abortRef.current = null;
      }
    }
  }

  // when the cutout and framing are ready, the reel is made without being asked
  useEffect(() => {
    if (!autoMake) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- stop waiting if preparing the photo failed
    if (error) { setAutoMake(false); return; }
    if (!hasStage || status) return;
    setAutoMake(false);
    void make();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoMake, hasStage, status, stageVersion, error]);

  // ------------------------------------------------------------------ view

  const shot = shots[selected];
  const notes = stageInfo ? softnessNotes(stageInfo, shots) : [];
  const enabledCount = shots.filter((s) => s.enabled).length;
  const tooMany = enabledCount > 9;

  return (
    <div className="reel-maker">
      {!supported && (
        <div className="notice-box error">
          This browser cannot make video files. Open this page in the latest Chrome or Edge on a computer.
        </div>
      )}
      {error && <div className="notice-box error">{error}</div>}

      {/* upload ------------------------------------------------------- */}
      <section className="admin-card reel-step">
        <h2>Upload a photo</h2>
        <div className="reel-row">
          <label className="reel-field">
            <span className="field-label">A photo from this computer</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={!!status || makeProgress != null}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) chooseFile(f);
              }}
            />
          </label>
          <label className="reel-field">
            <span className="field-label">…or an existing product photo</span>
            <select value={productId} onChange={(e) => chooseProduct(e.target.value)} disabled={!!status || makeProgress != null}>
              <option value="">Choose a product…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
              ))}
            </select>
          </label>
        </div>
        <div className="reel-row" style={{ marginTop: 14, alignItems: "center" }}>
          <label className="reel-check">
            <input type="checkbox" checked={clearBg} onChange={(e) => setClearBg(e.target.checked)} />
            Clear the background and hanger
          </label>
          {clearBg && (
            <label className="reel-check">
              Backdrop
              <select value={backdropId} onChange={(e) => setBackdropId(e.target.value)}>
                <option value="today">Today&apos;s pick (changes daily)</option>
                <option value="plain">Plain colour</option>
                {SET_BACKDROPS.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </label>
          )}
          <label className="reel-check">
            Background colour
            <input type="color" value={bgHex} onChange={(e) => setBgHex(e.target.value.toUpperCase())} />
            <button type="button" className="btn-ghost" onClick={() => setBgHex("#FFFFF0")}>Ivory</button>
          </label>
        </div>
        <p className="field-hint">
          That is all you need to do. The reel is made on its own in a minute or two, and nothing leaves this
          browser. For the cleanest result, hang the dress against a plain wall. The first time, about 60 MB of
          cutout files download once and are then remembered.
        </p>
        {status && <div className="notice-box" style={{ marginTop: 14 }}>{status}</div>}
        {makeProgress != null && (
          <div className="notice-box" style={{ marginTop: 14 }}>
            Making your reel… {Math.round(makeProgress * 100)}%
            <button type="button" className="btn-ghost" style={{ marginLeft: 14 }} onClick={() => abortRef.current?.abort()}>Cancel</button>
          </div>
        )}
      </section>

      {hasStage && (
        <section className="admin-card reel-step">
          <h2>Your reel</h2>
          {video ? (
            <div className="reel-outputs">
              <div className="reel-result">
                <video src={video.url} controls playsInline className="reel-video" />
                <p className="field-hint">
                  {video.mb.toFixed(1)} MB · 1080×1920 · 30 seconds · no sound. Add music inside Instagram so it is licensed.
                </p>
                <div className="reel-actions" style={{ margin: 0 }}>
                  <a className="btn btn-primary" href={video.url} download={video.name}>Download MP4</a>
                  <button type="button" className="btn btn-outline" onClick={() => void downloadCover()}>Download cover image</button>
                </div>
              </div>
              <div style={{ flex: "1 1 320px" }}>
                <span className="field-label">Instagram caption (draft)</span>
                <textarea className="reel-caption" value={caption} onChange={(e) => setCaption(e.target.value)} rows={12} aria-label="Instagram caption" />
                <div className="reel-actions">
                  <button type="button" className="btn btn-outline" onClick={() => void copyCaption()} disabled={!caption}>
                    {copied ? "Copied" : "Copy caption"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <p className="field-hint" style={{ margin: 0 }}>
              {makeProgress != null ? "Almost there…" : "The reel will appear here."}
            </p>
          )}
        </section>
      )}

      {hasStage && (
        <details className="reel-tune">
          <summary>Fine-tune (optional)</summary>
          <p className="field-hint">
            Only if something looks off. Touch up the cutout, change the shots or the texts, then press
            &ldquo;Make the reel again&rdquo;.
          </p>
      {/* 2 --------------------------------------------------------- cutout */}
      {removeBg && hasAnalysis && (
        <section className="admin-card reel-step">
          <h2>Cutout touch-up</h2>
          <p className="field-hint" style={{ marginTop: 0 }}>
            {method === "plain"
              ? "This dress is not one plain colour, so the cutout is rougher. Use the brush to clean up the edges."
              : "Looks right? Then go to the next step. If something is left over, or something real was removed, paint over it."}
          </p>
          <div className="reel-brushbar">
            {(["remove", "keep", "fill"] as BrushMode[]).map((m) => (
              <button
                key={m}
                type="button"
                className={`chip ${brush === m ? "active" : ""}`}
                onClick={() => setBrush(m)}
              >
                {m === "remove" ? "Remove" : m === "keep" ? "Bring back" : "Rebuild from fabric"}
              </button>
            ))}
            <label className="reel-check">
              Brush
              <input type="range" min={6} max={90} value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} />
            </label>
            <label className="reel-check">
              Zoom
              <select value={zoom} onChange={(e) => setZoom(Number(e.target.value))}>
                <option value={1}>Fit</option>
                <option value={1.6}>1.6×</option>
                <option value={2.4}>2.4×</option>
              </select>
            </label>
            <button type="button" className="btn btn-outline btn-small" onClick={undo} disabled={!canUndo || !!status}>Undo</button>
            <button type="button" className="btn btn-outline btn-small" onClick={resetTouchUps} disabled={!!status}>Clear touch-ups</button>
          </div>
          <p className="field-hint">{BRUSH_HELP[brush]}</p>
          <div className="reel-view">
            <div className="reel-view-inner" style={{ width: `${zoom * 100}%` }}>
              <canvas ref={viewRef} className="reel-canvas" />
              <canvas
                ref={overlayRef}
                className="reel-canvas reel-overlay"
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={onUp}
              />
            </div>
          </div>
        </section>
      )}

      {/* 3 ----------------------------------------------------------- shots */}
      {hasStage && shot && (
        <section className="admin-card reel-step">
          <h2>Shots</h2>
          <p className="field-hint" style={{ marginTop: 0 }}>
            The reel moves slowly across the dress in these shots, one after another. Turn shots off, rename the captions,
            or aim a shot at a different part of the dress. Click the small picture to point the camera.
          </p>
          <div className="reel-shots">
            <div className="reel-shotlist">
              {shots.map((s, i) => (
                <div key={i} className={`reel-shotrow ${i === selected ? "on" : ""}`}>
                  <input
                    type="checkbox"
                    checked={s.enabled}
                    onChange={(e) => patchShot(i, { enabled: e.target.checked })}
                    aria-label={`Use shot ${s.name}`}
                  />
                  <button type="button" className="reel-shotname" onClick={() => setSelected(i)}>
                    {i + 1}. {s.name}
                  </button>
                </div>
              ))}
              {tooMany && <p className="field-error">That is a lot for 30 seconds. Turn a few off.</p>}
            </div>

            <div className="reel-shotedit">
              <div className="reel-previews">
                <figure>
                  <canvas ref={fromRef} />
                  <figcaption style={{ color: "var(--gold)" }}>Start</figcaption>
                </figure>
                <figure>
                  <canvas ref={toRef} />
                  <figcaption style={{ color: "var(--olive)" }}>End</figcaption>
                </figure>
                <figure>
                  <canvas ref={overviewRef} onClick={onOverviewClick} style={{ cursor: "crosshair" }} />
                  <figcaption>
                    <label><input type="radio" checked={clickSets === "from"} onChange={() => setClickSets("from")} /> click sets start</label>
                    <br />
                    <label><input type="radio" checked={clickSets === "to"} onChange={() => setClickSets("to")} /> click sets end</label>
                  </figcaption>
                </figure>
              </div>
              <div className="reel-sliders">
                <label className="reel-field">
                  <span className="field-label">Caption (optional)</span>
                  <input
                    type="text" value={shot.caption} maxLength={40} placeholder="e.g. Embroidered yoke"
                    onChange={(e) => patchShot(selected, { caption: e.target.value })}
                  />
                </label>
                <label className="reel-field">
                  <span className="field-label">Time on this shot <em>{shot.weight.toFixed(1)}×</em></span>
                  <input type="range" min={0.5} max={2} step={0.1} value={shot.weight}
                    onChange={(e) => patchShot(selected, { weight: Number(e.target.value) })} />
                </label>
                {(["from", "to"] as const).map((which) => (
                  <div key={which} className="reel-posegroup">
                    <strong>{which === "from" ? "Start" : "End"}</strong>
                    {(["Across", "Down", "Zoom"] as const).map((label, axis) => (
                      <label key={label} className="reel-slider">
                        <span>{label}</span>
                        <input
                          type="range"
                          min={axis === 2 ? 1 : 0} max={axis === 2 ? 3 : 1} step={0.01}
                          value={shot[which][axis]}
                          onChange={(e) => setPose(selected, which, axis as 0 | 1 | 2, Number(e.target.value))}
                        />
                        <em>{shot[which][axis].toFixed(2)}</em>
                      </label>
                    ))}
                  </div>
                ))}
                <button type="button" className="btn-ghost" onClick={() => { setShots(defaultShots()); setVideo(null); }}>
                  Reset all shots
                </button>
              </div>
            </div>
          </div>
          {notes.length > 0 && (
            <div className="notice-box" style={{ marginTop: 14 }}>
              {notes.map((n) => <div key={n}>{n}</div>)}
              <div>A sharper photo (straight from the phone camera) fixes this.</div>
            </div>
          )}
        </section>
      )}

      {/* 4 ------------------------------------------------------- make it */}
      {hasStage && (
        <section className="admin-card reel-step">
          <h2>Texts and preview</h2>
          <div className="reel-row">
            <label className="reel-field">
              <span className="field-label">Product name (end card)</span>
              <input type="text" value={title} onChange={(e) => { setTitle(e.target.value); setVideo(null); }} maxLength={60} />
            </label>
            <label className="reel-field">
              <span className="field-label">Tagline (optional)</span>
              <input type="text" value={tagline} onChange={(e) => { setTagline(e.target.value); setVideo(null); }} maxLength={60} />
            </label>
            <label className="reel-field">
              <span className="field-label">Contact lines, last screen (one per line)</span>
              <textarea value={contact} rows={3} maxLength={160} style={{ width: "100%", font: "inherit" }}
                onChange={(e) => { setContact(e.target.value); setVideo(null); }} />
            </label>
          </div>
          <label className="reel-field" style={{ marginTop: 14, maxWidth: 560 }}>
            <span className="field-label">Details line on the end card (price, sizes, fabric)</span>
            <input type="text" value={details} onChange={(e) => { setDetails(e.target.value); setVideo(null); }} maxLength={70}
              placeholder="e.g. ₹1,499 · Sizes S, M, L · Cotton" />
            <span className="field-hint" style={{ margin: 0 }}>
              Filled in from the product. Change it, or empty it to leave it off.
            </span>
          </label>

          <div className="reel-actions">
            <button type="button" className="btn btn-outline" onClick={playing ? stopPlay : play} disabled={makeProgress != null || tooMany || enabledCount === 0}>
              {playing ? "Stop preview" : "Preview (small)"}
            </button>
            <button type="button" className="btn btn-primary" onClick={make} disabled={makeProgress != null || !supported || tooMany || enabledCount === 0}>
              {makeProgress != null ? `Making… ${Math.round(makeProgress * 100)}%` : "Make the reel again"}
            </button>
            {makeProgress != null && (
              <button type="button" className="btn btn-outline" onClick={() => abortRef.current?.abort()}>Cancel</button>
            )}
          </div>

          <div className="reel-outputs">
            <div>
              <canvas ref={playCanvasRef} className="reel-previewcanvas" width={PREVIEW_W} height={PREVIEW_H} />
            </div>
          </div>
        </section>
      )}

        </details>
      )}
    </div>
  );
}
