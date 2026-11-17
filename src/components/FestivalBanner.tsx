"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type FestivalTheme = {
  primary: string;
  accent: string;
  bg: string;
  bgEnd: string;
  text: string;
};

type Props = {
  name: string;
  tagline: string | null;
  bannerText: string | null;
  bannerSub: string | null;
  theme: FestivalTheme;
  animation: string | null;
  endsAt: string; // ISO string
};

export default function FestivalBanner({
  name,
  tagline,
  bannerText,
  bannerSub,
  theme,
  animation,
  endsAt,
}: Props) {
  const [timeLeft, setTimeLeft] = useState("");
  const [dismissed, setDismissed] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  // Countdown timer
  useEffect(() => {
    function update() {
      const end = new Date(endsAt).getTime();
      const now = Date.now();
      const diff = end - now;
      if (diff <= 0) {
        setTimeLeft("Event ended");
        return;
      }
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h ${mins}m`);
      } else {
        setTimeLeft(`${hours}h ${mins}m ${secs}s`);
      }
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  // Particle animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || animation === "none") return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = (canvas.width = canvas.offsetWidth * 2);
    let h = (canvas.height = canvas.offsetHeight * 2);

    type Particle = {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      color: string;
      rotation: number;
      rotSpeed: number;
      opacity: number;
      shape: "rect" | "circle" | "star";
    };

    const particles: Particle[] = [];
    const colors = [theme.primary, theme.accent, theme.text, "#FFD700", "#FF6B6B"];

    function spawn() {
      const shape = (["rect", "circle", "star"] as const)[Math.floor(Math.random() * 3)];
      particles.push({
        x: Math.random() * w,
        y: -20,
        vx: (Math.random() - 0.5) * 2,
        vy: 1 + Math.random() * 3,
        size: 4 + Math.random() * 8,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.1,
        opacity: 0.7 + Math.random() * 0.3,
        shape,
      });
    }

    function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
        const method = i === 0 ? "moveTo" : "lineTo";
        ctx[method](cx + r * Math.cos(angle), cy + r * Math.sin(angle));
      }
      ctx.closePath();
      ctx.fill();
    }

    function animate() {
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);

      // Spawn new particles
      if (animation === "confetti" && particles.length < 40 && Math.random() < 0.3) spawn();
      if (animation === "sparkle" && particles.length < 25 && Math.random() < 0.15) spawn();

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotSpeed;
        p.opacity -= 0.003;

        if (p.y > h || p.opacity <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;

        if (p.shape === "rect") {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        } else if (p.shape === "circle") {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          drawStar(ctx, 0, 0, p.size / 2);
        }

        ctx.restore();
      }

      rafRef.current = requestAnimationFrame(animate);
    }

    rafRef.current = requestAnimationFrame(animate);

    const onResize = () => {
      w = canvas.width = canvas.offsetWidth * 2;
      h = canvas.height = canvas.offsetHeight * 2;
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", onResize);
    };
  }, [animation, theme]);

  if (dismissed) return null;

  const headline = bannerText || name;
  const sub = bannerSub || tagline;

  return (
    <div
      className="festival-banner"
      style={{
        background: `linear-gradient(135deg, ${theme.bg}, ${theme.bgEnd})`,
        color: theme.text,
        position: "relative",
        overflow: "hidden",
        padding: "24px 20px",
        textAlign: "center",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      />
      <div style={{ position: "relative", zIndex: 1, maxWidth: 800, margin: "0 auto" }}>
        <div
          style={{
            fontSize: 11,
            fontFamily: "var(--font-body, Montserrat, sans-serif)",
            textTransform: "uppercase",
            letterSpacing: "0.15em",
            opacity: 0.8,
            marginBottom: 6,
          }}
        >
          {timeLeft && <>Ends in {timeLeft}</>}
        </div>
        <h2
          style={{
            fontFamily: "var(--font-display, 'Cormorant Garamond', serif)",
            fontSize: "clamp(22px, 4vw, 36px)",
            fontWeight: 600,
            margin: "0 0 6px",
            lineHeight: 1.2,
            textWrap: "balance",
          }}
        >
          {headline}
        </h2>
        {sub && (
          <p
            style={{
              fontFamily: "var(--font-body, Montserrat, sans-serif)",
              fontSize: "clamp(13px, 2vw, 16px)",
              margin: "0 0 14px",
              opacity: 0.9,
            }}
          >
            {sub}
          </p>
        )}
        <Link
          href="/shop"
          style={{
            display: "inline-block",
            padding: "10px 28px",
            background: theme.primary,
            color: theme.text,
            fontFamily: "var(--font-body, Montserrat, sans-serif)",
            fontSize: 13,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            textDecoration: "none",
            borderRadius: 2,
          }}
        >
          Shop the Sale
        </Link>
      </div>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss banner"
        style={{
          position: "absolute",
          top: 8,
          right: 12,
          background: "none",
          border: "none",
          color: theme.text,
          fontSize: 20,
          cursor: "pointer",
          opacity: 0.6,
          zIndex: 2,
          lineHeight: 1,
        }}
      >
        ✕
      </button>
    </div>
  );
}
