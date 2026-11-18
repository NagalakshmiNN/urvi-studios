"use client";

import { useEffect, useRef } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
 * FestivalCanvas — image-based festival animations for the homepage.
 *
 * HOW TO SWAP IMAGES:
 * Each festival uses SVG images defined in FEST_ASSETS below.
 * To use your own images (PNG, SVG, etc.), replace the `src` value:
 *   FEST_ASSETS.kite.src = '/images/my-kite.png';
 *
 * HOW TO ADD A NEW FESTIVAL:
 * 1. Add image entries to FEST_ASSETS
 * 2. Add a draw function (e.g. drawPongal)
 * 3. Add the mapping in DRAW_MAP
 * 4. Add the animation name to the admin form dropdown
 * ═══════════════════════════════════════════════════════════════════════════ */

type Particle = {
  type: string;
  img?: HTMLImageElement;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  rot: number;
  rotV: number;
  wobble: number;
  wobbleSpeed: number;
  gravity: number;
  decay: number;
  life: number;
  angle: number;
  angSpeed: number;
  radius: number;
  targetY: number;
  color: string;
};

function makeSVGImage(svgString: string): HTMLImageElement {
  if (typeof window === "undefined") {
    // SSR guard – return a stub that won't crash
    return { complete: false } as unknown as HTMLImageElement;
  }
  const img = new Image();
  img.src = "data:image/svg+xml;base64," + btoa(svgString);
  return img;
}

/* Lazy-init assets only on the client side */
let _assets: ReturnType<typeof buildAssets> | null = null;
function getAssets() {
  if (!_assets) _assets = buildAssets();
  return _assets;
}
function buildAssets() {
  return {
    /* Diwali */
    diwaliSpark: makeSVGImage(
      '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M16 0 L18 13 L32 16 L18 19 L16 32 L14 19 L0 16 L14 13 Z" fill="#FFD700" opacity="0.9"/></svg>'
    ),
    diwaliDiya: makeSVGImage(
      '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><ellipse cx="14" cy="20" rx="10" ry="5" fill="#C87533"/><path d="M14 4 Q16 10 18 14 Q14 12 10 14 Q12 10 14 4Z" fill="#FF6B00"/><circle cx="14" cy="8" r="2" fill="#FFD700" opacity="0.8"/></svg>'
    ),
    /* Christmas */
    snowflake: makeSVGImage(
      '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><g fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round"><line x1="16" y1="2" x2="16" y2="30"/><line x1="4" y1="9" x2="28" y2="23"/><line x1="4" y1="23" x2="28" y2="9"/><line x1="16" y1="8" x2="12" y2="5"/><line x1="16" y1="8" x2="20" y2="5"/><line x1="16" y1="24" x2="12" y2="27"/><line x1="16" y1="24" x2="20" y2="27"/></g></svg>'
    ),
    christmasStar: makeSVGImage(
      '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><polygon points="14,2 17,10 26,10 19,16 21,25 14,20 7,25 9,16 2,10 11,10" fill="#FFD700" opacity="0.9"/></svg>'
    ),
    /* Sankranti */
    kite: makeSVGImage(
      '<svg xmlns="http://www.w3.org/2000/svg" width="60" height="80" viewBox="0 0 60 80"><polygon points="30,0 55,30 30,55 5,30" fill="#E74C3C" stroke="#333" stroke-width="1"/><line x1="5" y1="30" x2="55" y2="30" stroke="#FFD700" stroke-width="1.5"/><line x1="30" y1="0" x2="30" y2="55" stroke="#FFD700" stroke-width="1.5"/><path d="M30 55 Q35 65 28 70 Q33 75 30 80" fill="none" stroke="#E74C3C" stroke-width="1.5"/></svg>'
    ),
    kiteBlue: makeSVGImage(
      '<svg xmlns="http://www.w3.org/2000/svg" width="60" height="80" viewBox="0 0 60 80"><polygon points="30,0 55,30 30,55 5,30" fill="#3498DB" stroke="#333" stroke-width="1"/><line x1="5" y1="30" x2="55" y2="30" stroke="#FFD700" stroke-width="1.5"/><line x1="30" y1="0" x2="30" y2="55" stroke="#FFD700" stroke-width="1.5"/><path d="M30 55 Q35 65 28 70 Q33 75 30 80" fill="none" stroke="#3498DB" stroke-width="1.5"/></svg>'
    ),
    kiteGreen: makeSVGImage(
      '<svg xmlns="http://www.w3.org/2000/svg" width="60" height="80" viewBox="0 0 60 80"><polygon points="30,0 55,30 30,55 5,30" fill="#27AE60" stroke="#333" stroke-width="1"/><line x1="5" y1="30" x2="55" y2="30" stroke="#FFD700" stroke-width="1.5"/><line x1="30" y1="0" x2="30" y2="55" stroke="#FFD700" stroke-width="1.5"/><path d="M30 55 Q35 65 28 70 Q33 75 30 80" fill="none" stroke="#27AE60" stroke-width="1.5"/></svg>'
    ),
    kitePink: makeSVGImage(
      '<svg xmlns="http://www.w3.org/2000/svg" width="60" height="80" viewBox="0 0 60 80"><polygon points="30,0 55,30 30,55 5,30" fill="#E91E63" stroke="#333" stroke-width="1"/><line x1="5" y1="30" x2="55" y2="30" stroke="#FFD700" stroke-width="1.5"/><line x1="30" y1="0" x2="30" y2="55" stroke="#FFD700" stroke-width="1.5"/><path d="M30 55 Q35 65 28 70 Q33 75 30 80" fill="none" stroke="#E91E63" stroke-width="1.5"/></svg>'
    ),
    /* Navratri */
    dandiya: makeSVGImage(
      '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="12" viewBox="0 0 80 12"><rect x="8" y="3" width="64" height="6" rx="3" fill="#FF6347"/><circle cx="8" cy="6" r="5" fill="#FFD700"/><circle cx="72" cy="6" r="5" fill="#FFD700"/></svg>'
    ),
    garbaDot: makeSVGImage(
      '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" fill="#FF69B4" opacity="0.8"/><circle cx="10" cy="10" r="4" fill="#FFD700" opacity="0.6"/></svg>'
    ),
    /* Ugadi */
    mangoLeaf: makeSVGImage(
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="40" viewBox="0 0 24 40"><path d="M12 2 C18 10 20 20 12 38 C4 20 6 10 12 2Z" fill="#3F7A27"/><line x1="12" y1="6" x2="12" y2="34" stroke="rgba(255,255,255,0.3)" stroke-width="0.8"/></svg>'
    ),
    flowerPetal: makeSVGImage(
      '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="14" viewBox="0 0 20 14"><ellipse cx="10" cy="7" rx="9" ry="6" fill="#FF9999" opacity="0.7"/></svg>'
    ),
    marigold: makeSVGImage(
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" fill="#E67E22"/><g fill="#F39C12"><ellipse cx="20" cy="12" rx="4" ry="2.5" transform="rotate(0 20 12)"/><ellipse cx="17.7" cy="17.7" rx="4" ry="2.5" transform="rotate(45 17.7 17.7)"/><ellipse cx="12" cy="20" rx="4" ry="2.5" transform="rotate(90 12 20)"/><ellipse cx="6.3" cy="17.7" rx="4" ry="2.5" transform="rotate(135 6.3 17.7)"/><ellipse cx="4" cy="12" rx="4" ry="2.5" transform="rotate(180 4 12)"/><ellipse cx="6.3" cy="6.3" rx="4" ry="2.5" transform="rotate(225 6.3 6.3)"/><ellipse cx="12" cy="4" rx="4" ry="2.5" transform="rotate(270 12 4)"/><ellipse cx="17.7" cy="6.3" rx="4" ry="2.5" transform="rotate(315 17.7 6.3)"/></g></svg>'
    ),
  };
}

type DrawFn = (
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  particles: Particle[],
  isBurst: boolean,
  assets: ReturnType<typeof buildAssets>
) => void;

/* ── Draw functions ── */

function drawDiwali(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  particles: Particle[],
  isBurst: boolean,
  assets: ReturnType<typeof buildAssets>
) {
  const spawnRate = isBurst ? 0.08 : 0.005;
  const maxP = isBurst ? 200 : 40;

  if (Math.random() < spawnRate && particles.length < maxP) {
    const x = Math.random() * canvas.width;
    const targetY = canvas.height * (0.15 + Math.random() * 0.4);
    particles.push({
      type: "rocket", x, y: canvas.height, targetY,
      vy: -(6 + Math.random() * 4), opacity: 1,
      vx: 0, size: 3, rot: 0, rotV: 0, wobble: 0, wobbleSpeed: 0,
      gravity: 0, decay: 0, life: 1, angle: 0, angSpeed: 0, radius: 0, color: "",
    });
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    if (p.type === "rocket") {
      p.y += p.vy;
      ctx.save();
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = "#FFD700";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x, p.y + 20);
      ctx.strokeStyle = "#FFA500";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      if (p.y <= p.targetY) {
        const count = isBurst ? 25 + Math.floor(Math.random() * 15) : 10;
        const useSpark = Math.random() < 0.6;
        for (let j = 0; j < count; j++) {
          const angle = (Math.PI * 2 * j) / count + (Math.random() - 0.5) * 0.3;
          const speed = 2 + Math.random() * 4;
          particles.push({
            type: "spark",
            img: useSpark ? assets.diwaliSpark : assets.diwaliDiya,
            x: p.x, y: p.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: 12 + Math.random() * 16,
            opacity: 1,
            decay: 0.012 + Math.random() * 0.008,
            gravity: 0.04,
            rot: 0, rotV: 0, wobble: 0, wobbleSpeed: 0,
            life: 1, angle: 0, angSpeed: 0, radius: 0, targetY: 0, color: "",
          });
        }
        particles.splice(i, 1);
      }
    } else if (p.type === "spark") {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.vx *= 0.99;
      p.opacity -= p.decay;
      if (p.opacity <= 0) { particles.splice(i, 1); continue; }
      ctx.save();
      ctx.globalAlpha = p.opacity;
      ctx.translate(p.x, p.y);
      if (p.img && (p.img as HTMLImageElement).complete) {
        ctx.drawImage(p.img, -p.size / 2, -p.size / 2, p.size, p.size);
      }
      ctx.restore();
    }
  }
}

function drawChristmas(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  particles: Particle[],
  isBurst: boolean,
  assets: ReturnType<typeof buildAssets>
) {
  const spawnRate = isBurst ? 0.3 : 0.04;
  const maxP = isBurst ? 120 : 35;

  if (Math.random() < spawnRate && particles.length < maxP) {
    const isStar = Math.random() < 0.15;
    particles.push({
      type: "snow",
      img: isStar ? assets.christmasStar : assets.snowflake,
      x: Math.random() * canvas.width, y: -20,
      size: 12 + Math.random() * 20,
      vy: 1 + Math.random() * 2,
      vx: (Math.random() - 0.5) * 1.5,
      wobble: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.02 + Math.random() * 0.02,
      rot: Math.random() * Math.PI * 2,
      rotV: (Math.random() - 0.5) * 0.02,
      opacity: 0.4 + Math.random() * 0.5,
      gravity: 0, decay: 0, life: 1, angle: 0, angSpeed: 0, radius: 0,
      targetY: 0, color: "",
    });
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.y += p.vy;
    p.wobble += p.wobbleSpeed;
    p.x += p.vx + Math.sin(p.wobble) * 0.5;
    p.rot += p.rotV;
    if (p.y > canvas.height + 20) { particles.splice(i, 1); continue; }
    ctx.save();
    ctx.globalAlpha = p.opacity;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    if (p.img && (p.img as HTMLImageElement).complete) {
      ctx.drawImage(p.img, -p.size / 2, -p.size / 2, p.size, p.size);
    }
    ctx.restore();
  }
}

function drawSankranti(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  particles: Particle[],
  isBurst: boolean,
  assets: ReturnType<typeof buildAssets>
) {
  const spawnRate = isBurst ? 0.04 : 0.003;
  const maxP = isBurst ? 18 : 4;
  const kiteImgs = [assets.kite, assets.kiteBlue, assets.kiteGreen, assets.kitePink];

  if (Math.random() < spawnRate && particles.length < maxP) {
    particles.push({
      type: "kite",
      img: kiteImgs[Math.floor(Math.random() * kiteImgs.length)],
      x: -60 + Math.random() * canvas.width * 0.4,
      y: canvas.height * (0.08 + Math.random() * 0.45),
      vx: 1.5 + Math.random() * 2,
      vy: -0.3 + (Math.random() - 0.5) * 0.6,
      size: 40 + Math.random() * 30,
      wobble: Math.random() * Math.PI * 2,
      opacity: 0.7 + Math.random() * 0.3,
      rot: 0, rotV: 0, wobbleSpeed: 0.03, gravity: 0, decay: 0, life: 1,
      angle: 0, angSpeed: 0, radius: 0, targetY: 0, color: "",
    });
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy + Math.sin(p.wobble) * 0.3;
    p.wobble += p.wobbleSpeed;
    if (p.x > canvas.width + 80) { particles.splice(i, 1); continue; }
    ctx.save();
    ctx.globalAlpha = p.opacity;
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.sin(p.wobble) * 0.12);
    if (p.img && (p.img as HTMLImageElement).complete) {
      const h = p.size * 1.33;
      ctx.drawImage(p.img, -p.size / 2, -h / 2, p.size, h);
    }
    ctx.restore();
  }
}

function drawNavratri(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  particles: Particle[],
  isBurst: boolean,
  assets: ReturnType<typeof buildAssets>
) {
  const spawnRate = isBurst ? 0.12 : 0.02;
  const maxP = isBurst ? 80 : 20;

  if (Math.random() < spawnRate && particles.length < maxP) {
    const isStick = Math.random() < 0.3;
    if (isStick) {
      particles.push({
        type: "stick",
        img: assets.dandiya,
        x: Math.random() * canvas.width,
        y: canvas.height * (0.2 + Math.random() * 0.5),
        angle: Math.random() * Math.PI,
        angSpeed: 0.03 + Math.random() * 0.04,
        size: 50 + Math.random() * 40,
        opacity: 0.7, life: 1, decay: 0.005,
        vx: 0, vy: 0, rot: 0, rotV: 0, wobble: 0, wobbleSpeed: 0,
        gravity: 0, radius: 0, targetY: 0, color: "",
      });
    } else {
      particles.push({
        type: "dot",
        img: assets.garbaDot,
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        angle: Math.random() * Math.PI * 2,
        radius: 20 + Math.random() * 60,
        angSpeed: (0.02 + Math.random() * 0.03) * (Math.random() < 0.5 ? 1 : -1),
        size: 10 + Math.random() * 14,
        opacity: 0.6 + Math.random() * 0.4,
        life: 1, decay: isBurst ? 0.004 : 0.003,
        vx: 0, vy: 0, rot: 0, rotV: 0, wobble: 0, wobbleSpeed: 0,
        gravity: 0, targetY: 0, color: "",
      });
    }
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= p.decay;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    ctx.save();
    ctx.globalAlpha = p.life * p.opacity;

    if (p.type === "dot") {
      p.angle += p.angSpeed;
      const dx = Math.cos(p.angle) * p.radius;
      const dy = Math.sin(p.angle) * p.radius;
      if (p.img && (p.img as HTMLImageElement).complete) {
        ctx.drawImage(p.img, p.x + dx - p.size / 2, p.y + dy - p.size / 2, p.size, p.size);
      }
    } else {
      p.angle += p.angSpeed;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      if (p.img && (p.img as HTMLImageElement).complete) {
        const h = p.size * 0.15;
        ctx.drawImage(p.img, -p.size / 2, -h / 2, p.size, h);
      }
    }
    ctx.restore();
  }
}

function drawUgadi(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  particles: Particle[],
  isBurst: boolean,
  assets: ReturnType<typeof buildAssets>
) {
  const spawnRate = isBurst ? 0.2 : 0.03;
  const maxP = isBurst ? 80 : 20;

  if (Math.random() < spawnRate && particles.length < maxP) {
    const r = Math.random();
    let img: HTMLImageElement, size: number;
    if (r < 0.4) { img = assets.mangoLeaf; size = 18 + Math.random() * 16; }
    else if (r < 0.75) { img = assets.flowerPetal; size = 12 + Math.random() * 14; }
    else { img = assets.marigold; size = 14 + Math.random() * 12; }
    particles.push({
      type: "fall", img,
      x: Math.random() * canvas.width, y: -20,
      vx: (Math.random() - 0.5) * 1.8,
      vy: 1 + Math.random() * 2,
      size,
      rot: Math.random() * Math.PI * 2,
      rotV: (Math.random() - 0.5) * 0.05,
      wobble: Math.random() * Math.PI * 2,
      opacity: 0.5 + Math.random() * 0.4,
      wobbleSpeed: 0.02, gravity: 0, decay: 0, life: 1,
      angle: 0, angSpeed: 0, radius: 0, targetY: 0, color: "",
    });
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.y += p.vy;
    p.wobble += p.wobbleSpeed;
    p.x += p.vx + Math.sin(p.wobble) * 0.6;
    p.rot += p.rotV;
    if (p.y > canvas.height + 30) { particles.splice(i, 1); continue; }
    ctx.save();
    ctx.globalAlpha = p.opacity;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    if (p.img && (p.img as HTMLImageElement).complete) {
      const nw = (p.img as HTMLImageElement).naturalWidth || 1;
      const nh = (p.img as HTMLImageElement).naturalHeight || 1;
      const aspect = nh / nw;
      const h = p.size * aspect;
      ctx.drawImage(p.img, -p.size / 2, -h / 2, p.size, h);
    }
    ctx.restore();
  }
}

const DRAW_MAP: Record<string, DrawFn> = {
  diwali: drawDiwali,
  christmas: drawChristmas,
  sankranti: drawSankranti,
  navratri: drawNavratri,
  ugadi: drawUgadi,
};

type Props = {
  animation: string | null;
};

export default function FestivalCanvas({ animation }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    try {
      if (!animation || animation === "none") return;
      const drawFn = DRAW_MAP[animation];
      if (!drawFn) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      // Respect reduced motion
      try {
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      } catch { /* SSR guard */ }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const assets = getAssets();
      const particles: Particle[] = [];
      let w = 0;
      let h = 0;
      const burstDuration = 6000;
      const startTime = Date.now();

      function resize() {
        if (!canvas) return;
        w = canvas.width = canvas.offsetWidth * 2;
        h = canvas.height = canvas.offsetHeight * 2;
      }
      resize();

      function animate() {
        if (!ctx || !canvas) return;
        ctx.clearRect(0, 0, w, h);
        const isBurst = Date.now() - startTime < burstDuration;
        drawFn(ctx, canvas, particles, isBurst, assets);
        rafRef.current = requestAnimationFrame(animate);
      }

      rafRef.current = requestAnimationFrame(animate);
      window.addEventListener("resize", resize);

      return () => {
        cancelAnimationFrame(rafRef.current);
        window.removeEventListener("resize", resize);
      };
    } catch (err) {
      // Error safety: never crash the homepage for a failed animation
      console.error("[FestivalCanvas] animation error:", err);
    }
  }, [animation]);

  if (!animation || animation === "none") return null;
  if (!DRAW_MAP[animation]) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 9999,
      }}
    />
  );
}
